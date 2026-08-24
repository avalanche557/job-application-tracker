// Every OpenAI-compatible provider we use reports remaining quota via
// response headers, but each names them differently - this checks all known
// naming schemes and logs whichever are present. Providers with no headers
// at all (Cerebras) simply log nothing here.
const HEADER_PATTERNS: { label: string; remaining: string; limit?: string; reset?: string }[] = [
  { label: "requests", remaining: "x-ratelimit-remaining-requests", limit: "x-ratelimit-limit-requests", reset: "x-ratelimit-reset-requests" },
  { label: "tokens", remaining: "x-ratelimit-remaining-tokens", limit: "x-ratelimit-limit-tokens", reset: "x-ratelimit-reset-tokens" },
  { label: "requests", remaining: "x-ratelimit-remaining", limit: "x-ratelimit-limit", reset: "x-ratelimit-reset" },
  { label: "requests/min", remaining: "x-ratelimit-remaining-req-minute", limit: "x-ratelimit-limit-req-minute" },
  { label: "tokens/min", remaining: "x-ratelimit-remaining-tokens-minute", limit: "x-ratelimit-limit-tokens-minute" },
];

function formatReset(raw: string): string {
  // Some providers (OpenRouter) send an epoch-ms timestamp; others (Groq)
  // send an already-human duration like "21m36s" - pass the latter through.
  const asNumber = Number(raw);
  if (!Number.isFinite(asNumber) || asNumber < 1e12) return raw;
  const msUntil = asNumber - Date.now();
  if (msUntil <= 0) return "now";
  const minutes = Math.round(msUntil / 60_000);
  return minutes < 60 ? `${minutes}m` : `${Math.round(minutes / 60)}h`;
}

export function logRateLimitFromHeaders(providerName: string, headers: Headers): void {
  const lines: string[] = [];

  for (const { label, remaining, limit, reset } of HEADER_PATTERNS) {
    const remainingValue = headers.get(remaining);
    if (remainingValue === null) continue;

    const limitValue = limit ? headers.get(limit) : null;
    const resetValue = reset ? headers.get(reset) : null;

    let line = `${remainingValue}${limitValue ? `/${limitValue}` : ""} ${label}`;
    if (resetValue) line += ` (resets in ${formatReset(resetValue)})`;
    lines.push(line);
  }

  if (lines.length > 0) {
    console.log(`[llm] ${providerName} quota remaining: ${lines.join(", ")}`);
  }
}

// Gemini's API doesn't expose a remaining-quota header at all - the only
// signal is the 429 error text once the (fixed, undocumented-per-response)
// daily cap is hit. Best we can do proactively is count calls this process
// has made and remind what the free-tier daily cap is.
const callCounts = new Map<string, number>();

export function logEstimatedUsage(providerName: string, dailyFreeTierCap: number): void {
  const count = (callCounts.get(providerName) ?? 0) + 1;
  callCounts.set(providerName, count);
  console.log(`[llm] ${providerName}: ${count} call(s) this run (free tier cap is ~${dailyFreeTierCap}/day - resets are not visible via API, this count resets on restart)`);
}
