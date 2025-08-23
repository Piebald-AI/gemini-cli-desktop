import { useNavigate } from "react-router-dom";
import { exit } from "@tauri-apps/plugin-process";
import { BackendType } from "@/types/backend";
import { getBackendText } from "@/utils/backendText";

export interface MenuHandler {
  goHome: () => void;
  goProjects: () => void;
  goMcpServers: () => void;
  toggleTheme: () => void;
  refresh: () => void;
  showAbout: () => void;
  quit: () => void;
}

export const createMenuHandlers = (
  navigate: ReturnType<typeof useNavigate>,
  setIsAboutDialogOpen: (open: boolean) => void
): MenuHandler => ({
  goHome: () => navigate("/"),
  goProjects: () => navigate("/projects"),
  goMcpServers: () => navigate("/mcp"),
  toggleTheme: () => {
    const html = document.documentElement;
    html.classList.toggle("dark");
  },
  refresh: () => window.location.reload(),
  showAbout: () => setIsAboutDialogOpen(true),
  quit: () => {
    if (!__WEB__) {
      exit();
    }
  },
});

export const getMenuLabels = (
  t: (key: string, options?: Record<string, unknown>) => string,
  selectedBackend: BackendType
) => {
  const backendText = getBackendText(selectedBackend);
  
  return {
    file: t("titleBar.file"),
    view: t("titleBar.view"),
    tools: t("titleBar.tools"),
    home: t("titleBar.home"),
    projects: t("titleBar.projects"),
    mcpServers: t("titleBar.mcpServers"),
    toggleDarkMode: t("titleBar.toggleDarkMode"),
    refresh: t("titleBar.refresh"),
    about: t("titleBar.about", { name: backendText.desktopName }),
  };
};
