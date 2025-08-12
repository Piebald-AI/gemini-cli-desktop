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
import { webApi, SearchResult, SearchFilters } from "../../lib/webApi";
import { SearchInput } from "../common/SearchInput";
import { SearchResults } from "../common/SearchResults";
import { useSidebar } from "../ui/sidebar";
import type { Conversation, ProcessStatus } from "../../types";

interface ConversationListProps {
  conversations: Conversation[];
  activeConversation: string | null;
  processStatuses: ProcessStatus[];
  onConversationSelect: (conversationId: string) => void;
  onKillProcess: (conversationId: string) => void;
  onModelChange?: (model: string) => void;
  selectedBackend: string;
  onBackendChange: (backend: string) => void;
  qwenConfig: { apiKey: string; baseUrl: string; model: string };
  onQwenConfigChange: (config: {
    apiKey: string;
    baseUrl: string;
    model: string;
  }) => void;
  useOAuth: boolean;
  onOAuthChange: (useOAuth: boolean) => void;
}

export function ConversationList({
  conversations,
  activeConversation,
  processStatuses,
  onConversationSelect,
  onKillProcess,
  onModelChange,
  selectedBackend,
  onBackendChange,
  qwenConfig,
  onQwenConfigChange,
  useOAuth,
  onOAuthChange,
}: ConversationListProps) {
  const { isMobile, setOpenMobile } = useSidebar();
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

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleSearch = useCallback(
    async (query: string, filters?: SearchFilters) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = __WEB__
          ? await webApi.search_chats({ query, filters })
          : await (async () => {
              const { invoke } = await import("@tauri-apps/api/core");
              return await invoke<SearchResult[]>("search_chats", {
                query,
                filters,
              });
            })();
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
            Conversations
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
            ? `Searching in ${conversations.length} conversation${conversations.length !== 1 ? "s" : ""} (${selectedBackend === "gemini" ? "Gemini CLI" : "Qwen Code"})`
            : `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""} (${selectedBackend === "gemini" ? "Gemini CLI" : "Qwen Code"})`}
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
            Backend
          </label>
          <Select
            value={selectedBackend}
            onValueChange={(value) => {
              console.log("Backend changed to:", value);
              onBackendChange(value);
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
              <SelectValue placeholder="Select backend" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">Gemini CLI</SelectItem>
              <SelectItem value="qwen">Qwen Code</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Qwen Code Configuration */}
        {selectedBackend === "qwen" && (
          <div className="mt-4 space-y-3 p-3 border border-gray-200 dark:border-gray-700 rounded-md">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Qwen Code Configuration
            </h4>

            {/* OAuth Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="oauth-checkbox"
                checked={useOAuth}
                onCheckedChange={(checked) => onOAuthChange(checked === true)}
              />
              <label
                htmlFor="oauth-checkbox"
                className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                OAuth
              </label>
            </div>

            {!useOAuth && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                    API Key
                  </label>
                  <Input
                    type="password"
                    value={qwenConfig.apiKey}
                    onChange={(e) =>
                      onQwenConfigChange({
                        ...qwenConfig,
                        apiKey: e.target.value,
                      })
                    }
                    placeholder="API Key"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                    Base URL
                  </label>
                  <Input
                    type="text"
                    value={qwenConfig.baseUrl}
                    onChange={(e) =>
                      onQwenConfigChange({
                        ...qwenConfig,
                        baseUrl: e.target.value,
                      })
                    }
                    placeholder="https://openrouter.ai/api/v1"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                    Model
                  </label>
                  <Input
                    type="text"
                    value={qwenConfig.model}
                    onChange={(e) => {
                      onQwenConfigChange({
                        ...qwenConfig,
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

        {/* Model Selector - Only show for Gemini backend */}
        {selectedBackend === "gemini" && (
          <div className="mt-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Model
            </label>
            <Select
              value={selectedModel}
              onValueChange={(value) => {
                console.log("Model changed to:", value);
                setSelectedModel(value);
                onModelChange?.(value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                <SelectItem value="gemini-2.5-flash">
                  Gemini 2.5 Flash
                </SelectItem>
                <SelectItem value="gemini-2.5-flash-lite">
                  <div className="flex items-center gap-2">
                    <span>Gemini 2.5 Flash-Lite</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Still waitin'...</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
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
            <p>No conversations yet</p>
            <p className="text-xs mt-1">Start a new chat to begin</p>
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
                                  ? `PID: ${processStatus.pid}`
                                  : "Active"}
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
                                        title="End chat"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>End Chat</DialogTitle>
                                        <DialogDescription>
                                          Are you sure you want to end the chat
                                          "{conversation.title}"? This will
                                          terminate the active session.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <DialogFooter>
                                        <Button
                                          variant="outline"
                                          onClick={() =>
                                            setSelectedConversationForEnd(null)
                                          }
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          variant="destructive"
                                          onClick={() => {
                                            onKillProcess(conversation.id);
                                            setSelectedConversationForEnd(null);
                                          }}
                                        >
                                          End Chat
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
                                Inactive
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
                          {conversation.messages.length} message
                          {conversation.messages.length !== 1 ? "s" : ""}
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
