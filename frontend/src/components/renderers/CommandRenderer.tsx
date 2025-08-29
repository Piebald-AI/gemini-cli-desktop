import { useState } from "react";
import { Terminal, ChevronRight, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type ToolCall } from "../../utils/toolCallParser";
import { ToolInputParser } from "../../utils/toolInputParser";

interface CommandResult {
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  command?: string;
  message?: string;
  error?: string;
  output?: string; // Unified output field
}

interface CommandRendererProps {
  toolCall: ToolCall;
}

export function CommandRenderer({ toolCall }: CommandRendererProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  // Normalize result: accept string or structured object
  const isStringResult = typeof toolCall.result === "string";
  const result: CommandResult = isStringResult
    ? { output: toolCall.result as string }
    : (toolCall.result as CommandResult) || {};

  // Parse a compact, human-readable description
  const parsedInput = ToolInputParser.parseToolInput(toolCall);

  const exitCode = result.exit_code ?? 0;
  const isSuccess = exitCode === 0;

  // Output content
  const stdout = result.stdout || result.output || "";
  const stderr = result.stderr || result.error || "";
  const hasOutput = !!(stdout || stderr);

  // Status color for icon
  const iconColor =
    toolCall.status === "failed"
      ? "text-red-500"
      : toolCall.status === "completed"
        ? isSuccess
          ? "text-blue-500"
          : "text-red-500"
        : "text-blue-500";

  return (
    <div className="mt-4">
      {/* Compact one-line header, consistent with grep/glob/list/web */}
      <div
        className="flex items-center gap-2 text-sm px-2 py-1 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <Terminal className={`h-4 w-4 ${iconColor}`} />
        {parsedInput.formattedDescription ? (
          parsedInput.formattedDescription.parts.map((part, index) => (
            <span
              key={index}
              className={
                part.isHighlighted ? "text-muted-foreground font-mono" : ""
              }
            >
              {part.text}
            </span>
          ))
        ) : (
          <span>{parsedInput.description}</span>
        )}
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="ml-8 mt-2 space-y-3">
          {/* Status line */}
          <div className="text-xs text-muted-foreground">
            {isSuccess ? t("toolCalls.completed") : t("toolCalls.failed")}{" "}
            {Number.isFinite(exitCode) ? `(exit code: ${exitCode})` : ""}
          </div>

          {/* Stdout */}
          {stdout && (
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">Stdout</div>
              <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto border">
                <code className="text-foreground">{stdout}</code>
              </pre>
            </div>
          )}

          {/* Stderr */}
          {stderr && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <div className="text-sm font-medium text-foreground">
                  Stderr
                </div>
              </div>
              <pre className="bg-red-50 dark:bg-red-950/20 p-3 rounded-md text-sm overflow-x-auto border border-red-200 dark:border-red-800">
                <code className="text-red-800 dark:text-red-200">{stderr}</code>
              </pre>
            </div>
          )}

          {/* No output */}
          {!hasOutput && isSuccess && (
            <div className="text-sm text-muted-foreground">
              {t("toolCalls.completed")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
