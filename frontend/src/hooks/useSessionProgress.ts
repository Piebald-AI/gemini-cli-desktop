import { useState, useCallback, useRef } from "react";
import { listen } from "../lib/listen";
import { SessionProgressPayload, SessionProgressStage } from "../types/session";

export function useSessionProgress() {
  const [progress, setProgress] = useState<SessionProgressPayload | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const currentUnlistenRef = useRef<(() => void) | null>(null);

  const handleProgressEvent = useCallback(
    (sessionId: string, payload: SessionProgressPayload) => {
      console.log(`🔄 [SESSION-PROGRESS] Session ${sessionId}:`, payload);
      // Always accept events for the listener's bound sessionId
      setCurrentSessionId(sessionId);
      setProgress(payload);
    },
    []
  );

  const startListeningForSession = useCallback(
    async (sessionId: string) => {
      // Stop any previous session-progress listener to avoid stale handlers
      if (currentUnlistenRef.current) {
        try {
          currentUnlistenRef.current();
        } catch (e) {
          console.warn("⚠️ [SESSION-PROGRESS] Error while unlistening previous session", e);
        }
        currentUnlistenRef.current = null;
      }

      setCurrentSessionId(sessionId);

      const eventName = `session-progress-${sessionId}`;

      try {
        const unlisten = await listen<SessionProgressPayload>(
          eventName,
          (event) => {
            handleProgressEvent(sessionId, event.payload);
          }
        );
        currentUnlistenRef.current = unlisten;
        return () => {
          try {
            unlisten();
          } catch (e) {
            console.warn("⚠️ [SESSION-PROGRESS] Error while unlistening", e);
          }
          if (currentUnlistenRef.current === unlisten) {
            currentUnlistenRef.current = null;
          }
        };
      } catch (error) {
        console.error(
          `Failed to set up session progress listener for ${sessionId}:`,
          error
        );
        return () => {};
      }
    },
    [handleProgressEvent]
  );

  const resetProgress = useCallback(() => {
    setProgress(null);
    setCurrentSessionId(null);
    if (currentUnlistenRef.current) {
      try {
        currentUnlistenRef.current();
      } catch (e) {
        console.warn("⚠️ [SESSION-PROGRESS] Error while unlistening on reset", e);
      }
      currentUnlistenRef.current = null;
    }
  }, []);

  return {
    progress,
    startListeningForSession,
    resetProgress,
    // Optimistically seed progress before backend emits
    seedProgress: (payload?: Partial<SessionProgressPayload>) => {
      const seeded: SessionProgressPayload = {
        stage: SessionProgressStage.Starting,
        message: payload?.message || "Starting session initialization",
        progress_percent: payload?.progress_percent ?? 5,
        details: payload?.details,
      };
      setProgress(seeded);
    },
  };
}
