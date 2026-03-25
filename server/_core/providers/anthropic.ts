import type { InvokeParams, InvokeResult, Message, Tool } from "../llmTypes";
import type { LLMProvider, ResolvedLLMConfig } from "./types";
import {
  assertSupportedMessageContent,
  buildJsonInstruction,
  getErrorText,
  joinUrl,
  normalizeToolCalls,
  parseToolArguments,
  resolveInvocationOptions,
  stringifyMessageContent,
  toTextOnlyString,
} from "./shared";

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
    };

type AnthropicMessage = {
  role: "user" | "assistant";
  content: AnthropicContentBlock[];
};

const toAnthropicTools = (tools: Tool[]) =>
  tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters ?? {
      type: "object",
      properties: {},
    },
  }));

const toAnthropicMessage = (message: Message): AnthropicMessage => {
  if (message.role === "tool" || message.role === "function") {
    if (!message.tool_call_id) {
      throw new Error(
        "Anthropic provider requires tool_call_id on tool/function messages"
      );
    }

    return {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: message.tool_call_id,
          content: stringifyMessageContent(message.content),
        },
      ],
    };
  }

  const blocks: AnthropicContentBlock[] = [];
  const text = toTextOnlyString(message.content, "anthropic");
  if (text.length > 0) {
    blocks.push({
      type: "text",
      text,
    });
  }

  if (message.tool_calls) {
    for (const toolCall of message.tool_calls) {
      blocks.push({
        type: "tool_use",
        id: toolCall.id,
        name: toolCall.function.name,
        input: parseToolArguments(toolCall.function.arguments),
      });
    }
  }

  return {
    role: message.role === "assistant" ? "assistant" : "user",
    content: blocks.length > 0 ? blocks : [{ type: "text", text: "" }],
  };
};

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic" as const;

  constructor(private readonly config: ResolvedLLMConfig) {}

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    assertSupportedMessageContent(this.name, params.messages);

    const { tools, toolChoice, responseFormat, maxTokens } =
      resolveInvocationOptions(params);

    const systemMessages = params.messages
      .filter((message) => message.role === "system")
      .map((message) => toTextOnlyString(message.content, this.name));

    const jsonInstruction = buildJsonInstruction(responseFormat);
    if (jsonInstruction) {
      systemMessages.push(jsonInstruction);
    }

    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: maxTokens,
      messages: params.messages
        .filter((message) => message.role !== "system")
        .map(toAnthropicMessage),
    };

    if (systemMessages.length > 0) {
      body.system = systemMessages.join("\n\n");
    }

    if (tools && toolChoice !== "none") {
      body.tools = toAnthropicTools(tools);
    }

    if (toolChoice) {
      if (toolChoice === "auto") {
        body.tool_choice = { type: "auto" };
      } else if (toolChoice === "none") {
        body.tool_choice = { type: "auto" };
        delete body.tools;
      } else {
        body.tool_choice = {
          type: "tool",
          name: toolChoice.function.name,
        };
      }
    }

    const response = await fetch(joinUrl(this.config.baseUrl, "v1/messages"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.config.apiKey ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!response.ok) {
      const errorText = await getErrorText(response);
      throw new Error(
        `LLM invoke failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = (await response.json()) as any;
    const textBlocks = Array.isArray(data.content)
      ? data.content.filter((block: any) => block?.type === "text")
      : [];
    const toolBlocks = Array.isArray(data.content)
      ? data.content.filter((block: any) => block?.type === "tool_use")
      : [];
    const toolCalls = normalizeToolCalls(
      toolBlocks.map((block: any) => ({
        id: block.id,
        function: {
          name: block.name,
          arguments: block.input,
        },
      }))
    );
    const promptTokens = Number(data?.usage?.input_tokens ?? 0);
    const completionTokens = Number(data?.usage?.output_tokens ?? 0);

    return {
      id:
        typeof data?.id === "string" && data.id.length > 0
          ? data.id
          : `anthropic_${Date.now()}`,
      created: Math.floor(Date.now() / 1000),
      model:
        typeof data?.model === "string" && data.model.length > 0
          ? data.model
          : this.config.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: textBlocks.map((block: any) => String(block.text ?? "")).join("\n\n"),
            ...(toolCalls ? { tool_calls: toolCalls } : {}),
          },
          finish_reason:
            data?.stop_reason === "tool_use"
              ? "tool_calls"
              : typeof data?.stop_reason === "string"
                ? data.stop_reason
                : null,
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    };
  }
}
