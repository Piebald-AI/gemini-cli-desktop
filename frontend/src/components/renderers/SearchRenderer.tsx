import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { type ToolCall } from "../../utils/toolCallParser";

interface SearchResult {
  matches?: Array<{file: string}>;
  total?: number;
  pattern?: string;
  message?: string;
  markdown?: string;
}

interface SearchRendererProps {
  toolCall: ToolCall;
}

export function SearchRenderer({ toolCall }: SearchRendererProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const result = toolCall.result as SearchResult;

  // Extract search pattern from input
  const getSearchPattern = (): string => {
    try {
      if (toolCall.inputJsonRpc) {
        const input = JSON.parse(toolCall.inputJsonRpc);
        return input.params?.pattern || input.params?.query || "unknown";
      }
    } catch {}
    return "unknown";
  };

  // Get the summary message from the result
  const getSummary = (): string => {
    if (typeof result === 'string') {
      return result;
    }
    if (result && typeof result === 'object') {
      if ('markdown' in result && result.markdown) {
        return result.markdown;
      }
      if ('message' in result && result.message) {
        return result.message;
      }
      if (result.matches && result.total) {
        return `Found ${result.total} matches in ${result.matches.length} files`;
      }
    }
    return 'Search completed';
  };

  const searchPattern = getSearchPattern();
  const summary = getSummary();

  return (
    <div className="mt-4">
      <div 
        className="flex items-center gap-2 text-sm px-2 py-1 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Search className="h-4 w-4 text-blue-500" />
        <span>Searched for </span>
        <span className="text-muted-foreground">"{searchPattern}"</span>
        <ChevronRight 
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
      </div>
      {isExpanded && (
        <div className="ml-8 text-sm text-muted-foreground">
          {summary}
        </div>
      )}
    </div>
  );
}