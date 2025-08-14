import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/card";
import { api } from "../lib/api";
import { ArrowLeft } from "lucide-react";
import { EnrichedProject } from "../lib/webApi";
import { useBackend } from "../contexts/BackendContext";
import { getBackendText } from "../utils/backendText";

type Project = EnrichedProject;

function truncatePath(path: string): string {
  if (!path) return "";
  return path.length > 50 ? "..." + path.slice(-47) : path;
}

export default function ProjectsPage() {
  const [projects, setProjects] = React.useState<Project[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const navigate = useNavigate();
  const { selectedBackend } = useBackend();
  const backendText = getBackendText(selectedBackend);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const enrichedProjects = await api.invoke<EnrichedProject[]>(
          "list_enriched_projects"
        );
        if (!cancelled) setProjects(enrichedProjects);
      } catch (e) {
        if (!cancelled) setError("Failed to load projects.");
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition cursor-pointer"
          aria-label="Back to Home"
        >
          <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>Back to Home</span>
        </button>
        <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-2 text-muted-foreground">
          {backendText.projectsDescription}
        </p>

        {/* Content area */}
        <div className="mt-6">
          {error ? (
            <p className="text-sm text-muted-foreground">{error}</p>
          ) : projects === null ? (
            <p className="text-sm text-muted-foreground">Loading projects…</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <Card
                  key={p.sha256}
                  className="cursor-pointer transition hover:shadow"
                  onClick={() => navigate(`/projects/${p.sha256}`)}
                >
                  <div className="pl-4">
                    <div
                      className="font-medium text-sm"
                      title={p.metadata.path}
                    >
                      {truncatePath(p.metadata.path)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground flex flex-col gap-0.5">
                      <span>SHA256: {p.sha256.slice(0, 12)}...</span>
                      <span>Name: {p.metadata.friendly_name}</span>
                      {p.metadata.first_used && (
                        <span>
                          First used:{" "}
                          {new Date(p.metadata.first_used).toLocaleDateString()}
                        </span>
                      )}
                      {p.metadata.updated_at && (
                        <span>
                          Last updated:{" "}
                          {new Date(p.metadata.updated_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
