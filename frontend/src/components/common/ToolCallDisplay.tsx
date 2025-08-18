import React from "react";
import { Check, X, Loader2 } from "lucide-react";
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

function ToolCallDisplayComponent({
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

  const isUserRejected = (toolCall: ToolCall): boolean => {
    // Check the permanent rejection flag first
    if ((toolCall as any).isUserRejected) {
      return true;
    }

    // Fallback to checking the result markdown
    return !!(
      toolCall.status === "failed" &&
      toolCall.result &&
      typeof toolCall.result === "object" &&
      toolCall.result.markdown === "Tool call rejected by user"
    );
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

    // Handle JSON-RPC error format from outputJsonRpc
    try {
      if (toolCall.outputJsonRpc) {
        const output = JSON.parse(toolCall.outputJsonRpc);
        if (output.error?.data?.details) {
          const errorMsg = output.error.data.details;
          return errorMsg.length > 60
            ? errorMsg.substring(0, 60) + "..."
            : errorMsg;
        }
        if (output.error?.message) {
          return output.error.message;
        }
      }
    } catch {
      // Ignore JSON parsing errors
    }

    return "Command failed.";
  };

  const getRunningDescription = (toolCall: ToolCall): React.ReactNode => {
    const parsedInput = ToolInputParser.parseToolInput(toolCall);

    // If we have formatted description data, render it with proper styling
    if (parsedInput.formattedDescription) {
      return (
        <>
          {parsedInput.formattedDescription.parts.map((part, index) => (
            <span
              key={index}
              className={part.isHighlighted ? "text-muted-foreground" : ""}
            >
              {part.text}
            </span>
          ))}
        </>
      );
    }

    // Fallback to plain description
    return parsedInput.description;
  };

  // Configuration for tool loading states - easily extensible
  // To add a new tool with custom loading state:
  // 1. Add an entry to this config object with the tool name as key
  // 2. Specify custom icon, message, and whether it's a special tool (affects transition icon)
  // 3. Optionally add detectors for additional matching logic beyond tool name
  // 4. For tools that need custom completed state rendering, add them to ToolResultRenderer
  const toolLoadingConfig = {
    google_web_search: {
      icon: <Loader2 className="animate-spin h-3 w-3" />,
      message: "Googling...",
      isSpecialTool: true,
      detectors: [
        (toolCall: ToolCall) =>
          toolCall.label?.toLowerCase().includes("searching the web"),
      ],
    },
    web_fetch: {
      icon: <Loader2 className="animate-spin h-3 w-3" />,
      message: "Fetching...",
      isSpecialTool: true,
      detectors: [
        (toolCall: ToolCall) =>
          toolCall.label?.toLowerCase().includes("processing urls"),
      ],
    },
    // Example of how to add more tools:
    // glob: {
    //   icon: <Loader2 className="animate-spin h-3 w-3" />,
    //   message: "Searching files...",
    //   isSpecialTool: true,
    //   detectors: [(toolCall: ToolCall) => toolCall.label?.toLowerCase().includes("globbed")]
    // }
  };

  // Extract URL information for WebFetch pending state
  const getWebFetchPendingInfo = (toolCall: ToolCall) => {
    if (toolCall.name !== "web_fetch") return null;

    // First try to extract from ACP confirmation request title
    if (toolCall.confirmationRequest?.label) {
      const title = toolCall.confirmationRequest.label;

      // Look for URLs in the title like: "Processing URLs and instructions from prompt: \"Fetch the title of https://www.google.com/\""
      const urlMatches = title.match(/https?:\/\/[^\s"']+/g);
      if (urlMatches && urlMatches.length > 0) {
        return {
          url: urlMatches[0],
          count: urlMatches.length,
        };
      }

      // Look for generic patterns like "Processing URLs"
      if (title.toLowerCase().includes("processing urls")) {
        const urlCountMatch = title.match(/(\d+)\s*urls?/i);
        if (urlCountMatch) {
          return {
            url: `${urlCountMatch[1]} URLs`,
            count: parseInt(urlCountMatch[1]),
          };
        }
        return {
          url: "URLs from prompt",
          count: 1,
        };
      }
    }

    // Fallback to extracting from parameters
    try {
      let params: Record<string, unknown> = {};

      // Try to get parameters from inputJsonRpc first
      if (toolCall.inputJsonRpc) {
        const input = JSON.parse(toolCall.inputJsonRpc);
        params = input.params || {};
      } else {
        // Fallback to toolCall.parameters
        params = toolCall.parameters || {};
      }

      const url = params.url;
      if (url && typeof url === "string") {
        return {
          url: url,
          count: 1,
        };
      }

      // Handle multiple URLs if they're in an array
      if (Array.isArray(url)) {
        return {
          url: url[0] || "content",
          count: url.length,
        };
      }

      return {
        url: "content",
        count: 1,
      };
    } catch {
      return {
        url: "content",
        count: 1,
      };
    }
  };

  const getLoadingState = (toolCall: ToolCall) => {
    // Check configured tools first
    for (const [toolName, config] of Object.entries(toolLoadingConfig)) {
      if (
        toolCall.name === toolName ||
        config.detectors?.some((detector) => detector(toolCall))
      ) {
        return {
          icon: config.icon,
          message: config.message,
          isWebTool: config.isSpecialTool,
        };
      }
    }

    // Default loading state for other tools
    return {
      icon: (
        <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full"></div>
      ),
      message: "Executing...",
      isWebTool: false,
    };
  };

  // Simple icon for running state - no transitions
  const getRunningIcon = (toolCall: ToolCall) => {
    const loadingState = getLoadingState(toolCall);
    return loadingState.icon;
  };

  return (
    <div className="my-4 w-full">
      {/* Pending State */}
      {enhancedToolCall.status === "pending" && (
        <>
          {/* For edit tools, show the specialized edit renderer */}
          {enhancedToolCall.name.toLowerCase().includes("edit") ||
          enhancedToolCall.name === "replace" ||
          enhancedToolCall.name === "write_file" ||
          enhancedToolCall.confirmationRequest?.confirmation?.type ===
            "edit" ? (
            <ToolResultRenderer
              toolCall={enhancedToolCall}
              onConfirm={onConfirm}
              hasConfirmationRequest={hasConfirmationRequest}
            />
          ) : enhancedToolCall.name === "web_fetch" ? (
            // Compact WebFetch pending state (like grep/glob style)
            <div className="mt-4">
              <div className="flex items-center gap-2 text-sm px-2 py-1 hover:bg-muted/50 rounded-lg transition-colors">
                <Loader2 className="animate-spin h-4 w-4 text-blue-500" />
                <span>
                  Fetching{" "}
                  <span className="text-muted-foreground">
                    {(() => {
                      const webFetchInfo =
                        getWebFetchPendingInfo(enhancedToolCall);
                      return webFetchInfo?.count === 1
                        ? webFetchInfo.url
                        : `${webFetchInfo?.count || 1} URLs`;
                    })()}
                  </span>
                </span>

                {/* Compact approval buttons */}
                {hasConfirmationRequest && onConfirm && (
                  <div className="ml-auto flex items-center gap-1">
                    {enhancedToolCall.confirmationRequest?.options &&
                    enhancedToolCall.confirmationRequest.options.length > 0 ? (
                      // Use ACP permission options if available - group allow vs reject
                      (() => {
                        const allowOptions =
                          enhancedToolCall.confirmationRequest.options.filter(
                            (opt) => opt.kind.includes("allow")
                          );
                        const rejectOptions =
                          enhancedToolCall.confirmationRequest.options.filter(
                            (opt) => opt.kind.includes("reject")
                          );

                        return (
                          <>
                            {/* Always Allow button (blue) if available */}
                            {allowOptions
                              .filter((opt) => opt.kind.includes("always"))
                              .map((option) => (
                                <Button
                                  key={option.optionId}
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-blue-500 dark:text-blue-400 hover:bg-blue-500 hover:bg-opacity-20 border border-blue-500 dark:border-blue-400"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onConfirm(
                                      enhancedToolCall.id,
                                      option.optionId
                                    );
                                  }}
                                  title={option.name}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              ))}

                            {/* Allow Once button (green) */}
                            {/* {allowOptions.filter(opt => !opt.kind.includes('always')).map(option => (
                              <Button
                                key={option.optionId}
                                size="sm"
                                variant="default"
                                className="h-6 w-6 p-0 bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onConfirm(enhancedToolCall.id, option.optionId);
                                }}
                                title={option.name}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            ))} */}

                            {/* Reject button (red) */}
                            {rejectOptions.slice(0, 1).map((option) => (
                              <Button
                                key={option.optionId}
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-red-500 dark:text-red-400 hover:bg-red-500 hover:bg-opacity-20 border border-red-500 dark:border-red-400"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onConfirm(
                                    enhancedToolCall.id,
                                    option.optionId
                                  );
                                }}
                                title={option.name}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            ))}
                          </>
                        );
                      })()
                    ) : (
                      // Fallback to default buttons
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-6 w-6 bg-green-600 hover:bg-green-600 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            onConfirm(enhancedToolCall.id, "proceed_once");
                          }}
                          title="Allow"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            onConfirm(enhancedToolCall.id, "cancel");
                          }}
                          title="Reject"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Default pending state for other tools
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <div className="mb-3">
                <span className="font-medium text-base text-black dark:text-white font-mono">
                  {formatToolName(enhancedToolCall.name)}
                </span>
                <span className="text-sm text-muted-foreground ml-2">
                  Pending approval...
                </span>
              </div>

              {/* Approval Buttons - Show when there's a confirmation request */}
              {hasConfirmationRequest && onConfirm && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-sm text-foreground">Approve?</span>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-xs"
                    onClick={() =>
                      onConfirm(enhancedToolCall.id, "proceed_once")
                    }
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Yes
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="px-3 py-1 text-xs"
                    onClick={() => onConfirm(enhancedToolCall.id, "cancel")}
                  >
                    <X className="h-3 w-3 mr-1" />
                    No
                  </Button>
                </div>
              )}

              {/* Show waiting indicator only when no confirmation request */}
              {!hasConfirmationRequest && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
                  <span className="animate-pulse">●</span>
                  Waiting for user approval
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

      {/* Running State */}
      {enhancedToolCall.status === "running" && (
        <>
          {/* For edit tools and web tools, show the specialized renderer */}
          {enhancedToolCall.name.toLowerCase().includes("edit") ||
          enhancedToolCall.name === "replace" ||
          enhancedToolCall.name === "write_file" ||
          enhancedToolCall.name === "google_web_search" ||
          enhancedToolCall.name === "web_fetch" ||
          enhancedToolCall.confirmationRequest?.confirmation?.type ===
            "edit" ? (
            <ToolResultRenderer
              toolCall={enhancedToolCall}
              onConfirm={onConfirm}
              hasConfirmationRequest={hasConfirmationRequest}
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

              {/* Running indicator */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {getRunningIcon(enhancedToolCall)}
                <span>{getLoadingState(enhancedToolCall).message}</span>
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

      {/* Failed State */}
      {enhancedToolCall.status === "failed" && (
        <>
          {/* For edit tools and web fetch, show specialized renderers */}
          {enhancedToolCall.name.toLowerCase().includes("edit") ||
          enhancedToolCall.name === "replace" ||
          enhancedToolCall.name === "write_file" ? (
            <ToolResultRenderer
              toolCall={enhancedToolCall}
              onConfirm={onConfirm}
              hasConfirmationRequest={hasConfirmationRequest}
            />
          ) : enhancedToolCall.name === "web_fetch" ? (
            // Compact WebFetch error state (like grep/glob style)
            <div className="mt-4">
              <div className="flex items-center gap-2 text-sm px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                <X className="h-4 w-4 text-red-500" />
                <span>
                  {isUserRejected(enhancedToolCall)
                    ? "Rejected fetch"
                    : "Failed to fetch"}{" "}
                  <span className="text-muted-foreground">
                    {(() => {
                      const webFetchInfo =
                        getWebFetchPendingInfo(enhancedToolCall);
                      return webFetchInfo?.count === 1
                        ? webFetchInfo.url
                        : `${webFetchInfo?.count || 1} URLs`;
                    })()}
                  </span>
                </span>
                {!isUserRejected(enhancedToolCall) && (
                  <span className="ml-auto text-xs text-red-600 dark:text-red-400">
                    {getErrorSummary(enhancedToolCall)}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md px-4 py-3">
              <div className="font-medium text-sm text-black dark:text-white mb-1 font-mono">
                {formatToolName(enhancedToolCall.name)}
              </div>
              <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                <X className="size-3" />
                {isUserRejected(enhancedToolCall)
                  ? "Rejected"
                  : getErrorSummary(enhancedToolCall)}
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
      {enhancedToolCall.status === "completed" && (
        <div className="space-y-4">
          {/* Enhanced Tool Result Renderer - replaces generic card for built-in tools */}
          <ToolResultRenderer
            toolCall={enhancedToolCall}
            onConfirm={onConfirm}
            hasConfirmationRequest={hasConfirmationRequest}
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
      )}
    </div>
  );
}

export const ToolCallDisplay = React.memo(ToolCallDisplayComponent);
