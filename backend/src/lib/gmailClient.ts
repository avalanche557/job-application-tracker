import { google } from "googleapis";
import { createOAuthClient } from "./googleOAuth.js";

// Narrow, heuristic search: job-application-shaped subjects, or the ATS/job-board
// senders that generate most of this traffic. Keeps the sync fast and avoids
// scanning the whole inbox. Not exhaustive - misses get caught by manual review.
const SEARCH_QUERY =
  '(subject:(application OR applying OR "thank you for applying" OR interview OR "your application" OR offer OR rejected OR "not moving forward") ' +
  "OR from:(greenhouse OR lever OR workday OR icims OR smartrecruiters OR jobvite OR linkedin OR indeed OR ashbyhq)) " +
  "newer_than:90d";

export type GmailMessage = {
  id: string;
  subject: string | null;
  from: string | null;
  receivedAt: Date | null;
  bodyText: string;
};

function buildAuthedClient(refreshToken: string) {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: client });
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

export async function listCandidateMessageIds(refreshToken: string): Promise<string[]> {
  const gmail = buildAuthedClient(refreshToken);
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const { data } = await gmail.users.messages.list({
      userId: "me",
      q: SEARCH_QUERY,
      maxResults: 50,
      pageToken,
    });
    ids.push(...(data.messages ?? []).map((m) => m.id!));
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken && ids.length < 200); // hard cap per sync run

  return ids;
}

export async function fetchMessage(refreshToken: string, messageId: string): Promise<GmailMessage> {
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
}
