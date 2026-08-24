export type ExtractionResult = {
  isJobApplicationRelated: boolean;
  companyName: string | null;
  jobTitle: string | null;
  status: "APPLIED" | "INTERVIEWING" | "OFFER" | "REJECTED" | null;
  confidence: number;
};

export type EmailInput = {
  subject: string | null;
  from: string | null;
  bodyText: string;
};

// Thrown by a provider once its free-tier quota is genuinely exhausted (not a
// transient blip - each provider retries transient 429/503s internally
// before surfacing this). The router catches it to move on to the next
// provider instead of failing the whole extraction.
export class QuotaExceededError extends Error {
  constructor(providerName: string) {
    super(`${providerName} quota exceeded`);
    this.name = "QuotaExceededError";
  }
}

export interface LLMProvider {
  name: string;
  // False when the provider's API key env var isn't set - the router skips
  // unconfigured providers entirely rather than trying and failing them.
  configured: boolean;
  extract(email: EmailInput): Promise<ExtractionResult>;
}
