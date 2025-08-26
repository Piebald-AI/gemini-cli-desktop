import { useState } from "react";
import { Eye, ChevronRight, FileText } from "lucide-react";
import { type ToolCall } from "../../utils/toolCallParser";

interface ReadManyFilesResult {
  content?: string;
  message?: string;
  error?: string;
  markdown?: string;
}

interface ReadManyFilesRendererProps {
  toolCall: ToolCall;
}

export function ReadManyFilesRenderer({
  toolCall,
}: ReadManyFilesRendererProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const result = (toolCall.result as ReadManyFilesResult) || {};

  // Extract file count and file list from input
  const getFileInfo = (): { fileCount: number; files: string[] } => {
    let files: string[] = [];

    try {
      if (toolCall.inputJsonRpc) {
        const input = JSON.parse(toolCall.inputJsonRpc);
        const params = input.params || {};

        // Try different parameter names
        const patterns = params.patterns || params.files || params.paths || [];
        if (Array.isArray(patterns)) {
          files = patterns.map(String);
        } else if (typeof patterns === "string") {
          files = [patterns];
        }
      }
    } catch {
      // Ignore parsing errors
    }

    // Fallback: check toolCall.parameters directly
    if (files.length === 0 && toolCall.parameters) {
      const patterns =
        toolCall.parameters.patterns ||
        toolCall.parameters.files ||
        toolCall.parameters.paths ||
        [];
      if (Array.isArray(patterns)) {
        files = patterns.map(String);
      } else if (typeof patterns === "string") {
        files = [patterns];
      }
    }

    // Final fallback: extract patterns from the label/title
    if (files.length === 0 && toolCall.label) {
      const title = toolCall.label;
      // Extract patterns from title like "Will attempt to read and concatenate files using patterns: \n**/Cargo.toml\n"
      const patternsMatch = title.match(/using patterns:\s*(.*?)\s*\(within target directory/s);
      if (patternsMatch && patternsMatch[1]) {
        // Split by newlines and clean up
        files = patternsMatch[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('('));
      }
    }

    return {
      fileCount: files.length,
      files,
    };
  };

  // Extract processed files and count from result
  const getResultInfo = (): { fileCount: number; files: string[] } => {
    let resultText = "";
    
    // Handle different result formats
    if (typeof toolCall.result === "string") {
      resultText = toolCall.result;
    } else if (result.markdown) {
      resultText = result.markdown;
    } else if (result.content) {
      resultText = result.content;
    }

    if (resultText) {
      // Extract file count from text like "Successfully read and concatenated content from **4 file(s)**."
      const countMatch = resultText.match(/from \*\*(\d+) file\(s\)\*\*/);
      const fileCount = countMatch ? parseInt(countMatch[1], 10) : 0;

      // Extract processed files from text like "**Processed Files:**\n- `file1`\n- `file2`"
      const filesMatch = resultText.match(/\*\*Processed Files:\*\*\n((?:- `.+`\n?)*)/);
      let files: string[] = [];
      
      if (filesMatch && filesMatch[1]) {
        files = filesMatch[1]
          .split("\n")
          .map((line) => line.replace(/^- `(.+)`$/, "$1"))
          .filter((line) => line.trim() && !line.startsWith("- "));
      }

      return { fileCount, files };
    }

    return { fileCount: 0, files: [] };
  };

  // Get status message
  const getStatusMessage = (): string => {
    if (result.error) {
      return `Error: ${result.error}`;
    }
    if (result.message) {
      return result.message;
    }
    return "";
  };

  const { fileCount: inputFileCount, files: inputFiles } = getFileInfo();
  const { fileCount: resultFileCount, files: resultFiles } = getResultInfo();
  const statusMessage = getStatusMessage();

  // Use result info if available (when completed), otherwise fall back to input info
  const displayFiles = resultFiles.length > 0 ? resultFiles : inputFiles;
  const displayCount = resultFileCount > 0 ? resultFileCount : inputFileCount;

  return (
    <div className="mt-4">
      <div
        className="flex items-center gap-2 text-sm px-2 py-1 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Eye className="h-4 w-4 text-blue-500" />
        <span>
          Read{" "}
          <span className="text-muted-foreground">
            {displayCount} file{displayCount === 1 ? "" : "s"}
          </span>
        </span>
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
      </div>

      {isExpanded && (
        <>
          {/* File list */}
          {displayFiles.length > 0 && (
            <div className="ml-8 mt-2 space-y-1">
              {displayFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 text-sm text-muted-foreground"
                >
                  <FileText className="h-3 w-3" />
                  <span>{file}</span>
                </div>
              ))}
            </div>
          )}

          {statusMessage && (
            <div className="ml-8 mt-2 text-sm text-muted-foreground">
              {statusMessage}
            </div>
          )}
        </>
      )}
    </div>
  );
}
