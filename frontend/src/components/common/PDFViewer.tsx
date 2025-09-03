import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ZoomIn, ZoomOut, FileText, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { api } from "../../lib/api";

// Configure PDF.js worker to use local version instead of CDN to avoid CORS issues
// Serve worker from public directory (copied during build)
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PDFViewerProps {
  filePath: string;
  scale?: number;
  onLoadSuccess?: (numPages: number) => void;
  hideControls?: boolean;
}

export function PDFViewer({
  filePath,
  scale: externalScale,
  onLoadSuccess,
  hideControls = false,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [internalScale, setInternalScale] = useState(1.0);

  const scale = externalScale !== undefined ? externalScale : internalScale;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<string | null>(null);

  useEffect(() => {
    const loadPDFFile = async () => {
      setLoading(true);
      setError(null);

      try {
        const base64Content = await api.read_binary_file_as_base64({
          path: filePath,
        });

        if (!base64Content) {
          throw new Error("Failed to read PDF file");
        }

        // Create a data URL from the base64 content
        const dataUrl = `data:application/pdf;base64,${base64Content}`;
        setPdfFile(dataUrl);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load PDF file"
        );
      } finally {
        setLoading(false);
      }
    };

    loadPDFFile();
  }, [filePath]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    if (onLoadSuccess) {
      onLoadSuccess(numPages);
    }
  };

  const onDocumentLoadError = (error: Error) => {
    setError(`Failed to load PDF: ${error.message}`);
  };

  const zoomIn = () => {
    setInternalScale((prev) => Math.min(3.0, prev + 0.25));
  };

  const zoomOut = () => {
    setInternalScale((prev) => Math.max(0.5, prev - 0.25));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 animate-pulse text-red-500" />
          <span>Loading PDF...</span>
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
      {/* Controls - only show if not hidden */}
      {!hideControls && (
        <div className="flex items-center justify-between p-3 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium">PDF Viewer</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomOut}
              disabled={scale <= 0.5}
              className="h-7 w-7 p-0"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Badge variant="outline" className="text-xs px-2 py-0.5">
              {Math.round(scale * 100)}%
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomIn}
              disabled={scale >= 3.0}
              className="h-7 w-7 p-0"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>

            {numPages && (
              <>
                <div className="w-px h-4 bg-border mx-1" />

                {/* Page count display */}
                <Badge variant="outline" className="text-xs px-2 py-0.5">
                  {numPages} {numPages === 1 ? "page" : "pages"}
                </Badge>
              </>
            )}
          </div>
        </div>
      )}

      {/* PDF Content */}
      <div
        className="overflow-auto bg-gray-100 dark:bg-gray-900"
        style={{ height: "600px", maxHeight: "70vh" }}
      >
        <div
          className="flex flex-col items-center gap-4 p-4"
          style={{ minHeight: "100%" }}
        >
          {pdfFile && (
            <Document
              file={pdfFile}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center gap-2 p-8">
                  <FileText className="h-6 w-6 animate-pulse text-red-500" />
                  <span>Loading PDF document...</span>
                </div>
              }
              error={
                <div className="flex items-center gap-2 p-8 text-red-500">
                  <AlertCircle className="h-6 w-6" />
                  <span>Error loading PDF document</span>
                </div>
              }
            >
              {/* Render all pages for continuous scrolling */}
              <div className="flex flex-col items-center gap-4">
                {numPages &&
                  Array.from(new Array(numPages), (_, index) => (
                    <Page
                      key={`page_${index + 1}`}
                      pageNumber={index + 1}
                      scale={scale}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      className="shadow-lg"
                    />
                  ))}
              </div>
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
