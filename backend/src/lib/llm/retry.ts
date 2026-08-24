const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([429, 503]);

function withTimeout<T>(promise: Promise<T>, ms: number, providerName: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${providerName} request timed out after ${ms}ms`)), ms);
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

export function isRetryableStatus(err: unknown): boolean {
  return typeof err === "object" && err !== null && "status" in err && RETRYABLE_STATUSES.has((err as { status: number }).status);
}

export function isQuotaStatus(err: unknown): boolean {
  return typeof err === "object" && err !== null && "status" in err && (err as { status: number }).status === 429;
}

// Retries transient errors (429/503/timeout) with exponential backoff before
// giving up - by the time an error escapes this, it's either a genuine quota
// exhaustion or a non-retryable failure, and the caller (a provider's
// extract()) decides which.
export async function withRetry<T>(providerName: string, attempt: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    try {
      return await withTimeout(attempt(), REQUEST_TIMEOUT_MS, providerName);
    } catch (err) {
      lastError = err;
      const retryable = isRetryableStatus(err) || (err instanceof Error && err.message.includes("timed out"));
      if (!retryable || i === MAX_ATTEMPTS) break;

      const backoffMs = 1000 * 2 ** (i - 1); // 1s, 2s
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }

  throw lastError;
}
