import type { EmailInput, ExtractionResult, LLMProvider } from "./types.js";
import { QuotaExceededError } from "./types.js";
import { buildProviders } from "./providers/index.js";

// How long a provider sits out after reporting quota exhaustion. Free tiers
// mostly reset daily, but we don't know each provider's exact reset time, so
// this is a conservative "try again later in this same process" cooldown
// rather than an attempt to model real reset windows.
const COOLDOWN_MS = 6 * 60 * 60 * 1000;

type ProviderState = {
  provider: LLMProvider;
  lastUsedAt: number;
  exhaustedUntil: number;
};

export class AllProvidersExhaustedError extends Error {
  constructor() {
    super("All configured LLM providers are rate-limited or exhausted");
    this.name = "AllProvidersExhaustedError";
  }
}

const states: ProviderState[] = buildProviders().map((provider) => ({
  provider,
  lastUsedAt: 0,
  exhaustedUntil: 0,
}));

function availableStates(now: number): ProviderState[] {
  return states
    .filter((s) => s.provider.configured && s.exhaustedUntil <= now)
    .sort((a, b) => a.lastUsedAt - b.lastUsedAt);
}

export function hasConfiguredProvider(): boolean {
  return states.some((s) => s.provider.configured);
}

// Tries providers least-recently-used first, skipping any still in cooldown.
// Any failure - quota exhaustion, a misconfigured model, a billing issue on
// that provider's account, a malformed response - moves on to the next
// provider rather than failing the whole extraction, since with multiple
// providers configured a single one being broken shouldn't cost a message.
// Only once every provider has failed does this throw, so the caller can
// still fall back to regex-only classification.
export async function extractJobApplicationInfo(email: EmailInput): Promise<ExtractionResult> {
  const now = Date.now();
  const candidates = availableStates(now);
  if (candidates.length === 0) throw new AllProvidersExhaustedError();

  for (const state of candidates) {
    try {
      const result = await state.provider.extract(email);
      state.lastUsedAt = Date.now();
      return result;
    } catch (err) {
      console.error(`[llm] ${state.provider.name} failed, trying next provider:`, err instanceof Error ? err.message : err);
      state.exhaustedUntil = Date.now() + (err instanceof QuotaExceededError ? COOLDOWN_MS : COOLDOWN_MS / 6);
    }
  }

  throw new AllProvidersExhaustedError();
}
