import { DirEntry } from "@/lib/webApi";

export const formatEntryName = (entry: DirEntry): string => {
  return entry.is_directory ? `${entry.name}/` : entry.name;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const isValidDirectoryPath = (path: string): boolean => {
  if (!path || typeof path !== 'string') return false;
  
  // Basic validation - avoid empty strings, just whitespace, etc.
  return path.trim().length > 0;
};

export const normalizeDirectoryPath = (path: string): string => {
  if (!path) return '.';
  
  // Convert backslashes to forward slashes for consistency
  let normalized = path.replace(/\\/g, '/');
  
  // Remove trailing slash unless it's root
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  
  return normalized || '.';
};

export const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
};

export const isImageFile = (filename: string): boolean => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
  return imageExtensions.includes(getFileExtension(filename));
};

export const isTextFile = (filename: string): boolean => {
  const textExtensions = [
    'txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'scss',
    'py', 'rs', 'go', 'java', 'cpp', 'c', 'h', 'xml', 'yml', 'yaml'
  ];
  return textExtensions.includes(getFileExtension(filename));
};

export const sortDirectoryEntries = (entries: DirEntry[]): DirEntry[] => {
  return [...entries].sort((a, b) => {
    // Directories first
    if (a.is_directory && !b.is_directory) return -1;
    if (!a.is_directory && b.is_directory) return 1;
    
    // Then alphabetically by name
    return a.name.localeCompare(b.name);
  });
};

// TODO: File reading utilities for future implementation
export const readFileContent = async (_filePath: string): Promise<string> => {
  // TODO: Implement file reading via backend API
  throw new Error("File reading not yet implemented");
};

export const readDirectoryContents = async (_directoryPath: string): Promise<string[]> => {
  // TODO: Implement recursive directory reading via backend API
  throw new Error("Directory content reading not yet implemented");
};