import { useState, useEffect } from "react";
import { FileText, Copy, Download, Edit, Save, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { api } from "../../lib/api";
import { CodeMirrorViewer } from "./CodeMirrorViewer";

interface FileContentViewerProps {
  filePath: string | null;
  onClose: () => void;
}

interface FileContent {
  path: string;
  content: string | null;
  size: number;
  modified: number | null;
  encoding: string;
  is_text: boolean;
  is_binary: boolean;
  error: string | null;
}

export function FileContentViewer({
  filePath,
  onClose,
}: FileContentViewerProps) {
  const { t } = useTranslation();
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [forceViewAsText, setForceViewAsText] = useState(false);

  const isOpen = filePath !== null;

  useEffect(() => {
    if (!filePath) {
      setFileContent(null);
      setError(null);
      setForceViewAsText(false);
      return;
    }

    const loadFileContent = async () => {
      setLoading(true);
      setError(null);

      try {
        const content = await api.read_file_content_with_options({ 
          path: filePath,
          forceText: forceViewAsText
        });
        setFileContent(content);
        setEditedContent(content.content || "");
        setIsEditing(false);

        if (content.error) {
          setError(content.error);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load file content"
        );
      } finally {
        setLoading(false);
      }
    };

    loadFileContent();
  }, [filePath, forceViewAsText]);

  const handleEdit = () => {
    if ((fileContent?.is_text || (fileContent?.is_binary && forceViewAsText)) && fileContent.content !== null) {
      setIsEditing(true);
      setEditedContent(fileContent.content);
    }
  };

  const handleSave = async () => {
    if (!filePath) return;

    setSaving(true);
    setError(null);

    try {
      const result = await api.write_file_content({
        path: filePath,
        content: editedContent,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setFileContent(result);
        setIsEditing(false);
        // Show success toast
        const toast = document.createElement("div");
        toast.className =
          "fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md shadow-lg z-50";
        toast.textContent = "File saved successfully!";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save file");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContent(fileContent?.content || "");
  };

  const handleCopy = async () => {
    if (!fileContent?.content) return;

    try {
      await navigator.clipboard.writeText(fileContent.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy content:", err);
    }
  };

  const handleDownload = () => {
    if (!fileContent?.content || !filePath) return;

    const blob = new Blob([fileContent.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filePath.split("/").pop() || "file.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
  };

  const formatModifiedTime = (timestamp?: number): string => {
    if (!timestamp) return "Unknown";
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getFileExtension = (path: string): string => {
    return path.split(".").pop()?.toLowerCase() || "";
  };

  const getLanguageFromExtension = (path: string): string => {
    const ext = getFileExtension(path);
    const languageMap: Record<string, string> = {
      js: "javascript",
      ts: "typescript",
      jsx: "javascript",
      tsx: "typescript",
      py: "python",
      rs: "rust",
      go: "go",
      java: "java",
      c: "c",
      cpp: "cpp",
      css: "css",
      html: "html",
      json: "json",
      xml: "xml",
      yaml: "yaml",
      yml: "yaml",
      md: "markdown",
      sh: "bash",
      sql: "sql",
      php: "php",
      rb: "ruby",
    };
    return languageMap[ext] || "text";
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="font-mono text-sm truncate" title={filePath}>
                {filePath}
              </span>
              {fileContent && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    {formatFileSize(fileContent.size)}
                  </Badge>
                  {fileContent.modified && (
                    <span className="hidden sm:inline">
                      {formatModifiedTime(fileContent.modified)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {loading ? (
            <div className="space-y-3 p-4">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-24" />
              </div>
              <Skeleton className="h-64 w-full" />
            </div>
          ) : error || fileContent?.error ? (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
              <div className="text-sm text-red-800 dark:text-red-200">
                {error || fileContent?.error}
              </div>
            </div>
          ) : fileContent ? (
            <>
              {/* File actions bar */}
              <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50 rounded-md mx-2 mb-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{fileContent.encoding}</span>
                  <Badge
                    variant={fileContent.is_binary && forceViewAsText ? "destructive" : fileContent.is_text ? "default" : "secondary"}
                    className="text-xs px-1.5 py-0.5"
                  >
                    {fileContent.is_binary && forceViewAsText ? "Binary (forced as text)" : fileContent.is_text ? "Text" : "Binary"}
                  </Badge>
                  {fileContent.is_binary && forceViewAsText && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setForceViewAsText(false)}
                      className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground"
                    >
                      Back to binary view
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {(fileContent.is_text || (fileContent.is_binary && forceViewAsText)) && fileContent.content !== null && (
                    <>
                      {!isEditing ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleEdit}
                            className="text-xs h-7 px-2"
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCopy}
                            className="text-xs h-7 px-2"
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            {copied ? t("common.copied") : t("common.copy")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDownload}
                            className="text-xs h-7 px-2"
                          >
                            <Download className="h-3.5 w-3.5 mr-1" />
                            Download
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleSave}
                            disabled={saving}
                            className="text-xs h-7 px-2"
                          >
                            <Save className="h-3.5 w-3.5 mr-1" />
                            {saving ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancel}
                            disabled={saving}
                            className="text-xs h-7 px-2"
                          >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Cancel
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* File content */}
              <div className="flex-1 overflow-hidden">
                {fileContent.is_binary && !forceViewAsText ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>
                      This is a binary file and cannot be displayed as text.
                    </p>
                    <p className="text-sm mt-2 mb-4">
                      Size: {formatFileSize(fileContent.size)}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setForceViewAsText(true)}
                      className="text-sm"
                    >
                      View anyway
                    </Button>
                  </div>
                ) : fileContent.content !== null ? (
                  <div className="h-full overflow-auto">
                    <CodeMirrorViewer
                      code={isEditing ? editedContent : fileContent.content}
                      language={getLanguageFromExtension(fileContent.path)}
                      readOnly={!isEditing}
                      onChange={isEditing ? setEditedContent : undefined}
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>File is empty or content could not be read.</p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
