import {
  McpServerConfig,
  McpServerEntry,
  isStdioConfig,
  isSSEConfig,
  isHTTPConfig,
} from "../types";

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

  if (!name || name.trim().length === 0) {
    errors.push({
      field: "name",
      message: "Server name is required",
    });
  } else if (name.trim().length < 2) {
    errors.push({
      field: "name",
      message: "Server name must be at least 2 characters long",
    });
  } else if (!/^[a-zA-Z0-9_-]+$/.test(name.trim())) {
    errors.push({
      field: "name",
      message:
        "Server name can only contain letters, numbers, underscores, and hyphens",
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

  // Validate transport-specific configurations
  if (isStdioConfig(config)) {
    if (!config.command || config.command.trim().length === 0) {
      errors.push({
        field: "command",
        message: "Command is required for stdio transport",
      });
    }

    // Validate working directory if provided
    if (config.cwd && config.cwd.trim().length > 0) {
      // Basic path validation
      if (config.cwd.includes("..")) {
        errors.push({
          field: "cwd",
          message: "Working directory should not contain relative paths (..)",
        });
      }
    }
  } else if (isSSEConfig(config)) {
    if (!config.url || config.url.trim().length === 0) {
      errors.push({
        field: "url",
        message: "URL is required for SSE transport",
      });
    } else if (!isValidUrl(config.url)) {
      errors.push({
        field: "url",
        message: "Please enter a valid URL",
      });
    }
  } else if (isHTTPConfig(config)) {
    if (!config.httpUrl || config.httpUrl.trim().length === 0) {
      errors.push({
        field: "httpUrl",
        message: "HTTP URL is required for HTTP transport",
      });
    } else if (!isValidUrl(config.httpUrl)) {
      errors.push({
        field: "httpUrl",
        message: "Please enter a valid HTTP URL",
      });
    }
  }

  // Validate timeout
  if (config.timeout !== undefined) {
    if (config.timeout < 1000) {
      errors.push({
        field: "timeout",
        message: "Timeout must be at least 1000ms (1 second)",
      });
    } else if (config.timeout > 3600000) {
      errors.push({
        field: "timeout",
        message: "Timeout cannot exceed 3600000ms (1 hour)",
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
        message: "OAuth scopes cannot be empty",
      });
    }

    if (config.oauth.redirectUri && !isValidUrl(config.oauth.redirectUri)) {
      errors.push({
        field: "oauth.redirectUri",
        message: "OAuth redirect URI must be a valid URL",
      });
    }

    if (
      config.oauth.authorizationUrl &&
      !isValidUrl(config.oauth.authorizationUrl)
    ) {
      errors.push({
        field: "oauth.authorizationUrl",
        message: "OAuth authorization URL must be a valid URL",
      });
    }

    if (config.oauth.tokenUrl && !isValidUrl(config.oauth.tokenUrl)) {
      errors.push({
        field: "oauth.tokenUrl",
        message: "OAuth token URL must be a valid URL",
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
        message: `Tools cannot be both included and excluded: ${overlap.join(", ")}`,
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

  servers.forEach((server, index) => {
    const normalizedName = server.name.trim().toLowerCase();
    if (nameMap.has(normalizedName)) {
      errors.push({
        field: `servers[${index}].name`,
        message: `Duplicate server name: "${server.name}"`,
      });
      // Also mark the original occurrence
      const originalIndex = nameMap.get(normalizedName)!;
      errors.push({
        field: `servers[${originalIndex}].name`,
        message: `Duplicate server name: "${server.name}"`,
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
