import { useState, useCallback } from "react";
import { listen } from "../lib/listen";
import { SessionProgressPayload, SessionProgressStage } from "../types/session";

export function useSessionProgress() {
  const [progress, setProgress] = useState<SessionProgressPayload | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const handleProgressEvent = useCallback((sessionId: string, payload: SessionProgressPayload) => {
    console.log(`🔄 [SESSION-PROGRESS] Session ${sessionId}:`, payload);
    
    if (!currentSessionId || currentSessionId === sessionId) {
      setCurrentSessionId(sessionId);
      setProgress(payload);
    }
  }, [currentSessionId]);

  const startListeningForSession = useCallback(async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    
    const eventName = `session-progress-${sessionId}`;
    
    try {
      const unlisten = await listen<SessionProgressPayload>(eventName, (event) => {
        handleProgressEvent(sessionId, event.payload);
      });
      
      return unlisten;
    } catch (error) {
      console.error(`Failed to set up session progress listener for ${sessionId}:`, error);
      return () => {};
    }
  }, [handleProgressEvent]);

  const resetProgress = useCallback(() => {
    setProgress(null);
    setCurrentSessionId(null);
  }, []);

  return {
    progress,
    startListeningForSession,
    resetProgress,
  };
}