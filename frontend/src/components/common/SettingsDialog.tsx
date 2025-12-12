import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, RefreshCw, ChevronsUpDown, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useBackend, useBackendConfig } from "@/contexts/BackendContext";
import { GeminiAuthMethod, LLxprtProvider } from "@/types/backend";

interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
}

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
  const { config: llxprtConfig, updateConfig: updateLLxprtConfig } =
    useBackendConfig("llxprt");

  // State for OpenRouter model fetching
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>(
    []
  );
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Close combobox when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        comboboxRef.current &&
        !comboboxRef.current.contains(event.target as Node)
      ) {
        setComboboxOpen(false);
      }
    };

    if (comboboxOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [comboboxOpen]);

  // Model cache with timestamp
  const [modelCache, setModelCache] = useState<
    Record<
      string,
      {
        models: OpenRouterModel[];
        fetchedAt: number;
      }
    >
  >({});

  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const REQUEST_TIMEOUT = 10000; // 10 seconds

  // Fetch models from OpenRouter API with enhanced error handling and caching
  const fetchOpenRouterModels = useCallback(async () => {
    if (!llxprtConfig.apiKey) {
      toast.error("Please enter your OpenRouter API key first");
      return;
    }

    // Check cache first (use key prefix to avoid exposing full key)
    const cacheKey = llxprtConfig.apiKey.substring(0, 10);
    const cached = modelCache[cacheKey];
    if (cached && Date.now() - cached.fetchedAt < CACHE_DURATION) {
      setOpenRouterModels(cached.models);
      toast.success(`Loaded ${cached.models.length} models from cache`);
      return;
    }

    setIsFetchingModels(true);

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${llxprtConfig.apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Invalid API key. Please check your OpenRouter API key."
          );
        } else if (response.status === 429) {
          throw new Error(
            "Rate limit exceeded. Please try again in a few minutes."
          );
        } else {
          throw new Error(`Failed to fetch models: ${response.statusText}`);
        }
      }

      const data = await response.json();
      const modelArray = Array.isArray(data) ? data : data.data || [];

      if (modelArray.length === 0) {
        toast.warning("No models found. This may be a temporary issue.");
        return;
      }

      const models: OpenRouterModel[] = modelArray.map(
        (
          model: OpenRouterModel & {
            id: string;
            name?: string;
            description?: string;
          }
        ) => ({
          id: model.id,
          name: model.name || model.id,
          description: model.description || "",
        })
      );

      setOpenRouterModels(models);

      // Update cache
      setModelCache((prev) => ({
        ...prev,
        [cacheKey]: {
          models,
          fetchedAt: Date.now(),
        },
      }));

      toast.success(`Loaded ${models.length} models from OpenRouter`);
    } catch (error) {
      console.error("Error fetching OpenRouter models:", error);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          toast.error(
            "Request timed out. Please check your internet connection."
          );
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error("Failed to fetch models. Please try again.");
      }
    } finally {
      setIsFetchingModels(false);
    }
  }, [llxprtConfig.apiKey, modelCache, CACHE_DURATION, REQUEST_TIMEOUT]);

  // Debounce to prevent spam clicking
  const debouncedFetchModels = useMemo(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fetchOpenRouterModels();
      }, 300);
    };
  }, [fetchOpenRouterModels]);

  // Derive translations directly where needed; remove unused variable to satisfy TS

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{t("common.settingsTab")}</DialogTitle>
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
                switchBackend(value as "gemini" | "qwen" | "llxprt");
                // No-op for model change here; model is handled below
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("conversations.selectBackend")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">{t("backend.geminiCli")}</SelectItem>
                <SelectItem value="qwen">{t("backend.qwenCode")}</SelectItem>
                <SelectItem value="llxprt">LLxprt Code</SelectItem>
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

                  {/* YOLO Mode Checkbox */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="qwen-yolo-checkbox"
                      checked={qwenConfig.yolo || false}
                      onCheckedChange={(checked) => {
                        updateQwenConfig({ yolo: checked === true });
                      }}
                    />
                    <label
                      htmlFor="qwen-yolo-checkbox"
                      className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                    >
                      {t("conversations.yoloMode")}
                    </label>
                  </div>
                </>
              )}

              {/* YOLO Mode Checkbox for OAuth */}
              {qwenConfig.useOAuth && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="qwen-oauth-yolo-checkbox"
                    checked={qwenConfig.yolo || false}
                    onCheckedChange={(checked) => {
                      updateQwenConfig({ yolo: checked === true });
                    }}
                  />
                  <label
                    htmlFor="qwen-oauth-yolo-checkbox"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                  >
                    {t("conversations.yoloMode")}
                  </label>
                </div>
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
                    <SelectItem value="gemini-3-pro-preview">
                      <div className="flex items-center gap-2">
                        <span>{t("backend.geminiModels.pro3")}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-blue-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t("backend.gemini3ProRequirement")}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </SelectItem>
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

          {/* LLxprt Code Configuration */}
          {selectedBackend === "llxprt" && (
            <div className="space-y-3 p-3 border border-gray-200 dark:border-gray-700 rounded-md">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                LLxprt Code Configuration
              </h4>

              {/* Provider Selector */}
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                  {t("conversations.provider")}
                </label>
                <Select
                  value={llxprtConfig.provider}
                  onValueChange={(value) => {
                    // Auto-fill base URL for providers that need it
                    const updates: Partial<typeof llxprtConfig> = {
                      provider: value as LLxprtProvider,
                    };

                    if (value === "openrouter") {
                      updates.baseUrl = "https://openrouter.ai/api/v1";
                    } else if (
                      [
                        "anthropic",
                        "openai",
                        "gemini",
                        "qwen",
                        "groq",
                        "together",
                        "xai",
                      ].includes(value)
                    ) {
                      // Clear base URL for providers that don't need it
                      updates.baseUrl = "";
                    }

                    updateLLxprtConfig(updates);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic">
                      Anthropic (Claude)
                    </SelectItem>
                    <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                    <SelectItem value="openrouter">
                      OpenRouter (Multi-provider)
                    </SelectItem>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="qwen">Qwen/Alibaba Cloud</SelectItem>
                    <SelectItem value="groq">Groq</SelectItem>
                    <SelectItem value="together">Together AI</SelectItem>
                    <SelectItem value="xai">xAI (Grok)</SelectItem>
                    <SelectItem value="custom">
                      Custom OpenAI-compatible
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* API Key */}
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                  {t("conversations.apiKey")}
                </label>
                <Input
                  type="password"
                  value={llxprtConfig.apiKey}
                  onChange={(e) =>
                    updateLLxprtConfig({
                      apiKey: e.target.value,
                    })
                  }
                  placeholder="sk-..."
                />
              </div>

              {/* Model */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {t("conversations.model")}
                  </label>
                  {llxprtConfig.provider === "openrouter" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={debouncedFetchModels}
                      disabled={isFetchingModels || !llxprtConfig.apiKey}
                      className="h-6 text-xs"
                    >
                      <RefreshCw
                        className={`h-3 w-3 mr-1 ${isFetchingModels ? "animate-spin" : ""}`}
                      />
                      {isFetchingModels ? "Loading..." : "Fetch Models"}
                    </Button>
                  )}
                </div>

                {llxprtConfig.provider === "openrouter" &&
                openRouterModels.length > 0 ? (
                  <div className="relative" ref={comboboxRef}>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboboxOpen}
                      className="w-full justify-between"
                      onClick={() => setComboboxOpen(!comboboxOpen)}
                    >
                      {llxprtConfig.model
                        ? openRouterModels.find(
                            (m) => m.id === llxprtConfig.model
                          )?.name || llxprtConfig.model
                        : "Select a model..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                    {comboboxOpen && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
                        <Command>
                          <CommandInput placeholder="Search models..." />
                          <CommandList>
                            <CommandEmpty>No model found.</CommandEmpty>
                            <CommandGroup>
                              {openRouterModels.map((model) => (
                                <CommandItem
                                  key={model.id}
                                  value={model.name}
                                  onSelect={() => {
                                    updateLLxprtConfig({ model: model.id });
                                    onModelChange?.(model.id);
                                    setComboboxOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      llxprtConfig.model === model.id
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col gap-1">
                                    <span className="font-medium text-sm">
                                      {model.name}
                                    </span>
                                    {model.description && (
                                      <span className="text-xs text-muted-foreground leading-tight">
                                        {model.description.slice(0, 100)}
                                        {model.description.length > 100
                                          ? "..."
                                          : ""}
                                      </span>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </div>
                    )}
                  </div>
                ) : (
                  <Input
                    type="text"
                    value={llxprtConfig.model}
                    onChange={(e) => {
                      const value = e.target.value;
                      updateLLxprtConfig({ model: value });
                      onModelChange?.(value || "claude-3-5-sonnet-20241022");
                    }}
                    placeholder={
                      llxprtConfig.provider === "anthropic"
                        ? "claude-3-5-sonnet-20241022"
                        : llxprtConfig.provider === "openai"
                          ? "gpt-4o"
                          : llxprtConfig.provider === "openrouter"
                            ? "anthropic/claude-sonnet-4.5"
                            : llxprtConfig.provider === "gemini"
                              ? "gemini-3-pro-preview"
                              : llxprtConfig.provider === "qwen"
                                ? "qwen-max"
                                : llxprtConfig.provider === "groq"
                                  ? "llama-3.3-70b-versatile"
                                  : llxprtConfig.provider === "together"
                                    ? "meta-llama/Llama-3-70b-chat-hf"
                                    : llxprtConfig.provider === "xai"
                                      ? "grok-beta"
                                      : "model-name"
                    }
                  />
                )}
              </div>

              {/* Base URL (only show for custom provider) */}
              {llxprtConfig.provider === "custom" && (
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                    {t("conversations.baseUrl")}
                  </label>
                  <Input
                    type="text"
                    value={llxprtConfig.baseUrl}
                    onChange={(e) =>
                      updateLLxprtConfig({
                        baseUrl: e.target.value,
                      })
                    }
                    placeholder="https://api.example.com/v1"
                  />
                </div>
              )}

              {/* Info text */}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                LLxprt Code supports multiple AI providers. Most providers are
                pre-configured - just add your API key and model. Select
                &quot;Custom&quot; for self-hosted or other OpenAI-compatible
                endpoints.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
