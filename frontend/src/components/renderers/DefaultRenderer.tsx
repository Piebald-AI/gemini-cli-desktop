import { Wrench, Check } from "lucide-react";
import { type ToolCall } from "../../utils/toolCallParser";

interface DefaultRendererProps {
  toolCall: ToolCall;
}

export function DefaultRenderer({ toolCall }: DefaultRendererProps) {
  console.log("🔧 DefaultRenderer called for tool:", {
    name: toolCall.name,
    status: toolCall.status,
    resultType: typeof toolCall.result,
    resultPreview: toolCall.result ? JSON.stringify(toolCall.result).slice(0, 100) + "..." : "no result"
  });
  
  const result = toolCall.result;

  // Handle different result types
  const renderResult = () => {
    if (typeof result === "string") {
      return (
        <pre className="bg-muted p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap border">
          <code className="text-foreground">{result}</code>
        </pre>
      );
    }

    if (result && typeof result === "object") {
      // Handle common result patterns
      if ("message" in result && result.message) {
        return (
          <div className="text-sm p-3 bg-muted/50 rounded border">
            {result.message}
          </div>
        );
      }

      if ("content" in result && result.content) {
        return (
          <div className="text-sm p-3 bg-muted/50 rounded whitespace-pre-wrap border">
            {String(result.content)}
          </div>
        );
      }

      if ("output" in result && result.output) {
        return (
          <pre className="bg-muted p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap border">
            <code className="text-foreground">{String(result.output)}</code>
          </pre>
        );
      }

      // Fallback: show as formatted JSON
      return (
        <pre className="bg-muted p-3 rounded text-sm overflow-x-auto border">
          <code className="text-foreground">
            {JSON.stringify(result, null, 2)}
          </code>
        </pre>
      );
    }

    return (
      <div className="text-sm text-gray-500 p-3 bg-muted/50 rounded border text-center">
        No result data available
      </div>
    );
  };

  // Format tool name (snake_case to PascalCase)
  const formatToolName = (name: string): string => {
    return name
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");
  };

  // Get result summary for generic tools
  const getResultSummary = (): string => {
    if (typeof result === "string") {
      return result.substring(0, 50) + (result.length > 50 ? "..." : "");
    }
    if (
      result &&
      typeof result === "object" &&
      "message" in result &&
      result.message
    ) {
      return String(result.message);
    }
    return "Completed successfully.";
  };

  return (
    <div className="space-y-4">
      {/* Generic completion status card for unknown tools */}
      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md px-4 py-3">
        <div className="font-medium text-sm text-black dark:text-white mb-1 font-mono">
          {formatToolName(toolCall.name)}
        </div>
        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
          <Check className="size-3" />
          {getResultSummary()}
        </div>
      </div>

      {/* Detailed result content */}
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm">
            <span className="font-medium">Tool Result</span>
            <span className="text-muted-foreground ml-2">
              ({toolCall.name})
            </span>
          </div>
        </div>

        {/* Result content */}
        {renderResult()}
      </div>
    </div>
  );
}
