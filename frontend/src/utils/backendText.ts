import { BackendType } from "../types/backend";
import i18n from '../i18n';

// Backend configuration mapping - URLs and static data
const BACKEND_CONFIG = {
  gemini: {
    backendDownloadUrl: "https://github.com/google-gemini/gemini-cli",
  },
  qwen: {
    backendDownloadUrl: "https://github.com/qwenlm/qwen-code",
  },
} as const;

/**
 * Get backend-specific text for UI display using i18n
 */
export const getBackendText = (backend: BackendType) => {
  const config = BACKEND_CONFIG[backend];
  const t = i18n.t;

  // Get backend-specific names from translations
  const backendDisplayName = t(`backend.${backend}Cli`);
  const appDisplayName = t(`backend.${backend}Desktop`);
  const backendShortname = t(`backend.${backend}`);
  const backendModelFamilyNameOrTool = backend === "gemini" ? t('backend.gemini') : t('backend.qwenCode');

  return {
    name: backendDisplayName,
    shortName: backendShortname,
    desktopName: appDisplayName,
    cliNotFound: t('warnings.cliNotFound', { backendName: backendDisplayName }),
    installMessage:
      backend === "gemini"
        ? t('backend.installMessageGemini', { 
            backendName: backendDisplayName,
            downloadUrl: config.backendDownloadUrl 
          })
        : t('backend.installMessage', { backendName: backendDisplayName }),
    mcpCapabilities: t('backend.mcpCapabilities', { modelName: backendModelFamilyNameOrTool }),
    mcpToolExecution: t('backend.mcpToolExecution', { backendName: backendDisplayName }),
    mcpToolExclusion: t('backend.mcpToolExclusion', { backendName: backendDisplayName }),
    mcpCommandDescription: t('backend.mcpCommandDescription', { backendName: backendDisplayName }),
    projectsDescription: t('backend.projectsDescription', { appName: appDisplayName }),
    oauthNotSupported:
      backend === "gemini"
        ? t('warnings.oauthNotSupported', { appName: appDisplayName })
        : t('warnings.oauthNotSupportedQwen', { 
            appName: appDisplayName, 
            backendName: backendDisplayName 
          }),
    loginNotSupportedTitle: t('warnings.loginNotSupported', { appName: appDisplayName }),
  };
};
