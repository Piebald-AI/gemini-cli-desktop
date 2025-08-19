import {
  BackendType,
  BackendConfig,
  GeminiConfig,
  QwenConfig,
  ValidationResult,
} from "../types/backend";
import i18n from '../i18n';

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const validateGeminiConfig = (
  config: GeminiConfig
): ValidationResult => {
  const errors: string[] = [];
  const t = i18n.t;

  // Check authentication requirements based on method
  switch (config.authMethod) {
    case "gemini-api-key":
      if (!config.apiKey || !config.apiKey.trim()) {
        errors.push(t('validation.apiKeyRequired'));
      }
      break;
    case "vertex-ai":
      if (!config.vertexProject || !config.vertexProject.trim()) {
        errors.push(t('validation.projectIdRequired'));
      }
      if (!config.vertexLocation || !config.vertexLocation.trim()) {
        errors.push(t('validation.locationRequired'));
      }
      break;
    case "oauth-personal":
    case "cloud-shell":
      // No additional fields required for these methods
      break;
  }

  if (!config.models || config.models.length === 0) {
    errors.push(t('validation.modelRequired'));
  }

  if (!config.defaultModel || !config.defaultModel.trim()) {
    errors.push(t('validation.defaultModelRequired'));
  }

  if (
    config.defaultModel &&
    config.models &&
    !config.models.includes(config.defaultModel)
  ) {
    errors.push(t('validation.defaultModelMustBeAvailable'));
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateQwenConfig = (config: QwenConfig): ValidationResult => {
  const errors: string[] = [];
  const t = i18n.t;

  if (!config.useOAuth) {
    if (!config.apiKey.trim()) errors.push(t('validation.apiKeyRequired'));
    if (!config.baseUrl.trim()) errors.push(t('validation.baseUrlRequired'));
    if (!isValidUrl(config.baseUrl)) errors.push(t('validation.invalidBaseUrl'));
  }

  if (!config.model.trim()) errors.push(t('validation.modelRequired'));

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateBackendConfig = (
  backend: BackendType,
  config: BackendConfig
): ValidationResult => {
  const t = i18n.t;
  
  switch (backend) {
    case "gemini":
      return validateGeminiConfig(config as GeminiConfig);
    case "qwen":
      return validateQwenConfig(config as QwenConfig);
    default:
      return { isValid: false, errors: [t('validation.unknownBackendType')] };
  }
};
