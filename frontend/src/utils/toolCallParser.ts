export type ToolCallResult =
  | {
      files?: Array<{ name: string; type: string; length?: number }>;
      matches?: Array<unknown>;
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
  content: ToolCallConfirmationContent | null;
  confirmation: {
    type: "edit" | "command" | "generic" | "mcp";
    rootCommand?: string;
    command?: string;
    serverName?: string;
    toolName?: string;
    toolDisplayName?: string;
  };
  locations: Array<{ path: string; line?: number; column?: number }>;
  inputJsonRpc?: string;
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
  // For JSON-RPC confirmation requests
  confirmationRequest?: ToolCallConfirmationRequest;
}

export interface ParsedContent {
  text: string;
  toolCalls: ToolCall[];
}

export class ToolCallParser {
  private static toolCallCounter = 0;

  static parseGeminiOutput(output: string): ParsedContent {
    const toolCalls: ToolCall[] = [];
    let cleanedText = output;

    // First, try to parse as JSON-RPC confirmation request
    try {
      // Look for the start of JSON-RPC and try to find the complete JSON object
      const startIndex = output.indexOf('{"jsonrpc":"2.0"');

      if (startIndex !== -1) {
        // Find the matching closing brace by counting braces
        let braceCount = 0;
        let endIndex = startIndex;
        for (let i = startIndex; i < output.length; i++) {
          if (output[i] === "{") braceCount++;
          if (output[i] === "}") braceCount--;
          if (braceCount === 0) {
            endIndex = i + 1;
            break;
          }
        }

        const jsonRpcString = output.substring(startIndex, endIndex);

        const jsonRpcData = JSON.parse(jsonRpcString);

        if (jsonRpcData.method === "requestToolCallConfirmation") {
          const params = jsonRpcData.params;
          
          // Simple approach: treat all confirmations as regular tool calls
          const confirmationRequest = params as ToolCallConfirmationRequest;
          
          // For MCP tools, create a better display name
          let toolName = "tool_call";
          let displayLabel = params.label || "Tool Call";
          let displayIcon = params.icon || "🔧";
          
          if (params.confirmation && params.confirmation.type === "mcp") {
            toolName = params.confirmation.toolName || "mcp_tool";
            displayLabel = params.confirmation.toolDisplayName || params.confirmation.toolName || "MCP Tool";
            displayIcon = "🔌";
          } else if (confirmationRequest.confirmation?.type === "edit") {
            toolName = "edit_file";
          }
          
          const toolCall: ToolCall = {
            id: `tool_${++this.toolCallCounter}_${jsonRpcData.id || Date.now()}`,
            name: toolName,
            parameters: {
              file_path: confirmationRequest.content?.path,
              old_string: confirmationRequest.content?.oldText,
              new_string: confirmationRequest.content?.newText,
              locations: confirmationRequest.locations,
              serverName: params.confirmation?.serverName,
              toolName: params.confirmation?.toolName,
            },
            status: "running", // Set to running so it shows the approval buttons
            confirmationRequest,
            inputJsonRpc: jsonRpcString,
            label: displayLabel,
            icon: displayIcon,
          };

          toolCalls.push(toolCall);
          // Remove the JSON-RPC from the text
          cleanedText = cleanedText.replace(jsonRpcString, "");
        }
      }
    } catch (e) {
      console.warn("ToolCallParser", "Failed to parse as JSON-RPC format", {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Pattern to match tool calls in Gemini CLI output
    // This might look like: "Calling tool: search_web with parameters: {"query": "..."}"
    // Or: "Tool call: get_weather(location=San Francisco)"
    // Or JSON-like tool call formats

    const patterns = [
      // Pattern 1: "Calling tool: toolName with parameters: {...}"
      /Calling tool: (\w+) with parameters: ({.*?})/g,

      // Pattern 2: "Tool call: toolName({...})"
      /Tool call: (\w+)\(([^)]*)\)/g,

      // Pattern 3: Function call format "toolName({...})"
      /^(\w+)\(({.*?})\)$/gm,

      // Pattern 4: JSON-like tool calls
      /"tool_calls":\s*\[\s*{[^}]*"name":\s*"(\w+)"[^}]*"parameters":\s*({[^}]*})/g,

      // Pattern 5: MCP-style tool calls
      /\[TOOL_CALL\]\s*(\w+):\s*({.*?})\s*\[\/TOOL_CALL\]/g,

      // Pattern 6: Edit tool calls - "edit_file(file_path='...', old_string='...', new_string='...')"
      /(\w*edit\w*)\(([^)]*file_path[^)]*)\)/g,

      // Pattern 7: Multi-edit tool calls
      /(multi_edit|MultiEdit)\(([^)]*edits[^)]*)\)/g,
    ];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        try {
          const toolName = match[1];
          const parametersStr = match[2];

          let parameters: Record<string, unknown> = {};

          // Try to parse parameters as JSON first
          try {
            parameters = JSON.parse(parametersStr);
          } catch {
            // If JSON parsing fails, try to parse as key=value pairs
            parameters = this.parseKeyValueParameters(parametersStr);
          }

          // Special handling for edit tools to ensure proper parameter extraction
          if (toolName.toLowerCase().includes("edit")) {
            parameters = this.enhanceEditParameters(
              toolName,
              parametersStr,
              parameters
            );
          }

          const toolCall: ToolCall = {
            id: `tool_${++this.toolCallCounter}_${Date.now()}`,
            name: toolName,
            parameters,
            status: "pending",
          };

          toolCalls.push(toolCall);

          // Remove the tool call text from the main content
          cleanedText = cleanedText.replace(match[0], "");
        } catch (error) {
          console.warn("Failed to parse tool call:", match[0], error);
        }
      }
    });

    // Look for tool results
    this.parseToolResults(output, toolCalls);

    const result = {
      text: cleanedText.trim(),
      toolCalls,
    };

    return result;
  }

  private static parseToolResults(output: string, toolCalls: ToolCall[]) {
    // Pattern to match tool results
    const resultPatterns = [
      // Pattern 1: "Tool result: {...}"
      /Tool result: ({.*?})/g,

      // Pattern 2: "Result from toolName: {...}"
      /Result from (\w+): ({.*?})/g,

      // Pattern 3: MCP-style results
      /\[TOOL_RESULT\]\s*({.*?})\s*\[\/TOOL_RESULT\]/g,

      // Pattern 4: Simple success/error messages
      /(Tool executed successfully|Tool execution failed|Error executing tool)/g,
    ];

    resultPatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        try {
          // Find the most recent tool call to attach this result to
          const latestToolCall = toolCalls[toolCalls.length - 1];
          if (latestToolCall && !latestToolCall.result) {
            if (match[1] && match[1].startsWith("{")) {
              // JSON result
              latestToolCall.result = JSON.parse(match[1]);
            } else {
              // Text result
              latestToolCall.result = { message: match[0] };
            }
            latestToolCall.status = "completed";
          }
        } catch (error) {
          console.warn("Failed to parse tool result:", match[0], error);
        }
      }
    });
  }

  static detectStreamingToolCall(chunk: string): {
    isToolCall: boolean;
    toolName?: string;
    isComplete: boolean;
  } {
    // Detect if the current chunk is part of a tool call
    const toolCallStart = /Calling tool:|Tool call:|^\w+\(/;
    const toolCallEnd = /\)$|}\s*$/;

    return {
      isToolCall: toolCallStart.test(chunk),
      toolName: chunk.match(/(?:Calling tool:|Tool call:)\s*(\w+)/)?.[1],
      isComplete: toolCallEnd.test(chunk),
    };
  }

  private static parseKeyValueParameters(
    parametersStr: string
  ): Record<string, unknown> {
    const parameters: Record<string, unknown> = {};

    if (parametersStr.includes("=")) {
      // Handle both comma-separated and space-separated key=value pairs
      const pairs = parametersStr.split(
        /,\s*(?=\w+\s*=)|(?<=\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^,\s]+))\s+(?=\w+\s*=)/
      );
      pairs.forEach((pair) => {
        const eqIndex = pair.indexOf("=");
        if (eqIndex > 0) {
          const key = pair.substring(0, eqIndex).trim();
          const value = pair.substring(eqIndex + 1).trim();
          // Remove quotes if present
          parameters[key] = value.replace(/^["']|["']$/g, "");
        }
      });
    }

    return parameters;
  }

  private static enhanceEditParameters(
    toolName: string,
    parametersStr: string,
    existingParams: Record<string, unknown>
  ): Record<string, unknown> {
    // For edit tools, ensure we properly extract file_path, old_string, new_string, etc.
    const parameters = { ...existingParams };

    // Handle multi-edit format where edits might be an array
    if (
      toolName.toLowerCase().includes("multi") &&
      parametersStr.includes("edits")
    ) {
      try {
        // Try to extract the edits array from the parameter string
        const editsMatch = parametersStr.match(/edits\s*=\s*(\[.*?\])/s);
        if (editsMatch) {
          parameters.edits = JSON.parse(editsMatch[1]);
        }
      } catch {
        // If JSON parsing fails for edits, keep original parameters
      }
    }

    // Ensure common edit parameters are properly extracted
    const editFields = ["file_path", "old_string", "new_string", "replace_all"];
    editFields.forEach((field) => {
      if (!parameters[field]) {
        const fieldMatch = parametersStr.match(
          new RegExp(`${field}\\s*=\\s*(['"])(.*?)\\1`, "s")
        );
        if (fieldMatch) {
          parameters[field] = fieldMatch[2];
        }
      }
    });

    return parameters;
  }
}

export default ToolCallParser;
