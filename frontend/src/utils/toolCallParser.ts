// Match types for different tools
export interface SearchMatch {
  file: string;
  line_number?: number;
  line_content?: string;
  matches?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

export interface MessageMatch {
  content_snippet: string;
  line_number: number;
  context_before?: string;
  context_after?: string;
}

export type ToolCallResult =
  | {
      files?: Array<{ name: string; type: string; length?: number }>;
      matches?: SearchMatch[] | MessageMatch[];
      total?: number;
      message?: string;
      markdown?: string;
      error?: string;
      stderr?: string;
      // Edit-specific result fields
      file_path?: string;
      old_string?: string;
      new_string?: string;
      edits?: Array<{
        file_path: string;
        old_string: string;
        new_string: string;
        line_start?: number;
        line_end?: number;
      }>;
      additions?: number;
      deletions?: number;
      success?: boolean;
    }
  | string;

// JSON-RPC confirmation request structure
export interface ToolCallConfirmationContent {
  type: "diff" | "command" | "generic";
  path?: string;
  oldText?: string;
  newText?: string;
}

export interface ToolCallConfirmationRequest {
  requestId: number;
  sessionId: string;
  toolCallId?: string | null;
  label: string;
  icon: string;
  content: ToolCallConfirmationContent;
  confirmation: {
    type: "edit" | "command" | "generic";
    rootCommand?: string;
    command?: string;
  };
  locations: Array<{ path: string; line?: number; column?: number }>;
  inputJsonRpc?: string;
  // ACP permission options for enhanced approval flows
  options?: Array<{
    optionId: string;
    name: string;
    kind: "allow_once" | "allow_always" | "reject_once" | "reject_always";
  }>;
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
  result?: ToolCallResult;
  status?: "pending" | "running" | "completed" | "failed";
  inputJsonRpc?: string;
  outputJsonRpc?: string;
  label?: string;
  icon?: string;
  isUserRejected?: boolean;
  // For JSON-RPC confirmation requests
  confirmationRequest?: ToolCallConfirmationRequest;
}

export interface ParsedContent {
  text: string;
  toolCalls: ToolCall[];
}

export class ToolCallParser {
  // Legacy method - no longer used since we moved to structured ACP events
  // Kept for backward compatibility if needed
  static parseGeminiOutput(output: string): ParsedContent {
    console.warn(
      "parseGeminiOutput is deprecated - using structured events instead"
    );
    return {
      text: output,
      toolCalls: [],
    };
  }

  // Legacy methods - no longer needed with structured ACP events
  static detectStreamingToolCall(_chunk: string): {
    isToolCall: boolean;
    toolName?: string;
    isComplete: boolean;
  } {
    console.warn(
      "detectStreamingToolCall is deprecated - using structured events instead"
    );
    return {
      isToolCall: false,
      toolName: undefined,
      isComplete: true,
    };
  }
}

export default ToolCallParser;
