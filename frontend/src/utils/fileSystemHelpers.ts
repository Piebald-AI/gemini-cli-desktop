import { DirEntry } from "@/lib/webApi";

export const formatEntryName = (entry: DirEntry): string => {
  return entry.is_directory ? `${entry.name}/` : entry.name;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export const isValidDirectoryPath = (path: string): boolean => {
  if (!path || typeof path !== "string") return false;

  // Basic validation - avoid empty strings, just whitespace, etc.
  return path.trim().length > 0;
};

export const normalizeDirectoryPath = (path: string): string => {
  if (!path) return ".";

  // Convert backslashes to forward slashes for consistency
  let normalized = path.replace(/\\/g, "/");

  // Remove trailing slash unless it's root
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized || ".";
};

export const getFileExtension = (filename: string): string => {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
};

export const isImageFile = (filename: string): boolean => {
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"];
  return imageExtensions.includes(getFileExtension(filename));
};

export const isTextFile = (filename: string): boolean => {
  const textExtensions = [
    "txt",
    "md",
    "json",
    "js",
    "ts",
    "tsx",
    "jsx",
    "html",
    "css",
    "scss",
    "py",
    "rs",
    "go",
    "java",
    "cpp",
    "c",
    "h",
    "xml",
    "yml",
    "yaml",
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

// File reading is now handled automatically by the backend:
// - When users type @filename in messages, the backend parses these @-mentions
// - Converts them to ACP ResourceLink blocks with proper file URIs
// - Gemini CLI then reads the actual file contents
// This function is kept for potential future direct file reading needs
export const readFileContent = async (_filePath: string): Promise<string> => {
  // Direct file reading not needed for @-mentions (handled by backend)
  // Keeping stub for potential future use cases
  throw new Error("Direct file reading not yet implemented");
};

export const readDirectoryContents = async (
  _directoryPath: string
): Promise<string[]> => {
  // Directory reading for @-mentions is handled by backend ACP integration
  // Backend converts @folder/ mentions to appropriate ResourceLinks
  throw new Error("Direct directory reading not yet implemented");
};
