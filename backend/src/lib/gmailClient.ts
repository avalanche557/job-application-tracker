import { google } from "googleapis";
import { createOAuthClient } from "./googleOAuth.js";

// Narrow, heuristic search: job-application-shaped subjects, or the ATS/job-board
// senders that generate most of this traffic. Keeps the sync fast and avoids
// scanning the whole inbox. Not exhaustive - misses get caught by manual review.
const BASE_SEARCH_QUERY =
  '(subject:(application OR applying OR "thank you for applying" OR interview OR "your application" OR offer OR rejected OR "not moving forward" OR "your interest" OR "interest in" OR "role at") ' +
  "OR from:(greenhouse OR lever OR workday OR icims OR smartrecruiters OR jobvite OR linkedin OR indeed OR ashbyhq))";

// A day of overlap on the lower bound: Gmail's `after:` is date-granular (not
// second-granular), and RawEmail dedup makes re-seeing a message harmless, so
// erring toward re-listing a few already-processed messages is safer than
// risking a gap right at the boundary.
const INCREMENTAL_OVERLAP_MS = 24 * 60 * 60 * 1000;

export type GmailMessage = {
  id: string;
  subject: string | null;
  from: string | null;
  receivedAt: Date | null;
  bodyText: string;
};

// Thrown when Google rejects the stored refresh token outright (revoked, or
// expired - test-mode OAuth consent grants expire after 7 days). No amount of
// retrying fixes this; the user has to reconnect the account.
export class GmailAuthExpiredError extends Error {
  constructor() {
    super("Gmail connection has expired and needs to be reconnected");
    this.name = "GmailAuthExpiredError";
  }
}

function isInvalidGrantError(err: unknown): boolean {
  const data = (err as { response?: { data?: { error?: string } } })?.response?.data;
  return data?.error === "invalid_grant";
}

function buildAuthedClient(refreshToken: string) {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: client });
}

async function withAuthErrorHandling<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isInvalidGrantError(err)) throw new GmailAuthExpiredError();
    throw err;
  }
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findPart(payload: unknown, mimeType: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const part = payload as {
    mimeType?: string;
    body?: { data?: string };
    parts?: unknown[];
  };

  if (part.mimeType === mimeType && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.parts) {
    for (const child of part.parts) {
      const found = findPart(child, mimeType);
      if (found) return found;
    }
  }
  return null;
}

function extractPlainText(payload: unknown): string {
  const plain = findPart(payload, "text/plain");
  if (plain) return plain;

  const html = findPart(payload, "text/html");
  if (html) return stripHtml(html);

  return "";
}

function header(headers: { name?: string | null; value?: string | null }[] | undefined, name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
}

// `since` should be the account's last successful sync time, if any - narrows
// the search to messages that arrived after the last sync (with a day of
// overlap, see INCREMENTAL_OVERLAP_MS) instead of re-listing the full
// window on every run. First-ever sync (no `since`) scans the last 3 weeks.
export async function listCandidateMessageIds(refreshToken: string, since?: Date | null): Promise<string[]> {
  return withAuthErrorHandling(async () => {
    const gmail = buildAuthedClient(refreshToken);
    const ids: string[] = [];
    let pageToken: string | undefined;

    const query = since
      ? `${BASE_SEARCH_QUERY} after:${Math.floor((since.getTime() - INCREMENTAL_OVERLAP_MS) / 1000)}`
      : `${BASE_SEARCH_QUERY} newer_than:21d`;

    do {
      const { data } = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: 50,
        pageToken,
      });
      ids.push(...(data.messages ?? []).map((m) => m.id!));
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken && ids.length < 200); // hard cap per sync run

    return ids;
  });
}

export async function fetchMessage(refreshToken: string, messageId: string): Promise<GmailMessage> {
  return withAuthErrorHandling(async () => {
    const gmail = buildAuthedClient(refreshToken);
    const { data } = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const headers = data.payload?.headers;
    const bodyText = extractPlainText(data.payload).slice(0, 8000); // cap for LLM input

    return {
      id: messageId,
      subject: header(headers, "Subject"),
      from: header(headers, "From"),
      receivedAt: data.internalDate ? new Date(Number(data.internalDate)) : null,
      bodyText,
    };
  });
}
