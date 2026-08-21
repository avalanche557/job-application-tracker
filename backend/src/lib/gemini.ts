import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isJobApplicationRelated: { type: Type.BOOLEAN },
    companyName: { type: Type.STRING, nullable: true },
    jobTitle: { type: Type.STRING, nullable: true },
    status: {
      type: Type.STRING,
      enum: ["APPLIED", "INTERVIEWING", "OFFER", "REJECTED"],
      nullable: true,
    },
    confidence: { type: Type.NUMBER },
  },
  required: ["isJobApplicationRelated", "confidence"],
};

const SYSTEM_INSTRUCTION = `You classify emails for a job application tracker. Given an email's subject, sender, and body, determine:
1. Whether it relates to a specific job application the recipient submitted (application confirmations, interview invites/scheduling, offers, rejections). Job alerts, newsletters, marketing, and generic recruiter cold-outreach are NOT application-related.
2. If related: the company name, the job title applied for, and the application status implied by this specific email (APPLIED for a submission confirmation, INTERVIEWING for interview scheduling/invites, OFFER for an offer, REJECTED for a rejection/decline).
3. A confidence score 0-1 for your extraction.

If any field can't be determined, use null for that field. Be conservative - if the email is ambiguous or not clearly about one specific application, set isJobApplicationRelated to false.`;

export type ExtractionResult = {
  isJobApplicationRelated: boolean;
  companyName: string | null;
  jobTitle: string | null;
  status: "APPLIED" | "INTERVIEWING" | "OFFER" | "REJECTED" | null;
  confidence: number;
};

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([429, 503]);

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Gemini request timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function isRetryableStatus(err: unknown): boolean {
  return typeof err === "object" && err !== null && "status" in err && RETRYABLE_STATUSES.has((err as { status: number }).status);
}

// By the time this reaches a caller, extractJobApplicationInfo has already
// retried transient 429s a couple of times internally - a 429 that still
// surfaces means the quota is genuinely exhausted, not a passing blip.
export function isQuotaExceededError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "status" in err && (err as { status: number }).status === 429;
}

export async function extractJobApplicationInfo(email: {
  subject: string | null;
  from: string | null;
  bodyText: string;
}): Promise<ExtractionResult> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: MODEL,
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Subject: ${email.subject ?? "(none)"}\nFrom: ${email.from ?? "(unknown)"}\n\nBody:\n${email.bodyText}`,
                },
              ],
            },
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: EXTRACTION_SCHEMA,
          },
        }),
        REQUEST_TIMEOUT_MS,
      );

      const text = response.text;
      if (!text) throw new Error("Gemini returned an empty response");

      return JSON.parse(text) as ExtractionResult;
    } catch (err) {
      lastError = err;
      const retryable = isRetryableStatus(err) || (err instanceof Error && err.message.includes("timed out"));
      if (!retryable || attempt === MAX_ATTEMPTS) break;

      const backoffMs = 1000 * 2 ** (attempt - 1); // 1s, 2s
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }

  throw lastError;
}
