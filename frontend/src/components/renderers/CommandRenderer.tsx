import { Terminal, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type ToolCall } from "../../utils/toolCallParser";

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
  const result = toolCall.result as CommandResult;

  // Extract command from input
  const getCommand = (): string => {
    try {
      if (toolCall.inputJsonRpc) {
        const input = JSON.parse(toolCall.inputJsonRpc);
        return input.params?.command || input.params?.cmd || "unknown command";
      }
    } catch {
      // Intentionally ignore parse errors
    }
    return result.command || "unknown command";
  };

  const command = getCommand();
  const exitCode = result.exit_code ?? 0;
  const isSuccess = exitCode === 0;

  // Get output content
  const stdout = result.stdout || result.output || "";
  const stderr = result.stderr || result.error || "";
  const hasOutput = stdout || stderr;

  // Determine status and icon
  const getStatusInfo = () => {
    if (isSuccess && hasOutput) {
      return {
        icon: CheckCircle,
        color: "text-green-500",
        bgColor: "bg-green-50 dark:bg-green-950/20",
        borderColor: "border-green-200 dark:border-green-800",
        label: t("toolCalls.success"),
      };
    } else if (isSuccess && !hasOutput) {
      return {
        icon: CheckCircle,
        color: "text-green-500",
        bgColor: "bg-green-50 dark:bg-green-950/20",
        borderColor: "border-green-200 dark:border-green-800",
        label: t("toolCalls.completed"),
      };
    } else {
      return {
        icon: XCircle,
        color: "text-red-500",
        bgColor: "bg-red-50 dark:bg-red-950/20",
        borderColor: "border-red-200 dark:border-red-800",
        label: t("toolCalls.failed"),
      };
    }
  };

  const status = getStatusInfo();
  const StatusIcon = status.icon;

  return (
    <div className="mt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-muted-foreground" />
        <div className="text-sm">
          <span className="font-medium">Command Execution</span>
          <div className="text-xs text-muted-foreground font-mono mt-1">
            {command}
          </div>
        </div>
      </div>

      {/* Status */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-md ${status.bgColor} ${status.borderColor} border`}
      >
        <StatusIcon className={`h-4 w-4 ${status.color}`} />
        <span className="text-sm font-medium">{status.label}</span>
        {exitCode !== undefined && (
          <span className="text-xs text-muted-foreground">
            (exit code: {exitCode})
          </span>
        )}
      </div>

      {/* Output sections */}
      {stdout && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-foreground">
              Standard Output
            </div>
          </div>
          <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto border">
            <code className="text-foreground">{stdout}</code>
          </pre>
        </div>
      )}

      {stderr && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <div className="text-sm font-medium text-foreground">
              Standard Error
            </div>
          </div>
          <pre className="bg-red-50 dark:bg-red-950/20 p-3 rounded-md text-sm overflow-x-auto border border-red-200 dark:border-red-800">
            <code className="text-red-800 dark:text-red-200">{stderr}</code>
          </pre>
        </div>
      )}

      {/* Message fallback */}
      {!hasOutput && result.message && (
        <div className="text-sm text-muted-foreground p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
          {result.message}
        </div>
      )}

      {/* No output indicator */}
      {!hasOutput && !result.message && isSuccess && (
        <div className="text-sm text-muted-foreground p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-center">
          Command completed with no output
        </div>
      )}
    </div>
  );
}
