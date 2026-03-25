import type { InvokeParams, InvokeResult } from "../llmTypes";
import type { LLMProvider, ResolvedLLMConfig } from "./types";
import {
  assertSupportedMessageContent,
  getErrorText,
  joinUrl,
  normalizeMessageForOpenAI,
  normalizeOpenAICompatibleResponse,
  resolveInvocationOptions,
} from "./shared";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai" as const;

  constructor(private readonly config: ResolvedLLMConfig) {}

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    assertSupportedMessageContent(this.name, params.messages, {
      allowImageUrl: true,
      allowFileUrl: true,
    });

    const { tools, toolChoice, responseFormat, maxTokens } =
      resolveInvocationOptions(params);

    const payload: Record<string, unknown> = {
      model: this.config.model,
      messages: params.messages.map(normalizeMessageForOpenAI),
      max_tokens: maxTokens,
    };

    if (tools && toolChoice !== "none") {
      payload.tools = tools;
    }

    if (toolChoice) {
      payload.tool_choice = toolChoice;
    }

    if (responseFormat) {
      payload.response_format = responseFormat;
    }

    const response = await fetch(joinUrl(this.config.baseUrl, "v1/chat/completions"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!response.ok) {
      const errorText = await getErrorText(response);
      throw new Error(
        `LLM invoke failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return normalizeOpenAICompatibleResponse(
      await response.json(),
      this.config.model
    );
  }
}
