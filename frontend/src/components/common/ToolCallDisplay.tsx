import { Check, X } from "lucide-react";
import { Button } from "../ui/button";
import type {
  ToolCall,
  ToolCallConfirmationRequest,
} from "../../utils/toolCallParser";
import { ToolResultRenderer } from "./ToolResultRenderer";
import { ToolInputParser } from "../../utils/toolInputParser";

interface ToolCallDisplayProps {
  toolCall: ToolCall;
  onConfirm?: (toolCallId: string, outcome: string) => Promise<void>;
  hasConfirmationRequest?: boolean;
  confirmationRequest?: ToolCallConfirmationRequest | undefined;
  confirmationRequests?: Map<string, ToolCallConfirmationRequest>;
}

export function ToolCallDisplay({
  toolCall,
  onConfirm,
  hasConfirmationRequest,
  confirmationRequest,
  confirmationRequests,
}: ToolCallDisplayProps) {
  // Try to get confirmation request from the Map as a fallback
  const actualConfirmationRequest =
    confirmationRequest ||
    (confirmationRequests ? confirmationRequests.get(toolCall.id) : undefined);

  // If we have a confirmation request, merge it into the tool call data
  const enhancedToolCall: ToolCall = {
    ...toolCall,
    confirmationRequest:
      actualConfirmationRequest || toolCall.confirmationRequest,
  };

  // Convert snake_case to PascalCase
  const formatToolName = (name: string): string => {
    return name
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");
  };

  const getErrorSummary = (toolCall: ToolCall): string => {
    if (!toolCall.result) return "Failed to execute.";

    const result = toolCall.result;

    // If result is a string
    if (typeof result === "string") {
      const firstLine = result.trim().split("\n")[0];
      return firstLine.length > 60
        ? firstLine.substring(0, 60) + "..."
        : firstLine;
    }

    // If result has markdown field (like in the error example)
    if (result.markdown) {
      const error = result.markdown.trim();
      // Return first line of error, truncated if needed
      const firstLine = error.split("\n")[0];
      return firstLine.length > 60
        ? firstLine.substring(0, 60) + "..."
        : firstLine;
    }

    // If result has error field
    if (result.error) {
      return result.error.length > 60
        ? result.error.substring(0, 60) + "..."
        : result.error;
    }

    return "Command failed.";
  };

  const getRunningDescription = (toolCall: ToolCall): string => {
    const parsedInput = ToolInputParser.parseToolInput(toolCall);
    return parsedInput.description;
  };

  return (
    <div className="my-4 w-full">
      {/* Pending State */}
      {enhancedToolCall.status === "pending" && (
        <>
          {/* For edit tools, show the specialized edit renderer */}
          {enhancedToolCall.name.toLowerCase().includes("edit") ||
          enhancedToolCall.confirmationRequest?.confirmation?.type ===
            "edit" ? (
            <ToolResultRenderer
              toolCall={enhancedToolCall}
              onConfirm={onConfirm}
            />
          ) : (
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <div className="mb-3">
                <span className="font-medium text-base text-black dark:text-white font-mono">
                  {formatToolName(enhancedToolCall.name)}
                </span>
                <span className="text-sm text-muted-foreground ml-2">
                  Pending approval...
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="animate-pulse">●</span>
                Waiting for user approval
              </div>

              {/* Input JSON-RPC */}
              {enhancedToolCall.inputJsonRpc && (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    Input:
                  </div>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto border">
                    <code>{enhancedToolCall.inputJsonRpc}</code>
                  </pre>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Running State */}
      {enhancedToolCall.status === "running" && (
        <>
          {/* For edit tools, show the specialized edit renderer */}
          {enhancedToolCall.name.toLowerCase().includes("edit") ||
          enhancedToolCall.confirmationRequest?.confirmation?.type ===
            "edit" ? (
            <ToolResultRenderer
              toolCall={enhancedToolCall}
              onConfirm={onConfirm}
            />
          ) : (
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="mb-3">
                <span className="font-medium text-base text-black dark:text-white font-mono">
                  {formatToolName(enhancedToolCall.name)}
                </span>
                <span className="text-sm text-muted-foreground ml-2">
                  {getRunningDescription(enhancedToolCall)}
                </span>
              </div>

              {/* Approval Buttons - Only show if there's a confirmation request */}
              {hasConfirmationRequest && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground">Approve?</span>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-xs"
                    onClick={() => onConfirm?.(enhancedToolCall.id, "allow")}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Yes
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="px-3 py-1 text-xs"
                    onClick={() => onConfirm?.(enhancedToolCall.id, "reject")}
                  >
                    <X className="h-3 w-3 mr-1" />
                    No
                  </Button>
                </div>
              )}

              {/* Input JSON-RPC */}
              {enhancedToolCall.inputJsonRpc && (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    Input:
                  </div>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto border">
                    <code>{enhancedToolCall.inputJsonRpc}</code>
                  </pre>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Failed State */}
      {enhancedToolCall.status === "failed" && (
        <>
          {/* For edit tools, show the specialized edit renderer */}
          {enhancedToolCall.name.toLowerCase().includes("edit") ? (
            <ToolResultRenderer
              toolCall={enhancedToolCall}
              onConfirm={onConfirm}
            />
          ) : (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md px-4 py-3">
              <div className="font-medium text-sm text-black dark:text-white mb-1 font-mono">
                {formatToolName(enhancedToolCall.name)}
              </div>
              <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                <X className="size-3" />
                {getErrorSummary(enhancedToolCall)}
              </div>

              {/* Input JSON-RPC */}
              {enhancedToolCall.inputJsonRpc && (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    Input:
                  </div>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto border">
                    <code>{enhancedToolCall.inputJsonRpc}</code>
                  </pre>
                </div>
              )}

              {/* Output JSON-RPC */}
              {enhancedToolCall.outputJsonRpc && (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    Output:
                  </div>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto border">
                    <code>{enhancedToolCall.outputJsonRpc}</code>
                  </pre>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Completed State */}
      {enhancedToolCall.status === "completed" && (() => {
        console.log("🎭 ToolCallDisplay: About to render completed tool:", {
          name: enhancedToolCall.name,
          status: enhancedToolCall.status,
          id: enhancedToolCall.id,
          hasResult: !!enhancedToolCall.result,
          resultPreview: enhancedToolCall.result ? JSON.stringify(enhancedToolCall.result).slice(0, 100) + "..." : "no result"
        });
        return (
          <div className="space-y-4">
            {/* Enhanced Tool Result Renderer - replaces generic card for built-in tools */}
            <ToolResultRenderer
              toolCall={enhancedToolCall}
              onConfirm={onConfirm}
            />

          {/* Input JSON-RPC */}
          {enhancedToolCall.inputJsonRpc && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                Input:
              </div>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto border">
                <code>{enhancedToolCall.inputJsonRpc}</code>
              </pre>
            </div>
          )}

          {/* Output JSON-RPC */}
          {enhancedToolCall.outputJsonRpc && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                Output:
              </div>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto border">
                <code>{enhancedToolCall.outputJsonRpc}</code>
              </pre>
            </div>
          )}
          </div>
        );
      })()}
    </div>
  );
}
