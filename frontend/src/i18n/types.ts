/**
 * Type definitions for i18n translation keys
 * This file provides type safety for translation keys
 */

// Import the English translation file to extract types
import type en from './locales/en/translation.json';

// Helper type to create dot-notation keys from nested objects
type DotNotation<T, K extends keyof T = keyof T> = K extends string
  ? T[K] extends Record<string, any>
    ? `${K}.${DotNotation<T[K]>}`
    : K
  : never;

// Extract all possible translation keys
export type TranslationKey = DotNotation<typeof en>;

// Type for translation parameters
export interface TranslationParams {
  [key: string]: string | number | boolean | undefined;
}

// Type-safe translation function interface
export interface TypeSafeTranslation {
  (key: TranslationKey, params?: TranslationParams): string;
  (key: string, options?: { defaultValue?: string } & TranslationParams): string;
}

// Common translation key groups for easy access
export type CommonKeys = Extract<TranslationKey, `common.${string}`>;
export type NavigationKeys = Extract<TranslationKey, `navigation.${string}`>;
export type ProjectKeys = Extract<TranslationKey, `projects.${string}`>;
export type ConversationKeys = Extract<TranslationKey, `conversations.${string}`>;
export type McpKeys = Extract<TranslationKey, `mcp.${string}`>;
export type ValidationKeys = Extract<TranslationKey, `validation.${string}`>;
export type ErrorKeys = Extract<TranslationKey, `errors.${string}`>;
export type TimeKeys = Extract<TranslationKey, `time.${string}`>;

// Utility type for components that need specific translation keys
export interface TranslationProps<T extends TranslationKey = TranslationKey> {
  translationKey?: T;
  translationParams?: TranslationParams;
}

// Hook return type with type-safe translation function
export interface TypeSafeUseTranslation {
  t: TypeSafeTranslation;
  i18n: any;
  ready: boolean;
}

// Example usage in components:
/*
import type { CommonKeys, TypeSafeTranslation } from '@/i18n/types';

interface ButtonProps {
  labelKey: CommonKeys;
  onClick: () => void;
}

const TypeSafeButton: React.FC<ButtonProps> = ({ labelKey, onClick }) => {
  const { t }: { t: TypeSafeTranslation } = useTranslation();
  
  return (
    <button onClick={onClick}>
      {t(labelKey)}
    </button>
  );
};
*/