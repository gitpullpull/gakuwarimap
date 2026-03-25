import type { InvokeParams, InvokeResult } from "../llmTypes";

export type LLMProviderName = "openai" | "anthropic" | "gemini" | "ollama";

export type ResolvedLLMConfig = {
  provider: LLMProviderName;
  model: string;
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
};

export interface LLMProvider {
  readonly name: LLMProviderName;
  invoke(params: InvokeParams): Promise<InvokeResult>;
}
