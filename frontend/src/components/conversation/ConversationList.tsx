import { useTranslation } from "react-i18next";
import { useState } from "react";

import { Button } from "../ui/button";
import { X, MessageCircle, Search } from "lucide-react";
import { Input } from "../ui/input";
import { useSidebar } from "../ui/sidebar";
import { useBackend } from "../../contexts/BackendContext";
import { getBackendText } from "../../utils/backendText";
import type { Conversation, ProcessStatus } from "../../types";
import { ProcessCard } from "./ProcessCard";
import { useConversation } from "../../contexts/ConversationContext";

interface ConversationListProps {
  conversations: Conversation[];
  activeConversation: string | null;
  processStatuses: ProcessStatus[];
  onConversationSelect: (conversationId: string) => void;
  onKillProcess: (conversationId: string) => void;
  onModelChange?: (model: string) => void; // kept for compatibility
  onRemoveConversation: (id: string) => void;
  onOpenSearch?: () => void;
}

export function ConversationList({
  conversations,
  activeConversation,
  processStatuses,
  onConversationSelect,
  onKillProcess,
  onRemoveConversation,
  onOpenSearch,
}: ConversationListProps) {
  const { t } = useTranslation();
  const { selectedBackend } = useBackend();
  const { isMobile, setOpenMobile } = useSidebar();
  const backendText = getBackendText(selectedBackend);
  const [selectedConversationForEnd, setSelectedConversationForEnd] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const { progress } = useConversation();

  // Search moved to global AppHeader trigger

  const getProcessStatus = (conversation: Conversation) => {
    let status = processStatuses.find(
      (status) => status.conversation_id === conversation.id
    );
    if (!status && conversation.metadata?.timestamp) {
      status = processStatuses.find(
        (status) => status.conversation_id === conversation.metadata!.timestamp
      );
    }
    return status;
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

  // Search moved into modal (ConversationSearchDialog)

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {t("conversations.title")}
          </h2>
          <div className="flex items-center gap-2">
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
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t("conversations.count", {
            count: conversations.length,
            backend: backendText.name,
          })}
        </p>

        {/* Inline search trigger input below count */}
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              aria-label={t("search.searchConversations")}
              readOnly
              placeholder={t("search.searchConversations")}
              className="h-9 cursor-pointer pl-9"
              onFocus={() => (onOpenSearch ? onOpenSearch() : window.dispatchEvent(new Event("app:open-search")))}
              onClick={() => (onOpenSearch ? onOpenSearch() : window.dispatchEvent(new Event("app:open-search")))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onOpenSearch
                    ? onOpenSearch()
                    : window.dispatchEvent(new Event("app:open-search"));
                }
              }}
            />
          </div>
        </div>

        {/* Settings moved to SettingsDialog; sidebar now focuses on search and conversations */}
      </div>

      {/* Conversation List */}
      <div className="p-3 space-y-2">
        {conversations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t("conversations.noConversations")}</p>
            <p className="text-xs mt-1">{t("conversations.startNewChat")}</p>
          </div>
        ) : (
          conversations
            .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
            .map((conversation) => {
              const processStatus = getProcessStatus(conversation);
              const isActive = processStatus?.is_alive ?? false;
              const isSelected = activeConversation === conversation.id;

              return (
                <ProcessCard
                  key={conversation.id}
                  conversation={conversation}
                  processStatus={processStatus}
                  isActive={isActive}
                  isSelected={isSelected}
                  onConversationSelect={(id) => void onConversationSelect(id)}
                  onKillProcess={onKillProcess}
                  selectedConversationForEnd={selectedConversationForEnd}
                  setSelectedConversationForEnd={setSelectedConversationForEnd}
                  formatLastUpdated={formatLastUpdated}
                  onRemoveConversation={onRemoveConversation}
                  progress={progress}
                  activeConversation={activeConversation}
                />
              );
            })
        )}
      </div>

    </div>
  );
}
