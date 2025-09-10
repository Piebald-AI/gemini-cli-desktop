import React from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBackend, useBackendConfig } from "@/contexts/BackendContext";
import { GeminiAuthMethod } from "@/types/backend";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModelChange?: (model: string) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onOpenChange,
  onModelChange,
}) => {
  const { t, i18n } = useTranslation();
  const { selectedBackend, switchBackend } = useBackend();
  const { config: qwenConfig, updateConfig: updateQwenConfig } =
    useBackendConfig("qwen");
  const { config: geminiConfig, updateConfig: updateGeminiConfig } =
    useBackendConfig("gemini");

  // Derive translations directly where needed; remove unused variable to satisfy TS

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            {t("common.settingsTab")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Language Selector */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              {t("conversations.language")}
            </label>
            <Select
              value={i18n.language}
              onValueChange={(value) => {
                i18n.changeLanguage(value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("conversations.selectLanguage")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="zh-CN">简体中文</SelectItem>
                <SelectItem value="zh-TW">繁體中文</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Backend Selector */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              {t("conversations.backend")}
            </label>
            <Select
              value={selectedBackend}
              onValueChange={(value) => {
                switchBackend(value as "gemini" | "qwen");
                // No-op for model change here; model is handled below
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("conversations.selectBackend")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">{t("backend.geminiCli")}</SelectItem>
                <SelectItem value="qwen">{t("backend.qwenCode")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Qwen Code Configuration */}
          {selectedBackend === "qwen" && (
            <div className="space-y-3 p-3 border border-gray-200 dark:border-gray-700 rounded-md">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("backend.qwenConfiguration")}
              </h4>

              {/* OAuth Checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="oauth-checkbox"
                  checked={qwenConfig.useOAuth}
                  onCheckedChange={(checked) =>
                    updateQwenConfig({ useOAuth: checked === true })
                  }
                />
                <label
                  htmlFor="oauth-checkbox"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  {t("conversations.oauth")}
                </label>
              </div>

              {!qwenConfig.useOAuth && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                      {t("conversations.apiKey")}
                    </label>
                    <Input
                      type="password"
                      value={qwenConfig.apiKey}
                      onChange={(e) =>
                        updateQwenConfig({
                          apiKey: e.target.value,
                        })
                      }
                      placeholder={t("conversations.apiKey")}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                      {t("conversations.baseUrl")}
                    </label>
                    <Input
                      type="text"
                      value={qwenConfig.baseUrl}
                      onChange={(e) =>
                        updateQwenConfig({
                          baseUrl: e.target.value,
                        })
                      }
                      placeholder="https://openrouter.ai/api/v1"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                      {t("conversations.model")}
                    </label>
                    <Input
                      type="text"
                      value={qwenConfig.model}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateQwenConfig({ model: value });
                        onModelChange?.(value || "qwen/qwen3-coder:free");
                      }}
                      placeholder="qwen/qwen3-coder:free"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Gemini Configuration */}
          {selectedBackend === "gemini" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  {t("conversations.model")}
                </label>
                <Select
                  value={geminiConfig.defaultModel || "gemini-2.5-flash"}
                  onValueChange={(value) => {
                    updateGeminiConfig({ defaultModel: value });
                    onModelChange?.(value);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("conversations.selectModel")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini-2.5-pro">
                      {t("backend.geminiModels.pro")}
                    </SelectItem>
                    <SelectItem value="gemini-2.5-flash">
                      {t("backend.geminiModels.flash")}
                    </SelectItem>
                    <SelectItem value="gemini-2.5-flash-lite">
                      <div className="flex items-center gap-2">
                        <span>{t("backend.geminiModels.flashLite")}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t("backend.stillWaiting")}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Gemini Authentication Configuration */}
              <div className="space-y-3 mt-2">
                {/* Authentication Method Selector */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    {t("conversations.authMethod")}
                  </label>
                  <Select
                    value={geminiConfig.authMethod}
                    onValueChange={(value) =>
                      updateGeminiConfig({
                        authMethod: value as GeminiAuthMethod,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={t("conversations.selectAuthMethod")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oauth-personal">
                        <div className="flex flex-col">
                          <span>{t("backend.googleOAuth")}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="gemini-api-key">
                        <div className="flex flex-col">
                          <span>{t("backend.apiKey")}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="vertex-ai">
                        <div className="flex flex-col">
                          <span>{t("backend.vertexAi")}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="cloud-shell">
                        <div className="flex flex-col">
                          <span>{t("backend.cloudShell")}</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* API Key input - only show for API Key auth */}
                {geminiConfig.authMethod === "gemini-api-key" && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      {t("conversations.apiKey")}
                    </label>
                    <Input
                      type="password"
                      value={geminiConfig.apiKey || ""}
                      onChange={(e) =>
                        updateGeminiConfig({ apiKey: e.target.value })
                      }
                      placeholder={t("backend.enterApiKey")}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t("conversations.getApiKeyFrom")}{" "}
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {t("backend.googleAiStudio")}
                      </a>
                    </p>
                  </div>
                )}

                {/* Vertex AI configuration - only show for Vertex AI auth */}
                {geminiConfig.authMethod === "vertex-ai" && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        {t("conversations.gcpProjectId")}
                      </label>
                      <Input
                        type="text"
                        value={geminiConfig.vertexProject || ""}
                        onChange={(e) =>
                          updateGeminiConfig({
                            vertexProject: e.target.value,
                          })
                        }
                        placeholder={t("backend.enterProjectId")}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        {t("conversations.locationRegion")}
                      </label>
                      <Input
                        type="text"
                        value={geminiConfig.vertexLocation || ""}
                        onChange={(e) =>
                          updateGeminiConfig({
                            vertexLocation: e.target.value,
                          })
                        }
                        placeholder={t("backend.enterLocation")}
                      />
                    </div>
                  </>
                )}

                {/* OAuth information */}
                {geminiConfig.authMethod === "oauth-personal" && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("conversations.oauthLimits")}
                  </p>
                )}

                {/* Cloud Shell information */}
                {geminiConfig.authMethod === "cloud-shell" && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t("conversations.cloudShellInfo")}
                  </p>
                )}

                {/* YOLO Mode Checkbox */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="yolo-checkbox"
                    checked={geminiConfig.yolo || false}
                    onCheckedChange={(checked) => {
                      updateGeminiConfig({ yolo: checked === true });
                    }}
                  />
                  <label
                    htmlFor="yolo-checkbox"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                  >
                    {t("conversations.yoloMode")}
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
