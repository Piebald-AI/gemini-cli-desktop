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
  serverName?: string;
  toolName?: string;
}

export type ErrorContent = ToolCallResult | string | null | undefined;

// MCP Permission Types
export interface McpPermissionOption {
  optionId: string;
  name: string;
  kind: "allow_always" | "allow_once" | "reject_once" | "reject_always";
}

export interface McpToolCallInfo {
  toolCallId: string;
  status: string;
  title: string;
  content: unknown[];
  locations: Location[];
  kind: string;
  serverName?: string;
  toolName?: string;
}

export interface McpPermissionRequest {
  sessionId: string;
  options: McpPermissionOption[];
  toolCall: McpToolCallInfo;
}

// Re-export MCP types
export * from "./mcp";
