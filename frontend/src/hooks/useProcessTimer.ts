import { useState, useEffect } from 'react';

export interface UseProcessTimerOptions {
  startTime?: number;
  isActive?: boolean;
  updateInterval?: number;
}

export function useProcessTimer(options: UseProcessTimerOptions = {}) {
  const {
    startTime,
    isActive = true,
    updateInterval = 1000
  } = options;

  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!isActive || !startTime) {
      setDuration(0);
      return;
    }

    // Calculate initial duration
    const now = Date.now();
    const initialDuration = Math.floor((now - startTime) / 1000);
    setDuration(initialDuration);

    // Set up timer
    const interval = setInterval(() => {
      const currentTime = Date.now();
      const newDuration = Math.floor((currentTime - startTime) / 1000);
      setDuration(newDuration);
    }, updateInterval);

    return () => clearInterval(interval);
  }, [startTime, isActive, updateInterval]);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  };

  return {
    duration,
    formattedDuration: formatDuration(duration)
  };
}
