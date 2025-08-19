import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import { ProcessStatus } from "../types";

export const useProcessManager = () => {
  const [processStatuses, setProcessStatuses] = useState<ProcessStatus[]>([]);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Determine appropriate polling interval based on process statuses
  const getPollingInterval = useCallback((statuses: ProcessStatus[]) => {
    const hasActiveProcesses = statuses.some(status => status.is_alive);
    
    if (statuses.length === 0) {
      return 30000; // No processes: 30 seconds
    } else if (hasActiveProcesses) {
      return 3000; // Active processes: 3 seconds  
    } else {
      return 10000; // Only dead processes: 10 seconds
    }
  }, []);

  // Set up adaptive polling
  useEffect(() => {
    fetchProcessStatuses();

    const scheduleNextPoll = (statuses: ProcessStatus[]) => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
      
      const interval = getPollingInterval(statuses);
      intervalRef.current = setTimeout(() => {
        fetchProcessStatuses();
      }, interval);
    };

    // Schedule initial poll
    scheduleNextPoll(processStatuses);

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [fetchProcessStatuses, getPollingInterval, processStatuses]);

  // Reschedule polling when process statuses change
  useEffect(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
    }
    
    const interval = getPollingInterval(processStatuses);
    intervalRef.current = setTimeout(() => {
      fetchProcessStatuses();
    }, interval);
    
    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [processStatuses, fetchProcessStatuses, getPollingInterval]);

  return {
    processStatuses,
    fetchProcessStatuses,
    handleKillProcess,
  };
};
