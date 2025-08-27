import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Shield,
  ShieldCheck,
  Play,
  X,
  Server,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import { McpPermissionRequest, McpPermissionOption } from "../../types";

interface McpPermissionDialogProps {
  request: McpPermissionRequest;
  onPermissionResponse: (optionId: string) => void;
}

export function McpPermissionDialog({
  request,
  onPermissionResponse,
}: McpPermissionDialogProps) {
  // Use direct server and tool names from request if available, otherwise parse from title
  const serverName =
    request.toolCall.serverName ||
    (() => {
      const match = request.toolCall.title.match(/\((.+?) MCP Server\)$/);
      return match ? match[1] : "Unknown Server";
    })();

  const toolName =
    request.toolCall.toolName ||
    (() => {
      const match = request.toolCall.title.match(/^([^(]+)/);
      return match ? match[1].trim() : "Unknown Tool";
    })();

  // Group options by type for better layout
  const serverOptions = request.options.filter((opt) =>
    opt.optionId.includes("server")
  );
  const toolOptions = request.options.filter((opt) =>
    opt.optionId.includes("tool")
  );
  const oneTimeOptions = request.options.filter(
    (opt) => opt.kind === "allow_once" || opt.kind === "reject_once"
  );

  const getOptionIcon = (option: McpPermissionOption) => {
    if (option.optionId.includes("server"))
      return <Server className="w-4 h-4" />;
    if (option.optionId.includes("tool")) return <Wrench className="w-4 h-4" />;
    if (option.kind === "allow_once") return <Play className="w-4 h-4" />;
    if (option.kind === "reject_once") return <X className="w-4 h-4" />;
    return <Shield className="w-4 h-4" />;
  };

  const getOptionVariant = (option: McpPermissionOption) => {
    if (option.kind === "allow_always") return "default";
    if (option.kind === "allow_once") return "secondary";
    if (option.kind === "reject_once") return "outline";
    return "secondary";
  };

  const getOptionStyle = (option: McpPermissionOption) => {
    if (option.kind === "allow_always")
      return "bg-green-50 hover:bg-green-100 border-green-200 text-green-800";
    if (option.kind === "allow_once")
      return "bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800";
    if (option.kind === "reject_once")
      return "bg-red-50 hover:bg-red-100 border-red-200 text-red-800";
    return "";
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Server className="w-6 h-6 text-orange-600" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-orange-800">
                MCP Tool Permission Request
              </span>
              <Badge
                variant="secondary"
                className="bg-orange-200 text-orange-800"
              >
                {serverName}
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              The{" "}
              <span className="font-medium text-orange-700">{serverName}</span>{" "}
              server wants to execute the{" "}
              <span className="font-medium text-orange-700">{toolName}</span>{" "}
              tool
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Tool Information */}
        <div className="bg-white/60 rounded-lg p-4 border border-orange-100">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="w-4 h-4 text-orange-600" />
            <span className="font-medium text-orange-800">Tool Details</span>
          </div>
          <div className="text-sm text-gray-700">
            <p>
              <span className="font-medium">Name:</span> {toolName}
            </p>
            <p>
              <span className="font-medium">Server:</span> {serverName} MCP
              Server
            </p>
            <p>
              <span className="font-medium">Status:</span>
              <Badge variant="outline" className="ml-1 capitalize">
                {request.toolCall.status}
              </Badge>
            </p>
          </div>
        </div>

        {/* Permission Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 mb-1">
                Permission Required
              </p>
              <p className="text-amber-700">
                This MCP server is requesting permission to execute a tool.
                Choose how you'd like to proceed:
              </p>
            </div>
          </div>
        </div>

        {/* Permission Options */}
        <div className="space-y-4">
          {/* Always Allow Options */}
          {(serverOptions.length > 0 || toolOptions.length > 0) && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                Always Allow
              </h4>
              <div className="grid gap-2">
                {serverOptions.map((option) => (
                  <Button
                    key={option.optionId}
                    variant="outline"
                    className={`justify-start h-auto p-4 ${getOptionStyle(option)}`}
                    onClick={() => onPermissionResponse(option.optionId)}
                  >
                    <div className="flex items-center gap-3">
                      {getOptionIcon(option)}
                      <div className="text-left">
                        <div className="font-medium">{option.name}</div>
                        <div className="text-xs opacity-75">
                          Trust all tools from {serverName} server
                        </div>
                      </div>
                    </div>
                  </Button>
                ))}
                {toolOptions.map((option) => (
                  <Button
                    key={option.optionId}
                    variant="outline"
                    className={`justify-start h-auto p-4 ${getOptionStyle(option)}`}
                    onClick={() => onPermissionResponse(option.optionId)}
                  >
                    <div className="flex items-center gap-3">
                      {getOptionIcon(option)}
                      <div className="text-left">
                        <div className="font-medium">{option.name}</div>
                        <div className="text-xs opacity-75">
                          Always allow this specific tool
                        </div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* One-time Options */}
          {oneTimeOptions.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                One-time Actions
              </h4>
              <div className="flex gap-3">
                {oneTimeOptions.map((option) => (
                  <Button
                    key={option.optionId}
                    variant={getOptionVariant(option)}
                    className={`flex-1 h-12 ${getOptionStyle(option)}`}
                    onClick={() => onPermissionResponse(option.optionId)}
                  >
                    <div className="flex items-center gap-2">
                      {getOptionIcon(option)}
                      <span className="font-medium">{option.name}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="text-xs text-gray-500 bg-white/40 rounded p-3 border border-orange-100">
          <p>
            💡 <strong>Tip:</strong> Use "Always Allow" options to avoid
            repeated permissions for trusted servers or tools.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
