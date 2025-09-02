import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../ui/card";
import { RecentChat } from "@/lib/webApi";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { useConversation } from "@/contexts/ConversationContext";
import { toast } from "sonner";

type LoadState = "idle" | "loading" | "loaded" | "error";

function RecentChats() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loadConversationFromHistory } = useConversation();
  const [state, setState] = useState<LoadState>("idle");
  const [chats, setChats] = useState<RecentChat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setState("loading");
      try {
        let items = await api.get_recent_chats();
        if (!active) return;
        console.log("📋 Loaded recent chats:", items);
        console.log("📊 Total chats found:", items.length);

        // Filter out chats with no messages
        const filteredItems = items.filter((chat) => chat.message_count > 0);
        console.log("📊 Chats with messages:", filteredItems.length);

        filteredItems.forEach((chat, index) => {
          console.log(
            `💬 Chat ${index + 1}: ${chat.title} (${chat.message_count} messages)`
          );
        });

        setChats(filteredItems);
        setState("loaded");
      } catch (e: unknown) {
        if (!active) return;
        console.error("❌ Failed to load recent chats:", e);
        setError(
          e instanceof Error
            ? e.message
            : typeof e === "string"
              ? e
              : t("errors.failedToLoadChats")
        );
        setState("error");
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [t]);

  const handleChatClick = async (chat: RecentChat) => {
    if (loadingChatId) return; // Prevent multiple clicks while loading

    console.log("👆 Clicked on chat:", chat);
    setLoadingChatId(chat.id);
    try {
      console.log("🔄 Starting to load conversation...");
      const loadedConversation = await loadConversationFromHistory(chat.id);
      console.log("✅ Conversation loaded:", loadedConversation);
      console.log(
        "📊 Loaded conversation messages count:",
        loadedConversation.messages.length
      );
      console.log("🔄 Navigating to home...");
      // The conversation should be automatically set as active after loading
      navigate("/"); // Navigate to home page where conversation will be displayed
    } catch (error) {
      console.error("❌ Failed to load conversation:", error);
      toast.error(
        t("errors.failedToLoadConversation") || "Failed to load conversation"
      );
    } finally {
      setLoadingChatId(null);
    }
  };

  if (state === "loading") {
    return (
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl border animate-pulse bg-muted/30"
          />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return <div className="mt-6 text-sm text-red-500">{error}</div>;
  }

  if (state === "loaded" && chats.length === 0) {
    return (
      <div className="mt-6 text-sm text-muted-foreground">
        {t("errors.noChatsFound")}
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
      {chats.map((c) => {
        const dateStr = new Date(c.started_at_iso).toLocaleString();
        const isLoading = loadingChatId === c.id;
        return (
          <Card
            key={c.id}
            className={`hover:shadow-md transition-shadow cursor-pointer ${
              isLoading ? "opacity-50 cursor-wait" : ""
            }`}
            onClick={() => handleChatClick(c)}
          >
            <CardHeader>
              <CardTitle className="truncate">
                {isLoading ? `${t("common.loading")}...` : c.title}
              </CardTitle>
              <CardDescription>
                {t("recentChats.started", { date: dateStr })}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="text-sm text-muted-foreground">
                {t("recentChats.messageCount", { count: c.message_count })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default RecentChats;
