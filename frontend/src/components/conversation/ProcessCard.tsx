import { Button } from "../ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { X, Clock, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Conversation, ProcessStatus } from "../../types";

interface ProcessCardProps {
  conversation: Conversation;
  processStatus: ProcessStatus | undefined;
  isActive: boolean;
  isSelected: boolean;
  onConversationSelect: (id: string) => void;
  onKillProcess: (id: string) => void;
  selectedConversationForEnd: { id: string; title: string } | null;
  setSelectedConversationForEnd: (
    value: { id: string; title: string } | null
  ) => void;
  formatLastUpdated: (date: Date) => string;
  onRemoveConversation: (id: string) => void;
}

export function ProcessCard({
  conversation,
  processStatus,
  isActive,
  isSelected,
  onConversationSelect,
  onKillProcess,
  selectedConversationForEnd,
  setSelectedConversationForEnd,
  formatLastUpdated,
  onRemoveConversation,
}: ProcessCardProps) {
  const { t } = useTranslation();

  // Hidden developer feature flag - change to true to enable new Panel design with gradients
  const ENABLE_NEW_PANEL_DESIGN = false;

  // Generate deterministic colors based on session ID (for new panel design)
  const generateSessionColors = (sessionId: string) => {
    // Simple hash function for consistent color generation
    let hash1 = 0;
    let hash2 = 0;
    for (let i = 0; i < sessionId.length; i++) {
      hash1 = ((hash1 << 5) - hash1 + sessionId.charCodeAt(i)) & 0xffffffff;
      hash2 = ((hash2 << 3) + hash2 + sessionId.charCodeAt(i) * 7) & 0xffffffff;
    }

    // Generate HSL colors for better visual consistency
    const hue1 = Math.abs(hash1) % 360;
    const hue2 = Math.abs(hash2) % 360;
    const saturation = 45 + (Math.abs(hash1 >> 8) % 30); // 45-75%
    const lightness = 40 + (Math.abs(hash1 >> 16) % 25); // 40-65%

    return {
      from: `hsl(${hue1}, ${saturation}%, ${lightness}%)`,
      to: `hsl(${hue2}, ${saturation}%, ${lightness}%)`,
    };
  };

  const sessionColors = generateSessionColors(conversation.id);

  const renderKillButton = () => (
    <Dialog
      open={selectedConversationForEnd?.id === conversation.id}
      onOpenChange={(open) => {
        if (!open) setSelectedConversationForEnd(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0 text-white/80 hover:bg-white/20"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedConversationForEnd({
              id: conversation.id,
              title: conversation.title,
            });
          }}
          title={t("conversations.endChat")}
        >
          <X className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("conversations.endChat")}</DialogTitle>
          <DialogDescription>
            {t("conversations.endChatConfirm", { title: conversation.title })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setSelectedConversationForEnd(null)}
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
  );

  const renderDeleteButton = () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0 text-gray-400 hover:bg-gray-200 hover:text-red-500"
          onClick={(e) => e.stopPropagation()} // Prevent selecting conversation
          title={t("common.delete")}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("common.delete")}</DialogTitle>
          <DialogDescription>
            {t("conversations.deleteConversationConfirm", {
              title: conversation.title,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              /* Close dialog */
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onRemoveConversation(conversation.id);
            }}
          >
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (ENABLE_NEW_PANEL_DESIGN) {
    // New Panel Design with gradients
    return (
      <div
        className={`border rounded-md cursor-pointer transition-all mb-2 overflow-hidden ${
          isSelected
            ? "shadow-md"
            : "hover:border-gray-300 dark:hover:border-gray-600"
        }`}
        style={{
          borderColor: isActive ? sessionColors.from : undefined,
        }}
        onClick={() => onConversationSelect(conversation.id)}
      >
        <div
          className={`px-3 py-2 text-xs font-medium ${
            isActive
              ? "text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          }`}
          style={{
            background: isActive
              ? `linear-gradient(135deg, ${sessionColors.from}, ${sessionColors.to})`
              : undefined,
          }}
        >
          <div className="flex justify-between items-center">
            <span>Session {conversation.id.slice(-6).toUpperCase()}</span>
            <div className="flex items-center gap-1">
              {isActive && renderKillButton()}
              {!isActive && renderDeleteButton()}
            </div>
          </div>
        </div>
        <div className="p-3">
          <h4 className="font-medium text-sm mb-2">{conversation.title}</h4>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
            <div>Messages: {conversation.messages.length}</div>
            <div>PID: {processStatus?.pid || "None"}</div>
            <div className="col-span-2">
              Updated: {formatLastUpdated(conversation.lastUpdated)}
            </div>
          </div>
        </div>
        {isActive && renderKillButton()}
      </div>
    );
  } else {
    // Original old card design (before we started)
    return (
      <div
        key={conversation.id}
        className={`cursor-pointer transition-all hover:shadow-md rounded-lg border border-gray-200 dark:border-gray-700 ${
          isSelected
            ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "hover:bg-gray-100 dark:hover:bg-gray-700"
        }`}
        onClick={() => onConversationSelect(conversation.id)}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate wrap-normal">
                {conversation.title.length > 20
                  ? conversation.title.slice(0, 35) + "..."
                  : conversation.title}
              </h3>
              <div className="flex items-center gap-2 mt-2 justify-between">
                <div className="flex items-center gap-1">
                  {isActive ? (
                    <div className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs px-2 py-1 rounded-md flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span>
                        {processStatus?.pid
                          ? t("conversations.pidLabel", {
                              pid: processStatus.pid,
                            })
                          : t("conversations.active")}
                      </span>
                      {isActive && (
                        <Dialog
                          open={
                            selectedConversationForEnd?.id === conversation.id
                          }
                          onOpenChange={(open) => {
                            if (!open) setSelectedConversationForEnd(null);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 ml-1 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-950/70 rounded-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedConversationForEnd({
                                  id: conversation.id,
                                  title: conversation.title,
                                });
                              }}
                              title={t("conversations.endChat")}
                            >
                              <X className="h-3 w-3" />
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
                    </div>
                  ) : (
                    <div className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 text-xs px-2 py-1 rounded-md flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      <span>{t("conversations.inactive")}</span>
                      {!isActive && renderDeleteButton()}
                    </div>
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
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("conversations.messageCount", {
                  count: conversation.messages.length,
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
