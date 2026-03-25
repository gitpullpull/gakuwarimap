import { afterEach, describe, expect, it, vi } from "vitest";
import { createLLMProvider, resolveLLMConfig } from "./index";
import type { InvokeParams } from "../llmTypes";

const originalEnv = { ...process.env };

const createJsonResponse = (body: unknown, status: number = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });

const baseParams: InvokeParams = {
  messages: [
    { role: "system", content: "You are helpful." },
    { role: "user", content: "Hello" },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "lookup_weather",
        description: "Look up weather",
        parameters: {
          type: "object",
          properties: {
            city: { type: "string" },
          },
          required: ["city"],
        },
      },
    },
  ],
  tool_choice: { name: "lookup_weather" },
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "weather_response",
      schema: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
        },
        required: ["ok"],
      },
    },
  },
};

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("resolveLLMConfig", () => {
  it("defaults to ollama to preserve the existing agent path", () => {
    process.env = {};

    const config = resolveLLMConfig(process.env);

    expect(config.provider).toBe("ollama");
    expect(config.baseUrl).toBe("https://ollama.gitpullpull.me");
    expect(config.model).toBe("qwen3.5:27b");
  });

  it("throws when an API-key based provider is missing credentials", () => {
    process.env = {
      LLM_PROVIDER: "openai",
    };

    expect(() => resolveLLMConfig(process.env)).toThrow(/Missing API key/);
  });

  it("creates the provider requested by env", () => {
    process.env = {
      LLM_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "test-key",
    };

    const provider = createLLMProvider(process.env);

    expect(provider.name).toBe("anthropic");
  });
});

describe("providers", () => {
  it("normalizes OpenAI-compatible responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        id: "chatcmpl_123",
        created: 123,
        model: "gpt-4o-mini",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "tool_1",
                  type: "function",
                  function: {
                    name: "lookup_weather",
                    arguments: '{"city":"Tokyo"}',
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    process.env = {
      LLM_PROVIDER: "openai",
      OPENAI_API_KEY: "test-key",
    };

    const result = await createLLMProvider(process.env).invoke(baseParams);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(init.body));

    expect(requestBody.tool_choice).toEqual({
      type: "function",
      function: { name: "lookup_weather" },
    });
    expect(requestBody.response_format.type).toBe("json_schema");
    expect(result.choices[0]?.message.content).toBe("");
    expect(result.choices[0]?.message.tool_calls?.[0]?.function.arguments).toBe(
      '{"city":"Tokyo"}'
    );
  });

  it("normalizes Ollama tool call responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        model: "qwen3.5:27b",
        message: {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              function: {
                name: "lookup_weather",
                arguments: {
                  city: "Tokyo",
                },
              },
            },
          ],
        },
        done: true,
        done_reason: "tool_calls",
        prompt_eval_count: 11,
        eval_count: 7,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    process.env = {
      LLM_PROVIDER: "ollama",
    };

    const result = await createLLMProvider(process.env).invoke(baseParams);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(init.body));

    expect(requestBody.tools).toHaveLength(1);
    expect(requestBody.stream).toBe(false);
    expect(result.choices[0]?.message.tool_calls?.[0]?.function.arguments).toBe(
      '{"city":"Tokyo"}'
    );
    expect(result.usage?.total_tokens).toBe(18);
  });

  it("maps Anthropic request and response shapes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        id: "msg_123",
        model: "claude-3-5-sonnet-latest",
        content: [
          {
            type: "text",
            text: '{"ok":true}',
          },
          {
            type: "tool_use",
            id: "tool_a",
            name: "lookup_weather",
            input: {
              city: "Tokyo",
            },
          },
        ],
        stop_reason: "tool_use",
        usage: {
          input_tokens: 20,
          output_tokens: 8,
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    process.env = {
      LLM_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "test-key",
    };

    const result = await createLLMProvider(process.env).invoke(baseParams);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(init.body));

    expect(requestBody.messages[0].role).toBe("user");
    expect(requestBody.tools[0].name).toBe("lookup_weather");
    expect(requestBody.tool_choice).toEqual({
      type: "tool",
      name: "lookup_weather",
    });
    expect(result.choices[0]?.finish_reason).toBe("tool_calls");
    expect(result.choices[0]?.message.tool_calls?.[0]?.id).toBe("tool_a");
  });

  it("maps Gemini request and response shapes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"ok":true}',
                },
                {
                  functionCall: {
                    name: "lookup_weather",
                    args: {
                      city: "Tokyo",
                    },
                  },
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
        usageMetadata: {
          promptTokenCount: 12,
          candidatesTokenCount: 6,
          totalTokenCount: 18,
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    process.env = {
      LLM_PROVIDER: "gemini",
      GEMINI_API_KEY: "test-key",
    };

    const result = await createLLMProvider(process.env).invoke(baseParams);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(init.body));

    expect(requestBody.tools[0].functionDeclarations[0].name).toBe(
      "lookup_weather"
    );
    expect(requestBody.toolConfig.functionCallingConfig).toEqual({
      mode: "ANY",
      allowedFunctionNames: ["lookup_weather"],
    });
    expect(requestBody.generationConfig.responseMimeType).toBe(
      "application/json"
    );
    expect(result.choices[0]?.message.tool_calls?.[0]?.function.arguments).toBe(
      '{"city":"Tokyo"}'
    );
  });
});
