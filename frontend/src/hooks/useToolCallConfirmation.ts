import { useState, useCallback } from "react";
import { api } from "../lib/api";
import { ToolCallConfirmationRequest } from "../utils/toolCallParser";
import { Conversation, Message } from "../types";

interface UseToolCallConfirmationProps {
  activeConversation: string | null;
  updateConversation: (
    conversationId: string,
    updateFn: (conv: Conversation, lastMsg: Message) => void
  ) => void;
}

export const useToolCallConfirmation = ({
  activeConversation,
  updateConversation,
}: UseToolCallConfirmationProps) => {
  const [confirmationRequests, setConfirmationRequests] = useState<
    Map<string, ToolCallConfirmationRequest>
  >(new Map());

  const handleConfirmToolCall = useCallback(
    async (toolCallId: string, outcome: string) => {
      const confirmationRequest = confirmationRequests.get(toolCallId);
      if (!confirmationRequest) {
        console.error("No confirmation request found for toolCallId:", toolCallId);
        return;
      }

      try {
        await api.invoke("send_tool_call_confirmation_response", {
          sessionId: confirmationRequest.sessionId,
          requestId: confirmationRequest.requestId,
          toolCallId: toolCallId,
          outcome,
        });

        // If approved, update the tool call status in the UI
        if (outcome === "proceed_once" || outcome === "proceed_always" || outcome === "proceed_always_server" || outcome === "proceed_always_tool" || outcome.startsWith("alwaysAllow")) {
          updateConversation(activeConversation!, (conv) => {
            let found = false;
            for (const msg of conv.messages) {
              for (const msgPart of msg.parts) {
                if (
                  msgPart.type === "toolCall" &&
                  msgPart.toolCall.id === toolCallId
                ) {
                  // PRESERVE the confirmation request data when changing status
                  const preservedConfirmationRequest =
                    msgPart.toolCall.confirmationRequest || confirmationRequest;
                  msgPart.toolCall.status = "running";
                  msgPart.toolCall.confirmationRequest =
                    preservedConfirmationRequest;
                  found = true;
                  return;
                }
              }
            }
            if (!found) {
              console.error("Tool call not found for status update:", toolCallId);
            }
          });
        } else {
          // If rejected, mark as failed
          updateConversation(activeConversation!, (conv) => {
            let found = false;
            for (const msg of conv.messages) {
              for (const msgPart of msg.parts) {
                if (
                  msgPart.type === "toolCall" &&
                  msgPart.toolCall.id === toolCallId
                ) {
                  msgPart.toolCall.status = "failed";
                  msgPart.toolCall.result = {
                    markdown: "Tool call rejected by user",
                  };
                  // Add a permanent rejection flag that can't be overridden
                  (msgPart.toolCall as any).isUserRejected = true;
                  found = true;
                  return;
                }
              }
            }
            if (!found) {
              console.error("🔧 [EDIT-DEBUG] Tool call not found in conversation for rejection:", toolCallId);
            }
          });
        }

        // Remove the confirmation request from the map
        setConfirmationRequests((prev) => {
          const newMap = new Map(prev);
          newMap.delete(toolCallId);
          return newMap;
        });
      } catch (error) {
        console.error("Failed to send tool call confirmation:", error);
      }
    },
    [confirmationRequests, activeConversation, updateConversation]
  );

  return {
    confirmationRequests,
    setConfirmationRequests,
    handleConfirmToolCall,
  };
};
