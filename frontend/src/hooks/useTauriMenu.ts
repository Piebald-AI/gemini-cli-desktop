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
      const currentPlatform = platform();

      try {
        // File Menu
        const fileSubmenu = await Submenu.new({
          text: labels.file,
          items: [
            await MenuItem.new({
              id: "home",
              text: labels.home,
              accelerator: currentPlatform === "macos" ? "Cmd+H" : "Ctrl+H",
              action: handlers.goHome,
            }),
            await MenuItem.new({
              id: "projects",
              text: labels.projects,
              accelerator: currentPlatform === "macos" ? "Cmd+P" : "Ctrl+P",
              action: handlers.goProjects,
            }),
            await MenuItem.new({
              id: "mcp-servers",
              text: labels.mcpServers,
              accelerator: currentPlatform === "macos" ? "Cmd+M" : "Ctrl+M",
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
              accelerator: currentPlatform === "macos" ? "Cmd+R" : "Ctrl+R",
              action: handlers.refresh,
            }),
          ],
        });

        let menu;

        if (currentPlatform === "macos") {
          // On macOS, the first submenu becomes the application submenu by default
          // Create About submenu as the first item (becomes app menu)
          const aboutSubmenu = await Submenu.new({
            text: "About",
            items: [
              await MenuItem.new({
                id: "about",
                // Always use "Gemini Desktop" on macOS because the OS displays the app name in the 
                // top menu bar, so "Gemini Desktop -> About Qwen Desktop" would be more confusing 
                // than just keeping it consistent as "Gemini Desktop"
                text: t("titleBar.about", { name: "Gemini Desktop" }),
                action: handlers.showAbout,
              }),
              await PredefinedMenuItem.new({
                item: "Separator",
              }),
              await MenuItem.new({
                id: "quit",
                // Same reasoning as About menu - keep consistent with OS-displayed app name
                text: t("titleBar.quit", { name: "Gemini Desktop" }),
                accelerator: "Cmd+Q",
                action: handlers.quit,
              }),
            ],
          });

          // Create menu with About first (becomes app menu), then File and View
          menu = await Menu.new({
            items: [aboutSubmenu, fileSubmenu, viewSubmenu],
          });
        } else {
          // Linux/Windows - add Exit to File menu and keep Help menu with About item
          const fileSubmenuWithExit = await Submenu.new({
            text: labels.file,
            items: [
              await MenuItem.new({
                id: "home",
                text: labels.home,
                accelerator: "Ctrl+H",
                action: handlers.goHome,
              }),
              await MenuItem.new({
                id: "projects",
                text: labels.projects,
                accelerator: "Ctrl+P",
                action: handlers.goProjects,
              }),
              await MenuItem.new({
                id: "mcp-servers",
                text: labels.mcpServers,
                accelerator: "Ctrl+M",
                action: handlers.goMcpServers,
              }),
              await PredefinedMenuItem.new({
                item: "Separator",
              }),
              await MenuItem.new({
                id: "exit",
                text: t("titleBar.exit"),
                action: handlers.quit,
              }),
            ],
          });

          const helpSubmenu = await Submenu.new({
            text: labels.help,
            items: [
              await MenuItem.new({
                id: "about",
                text: labels.about,
                action: handlers.showAbout,
              }),
            ],
          });

          menu = await Menu.new({
            items: [fileSubmenuWithExit, viewSubmenu, helpSubmenu],
          });
        }

        await menu.setAsAppMenu();
      } catch (error) {
        console.error("Failed to setup Tauri menu:", error);
      }
    };

    setupMenu();
  }, [navigate, t, selectedBackend]);

  return { isAboutDialogOpen, setIsAboutDialogOpen };
};