import {
  BackendState,
  GeminiConfig,
  QwenConfig,
  LLxprtConfig,
} from "../types/backend";

export const defaultGeminiConfig: GeminiConfig = {
  type: "gemini",
  authMethod: "oauth-personal",
  apiKey: "",
  models: [
    "gemini-3-pro-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
  ],
  defaultModel: "gemini-2.5-flash",
  vertexProject: "",
  vertexLocation: "us-central1",
};

export const defaultQwenConfig: QwenConfig = {
  type: "qwen",
  apiKey: "",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "qwen/qwen3-coder:free",
  useOAuth: false,
};

export const defaultLLxprtConfig: LLxprtConfig = {
  type: "llxprt",
  provider: "anthropic",
  apiKey: "",
  model: "claude-3-5-sonnet-20241022",
  baseUrl: "",
};

export const defaultBackendState: BackendState = {
  selectedBackend: "gemini",
  configs: {
    gemini: defaultGeminiConfig,
    qwen: defaultQwenConfig,
    llxprt: defaultLLxprtConfig,
  },
  isValid: true,
  errors: {},
};

// Provider-specific defaults for LLxprt
export const llxprtProviderDefaults: Record<
  string,
  { baseUrl: string; modelPlaceholder: string }
> = {
  anthropic: {
    baseUrl: "",
    modelPlaceholder: "claude-3-5-sonnet-20241022",
  },
  openai: {
    baseUrl: "",
    modelPlaceholder: "gpt-4o",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    modelPlaceholder: "anthropic/claude-3.5-sonnet",
  },
  gemini: {
    baseUrl: "",
    modelPlaceholder: "gemini-3-pro-preview",
  },
  qwen: {
    baseUrl: "",
    modelPlaceholder: "qwen-max",
  },
  groq: {
    baseUrl: "",
    modelPlaceholder: "llama-3.3-70b-versatile",
  },
  together: {
    baseUrl: "",
    modelPlaceholder: "meta-llama/Llama-3-70b-chat-hf",
  },
  xai: {
    baseUrl: "",
    modelPlaceholder: "grok-beta",
  },
  custom: {
    baseUrl: "https://api.example.com/v1",
    modelPlaceholder: "custom-model",
  },
};
