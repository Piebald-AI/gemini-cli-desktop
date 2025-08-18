import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Settings, FileText, Package, Trash2 } from "lucide-react";
import {
  McpServerEntry,
  McpServersConfig,
  isStdioConfig,
  isSSEConfig,
  isHTTPConfig,
} from "../../types";
import { AddMcpServerDialog } from "./AddMcpServerDialog";
import { PasteJsonDialog } from "./PasteJsonDialog";
import { ModelContextProtocol } from "../common/ModelContextProtocol";
import { invoke } from "@tauri-apps/api/core";
import { useBackend } from "../../contexts/BackendContext";
import { getBackendText } from "../../utils/backendText";

interface McpServerSettingsProps {
  trigger?: React.ReactNode;
}

export function McpServerSettings({ trigger }: McpServerSettingsProps) {
  const [open, setOpen] = useState(false);
  const [servers, setServers] = useState<McpServerEntry[]>([]);
  const [settingsFilePath, setSettingsFilePath] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<McpServerEntry | null>(
    null
  );
  const { selectedBackend } = useBackend();
  const backendText = getBackendText(selectedBackend);

  // Load settings file path on component mount and when backend changes
  useEffect(() => {
    loadSettingsPath();
  }, [selectedBackend]);

  // Load MCP servers from settings.json file when dialog opens
  useEffect(() => {
    if (open && settingsFilePath) {
      loadSettingsFromFile();
    }
  }, [open, settingsFilePath]);

  const loadSettingsPath = async () => {
    try {
      const path = await invoke<string>("get_settings_file_path", {
        backendType: selectedBackend,
      });
      setSettingsFilePath(path);
    } catch (error) {
      console.error("Failed to get settings file path:", error);
    }
  };

  const loadSettingsFromFile = async () => {
    setIsLoading(true);
    try {
      const settings = await invoke<Record<string, unknown>>(
        "read_settings_file",
        {
          backendType: selectedBackend,
        }
      );
      const mcpServers = settings.mcpServers || {};

      const serverEntries: McpServerEntry[] = Object.entries(mcpServers).map(
        ([name, config], index) => ({
          id: `server-${index}-${name}`,
          name,
          config: config as McpServerEntry["config"],
          enabled: true, // All servers in the file are considered enabled
        })
      );
      setServers(serverEntries);
    } catch (error) {
      console.error("Failed to load MCP servers from settings file:", error);
      setServers([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Save MCP servers to settings.json file
  const saveServersToFile = async (updatedServers: McpServerEntry[]) => {
    setIsLoading(true);
    try {
      // Read current settings to preserve other configurations
      const currentSettings = await invoke<Record<string, unknown>>(
        "read_settings_file",
        {
          backendType: selectedBackend,
        }
      );

      // Update only the mcpServers section
      const mcpServersConfig: McpServersConfig = {};
      updatedServers.forEach((server) => {
        if (server.enabled) {
          mcpServersConfig[server.name] = server.config;
        }
      });

      const updatedSettings = {
        ...currentSettings,
        mcpServers: mcpServersConfig,
      };

      await invoke("write_settings_file", {
        settings: updatedSettings,
        backendType: selectedBackend,
      });
      setServers(updatedServers);
    } catch (error) {
      console.error("Failed to save MCP servers to settings file:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddServer = (server: McpServerEntry) => {
    const updatedServers = [...servers, server];
    saveServersToFile(updatedServers);
  };

  const handleAddServers = (newServers: McpServerEntry[]) => {
    const updatedServers = [...servers, ...newServers];
    saveServersToFile(updatedServers);
  };

  const handleDeleteServer = (server: McpServerEntry) => {
    setServerToDelete(server);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteServer = () => {
    if (serverToDelete) {
      const updatedServers = servers.filter(
        (server) => server.id !== serverToDelete.id
      );
      saveServersToFile(updatedServers);
      setDeleteDialogOpen(false);
      setServerToDelete(null);
    }
  };

  const cancelDeleteServer = () => {
    setDeleteDialogOpen(false);
    setServerToDelete(null);
  };

  const defaultTrigger = (
    <Button variant="ghost" size="sm" className="w-full justify-start">
      <Settings className="h-4 w-4 mr-2" />
      MCP Servers
    </Button>
  );

  // Helper function to format server details
  const formatServerDetails = (server: McpServerEntry) => {
    const config = server.config;
    const details: { label: string; value: string }[] = [];

    // Add environment variables
    if (config.env && Object.keys(config.env).length > 0) {
      const envStrings = Object.entries(config.env)
        .map(([key, value]) => `${key} = ${value}`)
        .join(" • ");
      details.push({ label: "Environment", value: envStrings });
    }

    // Add working directory for stdio servers
    if (isStdioConfig(config) && config.cwd) {
      details.push({ label: "Working Dir", value: config.cwd });
    }

    // Add headers for HTTP servers
    if (
      (isSSEConfig(config) || isHTTPConfig(config)) &&
      config.headers &&
      Object.keys(config.headers).length > 0
    ) {
      const headerStrings = Object.entries(config.headers)
        .map(([key, value]) => `${key} = ${value}`)
        .join(" • ");
      details.push({ label: "Headers", value: headerStrings });
    }

    // Add include tools
    if (config.includeTools && config.includeTools.length > 0) {
      details.push({
        label: "Include Tools",
        value: config.includeTools.join(" • "),
      });
    }

    // Add exclude tools
    if (config.excludeTools && config.excludeTools.length > 0) {
      details.push({
        label: "Exclude Tools",
        value: config.excludeTools.join(" • "),
      });
    }

    // Add timeout
    if (config.timeout) {
      const minutes = Math.round(config.timeout / 60000);
      details.push({
        label: "Timeout",
        value: `${config.timeout.toLocaleString()}ms (${minutes} minutes)`,
      });
    }

    return details;
  };

  const getMainServerInfo = (server: McpServerEntry) => {
    const config = server.config;
    if (isStdioConfig(config)) {
      const args =
        config.args && config.args.length > 0
          ? ` ${config.args.join(" ")}`
          : "";
      return `${config.command}${args}`;
    } else if (isSSEConfig(config)) {
      return config.url;
    } else if (isHTTPConfig(config)) {
      return config.httpUrl;
    }
    return "";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">MCP Servers</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-sm text-muted-foreground">
                Loading settings file...
              </div>
            </div>
          ) : servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <ModelContextProtocol className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No MCP servers configured
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                {backendText.mcpCapabilities} Get started by adding your first
                server configuration.
              </p>
              <div className="flex gap-3">
                <AddMcpServerDialog
                  trigger={
                    <Button className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Add Your First Server
                    </Button>
                  }
                  onServerAdd={handleAddServer}
                />
                <PasteJsonDialog
                  trigger={
                    <Button
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Import from JSON
                    </Button>
                  }
                  onServersAdd={handleAddServers}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {servers.map((server) => {
                const details = formatServerDetails(server);
                const mainInfo = getMainServerInfo(server);

                return (
                  <Card key={server.id} className="p-4">
                    <CardContent className="p-0 space-y-2">
                      {/* Server header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-lg">
                          <span className="font-semibold">{server.name}</span>
                          <span className="text-muted-foreground font-mono text-sm">
                            {mainInfo}
                          </span>
                          {server.config.trust ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <div className="w-2 h-2 bg-green-500 rounded-full" />
                              <span className="text-sm font-medium">
                                Trusted
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Not Trusted
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteServer(server)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Server details */}
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {details.map((detail, index) => (
                          <div key={index}>
                            <span className="font-medium">{detail.label}:</span>{" "}
                            <span className="font-mono">{detail.value}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom action buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <AddMcpServerDialog
            trigger={
              <Button className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Add New
              </Button>
            }
            onServerAdd={handleAddServer}
          />
          <PasteJsonDialog
            trigger={
              <Button variant="outline" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Paste JSON
              </Button>
            }
            onServersAdd={handleAddServers}
          />
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete MCP Server</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the MCP server "
              {serverToDelete?.name}"? This action cannot be undone and will
              permanently remove the server from your settings.json file.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDeleteServer}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteServer}>
              Delete Server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
