import { prisma } from "../lib/prisma.js";
import { listCandidateMessageIds, fetchMessage, GmailAuthExpiredError } from "../lib/gmailClient.js";
import { extractJobApplicationInfo, AllProvidersExhaustedError } from "../lib/llm/router.js";
import type { ExtractionResult } from "../lib/llm/types.js";
import { classifyWithRegex } from "../lib/emailClassifier.js";
import {
  createApplication,
  updateApplication,
  findApplicationByCompany,
} from "./jobApplication.service.js";
import { getEmailAccountWithDecryptedToken, touchLastSynced } from "./emailAccount.service.js";

const CONFIDENCE_THRESHOLD = 0.5;

export class EmailAccountDisconnectedError extends Error {
  constructor() {
    super("Account disconnected — reconnect Gmail to resume syncing");
    this.name = "EmailAccountDisconnectedError";
  }
}

export type SyncSummary = {
  scanned: number;
  created: number;
  updated: number;
  skippedNotJobRelated: number;
  alreadyProcessed: number;
  failed: number;
  resolvedByRegex: number;
  resolvedByLlm: number;
  skippedQuotaExhausted: number;
  stoppedEarly: "quota_exceeded" | null;
};

export async function syncEmailAccount(
  userId: string,
  emailAccountId: string,
  options?: { force?: boolean },
): Promise<SyncSummary> {
  const account = await getEmailAccountWithDecryptedToken(userId, emailAccountId);
  if (!account) throw new Error("Email account not found");
  if (account.disconnectedAt) throw new EmailAccountDisconnectedError();

  const force = options?.force ?? false;

  const summary: SyncSummary = {
    scanned: 0,
    created: 0,
    updated: 0,
    skippedNotJobRelated: 0,
    alreadyProcessed: 0,
    failed: 0,
    resolvedByRegex: 0,
    resolvedByLlm: 0,
    skippedQuotaExhausted: 0,
    stoppedEarly: null,
  };

  // Force ignores the incremental cursor entirely, re-scanning the same
  // 3-week window a first-ever sync would use (see listCandidateMessageIds),
  // and re-processes messages already recorded in RawEmail below - useful
  // after a classifier/query change, to pick up mail the old logic missed or
  // misclassified.
  const messageIds = await listCandidateMessageIds(account.refreshToken, force ? null : account.lastSyncedAt);

  // Once every configured LLM provider's quota is exhausted, regex-resolvable
  // messages can still be processed for free - only messages that actually
  // need the LLM get skipped (and left unprocessed, so a later sync retries
  // them once quota resets, rather than wasting a doomed API call on each one
  // now).
  let llmExhausted = false;

  for (const gmailMessageId of messageIds) {
    summary.scanned++;

    const alreadySeen = await prisma.rawEmail.findUnique({
      where: { emailAccountId_gmailMessageId: { emailAccountId, gmailMessageId } },
    });
    if (alreadySeen && !force) {
      summary.alreadyProcessed++;
      continue;
    }

    try {
      const message = await fetchMessage(account.refreshToken, gmailMessageId);
      const regexResult = classifyWithRegex({ subject: message.subject });

      // A confident "not job-related" regex match (job alerts, connection
      // requests, etc.) is trusted outright - no LLM call is worth spending on
      // something we're already sure isn't an application. A confident
      // "is job-related" regex match is only a subject-based guess though, so
      // when quota allows it we still read the full body via the LLM for a
      // more accurate company/title/status than subject-only regex can give,
      // falling back to the regex extraction if quota runs out.
      let extraction: ExtractionResult;
      if (regexResult && !regexResult.isJobApplicationRelated) {
        extraction = regexResult;
        summary.resolvedByRegex++;
      } else if (llmExhausted) {
        if (regexResult) {
          extraction = regexResult;
          summary.resolvedByRegex++;
        } else {
          summary.skippedQuotaExhausted++;
          continue;
        }
      } else {
        try {
          extraction = await extractJobApplicationInfo({
            subject: message.subject,
            from: message.from,
            bodyText: message.bodyText,
          });
          summary.resolvedByLlm++;
        } catch (err) {
          if (err instanceof AllProvidersExhaustedError) {
            llmExhausted = true;
            summary.stoppedEarly = "quota_exceeded";
            if (regexResult) {
              extraction = regexResult;
              summary.resolvedByRegex++;
            } else {
              summary.skippedQuotaExhausted++;
              continue;
            }
          } else {
            throw err;
          }
        }
      }

      let matchedApplicationId: string | null = null;

      if (extraction.isJobApplicationRelated && extraction.confidence >= CONFIDENCE_THRESHOLD && extraction.companyName) {
        const existing = await findApplicationByCompany(userId, extraction.companyName);

        if (existing) {
          const updated = await updateApplication(
            userId,
            existing.id,
            extraction.status ? { status: extraction.status } : {},
            "EMAIL",
          );
          matchedApplicationId = updated!.id;
          summary.updated++;
        } else {
          const created = await createApplication(userId, {
            companyName: extraction.companyName,
            jobTitle: extraction.jobTitle ?? "Unknown role",
            status: extraction.status ?? "APPLIED",
            dateApplied: message.receivedAt ?? new Date(),
            source: "EMAIL",
            needsReview: true,
          });
          matchedApplicationId = created.id;
          summary.created++;
        }
      } else {
        summary.skippedNotJobRelated++;
      }

      await prisma.rawEmail.upsert({
        where: { emailAccountId_gmailMessageId: { emailAccountId, gmailMessageId } },
        create: {
          emailAccountId,
          gmailMessageId,
          subject: message.subject,
          fromAddress: message.from,
          receivedAt: message.receivedAt,
          processed: true,
          matchedApplicationId,
          extractionConfidence: extraction.confidence,
        },
        update: {
          subject: message.subject,
          fromAddress: message.from,
          receivedAt: message.receivedAt,
          processed: true,
          matchedApplicationId,
          extractionConfidence: extraction.confidence,
        },
      });
    } catch (err) {
      if (err instanceof GmailAuthExpiredError) throw err;
      console.error(`Failed to process Gmail message ${gmailMessageId}:`, err);
      summary.failed++;
    }
  }

  // Only advance the incremental-sync cursor when every candidate in this
  // run's window was actually resolved (written to RawEmail). Messages
  // skipped for quota, or that threw, are left unprocessed by design so a
  // later sync retries them - advancing lastSyncedAt past "now" here would
  // push them outside the next run's `after:` window and drop them for good.
  if (summary.skippedQuotaExhausted === 0 && summary.failed === 0) {
    await touchLastSynced(emailAccountId);
  }
  return summary;
}
