// Export the configured i18n instance and utilities
export { default } from "./config";
export {
  supportedLanguages,
  languageNames,
  type SupportedLanguage,
} from "./config";

// Re-export commonly used react-i18next functions for convenience
export { useTranslation, Trans, Translation } from "react-i18next";

// Import the type for use in function definitions
import type { SupportedLanguage } from "./config";

// Export language detection utility
export const isValidLanguage = (lang: string): lang is SupportedLanguage => {
  return ["en", "zh-CN", "zh-TW", "ru"].includes(lang);
};

// Export language display utility
export const getLanguageDisplayName = (lang: SupportedLanguage): string => {
  const names: Record<SupportedLanguage, string> = {
    en: "English",
    "zh-CN": "简体中文",
    "zh-TW": "繁體中文",
    ru: "Русский",
  };
  return names[lang];
};
