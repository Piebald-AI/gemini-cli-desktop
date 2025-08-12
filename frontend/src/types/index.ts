import { type ToolCall, type ToolCallResult } from "../utils/toolCallParser";

export interface ThinkingMessagePart {
  type: "thinking";
  thinking: string;
}

export interface TextMessagePart {
  type: "text";
  text: string;
}

export interface ToolCallMessagePart {
  type: "toolCall";
  toolCall: ToolCall;
}

export type GeminiMessagePart =
  | ThinkingMessagePart
  | TextMessagePart
  | ToolCallMessagePart;

export type UserMessagePart = TextMessagePart;

export type Message = {
  id: string;
  timestamp: Date;
} & (
  | {
      sender: "user";
      parts: UserMessagePart[];
    }
  | {
      sender: "assistant";
      parts: GeminiMessagePart[];
    }
);

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: Date;
  isStreaming: boolean;
}

export interface CliIO {
  timestamp: Date;
  type: "input" | "output";
  data: string;
  conversationId: string;
}

export interface Location {
  path: string;
  line?: number;
  column?: number;
}

export interface ProcessStatus {
  conversation_id: string;
  pid: number | null;
  created_at: number;
  is_alive: boolean;
}

export interface ToolCallEvent {
  id: number;
  name: string;
  locations?: Location[];
  label?: string;
  icon?: string;
}

export interface ToolCallUpdateEvent {
  toolCallId: string | number;
  status: string;
  content?: ToolCallResult;
}

export type ErrorContent = ToolCallResult | string | null | undefined;

// Re-export MCP types
export * from "./mcp";
