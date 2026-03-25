import type {
  FileContent,
  ImageContent,
  InvokeParams,
  InvokeResult,
  JsonSchema,
  Message,
  MessageContent,
  OutputSchema,
  ResponseFormat,
  TextContent,
  Tool,
  ToolCall,
  ToolChoice,
  ToolChoiceExplicit,
} from "../llmTypes";

export const DEFAULT_MAX_TOKENS = 32_768;

export const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

export const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (
    part.type === "text" ||
    part.type === "image_url" ||
    part.type === "file_url"
  ) {
    return part;
  }

  throw new Error("Unsupported message content part");
};

export const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

export const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }

    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

export const resolveInvocationOptions = (params: InvokeParams) => {
  const tools = params.tools;
  const toolChoice = normalizeToolChoice(
    params.toolChoice || params.tool_choice,
    tools
  );
  const responseFormat = normalizeResponseFormat({
    responseFormat: params.responseFormat,
    response_format: params.response_format,
    outputSchema: params.outputSchema,
    output_schema: params.output_schema,
  });
  const maxTokens = params.maxTokens ?? params.max_tokens ?? DEFAULT_MAX_TOKENS;

  return {
    tools,
    toolChoice,
    responseFormat,
    maxTokens,
  };
};

export const stringifyMessageContent = (
  content:
    | Message["content"]
    | InvokeResult["choices"][number]["message"]["content"]
): string => {
  const parts = Array.isArray(content) ? content : [content];

  return parts
    .map((part) => {
      if (typeof part === "string") return part;
      if (part.type === "text") return part.text;
      return JSON.stringify(part);
    })
    .join("\n");
};

export const assertSupportedMessageContent = (
  providerName: string,
  messages: Message[],
  options: {
    allowImageUrl?: boolean;
    allowFileUrl?: boolean;
  } = {}
) => {
  for (const message of messages) {
    for (const part of ensureArray(message.content)) {
      const normalized = normalizeContentPart(part);

      if (normalized.type === "image_url" && !options.allowImageUrl) {
        throw new Error(
          `${providerName} does not support image_url content in v1`
        );
      }

      if (normalized.type === "file_url" && !options.allowFileUrl) {
        throw new Error(
          `${providerName} does not support file_url content in v1`
        );
      }
    }
  }
};

export const toTextOnlyString = (
  content: Message["content"],
  providerName: string
): string => {
  return ensureArray(content)
    .map((part) => {
      const normalized = normalizeContentPart(part);
      if (normalized.type !== "text") {
        throw new Error(
          `${providerName} only supports text content for this operation`
        );
      }

      return normalized.text;
    })
    .join("\n");
};

export const safeParseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const parseToolArguments = (
  argumentsValue: string
): Record<string, unknown> => {
  const parsed = safeParseJson(argumentsValue);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  return { value: parsed };
};

export const normalizeToolCalls = (toolCalls: unknown): ToolCall[] | undefined => {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return undefined;
  }

  return toolCalls.map((toolCall, index) => {
    const raw = (toolCall ?? {}) as Record<string, any>;
    const rawFunction = (raw.function ?? {}) as Record<string, any>;
    const rawArguments = rawFunction.arguments;

    return {
      id:
        typeof raw.id === "string" && raw.id.length > 0
          ? raw.id
          : `tool_call_${Date.now()}_${index}`,
      type: "function",
      function: {
        name:
          typeof rawFunction.name === "string" && rawFunction.name.length > 0
            ? rawFunction.name
            : "tool",
        arguments:
          typeof rawArguments === "string"
            ? rawArguments
            : JSON.stringify(rawArguments ?? {}),
      },
    };
  });
};

export const normalizeOpenAICompatibleResponse = (
  data: any,
  fallbackModel: string
): InvokeResult => {
  const choices = Array.isArray(data?.choices) ? data.choices : [];

  return {
    id:
      typeof data?.id === "string" && data.id.length > 0
        ? data.id
        : `chatcmpl_${Date.now()}`,
    created:
      typeof data?.created === "number"
        ? data.created
        : Math.floor(Date.now() / 1000),
    model:
      typeof data?.model === "string" && data.model.length > 0
        ? data.model
        : fallbackModel,
    choices: choices.map((choice: any, index: number) => {
      const message = choice?.message ?? {};
      const content =
        message.content == null
          ? ""
          : (message.content as InvokeResult["choices"][number]["message"]["content"]);
      const toolCalls = normalizeToolCalls(message.tool_calls);

      return {
        index: typeof choice?.index === "number" ? choice.index : index,
        message: {
          role: message.role ?? "assistant",
          content,
          ...(toolCalls ? { tool_calls: toolCalls } : {}),
        },
        finish_reason:
          typeof choice?.finish_reason === "string" || choice?.finish_reason === null
            ? choice.finish_reason
            : null,
      };
    }),
    ...(data?.usage
      ? {
          usage: {
            prompt_tokens: Number(data.usage.prompt_tokens ?? 0),
            completion_tokens: Number(data.usage.completion_tokens ?? 0),
            total_tokens: Number(
              data.usage.total_tokens ??
                Number(data.usage.prompt_tokens ?? 0) +
                  Number(data.usage.completion_tokens ?? 0)
            ),
          },
        }
      : {}),
  };
};

export const normalizeMessageForOpenAI = (message: Message) => {
  const { role, name, tool_call_id, tool_calls } = message;

  if (role === "tool" || role === "function") {
    return {
      role,
      name,
      tool_call_id,
      content: stringifyMessageContent(message.content),
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  const base: Record<string, unknown> = {
    role,
    name,
    content:
      contentParts.length === 1 && contentParts[0].type === "text"
        ? contentParts[0].text
        : contentParts,
  };

  if (tool_calls && tool_calls.length > 0) {
    base.tool_calls = tool_calls;
  }

  return base;
};

export const joinUrl = (baseUrl: string, path: string): string => {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");

  if (normalizedBase.endsWith(normalizedPath)) {
    return normalizedBase;
  }

  return `${normalizedBase}/${normalizedPath}`;
};

export const getErrorText = async (response: Response): Promise<string> => {
  return response.text().catch(() => response.statusText);
};

export const buildJsonInstruction = (
  responseFormat:
    | { type: "json_schema"; json_schema: JsonSchema }
    | { type: "text" }
    | { type: "json_object" }
    | undefined
): string | null => {
  if (!responseFormat || responseFormat.type === "text") {
    return null;
  }

  if (responseFormat.type === "json_object") {
    return "Return valid JSON only. Do not wrap the JSON in markdown.";
  }

  return [
    "Return valid JSON only. Do not wrap the JSON in markdown.",
    `The JSON must match this schema named "${responseFormat.json_schema.name}":`,
    JSON.stringify(responseFormat.json_schema.schema),
  ].join("\n");
};
