import { useState } from "react";
import { Globe, ChevronRight, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type ToolCall } from "../../utils/toolCallParser";

interface WebToolResult {
  markdown?: string;
  message?: string;
}

interface WebToolRendererProps {
  toolCall: ToolCall;
}

export function WebToolRenderer({ toolCall }: WebToolRendererProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const result = toolCall.result as WebToolResult;

  // Detect tool type
  const isWebSearch =
    toolCall.name === "google_web_search" ||
    (toolCall.label &&
      toolCall.label.toLowerCase().includes("searching the web"));

  const isWebFetch =
    toolCall.name === "web_fetch" ||
    (toolCall.label &&
      toolCall.label.toLowerCase().includes("processing urls"));

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
    return isWebSearch
      ? t("toolCalls.webSearchCompleted")
      : t("toolCalls.webFetchCompleted");
  };

  // Get description for the tool
  const getDescription = (): string => {
    if (isWebSearch) {
      // Extract query from label or parameters
      const query =
        toolCall.label?.match(/Searching the web for: "([^"]+)"/)?.[1] ||
        "query";
      const verb =
        toolCall.status === "running"
          ? t("toolCalls.searching")
          : t("toolCalls.searched");
      return `${verb} web for "${query}"`;
    } else if (isWebFetch) {
      // Extract URL from label or parameters
      let displayUrl = "URL";

      if (toolCall.label) {
        // Look for URLs in the label using a more comprehensive approach
        const urlMatches = toolCall.label.match(/https?:\/\/[^\s"']+/g);
        if (urlMatches && urlMatches.length > 0) {
          // Use the first URL found, or show count if multiple
          if (urlMatches.length === 1) {
            displayUrl = urlMatches[0];
          } else {
            displayUrl = `${urlMatches.length} URLs`;
          }
        } else if (toolCall.label.toLowerCase().includes("processing urls")) {
          // If no direct URLs found but mentions processing URLs, use generic text
          displayUrl = "URLs from prompt";
        }
      }

      const verb =
        toolCall.status === "running"
          ? t("toolCalls.fetchingContent")
          : t("toolCalls.fetchedContent");
      return `${verb} content from ${displayUrl}`;
    }
    return toolCall.status === "running"
      ? "Web operation in progress"
      : "Web operation completed";
  };

  const summary = getSummary();
  const description = getDescription();

  // Choose icon - spinner when running, globe when completed
  const renderIcon = () => {
    if (toolCall.status === "running") {
      return <Loader2 className="animate-spin h-4 w-4 text-blue-500" />;
    }
    return <Globe className="h-4 w-4 text-blue-500" />;
  };

  return (
    <div className="mt-4">
      <div
        className="flex items-center gap-2 text-sm px-2 py-1 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {renderIcon()}
        <span>{description}</span>
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
