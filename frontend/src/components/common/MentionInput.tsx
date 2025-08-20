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
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [atPosition, setAtPosition] = useState<number | null>(null);
  const [extractedMentions, setExtractedMentions] = useState<Mention[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize file system navigation with working directory
  const [navState, navActions] = useFileSystemNavigation(workingDirectory);

  // Update working directory when it changes
  useEffect(() => {
    if (workingDirectory && workingDirectory !== navState.currentPath) {
      navActions.loadDirectory(workingDirectory);
    }
  }, [workingDirectory, navState.currentPath, navActions]);

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
          return atIndex;
        }
      }
    }
    return null;
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;
    
    // Detect @ trigger
    const atPos = detectAtTrigger(newValue, cursorPosition);
    
    if (atPos !== null) {
      setAtPosition(atPos);
      setShowFilePicker(true);
      navActions.resetSelection();
    } else {
      setShowFilePicker(false);
      setAtPosition(null);
    }

    // Extract mentions from the value (for future file reading integration)
    const mentions = extractMentionsFromValue(newValue);
    setExtractedMentions(mentions);

    onChange(e, newValue, newValue, mentions);
  };

  const handleFileSelection = useCallback((entry: DirEntry) => {
    if (atPosition === null || !inputRef.current) return;

    const beforeAt = value.substring(0, atPosition);
    const afterAtAndMention = value.substring(inputRef.current.selectionStart || value.length);
    
    const mentionText = entry.is_directory ? `${entry.name}/` : entry.name;
    const newValue = `${beforeAt}@${mentionText} ${afterAtAndMention}`;
    
    // Create new mention object
    const newMention: Mention = {
      file: entry.full_path,
      type: entry.is_directory ? "folder" : "file"
    };
    
    const updatedMentions = [...extractedMentions, newMention];
    setExtractedMentions(updatedMentions);
    
    onChange(null, newValue, newValue, updatedMentions);
    setShowFilePicker(false);
    setAtPosition(null);

    // Focus back to input
    setTimeout(() => inputRef.current?.focus(), 0);

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
    if (showFilePicker && !navState.isLoading) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        navActions.selectNext();
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        navActions.selectPrevious();
        return;
      } else if (e.key === "Enter") {
        e.preventDefault();
        const currentEntry = navActions.getCurrentEntry();
        if (currentEntry) {
          handleFileSelection(currentEntry);
        }
        return;
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (navActions.canNavigateDeeper()) {
          const currentEntry = navActions.getCurrentEntry();
          if (currentEntry && currentEntry.is_directory) {
            navActions.navigateToFolder(currentEntry.name);
          }
        }
        return;
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowFilePicker(false);
        setAtPosition(null);
        return;
      }
    }

    onKeyDown?.(e);
  };

  const handleItemClick = useCallback((entry: DirEntry) => {
    handleFileSelection(entry);
  }, [handleFileSelection]);

  return (
    <div className={cn("relative", className)}>
      {/* File picker dropdown */}
      {showFilePicker && (
        <FilePickerDropdown
          entries={navState.entries}
          selectedIndex={navState.selectedIndex}
          currentPath={navState.currentPath}
          isLoading={navState.isLoading}
          error={navState.error}
          onItemClick={handleItemClick}
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
