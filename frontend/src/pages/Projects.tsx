import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "../components/ui/dialog";
import { EnrichedProject } from "../lib/webApi";
import { useBackend } from "../contexts/BackendContext";
import { getBackendText } from "../utils/backendText";
import { DirectorySelectionDialog } from "../components/common/DirectorySelectionDialog";
import { generateSHA256 } from "../lib/utils";

type Project = EnrichedProject;

function truncatePath(path: string): string {
  if (!path) return "";
  return path.length > 50 ? "..." + path.slice(-47) : path;
}

export default function ProjectsPage() {
  const { t } = useTranslation();
  const [projects, setProjects] = React.useState<Project[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [directoryDialogOpen, setDirectoryDialogOpen] = React.useState(false);
  const [isAddingProject, setIsAddingProject] = React.useState(false);
  const navigate = useNavigate();
  const { selectedBackend } = useBackend();
  const backendText = getBackendText(selectedBackend);

  const refreshProjects = React.useCallback(async () => {
    try {
      const enrichedProjects = await api.list_enriched_projects();
      setProjects(enrichedProjects);
    } catch (e) {
      setError(t("projects.failedToLoad"));
      console.error(e);
    }
  }, [t]);

  const handleDeleteProject = React.useCallback(
    async (projectId: string) => {
      try {
        await api.delete_project({ projectId });
        refreshProjects();
      } catch (e) {
        console.error("Failed to delete project:", e);
        setError(t("projects.failedToDelete"));
      }
    },
    [refreshProjects, t]
  );

  React.useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const handleAddProject = async (selectedPath: string) => {
    try {
      setIsAddingProject(true);
      setError(null);

      // Get canonical path from backend
      const canonicalPath = await api.get_canonical_path({
        path: selectedPath,
      });

      // Generate SHA256 hash of the canonical directory path
      const sha256 = await generateSHA256(canonicalPath);

      // Create or get the project (this will create metadata if it doesn't exist)
      const project = await api.get_project({
        sha256,
        externalRootPath: selectedPath, // Send original path here
      });

      // Refresh the projects list to include the new project
      await refreshProjects();

      // Navigate to the new project
      navigate(`/projects/${project.sha256}`);
    } catch (e) {
      console.error("Failed to add project:", e);
      setError(t("projects.failedToAdd"));
    } finally {
      setIsAddingProject(false);
    }
  };

  const handleAddProjectNative = async () => {
    try {
      setIsAddingProject(true);
      setError(null);

      // Use Tauri's native file dialog for desktop
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await open({
        directory: true,
        multiple: false,
      });

      if (selectedPath) {
        await handleAddProject(selectedPath as string);
      }
    } catch (e) {
      console.error("Failed to open native file dialog:", e);
      setError(t("errors.failedToOpenDialog"));
    } finally {
      setIsAddingProject(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition cursor-pointer"
          aria-label={t("projects.backToHome")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>{t("projects.backToHome")}</span>
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {t("projects.title")}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {backendText.projectsDescription}
            </p>
          </div>
          <Button
            onClick={
              __WEB__
                ? () => setDirectoryDialogOpen(true)
                : handleAddProjectNative
            }
            disabled={isAddingProject}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {isAddingProject
              ? t("projects.addingProject")
              : t("projects.addProject")}
          </Button>
        </div>

        {/* Content area */}
        <div className="mt-6">
          {error ? (
            <p className="text-sm text-muted-foreground">{error}</p>
          ) : projects === null ? (
            <p className="text-sm text-muted-foreground">
              {t("projects.loadingProjects")}
            </p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("projects.noProjectsFound")}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <Card
                  key={p.sha256}
                  className="cursor-pointer transition hover:shadow relative"
                >
                  <div
                    className="p-4"
                    onClick={() => navigate(`/projects/${p.sha256}`)}
                  >
                    <div
                      className="font-medium text-sm"
                      title={p.metadata.path}
                    >
                      {truncatePath(p.metadata.path)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground flex flex-col gap-0.5">
                      <span>
                        {t("projects.sha256Label")} {p.sha256.slice(0, 12)}...
                      </span>
                      <span>
                        {t("projects.nameLabel")} {p.metadata.friendly_name}
                      </span>
                      {p.metadata.first_used && (
                        <span>
                          {t("projects.firstUsedLabel")}{" "}
                          {new Date(p.metadata.first_used).toLocaleDateString()}
                        </span>
                      )}
                      {p.metadata.updated_at && (
                        <span>
                          {t("projects.lastUpdatedLabel")}{" "}
                          {new Date(p.metadata.updated_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="absolute top-2 right-2">
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
                            {t("projects.deleteProjectConfirm", {
                              name: p.metadata.friendly_name,
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
                            onClick={() => handleDeleteProject(p.sha256)}
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

      {__WEB__ && (
        <DirectorySelectionDialog
          open={directoryDialogOpen}
          onOpenChange={setDirectoryDialogOpen}
          onSelect={handleAddProject}
        />
      )}
    </div>
  );
}
