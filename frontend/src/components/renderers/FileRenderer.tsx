import { FileText, Copy } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type ToolCall } from "../../utils/toolCallParser";
import { Button } from "../ui/button";

interface FileResult {
  content?: string;
  path?: string;
  size?: number;
  modified?: number;
  encoding?: string;
  message?: string;
  error?: string;
}

interface FileRendererProps {
  toolCall: ToolCall;
}

export function FileRenderer({ toolCall }: FileRendererProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const result = toolCall.result as FileResult;

  // Extract file path from input
  const getFilePath = (): string => {
    try {
      if (toolCall.inputJsonRpc) {
        const input = JSON.parse(toolCall.inputJsonRpc);
        return input.params?.file || input.params?.path || t("common.unknownFile");
      }
    } catch {
      // Intentionally ignore parse errors
    }
    return result.path || t("common.unknownFile");
  };

  // Format file size
  const formatSize = (bytes?: number): string => {
    if (!bytes) return t("common.unknownSize");
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
  };

  // Format modified time
  const formatTime = (timestamp?: number): string => {
    if (!timestamp) return "unknown";
    return new Date(timestamp * 1000).toLocaleString();
  };

  // Copy content to clipboard
  const copyContent = async () => {
    if (!result.content) return;

    try {
      await navigator.clipboard.writeText(result.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
    }
  };

  // Detect file type for syntax highlighting hint
  const getFileType = (path: string): string => {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    const typeMap: Record<string, string> = {
      js: "javascript",
      ts: "typescript",
      jsx: "javascript",
      tsx: "typescript",
      py: "python",
      json: "json",
      md: "markdown",
      html: "html",
      css: "css",
      yml: "yaml",
      yaml: "yaml",
      xml: "xml",
      sh: "bash",
      bash: "bash",
    };
    return typeMap[ext] || "text";
  };

  const filePath = getFilePath();
  const fileType = getFileType(filePath);
  const content = result.content || "";
  const lineCount = content.split("\n").length;

  return (
    <div className="mt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500" />
          <div className="text-sm">
            <div className="font-medium font-mono">{filePath}</div>
            <div className="text-xs text-muted-foreground">
              {formatSize(result.size)} • {lineCount} lines •{" "}
              {result.encoding || "UTF-8"}
              {result.modified && ` • Modified ${formatTime(result.modified)}`}
            </div>
          </div>
        </div>

        {content && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={copyContent}
              className="text-xs"
            >
              <Copy className="h-3 w-3 mr-1" />
              {copied ? t("common.copied") : t("common.copy")}
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      {content ? (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 border-b text-xs text-muted-foreground">
            {fileType} • {lineCount} lines
          </div>
          <pre className="p-4 text-sm overflow-x-auto max-h-96">
            <code className="text-foreground">{content}</code>
          </pre>
        </div>
      ) : result.error ? (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="text-sm text-red-800 dark:text-red-200">
            {result.error}
          </div>
        </div>
      ) : result.message ? (
        <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">
          {result.message}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md text-center">
          {t("toolCalls.fileContentNotAvailable")}
        </div>
      )}
    </div>
  );
}
