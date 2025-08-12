import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Alert, AlertDescription } from "../ui/alert";
import { AlertCircle } from "lucide-react";
import {
  McpServerEntry,
  McpServersConfig,
  getTransportType,
  isStdioConfig,
  isSSEConfig,
  isHTTPConfig,
} from "../../types";

interface PasteJsonDialogProps {
  trigger: React.ReactNode;
  onServersAdd: (servers: McpServerEntry[]) => void;
}

export function PasteJsonDialog({
  trigger,
  onServersAdd,
}: PasteJsonDialogProps) {
  const [open, setOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [parsedServers, setParsedServers] = useState<McpServerEntry[]>([]);
  const [error, setError] = useState<string>("");

  // Parse JSON input and update preview
  const parseJson = (input: string) => {
    if (!input.trim()) {
      setParsedServers([]);
      setError("");
      return;
    }

    try {
      const parsed = JSON.parse(input);

      // Check if it's a complete settings.json structure
      let mcpServers: McpServersConfig;
      if (parsed.mcpServers) {
        mcpServers = parsed.mcpServers;
      } else if (typeof parsed === "object" && !Array.isArray(parsed)) {
        // Assume it's just the mcpServers object
        mcpServers = parsed;
      } else {
        throw new Error(
          "Invalid format. Expected an object with server configurations."
        );
      }

      // Convert to McpServerEntry format
      const serverEntries: McpServerEntry[] = Object.entries(mcpServers).map(
        ([name, config], index) => ({
          id: `imported-server-${Date.now()}-${index}`,
          name,
          config: config as McpServerEntry["config"],
          enabled: true,
        })
      );

      setParsedServers(serverEntries);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON format");
      setParsedServers([]);
    }
  };

  const handleInputChange = (value: string) => {
    setJsonInput(value);
    parseJson(value);
  };

  const handleCreate = () => {
    if (parsedServers.length > 0) {
      onServersAdd(parsedServers);
      setOpen(false);
      setJsonInput("");
      setParsedServers([]);
      setError("");
    }
  };

  const handleClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setJsonInput("");
      setParsedServers([]);
      setError("");
    }
  };

  // Format server details for preview
  const formatServerPreview = (server: McpServerEntry) => {
    const config = server.config;
    const details: string[] = [];

    // Add transport-specific info
    if (isStdioConfig(config)) {
      details.push(`${config.command} ${(config.args || []).join(" ")}`.trim());
    } else if (isSSEConfig(config)) {
      details.push(config.url);
    } else if (isHTTPConfig(config)) {
      details.push(config.httpUrl);
    }

    // Add environment variables
    if (config.env && Object.keys(config.env).length > 0) {
      const envStrings = Object.entries(config.env).map(
        ([key, value]) => `${key} = ${value}`
      );
      details.push(`Environment: ${envStrings.join(" • ")}`);
    }

    // Add headers (for HTTP servers)
    if (config.headers && Object.keys(config.headers).length > 0) {
      const headerStrings = Object.entries(config.headers).map(
        ([key, value]) => `${key} = ${value}`
      );
      details.push(`Headers: ${headerStrings.join(" • ")}`);
    }

    // Add include/exclude tools
    if (config.includeTools && config.includeTools.length > 0) {
      details.push(`Include Tools: ${config.includeTools.join(" • ")}`);
    }
    if (config.excludeTools && config.excludeTools.length > 0) {
      details.push(`Exclude Tools: ${config.excludeTools.join(" • ")}`);
    }

    // Add working directory and timeout
    if (isStdioConfig(config) && config.cwd) {
      details.push(`Working Dir: ${config.cwd}`);
    }
    if (config.timeout) {
      const minutes = Math.round(config.timeout / 60000);
      details.push(
        `Timeout: ${config.timeout.toLocaleString()}ms (${minutes} minutes)`
      );
    }

    return details;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Paste JSON</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {/* JSON Input */}
          <div className="space-y-2">
            <Textarea
              id="jsonInput"
              value={jsonInput}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Paste JSON here"
              className="min-h-[200px] font-mono text-sm border border-input rounded-md"
            />
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {parsedServers.length > 0 && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">Preview</Label>
              <div className="space-y-3">
                {parsedServers.map((server, index) => {
                  const details = formatServerPreview(server);
                  const trustStatus = server.config.trust;

                  return (
                    <div
                      key={index}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-base">
                          {server.name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {getTransportType(server.config) === "stdio"
                            ? isStdioConfig(server.config)
                              ? server.config.command
                              : ""
                            : getTransportType(server.config) === "sse"
                              ? isSSEConfig(server.config)
                                ? server.config.url
                                : ""
                              : isHTTPConfig(server.config)
                                ? server.config.httpUrl
                                : ""}
                        </span>
                        {trustStatus ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                            <span className="w-2 h-2 bg-green-500 rounded-full" />
                            Trusted
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Not Trusted
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 text-sm text-muted-foreground">
                        {details.map((detail, detailIndex) => (
                          <div key={detailIndex}>{detail}</div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Create button */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={handleCreate}
            disabled={parsedServers.length === 0 || !!error}
            className="px-8"
          >
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
