import { type ToolCall } from "./toolCallParser";

export interface ParsedToolInput {
  description: string;
  primaryParam: string | null;
  allParams: Record<string, unknown>;
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
    const description = this.generateDescription(name, allParams);
    primaryParam = this.extractPrimaryParam(name, allParams);

    return {
      description,
      primaryParam,
      allParams,
    };
  }

  private static generateDescription(
    toolName: string,
    params: Record<string, unknown>
  ): string {
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

      case "grep":
      case "glob": {
        const pattern = params.pattern || params.query || params.glob || "files";
        return `Searching ${pattern}`;
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
