import { useState, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Image as ImageIcon,
  AlertCircle,
  Download,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { api } from "../../lib/api";

interface ImageViewerProps {
  filePath: string;
}

export function ImageViewer({ filePath }: ImageViewerProps) {
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageInfo, setImageInfo] = useState<{
    width: number;
    height: number;
    size: number;
  } | null>(null);

  useEffect(() => {
    const loadImageFile = async () => {
      setLoading(true);
      setError(null);

      try {
        const base64Content = await api.read_binary_file_as_base64({
          path: filePath,
        });

        if (!base64Content) {
          throw new Error("Failed to read image file");
        }

        // Get file extension to determine MIME type
        const ext = filePath.split(".").pop()?.toLowerCase();
        const mimeType =
          ext === "png"
            ? "image/png"
            : ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : ext === "gif"
                ? "image/gif"
                : ext === "webp"
                  ? "image/webp"
                  : ext === "svg"
                    ? "image/svg+xml"
                    : "image/png";

        // Create data URL from base64 content
        const dataUrl = `data:${mimeType};base64,${base64Content}`;
        setImageData(dataUrl);

        // Get image dimensions and size
        const img = new Image();
        img.onload = () => {
          // Calculate approximate file size from base64 length
          const approximateSize = Math.round((base64Content.length * 3) / 4);
          setImageInfo({
            width: img.width,
            height: img.height,
            size: approximateSize,
          });
        };
        img.src = dataUrl;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load image file"
        );
      } finally {
        setLoading(false);
      }
    };

    loadImageFile();
  }, [filePath]);

  const zoomIn = () => {
    setScale((prev) => Math.min(5.0, prev + 0.25));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(0.1, prev - 0.25));
  };

  const resetZoom = () => {
    setScale(1.0);
  };

  const rotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleDownload = () => {
    if (!imageData) return;

    const fileName = filePath.split("/").pop() || "image.png";
    const link = document.createElement("a");
    link.href = imageData;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3">
          <ImageIcon className="h-8 w-8 animate-pulse text-blue-500" />
          <span>Loading image...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-500">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-8 w-8" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">Image Viewer</span>
          {imageInfo && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {imageInfo.width} × {imageInfo.height}
              </Badge>
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {formatFileSize(imageInfo.size)}
              </Badge>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomOut}
            disabled={scale <= 0.1}
            className="h-7 w-7 p-0"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetZoom}
            className="text-xs h-7 px-2"
          >
            {Math.round(scale * 100)}%
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomIn}
            disabled={scale >= 5.0}
            className="h-7 w-7 p-0"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>

          <div className="w-px h-4 bg-border mx-1" />

          {/* Rotation */}
          <Button
            variant="ghost"
            size="sm"
            onClick={rotate}
            className="h-7 w-7 p-0"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>

          <div className="w-px h-4 bg-border mx-1" />

          {/* Download */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-7 w-7 p-0"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Image Content */}
      <ScrollArea className="flex-1 bg-gray-50 dark:bg-gray-950">
        <div className="flex items-center justify-center min-h-full p-4">
          {imageData && (
            <img
              src={imageData}
              alt={filePath.split("/").pop() || "Image"}
              className="max-w-none shadow-lg"
              style={{
                transform: `scale(${scale}) rotate(${rotation}deg)`,
                transition: "transform 0.2s ease-in-out",
              }}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
