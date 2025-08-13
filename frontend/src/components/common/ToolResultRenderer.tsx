import { type ToolCall } from "../../utils/toolCallParser";
import { DirectoryRenderer } from "../renderers/DirectoryRenderer";
import { SearchRenderer } from "../renderers/SearchRenderer";
import { GrepGlobRenderer } from "../renderers/GrepGlobRenderer";
import { CommandRenderer } from "../renderers/CommandRenderer";
import { ReadFileRenderer } from "../renderers/ReadFileRenderer";
import { ReadManyFilesRenderer } from "../renderers/ReadManyFilesRenderer";
import { EditRenderer } from "../renderers/EditRenderer";
import { DefaultRenderer } from "../renderers/DefaultRenderer";

interface ToolResultRendererProps {
  toolCall: ToolCall;
  onConfirm?: (toolCallId: string, outcome: string) => Promise<void>;
  hasConfirmationRequest?: boolean;
}

export function ToolResultRenderer({
  toolCall,
  onConfirm,
}: ToolResultRendererProps) {
  // Always render read_file, even with no result
  if (toolCall.name === "read_file" && toolCall.status === "completed") {
    // Don't check for result - render anyway
  }
  // For glob/grep tools, render even without results (they might have empty results)
  else if (
    (toolCall.name === "glob" || toolCall.name === "grep") &&
    toolCall.status === "completed"
  ) {
    // Don't check for result - render anyway
  }
  // For read_many_files, also render even without results
  else if (
    (toolCall.name === "read_many_files" ||
      toolCall.name === "ReadManyFiles") &&
    toolCall.status === "completed"
  ) {
    // Don't check for result - render anyway
  }
  // For edit tools, render for any status (pending, running, completed, failed) to show approval UI
  else if (
    toolCall.name.toLowerCase().includes("edit") &&
    (toolCall.status === "pending" ||
      toolCall.status === "running" ||
      toolCall.status === "completed" ||
      toolCall.status === "failed")
  ) {
    // Always render edit tools regardless of result to show approval interface
  }
  // For other tools, only render if completed and has results
  else if (toolCall.status !== "completed" || !toolCall.result) {
    return null;
  }

  // Route to appropriate renderer based on tool name

  switch (toolCall.name) {
    case "list_directory":
      return <DirectoryRenderer toolCall={toolCall} />;
    case "search_files":
      return <SearchRenderer toolCall={toolCall} />;
    case "grep":
    case "glob":
      return <GrepGlobRenderer toolCall={toolCall} />;
    case "execute_command":
      return <CommandRenderer toolCall={toolCall} />;
    case "read_file":
      return <ReadFileRenderer toolCall={toolCall} />;
    case "read_many_files":
    case "ReadManyFiles":
      return <ReadManyFilesRenderer toolCall={toolCall} />;
    default:
      // Check if it's an edit tool by name pattern
      if (toolCall.name.toLowerCase().includes("edit")) {
        return <EditRenderer toolCall={toolCall} onConfirm={onConfirm} />;
      }
      return <DefaultRenderer toolCall={toolCall} />;
  }
}
