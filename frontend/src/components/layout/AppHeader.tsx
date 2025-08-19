import React from "react";
import { useTranslation } from "react-i18next";
import { SmartLogo } from "../branding/SmartLogo";
import { DesktopText } from "../branding/DesktopText";
import { PiebaldLogo } from "../branding/PiebaldLogo";
import { SidebarTrigger } from "../ui/sidebar";

export const AppHeader: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="border-b border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex-shrink-0">
      <div className="px-6 py-4">
        <div className="flex items-center w-full">
          {/* Left section - Sidebar trigger + Desktop Logo */}
          <div className="flex flex-1 items-center gap-3">
            <SidebarTrigger />
            <div className="flex items-center gap-1">
              <SmartLogo />
              <DesktopText size="small" />
            </div>
          </div>

          {/* Right section - Piebald branding */}
          <div className="flex flex-1 flex-col items-end text-xs text-neutral-400">
            <p>{t("header.fromCreatorsOf")}</p> <PiebaldLogo />
          </div>
        </div>
      </div>
    </div>
  );
};
