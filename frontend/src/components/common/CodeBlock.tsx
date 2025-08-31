"use client";

import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  useLayoutEffect,
  type JSX,
} from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { type BundledLanguage, createHighlighter } from "shiki/bundle/full";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useTheme } from "next-themes";

const LANGUAGE_MAPPINGS: Record<string, string> = {
  "c++": "cpp",
};

// Default themes to use when no custom theme is available
const DEFAULT_THEMES = ["github-dark", "github-light"];

// Utility function to convert CSS string to React style object
const cssStringToObject = (cssString: string): React.CSSProperties => {
  const styleObject: React.CSSProperties = {};

  // Split by semicolon and process each declaration
  cssString.split(";").forEach((declaration) => {
    const [property, value] = declaration.split(":").map((s) => s.trim());

    if (property && value) {
      let processedProperty: string;
      let processedValue: string | number = value;

      // Handle CSS variables (custom properties starting with --)
      if (property.startsWith("--")) {
        // CSS variables should remain as-is
        processedProperty = property;
        // CSS variable values should always be strings
        processedValue = value;
      } else {
        // Convert kebab-case to camelCase for regular CSS properties
        processedProperty = property.replace(/-([a-z])/g, (_, letter) =>
          letter.toUpperCase()
        );

        // Handle values containing CSS variables (var()) - keep as strings
        if (value.includes("var(")) {
          processedValue = value;
        }
        // Convert pixel values to numbers if they're just numbers + 'px'
        else if (value.endsWith("px") && !isNaN(Number(value.slice(0, -2)))) {
          processedValue = Number(value.slice(0, -2));
        }
        // Keep other values as strings
        else {
          processedValue = value;
        }
      }

      (styleObject as Record<string, string | number>)[processedProperty] =
        processedValue;
    }
  });

  return styleObject;
};

// Global cache to persist across component instances
const highlightCache = new Map<
  string,
  { content: React.ReactElement; preStyle: string }
>();

// Create highlighter instance with default themes
const highlighterPromise = createHighlighter({
  themes: DEFAULT_THEMES,
  langs: [], // Start with no languages - load on demand
});

const CodeBlock = React.memo(
  ({ code, language }: { code: string; language: string }) => {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      setMounted(true);
    }, []);

    // Default themes based on current theme
    const lightTheme = "github-light";
    const darkTheme = "github-dark";
    const currentTheme = resolvedTheme === "dark" ? darkTheme : lightTheme;

    // Memoize the mapping to prevent unnecessary effect triggers
    const mappedLanguage = useMemo(() => {
      if (!language?.trim()) return "text";
      return LANGUAGE_MAPPINGS[language] || language;
    }, [language]);

    // Create cache key based on actual code
    const cacheKey = useMemo(() => {
      return `${code}-${language}-${mappedLanguage}-${currentTheme}`;
    }, [code, language, mappedLanguage, currentTheme]);

    // Create fallback content (plain code) - memoized to prevent unnecessary re-creation
    const createFallback = useCallback(() => {
      const lines = code.split("\n");
      return (
        <pre>
          {lines.map((line, idx) => (
            <div className="line" key={idx}>
              {line}
            </div>
          ))}
        </pre>
      );
    }, [code]);

    // Initialize state with null to indicate loading
    const [highlightedContent, setHighlightedContent] =
      useState<React.ReactElement | null>(null);
    const [preStyle, setPreStyle] = useState<string>("");

    useEffect(() => {
      let cancelled = false;

      async function highlight() {
        // Check if we have cached content for this specific key
        const cached = highlightCache.get(cacheKey);
        if (cached) {
          setHighlightedContent(cached.content);
          setPreStyle(cached.preStyle);
          setIsLoading(false);
          return;
        }

        try {
          // Wait for highlighter to be ready
          const highlighter = await highlighterPromise;

          // Load language if not already loaded
          if (
            mappedLanguage !== "text" &&
            !highlighter.getLoadedLanguages().includes(mappedLanguage)
          ) {
            try {
              await highlighter.loadLanguage(mappedLanguage as BundledLanguage);
            } catch {
              // Ignore errors - Shiki will just not highlight for non-existent languages
            }

            if (cancelled) return;
          }

          let capturedPreStyle = "";

          const hast = highlighter.codeToHast(code, {
            lang: mappedLanguage,
            theme: currentTheme,
            transformers: [
              {
                pre: (node: { properties?: { style?: string } }) => {
                  if (node.properties?.style) {
                    capturedPreStyle = node.properties?.style as string;
                  }
                },
              },
            ],
          });

          if (cancelled) return;

          const highlighted = toJsxRuntime(hast, {
            Fragment,
            jsx,
            jsxs,
          }) as JSX.Element;

          // Cache the result for future use
          highlightCache.set(cacheKey, {
            content: highlighted,
            preStyle: capturedPreStyle,
          });

          if (!cancelled) {
            setHighlightedContent(highlighted);
            setPreStyle(capturedPreStyle);
            setIsLoading(false);
          }
        } catch (error) {
          if (cancelled) return;

          console.warn(
            `Failed to highlight code with language "${mappedLanguage}":`,
            error
          );

          // Use fallback content on error
          const fallback = createFallback();
          highlightCache.set(cacheKey, {
            content: fallback,
            preStyle: "",
          });

          setHighlightedContent(fallback);
          setPreStyle("");
          setIsLoading(false);
        }
      }

      highlight();

      return () => {
        cancelled = true;
      };
    }, [cacheKey, mappedLanguage, createFallback, currentTheme, code]);

    // Memoize the style object to prevent unnecessary re-renders
    const memoizedStyle = useMemo(
      () => cssStringToObject(preStyle),
      [preStyle]
    );

    // Preserve scroll position of the code block while content streams in.
    // Without this, each highlightedContent update may reset the scroll to top,
    // preventing the user from scrolling down during generation.
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const scrollStateRef = useRef<{
      top: number;
      height: number;
      atBottom: boolean;
    }>({
      top: 0,
      height: 0,
      atBottom: true,
    });

    const isAtBottom = (el: HTMLElement) =>
      el.scrollHeight - (el.scrollTop + el.clientHeight) < 4;

    const handleScroll = () => {
      const el = scrollContainerRef.current;
      if (!el) return;
      scrollStateRef.current = {
        top: el.scrollTop,
        height: el.scrollHeight,
        atBottom: isAtBottom(el),
      };
    };

    // Initialize scroll snapshot on mount
    useEffect(() => {
      const el = scrollContainerRef.current;
      if (!el) return;
      scrollStateRef.current = {
        top: el.scrollTop,
        height: el.scrollHeight,
        atBottom: isAtBottom(el),
      };
    }, []);

    // After content updates, restore the user's scroll position.
    // - If user was at bottom, keep them pinned to bottom.
    // - Otherwise, preserve their previous scrollTop (and account for height deltas).
    useLayoutEffect(() => {
      const el = scrollContainerRef.current;
      if (!el) return;

      const prev = scrollStateRef.current;
      const prevHeight = prev.height;
      const newHeight = el.scrollHeight;

      if (prev.atBottom) {
        // Stick to bottom while streaming
        el.scrollTop = el.scrollHeight;
      } else {
        // Preserve user's view; if content grew, adjust to keep the same content in view
        const delta = newHeight - prevHeight;
        const targetTop = Math.max(
          0,
          Math.min(
            prev.top + (delta > 0 ? delta : 0),
            el.scrollHeight - el.clientHeight
          )
        );
        el.scrollTop = targetTop;
      }

      // Update snapshot post-adjustment
      scrollStateRef.current = {
        top: el.scrollTop,
        height: el.scrollHeight,
        atBottom: isAtBottom(el),
      };
    }, [code, highlightedContent, isLoading]);

    if (!mounted) {
      return null;
    }

    // Show fallback content while loading, or highlighted content when ready
    const contentToRender = isLoading
      ? createFallback()
      : highlightedContent || createFallback();

    // Always render the container to prevent layout shift
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "shiki font-mono overflow-hidden max-h-96 border border-current/10 rounded-md text-sm my-4",
              "leading-normal [counter-increment:a_0] [&_.line]:before:[counter-increment:a] [&_.line]:before:content-[counter(a)]",
              "[&_.line]:before:mr-6 [&_.line]:before:ml-3 [&_.line]:before:inline-block [&_.line]:before:text-right",
              "[&_.line]:before:text-black/40 dark:[&_.line]:before:text-white/40 [&_.line]:before:min-w-8",
              "max-w-full min-w-0 overflow-x-auto"
            )}
            style={memoizedStyle}
          >
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="overflow-auto max-h-96 p-2 [&_pre]:focus-visible:outline-none [&_pre]:whitespace-pre [&_pre]:leading-normal"
            >
              {contentToRender}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-40">
          <ContextMenuItem
            onClick={() => navigator.clipboard.writeText(code)}
            className="flex items-center gap-2"
          >
            <Copy />
            Copy code
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }
);

CodeBlock.displayName = "CodeBlock";

export default CodeBlock;
