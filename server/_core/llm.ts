import { createLLMProvider } from "./providers";
import type { InvokeParams, InvokeResult } from "./llmTypes";

export * from "./llmTypes";

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  return createLLMProvider().invoke(params);
}
