import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  Save,
  X,
  Settings,
  Key,
  Filter,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import {
  McpServerEntry,
  TransportType,
  getTransportType,
  isStdioConfig,
  isSSEConfig,
  isHTTPConfig,
  defaultStdioConfig,
  defaultSSEConfig,
  defaultHTTPConfig,
} from "../../types";
import {
  validateMcpServerEntry,
  ValidationError,
  getFieldError,
} from "../../utils/mcpValidation";
import { useTranslation } from "react-i18next";

interface McpServerCardProps {
  server: McpServerEntry;
  onUpdate: (serverId: string, updatedServer: Partial<McpServerEntry>) => void;
  onDelete: (serverId: string) => void;
  onToggle: (serverId: string) => void;
}

export function McpServerCard({
  server,
  onUpdate,
  onDelete,
  onToggle,
}: McpServerCardProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editedServer, setEditedServer] = useState<McpServerEntry>(server);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    []
  );
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    basic: true,
    transport: false,
    auth: false,
    tools: false,
    advanced: false,
  });

  // Update editedServer when server prop changes
  useEffect(() => {
    setEditedServer(server);
  }, [server]);

  // Validate server whenever editedServer changes
  useEffect(() => {
    if (isEditing) {
      const validation = validateMcpServerEntry(editedServer);
      setValidationErrors(validation.errors);
    }
  }, [editedServer, isEditing]);

  const handleSave = () => {
    const validation = validateMcpServerEntry(editedServer);
    if (validation.isValid) {
      onUpdate(server.id, editedServer);
      setIsEditing(false);
      setValidationErrors([]);
    } else {
      setValidationErrors(validation.errors);
    }
  };

  const handleCancel = () => {
    setEditedServer(server);
    setValidationErrors([]);
    setIsEditing(false);
  };

  const handleTransportTypeChange = (transportType: TransportType) => {
    let newConfig;
    switch (transportType) {
      case "stdio":
        newConfig = { ...defaultStdioConfig };
        break;
      case "sse":
        newConfig = { ...defaultSSEConfig };
        break;
      case "http":
        newConfig = { ...defaultHTTPConfig };
        break;
    }

    // Preserve common settings
    newConfig.env = editedServer.config.env;
    newConfig.cwd = editedServer.config.cwd;
    newConfig.timeout = editedServer.config.timeout;
    newConfig.trust = editedServer.config.trust;
    newConfig.includeTools = editedServer.config.includeTools;
    newConfig.excludeTools = editedServer.config.excludeTools;
    newConfig.oauth = editedServer.config.oauth;
    newConfig.authProviderType = editedServer.config.authProviderType;

    setEditedServer({ ...editedServer, config: newConfig });
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getTransportBadgeColor = (transportType: string) => {
    switch (transportType) {
      case "stdio":
        return "default";
      case "sse":
        return "secondary";
      case "http":
        return "outline";
      default:
        return "default";
    }
  };

  const currentTransportType = getTransportType(editedServer.config);

  // Helper component for displaying field errors
  const FieldError = ({ fieldName }: { fieldName: string }) => {
    const error = getFieldError(validationErrors, fieldName);
    if (!error) return null;

    return (
      <div className="flex items-center gap-1 text-red-500 text-xs mt-1">
        <AlertCircle className="h-3 w-3" />
        <span>{error}</span>
      </div>
    );
  };

  return (
    <Card className={`transition-all ${!server.enabled ? "opacity-60" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isEditing ? (
              <div className="flex flex-col">
                <Input
                  value={editedServer.name}
                  onChange={(e) =>
                    setEditedServer({
                      ...editedServer,
                      name: e.target.value,
                    })
                  }
                  className={`w-48 ${getFieldError(validationErrors, "name") ? "border-red-500" : ""}`}
                  placeholder={t("mcp.serverName")}
                />
                <FieldError fieldName="name" />
              </div>
            ) : (
              <CardTitle className="text-base">{server.name}</CardTitle>
            )}
            <Badge variant={getTransportBadgeColor(currentTransportType)}>
              {currentTransportType.toUpperCase()}
            </Badge>
            {!server.enabled && (
              <Badge variant="secondary">{t("common.disabled")}</Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={validationErrors.length > 0}
                  className={validationErrors.length > 0 ? "opacity-50" : ""}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onToggle(server.id)}
                >
                  {server.enabled ? t("common.disabled") : t("common.enabled")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(server.id)}
                >
                  {t("common.delete")}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {isEditing && (
        <CardContent className="space-y-4">
          {/* Basic Configuration */}
          <Collapsible
            open={expandedSections.basic}
            onOpenChange={() => toggleSection("basic")}
          >
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full text-left">
              {expandedSections.basic ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              {t("mcp.basicConfiguration")}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3 pl-6">
              <div className="space-y-2">
                <Label>{t("mcp.transportType")}</Label>
                <Select
                  value={currentTransportType}
                  onValueChange={(value: TransportType) =>
                    handleTransportTypeChange(value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stdio">
                      {t("mcp.stdioTransport")}
                    </SelectItem>
                    <SelectItem value="sse">{t("mcp.sseTransport")}</SelectItem>
                    <SelectItem value="http">
                      {t("mcp.httpTransport")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Transport-specific fields */}
              {isStdioConfig(editedServer.config) && (
                <>
                  <div className="space-y-2">
                    <Label>{t("mcp.command")} *</Label>
                    <Input
                      value={editedServer.config.command || ""}
                      onChange={(e) =>
                        setEditedServer({
                          ...editedServer,
                          config: {
                            ...editedServer.config,
                            command: e.target.value,
                          },
                        })
                      }
                      className={
                        getFieldError(validationErrors, "command")
                          ? "border-red-500"
                          : ""
                      }
                      placeholder={t("mcp.commandPlaceholder")}
                    />
                    <FieldError fieldName="command" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("mcp.arguments")}</Label>
                    <Input
                      value={editedServer.config.args?.join(", ") || ""}
                      onChange={(e) =>
                        setEditedServer({
                          ...editedServer,
                          config: {
                            ...editedServer.config,
                            args: e.target.value
                              .split(",")
                              .map((arg) => arg.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                      placeholder={t("mcp.argumentsPlaceholder")}
                    />
                  </div>
                </>
              )}

              {isSSEConfig(editedServer.config) && (
                <div className="space-y-2">
                  <Label>{t("mcp.sseUrl")} *</Label>
                  <Input
                    value={editedServer.config.url || ""}
                    onChange={(e) =>
                      setEditedServer({
                        ...editedServer,
                        config: { ...editedServer.config, url: e.target.value },
                      })
                    }
                    className={
                      getFieldError(validationErrors, "url")
                        ? "border-red-500"
                        : ""
                    }
                    placeholder={t("mcp.sseUrlPlaceholder")}
                  />
                  <FieldError fieldName="url" />
                </div>
              )}

              {isHTTPConfig(editedServer.config) && (
                <div className="space-y-2">
                  <Label>{t("mcp.httpUrl")} *</Label>
                  <Input
                    value={editedServer.config.httpUrl || ""}
                    onChange={(e) =>
                      setEditedServer({
                        ...editedServer,
                        config: {
                          ...editedServer.config,
                          httpUrl: e.target.value,
                        },
                      })
                    }
                    className={
                      getFieldError(validationErrors, "httpUrl")
                        ? "border-red-500"
                        : ""
                    }
                    placeholder={t("mcp.httpUrlPlaceholder")}
                  />
                  <FieldError fieldName="httpUrl" />
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Advanced Configuration */}
          <Collapsible
            open={expandedSections.advanced}
            onOpenChange={() => toggleSection("advanced")}
          >
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full text-left">
              {expandedSections.advanced ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Settings className="h-3 w-3" />
              {t("mcp.advancedSettings")}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3 pl-6">
              <div className="space-y-2">
                <Label>{t("mcp.timeout")}</Label>
                <Input
                  type="number"
                  value={editedServer.config.timeout || 600000}
                  onChange={(e) =>
                    setEditedServer({
                      ...editedServer,
                      config: {
                        ...editedServer.config,
                        timeout: parseInt(e.target.value) || 600000,
                      },
                    })
                  }
                />
              </div>

              {isStdioConfig(editedServer.config) && (
                <div className="space-y-2">
                  <Label>{t("mcp.workingDirectory")}</Label>
                  <Input
                    value={editedServer.config.cwd || ""}
                    onChange={(e) =>
                      setEditedServer({
                        ...editedServer,
                        config: { ...editedServer.config, cwd: e.target.value },
                      })
                    }
                    placeholder={t("mcp.workingDirectoryPlaceholder")}
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`trust-${server.id}`}
                  checked={editedServer.config.trust || false}
                  onCheckedChange={(checked) =>
                    setEditedServer({
                      ...editedServer,
                      config: { ...editedServer.config, trust: !!checked },
                    })
                  }
                />
                <Label htmlFor={`trust-${server.id}`} className="text-sm">
                  {t("mcp.trust")}
                </Label>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* OAuth Configuration */}
          <Collapsible
            open={expandedSections.auth}
            onOpenChange={() => toggleSection("auth")}
          >
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full text-left">
              {expandedSections.auth ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Key className="h-3 w-3" />
              {t("mcp.authentication")}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3 pl-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`oauth-${server.id}`}
                  checked={editedServer.config.oauth?.enabled || false}
                  onCheckedChange={(checked) =>
                    setEditedServer({
                      ...editedServer,
                      config: {
                        ...editedServer.config,
                        oauth: {
                          ...editedServer.config.oauth,
                          enabled: !!checked,
                        },
                      },
                    })
                  }
                />
                <Label htmlFor={`oauth-${server.id}`} className="text-sm">
                  {t("mcp.enableOAuth")}
                </Label>
              </div>

              {editedServer.config.oauth?.enabled && (
                <div className="space-y-3 border-l-2 border-muted pl-4">
                  <div className="space-y-2">
                    <Label>{t("mcp.clientId")}</Label>
                    <Input
                      value={editedServer.config.oauth?.clientId || ""}
                      onChange={(e) =>
                        setEditedServer({
                          ...editedServer,
                          config: {
                            ...editedServer.config,
                            oauth: {
                              ...editedServer.config.oauth,
                              clientId: e.target.value,
                            },
                          },
                        })
                      }
                      placeholder={t("mcp.oauthClientDescription")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("mcp.scopes")}</Label>
                    <Input
                      value={
                        editedServer.config.oauth?.scopes?.join(", ") || ""
                      }
                      onChange={(e) =>
                        setEditedServer({
                          ...editedServer,
                          config: {
                            ...editedServer.config,
                            oauth: {
                              ...editedServer.config.oauth,
                              scopes: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            },
                          },
                        })
                      }
                      placeholder={t("mcp.scopesPlaceholder")}
                    />
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Tool Filtering */}
          <Collapsible
            open={expandedSections.tools}
            onOpenChange={() => toggleSection("tools")}
          >
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full text-left">
              {expandedSections.tools ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Filter className="h-3 w-3" />
              {t("mcp.toolFiltering")}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3 pl-6">
              <div className="space-y-2">
                <Label>{t("mcp.includeTools")}</Label>
                <Input
                  value={editedServer.config.includeTools?.join(", ") || ""}
                  onChange={(e) =>
                    setEditedServer({
                      ...editedServer,
                      config: {
                        ...editedServer.config,
                        includeTools: e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                      },
                    })
                  }
                  placeholder={t("mcp.includeToolsPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("mcp.excludeTools")}</Label>
                <Input
                  value={editedServer.config.excludeTools?.join(", ") || ""}
                  onChange={(e) =>
                    setEditedServer({
                      ...editedServer,
                      config: {
                        ...editedServer.config,
                        excludeTools: e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                      },
                    })
                  }
                  placeholder={t("mcp.excludeToolsPlaceholder")}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("mcp.toolFilteringDescription")}
              </p>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      )}

      {!isEditing && (
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-1">
            {currentTransportType === "stdio" &&
              isStdioConfig(server.config) && (
                <div>
                  {t("mcp.command")}:{" "}
                  {server.config.command || t("mcp.notConfigured")}
                </div>
              )}
            {currentTransportType === "sse" && isSSEConfig(server.config) && (
              <div className="flex items-center gap-1">
                {t("mcp.url")}: {server.config.url || t("mcp.notConfigured")}
                {server.config.url && <ExternalLink className="h-3 w-3" />}
              </div>
            )}
            {currentTransportType === "http" && isHTTPConfig(server.config) && (
              <div className="flex items-center gap-1">
                {t("mcp.httpUrl")}:{" "}
                {server.config.httpUrl || t("mcp.notConfigured")}
                {server.config.httpUrl && <ExternalLink className="h-3 w-3" />}
              </div>
            )}
          </div>

          {/* Configuration indicators */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {server.config.oauth?.enabled && (
              <Badge variant="outline" className="text-xs">
                <Key className="h-3 w-3 mr-1" />
                {t("mcp.oauth")}
              </Badge>
            )}
            {server.config.trust && (
              <Badge variant="outline" className="text-xs">
                {t("mcp.trusted")}
              </Badge>
            )}
            {(server.config.includeTools?.length ?? 0) > 0 && (
              <Badge variant="outline" className="text-xs">
                +{server.config.includeTools?.length} {t("mcp.tools")}
              </Badge>
            )}
            {(server.config.excludeTools?.length ?? 0) > 0 && (
              <Badge variant="outline" className="text-xs">
                -{server.config.excludeTools?.length} {t("mcp.tools")}
              </Badge>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
