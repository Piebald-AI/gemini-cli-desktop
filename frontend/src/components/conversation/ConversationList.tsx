import { useTranslation } from "react-i18next";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardHeader, CardContent } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { X, MessageCircle, Clock, AlertTriangle } from "lucide-react";
import { useState, useCallback } from "react";
import { SearchResult, SearchFilters } from "../../lib/webApi";
import { SearchInput } from "../common/SearchInput";
import { SearchResults } from "../common/SearchResults";
import { useSidebar } from "../ui/sidebar";
import { GeminiAuthMethod } from "../../types/backend";
import { useBackend, useBackendConfig } from "../../contexts/BackendContext";
import { getBackendText } from "../../utils/backendText";
import type { Conversation, ProcessStatus } from "../../types";
import { api } from "@/lib/api";

interface ConversationListProps {
  conversations: Conversation[];
  activeConversation: string | null;
  processStatuses: ProcessStatus[];
  onConversationSelect: (conversationId: string) => void;
  onKillProcess: (conversationId: string) => void;
  onModelChange?: (model: string) => void;
}

export function ConversationList({
  conversations,
  activeConversation,
  processStatuses,
  onConversationSelect,
  onKillProcess,
  onModelChange,
}: ConversationListProps) {
  const { t, i18n } = useTranslation();
  // Use backend context instead of props
  const { selectedBackend, switchBackend } = useBackend();
  const { config: qwenConfig, updateConfig: updateQwenConfig } =
    useBackendConfig("qwen");
  const { config: geminiConfig, updateConfig: updateGeminiConfig } =
    useBackendConfig("gemini");
  const { isMobile, setOpenMobile } = useSidebar();
  const backendText = getBackendText(selectedBackend);
  const [selectedConversationForEnd, setSelectedConversationForEnd] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [selectedModel, setSelectedModel] =
    useState<string>("gemini-2.5-flash");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const getProcessStatus = (conversationId: string) => {
    return processStatuses.find(
      (status) => status.conversation_id === conversationId
    );
  };

  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return t("time.justNow");
    if (diffMins < 60) return t("time.minutesAgo", { count: diffMins });
    if (diffHours < 24) return t("time.hoursAgo", { count: diffHours });
    return t("time.daysAgo", { count: diffDays });
  };

  const handleSearch = useCallback(
    async (query: string, filters?: SearchFilters) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await api.search_chats({ query, filters });
        setSearchResults(results);
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    []
  ); // Empty dependency array since this function doesn't depend on any props or state

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {t("conversations.title")}
          </h2>
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setOpenMobile(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {searchQuery.trim()
            ? t("conversations.searchingIn", {
                count: conversations.length,
                backend: backendText.name,
              })
            : t("conversations.count", {
                count: conversations.length,
                backend: backendText.name,
              })}
        </p>

        {/* Search Input */}
        <div className="mt-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={handleSearch}
            isSearching={isSearching}
          />
        </div>

        {/* Backend Selector */}
        <div className="mt-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            {t("conversations.backend")}
          </label>
          <Select
            value={selectedBackend}
            onValueChange={(value) => {
              console.log("Backend changed to:", value);
              switchBackend(value as "gemini" | "qwen");
              // Reset model selection when backend changes
              if (value === "gemini") {
                setSelectedModel("gemini-2.5-flash");
                onModelChange?.("gemini-2.5-flash");
              } else {
                setSelectedModel(qwenConfig.model || "qwen/qwen3-coder:free");
                onModelChange?.(qwenConfig.model || "qwen/qwen3-coder:free");
              }
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

        {/* Language Selector */}
        <div className="mt-4">
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
              <SelectItem value="en">
                <div className="flex items-center gap-2">
                  <span>English</span>
                </div>
              </SelectItem>
              <SelectItem value="zh-CN">
                <div className="flex items-center gap-2">
                  <span>简体中文</span>
                </div>
              </SelectItem>
              <SelectItem value="zh-TW">
                <div className="flex items-center gap-2">
                  <span>繁體中文</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Qwen Code Configuration */}
        {selectedBackend === "qwen" && (
          <div className="mt-4 space-y-3 p-3 border border-gray-200 dark:border-gray-700 rounded-md">
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
                      updateQwenConfig({
                        model: e.target.value,
                      });
                      setSelectedModel(
                        e.target.value || "qwen/qwen3-coder:free"
                      );
                      onModelChange?.(
                        e.target.value || "qwen/qwen3-coder:free"
                      );
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
          <>
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                {t("conversations.model")}
              </label>
              <Select
                value={selectedModel}
                onValueChange={(value) => {
                  console.log("Model changed to:", value);
                  setSelectedModel(value);
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
            <div className="space-y-3 mt-4">
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

              {/* API Key input - only show for API key auth */}
              {geminiConfig.authMethod === "gemini-api-key" && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    {t("conversations.geminiApiKey")}
                  </label>
                  <Input
                    type="password"
                    value={geminiConfig.apiKey}
                    onChange={(e) =>
                      updateGeminiConfig({
                        apiKey: e.target.value,
                      })
                    }
                    placeholder={t("conversations.enterGeminiApiKey")}
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
            </div>
          </>
        )}
      </div>

      {/* Search Results or Conversation List */}
      <div className="p-3 space-y-2">
        {searchQuery.trim() ? (
          <SearchResults
            results={searchResults}
            isSearching={isSearching}
            onConversationSelect={onConversationSelect}
            query={searchQuery}
          />
        ) : conversations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t("conversations.noConversations")}</p>
            <p className="text-xs mt-1">{t("conversations.startNewChat")}</p>
          </div>
        ) : (
          conversations
            .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
            .map((conversation) => {
              const processStatus = getProcessStatus(conversation.id);
              const isActive = processStatus?.is_alive ?? false;
              const isSelected = activeConversation === conversation.id;

              return (
                <Card
                  key={conversation.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isSelected
                      ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  onClick={async () =>
                    await onConversationSelect(conversation.id)
                  }
                >
                  <CardHeader className="p-3 pb-2 py-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate wrap-normal">
                          {conversation.title.length > 20
                            ? conversation.title.slice(0, 35) + "..."
                            : conversation.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 justify-between">
                          {/* Process Status Badge */}
                          <div className="flex items-center gap-1">
                            {isActive ? (
                              <Badge
                                variant="secondary"
                                className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs px-2 py-0.5"
                              >
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-1" />
                                {processStatus?.pid
                                  ? t("conversations.pidLabel", {
                                      pid: processStatus.pid,
                                    })
                                  : t("conversations.active")}
                                {/* End Chat Button */}
                                {isActive && (
                                  <Dialog
                                    open={
                                      selectedConversationForEnd?.id ===
                                      conversation.id
                                    }
                                    onOpenChange={(open) => {
                                      if (!open)
                                        setSelectedConversationForEnd(null);
                                    }}
                                  >
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-4 w-4 p-0 ml-2 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-950/70"
                                        onClick={(e) => {
                                          e.stopPropagation(); // Prevent conversation selection
                                          setSelectedConversationForEnd({
                                            id: conversation.id,
                                            title: conversation.title,
                                          });
                                        }}
                                        title={t("conversations.endChat")}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>
                                          {t("conversations.endChat")}
                                        </DialogTitle>
                                        <DialogDescription>
                                          {t("conversations.endChatConfirm", {
                                            title: conversation.title,
                                          })}
                                        </DialogDescription>
                                      </DialogHeader>
                                      <DialogFooter>
                                        <Button
                                          variant="outline"
                                          onClick={() =>
                                            setSelectedConversationForEnd(null)
                                          }
                                        >
                                          {t("common.cancel")}
                                        </Button>
                                        <Button
                                          variant="destructive"
                                          onClick={() => {
                                            onKillProcess(conversation.id);
                                            setSelectedConversationForEnd(null);
                                          }}
                                        >
                                          {t("conversations.endChat")}
                                        </Button>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
                                )}
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 text-xs px-2 py-0.5"
                              >
                                <div className="w-2 h-2 bg-gray-400 rounded-full mr-1" />
                                {t("conversations.inactive")}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatLastUpdated(conversation.lastUpdated)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-3 pb-0">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t("conversations.messageCount", {
                            count: conversation.messages.length,
                          })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
        )}
      </div>
    </div>
  );
}
