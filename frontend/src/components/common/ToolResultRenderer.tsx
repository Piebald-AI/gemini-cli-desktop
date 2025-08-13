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
}

export function ToolResultRenderer({
  toolCall,
  onConfirm,
}: ToolResultRendererProps) {
  console.log("🔍 ToolResultRenderer called with:", {
    name: toolCall.name,
    status: toolCall.status,
    hasResult: !!toolCall.result,
    resultType: toolCall.result ? typeof toolCall.result : "none",
    id: toolCall.id
  });

  // Only render if tool call is completed and has results (simple working version)
  if (toolCall.status !== "completed" || !toolCall.result) {
    console.log("❌ Filtering out tool - not completed or no result:", {
      status: toolCall.status,
      hasResult: !!toolCall.result
    });
    return null;
  }

  console.log("✅ Proceeding to renderer selection for:", toolCall.name);

  // Route to appropriate renderer based on tool name

  switch (toolCall.name) {
    case "list_directory":
      console.log("🎯 Rendering DirectoryRenderer");
      return <DirectoryRenderer toolCall={toolCall} />;
    case "search_files":
      console.log("🎯 Rendering SearchRenderer");
      return <SearchRenderer toolCall={toolCall} />;
    case "grep":
    case "glob":
      console.log("🎯 Rendering GrepGlobRenderer");
      return <GrepGlobRenderer toolCall={toolCall} />;
    case "execute_command":
      console.log("🎯 Rendering CommandRenderer");
      return <CommandRenderer toolCall={toolCall} />;
    case "read_file":
      console.log("🎯 Rendering ReadFileRenderer");
      return <ReadFileRenderer toolCall={toolCall} />;
    case "read_many_files":
    case "ReadManyFiles":
      console.log("🎯 Rendering ReadManyFilesRenderer");
      return <ReadManyFilesRenderer toolCall={toolCall} />;
    default:
      // Check if it's an edit tool by name pattern
      if (toolCall.name.toLowerCase().includes("edit")) {
        console.log("🎯 Rendering EditRenderer");
        return <EditRenderer toolCall={toolCall} onConfirm={onConfirm} />;
      }
      console.log("🎯 Rendering DefaultRenderer for unknown tool:", toolCall.name);
      return <DefaultRenderer toolCall={toolCall} />;
  }
}
