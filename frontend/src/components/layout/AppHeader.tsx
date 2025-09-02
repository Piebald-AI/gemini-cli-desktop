import React from "react";
import { useTranslation } from "react-i18next";
import { FolderTree } from "lucide-react";
import { SmartLogo } from "../branding/SmartLogo";
import { DesktopText } from "../branding/DesktopText";
import { PiebaldLogo } from "../branding/PiebaldLogo";
import { SidebarTrigger } from "../ui/sidebar";
import { Button } from "../ui/button";

interface AppHeaderProps {
  onDirectoryPanelToggle?: () => void;
  isDirectoryPanelOpen?: boolean;
  hasActiveConversation?: boolean;
  onReturnToDashboard?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onDirectoryPanelToggle,
  isDirectoryPanelOpen = false,
  hasActiveConversation = false,
  onReturnToDashboard,
}) => {
  const { t } = useTranslation();

  const handleLogoClick = () => {
    if (hasActiveConversation && onReturnToDashboard) {
      onReturnToDashboard();
    }
  };

  return (
    <div className="border-b border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex-shrink-0">
      <div className="px-6 py-4">
        <div className="flex items-center w-full">
          {/* Left section - Sidebar trigger + Desktop Logo */}
          <div className="flex flex-1 items-center gap-3">
            <SidebarTrigger />
            <div
              className={`flex items-center gap-1 ${
                hasActiveConversation
                  ? "cursor-pointer hover:opacity-80 transition-opacity"
                  : ""
              }`}
              onClick={handleLogoClick}
              title={
                hasActiveConversation
                  ? t("header.returnToDashboard")
                  : undefined
              }
            >
              <SmartLogo />
              <DesktopText size="small" />
            </div>
          </div>

          {/* Center section - Empty spacer */}
          <div className="flex-1"></div>

          {/* Right section - Directory Toggle + Piebald branding */}
          <div className="flex flex-1 items-center justify-end gap-4">
            {onDirectoryPanelToggle && hasActiveConversation && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDirectoryPanelToggle}
                className={`${isDirectoryPanelOpen ? "bg-muted" : ""}`}
              >
                <FolderTree className="h-4 w-4" />
              </Button>
            )}
            <div className="flex flex-col items-end text-xs text-neutral-400">
              <p>{t("header.fromCreatorsOf")}</p> <PiebaldLogo />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
