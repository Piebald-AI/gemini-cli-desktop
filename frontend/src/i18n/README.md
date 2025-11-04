# Internationalization (i18n) Guide

This document provides a comprehensive guide on how to use the internationalization system in the Gemini CLI Desktop frontend application.

## Overview

The application uses **react-i18next** for internationalization, supporting three languages:

- English (`en`) - Default language
- Simplified Chinese (`zh-CN`)
- Traditional Chinese (`zh-TW`)

## Quick Start

### Using Translations in Components

```tsx
import React from "react";
import { useTranslation } from "react-i18next";

const MyComponent: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t("common.loading")}</h1>
      <button>{t("common.save")}</button>
    </div>
  );
};
```

### Language Switching

```tsx
import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const LanguageSelector: React.FC = () => {
  const { currentLanguage, setLanguage, languageNames } = useLanguage();

  return (
    <div>
      <p>Current: {languageNames[currentLanguage]}</p>
      <button onClick={() => setLanguage("en")}>English</button>
      <button onClick={() => setLanguage("zh-CN")}>简体中文</button>
      <button onClick={() => setLanguage("zh-TW")}>繁體中文</button>
    </div>
  );
};
```

## Advanced Usage

### Interpolation

```tsx
// Simple interpolation
{
  t("validation.min_length", { min: 5 });
}
// → "Minimum length is 5 characters"

// Multiple variables
{
  t("projects.messages_count", { count: 42 });
}
// → "42 messages"
```

### Pluralization

```tsx
// Automatic pluralization based on count
{
  t("time.minutes_ago", { count: 1 });
} // → "1 minute ago"
{
  t("time.minutes_ago", { count: 5 });
} // → "5 minutes ago"
```

### Default Values

```tsx
// Provide fallback text for missing translations
{
  t("some.missing.key", { defaultValue: "Fallback text" });
}
```

### Namespacing

```tsx
// Access nested translation keys
{
  t("projects.title");
} // → "Projects"
{
  t("common.loading");
} // → "Loading..."
{
  t("mcp.server_name");
} // → "Server Name"
```

## File Structure

```
src/i18n/
├── index.ts                    # Main exports
├── config.ts                   # i18next configuration
├── README.md                   # This guide
└── locales/
    ├── en/
    │   └── translation.json    # English translations
    ├── zh-CN/
    │   └── translation.json    # Simplified Chinese
    └── zh-TW/
        └── translation.json    # Traditional Chinese
```

## Translation Keys Structure

Translation keys are organized by feature/component:

- `common.*` - Common UI elements (buttons, status, etc.)
- `navigation.*` - Navigation and routing
- `projects.*` - Project management
- `conversations.*` - Chat interface
- `mcp.*` - MCP server configuration
- `validation.*` - Form validation messages
- `errors.*` - Error messages
- `time.*` - Time and date formatting

### Example Key Structure

```json
{
  "common": {
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel"
  },
  "projects": {
    "title": "Projects",
    "add_project": "Add Project",
    "messages_count": "{{count}} messages"
  },
  "validation": {
    "required": "This field is required",
    "min_length": "Minimum length is {{min}} characters"
  }
}
```

## Best Practices

### 1. Key Naming

- Use descriptive, hierarchical keys: `feature.component.action`
- Use snake_case for consistency: `add_project`, `server_name`
- Group related keys under common prefixes

### 2. Translation Guidelines

- Keep translations concise and clear
- Use consistent terminology across languages
- Consider cultural context for Chinese translations
- Test translations in UI to ensure proper fitting

### 3. Adding New Translations

1. Add the key to all three translation files:
   - `locales/en/translation.json`
   - `locales/zh-CN/translation.json`
   - `locales/zh-TW/translation.json`

2. Use the key in your component:

   ```tsx
   {
     t("your.new.key");
   }
   ```

3. Test in all supported languages

### 4. Handling Missing Translations

- Always provide `defaultValue` for new or experimental keys
- The system will fallback to English if a translation is missing
- Check browser console for missing key warnings in development

## Components and Hooks

### useLanguage Hook

Custom hook providing language state and switching functionality:

```tsx
const {
  currentLanguage, // Current language code
  setLanguage, // Function to change language
  supportedLanguages, // Array of supported language codes
  languageNames, // Object mapping codes to display names
  isLoading, // Boolean indicating if i18n is initializing
} = useLanguage();
```

### LanguageSwitcher Component

Pre-built language switcher component:

```tsx
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";

<LanguageSwitcher variant="outline" showFlag={true} showText={true} />;
```

## Configuration

### Browser Language Detection

The system automatically detects the user's preferred language based on:

1. Previously saved preference (localStorage)
2. Browser language settings
3. HTML lang attribute
4. Fallback to English

### Storage

Language preferences are automatically saved to localStorage with the key `gemini-cli-desktop-language`.

### Development Mode

In development mode, missing translation keys are logged to the console for easy debugging.

## Testing

### Manual Testing

1. Switch between languages using the language switcher
2. Verify all text updates correctly
3. Check for layout issues with longer translations
4. Test interpolation with different values

### Automated Testing

```tsx
import { render } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";

// Test component with i18n
const renderWithI18n = (component: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);
};
```

## Troubleshooting

### Common Issues

1. **Missing translations**: Check console for warnings, provide defaultValue
2. **Interpolation not working**: Ensure variable names match in all languages
3. **Language not switching**: Verify language code is supported
4. **Layout broken**: Check if translated text is too long for container

### Debug Mode

Enable debug mode in development by setting `debug: true` in `i18n/config.ts`.

## Migration Guide

### From Custom Translation System

If migrating from a custom translation system:

1. Replace custom `t()` function calls with `useTranslation()` hook
2. Update translation key structure to match new format
3. Move translations from TypeScript objects to JSON files
4. Update language switching logic to use `useLanguage()` hook

### Example Migration

**Before:**

```tsx
import { useLanguage } from "@/contexts/LanguageContext";
const { t } = useLanguage();
```

**After:**

```tsx
import { useTranslation } from "react-i18next";
const { t } = useTranslation();
```

## Performance Considerations

- Translations are loaded synchronously at startup
- Language switching is immediate (no async loading)
- Translation files are bundled with the application
- Consider lazy loading for larger applications with many languages

## Contributing

When contributing translations:

1. Ensure accuracy and cultural appropriateness
2. Maintain consistent terminology
3. Test in actual UI components
4. Consider text expansion in different languages
5. Update all three language files simultaneously
