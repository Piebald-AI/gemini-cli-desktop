import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { SearchResults } from "../common/SearchResults";
import type { SearchFilters, SearchResult } from "@/lib/webApi";
import { api } from "@/lib/api";
import { useConversation } from "@/contexts/ConversationContext";
import { toast } from "sonner";

interface ConversationSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationSelect: (conversationId: string) => void;
  fullScreen?: boolean;
}

export function ConversationSearchDialog({
  open,
  onOpenChange,
  onConversationSelect,
  fullScreen = true,
}: ConversationSearchDialogProps) {
  const { t } = useTranslation();
  const { loadConversationFromHistory, startNewConversation } =
    useConversation();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [includeThinking, setIncludeThinking] = useState(false);

  // Keep results when reopening until the user clears
  useEffect(() => {
    if (!open) return;
    // auto-focus handled by input natively; we keep state
  }, [open]);

  const handleSearch = useCallback(
    async (query: string, filters?: SearchFilters) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await api.search_chats({
          query,
          filters: {
            ...(filters || {}),
            case_sensitive: caseSensitive,
            include_thinking: includeThinking,
          },
        });
        setSearchResults(results);
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [caseSensitive, includeThinking]
  );

  // Keyboard shortcut: Cmd/Ctrl+K to open
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
      if (open && e.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const handleSelect = useCallback(
    async (id: string) => {
      try {
        await loadConversationFromHistory(id);
        // Also notify parent for any additional side effects
        onConversationSelect(id);
      } finally {
        onOpenChange(false);
      }
    },
    [loadConversationFromHistory, onConversationSelect, onOpenChange]
  );

  const description = useMemo(
    () => t("search.searchResults", { defaultValue: "Search Results" }),
    [t]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          fullScreen
            ? "left-0 top-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none sm:rounded-none p-0 overflow-hidden"
            : "max-w-4xl w-[90vw] p-0 overflow-hidden"
        }
      >
        <div className="flex flex-col h-full min-h-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <DialogTitle>Search Chats</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="p-4">
            <div className="flex gap-3 items-center">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("search.searchConversations")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch(searchQuery, {});
                }}
                className="flex-1 h-11"
              />
              <Button
                onClick={() => handleSearch(searchQuery, {})}
                disabled={!searchQuery.trim() || isSearching}
                className="h-11"
              >
                {t("search.search", { defaultValue: "Search" })}
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="case-sensitive"
                  checked={caseSensitive}
                  onCheckedChange={(v) => setCaseSensitive(Boolean(v))}
                />
                <Label
                  htmlFor="case-sensitive"
                  className="text-sm cursor-pointer"
                >
                  Case-sensitive
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-thinking"
                  checked={includeThinking}
                  onCheckedChange={(v) => setIncludeThinking(Boolean(v))}
                />
                <Label
                  htmlFor="include-thinking"
                  className="text-sm cursor-pointer"
                >
                  {t("search.includeThinking", {
                    defaultValue: "Include thinking",
                  })}
                </Label>
              </div>
            </div>
          </div>

          <div
            className={
              fullScreen
                ? "px-4 pb-5 flex-1 min-h-0 overflow-y-auto"
                : "px-4 pb-5 max-h-[65vh] overflow-y-auto"
            }
          >
            <SearchResults
              results={searchResults}
              isSearching={isSearching}
              onConversationSelect={handleSelect}
              query={searchQuery}
              caseSensitive={caseSensitive}
              onResume={async ({ projectHash, title }) => {
                try {
                  // Find the project directory from its hash
                  const projects = await api.list_enriched_projects();
                  const match = projects.find((p) => p.sha256 === projectHash);
                  if (!match) {
                    toast.error(
                      "Project not found locally for this conversation."
                    );
                    return;
                  }

                  const resumeTitle = title || "Resumed Conversation";
                  await startNewConversation(resumeTitle, match.metadata.path);
                  onOpenChange(false);
                } catch (e) {
                  console.error("Failed to resume conversation:", e);
                  toast.error("Failed to resume conversation");
                }
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
