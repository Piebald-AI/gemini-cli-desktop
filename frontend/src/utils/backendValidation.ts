import {
  BackendType,
  BackendConfig,
  GeminiConfig,
  QwenConfig,
  LLxprtConfig,
  ValidationResult,
} from "../types/backend";
import i18n from "../i18n";
import { getProviderConfig, validateApiKeyFormat } from "./providerConfig";

/**
 * Check if a hostname is localhost
 */
function isLocalhost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "[::1]" ||
    normalized === "0.0.0.0"
  );
}

/**
 * Check if a hostname is a private IP address
 */
function isPrivateIP(hostname: string): boolean {
  // Check if it's an IP address
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);

  if (!match) return false;

  const octets = [
    parseInt(match[1]),
    parseInt(match[2]),
    parseInt(match[3]),
    parseInt(match[4]),
  ];

  // Validate octets are in range
  if (octets.some((octet) => octet < 0 || octet > 255)) {
    return false;
  }

  // Check private ranges (RFC 1918)
  return (
    octets[0] === 10 || // 10.0.0.0/8
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || // 172.16.0.0/12
    (octets[0] === 192 && octets[1] === 168) || // 192.168.0.0/16
    (octets[0] === 169 && octets[1] === 254) || // 169.254.0.0/16 (link-local)
    octets[0] === 127 // 127.0.0.0/8 (loopback)
  );
}

/**
 * Validate URL to prevent SSRF attacks
 */
function validateUrlSecurity(urlString: string): {
  valid: boolean;
  error?: string;
} {
  let url: URL;

  try {
    url = new URL(urlString);
  } catch {
    return { valid: false, error: i18n.t("validation.invalidUrl") };
  }

  // 1. Check scheme (only http/https allowed)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      valid: false,
      error: i18n.t("validation.invalidUrlScheme"),
    };
  }

  // 2. HTTPS enforcement (except localhost)
  if (url.protocol === "http:" && !isLocalhost(url.hostname)) {
    return {
      valid: false,
      error: i18n.t("validation.httpsRequired"),
    };
  }

  // 3. Block private IPs (except localhost)
  if (isPrivateIP(url.hostname) && !isLocalhost(url.hostname)) {
    return {
      valid: false,
      error: i18n.t("validation.privateIpBlocked"),
    };
  }

  // 4. Block cloud metadata endpoints
  const blockedHosts = [
    "169.254.169.254", // AWS/Azure metadata
    "metadata.google.internal", // GCP metadata
    "metadata",
  ];

  if (blockedHosts.includes(url.hostname.toLowerCase())) {
    return {
      valid: false,
      error: i18n.t("validation.metadataEndpointBlocked"),
    };
  }

  // 5. URL length limit (防止DoS)
  if (urlString.length > 500) {
    return {
      valid: false,
      error: i18n.t("validation.urlTooLong"),
    };
  }

  // 6. Warn about non-standard providers (but allow)
  const knownDomains = [
    "api.openai.com",
    "openrouter.ai",
    "api.anthropic.com",
    "generativelanguage.googleapis.com",
    "api.together.xyz",
    "api.groq.com",
    "dashscope.aliyuncs.com",
    "api.x.ai",
  ];

  const isKnownProvider = knownDomains.some((domain) =>
    url.hostname.toLowerCase().endsWith(domain)
  );

  if (!isKnownProvider && !isLocalhost(url.hostname)) {
    // This is a warning, not an error - still valid but flag it
    console.warn(
      `[SECURITY] Using non-standard provider domain: ${url.hostname}. Ensure this is intentional and trusted.`
    );
  }

  return { valid: true };
}

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
        errors.push(t("validation.apiKeyRequired"));
      }
      break;
    case "vertex-ai":
      if (!config.vertexProject || !config.vertexProject.trim()) {
        errors.push(t("validation.projectIdRequired"));
      }
      if (!config.vertexLocation || !config.vertexLocation.trim()) {
        errors.push(t("validation.locationRequired"));
      }
      break;
    case "oauth-personal":
    case "cloud-shell":
      // No additional fields required for these methods
      break;
  }

  if (!config.models || config.models.length === 0) {
    errors.push(t("validation.modelRequired"));
  }

  if (!config.defaultModel || !config.defaultModel.trim()) {
    errors.push(t("validation.defaultModelRequired"));
  }

  if (
    config.defaultModel &&
    config.models &&
    !config.models.includes(config.defaultModel)
  ) {
    errors.push(t("validation.defaultModelMustBeAvailable"));
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
    if (!config.apiKey.trim()) errors.push(t("validation.apiKeyRequired"));
    if (!config.baseUrl.trim()) errors.push(t("validation.baseUrlRequired"));

    // Enhanced URL validation with SSRF protection
    if (config.baseUrl.trim()) {
      const urlValidation = validateUrlSecurity(config.baseUrl);
      if (!urlValidation.valid) {
        errors.push(urlValidation.error || t("validation.invalidBaseUrl"));
      }
    }
  }

  if (!config.model.trim()) errors.push(t("validation.modelRequired"));

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateLLxprtConfig = (
  config: LLxprtConfig
): ValidationResult => {
  const errors: string[] = [];
  const t = i18n.t;

  // Provider validation
  if (!config.provider.trim()) {
    errors.push(t("validation.providerRequired"));
  } else {
    const providerConfig = getProviderConfig(config.provider);
    if (!providerConfig) {
      errors.push(t("validation.unsupportedProvider"));
    }
  }

  // API key validation
  if (!config.apiKey.trim()) {
    errors.push(t("validation.apiKeyRequired"));
  } else {
    // Check for accidental paste of entire response
    if (config.apiKey.length > 200) {
      errors.push(t("validation.apiKeyTooLong"));
    }

    // Validate API key format for known providers
    if (
      config.provider &&
      !validateApiKeyFormat(config.provider, config.apiKey)
    ) {
      const providerConfig = getProviderConfig(config.provider);
      if (providerConfig?.apiKeyPrefix) {
        errors.push(
          t("validation.invalidApiKeyFormat", {
            prefix: providerConfig.apiKeyPrefix,
          })
        );
      }
    }
  }

  // Model validation
  if (!config.model.trim()) {
    errors.push(t("validation.modelRequired"));
  } else if (config.provider) {
    // Provider-model compatibility checks
    if (
      config.provider === "anthropic" &&
      !config.model.startsWith("claude-")
    ) {
      errors.push(
        t("validation.modelProviderMismatch", {
          provider: "Anthropic",
          expected: "claude-*",
        })
      );
    } else if (
      config.provider === "openai" &&
      config.model.startsWith("claude-")
    ) {
      errors.push(
        t("validation.modelProviderMismatch", {
          provider: "OpenAI",
          expected: "gpt-*",
        })
      );
    }
  }

  // Base URL validation with SSRF protection
  if (config.baseUrl && config.baseUrl.trim()) {
    const urlValidation = validateUrlSecurity(config.baseUrl);
    if (!urlValidation.valid) {
      errors.push(urlValidation.error || t("validation.invalidBaseUrl"));
    }
  }

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
    case "llxprt":
      return validateLLxprtConfig(config as LLxprtConfig);
    default:
      return { isValid: false, errors: [t("validation.unknownBackendType")] };
  }
};
