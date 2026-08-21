import type { ExtractionResult } from "./gemini.js";

// Confident regex-based classification, tried before spending an LLM call.
// Returns null when the email doesn't clearly match a known pattern - the
// caller should fall back to Gemini for anything ambiguous. Deliberately
// conservative: only APPLIED submission confirmations are extracted this way
// (status changes like interviews/offers/rejections are too inconsistently
// worded across companies to regex reliably), and the same restraint applies
// negative-side - only unambiguous non-application patterns are excluded.

// Subject lines from ATS confirmation emails (Greenhouse, Lever, Workday,
// generic "thank you for applying" senders) are consistent enough that the
// company name can be pulled out directly with high confidence.
const APPLICATION_SUBMITTED_PATTERNS: RegExp[] = [
  /^application (?:to|for) (.+?) (?:has been |was )?successfully submitted$/i,
  /^thank you for applying to (.+?)[!.\s]*$/i,
  /^we(?:'ve| have) received your application (?:for|to) (.+?)$/i,
  /^your application to (.+?) (?:has been |was )?(?:received|submitted)/i,
];

// Subject lines that are clearly not about a specific application the user
// submitted - job board digests, alerts, and social/networking noise.
const NOT_APPLICATION_PATTERNS: RegExp[] = [
  /^new jobs? (?:similar to|matching|for you|recommended)/i,
  /jobs? (?:you may be|you might be|recommended for you)/i,
  /\bwants? to connect\b/i,
  /\binvit(?:e|ation) to connect\b/i,
  /job alert|jobs digest|weekly digest/i,
  /people you may know/i,
];

function cleanCompanyName(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/[.!?\s]+$/, "")
    .trim();
}

// The "applying to X" style templates assume X is a bare company name, but
// some ATSes put a job title or requisition string there instead (e.g.
// "Thank you for applying to Rippling - Senior Software Engineer" or
// "...to [Upcoming Roles] Developer Senior Specialist"). Those aren't
// distinguishable from a real company name by the regex itself, so instead
// this rejects anything that doesn't *look* like a bare company name -
// dashes, brackets, parens, or excessive length all suggest a job title
// leaked in. Rejected matches fall through to the LLM instead of writing bad
// data.
function isPlausibleCompanyName(name: string): boolean {
  if (name.length === 0 || name.length > 40) return false;
  if (/[[\](){}]/.test(name)) return false;
  if (/ [-–] /.test(name)) return false;
  return true;
}

export function classifyWithRegex(email: { subject: string | null }): ExtractionResult | null {
  const subject = email.subject?.trim();
  if (!subject) return null;

  for (const pattern of NOT_APPLICATION_PATTERNS) {
    if (pattern.test(subject)) {
      return { isJobApplicationRelated: false, companyName: null, jobTitle: null, status: null, confidence: 0.9 };
    }
  }

  for (const pattern of APPLICATION_SUBMITTED_PATTERNS) {
    const match = subject.match(pattern);
    if (match?.[1]) {
      const companyName = cleanCompanyName(match[1]);
      if (!isPlausibleCompanyName(companyName)) return null;

      return {
        isJobApplicationRelated: true,
        companyName,
        jobTitle: null,
        status: "APPLIED",
        confidence: 0.9,
      };
    }
  }

  return null;
}
