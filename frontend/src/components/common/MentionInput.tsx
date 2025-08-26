import React, { useState, useRef, useCallback } from "react";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";
import { useRecursiveFileSearch } from "@/hooks/useRecursiveFileSearch";
import { RecursiveFilePickerDropdown } from "./RecursiveFilePickerDropdown";
import { DirEntry } from "@/lib/webApi";

interface Mention {
  file: string;
  type: "file" | "folder";
}

interface MentionInputProps {
  value: string;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement> | null,
    newValue: string,
    newPlainTextValue: string,
    mentions: Mention[]
  ) => void;
  workingDirectory?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onKeyDown?: (event: React.KeyboardEvent) => void;
}

export function MentionInput({
  value,
  onChange,
  workingDirectory = ".",
  placeholder = "Type your message...",
  disabled = false,
  className,
  onKeyDown,
}: MentionInputProps) {
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [atPosition, setAtPosition] = useState<number | null>(null);
  const [extractedMentions, setExtractedMentions] = useState<Mention[]>([]);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);

  // Initialize recursive file search with working directory
  const [searchState, searchActions] = useRecursiveFileSearch(workingDirectory);

  // Detect @ trigger and show file picker (simplified for recursive search)
  const detectAtTrigger = useCallback(
    (inputValue: string, cursorPos: number) => {
      const beforeCursor = inputValue.substring(0, cursorPos);
      const atIndex = beforeCursor.lastIndexOf("@");

      if (atIndex !== -1) {
        const afterAt = beforeCursor.substring(atIndex + 1);
        // Show picker if @ is at start of word (preceded by whitespace or start of string)
        const charBeforeAt = atIndex > 0 ? beforeCursor[atIndex - 1] : " ";
        if (/\s/.test(charBeforeAt) || atIndex === 0) {
          // Only show if there's no space after @ (still building the mention)
          if (!afterAt.includes(" ")) {
            return {
              atIndex,
              searchText: afterAt,
              searchFilter: afterAt,
            };
          }
        }
      }
      return null;
    },
    []
  );

  // Filter entries based on search text using recursive search
  const getFilteredEntries = useCallback(() => {
    const results = searchActions.searchFiles(searchFilter);
    return results;
  }, [searchActions, searchFilter]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;

    // Detect @ trigger
    const atTrigger = detectAtTrigger(newValue, cursorPosition);

    if (atTrigger !== null) {
      // Set the search filter
      setSearchFilter(atTrigger.searchFilter);

      setAtPosition(atTrigger.atIndex);
      setShowFilePicker(true);
    } else {
      setShowFilePicker(false);
      setAtPosition(null);
      setSearchFilter("");
    }

    // Extract mentions from the value (for future file reading integration)

    const mentions = extractMentionsFromValue(newValue);
    setExtractedMentions(mentions);

    onChange(e, newValue, newValue, mentions);
  };

  const addMentionToInput = useCallback(
    (entry: DirEntry, closePicker = true) => {
      if (atPosition === null) {
        return;
      }

      const beforeAt = value.substring(0, atPosition);
      // Use value.length as fallback instead of relying on inputRef.current.selectionStart
      const cursorPosition = inputRef.current?.selectionStart || value.length;
      const afterAtAndMention = value.substring(cursorPosition);

      // Find the existing mention text (everything after @ until space or end)
      const afterAtPos = value.substring(atPosition + 1);
      const spaceIndex = afterAtPos.indexOf(" ");
      const existingMentionText =
        spaceIndex === -1 ? afterAtPos : afterAtPos.substring(0, spaceIndex);

      const mentionText = entry.is_directory ? `${entry.name}/` : entry.name;

      // For recursive search, we use the relative path from the working directory
      const workingDirectoryNormalized = workingDirectory.replace(/\\/g, "/");
      const entryPathNormalized = entry.full_path.replace(/\\/g, "/");

      let relativePath = entry.full_path;
      if (entryPathNormalized.startsWith(workingDirectoryNormalized)) {
        relativePath = entryPathNormalized.substring(
          workingDirectoryNormalized.length
        );
        if (relativePath.startsWith("/")) {
          relativePath = relativePath.substring(1);
        }
      }

      // Use the relative path as the mention text
      const newMentionText = entry.is_directory
        ? `${relativePath}/`
        : relativePath;

      // Only add space after mention if it's not a folder (folders end with / and shouldn't have space)
      const addSpace = !newMentionText.endsWith("/");
      const newValue = addSpace
        ? `${beforeAt}@${newMentionText} ${afterAtAndMention}`
        : `${beforeAt}@${newMentionText}${afterAtAndMention}`;

      // Create new mention object with the full path
      const newMention: Mention = {
        file: entry.full_path,
        type: entry.is_directory ? "folder" : "file",
      };

      // Replace the last mention if we're continuing a path, otherwise add new
      const updatedMentions = closePicker
        ? [...extractedMentions, newMention]
        : [newMention];
      setExtractedMentions(updatedMentions);

      onChange(null, newValue, newValue, updatedMentions);

      if (closePicker) {
        setShowFilePicker(false);
        setAtPosition(null);
        // Focus back to input
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    },
    [atPosition, value, extractedMentions, onChange]
  );

  const handleFileSelection = useCallback(
    (entry: DirEntry) => {
      addMentionToInput(entry, true); // Always close picker for regular selection
    },
    [addMentionToInput]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle keys when the file picker is open
    if (showFilePicker) {
      // Keys that should be delegated to the Command component
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        e.preventDefault();

        // Find the Command component and dispatch the key event to it
        const commandElement = commandRef.current?.querySelector(
          "[cmdk-root]"
        ) as HTMLElement;
        if (commandElement) {
          // Create and dispatch a synthetic keyboard event
          const syntheticEvent = new KeyboardEvent("keydown", {
            key: e.key,
            code: e.code,
            keyCode: e.keyCode,
            which: e.which,
            bubbles: true,
            cancelable: true,
          });

          commandElement.dispatchEvent(syntheticEvent);
        }
        return;
      }

      // Handle Escape to close the picker
      if (e.key === "Escape") {
        e.preventDefault();
        setShowFilePicker(false);
        setAtPosition(null);
        setSearchFilter("");
        return;
      }
    }

    onKeyDown?.(e);
  };

  const handleItemClick = useCallback(
    (entry: DirEntry) => {
      // Always select the item (both files and directories)
      handleFileSelection(entry);
    },
    [handleFileSelection]
  );

  return (
    <div className={cn("relative", className)}>
      {/* File picker dropdown */}
      {showFilePicker && (
        <RecursiveFilePickerDropdown
          ref={commandRef}
          entries={getFilteredEntries()}
          selectedIndex={0} // cmdk handles selection internally
          isLoading={searchState.isLoading}
          error={searchState.error}
          onItemClick={handleItemClick}
          searchFilter={searchFilter}
        />
      )}

      {/* Input component */}
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}

// Helper function to extract mentions from input value
const extractMentionsFromValue = (value: string): Mention[] => {
  const mentions: Mention[] = [];

  const mentionRegex = /@([^\s]+)/g;

  let match;
  let _matchCount = 0;

  while ((match = mentionRegex.exec(value)) !== null) {
    _matchCount++;
    const mentionText = match[1];

    // Determine if it's a folder (ends with /) or file
    const isFolder = mentionText.endsWith("/");

    const mentionObj = {
      file: mentionText,
      type: isFolder ? "folder" : "file",
    } as Mention;

    mentions.push(mentionObj);
  }

  return mentions;
};
