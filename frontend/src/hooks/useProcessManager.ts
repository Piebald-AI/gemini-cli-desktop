import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import { ProcessStatus } from "../types";

export const useProcessManager = () => {
  const [processStatuses, setProcessStatuses] = useState<ProcessStatus[]>([]);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProcessStatuses = useCallback(async () => {
    try {
      console.log("🔄 [FRONTEND-STATUS] Fetching process statuses...");
      const statuses = await api.invoke<ProcessStatus[]>(
        "get_process_statuses"
      );
      console.log("📊 [FRONTEND-STATUS] Received statuses:", statuses);
      
      setProcessStatuses((prev) => {
        // Only update if statuses actually changed
        const hasChanged = JSON.stringify(prev) !== JSON.stringify(statuses);
        if (hasChanged) {
          console.log("🔄 [FRONTEND-STATUS] Process statuses changed!");
          console.log("🔄 [FRONTEND-STATUS] Previous:", prev);
          console.log("🔄 [FRONTEND-STATUS] New:", statuses);
          
          // Log individual status changes
          statuses.forEach(status => {
            const prevStatus = prev.find(p => p.conversation_id === status.conversation_id);
            if (!prevStatus) {
              console.log(`➕ [FRONTEND-STATUS] New session: ${status.conversation_id} (${status.is_alive ? 'ACTIVE' : 'INACTIVE'})`);
            } else if (prevStatus.is_alive !== status.is_alive) {
              console.log(`🔄 [FRONTEND-STATUS] Status change: ${status.conversation_id} ${prevStatus.is_alive ? 'ACTIVE' : 'INACTIVE'} → ${status.is_alive ? 'ACTIVE' : 'INACTIVE'}`);
            }
          });
          
          return statuses;
        }
        return prev;
      });
    } catch (error) {
      console.error("❌ [FRONTEND-STATUS] Failed to fetch process statuses:", error);
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
    const activeCount = statuses.filter(s => s.is_alive).length;
    const inactiveCount = statuses.filter(s => !s.is_alive).length;
    
    let interval;
    if (statuses.length === 0) {
      interval = 30000; // No processes: 30 seconds
    } else if (hasActiveProcesses) {
      interval = 3000; // Active processes: 3 seconds  
    } else {
      interval = 10000; // Only dead processes: 10 seconds
    }
    
    console.log(`⏰ [FRONTEND-STATUS] Setting polling interval: ${interval}ms (${activeCount} active, ${inactiveCount} inactive)`);
    return interval;
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
