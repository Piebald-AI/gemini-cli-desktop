import React, { createContext, useContext } from "react";
import { Conversation, CliIO, Message } from "../types";
import { ToolCallConfirmationRequest } from "../utils/toolCallParser";
import { ConversationHistoryEntry } from "../lib/webApi";

// Context for sharing conversation state with child routes
export interface ConversationContextType {
  conversations: Conversation[];
  activeConversation: string | null;
  currentConversation: Conversation | undefined;
  input: string;
  isCliInstalled: boolean | null;
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  cliIOLogs: CliIO[];
  handleInputChange: (
    _event: React.ChangeEvent<HTMLTextAreaElement> | null,
    newValue: string,
    _newPlainTextValue: string,
    _mentions: unknown[]
  ) => void;
  handleSendMessage: (e: React.FormEvent) => Promise<void>;
  selectedModel: string;
  startNewConversation: (
    title: string,
    workingDirectory?: string,
    initialMessages?: Message[],
    conversationId?: string
  ) => Promise<string>;
  loadConversationFromHistory: (
    chatId: string,
    title?: string,
    historyEntries?: ConversationHistoryEntry[],
    workingDirectory?: string
  ) => Promise<Conversation>;
  handleConfirmToolCall: (toolCallId: string, outcome: string) => Promise<void>;
  confirmationRequests: Map<string, ToolCallConfirmationRequest>;
  removeConversation: (conversationId: string) => void;
  progress: SessionProgressPayload | null;
}

export const ConversationContext = createContext<
  ConversationContextType | undefined
>(undefined);

export const useConversation = () => {
  const context = useContext(ConversationContext);
  if (context === undefined) {
    throw new Error(
      "useConversation must be used within a ConversationProvider"
    );
  }
  return context;
};
