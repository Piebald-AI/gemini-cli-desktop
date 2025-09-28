import { Wrench } from "lucide-react";
import { type ToolCall } from "../../utils/toolCallParser";

interface DefaultRendererProps {
  toolCall: ToolCall;
}

export function DefaultRenderer({ toolCall }: DefaultRendererProps) {
  const result = toolCall.result;

  // Extract MCP server and tool names if available
  const mcpServerName = toolCall.parameters?.serverName as string | undefined;
  const mcpToolName = toolCall.parameters?.toolName as string | undefined;

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

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <div className="text-sm">
          <span className="font-medium">
            {mcpToolName
              ? formatToolName(mcpToolName)
              : formatToolName(toolCall.name)}
          </span>
          <span className="text-muted-foreground ml-2">
            ({mcpToolName || toolCall.name})
          </span>
          {mcpServerName && (
            <span className="text-muted-foreground ml-2">
              ({mcpServerName} MCP Server)
            </span>
          )}
        </div>
      </div>

      {/* Result content */}
      {renderResult()}
    </div>
  );
}
