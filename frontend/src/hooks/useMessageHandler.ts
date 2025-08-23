import React, { useState, useCallback } from "react";
import { api } from "../lib/api";
import { Message, Conversation } from "../types";
import { useBackend } from "../contexts/BackendContext";

interface UseMessageHandlerProps {
  activeConversation: string | null;
  conversations: Conversation[];
  selectedModel: string;
  isCliInstalled: boolean | null;
  updateConversation: (
    conversationId: string,
    updateFn: (conv: Conversation, lastMsg: Message) => void
  ) => void;
  createNewConversation: (
    id: string,
    title: string,
    messages: Message[],
    isStreaming: boolean
  ) => Conversation;
  setActiveConversation: (id: string) => void;
  setupEventListenerForConversation: (conversationId: string) => Promise<void>;
  fetchProcessStatuses: () => Promise<void>;
}

export const useMessageHandler = ({
  activeConversation,
  conversations,
  selectedModel,
  isCliInstalled,
  updateConversation,
  createNewConversation,
  setActiveConversation,
  setupEventListenerForConversation,
  fetchProcessStatuses,
}: UseMessageHandlerProps) => {
  const [input, setInput] = useState("");
  const { selectedBackend, getApiConfig, state: backendState } = useBackend();

  const handleInputChange = useCallback(
    (
      _event: React.ChangeEvent<HTMLInputElement> | null,
      newValue: string,
      _newPlainTextValue: string,
      _mentions: unknown[]
    ) => {
      setInput(newValue);
    },
    []
  );

  const generateTitleIfNeeded = useCallback(
    async (conversationId: string, messages: Message[]) => {
      const userMessageCount = messages.filter(
        (msg) => msg.sender === "user"
      ).length;

      if (userMessageCount === 3) {
        const userMessages = messages
          .filter((msg) => msg.sender === "user")
          .map((msg) => msg.parts[0].text)
          .join(" | ");

        try {
          const generatedTitle = await api.generate_conversation_title({
            message: userMessages,
            model: selectedModel,
          });
          updateConversation(conversationId, (conv) => {
            conv.title = generatedTitle;
          });
        } catch (error) {
          console.error("Failed to generate conversation title:", error);
        }
      }
    },
    [selectedModel, updateConversation]
  );

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!input.trim() || !isCliInstalled) {
        return;
      }

      const newMessage: Message = {
        id: Date.now().toString(),
        parts: [
          {
            type: "text",
            text: input,
          },
        ],
        sender: "user",
        timestamp: new Date(),
      };

      let convId: string;
      if (activeConversation) {
        convId = activeConversation;

        updateConversation(activeConversation, (conv) => {
          conv.messages.push(newMessage);
        });

        // Check if this is the 3rd user message and generate title
        const currentConv = conversations.find(
          (c) => c.id === activeConversation
        );
        if (currentConv) {
          await generateTitleIfNeeded(activeConversation, currentConv.messages);
        }
      } else {
        // Create a new conversation with this message.
        convId = Date.now().toString();
        createNewConversation(convId, input.slice(0, 50), [newMessage], true);
        setActiveConversation(convId);
        // IMPORTANT: Wait for event listeners to be fully set up before proceeding
        await setupEventListenerForConversation(convId);
      }

      const messageText = input;

      setInput("");

      // Check if user is trying to use the disabled model.
      if (selectedModel === "gemini-2.5-flash-lite") {
        updateConversation(convId, (conv) => {
          conv.messages.push({
            id: (Date.now() + 1).toString(),
            parts: [
              {
                type: "text",
                text: "Unfortunately, Gemini 2.5 Flash-Lite isn't usable due to thinking issues. See issues [#1953](https://github.com/google-gemini/gemini-cli/issues/1953) and [#4548](https://github.com/google-gemini/gemini-cli/issues/4548) on the Gemini CLI repository for more details.  PRs [#3033](https://github.com/google-gemini/gemini-cli/pull/3033) and [#4652](https://github.com/google-gemini/gemini-cli/pull/4652) resolve this issue.",
              },
            ],
            sender: "assistant",
            timestamp: new Date(),
          });
        });
        return;
      }

      try {
        // Get backend configuration
        const apiConfig = getApiConfig();
        console.log("🔍 [useMessageHandler] selectedBackend:", selectedBackend);
        console.log("🔍 [useMessageHandler] apiConfig:", apiConfig);
        let backendConfig = undefined;
        let geminiAuth = undefined;

        if (selectedBackend === "qwen") {
          // Always set backend_config for Qwen, even with OAuth
          // This ensures the backend knows to use qwen CLI instead of gemini CLI
          backendConfig = {
            api_key: apiConfig?.api_key || "", // Empty string if OAuth
            base_url: apiConfig?.base_url || "https://openrouter.ai/api/v1",
            model: apiConfig?.model || selectedModel,
          };
          console.log(
            "🔍 [useMessageHandler] Setting backend_config for Qwen:",
            backendConfig
          );
        } else if (selectedBackend === "gemini") {
          const geminiConfig = backendState.configs.gemini;
          geminiAuth = {
            // Tauri auto-converts to gemini_auth
            method: geminiConfig.authMethod,
            api_key:
              geminiConfig.authMethod === "gemini-api-key"
                ? geminiConfig.apiKey
                : undefined,
            vertex_project:
              geminiConfig.authMethod === "vertex-ai"
                ? geminiConfig.vertexProject
                : undefined,
            vertex_location:
              geminiConfig.authMethod === "vertex-ai"
                ? geminiConfig.vertexLocation
                : undefined,
          };
        }

        await api.start_session({
          sessionId: convId,
          workingDirectory: ".",
          model: selectedModel,
          backendConfig,
          geminiAuth
        });

        await api.send_message({
          sessionId: convId, // Tauri auto-converts to session_id
          message: messageText,
          conversationHistory: "", // Tauri auto-converts to conversation_history
          model: selectedModel,
          backendConfig: backendConfig, // Tauri auto-converts to backend_config
        });

        // Refresh process statuses after sending message
        await fetchProcessStatuses();
      } catch (error) {
        console.error("Failed to send message:", error);

        updateConversation(convId, (conv) => {
          conv.messages.push({
            id: (Date.now() + 1).toString(),
            parts: [{ type: "text", text: `❌ **Error:** ${error}` }],
            sender: "assistant",
            timestamp: new Date(),
          });
        });
      }
    },
    [
      input,
      isCliInstalled,
      activeConversation,
      conversations,
      selectedModel,
      backendState.configs.gemini,
      getApiConfig,
      selectedBackend,
      updateConversation,
      createNewConversation,
      setActiveConversation,
      setupEventListenerForConversation,
      fetchProcessStatuses,
      generateTitleIfNeeded,
    ]
  );

  return {
    input,
    setInput,
    handleInputChange,
    handleSendMessage,
  };
};
