import {
  McpServerConfig,
  McpServerEntry,
  isStdioConfig,
  isSSEConfig,
  isHTTPConfig,
} from "../types";
import i18n from '../i18n';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export function validateMcpServerName(name: string): ValidationResult {
  const errors: ValidationError[] = [];
  const t = i18n.t;

  if (!name || name.trim().length === 0) {
    errors.push({
      field: "name",
      message: t('validation.serverNameRequired'),
    });
  } else if (name.trim().length < 2) {
    errors.push({
      field: "name",
      message: t('validation.serverNameTooShort'),
    });
  } else if (!/^[a-zA-Z0-9_-]+$/.test(name.trim())) {
    errors.push({
      field: "name",
      message: t('validation.serverNameInvalidChars'),
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateMcpServerConfig(
  config: McpServerConfig
): ValidationResult {
  const errors: ValidationError[] = [];
  const t = i18n.t;

  // Validate transport-specific configurations
  if (isStdioConfig(config)) {
    if (!config.command || config.command.trim().length === 0) {
      errors.push({
        field: "command",
        message: t('validation.commandRequired'),
      });
    }

    // Validate working directory if provided
    if (config.cwd && config.cwd.trim().length > 0) {
      // Basic path validation
      if (config.cwd.includes("..")) {
        errors.push({
          field: "cwd",
          message: t('validation.invalidWorkingDirectory'),
        });
      }
    }
  } else if (isSSEConfig(config)) {
    if (!config.url || config.url.trim().length === 0) {
      errors.push({
        field: "url",
        message: t('validation.urlRequired'),
      });
    } else if (!isValidUrl(config.url)) {
      errors.push({
        field: "url",
        message: t('validation.invalidUrl'),
      });
    }
  } else if (isHTTPConfig(config)) {
    if (!config.httpUrl || config.httpUrl.trim().length === 0) {
      errors.push({
        field: "httpUrl",
        message: t('validation.httpUrlRequired'),
      });
    } else if (!isValidUrl(config.httpUrl)) {
      errors.push({
        field: "httpUrl",
        message: t('validation.invalidHttpUrl'),
      });
    }
  }

  // Validate timeout
  if (config.timeout !== undefined) {
    if (config.timeout < 1000) {
      errors.push({
        field: "timeout",
        message: t('validation.timeoutTooLow'),
      });
    } else if (config.timeout > 3600000) {
      errors.push({
        field: "timeout",
        message: t('validation.timeoutTooHigh'),
      });
    }
  }

  // Validate OAuth configuration
  if (config.oauth?.enabled) {
    if (
      config.oauth.scopes &&
      config.oauth.scopes.some((scope) => !scope.trim())
    ) {
      errors.push({
        field: "oauth.scopes",
        message: t('validation.oauthScopesEmpty'),
      });
    }

    if (config.oauth.redirectUri && !isValidUrl(config.oauth.redirectUri)) {
      errors.push({
        field: "oauth.redirectUri",
        message: t('validation.invalidRedirectUri'),
      });
    }

    if (
      config.oauth.authorizationUrl &&
      !isValidUrl(config.oauth.authorizationUrl)
    ) {
      errors.push({
        field: "oauth.authorizationUrl",
        message: t('validation.invalidAuthUrl'),
      });
    }

    if (config.oauth.tokenUrl && !isValidUrl(config.oauth.tokenUrl)) {
      errors.push({
        field: "oauth.tokenUrl",
        message: t('validation.invalidTokenUrl'),
      });
    }
  }

  // Validate tool filtering
  if (config.includeTools && config.excludeTools) {
    const excludeSet = new Set(config.excludeTools);
    const overlap = config.includeTools.filter((tool) => excludeSet.has(tool));

    if (overlap.length > 0) {
      errors.push({
        field: "tools",
        message: t('validation.toolsOverlap', { tools: overlap.join(", ") }),
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateMcpServerEntry(
  server: McpServerEntry
): ValidationResult {
  const nameValidation = validateMcpServerName(server.name);
  const configValidation = validateMcpServerConfig(server.config);

  return {
    isValid: nameValidation.isValid && configValidation.isValid,
    errors: [...nameValidation.errors, ...configValidation.errors],
  };
}

export function validateUniqueServerNames(
  servers: McpServerEntry[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const nameMap = new Map<string, number>();
  const t = i18n.t;

  servers.forEach((server, index) => {
    const normalizedName = server.name.trim().toLowerCase();
    if (nameMap.has(normalizedName)) {
      errors.push({
        field: `servers[${index}].name`,
        message: t('validation.duplicateServerName', { name: server.name }),
      });
      // Also mark the original occurrence
      const originalIndex = nameMap.get(normalizedName)!;
      errors.push({
        field: `servers[${originalIndex}].name`,
        message: t('validation.duplicateServerName', { name: server.name }),
      });
    } else {
      nameMap.set(normalizedName, index);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch {
    return false;
  }
}

export function getFieldError(
  errors: ValidationError[],
  fieldName: string
): string | undefined {
  const error = errors.find((e) => e.field === fieldName);
  return error?.message;
}
