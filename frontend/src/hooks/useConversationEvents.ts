import React, { useCallback } from "react";
import { listen } from "@/lib/listen";
import { getWebSocketManager } from "../lib/webApi";
import { Conversation, Message, CliIO } from "../types";
import { ToolCallConfirmationRequest } from "../utils/toolCallParser";
import { type ToolCall } from "../utils/toolCallParser";

interface ToolLocation {
  file?: string;
  directory?: string;
  [key: string]: unknown;
}

interface AcpTextContent {
  type: "content";
  content: {
    type: "text";
    text: string;
  };
}

interface AcpDiffContent {
  type: "diff";
  path: string;
  oldText?: string;
  old_text?: string;
  newText?: string;
  new_text?: string;
}

type AcpContent = AcpTextContent | AcpDiffContent;

interface LegacyDiffResult {
  type: "diff";
  path: string;
  oldText?: string;
  newText?: string;
}

interface LegacyGenericResult {
  type: "generic";
  oldText: undefined;
  newText: string;
  path: undefined;
}

type LegacyResult = LegacyDiffResult | LegacyGenericResult;

// Event payload types for ACP session updates
interface SessionUpdateEventPayload {
  sessionUpdate:
    | "tool_call"
    | "tool_call_update"
    | "agent_message_chunk"
    | "agent_thought_chunk";
  toolCallId?: string;
  kind?: string;
  title?: string;
  locations?: ToolLocation[];
  status?: string;
  result?: string;
  content?: AcpContent[] | string;
  chunk?: string;
  thought?: string;
}

interface PermissionRequestEventPayload {
  request_id: string;
  request: {
    sessionId?: string;
    toolCall: {
      toolCallId: string;
      name?: string;
      title?: string;
      kind?: string;
      status?: string;
      parameters?: Record<string, unknown>;
      content?: AcpContent[];
      locations?: ToolLocation[];
    };
    question?: string;
    options?:
      | string[]
      | {
          optionId: string;
          name: string;
          kind: "allow_once" | "allow_always" | "reject_once" | "reject_always";
        }[];
  };
}

type EventPayload = SessionUpdateEventPayload | PermissionRequestEventPayload;

// Type guards for event payload discrimination
function isSessionUpdateEvent(
  payload: EventPayload
): payload is SessionUpdateEventPayload {
  return "sessionUpdate" in payload;
}

function isPermissionRequestEvent(
  payload: EventPayload
): payload is PermissionRequestEventPayload {
  return "request_id" in payload && "request" in payload;
}

// Helper functions for ACP conversion - CORRECTED with verified tool names
function getToolNameFromKind(
  kind: string | undefined,
  title?: string,
  locations?: ToolLocation[],
  toolCallId?: string
): string {
  if (!kind) {
    return "other";
  }
  switch (kind) {
    case "read":
      // ACP has multiple read tools - try to detect which one based on context
      // Check tool call ID first for more reliable identification
      if (toolCallId && toolCallId.startsWith("read_many_files")) {
        return "read_many_files";
      } else if (toolCallId && toolCallId.startsWith("list_directory")) {
        return "list_directory";
      } else if (toolCallId && toolCallId.startsWith("read_file")) {
        return "read_file";
      } else if (title && title.toLowerCase().includes("directory") && !title.toLowerCase().includes("target dir")) {
        return "list_directory"; // CORRECTED: ACP uses "list_directory", not "ls"
      } else if (locations && locations.length > 1) {
        return "read_many_files";
      } else {
        return "read_file";
      }
    case "edit":
      return "replace"; // CORRECTED: ACP uses "replace", not "edit" or "write_file"
    case "execute":
      return "run_shell_command"; // CORRECTED: ACP uses "run_shell_command", not "execute_command"
    case "search":
      // Fix for Gemini CLI bug: both list_directory and search operations use kind="search"
      // We need to check the tool call ID to distinguish them
      if (toolCallId && toolCallId.startsWith("list_directory")) {
        return "list_directory";
      } else if (toolCallId && toolCallId.startsWith("glob")) {
        return "glob";
      } else if (title && title.toLowerCase().includes("web")) {
        return "google_web_search"; // CORRECTED: ACP uses "google_web_search", not "web_search"
      } else {
        return "search_file_content"; // CORRECTED: ACP uses "search_file_content", not "search_files"
      }
    case "fetch":
      return "web_fetch"; // This one was correct
    case "other":
    default:
      return "other";
  }
}

function mapAcpStatus(acpStatus: string | undefined): ToolCall["status"] {
  if (!acpStatus) {
    return "pending";
  }
  switch (acpStatus) {
    case "pending":
      return "pending";
    case "in_progress":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

function convertAcpContentToLegacy(acpContent: AcpContent[]): LegacyResult {
  console.log(
    "🔧 [EDIT-DEBUG] convertAcpContentToLegacy called with:",
    acpContent
  );

  if (!acpContent || acpContent.length === 0) {
    console.log("🔧 [EDIT-DEBUG] No content provided, returning default");
    return {
      type: "generic" as const,
      oldText: undefined,
      newText: "",
      path: undefined,
    };
  }

  const contentItem = acpContent[0];
  console.log("🔧 [EDIT-DEBUG] Processing content item:", contentItem);
  if (contentItem.type === "content" && contentItem.content.type === "text") {
    return {
      type: "generic" as const,
      oldText: undefined,
      newText: contentItem.content.text,
      path: undefined,
    };
  } else if (contentItem.type === "diff") {
    const result = {
      type: "diff" as const,
      path: contentItem.path,
      oldText: contentItem.oldText || contentItem.old_text,
      newText: contentItem.newText || contentItem.new_text,
    };
    console.log("🔧 [EDIT-DEBUG] Converted diff content:", result);
    return result;
  }

  console.log("🔧 [EDIT-DEBUG] Unknown content type, returning default");
  return {
    type: "generic" as const,
    oldText: undefined,
    newText: "",
    path: undefined,
  };
}

export const useConversationEvents = (
  setCliIOLogs: React.Dispatch<React.SetStateAction<CliIO[]>>,
  setConfirmationRequests: React.Dispatch<
    React.SetStateAction<Map<string, ToolCallConfirmationRequest>>
  >,
  updateConversation: (
    conversationId: string,
    updateFn: (conv: Conversation, lastMsg: Message) => void
  ) => void
) => {
  const setupEventListenerForConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      console.log(
        `🎯 Setting up event listeners for conversation: ${conversationId}`
      );

      // In web mode, ensure WebSocket connection is ready before registering listeners
      if (__WEB__) {
        const wsManager = getWebSocketManager();
        await wsManager.waitForConnection();
      }

      try {
        await listen<{ type: "input" | "output"; data: string }>(
          `cli-io-${conversationId}`,
          (event) => {
            setCliIOLogs((prev) => [
              ...prev,
              {
                timestamp: new Date(),
                type: event.payload.type,
                data: event.payload.data,
                conversationId,
              },
            ]);

            // Check if this is a tool call related JSON-RPC message
            try {
              const jsonData = JSON.parse(event.payload.data);

              if (event.payload.type === "output") {
                // If it's a requestToolCallConfirmation input, store it for when the tool call is created
                if (jsonData.method === "requestToolCallConfirmation") {
                  window.pendingToolCallInput = event.payload.data;
                }

                // If it's an updateToolCall input, store it for updating the tool call
                if (jsonData.method === "updateToolCall") {
                  updateConversation(conversationId, (conv) => {
                    for (const msg of conv.messages) {
                      for (const msgPart of msg.parts) {
                        if (
                          msgPart.type === "toolCall" &&
                          msgPart.toolCall.id === jsonData.params!.toolCallId
                        ) {
                          msgPart.toolCall.outputJsonRpc = event.payload.data;
                        }
                      }
                    }
                  });
                }
              }
            } catch {
              // Not JSON, ignore
            }
          }
        );

        // Listen for streaming text chunks.
        await listen<string>(`ai-output-${conversationId}`, (event) => {
          updateConversation(conversationId, (conv, lastMsg) => {
            conv.isStreaming = true;
            if (lastMsg.sender === "assistant") {
              // There's an existing AI message.
              const lastPart = lastMsg.parts[lastMsg.parts.length - 1];
              if (lastPart?.type === "text") {
                lastPart.text += event.payload;
              } else {
                // Create a new text part.
                lastMsg.parts.push({
                  type: "text",
                  text: event.payload,
                });
              }
            } else {
              conv.messages.push({
                id: Date.now().toString(),
                sender: "assistant",
                timestamp: new Date(),
                parts: [
                  {
                    type: "text",
                    text: event.payload,
                  },
                ],
              });
            }
          });
        });

        // Listen for thinking chunks.
        await listen<string>(`ai-thought-${conversationId}`, (event) => {
          updateConversation(conversationId, (conv, lastMsg) => {
            conv.isStreaming = true;
            if (lastMsg.sender === "assistant") {
              const lastPart = lastMsg.parts[lastMsg.parts.length - 1];
              if (lastPart?.type === "thinking") {
                lastPart.thinking += event.payload;
              } else {
                // Create a new text part.
                lastMsg.parts.push({
                  type: "thinking",
                  thinking: event.payload,
                });
              }
            } else {
              conv.messages.push({
                id: Date.now().toString(),
                sender: "assistant",
                timestamp: new Date(),
                parts: [
                  {
                    type: "thinking",
                    thinking: event.payload,
                  },
                ],
              });
            }
          });
        });

        // Listen for pure ACP session updates (replaces ai-tool-call and ai-tool-call-update)
        console.log(
          `🔧 [EDIT-DEBUG] Registering acp-session-update listener for: ${conversationId}`
        );
        await listen<EventPayload>(
          `acp-session-update-${conversationId}`,
          ({ payload: update }: { payload: EventPayload }) => {
            console.log(
              `🔧 [EDIT-DEBUG] Received acp-session-update event:`,
              update
            );
            if (!isSessionUpdateEvent(update)) {
              console.warn(
                "Received non-session-update event on session-update channel"
              );
              return;
            }
            if (update.sessionUpdate === "tool_call") {
              console.log(
                `🔧 [EDIT-DEBUG] Processing tool_call event for:`,
                update.toolCallId
              );
              // Handle tool call start
              updateConversation(conversationId, (conv, lastMsg) => {
                // Convert ACP ToolCallKind to tool name
                const toolName = getToolNameFromKind(
                  update.kind,
                  update.title,
                  update.locations,
                  update.toolCallId || ""
                );

                const newToolCall: ToolCall = {
                  id: update.toolCallId || "",
                  name: toolName,
                  parameters: { locations: update.locations },
                  status: mapAcpStatus(update.status),
                  label: update.title,
                };

                // Add tool call to the existing assistant message or create one if needed
                if (lastMsg.sender === "assistant") {
                  lastMsg.parts.push({
                    type: "toolCall",
                    toolCall: newToolCall,
                  });
                } else {
                  conv.messages.push({
                    id: Date.now().toString(),
                    sender: "assistant",
                    timestamp: new Date(),
                    parts: [
                      {
                        type: "toolCall",
                        toolCall: newToolCall,
                      },
                    ],
                  });
                }
              });
            } else if (update.sessionUpdate === "tool_call_update") {
              // Add a small delay to ensure any previous state updates have completed
              setTimeout(() => {
                // Handle tool call update
                updateConversation(conversationId, (conv) => {
                  let updated = false;
                  for (const msg of conv.messages) {
                    for (const msgPart of msg.parts) {
                      if (
                        msgPart.type === "toolCall" &&
                        msgPart.toolCall.id === update.toolCallId
                      ) {
                        // Preserve confirmation request data when updating status
                        const preservedConfirmationRequest =
                          msgPart.toolCall.confirmationRequest;

                        const newStatus = mapAcpStatus(update.status);

                        // Don't overwrite a user rejection with a backend status update
                        const isCurrentlyRejected =
                          msgPart.toolCall.isUserRejected ||
                          (msgPart.toolCall.status === "failed" &&
                            msgPart.toolCall.result &&
                            typeof msgPart.toolCall.result === "object" &&
                            msgPart.toolCall.result.markdown ===
                              "Tool call rejected by user");

                        if (!isCurrentlyRejected) {
                          msgPart.toolCall.status = newStatus;
                        }
                        msgPart.toolCall.confirmationRequest =
                          preservedConfirmationRequest;

                        // Handle content updates - but don't overwrite user rejections
                        if (update.content && !isCurrentlyRejected) {
                          if (
                            Array.isArray(update.content) &&
                            update.content.length > 0
                          ) {
                            // Use the existing convertAcpContentToLegacy function to properly handle diff content
                            const legacyResult = convertAcpContentToLegacy(
                              update.content
                            );
                            console.log(
                              "🔧 [EDIT-DEBUG] Converted ACP content:",
                              legacyResult
                            );

                            // Convert LegacyResult to ToolCallResult format
                            if (legacyResult.type === "diff") {
                              msgPart.toolCall.result = {
                                file_path: legacyResult.path,
                                old_string: legacyResult.oldText,
                                new_string: legacyResult.newText,
                                success: true,
                              };
                              console.log(
                                "🔧 [EDIT-DEBUG] Updated tool call with diff result for:",
                                legacyResult.path
                              );
                            } else if (legacyResult.type === "generic") {
                              msgPart.toolCall.result =
                                legacyResult.newText || "";
                              console.log(
                                "🔧 [EDIT-DEBUG] Updated tool call with generic text result"
                              );
                            }
                          } else if (typeof update.content === "string") {
                            msgPart.toolCall.result = update.content;
                            console.log(
                              "🔧 [EDIT-DEBUG] Updated tool call with string result"
                            );
                          }
                        }

                        updated = true;
                        break;
                      }
                    }
                    if (updated) break;
                  }

                  if (!updated) {
                    console.error(
                      "Tool call not found for update:",
                      update.toolCallId
                    );
                  } else {
                    // Force a re-render by updating the conversation timestamp
                    conv.lastUpdated = new Date();
                  }
                });
              }, 100); // 100ms delay to ensure state batching doesn't interfere
              // TODO 8/17/2025: Look in to the timeout.
            }
          }
        );

        // Note: Tool call updates are now handled by the ACP session update listener above

        // Also listen for errors
        await listen<string>(`ai-error-${conversationId}`, (event) => {
          updateConversation(conversationId, (conv) => {
            conv.isStreaming = false;
            conv.messages.push({
              id: Date.now().toString(),
              parts: [
                {
                  type: "text",
                  text: `❌ **Error**: ${event.payload}`,
                },
              ],
              sender: "assistant",
              timestamp: new Date(),
            });
          });
        });

        // Listen for pure ACP permission requests (replaces ai-tool-call-confirmation)
        console.log(
          `✅ Registering listener for: acp-permission-request-${conversationId}`
        );
        await listen<EventPayload>(
          `acp-permission-request-${conversationId}`,
          (event) => {
            console.log(
              "🔍 DEBUG: Received acp-permission-request event:",
              event
            );
            console.log("🔍 DEBUG: Event payload:", event.payload);

            if (!isPermissionRequestEvent(event.payload)) {
              console.warn(
                "Received non-permission-request event on permission-request channel"
              );
              return;
            }

            console.log("🔍 DEBUG: Request object:", event.payload.request);
            console.log(
              "🔍 DEBUG: ToolCall object:",
              event.payload.request?.toolCall
            );

            const { request_id, request } = event.payload;
            const toolCallId = request.toolCall.toolCallId;
            console.log(
              "🎯 Processing permission request for toolCallId:",
              toolCallId
            );
            console.log("🎯 Tool call status:", request.toolCall.status);
            console.log("🎯 Tool call kind:", request.toolCall.kind);

            // CREATE A TOOL CALL IF NONE EXISTS
            updateConversation(conversationId, (conv, lastMsg) => {
              // When a permission request comes in, the model has finished generating
              // We should stop the streaming indicator
              conv.isStreaming = false;

              // Check if tool call already exists
              let toolCallExists = false;
              for (const msg of conv.messages) {
                for (const msgPart of msg.parts) {
                  if (
                    msgPart.type === "toolCall" &&
                    msgPart.toolCall.id === toolCallId
                  ) {
                    toolCallExists = true;
                    break;
                  }
                }
              }

              console.log("🔧 [EDIT-DEBUG] Tool call exists check:", {
                toolCallId,
                toolCallExists,
              });

              // Create the confirmation request object
              const confirmationRequest: ToolCallConfirmationRequest = {
                requestId: parseInt(request_id, 10),
                sessionId: request.sessionId || "",
                toolCallId: toolCallId,
                label:
                  request.toolCall.title ||
                  request.toolCall.name ||
                  "Unknown Tool",
                icon: "", // ACP doesn't use icons
                content: convertAcpContentToLegacy(
                  request.toolCall.content || []
                ),
                confirmation: {
                  type:
                    request.toolCall.kind === "edit"
                      ? "edit"
                      : request.toolCall.kind === "execute"
                        ? "command"
                        : "generic",
                  rootCommand: undefined,
                  command: undefined,
                },
                locations: (request.toolCall.locations || []).map(
                  (loc: ToolLocation) => ({
                    path: loc.file || loc.directory || "unknown",
                  })
                ),
                inputJsonRpc: window.pendingToolCallInput,
                // Include ACP permission options for enhanced approval flows
                options: Array.isArray(request.options)
                  ? typeof request.options[0] === "string"
                    ? (request.options as string[]).map((opt, idx) => ({
                        optionId: `option_${idx}`,
                        name: opt,
                        kind: (idx < 2
                          ? idx === 0
                            ? "allow_once"
                            : "allow_always"
                          : idx === 2
                            ? "reject_once"
                            : "reject_always") as
                          | "allow_once"
                          | "allow_always"
                          | "reject_once"
                          | "reject_always",
                      }))
                    : (request.options as {
                        optionId: string;
                        name: string;
                        kind:
                          | "allow_once"
                          | "allow_always"
                          | "reject_once"
                          | "reject_always";
                      }[])
                  : [],
              };

              // If tool call doesn't exist, create one with the confirmation request
              if (!toolCallExists) {
                console.log(
                  "🔧 [EDIT-DEBUG] Creating new tool call for permission request:",
                  toolCallId
                );
                const toolName = getToolNameFromKind(
                  request.toolCall.kind,
                  request.toolCall.title,
                  request.toolCall.locations,
                  toolCallId
                );

                const newToolCall: ToolCall = {
                  id: toolCallId,
                  name: toolName,
                  parameters: { locations: request.toolCall.locations || [] },
                  status: mapAcpStatus(request.toolCall.status),
                  label:
                    request.toolCall.title ||
                    request.toolCall.name ||
                    "Unknown Tool",
                  confirmationRequest: confirmationRequest, // Attach immediately
                };

                console.log(
                  "🔧 [EDIT-DEBUG] Created tool call object:",
                  newToolCall
                );

                if (lastMsg.sender === "assistant") {
                  lastMsg.parts.push({
                    type: "toolCall",
                    toolCall: newToolCall,
                  });
                  console.log(
                    "🔧 [EDIT-DEBUG] Added tool call to existing assistant message"
                  );
                } else {
                  conv.messages.push({
                    id: Date.now().toString(),
                    sender: "assistant",
                    timestamp: new Date(),
                    parts: [
                      {
                        type: "toolCall",
                        toolCall: newToolCall,
                      },
                    ],
                  });
                  console.log(
                    "🔧 [EDIT-DEBUG] Created new assistant message with tool call"
                  );
                }
              } else {
                console.log(
                  "🔧 [EDIT-DEBUG] Tool call exists, updating with confirmation request"
                );
                // Tool call exists, update it with the confirmation request
                for (const msg of conv.messages) {
                  for (const msgPart of msg.parts) {
                    if (
                      msgPart.type === "toolCall" &&
                      msgPart.toolCall.id === toolCallId
                    ) {
                      msgPart.toolCall.confirmationRequest =
                        confirmationRequest;
                      console.log(
                        "🔍 [PERMISSION-STATUS] Setting tool call status from permission request:",
                        {
                          toolCallId: msgPart.toolCall.id,
                          oldStatus: msgPart.toolCall.status,
                          newStatus: mapAcpStatus(request.toolCall.status),
                          requestStatus: request.toolCall.status,
                        }
                      );
                      msgPart.toolCall.status = mapAcpStatus(
                        request.toolCall.status
                      );
                      console.log(
                        "🔧 [EDIT-DEBUG] Updated existing tool call with confirmation request"
                      );
                      break;
                    }
                  }
                }
              }
            });

            // Also store in the confirmation requests Map for backward compatibility
            const legacyConfirmationRequest: ToolCallConfirmationRequest = {
              requestId: parseInt(request_id, 10),
              sessionId: request.sessionId || "",
              toolCallId: toolCallId,
              label:
                request.toolCall.title ||
                request.toolCall.name ||
                "Unknown Tool",
              icon: "", // ACP doesn't use icons
              content: convertAcpContentToLegacy(
                request.toolCall.content || []
              ),
              confirmation: {
                type:
                  request.toolCall.kind === "edit"
                    ? "edit"
                    : request.toolCall.kind === "execute"
                      ? "command"
                      : "generic",
                rootCommand: undefined,
                command: undefined,
              },
              locations: (request.toolCall.locations || []).map(
                (loc: ToolLocation) => ({
                  path: loc.file || loc.directory || "unknown",
                })
              ),
              inputJsonRpc: window.pendingToolCallInput,
            };

            setConfirmationRequests((prev) => {
              const newMap = new Map(prev);
              newMap.set(toolCallId, legacyConfirmationRequest);
              console.log(
                "✅ Stored confirmation request in Map for toolCallId:",
                toolCallId
              );
              console.log(
                "✅ Total confirmation requests in Map:",
                newMap.size
              );
              return newMap;
            });
          }
        );

        // Listen for turn finished events to stop streaming indicator
        await listen<boolean>(`ai-turn-finished-${conversationId}`, () => {
          updateConversation(conversationId, (conv) => {
            conv.isStreaming = false;
          });
        });

        console.log(
          `✅✅✅ ALL event listeners successfully registered for conversation: ${conversationId}`
        );

        // Add a small delay to ensure listeners are fully active
        await new Promise((resolve) => setTimeout(resolve, 100));
        // TODO 8/17/2025: Look in to the hard-coded delaay.
      } catch (error) {
        console.error(
          "Failed to set up event listener for conversation:",
          conversationId,
          error
        );
      }
    },
    [setCliIOLogs, setConfirmationRequests, updateConversation]
  );

  return { setupEventListenerForConversation };
};
