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

export interface MenuShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  display: string;
}

export const menuShortcuts: Record<string, MenuShortcut | undefined> = {
  goHome: { key: "h", ctrlKey: true, display: "Ctrl+H" },
  goProjects: { key: "p", ctrlKey: true, display: "Ctrl+P" },
  goMcpServers: { key: "m", ctrlKey: true, display: "Ctrl+M" },
  toggleTheme: undefined, // No accelerator in Linux menu
  refresh: { key: "r", ctrlKey: true, display: "Ctrl+R" },
  showAbout: undefined, // No accelerator in Linux menu
  quit: undefined, // No accelerator in Linux menu for Exit
};

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
    help: t("titleBar.help"),
    home: t("titleBar.home"),
    projects: t("titleBar.projects"),
    mcpServers: t("titleBar.mcpServers"),
    toggleDarkMode: t("titleBar.toggleDarkMode"),
    refresh: t("titleBar.refresh"),
    about: t("titleBar.about", { name: backendText.desktopName }),
  };
};
