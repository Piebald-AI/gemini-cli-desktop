import React from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import {
  type BundledLanguage,
  bundledLanguages,
  bundledThemes,
  createHighlighter,
} from "shiki/bundle/full";

const LANGUAGE_MAPPINGS: Record<string, string> = {
  "c++": "cpp",
};

// Global cache to persist across all component instances
const highlightCache = new Map<
  string,
  { content: React.ReactElement; preStyle: string }
>();

// Create single global highlighter instance
const highlighterPromise = createHighlighter({
  themes: Object.keys(bundledThemes),
  langs: [], // Start with no languages - load on demand
});

// Language detection utility
export const getLanguageFromFileName = (fileName?: string): string => {
  if (!fileName) return "text";

  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension) return "text";

  const languageMap: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    json: "json",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    fish: "bash",
    sql: "sql",
    dockerfile: "dockerfile",
    toml: "toml",
    ini: "ini",
    conf: "ini",
  };

  return languageMap[extension] || "text";
};

// Map language through LANGUAGE_MAPPINGS
const mapLanguage = (language: string): string => {
  if (!language || language.trim() === "") {
    return "text";
  }
  return language in LANGUAGE_MAPPINGS ? LANGUAGE_MAPPINGS[language] : language;
};

// Create fallback content (plain text with line breaks preserved)
const createFallbackContent = (code: string): React.ReactElement => {
  const lines = code.split("\n");
  return React.createElement(
    "pre",
    { style: { margin: 0, padding: 0, backgroundColor: "transparent" } },
    lines.map((line, idx) =>
      React.createElement("div", { key: idx, className: "line" }, line)
    )
  );
};

export interface HighlightOptions {
  theme?: "light" | "dark";
  removeBackground?: boolean;
}

export interface HighlightResult {
  content: React.ReactElement;
  preStyle: string;
}

/**
 * Highlight code asynchronously and return React elements
 * Uses global caching to avoid re-highlighting the same content
 */
export const highlightCode = async (
  code: string,
  language: string,
  options: HighlightOptions = {}
): Promise<HighlightResult> => {
  const { theme = "light", removeBackground = false } = options;
  const mappedLanguage = mapLanguage(language);

  // Create cache key
  const lightTheme = "github-light";
  const darkTheme = "github-dark";
  const currentTheme = theme === "dark" ? darkTheme : lightTheme;
  const cacheKey = `${code}-${language}-${mappedLanguage}-${currentTheme}-${removeBackground}`;

  // Check cache first
  const cached = highlightCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Wait for highlighter to be ready
    const highlighter = await highlighterPromise;

    // Clear conflicting cache entries to prevent bloat
    const conflictingKeys = Array.from(highlightCache.keys()).filter(
      (key) =>
        key.startsWith(`${code}-${language}-${mappedLanguage}-`) &&
        key !== cacheKey
    );
    conflictingKeys.forEach((key) => highlightCache.delete(key));

    // Load language if not already loaded
    if (
      mappedLanguage !== "text" &&
      !highlighter.getLoadedLanguages().includes(mappedLanguage)
    ) {
      try {
        await highlighter.loadLanguage(mappedLanguage as BundledLanguage);
      } catch {
        // Ignore errors - Shiki will use 'text' language for non-existent languages
      }
    }

    // Check if the language is valid before attempting to highlight
    const validLanguage =
      mappedLanguage in bundledLanguages
        ? (mappedLanguage as BundledLanguage)
        : ("text" as BundledLanguage);

    let capturedPreStyle = "";

    // Generate HAST (HTML AST) from code
    const hast = highlighter.codeToHast(code, {
      lang: validLanguage,
      theme: currentTheme,
      transformers: [
        {
          pre: (node: { properties?: { style?: string } }) => {
            if (node.properties?.style) {
              capturedPreStyle = node.properties?.style as string;
              if (removeBackground) {
                // Remove background-color from pre element as well
                const style = node.properties.style as string;
                const cleanStyle = style
                  .replace(/background-color:[^;]+;?/g, "")
                  .replace(/background:[^;]+;?/g, "");
                node.properties.style = cleanStyle;
              }
            }
          },
          ...(removeBackground
            ? [
                {
                  span: (node: { properties?: { style?: string } }) => {
                    if (node.properties?.style) {
                      const style = node.properties.style as string;
                      // Remove background-color and background but keep other styles like color
                      const cleanStyle = style
                        .replace(/background-color:[^;]+;?/g, "")
                        .replace(/background:[^;]+;?/g, "");
                      node.properties.style = cleanStyle;
                    }
                  },
                },
              ]
            : []),
        },
      ],
    });

    // Convert HAST to React element
    const highlighted = toJsxRuntime(hast, {
      Fragment,
      jsx,
      jsxs,
    }) as React.ReactElement;

    const result: HighlightResult = {
      content: highlighted,
      preStyle: capturedPreStyle,
    };

    // Cache the result
    highlightCache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.warn(
      `Failed to highlight code with language "${mappedLanguage}":`,
      error
    );

    // Use fallback content on error
    const fallback = createFallbackContent(code);
    const result: HighlightResult = {
      content: fallback,
      preStyle: "",
    };

    highlightCache.set(cacheKey, result);
    return result;
  }
};

/**
 * Synchronously get highlighted content if already cached, otherwise return fallback
 * Useful for cases where you need immediate content
 */
export const getHighlightedContentSync = (
  code: string,
  language: string,
  options: HighlightOptions = {}
): HighlightResult => {
  const { theme = "light", removeBackground = false } = options;
  const mappedLanguage = mapLanguage(language);

  // Create cache key (same logic as async version)
  const lightTheme = "github-light";
  const darkTheme = "github-dark";
  const currentTheme = theme === "dark" ? darkTheme : lightTheme;
  const cacheKey = `${code}-${language}-${mappedLanguage}-${currentTheme}-${removeBackground}`;

  // Check cache
  const cached = highlightCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Return fallback if not cached
  return {
    content: createFallbackContent(code),
    preStyle: "",
  };
};

/**
 * Clear the highlight cache (useful for testing or memory management)
 */
export const clearHighlightCache = (): void => {
  highlightCache.clear();
};

/**
 * Get cache size (useful for debugging)
 */
export const getHighlightCacheSize = (): number => {
  return highlightCache.size;
};
