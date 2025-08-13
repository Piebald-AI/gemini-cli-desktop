import { FileText } from "lucide-react";
import { type ToolCall } from "../../utils/toolCallParser";

interface ReadFileResult {
  content?: string;
  message?: string;
  error?: string;
}

interface ReadFileRendererProps {
  toolCall: ToolCall;
}

export function ReadFileRenderer({ toolCall }: ReadFileRendererProps) {
  const result = (toolCall.result as ReadFileResult) || {};
  
  // Extract file path from input
  const getFilePath = (): string => {
    try {
      if (toolCall.inputJsonRpc) {
        const input = JSON.parse(toolCall.inputJsonRpc);
        
        // Try different parameter names
        const params = input.params || {};
        return (
          params.file ||
          params.path ||
          params.filename ||
          params.filePath ||
          (params.locations && params.locations[0]?.path) ||
          (params.locations && params.locations[0]) ||
          'unknown file'
        );
      }
    } catch {}
    
    // Fallback: check toolCall.parameters directly
    if (toolCall.parameters?.locations?.[0]?.path) {
      return toolCall.parameters.locations[0].path;
    }
    
    return result?.message || 'unknown file';
  };

  // Get status message
  const getStatusMessage = (): string => {
    if (result.error) {
      return `Error: ${result.error}`;
    }
    if (result.message) {
      return result.message;
    }
    if (result.content) {
      const lines = result.content.split('\n').length;
      return `Read ${lines} lines`;
    }
    return 'File read completed';
  };

  const filePath = getFilePath();
  const statusMessage = getStatusMessage();

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 text-sm px-2 py-1">
        <FileText className="h-4 w-4 text-blue-500" />
        <span>Read </span>
        <span className="text-muted-foreground">{filePath}</span>
      </div>
      <div className="ml-8 text-sm text-muted-foreground">
        {statusMessage}
      </div>
    </div>
  );
}