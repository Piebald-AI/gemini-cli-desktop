import React, { useRef, useEffect } from "react";
import { DirEntry } from "@/lib/webApi";
import { cn } from "@/lib/utils";
import { Folder, File, Loader2, AlertCircle } from "lucide-react";

export interface FilePickerDropdownProps {
  entries: DirEntry[];
  selectedIndex: number;
  currentPath: string;
  isLoading: boolean;
  error: string | null;
  onItemClick: (entry: DirEntry) => void;
  searchFilter?: string;
  className?: string;
}

export const FilePickerDropdown: React.FC<FilePickerDropdownProps> = ({
  entries,
  selectedIndex,
  currentPath,
  isLoading,
  error,
  onItemClick,
  searchFilter,
  className,
}) => {
  const selectedItemRef = useRef<HTMLDivElement>(null);
  
  // Scroll selected item into view when selection changes
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [selectedIndex]);
  const formatEntryName = (entry: DirEntry): string => {
    return entry.is_directory ? `${entry.name}/` : entry.name;
  };

  const getEntryIcon = (entry: DirEntry) => {
    return entry.is_directory ? (
      <Folder className="h-4 w-4 text-blue-500" />
    ) : (
      <File className="h-4 w-4 text-gray-500" />
    );
  };

  const highlightSearchText = (text: string, searchFilter?: string, isDirectory: boolean = false) => {
    if (!searchFilter) return text;
    
    // Special case: if user has typed the folder name with trailing slash,
    // and this is a directory, highlight the entire name including slash
    if (isDirectory && text.endsWith('/') && searchFilter.endsWith('/') && 
        text.toLowerCase() === searchFilter.toLowerCase()) {
      return (
        <span className="bg-yellow-200 dark:bg-yellow-800 font-semibold">
          {text}
        </span>
      );
    }
    
    // For all other cases, use regex to highlight only the matching parts
    // Escape special regex characters in searchFilter to avoid issues with slashes
    const escapedSearchFilter = searchFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearchFilter})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-yellow-200 dark:bg-yellow-800 font-semibold">
          {part}
        </span>
      ) : part
    );
  };

  if (isLoading) {
    return (
      <div className={cn("absolute bottom-full left-0 w-full mb-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-2", className)}>
        <div className="flex items-center justify-center px-3 py-3 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading directory...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("absolute bottom-full left-0 w-full mb-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-2", className)}>
        <div className="flex items-center px-3 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className={cn("absolute bottom-full left-0 w-full mb-1 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-md shadow-lg z-50 py-2", className)}>
        <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
          {searchFilter ? `No files match "${searchFilter}"` : "Empty directory"}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("absolute bottom-full left-0 w-full mb-1 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-md shadow-lg z-50 py-2 max-h-60 overflow-y-auto", className)}>
      {/* Search filter header (only show if filtering) */}
      {searchFilter && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-700">
          <div className="text-xs text-blue-600 dark:text-blue-400">
            Filtering: "{searchFilter}"
          </div>
        </div>
      )}
      
      {/* File and folder entries */}
      {entries.map((entry, index) => (
        <div
          key={`${entry.name}-${entry.is_directory}`}
          ref={index === selectedIndex ? selectedItemRef : null}
          className={cn(
            "flex items-center gap-2 px-3 py-2 cursor-pointer text-sm transition-colors",
            index === selectedIndex
              ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
              : "hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-900 dark:text-gray-100"
          )}
          onClick={() => onItemClick(entry)}
          role="option"
          aria-selected={index === selectedIndex}
        >
          {getEntryIcon(entry)}
          <span className="font-mono text-sm flex-1 truncate">
            {highlightSearchText(formatEntryName(entry), searchFilter, entry.is_directory)}
          </span>
          
          {/* File size for files */}
          {!entry.is_directory && entry.size !== undefined && (
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
              {formatFileSize(entry.size)}
            </span>
          )}
        </div>
      ))}

      {/* Navigation hint */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-700">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-semibold">Enter:</span> Select • <span className="font-semibold">Tab:</span> Smart select/navigate • <span className="font-semibold">↑↓:</span> Move • <span className="font-semibold">Esc:</span> Close
        </div>
      </div>
    </div>
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};