import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { ProcessStatus } from "../types";

export const useProcessManager = () => {
  const [processStatuses, setProcessStatuses] = useState<ProcessStatus[]>([]);

  const fetchProcessStatuses = useCallback(async () => {
    try {
      const statuses = await api.invoke<ProcessStatus[]>(
        "get_process_statuses"
      );
      setProcessStatuses((prev) => {
        // Only update if statuses actually changed
        if (JSON.stringify(prev) !== JSON.stringify(statuses)) {
          return statuses;
        }
        return prev;
      });
    } catch (error) {
      console.error("Failed to fetch process statuses:", error);
    }
  }, []);

  const handleKillProcess = useCallback(
    async (conversationId: string) => {
      try {
        await api.invoke("kill_process", { conversationId: conversationId }); // Tauri auto-converts to conversation_id
        // Refresh process statuses after killing
        await fetchProcessStatuses();
      } catch (error) {
        console.error("Failed to kill process:", error);
      }
    },
    [fetchProcessStatuses]
  );

  useEffect(() => {
    fetchProcessStatuses();

    // Poll for process status updates every 2 seconds
    const interval = setInterval(() => {
      fetchProcessStatuses();
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchProcessStatuses]);

  return {
    processStatuses,
    fetchProcessStatuses,
    handleKillProcess,
  };
};
