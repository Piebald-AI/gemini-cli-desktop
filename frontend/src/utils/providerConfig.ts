/**
 * Provider Configuration Constants
 *
 * Centralized configuration for all LLM providers supported by LLxprt Code.
 * This file contains provider metadata, default values, and validation patterns.
 */

export interface ProviderConfig {
  name: string;
  description: string;
  requiresBaseUrl: boolean;
  defaultBaseUrl?: string;
  defaultModel: string;
  apiKeyFormat?: RegExp;
  apiKeyPrefix?: string;
  supportsModelFetch?: boolean;
  getApiKeyUrl?: string;
}

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  anthropic: {
    name: "Anthropic (Claude)",
    description: "Claude models for advanced reasoning and coding",
    requiresBaseUrl: false,
    defaultModel: "claude-4-5-sonnet-20250929",
    apiKeyFormat: /^sk-ant-/,
    apiKeyPrefix: "sk-ant-",
    getApiKeyUrl: "https://console.anthropic.com/settings/keys",
  },
  openai: {
    name: "OpenAI (GPT)",
    description: "GPT models including GPT-5 and o3",
    requiresBaseUrl: false,
    defaultModel: "gpt-5",
    apiKeyFormat: /^sk-/,
    apiKeyPrefix: "sk-",
    getApiKeyUrl: "https://platform.openai.com/api-keys",
  },
  openrouter: {
    name: "OpenRouter (Multi-provider)",
    description: "Access multiple AI providers through a single API",
    requiresBaseUrl: true,
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-sonnet-4-5",
    apiKeyFormat: /^sk-or-/,
    apiKeyPrefix: "sk-or-",
    supportsModelFetch: true,
    getApiKeyUrl: "https://openrouter.ai/keys",
  },
  gemini: {
    name: "Google Gemini",
    description: "Gemini models from Google AI",
    requiresBaseUrl: false,
    defaultModel: "gemini-2.5-pro",
    apiKeyFormat: /^AI/,
    apiKeyPrefix: "AI",
    getApiKeyUrl: "https://aistudio.google.com/apikey",
  },
  qwen: {
    name: "Qwen/Alibaba Cloud",
    description: "Qwen models from Alibaba Cloud",
    requiresBaseUrl: false,
    defaultModel: "qwen3-coder-plus",
    getApiKeyUrl: "https://dashscope.console.aliyun.com/apiKey",
  },
  groq: {
    name: "Groq",
    description: "Ultra-fast inference with Groq LPU",
    requiresBaseUrl: false,
    defaultModel: "openai/gpt-oss-120b",
    apiKeyFormat: /^gsk_/,
    apiKeyPrefix: "gsk_",
    getApiKeyUrl: "https://console.groq.com/keys",
  },
  together: {
    name: "Together AI",
    description: "Open-source models and custom fine-tuning",
    requiresBaseUrl: false,
    defaultModel: "meta-llama/Llama-3-70b-chat-hf",
    getApiKeyUrl: "https://api.together.xyz/settings/api-keys",
  },
  xai: {
    name: "xAI (Grok)",
    description: "Grok models from xAI",
    requiresBaseUrl: false,
    defaultModel: "grok-4-fast",
    getApiKeyUrl: "https://console.x.ai/",
  },
  custom: {
    name: "Custom OpenAI-compatible",
    description: "Use any OpenAI-compatible API endpoint",
    requiresBaseUrl: true,
    defaultBaseUrl: "https://api.example.com/v1",
    defaultModel: "custom-model",
  },
} as const;

export type ProviderName = keyof typeof PROVIDER_CONFIGS;

/**
 * Get provider configuration by name
 */
export function getProviderConfig(
  provider: string
): ProviderConfig | undefined {
  return PROVIDER_CONFIGS[provider as ProviderName];
}

/**
 * Check if a provider supports model fetching
 */
export function supportsModelFetch(provider: string): boolean {
  const config = getProviderConfig(provider);
  return config?.supportsModelFetch ?? false;
}

/**
 * Get default model for a provider
 */
export function getDefaultModel(provider: string): string {
  const config = getProviderConfig(provider);
  return config?.defaultModel ?? "";
}

/**
 * Get default base URL for a provider (if applicable)
 */
export function getDefaultBaseUrl(provider: string): string {
  const config = getProviderConfig(provider);
  return config?.defaultBaseUrl ?? "";
}

/**
 * Check if API key matches expected format for provider
 */
export function validateApiKeyFormat(
  provider: string,
  apiKey: string
): boolean {
  const config = getProviderConfig(provider);
  if (!config?.apiKeyFormat) {
    // No format specified, accept any non-empty key
    return apiKey.length > 0;
  }
  return config.apiKeyFormat.test(apiKey);
}

/**
 * Get all provider names
 */
export function getAllProviders(): ProviderName[] {
  return Object.keys(PROVIDER_CONFIGS) as ProviderName[];
}

/**
 * Model placeholders for different providers (used in UI)
 */
export const MODEL_PLACEHOLDERS: Record<string, string> = {
  anthropic: "claude-sonnet-4-5-20250929",
  openai: "gpt-5",
  openrouter: "anthropic/claude-sonnet-4-5",
  gemini: "gemini-2.5-pro",
  qwen: "qwen3-coder-plus",
  groq: "llama-3.3-70b-versatile",
  together: "meta-llama/Llama-3-70b-chat-hf",
  xai: "grok-4-fast",
  custom: "model-name",
} as const;
