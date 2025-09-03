import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../ui/table";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { FileSpreadsheet, AlertCircle } from "lucide-react";
import { api } from "../../lib/api";

interface ExcelViewerProps {
  filePath: string;
}

export function ExcelViewer({ filePath }: ExcelViewerProps) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExcelFile = async () => {
      setLoading(true);
      setError(null);

      try {
        // Read the Excel file as binary
        const base64Content = await api.read_binary_file_as_base64({
          path: filePath,
        });

        if (!base64Content) {
          throw new Error("Failed to read file content");
        }

        // Convert base64 content to buffer for XLSX
        const binaryString = atob(base64Content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Parse the Excel file
        const wb = XLSX.read(bytes, { type: "array" });
        setWorkbook(wb);

        // Set the first sheet as active
        if (wb.SheetNames.length > 0) {
          setActiveSheet(wb.SheetNames[0]);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load Excel file"
        );
      } finally {
        setLoading(false);
      }
    };

    loadExcelFile();
  }, [filePath]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 animate-pulse text-green-500" />
          <span>Loading Excel file...</span>
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

  if (!workbook || workbook.SheetNames.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8" />
          <span>No worksheets found</span>
        </div>
      </div>
    );
  }

  const currentSheet = workbook.Sheets[activeSheet];
  const jsonData = XLSX.utils.sheet_to_json<string[]>(currentSheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  // Get the maximum number of columns
  const maxCols = Math.max(...jsonData.map((row) => row.length));

  // Create column headers
  const headers = Array.from({ length: maxCols }, (_, i) =>
    XLSX.utils.encode_col(i)
  );

  return (
    <div className="flex flex-col h-full">
      {/* Sheet selector */}
      {workbook.SheetNames.length > 1 && (
        <div className="flex items-center gap-2 p-3 border-b">
          <FileSpreadsheet className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">Worksheets:</span>
          <div className="flex gap-1 flex-wrap">
            {workbook.SheetNames.map((sheetName) => (
              <Badge
                key={sheetName}
                variant={sheetName === activeSheet ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setActiveSheet(sheetName)}
              >
                {sheetName}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center font-mono text-xs sticky left-0 bg-background">
                  #
                </TableHead>
                {headers.map((header) => (
                  <TableHead
                    key={header}
                    className="text-center font-mono text-xs min-w-24"
                  >
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {jsonData.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  <TableCell className="text-center font-mono text-xs bg-muted/50 sticky left-0">
                    {rowIndex + 1}
                  </TableCell>
                  {headers.map((_, colIndex) => (
                    <TableCell
                      key={colIndex}
                      className="text-xs max-w-48 truncate"
                      title={row[colIndex] || ""}
                    >
                      {row[colIndex] || ""}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>

      {/* Footer info */}
      <div className="p-2 border-t bg-muted/30 text-xs text-muted-foreground flex justify-between">
        <span>Sheet: {activeSheet}</span>
        <span>
          {jsonData.length} rows × {maxCols} columns
        </span>
      </div>
    </div>
  );
}
