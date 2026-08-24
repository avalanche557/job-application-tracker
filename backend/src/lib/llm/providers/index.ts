import { createGeminiProvider } from "./gemini.js";
import { createOpenAICompatibleProvider } from "./openaiCompatible.js";
import type { LLMProvider } from "../types.js";

// Order here is just the initial LRU seed order - the router picks whichever
// configured provider was used least recently and isn't in cooldown, so this
// list order stops mattering after the first extraction of each process.
export function buildProviders(): LLMProvider[] {
  return [
    createGeminiProvider(),
    createOpenAICompatibleProvider({
      name: "groq",
      baseURL: "https://api.groq.com/openai/v1",
      apiKeyEnvVar: "GROQ_API_KEY",
      modelEnvVar: "GROQ_MODEL",
      defaultModel: "openai/gpt-oss-120b",
    }),
    createOpenAICompatibleProvider({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKeyEnvVar: "OPENROUTER_API_KEY",
      modelEnvVar: "OPENROUTER_MODEL",
      defaultModel: "nvidia/nemotron-3-super-120b-a12b:free",
    }),
    createOpenAICompatibleProvider({
      name: "cerebras",
      baseURL: "https://api.cerebras.ai/v1",
      apiKeyEnvVar: "CEREBRAS_API_KEY",
      modelEnvVar: "CEREBRAS_MODEL",
      defaultModel: "gpt-oss-120b",
    }),
    createOpenAICompatibleProvider({
      name: "mistral",
      baseURL: "https://api.mistral.ai/v1",
      apiKeyEnvVar: "MISTRAL_API_KEY",
      modelEnvVar: "MISTRAL_MODEL",
      defaultModel: "mistral-small-latest",
    }),
  ];
}
