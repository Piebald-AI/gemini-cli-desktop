import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { createLineDiffWithWords, type LineDiff, type WordDiff } from "@/utils/wordDiff";


interface DiffViewerProps {
  oldText: string;
  newText: string;
  fileName?: string;
  maxLines?: number;
  className?: string;
  onStatsCalculated?: (stats: { additions: number; deletions: number }) => void;
}

export function DiffViewer({
  oldText,
  newText,
  fileName,
  maxLines = 20,
  className,
  onStatsCalculated,
}: DiffViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Use enhanced word-level diff algorithm
  const diffLines = createLineDiffWithWords(oldText, newText);
  const visibleLines = isExpanded ? diffLines : diffLines.slice(0, maxLines);
  const hasMoreLines = diffLines.length > maxLines;

  // Calculate stats
  const additions = diffLines.filter((line) => line.type === "added").length;
  const deletions = diffLines.filter((line) => line.type === "removed").length;

  // Call the callback with calculated stats
  React.useEffect(() => {
    if (onStatsCalculated) {
      onStatsCalculated({ additions, deletions });
    }
  }, [additions, deletions, onStatsCalculated]);

  const getLineClassName = (type: LineDiff["type"]) => {
    switch (type) {
      case "added":
        return "bg-green-50 dark:bg-green-900/20 border-l-2 border-green-500";
      case "removed":
        return "bg-red-50 dark:bg-red-900/20 border-l-2 border-red-500";
      case "unchanged":
        return "bg-gray-50/50 dark:bg-gray-800/20";
      default:
        return "";
    }
  };

  const getLinePrefix = (type: LineDiff["type"]) => {
    switch (type) {
      case "added":
        return "+";
      case "removed":
        return "-";
      case "unchanged":
        return " ";
      default:
        return "";
    }
  };

  const getLineTextColor = (type: LineDiff["type"]) => {
    switch (type) {
      case "added":
        return "text-green-700 dark:text-green-300";
      case "removed":
        return "text-red-700 dark:text-red-300";
      case "unchanged":
        return "text-muted-foreground";
      default:
        return "";
    }
  };

  // Component to render word-level highlighting within added/removed lines
  const renderHighlightedWords = (words: WordDiff[], lineType: 'added' | 'removed') => {
    return (
      <span>
        {words.map((word, index) => (
          <span
            key={index}
            className={cn(
              // Only highlight words that are different from the comparison
              word.type === "added" && lineType === "added" && "bg-green-300 dark:bg-green-700/70 px-0.5 rounded",
              word.type === "removed" && lineType === "removed" && "bg-red-300 dark:bg-red-700/70 px-0.5 rounded",
              // Unchanged words get no highlighting
              word.type === "unchanged" && ""
            )}
          >
            {word.content}
          </span>
        ))}
      </span>
    );
  };

  return (
    <div className={cn("border rounded-md overflow-hidden", className)}>
      {fileName && (
        <div className="bg-muted/50 px-3 py-2 border-b flex items-center justify-between">
          <div className="font-mono text-sm">{fileName}</div>
          <div className="text-xs text-muted-foreground">
            <span className="text-green-600 dark:text-green-400">
              +{additions}
            </span>{" "}
            <span className="text-red-600 dark:text-red-400">-{deletions}</span>
          </div>
        </div>
      )}

      <div className="max-h-96 overflow-auto">
        {visibleLines.map((line, index) => (
          <div
            key={index}
            className={cn(
              "flex text-xs font-mono",
              getLineClassName(line.type)
            )}
          >
            <div className="px-2 py-1 text-muted-foreground min-w-8 text-right select-none">
              {line.oldLineNumber || line.newLineNumber || ""}
            </div>
            <div className="px-1 py-1 text-muted-foreground select-none">
              {getLinePrefix(line.type)}
            </div>
            <div
              className={cn("px-2 py-1 flex-1", getLineTextColor(line.type))}
            >
              {line.highlightedWords && (line.type === "added" || line.type === "removed") ? (
                renderHighlightedWords(line.highlightedWords, line.type)
              ) : (
                line.content || " "
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMoreLines && (
        <div
          className="bg-muted/30 px-3 py-2 border-t cursor-pointer hover:bg-muted/50 transition-colors flex items-center gap-2"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <span className="text-xs text-muted-foreground">
            {isExpanded
              ? "Show less"
              : `Show ${diffLines.length - maxLines} more lines`}
          </span>
        </div>
      )}
    </div>
  );
}
