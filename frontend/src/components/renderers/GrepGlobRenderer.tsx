import { useState } from "react";
import { ChevronRight, Search, Regex } from "lucide-react";
import { type ToolCall } from "../../utils/toolCallParser";
import { ToolInputParser } from "../../utils/toolInputParser";

interface GrepGlobResult {
  markdown?: string;
  message?: string;
}

interface GrepGlobRendererProps {
  toolCall: ToolCall;
}

export function GrepGlobRenderer({ toolCall }: GrepGlobRendererProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const result = toolCall.result as GrepGlobResult;

  // Parse the tool input to get formatted description
  const parsedInput = ToolInputParser.parseToolInput(toolCall);

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

    // Handle case where there's no result (empty search)
    if (!result) {
      return "No matches found";
    }

    return "Search completed";
  };

  const summary = getSummary();

  // Choose icon based on tool type
  const getIcon = () => {
    if (toolCall.name === "glob") {
      return Regex;
    }
    return Search; // Default for grep and other search tools
  };

  const IconComponent = getIcon();

  return (
    <div className="mt-4">
      <div
        className="flex items-center gap-2 text-sm px-2 py-1 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <IconComponent className="h-4 w-4 text-blue-500" />
        {parsedInput.formattedDescription ? (
          parsedInput.formattedDescription.parts.map((part, index) => (
            <span
              key={index}
              className={part.isHighlighted ? "text-muted-foreground" : ""}
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
      {isExpanded && (
        <div className="ml-8 text-sm text-muted-foreground">{summary}</div>
      )}
    </div>
  );
}
