import type { InvokeParams, InvokeResult, Message, Tool } from "../llmTypes";
import type { LLMProvider, ResolvedLLMConfig } from "./types";
import {
  assertSupportedMessageContent,
  getErrorText,
  joinUrl,
  normalizeToolCalls,
  parseToolArguments,
  resolveInvocationOptions,
  safeParseJson,
  stringifyMessageContent,
  toTextOnlyString,
} from "./shared";

type GeminiContent = {
  role: "user" | "model";
  parts: Array<Record<string, unknown>>;
};

const buildToolNameIndex = (messages: Message[]) => {
  const index = new Map<string, string>();

  for (const message of messages) {
    if (!message.tool_calls) continue;
    for (const toolCall of message.tool_calls) {
      index.set(toolCall.id, toolCall.function.name);
    }
  }

  return index;
};

const toGeminiTools = (tools: Tool[]) => [
  {
    functionDeclarations: tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters ?? {
        type: "object",
        properties: {},
      },
    })),
  },
];

const toGeminiContents = (messages: Message[]): GeminiContent[] => {
  const toolNameIndex = buildToolNameIndex(messages);

  return messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      if (message.role === "tool" || message.role === "function") {
        const toolName =
          (message.tool_call_id && toolNameIndex.get(message.tool_call_id)) ||
          message.name ||
          "tool";
        const rawResponse = stringifyMessageContent(message.content);
        const parsedResponse = safeParseJson(rawResponse);

        return {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: toolName,
                response:
                  typeof parsedResponse === "object" && parsedResponse !== null
                    ? parsedResponse
                    : { content: rawResponse },
              },
            },
          ],
        };
      }

      const parts: Array<Record<string, unknown>> = [];
      const text = toTextOnlyString(message.content, "gemini");
      if (text.length > 0) {
        parts.push({ text });
      }

      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          parts.push({
            functionCall: {
              name: toolCall.function.name,
              args: parseToolArguments(toolCall.function.arguments),
            },
          });
        }
      }

      return {
        role: message.role === "assistant" ? "model" : "user",
        parts: parts.length > 0 ? parts : [{ text: "" }],
      };
    });
};

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini" as const;

  constructor(private readonly config: ResolvedLLMConfig) {}

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    assertSupportedMessageContent(this.name, params.messages);

    const { tools, toolChoice, responseFormat, maxTokens } =
      resolveInvocationOptions(params);

    const systemText = params.messages
      .filter((message) => message.role === "system")
      .map((message) => toTextOnlyString(message.content, this.name))
      .join("\n\n");

    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: maxTokens,
    };

    if (responseFormat?.type === "json_object") {
      generationConfig.responseMimeType = "application/json";
    }

    if (responseFormat?.type === "json_schema") {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = responseFormat.json_schema.schema;
    }

    const body: Record<string, unknown> = {
      contents: toGeminiContents(params.messages),
      generationConfig,
    };

    if (systemText.length > 0) {
      body.systemInstruction = {
        parts: [{ text: systemText }],
      };
    }

    if (tools && toolChoice !== "none") {
      body.tools = toGeminiTools(tools);
    }

    if (toolChoice) {
      if (toolChoice === "none") {
        body.toolConfig = {
          functionCallingConfig: {
            mode: "NONE",
          },
        };
      } else if (toolChoice === "auto") {
        body.toolConfig = {
          functionCallingConfig: {
            mode: "AUTO",
          },
        };
      } else {
        body.toolConfig = {
          functionCallingConfig: {
            mode: "ANY",
            allowedFunctionNames: [toolChoice.function.name],
          },
        };
      }
    }

    const response = await fetch(
      joinUrl(
        this.config.baseUrl,
        `v1beta/models/${this.config.model}:generateContent`
      ),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": this.config.apiKey ?? "",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      }
    );

    if (!response.ok) {
      const errorText = await getErrorText(response);
      throw new Error(
        `LLM invoke failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = (await response.json()) as any;
    const candidate = Array.isArray(data?.candidates) ? data.candidates[0] : undefined;
    const parts = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts
      : [];
    const textParts = parts.filter((part: any) => typeof part?.text === "string");
    const functionCalls = parts
      .filter((part: any) => part?.functionCall)
      .map((part: any, index: number) => ({
        id:
          typeof part.functionCall.id === "string" && part.functionCall.id.length > 0
            ? part.functionCall.id
            : `gemini_tool_call_${Date.now()}_${index}`,
        function: {
          name: String(part.functionCall.name ?? "tool"),
          arguments: JSON.stringify(part.functionCall.args ?? {}),
        },
      }));
    const toolCalls = normalizeToolCalls(functionCalls);
    const promptTokens = Number(data?.usageMetadata?.promptTokenCount ?? 0);
    const completionTokens = Number(
      data?.usageMetadata?.candidatesTokenCount ?? 0
    );

    return {
      id: `gemini_${Date.now()}`,
      created: Math.floor(Date.now() / 1000),
      model: this.config.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: textParts.map((part: any) => String(part.text)).join("\n\n"),
            ...(toolCalls ? { tool_calls: toolCalls } : {}),
          },
          finish_reason:
            typeof candidate?.finishReason === "string"
              ? candidate.finishReason.toLowerCase()
              : null,
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: Number(
          data?.usageMetadata?.totalTokenCount ?? promptTokens + completionTokens
        ),
      },
    };
  }
}
