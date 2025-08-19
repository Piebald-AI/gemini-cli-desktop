import React, { useState, useEffect, useMemo } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { Input } from "../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Folder,
  File,
  ArrowUp,
  Home,
  Loader2,
  HardDrive,
  Usb,
  Network,
  Disc,
  Database,
} from "lucide-react";
import { webApi, DirEntry } from "../../lib/webApi";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface DirectorySelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string) => void;
}

export function DirectorySelectionDialog({
  open,
  onOpenChange,
  onSelect,
}: DirectorySelectionDialogProps) {
  const { t } = useTranslation();
  const [contents, setContents] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentDirectory, setCurrentDirectory] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [filter, setFilter] = useState<string>("");
  const [editingPath, setEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState<string>("");

  // Initialize with home directory when dialog opens
  useEffect(() => {
    if (open) {
      initializeWithHome();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const initializeWithHome = async () => {
    try {
      setLoading(true);
      setError("");

      if (__WEB__) {
        const homeDir = await webApi.get_home_directory();
        setCurrentDirectory(homeDir);
        setPathInput(homeDir);
        await loadDirectoryContents(homeDir);
      } else {
        // For desktop, we'll use Tauri invoke
        const { invoke } = await import("@tauri-apps/api/core");
        const homeDir = await invoke<string>("get_home_directory");
        setCurrentDirectory(homeDir);
        setPathInput(homeDir);
        await loadDirectoryContents(homeDir);
      }
    } catch (err) {
      setError(t("fileSystem.failedToLoadHome"));
      console.error("Error loading home directory:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadDirectoryContents = async (path: string) => {
    try {
      setLoading(true);
      setError("");

      let dirContents: DirEntry[];
      if (__WEB__) {
        dirContents = await webApi.list_directory_contents(path);
      } else {
        const { invoke } = await import("@tauri-apps/api/core");
        dirContents = await invoke<DirEntry[]>("list_directory_contents", {
          path,
        });
      }

      setContents(dirContents);
    } catch (err) {
      setError(t("fileSystem.failedToLoadDirectory"));
      console.error("Error loading directory contents:", err);
      setContents([]);
    } finally {
      setLoading(false);
    }
  };

  const loadVolumes = async () => {
    try {
      setLoading(true);
      setError("");

      let volumes: DirEntry[];
      if (__WEB__) {
        volumes = await webApi.list_volumes();
      } else {
        const { invoke } = await import("@tauri-apps/api/core");
        volumes = await invoke<DirEntry[]>("list_volumes");
      }

      setContents(volumes);
      setCurrentDirectory(""); // Clear current directory to indicate we're showing volumes
      setPathInput(t("fileSystem.computer")); // Show "Computer" as the path
    } catch (err) {
      setError(t("fileSystem.failedToLoadVolumes"));
      console.error("Error loading volumes:", err);
      setContents([]);
    } finally {
      setLoading(false);
    }
  };

  const navigateUp = async () => {
    try {
      setLoading(true);
      setError("");

      let parentPath: string | null;
      if (__WEB__) {
        parentPath = await webApi.get_parent_directory(currentDirectory);
      } else {
        const { invoke } = await import("@tauri-apps/api/core");
        parentPath = await invoke<string | null>("get_parent_directory", {
          path: currentDirectory,
        });
      }

      if (parentPath) {
        setCurrentDirectory(parentPath);
        setPathInput(parentPath);
        await loadDirectoryContents(parentPath);
      } else {
        // No parent directory - we're at a filesystem root, show volumes
        await loadVolumes();
      }
    } catch (err) {
      setError(t("fileSystem.failedToNavigateUp"));
      console.error("Error navigating up:", err);
    } finally {
      setLoading(false);
    }
  };

  const navigateToDirectory = async (entry: DirEntry) => {
    if (!entry.is_directory) return;

    setCurrentDirectory(entry.full_path);
    setPathInput(entry.full_path);
    await loadDirectoryContents(entry.full_path);
  };

  const handlePathEdit = () => {
    setEditingPath(true);
    // If we're in volume view (currentDirectory is empty), start with empty string for typing
    setPathInput(currentDirectory || "");
  };

  const handlePathSubmit = async () => {
    if (!pathInput.trim()) return;

    try {
      setEditingPath(false);
      setCurrentDirectory(pathInput.trim());
      await loadDirectoryContents(pathInput.trim());
    } catch (err) {
      setError(t("fileSystem.failedToNavigateTo"));
      console.error("Error navigating to path:", err);
    }
  };

  const handlePathCancel = () => {
    setEditingPath(false);
    // If we're in volume view (currentDirectory is empty), preserve "Computer" label
    setPathInput(currentDirectory || t("fileSystem.computer"));
  };

  const handlePathKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handlePathSubmit();
    } else if (e.key === "Escape") {
      handlePathCancel();
    }
  };

  const handleSelect = () => {
    onSelect(currentDirectory);
    onOpenChange(false);
  };

  // Filter contents based on search
  const filteredContents = useMemo(() => {
    if (!filter.trim()) return contents;
    return contents.filter((entry) =>
      entry.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [contents, filter]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "-";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "-";
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state when closing
    setCurrentDirectory("");
    setContents([]);
    setError("");
    setFilter("");
    setEditingPath(false);
    setPathInput("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-4xl max-h-[80vh] flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("fileSystem.selectDirectory")}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className="flex gap-x-2">
            {/* Current path and navigation */}
            <div className="flex items-center gap-1 px-1 py-0 border rounded-md bg-neutral-50 dark:bg-neutral-800 grow">
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateUp}
                disabled={loading}
                title={t("accessibility.goToParentDirectory")}
                className="h-7 w-7 p-0"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={initializeWithHome}
                disabled={loading}
                title={t("accessibility.goToHomeDirectory")}
                className="h-7 w-7 p-0"
              >
                <Home className="h-4 w-4" />
              </Button>
              {editingPath ? (
                <input
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  onKeyDown={handlePathKeyDown}
                  onBlur={handlePathCancel}
                  className={cn(
                    "flex-1 text-sm px-1 py-0.5 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
                    "focus-visible:outline-none focus-visible:border-none shadow-none focus-visible:bg-neutral-100 dark:focus-visible:bg-neutral-700",
                    "rounded"
                  )}
                  autoFocus
                />
              ) : (
                <span
                  className="text-sm text-gray-600 dark:text-gray-300 flex-1 truncate cursor-text hover:bg-neutral-100 dark:hover:bg-neutral-700 px-1 py-0.5 rounded"
                  onClick={handlePathEdit}
                  title={t("fileSystem.clickToEditPath")}
                >
                  {currentDirectory || pathInput || t("common.loading")}
                </span>
              )}
            </div>

            {/* Filter input */}
            <Input
              placeholder={t("search.filterItems")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-[10rem]"
            />
          </div>

          {/* Directory contents */}
          <div className="flex-1 min-h-0 relative">
            {loading && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 border shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">{t("common.loading")}</span>
              </div>
            )}
            {error ? (
              <div className="text-red-500 text-sm p-4 text-center">
                {error}
              </div>
            ) : (
              <ScrollArea className="h-96">
                <div className={loading ? "pointer-events-none" : ""}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8 p-1.5 pl-3"></TableHead>
                        <TableHead className="p-1.5 max-w-[10rem]">
                          {t("fileSystem.name")}
                        </TableHead>
                        <TableHead className="w-24 p-1.5">
                          {t("fileSystem.size")}
                        </TableHead>
                        <TableHead className="w-36 p-1.5">
                          {t("fileSystem.dateModified")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContents.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center text-gray-500"
                          >
                            {filter.trim()
                              ? t("search.noItemsMatch")
                              : loading
                                ? t("common.loading")
                                : t("search.directoryEmpty")}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredContents.map((entry) => (
                          <TableRow
                            key={entry.full_path}
                            className={
                              entry.is_directory
                                ? "cursor-pointer"
                                : "cursor-default"
                            }
                            onClick={() =>
                              entry.is_directory &&
                              !loading &&
                              navigateToDirectory(entry)
                            }
                          >
                            <TableCell className="p-1.5 pl-3">
                              {currentDirectory === "" ? (
                                // Volume icons based on type
                                entry.volume_type === "local_disk" ? (
                                  <HardDrive className="size-4" />
                                ) : entry.volume_type === "removable_disk" ? (
                                  <Usb className="size-4" />
                                ) : entry.volume_type === "network_drive" ? (
                                  <Network className="size-4" />
                                ) : entry.volume_type === "cd_drive" ? (
                                  <Disc className="size-4" />
                                ) : entry.volume_type === "ram_disk" ? (
                                  <Database className="size-4" />
                                ) : entry.volume_type === "file_system" ? (
                                  <HardDrive className="size-4" />
                                ) : (
                                  <HardDrive className="size-4" />
                                )
                              ) : entry.is_directory ? (
                                <Folder className="size-4" />
                              ) : (
                                <File className="size-4" />
                              )}
                            </TableCell>
                            <TableCell className="p-1.5 max-w-[10rem] truncate">
                              {entry.name}
                              {entry.is_directory && currentDirectory !== ""
                                ? "/"
                                : ""}
                            </TableCell>
                            <TableCell className="text-sm text-gray-500 p-1.5">
                              {formatFileSize(entry.size)}
                            </TableCell>
                            <TableCell className="text-sm text-gray-500 p-1.5">
                              {formatDate(entry.modified)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSelect}
            disabled={!currentDirectory || loading}
          >
            {t("fileSystem.selectDirectoryButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
