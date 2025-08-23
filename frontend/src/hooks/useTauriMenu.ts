import { useEffect, useState } from "react";
import { Menu, MenuItem, Submenu, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { platform } from "@tauri-apps/plugin-os";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBackend } from "@/contexts/BackendContext";
import { createMenuHandlers, getMenuLabels } from "@/utils/menuConfig";

export const useTauriMenu = () => {
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { selectedBackend } = useBackend();

  useEffect(() => {
    const setupMenu = async () => {
      // Only set up menu for non-Windows desktop platforms
      if (__WEB__ || platform() === "windows") {
        return;
      }

      const handlers = createMenuHandlers(navigate, setIsAboutDialogOpen);
      const labels = getMenuLabels(t, selectedBackend);

      try {
        // File Menu
        const fileSubmenu = await Submenu.new({
          text: labels.file,
          items: [
            await MenuItem.new({
              id: "home",
              text: labels.home,
              accelerator: "CmdOrCtrl+H",
              action: handlers.goHome,
            }),
            await MenuItem.new({
              id: "projects",
              text: labels.projects,
              accelerator: "CmdOrCtrl+P",
              action: handlers.goProjects,
            }),
            await MenuItem.new({
              id: "mcp-servers",
              text: labels.mcpServers,
              accelerator: "CmdOrCtrl+M",
              action: handlers.goMcpServers,
            }),
          ],
        });

        // View Menu
        const viewSubmenu = await Submenu.new({
          text: labels.view,
          items: [
            await MenuItem.new({
              id: "toggle-theme",
              text: labels.toggleDarkMode,
              action: handlers.toggleTheme,
            }),
            await PredefinedMenuItem.new({
              item: "Separator",
            }),
            await MenuItem.new({
              id: "refresh",
              text: labels.refresh,
              accelerator: "F5",
              action: handlers.refresh,
            }),
          ],
        });

        // Tools Menu
        const toolsSubmenu = await Submenu.new({
          text: labels.tools,
          items: [
            await MenuItem.new({
              id: "about",
              text: labels.about,
              action: handlers.showAbout,
            }),
          ],
        });

        // Create and set the main menu
        const menu = await Menu.new({
          items: [fileSubmenu, viewSubmenu, toolsSubmenu],
        });

        await menu.setAsAppMenu();
      } catch (error) {
        console.error("Failed to setup Tauri menu:", error);
      }
    };

    setupMenu();
  }, [navigate, t, selectedBackend]);

  return { isAboutDialogOpen, setIsAboutDialogOpen };
};