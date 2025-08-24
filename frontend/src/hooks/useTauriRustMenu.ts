import { useEffect, useState } from "react";
import { platform } from "@tauri-apps/plugin-os";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBackend } from "@/contexts/BackendContext";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getMenuLabels } from "@/utils/menuConfig";

interface MenuLabels {
  file: string;
  view: string;
  help: string;
  home: string;
  projects: string;
  mcp_servers: string;
  toggle_dark_mode: string;
  refresh: string;
  about: string;
}

export const useTauriRustMenu = () => {
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { selectedBackend } = useBackend();

  // Update menu labels when language or backend changes
  useEffect(() => {
    const updateMenus = async () => {
      // Only update menus for non-Windows desktop platforms
      if (__WEB__ || platform() === "windows") {
        return;
      }

      const labels = getMenuLabels(t, selectedBackend);

      // Convert to snake_case for Rust
      const rustLabels: MenuLabels = {
        file: labels.file,
        view: labels.view,
        help: labels.help,
        home: labels.home,
        projects: labels.projects,
        mcp_servers: labels.mcpServers,
        toggle_dark_mode: labels.toggleDarkMode,
        refresh: labels.refresh,
        about: labels.about,
      };

      try {
        await invoke("update_menu_labels", { labels: rustLabels });
      } catch (error) {
        console.error("Failed to update menu labels:", error);
      }
    };

    updateMenus();
  }, [t, i18n.language, selectedBackend]);

  // Listen to menu events from Rust
  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    const setupListeners = async () => {
      // Navigation events
      unlisteners.push(
        await listen<string>("menu:navigate", (event) => {
          navigate(event.payload);
        })
      );

      // Theme toggle
      unlisteners.push(
        await listen("menu:toggle-theme", () => {
          const html = document.documentElement;
          html.classList.toggle("dark");
        })
      );

      // Refresh
      unlisteners.push(
        await listen("menu:refresh", () => {
          window.location.reload();
        })
      );

      // About dialog
      unlisteners.push(
        await listen("menu:about", () => {
          setIsAboutDialogOpen(true);
        })
      );
    };

    setupListeners();

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [navigate]);

  return { isAboutDialogOpen, setIsAboutDialogOpen };
};
