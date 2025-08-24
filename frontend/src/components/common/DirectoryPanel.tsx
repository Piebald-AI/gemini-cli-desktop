import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Folder,
  FolderOpen,
  File,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { api } from "../../lib/api";

interface DirEntry {
  name: string;
  is_directory: boolean;
  full_path: string;
  size?: number;
  modified?: number;
  is_symlink?: boolean;
  symlink_target?: string;
}

interface TreeNode extends DirEntry {
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
  hasError?: boolean;
}

interface DirectoryPanelProps {
  workingDirectory: string;
  onDirectoryChange?: (path: string) => void;
  className?: string;
}

export function DirectoryPanel({
  workingDirectory,
  onDirectoryChange,
  className = "",
}: DirectoryPanelProps) {
  const { t } = useTranslation();
  const [rootNode, setRootNode] = useState<TreeNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load directory contents
  const loadDirectoryContents = useCallback(
    async (path: string): Promise<TreeNode[]> => {
      try {
        console.log("📁 [DirectoryPanel] Loading contents for:", path);
        const entries = await api.list_directory_contents({ path });

        // Sort entries: directories first, then files, both alphabetically
        const sortedEntries = entries.sort((a, b) => {
          if (a.is_directory && !b.is_directory) return -1;
          if (!a.is_directory && b.is_directory) return 1;
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });

        return sortedEntries.map((entry) => ({
          ...entry,
          children: entry.is_directory ? [] : undefined,
          isExpanded: false,
          isLoading: false,
          hasError: false,
        }));
      } catch (err) {
        console.error("📁 [DirectoryPanel] Error loading directory:", err);
        throw err;
      }
    },
    []
  );

  // Initialize root directory
  const initializeRoot = useCallback(async () => {
    if (!workingDirectory) return;

    setIsLoading(true);
    setError(null);

    try {
      const children = await loadDirectoryContents(workingDirectory);
      const pathParts = workingDirectory.split(/[/\\]/).filter(Boolean);
      const rootName =
        pathParts.length > 0
          ? pathParts[pathParts.length - 1]
          : workingDirectory;

      setRootNode({
        name: rootName || "Root",
        is_directory: true,
        full_path: workingDirectory,
        children,
        isExpanded: true,
        isLoading: false,
        hasError: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load directory");
      setRootNode(null);
    } finally {
      setIsLoading(false);
    }
  }, [workingDirectory, loadDirectoryContents]);

  // Toggle directory expansion
  const toggleDirectory = useCallback(
    async (node: TreeNode, _path: TreeNode[]) => {
      if (!node.is_directory) return;

      const updateNodeInTree = (
        root: TreeNode,
        targetNode: TreeNode,
        updater: (node: TreeNode) => TreeNode
      ): TreeNode => {
        // If this is the target node, update it
        if (root.full_path === targetNode.full_path) {
          return updater(root);
        }

        // If this node has children, search through them
        if (root.children) {
          const updatedChildren = root.children.map((child) =>
            updateNodeInTree(child, targetNode, updater)
          );

          return {
            ...root,
            children: updatedChildren,
          };
        }

        return root;
      };

      if (node.isExpanded) {
        // Collapse
        setRootNode((prev) =>
          prev
            ? updateNodeInTree(prev, node, (n) => ({ ...n, isExpanded: false }))
            : prev
        );
      } else {
        // Expand - first set loading state
        setRootNode((prev) =>
          prev
            ? updateNodeInTree(prev, node, (n) => ({ ...n, isLoading: true }))
            : prev
        );

        try {
          const children = await loadDirectoryContents(node.full_path);
          setRootNode((prev) =>
            prev
              ? updateNodeInTree(prev, node, (n) => ({
                  ...n,
                  children,
                  isExpanded: true,
                  isLoading: false,
                  hasError: false,
                }))
              : prev
          );
        } catch (err) {
          console.error("📁 [DirectoryPanel] Error expanding directory:", err);
          setRootNode((prev) =>
            prev
              ? updateNodeInTree(prev, node, (n) => ({
                  ...n,
                  isLoading: false,
                  hasError: true,
                }))
              : prev
          );
        }
      }
    },
    [loadDirectoryContents]
  );

  // Refresh current directory
  const refreshDirectory = useCallback(() => {
    initializeRoot();
  }, [initializeRoot]);

  // Initialize on mount and when working directory changes
  useEffect(() => {
    initializeRoot();
  }, [initializeRoot]);

  // Render tree node
  const renderTreeNode = useCallback(
    (
      node: TreeNode,
      depth: number = 0,
      path: TreeNode[] = []
    ): React.ReactNode => {
      const currentPath = [...path, node];
      const hasChildren =
        node.is_directory && node.children && node.children.length > 0;

      return (
        <div key={node.full_path}>
          <div
            className={`flex items-center gap-2 py-1 pr-2 hover:bg-muted/50 cursor-pointer text-sm rounded-sm transition-colors`}
            style={{
              paddingLeft: `${depth * 24}px`,
            }}
            onClick={() => {
              if (node.is_directory) {
                toggleDirectory(node, []);
              }
              onDirectoryChange?.(node.full_path);
            }}
          >
            {/* Loading/Error Icon for directories */}
            {node.is_directory && (node.isLoading || node.hasError) && (
              <div className="w-4 h-4 flex items-center justify-center">
                {node.isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-destructive" />
                )}
              </div>
            )}

            {/* File/Folder Icon */}
            {node.is_directory ? (
              node.isExpanded ? (
                <FolderOpen className="h-4 w-4 text-blue-500" />
              ) : (
                <Folder className="h-4 w-4 text-blue-500" />
              )
            ) : (
              <File className="h-4 w-4 text-muted-foreground" />
            )}

            {/* Name */}
            <span
              className={`truncate ${
                node.is_directory ? "text-foreground" : "text-muted-foreground"
              }`}
              title={node.name}
            >
              {node.name}
            </span>

            {/* Symlink indicator */}
            {node.is_symlink && (
              <span className="text-xs text-muted-foreground">→</span>
            )}
          </div>

          {/* Render children */}
          {node.isExpanded && hasChildren && (
            <div>
              {node.children!.map((child) =>
                renderTreeNode(child, depth + 1, currentPath)
              )}
            </div>
          )}
        </div>
      );
    },
    [toggleDirectory, onDirectoryChange]
  );

  return (
    <div
      className={`flex flex-col h-full border-l border-border bg-background ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-blue-500" />
          <span className="font-medium text-sm">{workingDirectory}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshDirectory}
          disabled={isLoading}
          className="h-6 w-6 p-0"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Tree Content */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-2">
          {isLoading && !rootNode ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mb-2" />
              <p className="text-sm text-muted-foreground mb-3">{error}</p>
              <Button variant="outline" size="sm" onClick={refreshDirectory}>
                {t("common.retry", "Retry")}
              </Button>
            </div>
          ) : rootNode ? (
            renderTreeNode(rootNode)
          ) : (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              {t("directoryPanel.noContent", "No directory content")}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
