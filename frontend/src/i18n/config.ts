import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Import translation resources
import en from "./locales/en/translation.json";
import zhCN from "./locales/zh-CN/translation.json";
import zhTW from "./locales/zh-TW/translation.json";

// Define supported languages
export const supportedLanguages = ["en", "zh-CN", "zh-TW"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

// Language names for display
export const languageNames: Record<SupportedLanguage, string> = {
  en: "English",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
};

// Translation resources
const resources = {
  en: {
    translation: en,
  },
  "zh-CN": {
    translation: zhCN,
  },
  "zh-TW": {
    translation: zhTW,
  },
};

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",

    // Language detection options
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "gemini-cli-desktop-language",
      caches: ["localStorage"],
    },

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // Development options
    debug: import.meta.env.DEV,

    // React options
    react: {
      useSuspense: false, // Disable suspense for SSR compatibility
    },

    // Language whitelist
    supportedLngs: supportedLanguages,
    nonExplicitSupportedLngs: false, // Don't try to load 'zh' when 'zh-TW' is requested

    // Load options
    load: "currentOnly", // Don't load fallback languages, only the exact match
  });

// Export configured i18n instance
export default i18n;
