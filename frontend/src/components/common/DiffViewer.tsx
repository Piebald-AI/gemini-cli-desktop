import React, { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { highlightCode, getLanguageFromFileName, getHighlightedContentSync } from "@/utils/syntaxHighlighter";
import { useTheme } from "next-themes";

interface DiffViewerProps {
  oldText: string;
  newText: string;
  fileName?: string;
  className?: string;
  onStatsCalculated?: (stats: { additions: number; deletions: number }) => void;
  showDiffOnly?: boolean;
  contextLines?: number;
}

export function DiffViewer({
  oldText,
  newText,
  fileName,
  className,
  onStatsCalculated,
  showDiffOnly = true,
  contextLines = 5,
}: DiffViewerProps) {
  const { resolvedTheme } = useTheme();
  const [highlightedContent, setHighlightedContent] = useState<{
    old: Map<string, React.ReactElement>;
    new: Map<string, React.ReactElement>;
  }>({ old: new Map(), new: new Map() });

  // Calculate stats by counting lines
  React.useEffect(() => {
    if (onStatsCalculated) {
      const oldLines = oldText.split('\n');
      const newLines = newText.split('\n');
      
      // Simple heuristic for line-based diff stats
      const additions = Math.max(0, newLines.length - oldLines.length);
      const deletions = Math.max(0, oldLines.length - newLines.length);
      
      // For equal line counts, estimate based on character differences
      if (additions === 0 && deletions === 0) {
        const oldChars = oldText.length;
        const newChars = newText.length;
        const addedChars = Math.max(0, newChars - oldChars);
        const deletedChars = Math.max(0, oldChars - newChars);
        onStatsCalculated({ 
          additions: Math.ceil(addedChars / 50), // Rough estimate
          deletions: Math.ceil(deletedChars / 50)
        });
      } else {
        onStatsCalculated({ additions, deletions });
      }
    }
  }, [oldText, newText, onStatsCalculated]);

  const language = getLanguageFromFileName(fileName);

  // Pre-highlight content effect
  useEffect(() => {
    const highlightContent = async () => {
      if (!oldText && !newText) return;
      
      const theme: 'dark' | 'light' = resolvedTheme === 'dark' ? 'dark' : 'light';
      const options = { theme, removeBackground: true };
      
      // Pre-highlight all possible content chunks that might be needed
      const oldLines = oldText.split('\n');
      const newLines = newText.split('\n');
      
      const oldChunks = new Set<string>();
      const newChunks = new Set<string>();
      
      // Add individual lines
      oldLines.forEach(line => line.trim() && oldChunks.add(line));
      newLines.forEach(line => line.trim() && newChunks.add(line));
      
      // Add words for word-level diffing
      oldLines.forEach(line => {
        line.split(/\s+/).forEach(word => word.trim() && oldChunks.add(word));
      });
      newLines.forEach(line => {
        line.split(/\s+/).forEach(word => word.trim() && newChunks.add(word));
      });
      
      // Highlight all chunks
      const [oldResults, newResults] = await Promise.all([
        Promise.all(
          Array.from(oldChunks).map(async (chunk) => {
            const result = await highlightCode(chunk, language, options);
            return [chunk, result.content] as [string, React.ReactElement];
          })
        ),
        Promise.all(
          Array.from(newChunks).map(async (chunk) => {
            const result = await highlightCode(chunk, language, options);
            return [chunk, result.content] as [string, React.ReactElement];
          })
        )
      ]);
      
      setHighlightedContent({
        old: new Map(oldResults),
        new: new Map(newResults),
      });
    };
    
    highlightContent();
  }, [oldText, newText, language, resolvedTheme]);

  // Synchronous render content function
  const renderContent = useCallback(
    (str: string): React.ReactElement => {
      // Handle undefined or null str
      if (!str || !str.trim()) {
        return <span style={{ display: 'inline' }}>{str || ''}</span>;
      }
      
      // Try to get from pre-highlighted content
      const oldHighlighted = highlightedContent.old.get(str);
      const newHighlighted = highlightedContent.new.get(str);
      const highlighted = oldHighlighted || newHighlighted;
      
      if (highlighted) {
        return (
          <span style={{ display: 'inline' }}>
            {highlighted}
          </span>
        );
      }
      
      // Fallback to sync highlighting if available in cache
      const theme: 'dark' | 'light' = resolvedTheme === 'dark' ? 'dark' : 'light';
      const result = getHighlightedContentSync(str, language, { theme, removeBackground: true });
      
      return (
        <span style={{ 
          display: 'inline',
          margin: 0,
          padding: 0
        }}>
          {result.content}
        </span>
      );
    },
    [highlightedContent, language, resolvedTheme]
  );



  return (
    <div className={cn("border rounded-md overflow-hidden font-mono diff-viewer-wrapper", className)}>
      {fileName && (
        <div className="bg-muted/50 px-3 py-2 border-b flex items-center justify-between">
          <div className="text-sm">{fileName}</div>
        </div>
      )}

      <div className="max-h-96 overflow-auto">
        <style>{`
          .diff-viewer-wrapper table {
            width: 100% !important;
            table-layout: fixed !important;
          }
          .diff-viewer-wrapper tbody {
            width: 100% !important;
            display: table-row-group !important;
          }
        `}</style>
        <ReactDiffViewer
          oldValue={oldText}
          newValue={newText}
          splitView={true}
          showDiffOnly={showDiffOnly}
          extraLinesSurroundingDiff={contextLines}
          compareMethod={DiffMethod.WORDS_WITH_SPACE}
          hideLineNumbers={false}
          useDarkTheme={false} // We'll handle theming through CSS
          renderContent={renderContent}
          codeFoldMessageRenderer={(totalLines) => (
            <span style={{ textDecoration: 'none' }}>
              Expand {totalLines} lines
            </span>
          )}
          styles={{
            variables: {
              light: {
                codeFoldGutterBackground: '#f8f9fa',
                codeFoldBackground: '#f8f9fa',
                addedBackground: '#e8fce8',
                addedColor: '#00aa00',
                removedBackground: '#fef2f2',
                removedColor: '#dc2626',
                wordAddedBackground: '#b3f0b3',
                wordRemovedBackground: '#fecaca',
                addedGutterBackground: '#e8fce8',
                removedGutterBackground: '#fef2f2',
                gutterBackground: '#f8f9fa',
                gutterBackgroundDark: '#f3f4f6',
                highlightBackground: '#fef3c7',
                highlightGutterBackground: '#fef3c7',
                diffViewerBackground: '#ffffff',
                diffViewerColor: '#374151',
                emptyLineBackground: '#fafafa',
                codeFoldContentColor: '#6b7280',
              },
              dark: {
                codeFoldGutterBackground: '#1f2937',
                codeFoldBackground: '#1f2937', 
                addedBackground: '#1a3d2e',
                addedColor: '#68d391',
                removedBackground: '#1f1112',
                removedColor: '#fecaca',
                wordAddedBackground: '#22543d',
                wordRemovedBackground: '#7f1d1d',
                addedGutterBackground: '#1a3d2e',
                removedGutterBackground: '#1f1112',
                gutterBackground: '#1f2937',
                gutterBackgroundDark: '#111827',
                highlightBackground: '#1f2937',
                highlightGutterBackground: '#1f2937',
                diffViewerBackground: '#111827',
                diffViewerColor: '#f3f4f6',
                emptyLineBackground: '#1f2937',
                codeFoldContentColor: '#9ca3af',
              }
            },
            contentText: {
              fontSize: '13px',
              lineHeight: '1.4',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            },
            gutter: {
              fontSize: '12px',
              lineHeight: '1.4',
              minWidth: '32px',
            },
            marker: {
              fontSize: '12px',
              lineHeight: '1.4',
            },
            diffContainer: {
              display: 'block',
              '& table': {
                width: '100%',
                tableLayout: 'fixed',
              },
              '& tbody': {
                width: '100%',
                display: 'table-row-group',
              },
            },
            splitView: {
              display: 'flex',
              '& > div': {
                flex: '1 1 50%',
                minWidth: 0,
              },
              '& table': {
                width: '100%',
                tableLayout: 'fixed',
              },
              '& tbody': {
                width: '100%',
                display: 'table-row-group',
              },
            },
            codeFold: {
              fontSize: '14px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 'normal',
              lineHeight: '1.6',
              textAlign: 'center',
              padding: '8px 0',
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              textDecoration: 'none !important',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
            },
            codeFoldGutter: {
              textDecoration: 'none !important',
            },
          }}
        />
      </div>
    </div>
  );
}
