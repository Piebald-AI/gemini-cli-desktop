import React, { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { platform } from "@tauri-apps/plugin-os";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { QwenIcon } from "@/components/branding/QwenIcon";
import { GeminiIcon } from "@/components/branding/GeminiIcon";
import { useBackend } from "@/contexts/BackendContext";
import { getBackendText } from "@/utils/backendText";
import { createMenuHandlers, getMenuLabels } from "@/utils/menuConfig";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderOpen,
  Server,
  Home,
  Moon,
  RotateCcw,
  Info,
  ChevronDown,
} from "lucide-react";
import { AboutDialog } from "@/components/common/AboutDialog";

interface CustomTitleBarProps {
  title?: string;
  className?: string;
}

export const CustomTitleBar: React.FC<CustomTitleBarProps> = ({
  title,
  className,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { selectedBackend } = useBackend();
  const backendText = getBackendText(selectedBackend);
  const { t } = useTranslation();

  // Dynamic title based on backend
  const dynamicTitle = title || backendText.desktopName;

  // Use shared menu handlers
  const handlers = createMenuHandlers(navigate, setIsAboutDialogOpen);
  const labels = getMenuLabels(t, selectedBackend);

  // Always run hooks first - never conditionally
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupWindowListener = async () => {
      const appWindow = getCurrentWindow();

      // Check initial maximized state
      const initialMaximized = await appWindow.isMaximized();
      setIsMaximized(initialMaximized);

      // Listen for window resize events to update maximize/restore button
      unlisten = await appWindow.onResized(() => {
        appWindow.isMaximized().then(setIsMaximized);
      });
    };

    setupWindowListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // Only show in the desktop app on Windows.
  if (__WEB__ || platform() !== "windows") {
    return null;
  }

  const handleMinimize = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.minimize();
    } catch (error) {
      console.error("Failed to minimize window:", error);
    }
  };

  const handleMaximize = async () => {
    try {
      const appWindow = getCurrentWindow();
      if (isMaximized) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (error) {
      console.error("Failed to toggle maximize window:", error);
    }
  };

  const handleClose = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch (error) {
      console.error("Failed to close window:", error);
    }
  };

  const handleDragStart = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.startDragging();
    } catch (error) {
      console.error("Failed to start dragging window:", error);
    }
  };

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 w-full h-8 bg-background border-b border-border flex items-center justify-between select-none z-[10000]",
        className
      )}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        width: "100%",
        zIndex: 10000,
      }}
    >
      {/* Left section with logo, title, and menus */}
      <div className="flex items-center h-full">
        <div
          className="flex items-center gap-1.5 px-3"
          data-tauri-drag-region
          onMouseDown={handleDragStart}
        >
          <div className="w-4 h-4 flex items-center justify-center">
            {selectedBackend === "qwen" ? (
              <QwenIcon height={16} width={16} />
            ) : (
              <GeminiIcon height={16} width={16} />
            )}
          </div>
          <span className="text-xs font-medium text-foreground tracking-wide">
            {dynamicTitle}
          </span>
        </div>

        {/* Menu buttons */}
        <div className="flex items-center h-full">
          {/* File Menu */}
          <DropdownMenu modal={false} open={undefined}>
            <DropdownMenuTrigger asChild className="bg-transparent">
              <button
                className="h-full px-2 text-xs hover:bg-muted/50 flex items-center gap-1 bg-transparent border-0 outline-none focus:ring-0"
                style={
                  {
                    pointerEvents: "auto",
                    WebkitAppRegion: "no-drag",
                    appRegion: "no-drag",
                  } as React.CSSProperties
                }
                type="button"
              >
                {labels.file}
                <ChevronDown size={10} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-44 bg-background border border-border shadow-lg"
              sideOffset={2}
              style={
                {
                  zIndex: 2147483647,
                  position: "fixed",
                  WebkitAppRegion: "no-drag",
                  appRegion: "no-drag",
                } as React.CSSProperties
              }
            >
              <DropdownMenuItem
                onClick={handlers.goHome}
                className="flex items-center gap-2 text-xs"
              >
                <Home size={14} />
                {labels.home}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handlers.goProjects}
                className="flex items-center gap-2 text-xs"
              >
                <FolderOpen size={14} />
                {labels.projects}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handlers.goMcpServers}
                className="flex items-center gap-2 text-xs"
              >
                <Server size={14} />
                {labels.mcpServers}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Menu */}
          <DropdownMenu modal={false} open={undefined}>
            <DropdownMenuTrigger asChild className="bg-transparent">
              <button
                className="h-full px-2 text-xs hover:bg-muted/50 flex items-center gap-1 bg-transparent border-0 outline-none focus:ring-0"
                style={
                  {
                    pointerEvents: "auto",
                    WebkitAppRegion: "no-drag",
                    appRegion: "no-drag",
                  } as React.CSSProperties
                }
                type="button"
              >
                {labels.view}
                <ChevronDown size={10} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-44 bg-background border border-border shadow-lg"
              sideOffset={2}
              style={
                {
                  zIndex: 2147483647,
                  position: "fixed",
                  WebkitAppRegion: "no-drag",
                  appRegion: "no-drag",
                } as React.CSSProperties
              }
            >
              <DropdownMenuItem
                onClick={handlers.toggleTheme}
                className="flex items-center gap-2 text-xs"
              >
                <Moon size={14} />
                {labels.toggleDarkMode}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handlers.refresh}
                className="flex items-center gap-2 text-xs"
              >
                <RotateCcw size={14} />
                {labels.refresh}
                <span className="ml-auto text-xs text-muted-foreground">
                  F5
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tools Menu */}
          <DropdownMenu modal={false} open={undefined}>
            <DropdownMenuTrigger asChild className="bg-transparent">
              <button
                className="h-full px-2 text-xs hover:bg-muted/50 flex items-center gap-1 bg-transparent border-0 outline-none focus:ring-0"
                style={
                  {
                    pointerEvents: "auto",
                    WebkitAppRegion: "no-drag",
                    appRegion: "no-drag",
                  } as React.CSSProperties
                }
                type="button"
              >
                {labels.tools}
                <ChevronDown size={10} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-44 bg-background border border-border shadow-lg"
              sideOffset={2}
              style={
                {
                  zIndex: 2147483647,
                  position: "fixed",
                  WebkitAppRegion: "no-drag",
                  appRegion: "no-drag",
                } as React.CSSProperties
              }
            >
              <DropdownMenuItem
                onClick={handlers.showAbout}
                className="flex items-center gap-2 text-xs"
              >
                <Info size={14} />
                {labels.about}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Spacer for dragging */}
      <div
        className="flex-1 h-full"
        data-tauri-drag-region
        onMouseDown={handleDragStart}
      ></div>

      {/* Right section with window controls - exact Segoe Fluent Icons implementation */}
      <div className="flex items-center h-full">
        <button
          className="transition text-[10px] w-[46px] h-full hover:bg-muted active:bg-muted/80 font-['Segoe_Fluent_Icons',_'Segoe_MDL2_Assets']"
          tabIndex={-1}
          onClick={handleMinimize}
          onMouseDown={(e) => e.stopPropagation()}
        >
          &#xE921;
        </button>
        <button
          className="transition text-[10px] w-[46px] h-full hover:bg-muted active:bg-muted/80 font-['Segoe_Fluent_Icons',_'Segoe_MDL2_Assets']"
          tabIndex={-1}
          onClick={handleMaximize}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {isMaximized ? "\uE923" : "\uE922"}
        </button>
        <button
          className="transition text-[10px] w-[46px] h-full hover:bg-[#C42B1C] hover:text-white active:bg-[rgba(196,_43,_28,_0.9)] active:text-[rgba(255,_255,_255,_0.7)] font-['Segoe_Fluent_Icons',_'Segoe_MDL2_Assets']"
          tabIndex={-1}
          onClick={handleClose}
          onMouseDown={(e) => e.stopPropagation()}
        >
          &#xE8BB;
        </button>
      </div>

      {/* About Dialog */}
      <AboutDialog
        open={isAboutDialogOpen}
        onOpenChange={setIsAboutDialogOpen}
      />
    </div>
  );
};
