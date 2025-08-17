import { BackendType, BackendConfig, GeminiConfig, QwenConfig, ValidationResult } from '../types/backend';

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const validateGeminiConfig = (config: GeminiConfig): ValidationResult => {
  const errors: string[] = [];
  
  // Check authentication requirements based on method
  switch (config.authMethod) {
    case 'gemini-api-key':
      if (!config.apiKey || !config.apiKey.trim()) {
        errors.push('API Key is required for API key authentication');
      }
      break;
    case 'vertex-ai':
      if (!config.vertexProject || !config.vertexProject.trim()) {
        errors.push('Google Cloud Project ID is required for Vertex AI');
      }
      if (!config.vertexLocation || !config.vertexLocation.trim()) {
        errors.push('Google Cloud Location is required for Vertex AI');
      }
      break;
    case 'oauth-personal':
    case 'cloud-shell':
      // No additional fields required for these methods
      break;
  }
  
  if (!config.models || config.models.length === 0) {
    errors.push('At least one model must be available');
  }
  
  if (!config.defaultModel || !config.defaultModel.trim()) {
    errors.push('Default model is required');
  }
  
  if (config.defaultModel && config.models && !config.models.includes(config.defaultModel)) {
    errors.push('Default model must be one of the available models');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateQwenConfig = (config: QwenConfig): ValidationResult => {
  const errors: string[] = [];
  
  if (!config.useOAuth) {
    if (!config.apiKey.trim()) errors.push('API Key is required');
    if (!config.baseUrl.trim()) errors.push('Base URL is required');
    if (!isValidUrl(config.baseUrl)) errors.push('Invalid Base URL format');
  }
  
  if (!config.model.trim()) errors.push('Model is required');
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateBackendConfig = (
  backend: BackendType, 
  config: BackendConfig
): ValidationResult => {
  switch (backend) {
    case 'gemini':
      return validateGeminiConfig(config as GeminiConfig);
    case 'qwen':
      return validateQwenConfig(config as QwenConfig);
    default:
      return {isValid: false, errors: ['Unknown backend type']};
  }
};