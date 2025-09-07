import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import { useConversation } from "../contexts/ConversationContext";
import { useBackend } from "../contexts/BackendContext";
import { getBackendText } from "../utils/backendText";
import { ArrowLeft, Plus, Loader2, Trash2 } from "lucide-react";
import { EnrichedProject } from "../lib/webApi";
import { useTranslation } from "react-i18next";
import { GitInfo } from "../components/common/GitInfo";
import { InlineSessionProgress } from "../components/common/InlineSessionProgress";
import { useSessionProgress } from "../hooks/useSessionProgress";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "../components/ui/dialog";

type Discussion = {
  id: string;
  title: string;
  started_at_iso?: string;
  message_count?: number;
};

/**
 * Full-page Project Detail (Step 5).
 * Renders discussions for a given projectId using a temporary stub API.
 */
export default function ProjectDetailPage() {
  const { t } = useTranslation();
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { startNewConversation, loadConversationFromHistory } =
    useConversation();
  const { selectedBackend } = useBackend();
  const backendText = getBackendText(selectedBackend);
  const [discussions, setDiscussions] = React.useState<Discussion[] | null>(
    null
  );
  const [projectData, setProjectData] = React.useState<EnrichedProject | null>(
    null
  );
  const [error, setError] = React.useState<string | null>(null);
  const [isCreatingDiscussion, setIsCreatingDiscussion] = React.useState(false);
  const [loadingDiscussionId, setLoadingDiscussionId] = React.useState<
    string | null
  >(null);
  const { progress, startListeningForSession } =
    useSessionProgress();

  // Debug logging
  React.useEffect(() => {
    console.log("🔍 [ProjectDetail] Progress state:", {
      progress,
      isInProgress: !!progress,
    });
  }, [progress]);

  const fetchDiscussions = React.useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await api.get_project_discussions({ projectId });
      setDiscussions(data);
    } catch (e) {
      setError(t("errors.failedToLoadProjectData"));
      console.error(e);
    }
  }, [projectId, t]);

  React.useEffect(() => {
    if (!projectId) return;

    let cancelled = false;
    (async () => {
      try {
        // First, try to get enriched project data from the list
        const enrichedProjects = await api.list_enriched_projects();
        const project = enrichedProjects.find(
          (p: EnrichedProject) => p.sha256 === projectId
        );
        if (!cancelled && project) {
          setProjectData(project);
        }

        // Then get discussions
        fetchDiscussions();
      } catch (e) {
        if (!cancelled) setError(t("errors.failedToLoadProjectData"));
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, t, fetchDiscussions]);

  if (!projectId) {
    return <div>{t("projects.invalidProjectId")}</div>;
  }

  const handleNewDiscussion = async () => {
    if (!projectData) return;

    setIsCreatingDiscussion(true);
    try {
      const title = t("projects.newDiscussionTitle", {
        projectName: projectData.metadata.friendly_name,
      });
      const conversationId = await startNewConversation(
        title,
        projectData.metadata.path
      );

      // Start listening for session progress
      if (startListeningForSession) {
        await startListeningForSession(conversationId);
      }

      navigate("/");
    } catch (error) {
      console.error("Failed to create new discussion:", error);
      const errorMessage =
        typeof error === "string"
          ? error
          : (error as Error)?.message || t("projects.failedToCreateDiscussion");
      setError(errorMessage);
    } finally {
      setIsCreatingDiscussion(false);
    }
  };

  const handleDiscussionClick = async (discussion: Discussion) => {
    if (!projectData) return;

    setLoadingDiscussionId(discussion.id);
    try {
      console.log("📖 [ProjectDetail] Loading discussion:", discussion.id);
      const detailedConversation = await api.get_detailed_conversation({
        chatId: discussion.id,
      });

      console.log(
        "📖 [ProjectDetail] Loaded conversation:",
        detailedConversation
      );
      console.log("📖 [ProjectDetail] Chat info:", detailedConversation.chat);
      console.log(
        "📖 [ProjectDetail] Messages:",
        detailedConversation.messages
      );
      console.log(
        "📖 [ProjectDetail] Messages type:",
        typeof detailedConversation.messages
      );
      console.log(
        "📖 [ProjectDetail] Messages length:",
        detailedConversation.messages?.length
      );

      if (
        !detailedConversation.messages ||
        detailedConversation.messages.length === 0
      ) {
        console.warn(
          "⚠️  [ProjectDetail] API returned no messages for discussion:",
          discussion.id
        );
        console.warn(
          "⚠️  [ProjectDetail] This might be a backend issue or empty conversation"
        );
      }

      // Load conversation into context and navigate to chat view
      await loadConversationFromHistory(
        discussion.id,
        discussion.title,
        detailedConversation.messages,
        projectData.metadata.path
      );

      navigate("/");
      toast.success("Chat session loaded successfully");
    } catch (error) {
      console.error("Failed to load discussion:", error);
      const errorMessage =
        typeof error === "string"
          ? error
          : (error as Error)?.message || "Failed to load chat session";
      toast.error(errorMessage);
    } finally {
      setLoadingDiscussionId(null);
    }
  };

  const handleDeleteDiscussion = async (discussionId: string) => {
    try {
      await api.delete_conversation({ chatId: discussionId });
      fetchDiscussions(); // Refetch discussions after deletion
      toast.success(t("projects.discussionDeleted"));
    } catch (error) {
      console.error("Failed to delete discussion:", error);
      toast.error(t("projects.failedToDeleteDiscussion"));
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-6 py-8">
          <button
            type="button"
            onClick={() => navigate("/projects")}
            className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition cursor-pointer"
            aria-label={t("accessibility.backToProjects")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
            <span>{t("navigation.backToProjects")}</span>
          </button>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("projects.projectDetails")}
          </h1>
          <div className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
            {projectData ? (
              <>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {projectData.metadata.path}
                </code>
                <span>({projectData.metadata.friendly_name})</span>
              </>
            ) : (
              <>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {t("common.loading")}
                </code>
                <span>({t("common.loading")})</span>
              </>
            )}
          </div>

          {/* Git Information */}
          {projectData && (
            <div className="mt-4">
              <GitInfo directory={projectData.metadata.path} />
            </div>
          )}

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">
                {t("projects.previousDiscussions")}
              </h2>
              <div className="flex flex-col items-end gap-2">
                <Button
                  onClick={handleNewDiscussion}
                  disabled={
                    !projectData || isCreatingDiscussion || !!progress
                  }
                  className="inline-flex items-center gap-2"
                >
                  {isCreatingDiscussion || !!progress ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {isCreatingDiscussion || !!progress
                    ? t("projects.creating")
                    : t("projects.newDiscussion")}
                </Button>
                {progress && (
                  <InlineSessionProgress progress={progress} className="w-48" />
                )}
              </div>
            </div>

            {error ? (
              <p className="text-sm text-muted-foreground">{error}</p>
            ) : discussions === null ? (
              <p className="text-sm text-muted-foreground">
                {t("projects.loadingDiscussions")}
              </p>
            ) : discussions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("projects.noDiscussions", { backendName: backendText.name })}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {discussions.map((d) => (
                  <Card
                    key={d.id}
                    className="p-4 transition-colors hover:bg-accent relative group"
                  >
                    <div
                      className="cursor-pointer"
                      onClick={() => handleDiscussionClick(d)}
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{d.title}</div>
                          {loadingDiscussionId === d.id && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                          {d.started_at_iso ? (
                            <span>
                              {t("projects.started")}{" "}
                              {new Date(d.started_at_iso).toLocaleString()}
                            </span>
                          ) : (
                            <span className="opacity-70">
                              {t("projects.startTimeUnavailable")}
                            </span>
                          )}
                          {typeof d.message_count === "number" ? (
                            <span>
                              {d.message_count}{" "}
                              {d.message_count === 1
                                ? t("projects.message")
                                : t("projects.messages")}
                            </span>
                          ) : (
                            <span className="opacity-70">
                              {t("projects.messagesUnavailable")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-400 hover:bg-gray-200 hover:text-red-500"
                            onClick={(e) => e.stopPropagation()}
                            title={t("common.delete")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t("common.delete")}</DialogTitle>
                            <DialogDescription>
                              {t("projects.deleteDiscussionConfirm", {
                                name: d.title,
                              })}
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline">
                                {t("common.cancel")}
                              </Button>
                            </DialogClose>
                            <Button
                              variant="destructive"
                              onClick={() => handleDeleteDiscussion(d.id)}
                            >
                              {t("common.delete")}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
