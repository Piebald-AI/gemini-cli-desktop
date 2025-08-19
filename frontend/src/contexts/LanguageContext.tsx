import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { supportedLanguages, languageNames, type SupportedLanguage } from '../i18n/config';

interface LanguageContextType {
  currentLanguage: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  supportedLanguages: readonly SupportedLanguage[];
  languageNames: Record<SupportedLanguage, string>;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

/**
 * LanguageProvider component that integrates with react-i18next
 * Provides language switching functionality and state management
 */
export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  
  // Get current language from i18next
  const currentLanguage = (i18n.language || 'en') as SupportedLanguage;
  
  // Check if i18next is still loading
  const isLoading = !i18n.isInitialized;

  /**
   * Change the current language
   * Updates i18next language and persists to localStorage
   */
  const setLanguage = async (language: SupportedLanguage) => {
    try {
      await i18n.changeLanguage(language);
      // Update HTML lang attribute for accessibility
      document.documentElement.lang = language;
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  };

  // Update HTML lang attribute when language changes
  useEffect(() => {
    if (currentLanguage) {
      document.documentElement.lang = currentLanguage;
    }
  }, [currentLanguage]);

  const contextValue: LanguageContextType = {
    currentLanguage,
    setLanguage,
    supportedLanguages,
    languageNames,
    isLoading,
  };

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

/**
 * Hook to access language context
 * Must be used within a LanguageProvider
 */
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

/**
 * Type exports for convenience
 */
export type { SupportedLanguage };
export { supportedLanguages, languageNames };