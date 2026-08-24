import type { EmailInput, ExtractionResult, LLMProvider } from "../types.js";
import { QuotaExceededError } from "../types.js";
import { SYSTEM_INSTRUCTION, JSON_SHAPE_INSTRUCTION, buildUserMessage } from "../prompt.js";
import { isQuotaStatus, withRetry } from "../retry.js";
import { logRateLimitFromHeaders } from "../rateLimitLog.js";

type HttpError = Error & { status: number };

function httpError(status: number, message: string): HttpError {
  const err = new Error(message) as HttpError;
  err.status = status;
  return err;
}

// Factory for any provider exposing an OpenAI-compatible /chat/completions
// endpoint with JSON-object response mode (Groq, OpenRouter, Cerebras,
// Mistral all qualify) - avoids pulling in a per-provider SDK for what's a
// handful of fields on a plain fetch call.
export function createOpenAICompatibleProvider(opts: {
  name: string;
  baseURL: string;
  apiKeyEnvVar: string;
  modelEnvVar: string;
  defaultModel: string;
  extraHeaders?: Record<string, string>;
}): LLMProvider {
  const apiKey = process.env[opts.apiKeyEnvVar];
  const model = process.env[opts.modelEnvVar] ?? opts.defaultModel;

  return {
    name: opts.name,
    configured: Boolean(apiKey),

    async extract(email: EmailInput): Promise<ExtractionResult> {
      if (!apiKey) throw new Error(`${opts.name} provider is not configured`);

      try {
        return await withRetry(opts.name, async () => {
          const res = await fetch(`${opts.baseURL}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              ...opts.extraHeaders,
            },
            body: JSON.stringify({
              model,
              temperature: 0,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: `${SYSTEM_INSTRUCTION}\n\n${JSON_SHAPE_INSTRUCTION}` },
                { role: "user", content: buildUserMessage(email) },
              ],
            }),
          });

          logRateLimitFromHeaders(opts.name, res.headers);

          if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw httpError(res.status, `${opts.name} request failed (${res.status}): ${body.slice(0, 300)}`);
          }

          const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const content = data.choices?.[0]?.message?.content;
          if (!content) throw new Error(`${opts.name} returned an empty response`);

          return JSON.parse(content) as ExtractionResult;
        });
      } catch (err) {
        if (isQuotaStatus(err)) throw new QuotaExceededError(opts.name);
        throw err;
      }
    },
  };
}
