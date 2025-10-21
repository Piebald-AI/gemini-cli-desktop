// Backend type definitions
export type BackendType = "gemini" | "qwen" | "llxprt";

export type GeminiAuthMethod =
  | "oauth-personal"
  | "gemini-api-key"
  | "vertex-ai"
  | "cloud-shell";

export interface GeminiConfig {
  type: "gemini";
  authMethod: GeminiAuthMethod;
  apiKey: string;
  models: string[];
  defaultModel: string;
  // Vertex AI specific fields
  vertexProject?: string;
  vertexLocation?: string;
  yolo?: boolean;
}

export interface QwenConfig {
  type: "qwen";
  apiKey: string;
  baseUrl: string;
  model: string;
  useOAuth: boolean;
}

// Provider names as union type for type safety
export type LLxprtProvider =
  | "anthropic"
  | "openai"
  | "openrouter"
  | "gemini"
  | "qwen"
  | "groq"
  | "together"
  | "xai"
  | "custom";

export interface LLxprtConfig {
  type: "llxprt";
  provider: LLxprtProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
}

// Type guard for LLxprtConfig
export function isLLxprtConfig(config: unknown): config is LLxprtConfig {
  const validProviders: LLxprtProvider[] = [
    "anthropic",
    "openai",
    "openrouter",
    "gemini",
    "qwen",
    "groq",
    "together",
    "xai",
    "custom",
  ];

  return (
    typeof config === "object" &&
    config !== null &&
    (config as LLxprtConfig).type === "llxprt" &&
    validProviders.includes((config as LLxprtConfig).provider) &&
    typeof (config as LLxprtConfig).apiKey === "string" &&
    typeof (config as LLxprtConfig).model === "string" &&
    ((config as LLxprtConfig).baseUrl === undefined ||
      typeof (config as LLxprtConfig).baseUrl === "string")
  );
}

// Type guard for GeminiConfig
export function isGeminiConfig(config: unknown): config is GeminiConfig {
  return (
    typeof config === "object" &&
    config !== null &&
    (config as GeminiConfig).type === "gemini" &&
    typeof (config as GeminiConfig).authMethod === "string" &&
    typeof (config as GeminiConfig).apiKey === "string" &&
    Array.isArray((config as GeminiConfig).models) &&
    typeof (config as GeminiConfig).defaultModel === "string"
  );
}

// Type guard for QwenConfig
export function isQwenConfig(config: unknown): config is QwenConfig {
  return (
    typeof config === "object" &&
    config !== null &&
    (config as QwenConfig).type === "qwen" &&
    typeof (config as QwenConfig).apiKey === "string" &&
    typeof (config as QwenConfig).baseUrl === "string" &&
    typeof (config as QwenConfig).model === "string" &&
    typeof (config as QwenConfig).useOAuth === "boolean"
  );
}

// Type guard for BackendConfig discriminated union
export function getBackendConfigType(config: BackendConfig): BackendType {
  return config.type;
}

export type BackendConfig = GeminiConfig | QwenConfig | LLxprtConfig;

export interface BackendState {
  selectedBackend: BackendType;
  configs: {
    gemini: GeminiConfig;
    qwen: QwenConfig;
    llxprt: LLxprtConfig;
  };
  isValid: boolean;
  errors: Record<string, string>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ApiConfig {
  api_key?: string;
  base_url?: string;
  model: string;
}

export interface GeminiAuth {
  method: GeminiAuthMethod;
  api_key?: string;
  vertex_project?: string;
  vertex_location?: string;
  yolo?: boolean;
}

export interface BackendConfigParams {
  api_key: string;
  base_url: string;
  model: string;
}

export interface SessionParams {
  sessionId: string;
  workingDirectory: string;
  model: string;
  backendConfig?: BackendConfigParams;
  geminiAuth?: GeminiAuth;
  [key: string]: unknown;
}

export interface BackendContextValue {
  // State
  state: BackendState;
  selectedBackend: BackendType; // Direct access for convenience

  // Actions
  switchBackend: (backend: BackendType) => void;
  updateConfig: <T extends BackendType>(
    backend: T,
    config: Partial<BackendState["configs"][T]>
  ) => void;
  validateConfig: (backend: BackendType) => boolean;
  resetConfig: (backend: BackendType) => void;

  // Computed values
  currentConfig: BackendConfig;
  isCurrentBackendValid: boolean;
  currentModel: string;

  // Helper methods
  getApiConfig: () => ApiConfig | null;
  canStartSession: () => boolean;
}

// Action types for useReducer
export type BackendAction =
  | { type: "SWITCH_BACKEND"; backend: BackendType }
  | {
      type: "UPDATE_CONFIG";
      backend: BackendType;
      config: Partial<GeminiConfig | QwenConfig | LLxprtConfig>;
    }
  | { type: "SET_VALIDATION_ERROR"; backend: string; error: string }
  | { type: "CLEAR_VALIDATION_ERROR"; backend: string }
  | { type: "RESET_CONFIG"; backend: BackendType }
  | { type: "LOAD_FROM_STORAGE"; state: BackendState };

export interface GitInfo {
  current_directory: string;
  branch: string;
  status: string;
  is_clean: boolean;
  has_uncommitted_changes: boolean;
  has_untracked_files: boolean;
}
