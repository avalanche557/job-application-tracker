// Shared across all providers so classification behavior doesn't drift
// between Gemini (which uses its own typed schema) and the OpenAI-compatible
// providers (which rely on this text description plus JSON-object mode).
export const SYSTEM_INSTRUCTION = `You classify emails for a job application tracker. Given an email's subject, sender, and body, determine:
1. Whether it relates to a specific job application the recipient submitted (application confirmations, interview invites/scheduling, offers, rejections). Job alerts, newsletters, marketing, and generic recruiter cold-outreach are NOT application-related.
2. If related: the company name, the job title applied for, and the application status implied by this specific email (APPLIED for a submission confirmation, INTERVIEWING for interview scheduling/invites, OFFER for an offer, REJECTED for a rejection/decline).
3. A confidence score 0-1 for your extraction.

If any field can't be determined, use null for that field. Be conservative - if the email is ambiguous or not clearly about one specific application, set isJobApplicationRelated to false.`;

// Appended for providers that only support generic JSON-object mode (no
// enforced schema like Gemini's responseSchema) so the model still returns
// the exact shape the router expects.
export const JSON_SHAPE_INSTRUCTION = `Respond with ONLY a JSON object matching exactly this shape, no other text:
{
  "isJobApplicationRelated": boolean,
  "companyName": string | null,
  "jobTitle": string | null,
  "status": "APPLIED" | "INTERVIEWING" | "OFFER" | "REJECTED" | null,
  "confidence": number
}`;

export function buildUserMessage(email: { subject: string | null; from: string | null; bodyText: string }): string {
  return `Subject: ${email.subject ?? "(none)"}\nFrom: ${email.from ?? "(unknown)"}\n\nBody:\n${email.bodyText}`;
}
