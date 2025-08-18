import { type ToolCall } from "./toolCallParser";

export interface ParsedToolInput {
  description: string;
  primaryParam: string | null;
  allParams: Record<string, unknown>;
  formattedDescription?: {
    parts: Array<{
      text: string;
      isHighlighted: boolean;
    }>;
  };
}

export class ToolInputParser {
  static parseToolInput(toolCall: ToolCall): ParsedToolInput {
    let allParams: Record<string, unknown> = {};
    let primaryParam: string | null = null;

    // First try to get parameters from inputJsonRpc
    try {
      if (toolCall.inputJsonRpc) {
        const input = JSON.parse(toolCall.inputJsonRpc);
        allParams = input.params || {};
      }
    } catch {
      // Fallback to toolCall.parameters
      allParams = toolCall.parameters || {};
    }

    const name = toolCall.name.toLowerCase();

    // Generate human-readable description based on tool type and parameters
    const descriptionResult = this.generateDescription(
      name,
      allParams,
      toolCall.label
    );
    primaryParam = this.extractPrimaryParam(name, allParams);

    return {
      description:
        typeof descriptionResult === "string"
          ? descriptionResult
          : descriptionResult.description,
      primaryParam,
      allParams,
      formattedDescription:
        typeof descriptionResult === "object"
          ? descriptionResult.formattedDescription
          : undefined,
    };
  }

  private static generateDescription(
    toolName: string,
    params: Record<string, unknown>,
    label?: string
  ):
    | string
    | {
        description: string;
        formattedDescription: {
          parts: Array<{ text: string; isHighlighted: boolean }>;
        };
      } {
    // Helper function to parse search/glob titles like "'pattern' within path" or "'pattern' in path"
    const parseSearchTitle = (title: string, toolType: string) => {
      // Match patterns like "'Gemini' within ./" or "'**/*.md' within ." or "'fn main' in *.rs"
      const withinMatch = title.match(/^'([^']+)'\s+within\s+(.+)$/);
      if (withinMatch) {
        const [, pattern, path] = withinMatch;
        return {
          description: `${toolType} ${pattern} within ${path}`,
          formattedDescription: {
            parts: [
              { text: toolType + " ", isHighlighted: false },
              { text: pattern, isHighlighted: true },
              { text: " within ", isHighlighted: false },
              { text: path, isHighlighted: true },
            ],
          },
        };
      }

      // Match patterns like "'fn main' in *.rs within crates\\server\\src"
      const inMatch = title.match(
        /^'([^']+)'\s+in\s+([^']+?)\s+within\s+(.+)$/
      );
      if (inMatch) {
        const [, pattern, filePattern, path] = inMatch;
        return {
          description: `${toolType} ${pattern} in ${filePattern} within ${path}`,
          formattedDescription: {
            parts: [
              { text: toolType + " ", isHighlighted: false },
              { text: pattern, isHighlighted: true },
              { text: " in ", isHighlighted: false },
              { text: filePattern, isHighlighted: true },
              { text: " within ", isHighlighted: false },
              { text: path, isHighlighted: true },
            ],
          },
        };
      }
      const cleanTitle = title.replace(/^'|'$/g, ""); // Remove end and start quotes
      return {
        description: `${toolType} ${cleanTitle}`,
        formattedDescription: {
          parts: [
            { text: toolType + " ", isHighlighted: false },
            { text: cleanTitle, isHighlighted: true },
          ],
        },
      };
    };

    switch (toolName) {
      case "list_directory": {
        const locations = params.locations;
        const path =
          params.path ||
          (Array.isArray(locations) && locations.length > 0
            ? locations[0]
            : locations) ||
          ".";
        return `Listing files in ${path}`;
      }

      case "search_files": {
        const pattern = params.pattern || params.query || "unknown pattern";
        const searchPath = params.path || ".";
        return `Searching for "${pattern}" in ${searchPath}`;
      }

      case "search_file_content":
      case "grep": {
        // Use the parsed title if available (from ACP updates)
        if (label) {
          return parseSearchTitle(label, "Grepped");
        }
        const pattern = params.pattern || params.query || "unknown pattern";
        return `Searching ${pattern}`;
      }

      case "glob": {
        // Use the parsed title if available (from ACP updates)
        if (label) {
          return parseSearchTitle(label, "Globbed");
        }
        const pattern = params.pattern || params.glob || "files";
        return `Finding ${pattern}`;
      }

      case "read_file": {
        const file = params.file || params.path || "unknown file";
        return `Reading file ${file}`;
      }

      case "read_many_files":
      case "ReadManyFiles": {
        // Extract patterns or file paths
        const patterns = params.patterns || params.files || [];
        const fileCount = Array.isArray(patterns) ? patterns.length : 1;
        return `Reading ${fileCount} file${fileCount === 1 ? "" : "s"}`;
      }

      case "write_file":
      case "writefile": {
        const writeFile = params.file || params.path || "unknown file";
        const hasContent = params.content || params.text;
        return hasContent
          ? `Writing content to ${writeFile}`
          : `Creating file ${writeFile}`;
      }

      case "run_shell_command":
      case "execute_command": {
        const command = params.command || params.cmd || "unknown command";
        // Truncate long commands
        const shortCommand =
          typeof command === "string" && command.length > 50
            ? command.substring(0, 50) + "..."
            : command;
        return `Executing: ${shortCommand}`;
      }

      case "delete_file":
      case "remove_file": {
        const deleteFile = params.file || params.path || "unknown file";
        return `Deleting file ${deleteFile}`;
      }

      case "create_directory":
      case "mkdir": {
        const dirPath = params.path || params.directory || "unknown directory";
        return `Creating directory ${dirPath}`;
      }

      case "copy_file": {
        const source = params.source || params.src || "unknown source";
        const dest = params.destination || params.dest || "unknown destination";
        return `Copying ${source} to ${dest}`;
      }

      case "move_file": {
        const moveSource = params.source || params.src || "unknown source";
        const moveDest =
          params.destination || params.dest || "unknown destination";
        return `Moving ${moveSource} to ${moveDest}`;
      }

      case "google_web_search":
      case "web_search":
      case "search_web": {
        const query = params.query || params.q || "unknown query";
        return `Searching web for "${query}"`;
      }

      case "get_weather": {
        const location = params.location || params.city || "unknown location";
        return `Getting weather for ${location}`;
      }

      case "api_call":
      case "fetch": {
        const url = params.url || "unknown URL";
        const method = params.method || "GET";
        return `${method} request to ${url}`;
      }

      default: {
        // If we have a label, try to use it directly for unknown tools
        if (label) {
          return `Using ${toolName}: ${label}`;
        }

        // Generic fallback
        const mainParam = this.extractPrimaryParam(toolName, params);
        if (mainParam) {
          return `Using ${toolName} with ${mainParam}`;
        }

        // If no obvious primary param, show the tool name with param count
        const paramCount = Object.keys(params).length;
        return paramCount > 0
          ? `Using ${toolName} with ${paramCount} parameter${paramCount === 1 ? "" : "s"}`
          : `Using ${toolName}`;
      }
    }
  }

  private static extractPrimaryParam(
    toolName: string,
    params: Record<string, unknown>
  ): string | null {
    // Define primary parameter names for each tool type
    const primaryParamMap: Record<string, string[]> = {
      list_directory: ["path", "directory", "locations"],
      search_files: ["pattern", "query", "search"],
      read_file: ["file", "path", "filename"],
      read_many_files: ["patterns", "files", "paths"],
      ReadManyFiles: ["patterns", "files", "paths"],
      write_file: ["file", "path", "filename"],
      execute_command: ["command", "cmd"],
      delete_file: ["file", "path"],
      create_directory: ["path", "directory", "dir"],
      copy_file: ["source", "src", "from"],
      move_file: ["source", "src", "from"],
      web_search: ["query", "q", "search"],
      get_weather: ["location", "city", "place"],
      api_call: ["url", "endpoint"],
    };

    const possibleParams = primaryParamMap[toolName] || [
      "path",
      "file",
      "query",
      "command",
      "url",
    ];

    // Find the first matching parameter
    for (const paramName of possibleParams) {
      if (params[paramName]) {
        const value = params[paramName];
        // Handle array parameters (like locations)
        if (Array.isArray(value) && value.length > 0) {
          return String(value[0]);
        }
        return String(value);
      }
    }

    // Fallback: return the first parameter value
    const paramKeys = Object.keys(params);
    if (paramKeys.length > 0) {
      const firstParam = params[paramKeys[0]];
      if (Array.isArray(firstParam) && firstParam.length > 0) {
        return String(firstParam[0]);
      }
      return String(firstParam);
    }

    return null;
  }

  // Helper to extract just the path/location for breadcrumb purposes
  static extractPath(toolCall: ToolCall): string | null {
    const parsed = this.parseToolInput(toolCall);
    const { allParams } = parsed;

    // Common path parameter names
    const pathParams = ["path", "directory", "file", "location"];

    for (const param of pathParams) {
      if (allParams[param]) {
        const value = allParams[param];
        if (Array.isArray(value) && value.length > 0) {
          return String(value[0]);
        }
        return String(value);
      }
    }

    return null;
  }
}
