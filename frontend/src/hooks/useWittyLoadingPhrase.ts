import { useState, useEffect, useRef } from 'react';
import { getRandomLoadingPhrase } from '../utils/loadingPhrases';

interface UseWittyLoadingPhraseOptions {
  isActive?: boolean;
  rotationIntervalMs?: number;
}

export function useWittyLoadingPhrase(options: UseWittyLoadingPhraseOptions = {}) {
  const {
    isActive = true,
    rotationIntervalMs = 15000, // 15 seconds
  } = options;
  
  const [currentPhrase, setCurrentPhrase] = useState(getRandomLoadingPhrase);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset start time when becoming active
  useEffect(() => {
    if (isActive) {
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);
      setCurrentPhrase(getRandomLoadingPhrase());
    }
  }, [isActive]);

  // Handle phrase rotation and elapsed time tracking
  useEffect(() => {
    if (!isActive) {
      // Clear intervals when not active
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current);
        elapsedIntervalRef.current = null;
      }
      return;
    }

    // Set up phrase rotation interval
    intervalRef.current = setInterval(() => {
      setCurrentPhrase(getRandomLoadingPhrase());
    }, rotationIntervalMs);

    // Set up elapsed time counter (update every second)
    elapsedIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current);
      }
    };
  }, [isActive, rotationIntervalMs]);

  return {
    currentPhrase,
    elapsedSeconds,
    formattedMessage: `${currentPhrase} ${elapsedSeconds}s`,
  };
}