import { useState, useCallback, useEffect } from "react";
import { DirEntry } from "@/lib/webApi";
import { api } from "@/lib/api";

export interface FileSystemNavigationState {
  currentPath: string;
  entries: DirEntry[];
  selectedIndex: number;
  isLoading: boolean;
  error: string | null;
  navigationStack: string[]; // For breadcrumb navigation
}

export interface FileSystemNavigationActions {
  loadDirectory: (path: string) => Promise<void>;
  navigateToFolder: (folderName: string) => Promise<void>;
  navigateUp: () => Promise<void>;
  selectNext: () => void;
  selectPrevious: () => void;
  resetSelection: () => void;
  getCurrentEntry: () => DirEntry | null;
  canNavigateDeeper: () => boolean;
}

export const useFileSystemNavigation = (initialPath?: string) => {
  console.log(
    "🚀 [useFileSystemNavigation] Hook initialized with initialPath:",
    initialPath
  );

  const [state, setState] = useState<FileSystemNavigationState>({
    currentPath: initialPath || ".",
    entries: [],
    selectedIndex: 0,
    isLoading: false,
    error: null,
    navigationStack: [],
  });

  console.log("🚀 [useFileSystemNavigation] Initial state:", state);

  const loadDirectory = useCallback(async (path: string) => {
    console.log(
      "📁 [useFileSystemNavigation] loadDirectory called with path:",
      path
    );
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log(
        "📡 [useFileSystemNavigation] Making API call to list_directory_contents with path:",
        path
      );
      const entries = await api.invoke<DirEntry[]>("list_directory_contents", {
        path,
      });
      console.log(
        "📡 [useFileSystemNavigation] API response received. Entries count:",
        entries?.length || 0
      );
      console.log("📡 [useFileSystemNavigation] Raw entries:", entries);

      // Sort entries: directories first, then files, alphabetically within each group
      const sortedEntries = entries.sort((a: DirEntry, b: DirEntry) => {
        if (a.is_directory && !b.is_directory) return -1;
        if (!a.is_directory && b.is_directory) return 1;
        return a.name.localeCompare(b.name);
      });

      console.log(
        "📁 [useFileSystemNavigation] Sorted entries:",
        sortedEntries
      );

      setState((prev) => ({
        ...prev,
        currentPath: path,
        entries: sortedEntries,
        selectedIndex: 0,
        isLoading: false,
        error: null,
      }));

      console.log(
        "✅ [useFileSystemNavigation] Directory loaded successfully. Path:",
        path,
        "Entries:",
        sortedEntries.length
      );
    } catch (err) {
      console.error(
        "❌ [useFileSystemNavigation] Failed to load directory:",
        err
      );
      console.error("❌ [useFileSystemNavigation] Error details:", err);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to load directory",
      }));
    }
  }, []);

  const navigateToFolder = useCallback(
    async (folderName: string) => {
      const currentEntry = state.entries.find(
        (entry) => entry.name === folderName
      );
      if (!currentEntry || !currentEntry.is_directory) {
        console.warn("Cannot navigate to non-directory:", folderName);
        return;
      }

      const newPath = currentEntry.full_path;
      const newStack = [...state.navigationStack, state.currentPath];

      setState((prev) => ({ ...prev, navigationStack: newStack }));
      await loadDirectory(newPath);
    },
    [state.entries, state.navigationStack, state.currentPath, loadDirectory]
  );

  const navigateUp = useCallback(async () => {
    if (state.navigationStack.length === 0) {
      // Try to get parent directory from API
      try {
        const parentPath = await api.invoke<string | null>(
          "get_parent_directory",
          { path: state.currentPath }
        );
        if (parentPath) {
          await loadDirectory(parentPath);
        }
      } catch {
        console.warn("Cannot navigate up from current directory");
      }
      return;
    }

    const previousPath =
      state.navigationStack[state.navigationStack.length - 1];
    const newStack = state.navigationStack.slice(0, -1);

    setState((prev) => ({ ...prev, navigationStack: newStack }));
    await loadDirectory(previousPath);
  }, [state.navigationStack, state.currentPath, loadDirectory]);

  const selectNext = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedIndex:
        prev.selectedIndex < prev.entries.length - 1
          ? prev.selectedIndex + 1
          : prev.selectedIndex,
    }));
  }, []);

  const selectPrevious = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedIndex:
        prev.selectedIndex > 0 ? prev.selectedIndex - 1 : prev.selectedIndex,
    }));
  }, []);

  const resetSelection = useCallback(() => {
    setState((prev) => ({ ...prev, selectedIndex: 0 }));
  }, []);

  const getCurrentEntry = useCallback((): DirEntry | null => {
    return state.entries[state.selectedIndex] || null;
  }, [state.entries, state.selectedIndex]);

  const canNavigateDeeper = useCallback((): boolean => {
    const currentEntry = getCurrentEntry();
    return currentEntry ? currentEntry.is_directory : false;
  }, [getCurrentEntry]);

  // Load initial directory only on mount, don't reset during navigation
  useEffect(() => {
    console.log(
      "🔄 [useFileSystemNavigation] useEffect - initialPath:",
      initialPath,
      "currentPath:",
      state.currentPath,
      "entries:",
      state.entries.length
    );
    // Only load initially when we have no entries yet
    if (initialPath && state.entries.length === 0) {
      console.log(
        "🔄 [useFileSystemNavigation] Loading initial directory:",
        initialPath
      );
      loadDirectory(initialPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPath, loadDirectory]); // Removed state.currentPath from deps

  const actions: FileSystemNavigationActions = {
    loadDirectory,
    navigateToFolder,
    navigateUp,
    selectNext,
    selectPrevious,
    resetSelection,
    getCurrentEntry,
    canNavigateDeeper,
  };

  return [state, actions] as const;
};
