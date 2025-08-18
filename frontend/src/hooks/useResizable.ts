import { useCallback, useEffect, useRef, useState } from "react";

interface UseResizableOptions {
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
  onResize?: (width: number) => void;
}

export function useResizable({
  defaultWidth = 320,
  minWidth = 200,
  maxWidth = 600,
  storageKey = "sidebar-width",
  onResize,
}: UseResizableOptions = {}) {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window !== "undefined" && storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          return parsed;
        }
      }
    }
    return defaultWidth;
  });

  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      document.body.classList.add("sidebar-resizing");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.min(
        maxWidth,
        Math.max(minWidth, startWidthRef.current + deltaX)
      );

      setWidth(newWidth);
      onResize?.(newWidth);
    },
    [isResizing, minWidth, maxWidth, onResize]
  );

  const handleMouseUp = useCallback(() => {
    if (!isResizing) return;
    
    setIsResizing(false);
    document.body.classList.remove("sidebar-resizing");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    
    // Save to localStorage
    if (storageKey) {
      localStorage.setItem(storageKey, width.toString());
    }
  }, [isResizing, width, storageKey]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return {
    width,
    isResizing,
    handleMouseDown,
    setWidth,
  };
}