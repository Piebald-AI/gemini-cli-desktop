import React, { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";
import { useFileSystemNavigation } from "@/hooks/useFileSystemNavigation";
import { FilePickerDropdown } from "./FilePickerDropdown";
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
  console.log("📝 [MentionInput] Component initialized with workingDirectory:", workingDirectory);
  
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [atPosition, setAtPosition] = useState<number | null>(null);
  const [extractedMentions, setExtractedMentions] = useState<Mention[]>([]);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [filteredSelectedIndex, setFilteredSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize file system navigation with working directory
  console.log("📁 [MentionInput] Initializing file system navigation with:", workingDirectory);
  const [navState, navActions] = useFileSystemNavigation(workingDirectory);

  // Let useFileSystemNavigation handle initial loading, don't interfere with user navigation

  // Detect @ trigger and show file picker
  const detectAtTrigger = useCallback((inputValue: string, cursorPos: number) => {
    const beforeCursor = inputValue.substring(0, cursorPos);
    const atIndex = beforeCursor.lastIndexOf("@");
    
    if (atIndex !== -1) {
      const afterAt = beforeCursor.substring(atIndex + 1);
      // Show picker if @ is at start of word (preceded by whitespace or start of string)
      const charBeforeAt = atIndex > 0 ? beforeCursor[atIndex - 1] : " ";
      if (/\s/.test(charBeforeAt) || atIndex === 0) {
        // Only show if there's no space after @ (still building the mention)
        if (!afterAt.includes(" ")) {
          return { atIndex, searchText: afterAt };
        }
      }
    }
    return null;
  }, []);

  // Filter entries based on search text
  const getFilteredEntries = useCallback(() => {
    if (!searchFilter) {
      return navState.entries;
    }
    
    return navState.entries.filter(entry => 
      entry.name.toLowerCase().includes(searchFilter.toLowerCase())
    );
  }, [navState.entries, searchFilter]);

  // Reset selection when search filter changes or entries change
  useEffect(() => {
    console.log("🔥 [MentionInput] useEffect: Resetting filteredSelectedIndex to 0 due to searchFilter or entries change");
    console.log("🔥 [MentionInput] searchFilter:", searchFilter, "entries count:", navState.entries.length);
    setFilteredSelectedIndex(0);
  }, [searchFilter, navState.entries]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;
    
    console.log("🔥 [MentionInput] handleInputChange - newValue:", JSON.stringify(newValue), "cursorPosition:", cursorPosition);
    console.log("🔥 [MentionInput] Current state - atPosition:", atPosition, "searchFilter:", JSON.stringify(searchFilter), "showFilePicker:", showFilePicker);
    
    // Detect @ trigger
    const atTrigger = detectAtTrigger(newValue, cursorPosition);
    
    if (atTrigger !== null) {
      console.log("@ [MentionInput] @ trigger detected at position:", atTrigger.atIndex, "search text:", atTrigger.searchText);
      console.log("@ [MentionInput] Current navState entries:", navState.entries.length, "items");
      console.log("@ [MentionInput] Current path:", navState.currentPath);
      console.log("@ [MentionInput] Loading state:", navState.isLoading);
      console.log("@ [MentionInput] Error state:", navState.error);
      
      // If this is a fresh @ (no search text), reset to working directory
      if (atTrigger.searchText === "" && navState.currentPath !== workingDirectory) {
        console.log("🔥 [MentionInput] Fresh @ detected, resetting to working directory:", workingDirectory);
        navActions.loadDirectory(workingDirectory);
      }
      
      console.log("🔥 [MentionInput] Setting @ trigger state");
      setAtPosition(atTrigger.atIndex);
      setSearchFilter(atTrigger.searchText);
      setShowFilePicker(true);
      setFilteredSelectedIndex(0);
    } else {
      console.log("🔥 [MentionInput] No @ trigger detected - clearing state");
      console.log("🔥 [MentionInput] Clearing @ trigger state");
      setShowFilePicker(false);
      setAtPosition(null);
      setSearchFilter("");
      setFilteredSelectedIndex(0);
    }

    // Extract mentions from the value (for future file reading integration)
    const mentions = extractMentionsFromValue(newValue);
    console.log("🔥 [MentionInput] Extracted mentions:", mentions);
    setExtractedMentions(mentions);

    onChange(e, newValue, newValue, mentions);
  };

  const addMentionToInput = useCallback((entry: DirEntry, closePicker = true) => {
    console.log("🔥 [MentionInput] addMentionToInput called with entry:", entry.name, "closePicker:", closePicker);
    
    if (atPosition === null) {
      console.log("🔥 [MentionInput] addMentionToInput early return - missing atPosition");
      return;
    }

    const beforeAt = value.substring(0, atPosition);
    // Use value.length as fallback instead of relying on inputRef.current.selectionStart
    const cursorPosition = inputRef.current?.selectionStart || value.length;
    const afterAtAndMention = value.substring(cursorPosition);
    
    // Find the existing mention text (everything after @ until space or end)
    const afterAtPos = value.substring(atPosition + 1);
    const spaceIndex = afterAtPos.indexOf(' ');
    const existingMentionText = spaceIndex === -1 ? afterAtPos : afterAtPos.substring(0, spaceIndex);
    
    console.log("🔥 [MentionInput] Existing mention text:", existingMentionText);
    
    const mentionText = entry.is_directory ? `${entry.name}/` : entry.name;
    
    // If this is the first mention (Tab from initial directory), just use the entry name
    // If continuing a path, append to the existing mention
    const newMentionText = existingMentionText.length === 0 ? mentionText : `${existingMentionText}${mentionText}`;
    
    const newValue = `${beforeAt}@${newMentionText} ${afterAtAndMention}`;
    
    console.log("🔥 [MentionInput] Building mention - existing:", existingMentionText, "entry:", mentionText, "final:", newMentionText);
    console.log("🔥 [MentionInput] New value:", newValue);
    
    // Create new mention object with the full path
    const newMention: Mention = {
      file: entry.full_path,
      type: entry.is_directory ? "folder" : "file"
    };
    
    // Replace the last mention if we're continuing a path, otherwise add new
    const updatedMentions = closePicker ? [...extractedMentions, newMention] : [newMention];
    setExtractedMentions(updatedMentions);
    
    console.log("🔥 [MentionInput] Calling onChange");
    onChange(null, newValue, newValue, updatedMentions);
    
    if (closePicker) {
      console.log("🔥 [MentionInput] Closing file picker");
      setShowFilePicker(false);
      setAtPosition(null);
      // Focus back to input
      console.log("🔥 [MentionInput] Setting timeout to focus input");
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      console.log("🔥 [MentionInput] Keeping picker open");
    }
  }, [atPosition, value, extractedMentions, onChange]);

  const handleFileSelection = useCallback((entry: DirEntry) => {
    console.log("🔥 [MentionInput] handleFileSelection called with entry:", entry.name, "type:", entry.is_directory ? "directory" : "file");
    addMentionToInput(entry, true); // Always close picker for regular selection

    // TODO: Implement file reading functionality here
    // if (entry.is_directory) {
    //   // TODO: Read all files in folder and include in context
    //   console.log("TODO: Read folder contents:", entry.full_path);
    // } else {
    //   // TODO: Read single file and include in context
    //   console.log("TODO: Read file:", entry.full_path);
    // }
  }, [atPosition, value, extractedMentions, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    console.log("🔥 [MentionInput] Key pressed:", e.key, "showFilePicker:", showFilePicker, "isLoading:", navState.isLoading);
    
    if (showFilePicker && !navState.isLoading) {
      const filteredEntries = getFilteredEntries();
      const selectedEntry = filteredEntries[filteredSelectedIndex];
      
      console.log("🔥 [MentionInput] Filtered entries count:", filteredEntries.length);
      console.log("🔥 [MentionInput] Current filteredSelectedIndex:", filteredSelectedIndex);
      console.log("🔥 [MentionInput] Selected entry:", selectedEntry?.name, "isDir:", selectedEntry?.is_directory);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        console.log("🔥 [MentionInput] ArrowDown pressed");
        if (filteredEntries.length > 0 && filteredSelectedIndex < filteredEntries.length - 1) {
          const newIndex = filteredSelectedIndex + 1;
          console.log("🔥 [MentionInput] Setting filteredSelectedIndex to:", newIndex);
          setFilteredSelectedIndex(newIndex);
        } else {
          console.log("🔥 [MentionInput] ArrowDown blocked - at end or no entries");
        }
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        console.log("🔥 [MentionInput] ArrowUp pressed");
        if (filteredSelectedIndex > 0) {
          const newIndex = filteredSelectedIndex - 1;
          console.log("🔥 [MentionInput] Setting filteredSelectedIndex to:", newIndex);
          setFilteredSelectedIndex(newIndex);
        } else {
          console.log("🔥 [MentionInput] ArrowUp blocked - at start");
        }
        return;
      } else if (e.key === "Enter") {
        e.preventDefault();
        console.log("🔥 [MentionInput] Enter pressed");
        if (selectedEntry) {
          console.log("⌨️ [MentionInput] Enter: Selecting item:", selectedEntry.name, "type:", selectedEntry.is_directory ? "directory" : "file");
          console.log("🔥 [MentionInput] About to call handleFileSelection");
          handleFileSelection(selectedEntry);
          console.log("🔥 [MentionInput] handleFileSelection completed");
        } else {
          console.log("🔥 [MentionInput] Enter pressed but no selectedEntry");
        }
        return;
      } else if (e.key === "Tab") {
        e.preventDefault();
        console.log("🔥 [MentionInput] Tab pressed");
        if (selectedEntry && selectedEntry.is_directory) {
          console.log("⌨️ [MentionInput] Tab: Adding folder to mentions AND navigating to directory:", selectedEntry.name);
          
          // First, add the folder to mentions (but keep picker open)
          console.log("🔥 [MentionInput] About to call addMentionToInput with closePicker=false");
          addMentionToInput(selectedEntry, false);
          
          // Then navigate into the folder
          console.log("🔥 [MentionInput] About to call navigateToFolder to show contents");
          navActions.navigateToFolder(selectedEntry.name);
          console.log("🔥 [MentionInput] Clearing search filter");
          setSearchFilter(""); // Clear search when navigating
          console.log("🔥 [MentionInput] Resetting filteredSelectedIndex to 0");
          setFilteredSelectedIndex(0);
          console.log("🔥 [MentionInput] Tab completed - added mention and navigated");
        } else {
          console.log("🔥 [MentionInput] Tab pressed but selectedEntry is not a directory or null");
        }
        return;
      } else if (e.key === "Escape") {
        e.preventDefault();
        console.log("🔥 [MentionInput] Escape pressed");
        setShowFilePicker(false);
        setAtPosition(null);
        setSearchFilter("");
        setFilteredSelectedIndex(0);
        return;
      }
    } else {
      console.log("🔥 [MentionInput] Key ignored - showFilePicker:", showFilePicker, "isLoading:", navState.isLoading);
    }

    console.log("🔥 [MentionInput] Calling parent onKeyDown");
    onKeyDown?.(e);
  };

  const handleItemClick = useCallback((entry: DirEntry) => {
    console.log("🔥 [MentionInput] handleItemClick called with entry:", entry.name, "type:", entry.is_directory ? "directory" : "file");
    
    if (entry.is_directory) {
      // Navigate into directory
      console.log("📁 [MentionInput] Navigating to directory:", entry.name);
      console.log("🔥 [MentionInput] About to call navigateToFolder from click");
      navActions.navigateToFolder(entry.name);
      console.log("🔥 [MentionInput] Clearing search filter from click");
      setSearchFilter(""); // Clear search when navigating
      console.log("🔥 [MentionInput] Resetting filteredSelectedIndex to 0 from click");
      setFilteredSelectedIndex(0);
    } else {
      // Select file
      console.log("📄 [MentionInput] Selecting file:", entry.name);
      console.log("🔥 [MentionInput] About to call handleFileSelection from click");
      handleFileSelection(entry);
    }
  }, [handleFileSelection, navActions]);

  return (
    <div className={cn("relative", className)}>
      {/* File picker dropdown */}
      {showFilePicker && (
        <FilePickerDropdown
          entries={getFilteredEntries()}
          selectedIndex={filteredSelectedIndex}
          currentPath={navState.currentPath}
          isLoading={navState.isLoading}
          error={navState.error}
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
  
  while ((match = mentionRegex.exec(value)) !== null) {
    const mentionText = match[1];
    // Determine if it's a folder (ends with /) or file
    const isFolder = mentionText.endsWith("/");
    
    mentions.push({
      file: mentionText,
      type: isFolder ? "folder" : "file"
    });
  }
  
  return mentions;
};
