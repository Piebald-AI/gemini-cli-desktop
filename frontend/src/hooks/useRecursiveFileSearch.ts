import { useState, useCallback, useEffect } from "react";
import { DirEntry } from "@/lib/webApi";
import { api } from "@/lib/api";

export interface RecursiveFileSearchState {
  rootPath: string;
  allFiles: DirEntry[];
  isLoading: boolean;
  error: string | null;
}

export interface RecursiveFileSearchActions {
  loadFiles: (path: string, maxDepth?: number) => Promise<void>;
  searchFiles: (query: string) => DirEntry[];
  reset: () => void;
}

export const useRecursiveFileSearch = (initialPath?: string) => {
  const [state, setState] = useState<RecursiveFileSearchState>({
    rootPath: initialPath || ".",
    allFiles: [],
    isLoading: false,
    error: null,
  });

  const loadFiles = useCallback(async (path: string, maxDepth: number = 1) => {
    console.log(
      "🔍 [HOOK] loadFiles called with path:",
      path,
      "maxDepth:",
      maxDepth
    );
    console.log("🔍 [HOOK] Current state before loading:", {
      rootPath: state.rootPath,
      allFiles: state.allFiles.length,
      isLoading: state.isLoading,
      error: state.error,
    });

    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    console.log("🔍 [HOOK] Set loading state to true");

    try {
      console.log("📡 [HOOK] About to call api.list_files_recursive");
      const files = await api.list_files_recursive({
        path,
        max_depth: maxDepth,
      });
      console.log("📡 [HOOK] API call completed successfully");
      console.log("📡 [HOOK] Received files:", files?.length || 0, "entries");
      if (files && files.length > 0) {
        console.log(
          "📡 [HOOK] First 3 files:",
          files
            .slice(0, 3)
            .map((f) => `${f.name} (${f.is_directory ? "dir" : "file"})`)
        );
      }

      setState((prev) => ({
        ...prev,
        rootPath: path,
        allFiles: files || [],
        isLoading: false,
        error: null,
      }));

      console.log(
        "✅ [HOOK] State updated successfully. New file count:",
        files?.length || 0
      );
    } catch (err) {
      console.error("❌ [HOOK] API call failed with error:", err);
      console.error("❌ [HOOK] Error details:", {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to load files",
      }));
    }
  }, []);

  const searchFiles = useCallback(
    (query: string): DirEntry[] => {
      console.log(
        "🔍 [HOOK] searchFiles called with query:",
        `"${query}"`,
        "against",
        state.allFiles.length,
        "files"
      );

      if (!query || !state.allFiles.length) {
        console.log(
          "🔍 [HOOK] Returning all files (no query or no files):",
          state.allFiles.length
        );
        return state.allFiles;
      }

      const queryLower = query.toLowerCase().trim();
      const isDirectoryPrefix = queryLower.endsWith("/");

      const filtered = state.allFiles.filter((file) => {
        const fileName = file.name.toLowerCase();
        const fullPath = file.full_path.toLowerCase();

        // Get relative path from working directory for better matching
        const workingDirLower = state.rootPath
          .toLowerCase()
          .replace(/\\/g, "/");
        const fullPathNormalized = fullPath.replace(/\\/g, "/");

        let relativePath = fullPath;
        if (fullPathNormalized.startsWith(workingDirLower)) {
          relativePath = fullPathNormalized.substring(workingDirLower.length);
          if (relativePath.startsWith("/")) {
            relativePath = relativePath.substring(1);
          }
        }

        if (isDirectoryPrefix) {
          // For directory prefix searches like "priv/"
          const prefix = queryLower.slice(0, -1); // Remove trailing slash

          // Match directories that start with the prefix
          if (file.is_directory && fileName.startsWith(prefix)) {
            return true;
          }

          // Match files inside directories that start with the prefix
          if (
            relativePath.startsWith(prefix + "/") ||
            fullPathNormalized.includes("/" + prefix + "/")
          ) {
            return true;
          }

          // Also match if the relative path starts with the full query (including slash)
          if (relativePath.startsWith(queryLower)) {
            return true;
          }
        } else {
          // For regular searches, use broader matching
          if (
            fileName.includes(queryLower) ||
            fullPath.includes(queryLower) ||
            relativePath.includes(queryLower)
          ) {
            return true;
          }
        }

        return false;
      });

      // Sort results for better UX: directories first, then files, with prefix matches prioritized
      const sortedFiltered = filtered.sort((a, b) => {
        const aFileName = a.name.toLowerCase();
        const bFileName = b.name.toLowerCase();
        const aRelativePath = getRelativePath(
          a.full_path,
          state.rootPath
        ).toLowerCase();
        const bRelativePath = getRelativePath(
          b.full_path,
          state.rootPath
        ).toLowerCase();

        // Prioritize exact prefix matches
        const aExactMatch = isDirectoryPrefix
          ? (a.is_directory && aFileName.startsWith(queryLower.slice(0, -1))) ||
            aRelativePath.startsWith(queryLower)
          : aFileName.startsWith(queryLower) ||
            aRelativePath.startsWith(queryLower);
        const bExactMatch = isDirectoryPrefix
          ? (b.is_directory && bFileName.startsWith(queryLower.slice(0, -1))) ||
            bRelativePath.startsWith(queryLower)
          : bFileName.startsWith(queryLower) ||
            bRelativePath.startsWith(queryLower);

        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;

        // Then prioritize directories
        if (a.is_directory && !b.is_directory) return -1;
        if (!a.is_directory && b.is_directory) return 1;

        // Finally sort alphabetically
        return aFileName.localeCompare(bFileName);
      });

      console.log("🔍 [HOOK] Filtered to", sortedFiltered.length, "files");
      if (sortedFiltered.length > 0) {
        console.log(
          "🔍 [HOOK] First few matches:",
          sortedFiltered.slice(0, 3).map((f) => f.name)
        );
      }

      return sortedFiltered;
    },
    [state.allFiles, state.rootPath]
  );

  // Helper function to get relative path
  const getRelativePath = useCallback((fullPath: string, rootPath: string) => {
    const workingDirNormalized = rootPath.replace(/\\/g, "/");
    const entryPathNormalized = fullPath.replace(/\\/g, "/");

    if (entryPathNormalized.startsWith(workingDirNormalized)) {
      let relativePath = entryPathNormalized.substring(
        workingDirNormalized.length
      );
      if (relativePath.startsWith("/")) {
        relativePath = relativePath.substring(1);
      }
      return relativePath;
    }

    return fullPath;
  }, []);

  const reset = useCallback(() => {
    setState({
      rootPath: initialPath || ".",
      allFiles: [],
      isLoading: false,
      error: null,
    });
  }, [initialPath]);

  // Load initial files immediately on mount
  useEffect(() => {
    console.log(
      "🔄 [useRecursiveFileSearch] useEffect triggered - initialPath:",
      initialPath
    );
    if (initialPath) {
      console.log(
        "🔄 [useRecursiveFileSearch] Force loading files immediately:",
        initialPath
      );
      loadFiles(initialPath);
    }
  }, [initialPath, loadFiles]);

  const actions: RecursiveFileSearchActions = {
    loadFiles,
    searchFiles,
    reset,
  };

  return [state, actions] as const;
};
