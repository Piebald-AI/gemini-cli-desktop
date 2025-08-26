import { DirEntry } from "@/lib/webApi";
import { forwardRef, useEffect, useRef } from "react";
import { Folder, File } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface RecursiveFilePickerDropdownProps {
  entries: DirEntry[];
  selectedIndex: number;
  isLoading: boolean;
  error: string | null;
  onItemClick: (entry: DirEntry) => void;
  searchFilter: string;
  onValueChange?: (value: string) => void;
}

export const RecursiveFilePickerDropdown = forwardRef<
  HTMLDivElement,
  RecursiveFilePickerDropdownProps
>(
  (
    {
      entries,
      selectedIndex,
      isLoading,
      error,
      onItemClick,
      searchFilter,
      onValueChange,
    },
    ref
  ) => {
    const commandRef = useRef<HTMLDivElement>(null);

    // Focus the command element when it mounts so it can receive keyboard events
    useEffect(() => {
      if (commandRef.current) {
        const commandElement = commandRef.current.querySelector(
          "[cmdk-root]"
        ) as HTMLElement;
        if (commandElement) {
          // Add tabindex to make it focusable and focus it
          commandElement.setAttribute("tabindex", "0");
          commandElement.focus();
        }
      }
    }, []);

    console.log(
      "🎪 [DROPDOWN] RecursiveFilePickerDropdown rendered with props:",
      {
        entriesCount: entries.length,
        selectedIndex,
        isLoading,
        error,
        searchFilter,
      }
    );

    const getRelativePath = (fullPath: string, rootPath?: string) => {
      if (!rootPath) return fullPath;

      // Remove the root path prefix to show relative path
      const normalizedFullPath = fullPath.replace(/\\/g, "/");
      const normalizedRootPath = rootPath.replace(/\\/g, "/");

      if (normalizedFullPath.startsWith(normalizedRootPath)) {
        const relative = normalizedFullPath.substring(
          normalizedRootPath.length
        );
        return relative.startsWith("/") ? relative.substring(1) : relative;
      }

      return fullPath;
    };

    // Create a unique value for each entry to use with cmdk
    const getEntryValue = (entry: DirEntry, index: number) => {
      return `${entry.full_path}|${index}`;
    };

    // Get the currently selected entry's value
    const selectedValue = entries[selectedIndex]
      ? getEntryValue(entries[selectedIndex], selectedIndex)
      : "";

    console.log(
      "🎪 [DROPDOWN] Rendering MAIN list with",
      entries.length,
      "entries"
    );

    return (
      <div
        ref={ref}
        className="absolute left-0 right-0 bottom-full z-50 mb-2 rounded-md min-w-0 shadow-2xl"
      >
        <Command
          ref={commandRef}
          className="border rounded-md bg-popover"
          value={selectedValue}
          onValueChange={onValueChange}
        >
          <CommandList className="max-h-64">
            {error && (
              <div className="p-2">
                <div className="text-sm text-red-500">Error: {error}</div>
              </div>
            )}

            {isLoading && (
              <div className="p-2">
                <div className="text-sm text-muted-foreground">
                  Searching files...
                </div>
              </div>
            )}

            {!isLoading && !error && entries.length === 0 && (
              <CommandEmpty>
                {searchFilter
                  ? `No files found matching "${searchFilter}"`
                  : "No files found"}
              </CommandEmpty>
            )}

            {!isLoading && !error && entries.length > 0 && (
              <CommandGroup>
                {entries.map((entry, index) => {
                  const relativePath = getRelativePath(entry.full_path);
                  const entryValue = getEntryValue(entry, index);

                  return (
                    <CommandItem
                      key={entryValue}
                      value={entryValue}
                      onSelect={() => onItemClick(entry)}
                      className="flex cursor-pointer items-center gap-2 px-2 py-1.5"
                    >
                      {entry.is_directory ? (
                        <Folder className="h-4 w-4 text-blue-500" />
                      ) : (
                        <File className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {entry.name}
                          {entry.is_directory ? "/" : ""}
                        </div>
                        {relativePath !== entry.name && (
                          <div className="truncate text-xs text-muted-foreground">
                            {relativePath}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </div>
    );
  }
);

RecursiveFilePickerDropdown.displayName = "RecursiveFilePickerDropdown";
