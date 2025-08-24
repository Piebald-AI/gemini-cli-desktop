import { useState } from "react";
import { ChevronRight, FolderClosed } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type ToolCall } from "../../utils/toolCallParser";

interface DirectoryResult {
  markdown?: string;
  message?: string;
}

interface DirectoryRendererProps {
  toolCall: ToolCall;
}

export function DirectoryRenderer({ toolCall }: DirectoryRendererProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const result = toolCall.result as DirectoryResult;

  // Extract path from input JSON-RPC
  const getPath = (): string => {
    try {
      if (toolCall.inputJsonRpc) {
        const input = JSON.parse(toolCall.inputJsonRpc);
        return input.params?.path || input.params?.locations?.[0] || ".";
      }
    } catch {
      // Intentionally ignore parse errors
    }
    return ".";
  };

  // Get the summary message from the result
  const getSummary = (): string => {
    if (typeof result === "string") {
      return result;
    }
    if (result && typeof result === "object") {
      if ("markdown" in result && result.markdown) {
        return result.markdown;
      }
      if ("message" in result && result.message) {
        return result.message;
      }
    }
    return t("toolCalls.listedDirectory");
  };

  const path = getPath();
  const displayPath = path === "." ? t("common.currentDirectory") : path;
  const summary = getSummary();

  return (
    <div className="mt-4">
      <div
        className="flex items-center gap-2 text-sm px-2 py-1 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <FolderClosed className="h-4 w-4 text-blue-500" />
        <span>Listed </span>
        <span className="text-muted-foreground">{displayPath}</span>
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
      </div>
      {isExpanded && (
        <div className="ml-8 text-sm text-muted-foreground">{summary}</div>
      )}
    </div>
  );
}
