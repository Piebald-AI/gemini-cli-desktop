import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { BackendType } from "../types/backend";

export const useCliInstallation = (backend: BackendType) => {
  const [isCliInstalled, setIsCliInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    const checkCliInstallation = async () => {
      try {
        // Only check CLI installation for Gemini backend
        // Qwen backend uses API calls and doesn't require CLI installation
        if (backend === "qwen") {
          setIsCliInstalled(true); // Qwen doesn't need CLI, so always "installed"
          return;
        }

        const installed = await api.invoke<boolean>("check_cli_installed");
        setIsCliInstalled(installed);
      } catch (error) {
        console.error("Failed to check CLI installation:", error);
        setIsCliInstalled(false);
      }
    };

    checkCliInstallation();
  }, [backend]);

  return isCliInstalled;
};
