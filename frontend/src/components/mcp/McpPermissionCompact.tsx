import { useState } from "react";
import { ChevronRight, Wrench, Check, X } from "lucide-react";
import { Button } from "../ui/button";
import { McpPermissionRequest, McpPermissionOption } from "../../types";

interface McpPermissionCompactProps {
  request: McpPermissionRequest;
  onPermissionResponse: (optionId: string) => void;
}

export function McpPermissionCompact({
  request,
  onPermissionResponse,
}: McpPermissionCompactProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Use direct server and tool names from request if available, otherwise parse from title
  const serverName =
    request.toolCall.serverName ||
    (() => {
      const match = request.toolCall.title.match(/\((.+?) MCP Server\)$/);
      return match ? match[1] : "MCP Server";
    })();

  const toolName =
    request.toolCall.toolName ||
    (() => {
      const match = request.toolCall.title.match(/^([^(]+)/);
      return match ? match[1].trim() : "Unknown Tool";
    })();

  // Group options by type for compact display
  const serverOptions = request.options.filter((opt) =>
    opt.optionId.includes("server")
  );
  const toolOptions = request.options.filter((opt) =>
    opt.optionId.includes("tool")
  );
  const allowOnceOptions = request.options.filter(
    (opt) => opt.kind === "allow_once"
  );
  const rejectOptions = request.options.filter(
    (opt) => opt.kind === "reject_once"
  );

  const getButtonStyle = (option: McpPermissionOption) => {
    if (option.kind === "allow_always")
      return "h-6 w-6 p-0 bg-green-600 hover:bg-green-700 text-white";
    if (option.kind === "allow_once")
      return "h-6 w-6 p-0 bg-green-600 hover:bg-green-700 text-white";
    if (option.kind === "reject_once")
      return "h-6 w-6 p-0 bg-red-600 hover:bg-red-700 text-white";
    return "h-6 w-6 p-0";
  };

  const getButtonIcon = (option: McpPermissionOption) => {
    if (option.kind.includes("allow")) return <Check className="h-3 w-3" />;
    if (option.kind.includes("reject")) return <X className="h-3 w-3" />;
    return <Wrench className="h-3 w-3" />;
  };

  return (
    <div className="mt-4">
      {/* Compact header matching other tool renderers */}
      <div
        className="flex items-center gap-2 text-sm px-2 py-1 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Wrench className="h-4 w-4 text-blue-500" />
        <span>Permission required for </span>
        <span className="font-medium">{toolName}</span>
        <span className="text-muted-foreground">from {serverName}</span>

        {/* Compact permission buttons in header */}
        <div
          className="ml-auto flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Always allow server (green) */}
          {serverOptions
            .filter((opt) => opt.kind === "allow_always")
            .map((option) => (
              <Button
                key={option.optionId}
                size="sm"
                variant="default"
                className={getButtonStyle(option)}
                onClick={() => onPermissionResponse(option.optionId)}
                title={option.name}
              >
                {getButtonIcon(option)}
              </Button>
            ))}

          {/* Always allow tool (green) */}
          {toolOptions
            .filter((opt) => opt.kind === "allow_always")
            .map((option) => (
              <Button
                key={option.optionId}
                size="sm"
                variant="default"
                className={getButtonStyle(option)}
                onClick={() => onPermissionResponse(option.optionId)}
                title={option.name}
              >
                {getButtonIcon(option)}
              </Button>
            ))}

          {/* Allow once (blue) */}
          {allowOnceOptions.map((option) => (
            <Button
              key={option.optionId}
              size="sm"
              variant="default"
              className={getButtonStyle(option)}
              onClick={() => onPermissionResponse(option.optionId)}
              title={option.name}
            >
              {getButtonIcon(option)}
            </Button>
          ))}

          {/* Reject (red) */}
          {rejectOptions.map((option) => (
            <Button
              key={option.optionId}
              size="sm"
              variant="default"
              className={getButtonStyle(option)}
              onClick={() => onPermissionResponse(option.optionId)}
              title={option.name}
            >
              {getButtonIcon(option)}
            </Button>
          ))}
        </div>

        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
      </div>

      {/* Expandable detailed view */}
      {isExpanded && (
        <div className="ml-6 mt-2 text-sm space-y-2 border-l-2 border-border pl-4">
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">
              {serverName} MCP Server
            </span>{" "}
            wants to execute{" "}
            <span className="font-medium text-foreground">{toolName}</span>
          </div>

          {/* Detailed permission options */}
          <div className="space-y-1">
            {serverOptions.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-700">🟢 Server-level:</span>
                {serverOptions.map((option) => (
                  <Button
                    key={option.optionId}
                    size="sm"
                    variant="default"
                    className="h-5 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => onPermissionResponse(option.optionId)}
                  >
                    {option.name}
                  </Button>
                ))}
              </div>
            )}

            {toolOptions.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-700">🔧 Tool-level:</span>
                {toolOptions.map((option) => (
                  <Button
                    key={option.optionId}
                    size="sm"
                    variant="default"
                    className="h-5 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => onPermissionResponse(option.optionId)}
                  >
                    {option.name}
                  </Button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 text-xs">
              {allowOnceOptions.map((option) => (
                <Button
                  key={option.optionId}
                  size="sm"
                  variant="default"
                  className="h-5 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => onPermissionResponse(option.optionId)}
                >
                  {option.name}
                </Button>
              ))}
              {rejectOptions.map((option) => (
                <Button
                  key={option.optionId}
                  size="sm"
                  variant="default"
                  className="h-5 px-2 text-xs bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => onPermissionResponse(option.optionId)}
                >
                  {option.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
