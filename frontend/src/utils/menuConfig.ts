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
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  display: string;
}

const getIsMac = (): boolean => {
  if (__WEB__) {
    // Note: Though `navigator.platform` is marked as deprecated, MDN specifically highlights
    // it as still being the best way to detect which keyboard shortcuts to use.
    return (
      navigator.platform.toLowerCase().includes("mac") ||
      navigator.platform.toLowerCase().includes("iphone")
    );
  }
  return false;
};

export const getMenuShortcuts = (): Record<
  string,
  MenuShortcut | undefined
> => {
  const isMac = getIsMac();
  const modifierKey = isMac ? "metaKey" : "ctrlKey";

  // Note: The space after the Command key icon is _not_ a normal space; it's
  // a "THIN SPACE" (U+2009).
  const displayModifier = isMac ? "⌘ " : "Ctrl+";

  return {
    goHome: { key: "h", [modifierKey]: true, display: `${displayModifier}H` },
    goProjects: {
      key: "p",
      [modifierKey]: true,
      display: `${displayModifier}P`,
    },
    goMcpServers: {
      key: "m",
      [modifierKey]: true,
      display: `${displayModifier}M`,
    },
    toggleTheme: undefined, // No accelerator in Linux menu
    refresh: { key: "r", [modifierKey]: true, display: `${displayModifier}R` },
    showAbout: undefined, // No accelerator in Linux menu
    quit: undefined, // No accelerator in Linux menu for Exit
  };
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
