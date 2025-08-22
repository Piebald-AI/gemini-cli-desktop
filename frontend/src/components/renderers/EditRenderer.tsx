import { useState } from "react";
import { Edit3, Check, X, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "../ui/collapsible";
import { DiffViewer } from "../common/DiffViewer";
import { type ToolCall } from "../../utils/toolCallParser";

interface EditResult {
  file_path?: string;
  old_string?: string;
  new_string?: string;
  success?: boolean;
  additions?: number;
  deletions?: number;
  edits?: Array<{
    file_path: string;
    old_string: string;
    new_string: string;
    line_start?: number;
    line_end?: number;
  }>;
  message?: string;
  error?: string;
}

interface EditRendererProps {
  toolCall: ToolCall;
  onConfirm?: (toolCallId: string, outcome: string) => Promise<void>;
}

export function EditRenderer({ toolCall, onConfirm }: EditRendererProps) {
  const { t } = useTranslation();
  const [diffStats, setDiffStats] = useState<{
    additions: number;
    deletions: number;
  }>({ additions: 0, deletions: 0 });
  const [isExpanded, setIsExpanded] = useState(false);

  const result = (toolCall.result as EditResult) || {};

  const isUserRejected = (toolCall: ToolCall): boolean => {
    // Check the permanent rejection flag first
    if (toolCall.isUserRejected) {
      return true;
    }

    // Fallback to checking the result markdown
    if (
      toolCall.status === "failed" &&
      toolCall.result &&
      typeof toolCall.result === "object"
    ) {
      return toolCall.result.markdown === t("toolCalls.userRejected");
    }
    return false;
  };

  // Extract edit information from parameters, result, and JSON-RPC confirmation request
  const getEditInfo = () => {
    // First, check for JSON-RPC confirmation request (this is the primary source)
    if (toolCall.confirmationRequest?.content?.type === "diff") {
      const content = toolCall.confirmationRequest.content;

      const editInfo = {
        type: "single" as const,
        filePath: content.path || t("common.unknownFile"),
        oldText: content.oldText || "",
        newText: content.newText || "",
        additions: 0, // Will be calculated by DiffViewer
        deletions: 0, // Will be calculated by DiffViewer
        label: toolCall.confirmationRequest.label,
      };

      return editInfo;
    }

    // For single edit from parameters
    if (toolCall.parameters?.file_path) {
      const editInfo = {
        type: "single" as const,
        filePath: toolCall.parameters.file_path as string,
        oldText: (toolCall.parameters.old_string as string) || "",
        newText: (toolCall.parameters.new_string as string) || "",
        additions: result.additions || 0,
        deletions: result.deletions || 0,
      };

      return editInfo;
    }

    // For multi-edit from parameters
    if (
      toolCall.parameters?.edits &&
      Array.isArray(toolCall.parameters.edits)
    ) {
      const edits = toolCall.parameters.edits as EditResult["edits"];
      return {
        type: "multi" as const,
        edits: edits || [],
        totalAdditions:
          edits?.reduce((sum, _edit) => sum + (result.additions || 0), 0) || 0,
        totalDeletions:
          edits?.reduce((sum, _edit) => sum + (result.deletions || 0), 0) || 0,
      };
    }

    // Fallback - try to extract from result
    if (result.file_path) {
      return {
        type: "single" as const,
        filePath: result.file_path,
        oldText: result.old_string || "",
        newText: result.new_string || "",
        additions: result.additions || 0,
        deletions: result.deletions || 0,
      };
    }

    return null;
  };

  const editInfo = getEditInfo();

  if (!editInfo) {
    return null;
  }

  const isPending = toolCall.status === "pending";
  const isRunning = toolCall.status === "running";
  const isCompleted = toolCall.status === "completed";
  const isFailed = toolCall.status === "failed";

  // Calculate total changes for display
  const getTotalChanges = () => {
    if (editInfo.type === "single") {
      // For JSON-RPC confirmations, we might not have pre-calculated counts
      if (
        editInfo.additions === 0 &&
        editInfo.deletions === 0 &&
        editInfo.oldText &&
        editInfo.newText
      ) {
        // Calculate rough counts based on line differences
        const oldLines = editInfo.oldText.split("\n").length;
        const newLines = editInfo.newText.split("\n").length;
        const additions = Math.max(0, newLines - oldLines);
        const deletions = Math.max(0, oldLines - newLines);
        return { additions, deletions };
      }
      return { additions: editInfo.additions, deletions: editInfo.deletions };
    } else {
      return {
        additions: editInfo.totalAdditions,
        deletions: editInfo.totalDeletions,
      };
    }
  };

  getTotalChanges();

  return (
    <div className="my-4">
      <Card
        className={`py-0 ${
          isUserRejected(toolCall)
            ? "border-red-200 dark:border-red-800"
            : isFailed
              ? "border-red-200 dark:border-red-800"
              : isCompleted
                ? "border-green-200 dark:border-green-800"
                : "border-blue-200 dark:border-blue-800"
        }`}
      >
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger
            className="!no-underline hover:!no-underline [&:hover]:!no-underline [&>*]:!no-underline"
            asChild
          >
            {/* TODO 8/17/2025: Look in to the confusing styles. */}
            <div
              className="cursor-pointer w-full [&_*]:!no-underline"
              style={{ textDecoration: "none !important" }}
            >
              <CardHeader
                className="!no-underline py-2 gap-0"
                style={{ textDecoration: "none !important" }}
              >
                <div className="flex items-center justify-between gap-4 w-full">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Edit3
                      className={`h-4 w-4 flex-shrink-0 ${
                        isUserRejected(toolCall)
                          ? "text-red-500"
                          : isFailed
                            ? "text-red-500"
                            : isCompleted
                              ? "text-green-500"
                              : "text-blue-500"
                      }`}
                    />
                    <CardTitle className="text-sm font-mono truncate">
                      {editInfo.type === "single"
                        ? editInfo.filePath
                        : "(multiple files)"}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        <span className="text-green-600 dark:text-green-400">
                          +{diffStats.additions}
                        </span>{" "}
                        <span className="text-red-600 dark:text-red-400">
                          -{diffStats.deletions}
                        </span>
                      </span>
                    </CardTitle>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Show status indicators */}
                    {isRunning && (
                      <div className="text-xs text-blue-500 flex items-center gap-1">
                        <div className="animate-spin h-3 w-3 border border-blue-500 border-t-transparent rounded-full"></div>
                        {t("toolCalls.running")}
                      </div>
                    )}
                    {isCompleted && !isUserRejected(toolCall) && (
                      <div className="text-xs text-green-500 flex items-center">
                        <Check className="h-4 w-4 mr-1" />{" "}
                        {t("toolCalls.completed")}
                      </div>
                    )}
                    {isUserRejected(toolCall) && (
                      <div className="text-xs text-red-500 flex items-center">
                        <X className="h-4 w-4 mr-1" /> Rejected
                      </div>
                    )}
                    {isFailed && !isUserRejected(toolCall) && (
                      <div className="text-xs text-red-500 flex items-center">
                        <X className="h-4 w-4 mr-1" /> {t("toolCalls.failed")}
                      </div>
                    )}

                    {/* Show buttons for pending, hide for running */}
                    {isPending && (
                      <>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-600 text-white px-3 py-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onConfirm?.(toolCall.id, "proceed_once");
                          }}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Allow
                        </Button>

                        <Button
                          size="sm"
                          variant="destructive"
                          className="px-3 py-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onConfirm?.(toolCall.id, "cancel");
                          }}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Deny
                        </Button>
                      </>
                    )}

                    {/* Expand/collapse chevron */}
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent>
              <DiffViewer
                oldText={editInfo.type === "single" ? editInfo.oldText : ""}
                newText={editInfo.type === "single" ? editInfo.newText : ""}
                fileName={
                  editInfo.type === "single"
                    ? editInfo.filePath
                    : "(multiple files)"
                }
                onStatsCalculated={setDiffStats}
              />
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
