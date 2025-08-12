import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { HelpCircle } from "lucide-react";
import {
  McpServerEntry,
  McpServerConfig,
  TransportType,
  defaultStdioConfig,
  defaultSSEConfig,
  defaultHTTPConfig,
} from "../../types";
import { DynamicList, DynamicKeyValueList } from "./DynamicList";

interface AddMcpServerDialogProps {
  trigger: React.ReactNode;
  onServerAdd: (server: McpServerEntry) => void;
}

interface KeyValuePair {
  key: string;
  value: string;
}

export function AddMcpServerDialog({
  trigger,
  onServerAdd,
}: AddMcpServerDialogProps) {
  const [open, setOpen] = useState(false);
  const [serverName, setServerName] = useState("");
  const [transportType, setTransportType] = useState<TransportType>("stdio");

  // Command fields
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState<string[]>([]);

  // URL fields
  const [url, setUrl] = useState("");
  const [httpUrl, setHttpUrl] = useState("");

  // Common fields
  const [environment, setEnvironment] = useState<KeyValuePair[]>([]);
  const [headers, setHeaders] = useState<KeyValuePair[]>([]);
  const [workingDirectory, setWorkingDirectory] = useState("");
  const [timeout, setTimeout] = useState(300000); // 5 minutes default
  const [trust, setTrust] = useState(false);

  // Tools
  const [includeTools, setIncludeTools] = useState<string[]>([]);
  const [excludeTools, setExcludeTools] = useState<string[]>([]);

  // Authentication
  const [requiresAuthentication, setRequiresAuthentication] = useState(false);
  const [supportsOAuthDiscovery, setSupportsOAuthDiscovery] = useState(false);

  // OAuth fields
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [authorizationUrl, setAuthorizationUrl] = useState("");
  const [tokenUrl, setTokenUrl] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [redirectUri, setRedirectUri] = useState(
    "http://localhost:7777/oauth/callback"
  );
  const [tokenParameterName, setTokenParameterName] = useState("");
  const [audiences, setAudiences] = useState<string[]>([]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  // Set initial server name when dialog opens
  useEffect(() => {
    if (open && !serverName) {
      setServerName(`${transportType}_server`);
    }
  }, [open, transportType, serverName]);

  // Update server name when transport type changes (only if current name matches pattern)
  useEffect(() => {
    if (serverName.endsWith("_server")) {
      setServerName(`${transportType}_server`);
    }
  }, [transportType, serverName]);

  const resetForm = () => {
    setServerName("");
    setTransportType("stdio");
    setCommand("");
    setArgs([]);
    setUrl("");
    setHttpUrl("");
    setEnvironment([]);
    setHeaders([]);
    setWorkingDirectory("");
    setTimeout(300000);
    setTrust(false);
    setIncludeTools([]);
    setExcludeTools([]);
    setRequiresAuthentication(false);
    setSupportsOAuthDiscovery(false);
    setClientId("");
    setClientSecret("");
    setAuthorizationUrl("");
    setTokenUrl("");
    setScopes([]);
    setRedirectUri("http://localhost:7777/oauth/callback");
    setTokenParameterName("");
    setAudiences([]);
  };

  const handleCreate = () => {
    let baseConfig: McpServerConfig;

    // Create base config based on transport type
    if (transportType === "stdio") {
      baseConfig = {
        ...defaultStdioConfig,
        command,
        args: args.length > 0 ? args : undefined,
        cwd: workingDirectory || undefined,
      };
    } else if (transportType === "sse") {
      baseConfig = {
        ...defaultSSEConfig,
        url,
      };
    } else {
      baseConfig = {
        ...defaultHTTPConfig,
        httpUrl,
      };
    }

    // Add common fields
    baseConfig.timeout = timeout;
    baseConfig.trust = trust;

    // Add environment variables
    if (environment.length > 0) {
      baseConfig.env = Object.fromEntries(
        environment.map(({ key, value }) => [key, value])
      );
    }

    // Add headers (only for URL/HTTP URL types)
    if (
      (transportType === "sse" || transportType === "http") &&
      headers.length > 0
    ) {
      baseConfig.headers = Object.fromEntries(
        headers.map(({ key, value }) => [key, value])
      );
    }

    // Add tools
    if (includeTools.length > 0) {
      baseConfig.includeTools = includeTools;
    }
    if (excludeTools.length > 0) {
      baseConfig.excludeTools = excludeTools;
    }

    // Add OAuth configuration
    if (requiresAuthentication) {
      baseConfig.oauth = {
        enabled: true,
        supportsDiscovery: supportsOAuthDiscovery,
        clientId: clientId || undefined,
        clientSecret: clientSecret || undefined,
        authorizationUrl: authorizationUrl || undefined,
        tokenUrl: tokenUrl || undefined,
        scopes: scopes.length > 0 ? scopes : undefined,
        redirectUri:
          redirectUri !== "http://localhost:7777/oauth/callback"
            ? redirectUri
            : undefined,
        tokenParamName: tokenParameterName || undefined,
        audiences: audiences.length > 0 ? audiences : undefined,
      };
    }

    const newServer: McpServerEntry = {
      id: `server-${Date.now()}`,
      name: serverName || `${transportType}_server`,
      config: baseConfig,
      enabled: true,
    };

    onServerAdd(newServer);
    setOpen(false);
  };

  const isHttpTransport = transportType === "sse" || transportType === "http";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            Add New MCP Server
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
              onClick={() =>
                window.open(
                  "https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md",
                  "_blank"
                )
              }
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 px-1">
          {/* Server Name */}
          <div className="space-y-2">
            <Label htmlFor="serverName">Server Name</Label>
            <Input
              id="serverName"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="Enter server name"
            />
          </div>

          {/* Transport Type */}
          <div className="space-y-3">
            <Label>Type</Label>
            <RadioGroup
              value={transportType}
              onValueChange={(value) =>
                setTransportType(value as TransportType)
              }
              className="flex gap-6 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="stdio" id="stdio" />
                <Label htmlFor="stdio">Command</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sse" id="sse" />
                <Label htmlFor="sse">URL</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="http" id="http" />
                <Label htmlFor="http">HTTP URL</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Transport-specific fields */}
          {transportType === "stdio" && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="command">Command</Label>
                <Input
                  id="command"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="Enter the command"
                />
                <p className="text-sm text-muted-foreground">
                  Command executed by Gemini CLI to start the MCP server.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Arguments</Label>
                <DynamicList
                  items={args}
                  onChange={setArgs}
                  placeholder="Enter an argument"
                  description="Arguments to pass to the command above."
                />
              </div>
            </div>
          )}

          {transportType === "sse" && (
            <div className="space-y-2 mt-4">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:8080/sse"
              />
              <p className="text-sm text-muted-foreground">
                SSE endpoint URL for the MCP server.
              </p>
            </div>
          )}

          {transportType === "http" && (
            <div className="space-y-2 mt-4">
              <Label htmlFor="httpUrl">HTTP URL</Label>
              <Input
                id="httpUrl"
                value={httpUrl}
                onChange={(e) => setHttpUrl(e.target.value)}
                placeholder="http://localhost:3000/mcp"
              />
              <p className="text-sm text-muted-foreground">
                HTTP endpoint URL for the MCP server.
              </p>
            </div>
          )}

          {/* Environment Variables */}
          <div className="space-y-2">
            <Label>Environment</Label>
            <DynamicKeyValueList
              items={environment}
              onChange={setEnvironment}
              keyPlaceholder="Name"
              valuePlaceholder="Value"
              description="Environment variables necessary for this MCP server."
            />
          </div>

          {/* Headers (only for URL/HTTP URL) */}
          {isHttpTransport && (
            <div className="space-y-2">
              <Label>Headers</Label>
              <DynamicKeyValueList
                items={headers}
                onChange={setHeaders}
                keyPlaceholder="Name"
                valuePlaceholder="Value"
                description="Headers necessary for this MCP server. Only applicable to URL and HTTP URL MCP servers."
              />
            </div>
          )}

          {/* Working Directory (only for Command) */}
          {transportType === "stdio" && (
            <div className="space-y-2">
              <Label htmlFor="workingDirectory">Working Directory</Label>
              <Input
                id="workingDirectory"
                value={workingDirectory}
                onChange={(e) => setWorkingDirectory(e.target.value)}
                placeholder="./server-directory"
              />
              <p className="text-sm text-muted-foreground">
                Working directory for the server command.
              </p>
            </div>
          )}

          {/* Timeout */}
          <div className="space-y-2">
            <Label htmlFor="timeout">Timeout (milliseconds)</Label>
            <Input
              id="timeout"
              type="number"
              value={timeout}
              onChange={(e) => setTimeout(Number(e.target.value))}
              min={1000}
            />
          </div>

          {/* Trust */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="trust"
              checked={trust}
              onCheckedChange={(checked) => setTrust(!!checked)}
            />
            <Label htmlFor="trust">
              Trust this server (bypass tool call confirmations)
            </Label>
          </div>

          {/* Tools (only show for URL/HTTP URL) */}
          {isHttpTransport && (
            <>
              <div className="space-y-2">
                <Label>Included Tools</Label>
                <DynamicList
                  items={includeTools}
                  onChange={setIncludeTools}
                  placeholder="Write args here"
                  description="MCP tools, included in this MCP server, that Gemini CLI may execute."
                />
              </div>

              <div className="space-y-2">
                <Label>Excluded Tools</Label>
                <DynamicList
                  items={excludeTools}
                  onChange={setExcludeTools}
                  placeholder="Write args here"
                  description="MCP tools, included in this MCP server, that Gemini CLI may not execute. Takes precedence over Included Tools."
                />
              </div>
            </>
          )}

          {/* Authentication */}
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requiresAuth"
                  checked={requiresAuthentication}
                  onCheckedChange={(checked) =>
                    setRequiresAuthentication(!!checked)
                  }
                />
                <Label htmlFor="requiresAuth">Requires Authentication</Label>
              </div>
              {requiresAuthentication && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="supportsOAuth"
                    checked={supportsOAuthDiscovery}
                    onCheckedChange={(checked) =>
                      setSupportsOAuthDiscovery(!!checked)
                    }
                  />
                  <Label htmlFor="supportsOAuth">
                    Supports OAuth Discovery
                  </Label>
                </div>
              )}
            </div>

            {/* OAuth Configuration (only show if supports OAuth discovery) */}
            {requiresAuthentication && supportsOAuthDiscovery && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientId">Client ID</Label>
                    <Input
                      id="clientId"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="Enter the MCP server's client ID"
                    />
                    <p className="text-sm text-muted-foreground">
                      OAuth client identifier. Optional with dynamic
                      registration.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clientSecret">Client Secret</Label>
                    <Input
                      id="clientSecret"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="Enter the MCP server's client secret"
                    />
                    <p className="text-sm text-muted-foreground">
                      OAuth client secret. Optional for public clients.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="authorizationUrl">Authorization URL</Label>
                    <Input
                      id="authorizationUrl"
                      value={authorizationUrl}
                      onChange={(e) => setAuthorizationUrl(e.target.value)}
                      placeholder="Enter the MCP server's authorization URL"
                    />
                    <p className="text-sm text-muted-foreground">
                      OAuth authorization endpoint. Auto-discovered if omitted.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tokenUrl">Token URL</Label>
                    <Input
                      id="tokenUrl"
                      value={tokenUrl}
                      onChange={(e) => setTokenUrl(e.target.value)}
                      placeholder="Enter the MCP server's token URL"
                    />
                    <p className="text-sm text-muted-foreground">
                      OAuth token endpoint. Auto-discovered if omitted.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Scopes</Label>
                  <DynamicList
                    items={scopes}
                    onChange={setScopes}
                    placeholder="Enter a scope"
                    description="Required OAuth scopes."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="redirectUri">Redirect URI</Label>
                    <Input
                      id="redirectUri"
                      value={redirectUri}
                      onChange={(e) => setRedirectUri(e.target.value)}
                      placeholder="Enter the MCP server's redirect URI"
                    />
                    <p className="text-sm text-muted-foreground">
                      Custom redirect URI. Defaults to
                      http://localhost:7777/oauth/callback.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tokenParameterName">
                      Token Parameter Name
                    </Label>
                    <Input
                      id="tokenParameterName"
                      value={tokenParameterName}
                      onChange={(e) => setTokenParameterName(e.target.value)}
                      placeholder="Enter the MCP server's token parameter name"
                    />
                    <p className="text-sm text-muted-foreground">
                      Query parameter name for tokens in SSE URLs.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Audiences</Label>
                  <DynamicList
                    items={audiences}
                    onChange={setAudiences}
                    placeholder="Enter an audience"
                    description="Audiences for which the token is valid."
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer with Create button */}
        <div className="flex-shrink-0 flex justify-end pt-4 border-t">
          <Button onClick={handleCreate} className="px-8">
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
