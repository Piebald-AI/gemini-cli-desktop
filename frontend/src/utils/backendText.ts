import { BackendType } from "../types/backend";
import i18n from "../i18n";

// Backend configuration mapping - URLs and static data
const BACKEND_CONFIG = {
  gemini: {
    backendDownloadUrl: "https://github.com/google-gemini/gemini-cli",
  },
  qwen: {
    backendDownloadUrl: "https://github.com/qwenlm/qwen-code",
  },
  llxprt: {
    backendDownloadUrl: "https://github.com/Piebald-AI/llxprt-code",
  },
} as const;

/**
 * Get backend-specific text for UI display using i18n
 */
export const getBackendText = (backend: BackendType) => {
  const config = BACKEND_CONFIG[backend];
  const t = i18n.t;

  // Get backend-specific names from translations
  const backendDisplayName =
    backend === "qwen"
      ? t("backend.qwenCode")
      : backend === "llxprt"
        ? "LLxprt Code"
        : t(`backend.${backend}Cli`);
  const appDisplayName =
    backend === "llxprt"
      ? "LLxprt Desktop"
      : backend === "qwen"
        ? t("backend.qwenCodeDesktop")
        : t("backend.geminiCliDesktop");
  const backendShortname =
    backend === "llxprt" ? "LLxprt" : t(`backend.${backend}`);
  const backendModelFamilyNameOrTool =
    backend === "gemini"
      ? t("backend.gemini")
      : backend === "llxprt"
        ? "LLxprt Code"
        : t("backend.qwenCode");

  return {
    name: backendDisplayName,
    shortName: backendShortname,
    desktopName: appDisplayName,
    cliNotFound: t("warnings.cliNotFound", { backendName: backendDisplayName }),
    installMessage:
      backend === "gemini"
        ? t("backend.installMessageGemini", {
            backendName: backendDisplayName,
            downloadUrl: config.backendDownloadUrl,
          })
        : t("backend.installMessage", { backendName: backendDisplayName }),
    mcpCapabilities: t("backend.mcpCapabilities", {
      modelName: backendModelFamilyNameOrTool,
    }),
    mcpToolExecution: t("backend.mcpToolExecution", {
      backendName: backendDisplayName,
    }),
    mcpToolExclusion: t("backend.mcpToolExclusion", {
      backendName: backendDisplayName,
    }),
    mcpCommandDescription: t("backend.mcpCommandDescription", {
      backendName: backendDisplayName,
    }),
    projectsDescription: t("backend.projectsDescription", {
      appName: appDisplayName,
    }),
    oauthNotSupported:
      backend === "gemini"
        ? t("warnings.oauthNotSupported", { appName: appDisplayName })
        : t("warnings.oauthNotSupportedQwen", {
            appName: appDisplayName,
            backendName: backendDisplayName,
          }),
    loginNotSupportedTitle: t("warnings.loginNotSupported", {
      appName: appDisplayName,
    }),
    tagline: t("dashboard.tagline", { appName: backendDisplayName }),
    loginInstructions: t("warnings.loginInstructions"),
  };
};
