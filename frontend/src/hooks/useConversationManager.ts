import { useState, useCallback } from "react";
import { Conversation, Message } from "../types";
import { api } from "../lib/api";
import { ConversationHistoryEntry } from "../lib/webApi";

export const useConversationManager = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(
    null
  );

  const currentConversation = conversations.find(
    (c) => c.id === activeConversation
  );

  const updateConversation = useCallback(
    (
      conversationId: string,
      updateFn: (conv: Conversation, lastMsg: Message) => void
    ) => {
      setConversations((prev) => {
        const clone: Conversation[] = structuredClone(prev);
        const curConv = clone.find((c) => c.id === conversationId);
        if (!curConv) {
          console.error(`Conversation with ID ${conversationId} not found.`);
          return prev;
        }
        const lastMsg = curConv.messages[curConv.messages.length - 1];
        updateFn(curConv, lastMsg);
        curConv.lastUpdated = new Date();
        return clone;
      });
    },
    []
  );

  const createNewConversation = useCallback(
    (
      id: string,
      title: string,
      messages: Message[] = [],
      isStreaming = false,
      workingDirectory?: string
    ) => {
      const newConversation: Conversation = {
        id,
        title,
        messages,
        lastUpdated: new Date(),
        isStreaming,
        isActive: true, // New conversations are active by default
        isNew: true,
        workingDirectory: workingDirectory?.replace(/\\/g, "/").toLowerCase(),
        // For new conversations, use the id as both id and timestamp
        metadata: { timestamp: id, chatId: id },
      };
      setConversations((prev) => [newConversation, ...prev]);
      // Note: Don't set active conversation here, let the caller do it
      return newConversation;
    },
    []
  );

  const loadConversationFromHistory = useCallback(async (
    chatId: string, 
    title?: string, 
    historyEntries?: ConversationHistoryEntry[], 
    workingDirectory?: string
  ) => {
    try {
      console.log("🔄 Loading conversation from history:", chatId);
      
      // Extract timestamp from historical chat ID (format: project_hash/rpc-log-timestamp.log)
      const timestampMatch = chatId.match(/rpc-log-(\d+)\.log$/);
      const timestamp = timestampMatch ? timestampMatch[1] : null;
      
      // Check if there's already an active conversation with this timestamp or chatId
      if (timestamp) {
        // First check by timestamp (for active sessions)
        const existingConversation = conversations.find(c => c.id === timestamp);
        if (existingConversation) {
          console.log("🔄 Found existing active conversation with timestamp:", timestamp);
          setActiveConversation(timestamp);
          return existingConversation;
        }
        
        // Also check by chatId (for historical sessions that might already be loaded)
        const existingByChatId = conversations.find(c => c.id === chatId);
        if (existingByChatId) {
          console.log("🔄 Found existing conversation with chatId:", chatId);
          setActiveConversation(chatId);
          return existingByChatId;
        }
      }
      
      let detailedConversation;
      let messages: Message[];
      let conversationTitle: string;
      
      if (historyEntries && title) {
        // Use provided data (from project detail page)
        console.log("📥 Using provided conversation data");
        messages = historyEntries.map((entry: ConversationHistoryEntry) => ({
          id: entry.id,
          timestamp: new Date(entry.timestamp_iso),
          sender: entry.role as "user" | "assistant",
          parts: [
            {
              type: "text" as const,
              text: entry.content,
            }
          ],
        }));
        conversationTitle = title;
      } else {
        // Fetch from API (original behavior)
        console.log("🌐 Calling API with chatId:", chatId);
        detailedConversation = await api.get_detailed_conversation({ chatId });
        console.log("📥 Received detailed conversation:", detailedConversation);
        console.log("📥 Chat info:", detailedConversation.chat);
        console.log("📥 Raw messages:", detailedConversation.messages);
        console.log("📥 Messages type:", typeof detailedConversation.messages);
        console.log("📥 Messages length:", detailedConversation.messages?.length);
        
        if (!detailedConversation.messages || detailedConversation.messages.length === 0) {
          console.warn("⚠️  API returned no messages for chatId:", chatId);
        }
        
        messages = (detailedConversation.messages || []).map((entry: ConversationHistoryEntry) => {
          console.log("🔄 Converting message entry:", entry);
          return {
            id: entry.id,
            timestamp: new Date(entry.timestamp_iso),
            sender: entry.role as "user" | "assistant",
            parts: [
              {
                type: "text" as const,
                text: entry.content,
              }
            ],
          };
        });
        conversationTitle = detailedConversation.chat.title;
      }

      console.log("🔄 Converted messages:", messages);
      console.log("📊 Messages count:", messages.length);
      
      if (messages.length === 0) {
        console.warn("⚠️  No messages found in conversation!");
      } else {
        console.log("📝 First message:", messages[0]);
        console.log("📝 Last message:", messages[messages.length - 1]);
      }

      // Determine the best ID to use:
      // 1. If there's an active process with the timestamp, use timestamp
      // 2. Otherwise, use the original chatId to avoid duplicates
      let conversationId = chatId; // Default to chatId
      
      if (timestamp) {
        // Check if there's an active process that matches this timestamp
        // We'll need to check this via a separate mechanism since processStatuses 
        // is not available in this hook. For now, use chatId as default.
        // The process matching will be handled in the ConversationList component.
        conversationId = chatId;
        
        // Store both IDs for future reference
        console.log("📝 Mapping: chatId =", chatId, ", timestamp =", timestamp);
      }
      
      const conversation: Conversation = {
        id: conversationId,
        title: conversationTitle,
        messages,
        lastUpdated: new Date(),
        isStreaming: false,
        isActive: false, // Loaded conversations are not active by default
        isNew: false,
        workingDirectory: workingDirectory?.replace(/\\/g, "/").toLowerCase(),
        // Store the timestamp for process matching if available
        metadata: timestamp ? { timestamp, chatId } : { chatId },
      };

      console.log("✅ Created conversation:", conversation);

      // Check if conversation already exists and replace it, otherwise add it
      setConversations((prev) => {
        // Check for exact ID match
        const existingIndex = prev.findIndex(c => c.id === conversationId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = conversation;
          console.log("🔄 Updated existing conversation with ID:", conversationId);
          return updated;
        }
        
        // Check for related conversations (same timestamp or chatId) to prevent duplicates
        const relatedIndex = prev.findIndex(c => {
          // If the new conversation has a timestamp, check if any existing conversation 
          // has the same timestamp or chatId
          if (timestamp) {
            return (
              c.metadata?.timestamp === timestamp ||
              c.metadata?.chatId === chatId ||
              c.id === timestamp
            );
          }
          // If no timestamp, just check chatId
          return c.metadata?.chatId === chatId;
        });
        
        if (relatedIndex >= 0) {
          console.log("🔄 Found related conversation, updating instead of duplicating");
          const updated = [...prev];
          // Merge metadata to preserve both IDs
          const existingMetadata = updated[relatedIndex].metadata || {};
          updated[relatedIndex] = {
            ...conversation,
            metadata: {
              ...existingMetadata,
              ...conversation.metadata,
            },
          };
          return updated;
        }
        
        console.log("➕ Adding new conversation with ID:", conversationId);
        return [conversation, ...prev];
      });

      // Set this conversation as active
      console.log("🎯 Setting active conversation:", conversationId);
      setActiveConversation(conversationId);

      console.log("✅ Conversation loaded successfully!");
      return conversation;
    } catch (error) {
      console.error("Failed to load conversation:", error);
      throw error;
    }
  }, [conversations]);

  const removeConversation = useCallback((conversationId: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    if (activeConversation === conversationId) {
      setActiveConversation(null);
    }
  }, [activeConversation]);

  return {
    conversations,
    activeConversation,
    currentConversation,
    setActiveConversation,
    updateConversation,
    createNewConversation,
    loadConversationFromHistory,
    removeConversation,
    setConversations,
  };
};
