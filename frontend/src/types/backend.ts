// Backend type definitions
export type BackendType = "gemini" | "qwen";

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

export type BackendConfig = GeminiConfig | QwenConfig;

export interface BackendState {
  selectedBackend: BackendType;
  configs: {
    gemini: GeminiConfig;
    qwen: QwenConfig;
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
      config: Partial<GeminiConfig | QwenConfig>;
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
