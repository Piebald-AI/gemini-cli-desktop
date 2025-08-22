import { useEffect, useState } from "react";
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

type LoadState = "idle" | "loading" | "loaded" | "error";

function RecentChats() {
  const { t } = useTranslation();
  const [state, setState] = useState<LoadState>("idle");
  const [chats, setChats] = useState<RecentChat[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setState("loading");
      try {
        let items = await api.get_recent_chats();
        if (!active) return;
        setChats(items);
        setState("loaded");
      } catch (e: unknown) {
        if (!active) return;
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
        return (
          <Card
            key={c.id}
            className="hover:shadow-md transition-shadow cursor-default"
          >
            <CardHeader>
              <CardTitle className="truncate">{c.title}</CardTitle>
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
