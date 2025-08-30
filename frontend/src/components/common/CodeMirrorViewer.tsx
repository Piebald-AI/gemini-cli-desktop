import { useMemo, useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { xml } from "@codemirror/lang-xml";
import { languages } from "@codemirror/language-data";
import { Extension } from "@codemirror/state";
import { useTheme } from "next-themes";
import * as themes from "@uiw/codemirror-themes-all";

interface CodeMirrorViewerProps {
  code: string;
  language: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

// Language extension mapping
const getLanguageExtension = (language: string): Extension[] => {
  const lang = language.toLowerCase();

  switch (lang) {
    case "javascript":
    case "js":
    case "jsx":
      return [javascript({ jsx: true })];
    case "typescript":
    case "ts":
    case "tsx":
      return [javascript({ jsx: true, typescript: true })];
    case "python":
    case "py":
      return [python()];
    case "css":
      return [css()];
    case "html":
    case "htm":
      return [html()];
    case "json":
      return [json()];
    case "markdown":
    case "md":
      return [markdown({ codeLanguages: languages })];
    case "xml":
    case "svg":
      return [xml()];
    default:
      return [];
  }
};

export function CodeMirrorViewer({
  code,
  language,
  readOnly = true,
  onChange,
}: CodeMirrorViewerProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get the appropriate theme
  const theme = useMemo(() => {
    if (!mounted) return undefined;

    const isDark = resolvedTheme === "dark";

    if (isDark) {
      // Use a suitable dark theme
      return themes.githubDark || themes.dracula;
    } else {
      // Use a suitable light theme
      return themes.githubLight || themes.basicLight;
    }
  }, [resolvedTheme, mounted]);

  // Get language extensions
  const extensions = useMemo(() => {
    return getLanguageExtension(language);
  }, [language]);

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return (
      <div className="w-full p-4">
        <pre className="text-sm font-mono whitespace-pre-wrap">{code}</pre>
      </div>
    );
  }

  return (
    <div className="w-full">
      <CodeMirror
        value={code}
        theme={theme}
        extensions={extensions}
        readOnly={readOnly}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          dropCursor: false,
          allowMultipleSelections: false,
          indentOnInput: false,
          bracketMatching: true,
          closeBrackets: false,
          autocompletion: false,
          highlightSelectionMatches: false,
          searchKeymap: false,
        }}
        style={{
          fontSize: "14px",
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Menlo, "Liberation Mono", "Consolas", monospace',
        }}
      />
    </div>
  );
}
