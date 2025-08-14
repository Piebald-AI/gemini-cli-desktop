import { BackendState, GeminiConfig, QwenConfig } from '../types/backend';

export const defaultGeminiConfig: GeminiConfig = {
  type: 'gemini',
  useOAuth: false,
  models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  defaultModel: 'gemini-2.5-flash',
};

export const defaultQwenConfig: QwenConfig = {
  type: 'qwen',
  apiKey: '',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'qwen/qwen3-coder:free',
  useOAuth: false,
};

export const defaultBackendState: BackendState = {
  selectedBackend: 'gemini',
  configs: {
    gemini: defaultGeminiConfig,
    qwen: defaultQwenConfig,
  },
  isValid: true,
  errors: {},
};