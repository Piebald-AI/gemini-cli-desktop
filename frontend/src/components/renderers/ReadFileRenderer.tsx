import { useState } from "react";
import { FileText, Eye, ChevronRight } from "lucide-react";
import { type ToolCall } from "../../utils/toolCallParser";

interface ReadFileResult {
  content?: string;
  message?: string;
  error?: string;
  markdown?: string;
}

interface ReadFileRendererProps {
  toolCall: ToolCall;
}

export function ReadFileRenderer({ toolCall }: ReadFileRendererProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const result = (toolCall.result as ReadFileResult) || {};

  // Extract file info from input - handles both single and multiple files
  const getFileInfo = (): {
    isMultiple: boolean;
    files: string[];
    displayPath: string;
    isPatternBased: boolean;
  } => {
    let files: string[] = [];
    let isPatternBased = false;

    // First, check if this is actually a ReadManyFiles result by looking at the markdown
    if (result?.markdown && typeof result.markdown === "string") {
      const markdown = result.markdown;

      // Check if it's a ReadManyFiles result
      if (
        markdown.includes("ReadManyFiles Result") ||
        markdown.includes("Processed Files:")
      ) {
        isPatternBased = false; // It's resolved files now, not patterns

        // Extract processed files from markdown
        const processedMatch = markdown.match(
          /\*\*Processed Files:\*\*\n((?:- `.+`\n?)*)/
        );
        if (processedMatch && processedMatch[1]) {
          files = processedMatch[1]
            .split("\n")
            .map((line) => line.replace(/^- `(.+)`$/, "$1"))
            .filter((line) => line.trim() && !line.startsWith("- "));
        }

        if (files.length > 0) {
          return {
            isMultiple: true,
            files,
            displayPath: `${files.length} files`,
            isPatternBased,
          };
        }
      }
    }

    // Fallback to original parsing logic
    try {
      if (toolCall.inputJsonRpc) {
        const input = JSON.parse(toolCall.inputJsonRpc);
        const params = input.params || {};

        // Check for locations array first
        if (
          params.locations &&
          Array.isArray(params.locations) &&
          params.locations.length > 0
        ) {
          files = params.locations.map((loc: unknown) =>
            typeof loc === "object" && loc !== null && "path" in loc
              ? (loc as { path: string }).path
              : String(loc)
          );
        }
        // If locations is empty but we have a label with patterns, parse the label
        else if (
          params.locations &&
          Array.isArray(params.locations) &&
          params.locations.length === 0 &&
          params.label
        ) {
          isPatternBased = true;
          // Extract patterns from label like "Will attempt to read and concatenate files using patterns: `**/Cargo.toml`"
          const patternMatch = params.label.match(/using patterns?: `([^`]+)`/);
          if (patternMatch) {
            files = [patternMatch[1]];
          } else {
            // Fallback: look for any backtick-enclosed patterns in the label
            const patterns = params.label.match(/`([^`]+)`/g);
            if (patterns) {
              files = patterns.map((p: string) => p.replace(/`/g, ""));
            }
          }
        }
        // Fallback to single file parameters
        else if (
          params.file ||
          params.path ||
          params.filename ||
          params.filePath
        ) {
          const singleFile =
            params.file || params.path || params.filename || params.filePath;
          files = [singleFile];
        }
      }
    } catch {
      // Ignore parsing errors
    }

    // Fallback: check toolCall.parameters directly
    if (files.length === 0 && toolCall.parameters?.locations) {
      if (Array.isArray(toolCall.parameters.locations)) {
        files = toolCall.parameters.locations.map((loc: unknown) =>
          typeof loc === "object" && loc !== null && "path" in loc
            ? (loc as { path: string }).path
            : String(loc)
        );
      }
    }

    if (files.length === 0) {
      files = [result?.message || "unknown file"];
    }

    return {
      isMultiple: files.length > 1 || isPatternBased,
      files,
      displayPath: files.length === 1 ? files[0] : `${files.length} files`,
      isPatternBased,
    };
  };

  // Get status message
  const getStatusMessage = (_fileInfo: {
    isMultiple: boolean;
    files: string[];
  }): string => {
    if (result.error) {
      return `Error: ${result.error}`;
    }
    if (result.message) {
      return result.message;
    }
    if (result.content) {
      const lines = result.content.split("\n").length;
      return `Read ${lines} lines`;
    }
    return "";
  };

  const fileInfo = getFileInfo();
  const statusMessage = getStatusMessage(fileInfo);

  return (
    <div className="mt-4">
      {fileInfo.isMultiple ? (
        // Multiple files - collapsible like DirectoryRenderer
        <>
          <div
            className="flex items-center gap-2 text-sm px-2 py-1 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Eye className="h-4 w-4 text-blue-500" />
            <span>Read </span>
            {fileInfo.isPatternBased ? (
              <span>files matching</span>
            ) : (
              <>
                <span className="font-medium">{fileInfo.files.length}</span>
                <span>file{fileInfo.files.length === 1 ? "" : "s"}</span>
              </>
            )}
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                isExpanded ? "rotate-90" : ""
              }`}
            />
          </div>
          {isExpanded && (
            <div className="ml-8 mt-2 space-y-1">
              {fileInfo.files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 text-sm text-muted-foreground"
                >
                  <FileText className="h-3 w-3" />
                  {fileInfo.isPatternBased ? (
                    <code className="bg-muted px-1 rounded">{file}</code>
                  ) : (
                    <span>{file}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        // Single file - simple display, not collapsible
        <>
          <div className="flex items-center gap-2 text-sm px-2 py-1">
            <Eye className="h-4 w-4 text-blue-500" />
            <span>Read </span>
            <span className="text-muted-foreground">
              {fileInfo.displayPath}
            </span>
          </div>
          {statusMessage && (
            <div className="ml-8 text-sm text-muted-foreground">
              {statusMessage}
            </div>
          )}
        </>
      )}
    </div>
  );
}
