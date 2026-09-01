#!/usr/bin/env node
// Generic AI gateway — provider-agnostic interface for DeepInfra, Vercel AI Gateway,
// Ollama, and any OpenAI-compatible endpoint. Swap providers by changing
// one config field; no code changes needed.
//
// Usage as module:
//   import { createClient } from "./ai-gateway.mjs";
//   const ai = createClient({ provider: "deepinfra", model: "microsoft/Phi-4" });
//   const res = await ai.chat({ messages: [...] });
//
// Providers:
//   deepinfra  → api.deepinfra.com/v1/openai  uses DEEPINFRA_API_KEY
//   vercel     → AI_GATEWAY_URL               uses AI_GATEWAY_API_KEY (env)
//   ollama     → localhost:11434/api          no auth needed
//   openai     → api.openai.com/v1            uses OPENAI_API_KEY
//   generic    → any OpenAI-compat endpoint   pass baseURL + apiKey directly

const PROVIDER_DEFAULTS = {
  deepinfra: {
    baseURL: "https://api.deepinfra.com/v1/openai",
    apiKeyEnv: "DEEPINFRA_API_KEY",
    chatPath: "/chat/completions",
    protocol: "openai",
  },
  vercel: {
    baseURL: process.env.AI_GATEWAY_URL ?? "https://gateway.ai.vercel.com",
    apiKeyEnv: "AI_GATEWAY_API_KEY",
    chatPath: "/v1/chat/completions",
    protocol: "openai",
  },
  openai: {
    baseURL: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    chatPath: "/chat/completions",
    protocol: "openai",
  },
  ollama: {
    baseURL: process.env.OLLAMA_HOST ?? "http://localhost:11434",
    apiKeyEnv: null,
    chatPath: "/api/chat",
    protocol: "ollama",
  },
};

export function createClient(opts = {}) {
  const provider = opts.provider ?? "deepinfra";
  const defaults = PROVIDER_DEFAULTS[provider];
  if (!defaults) {
    throw new Error(
      `Unknown provider "${provider}". Valid providers: ${Object.keys(PROVIDER_DEFAULTS).join(", ")}`,
    );
  }

  const baseURL = opts.baseURL ?? defaults.baseURL;
  const apiKey = opts.apiKey ?? (defaults.apiKeyEnv ? process.env[defaults.apiKeyEnv] : null);
  const chatPath = opts.chatPath ?? defaults.chatPath;
  const protocol = opts.protocol ?? defaults.protocol;

  const endpoint = baseURL.replace(/\/+$/, "") + chatPath;

  if (protocol === "ollama") {
    return createOllamaClient(endpoint, opts);
  }
  return createOpenAIClient(endpoint, apiKey, opts);
}

function createOpenAIClient(endpoint, apiKey, opts) {
  const defaultModel = opts.model ?? "microsoft/Phi-4";

  async function chat({ messages, model, maxTokens, temperature, stream }) {
    const body = {
      model: model ?? defaultModel,
      messages,
      max_tokens: maxTokens ?? 1024,
      temperature: temperature ?? 0,
      stream: stream ?? false,
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    if (opts.headers) Object.assign(headers, opts.headers);

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown error");
      throw new Error(`AI gateway error ${res.status}: ${errText.slice(0, 500)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  async function chatStream({ messages, model, maxTokens, temperature, onToken }) {
    const body = {
      model: model ?? defaultModel,
      messages,
      max_tokens: maxTokens ?? 4096,
      temperature: temperature ?? 0,
      stream: true,
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    if (opts.headers) Object.assign(headers, opts.headers);

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown error");
      throw new Error(`AI gateway error ${res.status}: ${errText.slice(0, 500)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") break;

        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            full += token;
            if (onToken) onToken(token, full);
          }
        } catch {
          // skip unparseable chunks
        }
      }
    }

    return full;
  }

  return { chat, chatStream, provider: "openai-compatible", model: defaultModel };
}

function createOllamaClient(endpoint, opts) {
  const defaultModel = opts.model ?? "llama3.2";

  async function chat({ messages, model, maxTokens, temperature }) {
    const body = {
      model: model ?? defaultModel,
      messages,
      stream: false,
      options: {
        num_predict: maxTokens ?? 1024,
        temperature: temperature ?? 0,
      },
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown error");
      throw new Error(`Ollama error ${res.status}: ${errText.slice(0, 500)}`);
    }

    const data = await res.json();
    return data.message?.content ?? "";
  }

  async function chatStream({ messages, model, maxTokens, temperature, onToken }) {
    const body = {
      model: model ?? defaultModel,
      messages,
      stream: true,
      options: {
        num_predict: maxTokens ?? 4096,
        temperature: temperature ?? 0,
      },
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown error");
      throw new Error(`Ollama error ${res.status}: ${errText.slice(0, 500)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          const token = parsed.message?.content;
          if (token) {
            full += token;
            if (onToken) onToken(token, full);
          }
        } catch {
          // skip unparseable chunks
        }
      }
    }

    return full;
  }

  return { chat, chatStream, provider: "ollama", model: defaultModel };
}

// CLI test mode
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("/ai-gateway.mjs")) {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : null;
  };
  const provider = getArg("--provider") ?? "groq";
  const model = getArg("--model");
  const prompt = getArg("--prompt") ?? "Say 'gateway online'.";

  const client = createClient({ provider, ...(model ? { model } : {}) });
  const result = await client.chat({
    messages: [{ role: "user", content: prompt }],
    maxTokens: 50,
  });
  console.log(result);
}
