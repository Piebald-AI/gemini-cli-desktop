import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { SearchResult } from "@/lib/webApi";
import { Hash, Search } from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

interface SearchResultsProps {
  results: SearchResult[];
  isSearching?: boolean;
  onConversationSelect: (conversationId: string) => void;
  query?: string;
  onResume?: (opts: {
    chatId: string;
    projectHash: string;
    title: string;
  }) => void;
  caseSensitive?: boolean;
}

export function SearchResults({
  results,
  isSearching = false,
  onConversationSelect,
  query = "",
  onResume,
  caseSensitive = false,
}: SearchResultsProps) {
  const { t } = useTranslation();
  const [expandedResults, setExpandedResults] = useState<Set<string>>(
    new Set()
  );

  const toggleExpanded = useCallback((chatId: string) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) {
        next.delete(chatId);
      } else {
        next.add(chatId);
      }
      return next;
    });
  }, []);

  const formatLastUpdated = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }, []);

  const formatTime = useCallback((iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }, []);

  const highlightText = useCallback((text: string, q: string, cs: boolean) => {
    if (!q.trim()) return text;
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const flags = cs ? "g" : "gi";
    const regex = new RegExp(`(${safe})`, flags);
    const parts = text.split(regex);
    return parts.map((part, idx) =>
      idx % 2 === 1 ? (
        <mark
          key={`${part}-${idx}`}
          className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded text-black dark:text-white"
        >
          {part}
        </mark>
      ) : (
        <span key={`${part}-${idx}`}>{part}</span>
      )
    );
  }, []);

  // Memoize the loading skeleton to prevent re-renders
  const loadingSkeleton = useMemo(
    () => (
      <div className="space-y-2">
        <div className="text-sm text-gray-500 dark:text-gray-400 px-1 flex items-center gap-2">
          <Search className="h-4 w-4 animate-pulse" />
          Searching...
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-neutral-900 p-3"
          >
            <Skeleton className="h-4 w-3/4" />
            <div className="flex items-center gap-2 mt-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
            <div className="mt-3 space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    ),
    []
  );

  const emptyForNoQuery = (
    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
      <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p className="text-sm">
        {t("search.startTyping", { defaultValue: "Start typing to search" })}
      </p>
      <p className="text-xs mt-1">
        {t("search.hint", { defaultValue: "Enter keywords to find messages" })}
      </p>
    </div>
  );

  const emptyNoResults = (
    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
      <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p className="text-sm">
        {t("search.noResultsFound", { defaultValue: "No conversations found" })}
      </p>
      <p className="text-xs mt-1">
        {t("search.tryDifferentTerms", {
          defaultValue: "Try different search terms",
        })}
      </p>
    </div>
  );

  if (isSearching) {
    return loadingSkeleton;
  }

  if (results.length === 0) {
    const trimmed = (query || "").trim();
    return trimmed ? emptyNoResults : emptyForNoQuery;
  }

  return (
    <div className="space-y-2">
      {results.map((result) => {
        const isExpanded = expandedResults.has(result.chat.id);
        // Backend formats id as "<project_hash>/<filename>"
        const projectHash = result.chat.id.split("/")[0];
        const visibleMatches = isExpanded
          ? result.matches
          : result.matches.slice(0, 2);

        return (
          <div
            key={result.chat.id}
            className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-neutral-900"
          >
            {/* Chat section header */}
            <div className="px-3 py-2 border-b text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{result.chat.title}</span>
                <span className="inline-flex items-center rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-200 text-[11px] px-1.5 py-0.5">
                  <Hash className="h-3 w-3 mr-1" />
                  {projectHash.slice(0, 8)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {formatLastUpdated(result.chat.started_at_iso)}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onConversationSelect(result.chat.id)}
                  >
                    View
                  </Button>
                  {onResume && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onResume({
                          chatId: result.chat.id,
                          projectHash,
                          title: result.chat.title,
                        })
                      }
                    >
                      Resume
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Matches */}
            <div className="p-3 space-y-2">
              {visibleMatches.map((match, idx) => (
                <div
                  key={`${result.chat.id}-m-${idx}`}
                  className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-neutral-900 shadow-sm"
                  role="button"
                  tabIndex={0}
                  onClick={() => onConversationSelect(result.chat.id)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && onConversationSelect(result.chat.id)
                  }
                >
                  <div className="px-3 py-2 text-sm leading-relaxed">
                    <div className="flex items-center gap-2 text-[12px] mb-1 text-gray-600 dark:text-gray-300">
                      <span className="font-medium">
                        {match.role === "assistant"
                          ? "Gemini"
                          : match.role === "user"
                            ? "User"
                            : "Message"}
                      </span>
                      <span className="text-gray-400">
                        {formatTime(match.timestamp_iso)}
                      </span>
                    </div>
                    {highlightText(match.content_snippet, query, caseSensitive)}
                  </div>
                </div>
              ))}
              {result.matches.length > visibleMatches.length && (
                <button
                  type="button"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  onClick={() => toggleExpanded(result.chat.id)}
                >
                  Show {result.matches.length - visibleMatches.length} more
                  match
                  {result.matches.length - visibleMatches.length !== 1
                    ? "es"
                    : ""}
                </button>
              )}
              {isExpanded && result.matches.length > 2 && (
                <button
                  type="button"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  onClick={() => toggleExpanded(result.chat.id)}
                >
                  Show less
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
