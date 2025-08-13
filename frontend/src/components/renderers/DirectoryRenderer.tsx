import { useState } from "react";
import { ChevronRight, FolderClosed, File } from "lucide-react";
import { type ToolCall } from "../../utils/toolCallParser";

interface DirectoryEntry {
  name: string;
  is_directory: boolean;
  full_path: string;
  size?: number;
  modified?: number;
  is_symlink?: boolean;
  symlink_target?: string;
}

interface DirectoryResult {
  entries?: DirectoryEntry[];
  files?: Array<{name: string, type: string, length?: number}>; // Legacy format
  markdown?: string;
  message?: string;
}

interface DirectoryRendererProps {
  toolCall: ToolCall;
}

export function DirectoryRenderer({ toolCall }: DirectoryRendererProps) {
  console.log("📂 DirectoryRenderer called with:", {
    toolCallName: toolCall.name,
    toolCallStatus: toolCall.status,
    result: toolCall.result,
    resultType: typeof toolCall.result,
    inputJsonRpc: toolCall.inputJsonRpc
  });
  
  const [isExpanded, setIsExpanded] = useState(false);
  const result = toolCall.result as DirectoryResult;
  
  console.log("📂 DirectoryRenderer result details:", {
    hasEntries: !!result?.entries,
    hasFiles: !!result?.files,
    entriesLength: result?.entries?.length,
    filesLength: result?.files?.length,
    resultKeys: result ? Object.keys(result) : "no result"
  });
  
  // Handle both new format (entries) and legacy format (files)
  let entries: DirectoryEntry[] = [];
  if (result.entries) {
    entries = result.entries;
  } else if (result.files) {
    // Convert legacy format
    entries = result.files.map(file => ({
      name: file.name,
      is_directory: file.type === 'directory',
      full_path: file.name,
      size: file.length,
    }));
  }

  // Extract path from input JSON-RPC
  const getPath = (): string => {
    try {
      if (toolCall.inputJsonRpc) {
        const input = JSON.parse(toolCall.inputJsonRpc);
        return input.params?.path || input.params?.locations?.[0] || '.';
      }
    } catch {}
    return '.';
  };

  // Sort entries (directories first, then files, both alphabetically)
  const sortedEntries = [...entries].sort((a, b) => {
    // Always show directories first
    if (a.is_directory && !b.is_directory) return -1;
    if (!a.is_directory && b.is_directory) return 1;
    
    // Then sort alphabetically
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  const path = getPath();
  const displayPath = path === '.' ? 'current directory' : path;

  // Get the summary message from the result (matching gemineye logic)
  const getSummary = (): string => {
    if (typeof result === 'string') {
      return result;
    }
    if (result && typeof result === 'object') {
      if ('markdown' in result && result.markdown) {
        return result.markdown;
      }
      if ('message' in result && result.message) {
        return result.message;
      }
    }
    return 'Listed directory';
  };

  const summary = getSummary();

  return (
    <div className="mt-4">
      <div 
        className="flex items-center gap-2 text-sm px-2 py-1 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <FolderClosed className="h-4 w-4 text-blue-500" />
        <span>Listed </span>
        <span className="text-muted-foreground">{displayPath}</span>
        <ChevronRight 
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
      </div>
      {isExpanded && (
        <div className="ml-8 text-sm text-muted-foreground">
          {summary}
        </div>
      )}
    </div>
  );
}