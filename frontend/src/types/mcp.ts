// MCP Server Configuration Types
// Based on the Gemini CLI MCP server configuration documentation

export type TransportType = "stdio" | "sse" | "http";

export type AuthProviderType = "dynamic_discovery" | "google_credentials";

export interface McpOAuthConfig {
  enabled?: boolean;
  supportsDiscovery?: boolean;
  clientId?: string;
  clientSecret?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  scopes?: string[];
  redirectUri?: string;
  tokenParamName?: string;
  audiences?: string[];
}

export interface McpServerConfigBase {
  // Optional properties for all server types
  headers?: Record<string, string>;
  env?: Record<string, string>;
  cwd?: string;
  timeout?: number;
  trust?: boolean;
  includeTools?: string[];
  excludeTools?: string[];
  oauth?: McpOAuthConfig;
  authProviderType?: AuthProviderType;
}

export interface McpServerConfigStdio extends McpServerConfigBase {
  command: string;
  args?: string[];
}

export interface McpServerConfigSSE extends McpServerConfigBase {
  url: string;
}

export interface McpServerConfigHTTP extends McpServerConfigBase {
  httpUrl: string;
}

export type McpServerConfig =
  | McpServerConfigStdio
  | McpServerConfigSSE
  | McpServerConfigHTTP;

export interface McpServerEntry {
  name: string;
  config: McpServerConfig;
  id: string; // For UI management
  enabled: boolean; // For UI management
}

export interface McpServersConfig {
  [serverName: string]: McpServerConfig;
}

export interface McpSettingsConfig {
  mcpServers: McpServersConfig;
}

// Helper type guards
export function isStdioConfig(
  config: McpServerConfig
): config is McpServerConfigStdio {
  return "command" in config;
}

export function isSSEConfig(
  config: McpServerConfig
): config is McpServerConfigSSE {
  return "url" in config;
}

export function isHTTPConfig(
  config: McpServerConfig
): config is McpServerConfigHTTP {
  return "httpUrl" in config;
}

export function getTransportType(config: McpServerConfig): TransportType {
  if (isStdioConfig(config)) return "stdio";
  if (isSSEConfig(config)) return "sse";
  if (isHTTPConfig(config)) return "http";
  throw new Error("Unknown transport type");
}

// Default configurations for new servers
export const defaultStdioConfig: McpServerConfigStdio = {
  command: "",
  args: [],
  timeout: 600000,
  trust: false,
};

export const defaultSSEConfig: McpServerConfigSSE = {
  url: "",
  timeout: 600000,
  trust: false,
};

export const defaultHTTPConfig: McpServerConfigHTTP = {
  httpUrl: "",
  timeout: 600000,
  trust: false,
};

export const defaultOAuthConfig: McpOAuthConfig = {
  enabled: false,
  scopes: [],
  redirectUri: "http://localhost:7777/oauth/callback",
};
