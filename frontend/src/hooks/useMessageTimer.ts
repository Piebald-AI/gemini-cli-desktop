import { useState, useEffect, useRef } from "react";

interface UseMessageTimerProps {
  isGenerating: boolean;
}

export function useMessageTimer({ isGenerating }: UseMessageTimerProps) {
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start timer when generation begins
  useEffect(() => {
    if (isGenerating && !startTime) {
      setStartTime(new Date());
      setElapsedTime(0);
    }
  }, [isGenerating, startTime]);

  // Update elapsed time during generation
  useEffect(() => {
    if (isGenerating && startTime) {
      intervalRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime.getTime());
      }, 100); // Update every 100ms for smooth display

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [isGenerating, startTime]);

  // Clear timer when generation stops
  useEffect(() => {
    if (!isGenerating && startTime) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Reset for next message
      setStartTime(null);
      setElapsedTime(0);
    }
  }, [isGenerating, startTime]);

  // Format elapsed time as "1.2s" or "1m 23.4s"
  const formatDuration = (ms: number): string => {
    const totalSeconds = ms / 1000;

    if (totalSeconds < 60) {
      return `${totalSeconds.toFixed(1)}s`;
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds.toFixed(1)}s`;
  };

  return {
    formattedDuration: formatDuration(elapsedTime),
    isActive: isGenerating && startTime !== null,
  };
}
