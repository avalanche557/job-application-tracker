import { GoogleGenAI, Type } from "@google/genai";
import type { EmailInput, ExtractionResult, LLMProvider } from "../types.js";
import { QuotaExceededError } from "../types.js";
import { SYSTEM_INSTRUCTION, buildUserMessage } from "../prompt.js";
import { isQuotaStatus, withRetry } from "../retry.js";
import { logEstimatedUsage } from "../rateLimitLog.js";

// Gemini's free tier caps generateContent at 20 requests/day per model and
// exposes no remaining-quota header - this is just what the 429 error text
// reports, used only for the estimated-usage log line below.
const FREE_TIER_DAILY_CAP = 20;

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

export function createGeminiProvider(): LLMProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  return {
    name: "gemini",
    configured: Boolean(apiKey),

    async extract(email: EmailInput): Promise<ExtractionResult> {
      if (!ai) throw new Error("Gemini provider is not configured");

      try {
        return await withRetry("gemini", async () => {
          logEstimatedUsage("gemini", FREE_TIER_DAILY_CAP);
          const response = await ai.models.generateContent({
            model: MODEL,
            contents: [{ role: "user", parts: [{ text: buildUserMessage(email) }] }],
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: "application/json",
              responseSchema: EXTRACTION_SCHEMA,
            },
          });

          const text = response.text;
          if (!text) throw new Error("Gemini returned an empty response");

          return JSON.parse(text) as ExtractionResult;
        });
      } catch (err) {
        if (isQuotaStatus(err)) throw new QuotaExceededError("gemini");
        throw err;
      }
    },
  };
}
