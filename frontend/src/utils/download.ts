/**
 * Utility functions for downloading files and content
 */

/**
 * Downloads text content as a file
 */
export function downloadTextContent(content: string, filePath: string): void {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filePath.split("/").pop() || "file.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads image data as a file
 */
export function downloadImageData(imageData: string, filePath: string): void {
  const fileName = filePath.split("/").pop() || "image.png";
  const link = document.createElement("a");
  link.href = imageData;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
