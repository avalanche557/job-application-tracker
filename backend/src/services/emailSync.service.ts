import { prisma } from "../lib/prisma.js";
import { listCandidateMessageIds, fetchMessage } from "../lib/gmailClient.js";
import { extractJobApplicationInfo, isQuotaExceededError, type ExtractionResult } from "../lib/gemini.js";
import { classifyWithRegex } from "../lib/emailClassifier.js";
import {
  createApplication,
  updateApplication,
  findApplicationByCompany,
} from "./jobApplication.service.js";
import { getEmailAccountWithDecryptedToken, touchLastSynced } from "./emailAccount.service.js";

const CONFIDENCE_THRESHOLD = 0.5;

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

export async function syncEmailAccount(userId: string, emailAccountId: string): Promise<SyncSummary> {
  const account = await getEmailAccountWithDecryptedToken(userId, emailAccountId);
  if (!account) throw new Error("Email account not found");

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

  const messageIds = await listCandidateMessageIds(account.refreshToken, account.lastSyncedAt);

  // Once Gemini's quota is exhausted, regex-resolvable messages can still be
  // processed for free - only messages that actually need the LLM get
  // skipped (and left unprocessed, so a later sync retries them once quota
  // resets, rather than wasting a doomed API call on each one now).
  let geminiQuotaExhausted = false;

  for (const gmailMessageId of messageIds) {
    summary.scanned++;

    const alreadySeen = await prisma.rawEmail.findUnique({
      where: { emailAccountId_gmailMessageId: { emailAccountId, gmailMessageId } },
    });
    if (alreadySeen) {
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
      } else if (geminiQuotaExhausted) {
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
          if (isQuotaExceededError(err)) {
            geminiQuotaExhausted = true;
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

      await prisma.rawEmail.create({
        data: {
          emailAccountId,
          gmailMessageId,
          subject: message.subject,
          fromAddress: message.from,
          receivedAt: message.receivedAt,
          processed: true,
          matchedApplicationId,
          extractionConfidence: extraction.confidence,
        },
      });
    } catch (err) {
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
