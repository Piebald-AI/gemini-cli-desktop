import { BackendType } from "../types/backend";

// Backend configuration mapping - i18n style
const BACKEND_CONFIG = {
  gemini: {
    backendDisplayName: "Gemini CLI",
    appDisplayName: "Gemini Desktop",
    backendShortname: "Gemini",
    backendModelFamilyNameOrTool: "Gemini",
    backendDownloadUrl: "https://github.com/google-gemini/gemini-cli",
  },
  qwen: {
    backendDisplayName: "Qwen Code",
    appDisplayName: "Qwen Desktop",
    backendShortname: "Qwen",
    backendModelFamilyNameOrTool: "Qwen Code",
    backendDownloadUrl: "https://github.com/qwenlm/qwen-code",
  },
} as const;

/**
 * Get backend-specific text for UI display
 */
export const getBackendText = (backend: BackendType) => {
  const config = BACKEND_CONFIG[backend];

  return {
    name: config.backendDisplayName,
    shortName: config.backendShortname,
    desktopName: config.appDisplayName,
    cliNotFound: `${config.backendDisplayName} not found`,
    installMessage:
      backend === "gemini"
        ? `Please install ${config.backendDisplayName} and make sure it's available in your PATH. You can install it from ${config.backendDownloadUrl}.`
        : `Please install ${config.backendDisplayName} and make sure it's available in your PATH.`,
    mcpCapabilities: `MCP servers extend ${config.backendModelFamilyNameOrTool}'s capabilities by providing access to external tools and data sources.`,
    mcpToolExecution: `MCP tools, included in this MCP server, that ${config.backendDisplayName} may execute.`,
    mcpToolExclusion: `MCP tools, included in this MCP server, that ${config.backendDisplayName} may not execute. Takes precedence over Included Tools.`,
    mcpCommandDescription: `Command executed by ${config.backendDisplayName} to start the MCP server.`,
    projectsDescription: `All of your previous discussions with ${config.appDisplayName}, right here.`,
    oauthNotSupported:
      backend === "gemini"
        ? `Currently, authentication with OAuth through ${config.appDisplayName} isn't supported.`
        : `Currently, authentication with OAuth through ${config.appDisplayName} isn't supported when using the ${config.backendDisplayName} backend.`,
    loginNotSupportedTitle: `Login not supported in ${config.appDisplayName}`,
  };
};
