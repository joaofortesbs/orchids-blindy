"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { timerSyncManager } from '@/lib/utils/timerSync';

const TIMER_STORAGE_KEY = 'blindados_timer_state_v6';

export interface TimerState {
  isRunning: boolean;
  startedAt: number | null;
  pausedAt: number | null;
  accumulatedSeconds: number;
  categoryId: string;
  totalDurationSeconds: number;
  lastUpdated: number;
}

export interface LiveSession {
  categoryId: string;
  elapsedMinutes: number;
  elapsedSeconds: number;
  isRunning: boolean;
}

const DEFAULT_TIMER_STATE: TimerState = {
  isRunning: false,
  startedAt: null,
  pausedAt: null,
  accumulatedSeconds: 0,
  categoryId: '',
  totalDurationSeconds: 25 * 60,
  lastUpdated: Date.now(),
};

function safeLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function saveTimerState(state: TimerState): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(TIMER_STORAGE_KEY, JSON.stringify({
      ...state,
      lastUpdated: Date.now(),
    }));
  } catch (error) {
    console.error('Error saving timer state:', error);
  }
}

function loadTimerState(): TimerState | null {
  const storage = safeLocalStorage();
  if (!storage) return null;
  try {
    const stored = storage.getItem(TIMER_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  } catch (error) {
    console.error('Error loading timer state:', error);
    return null;
  }
}

function clearTimerState(): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(TIMER_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing timer state:', error);
  }
}

export function useTimerPersistence(
  defaultCategoryId: string,
  defaultDurationSeconds: number,
  onSessionComplete?: (categoryId: string, durationMinutes: number) => void,
) {
  const [timerState, setTimerState] = useState<TimerState>({
    ...DEFAULT_TIMER_STATE,
    categoryId: defaultCategoryId,
    totalDurationSeconds: defaultDurationSeconds,
  });
  
  const [timeLeft, setTimeLeft] = useState(defaultDurationSeconds);
  const [isLoaded, setIsLoaded] = useState(false);
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerStateRef = useRef(timerState);

  useEffect(() => {
    timerStateRef.current = timerState;
  }, [timerState]);

  const calculateElapsedSeconds = useCallback((state: TimerState): number => {
    if (!state.isRunning || !state.startedAt) {
      return state.accumulatedSeconds;
    }
    const now = Date.now();
    const runningSeconds = Math.floor((now - state.startedAt) / 1000);
    return state.accumulatedSeconds + runningSeconds;
  }, []);

  const calculateTimeLeft = useCallback((state: TimerState): number => {
    const elapsed = calculateElapsedSeconds(state);
    return Math.max(0, state.totalDurationSeconds - elapsed);
  }, [calculateElapsedSeconds]);

  const syncLiveSession = useCallback((state: TimerState, isPaused: boolean = false) => {
    const elapsed = calculateElapsedSeconds(state);
    
    if ((state.isRunning || isPaused) && state.categoryId) {
      const session: LiveSession = {
        categoryId: state.categoryId,
        elapsedMinutes: Math.floor(elapsed / 60),
        elapsedSeconds: elapsed,
        isRunning: state.isRunning,
      };
      setLiveSession(session);
      
      if (timerSyncManager) {
        if (isPaused) {
          timerSyncManager.pause({
            categoryId: state.categoryId,
            elapsedSeconds: elapsed,
            isRunning: false,
            isPaused: true,
            timestamp: Date.now(),
          });
        } else if (state.isRunning) {
          timerSyncManager.update({
            categoryId: state.categoryId,
            elapsedSeconds: elapsed,
            isRunning: true,
            isPaused: false,
            timestamp: Date.now(),
          });
        }
      }
      
      return session;
    } else {
      setLiveSession(null);
      if (timerSyncManager) {
        timerSyncManager.clear();
      }
      return null;
    }
  }, [calculateElapsedSeconds]);

  useEffect(() => {
    const stored = loadTimerState();
    
    if (stored && stored.categoryId) {
      if (stored.isRunning && stored.startedAt) {
        const now = Date.now();
        const runningSeconds = Math.floor((now - stored.startedAt) / 1000);
        const totalElapsed = stored.accumulatedSeconds + runningSeconds;
        const currentTimeLeft = Math.max(0, stored.totalDurationSeconds - totalElapsed);
        
        if (currentTimeLeft <= 0) {
          clearTimerState();
          if (timerSyncManager) timerSyncManager.clear();
          if (onSessionComplete) {
            onSessionComplete(stored.categoryId, Math.floor(stored.totalDurationSeconds / 60));
          }
          setTimerState({
            ...DEFAULT_TIMER_STATE,
            categoryId: defaultCategoryId,
            totalDurationSeconds: defaultDurationSeconds,
          });
          setTimeLeft(defaultDurationSeconds);
        } else {
          setTimerState(stored);
          setTimeLeft(currentTimeLeft);
          syncLiveSession(stored);
        }
      } else if (stored.accumulatedSeconds > 0) {
        setTimerState(stored);
        setTimeLeft(calculateTimeLeft(stored));
        syncLiveSession(stored, true);
      } else {
        setTimerState(stored);
        setTimeLeft(calculateTimeLeft(stored));
      }
    } else {
      setTimerState({
        ...DEFAULT_TIMER_STATE,
        categoryId: defaultCategoryId,
        totalDurationSeconds: defaultDurationSeconds,
      });
      setTimeLeft(defaultDurationSeconds);
    }
    
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    const handleBeforeUnload = () => {
      const state = timerStateRef.current;
      if (state.isRunning && state.startedAt) {
        saveTimerState(state);
        const elapsed = calculateElapsedSeconds(state);
        if (timerSyncManager) {
          timerSyncManager.update({
            categoryId: state.categoryId,
            elapsedSeconds: elapsed,
            isRunning: true,
            isPaused: false,
            timestamp: Date.now(),
          });
        }
      } else if (state.accumulatedSeconds > 0) {
        saveTimerState(state);
        if (timerSyncManager) {
          timerSyncManager.pause({
            categoryId: state.categoryId,
            elapsedSeconds: state.accumulatedSeconds,
            isRunning: false,
            isPaused: true,
            timestamp: Date.now(),
          });
        }
      }
    };

    const handleVisibilityChange = () => {
      const state = timerStateRef.current;
      if (document.visibilityState === 'hidden') {
        if (state.isRunning) {
          saveTimerState(state);
          syncLiveSession(state);
        } else if (state.accumulatedSeconds > 0) {
          saveTimerState(state);
          syncLiveSession(state, true);
        }
      } else if (document.visibilityState === 'visible') {
        if (state.isRunning && state.startedAt) {
          const newTimeLeft = calculateTimeLeft(state);
          setTimeLeft(newTimeLeft);
          syncLiveSession(state);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoaded, calculateTimeLeft, calculateElapsedSeconds, syncLiveSession]);

  useEffect(() => {
    if (!isLoaded) return;

    if (timerState.isRunning && timerState.startedAt) {
      intervalRef.current = setInterval(() => {
        const newTimeLeft = calculateTimeLeft(timerState);
        setTimeLeft(newTimeLeft);
        
        syncLiveSession(timerState);
        saveTimerState(timerState);

        if (newTimeLeft <= 0) {
          const completedState: TimerState = {
            ...timerState,
            isRunning: false,
            startedAt: null,
            accumulatedSeconds: timerState.totalDurationSeconds,
          };
          
          setTimerState(completedState);
          clearTimerState();
          setLiveSession(null);
          if (timerSyncManager) timerSyncManager.clear();
          
          if (onSessionComplete) {
            onSessionComplete(timerState.categoryId, Math.floor(timerState.totalDurationSeconds / 60));
          }
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timerState.isRunning, timerState.startedAt, isLoaded, onSessionComplete, calculateTimeLeft, timerState, syncLiveSession]);

  const start = useCallback(() => {
    const now = Date.now();
    const newState: TimerState = {
      ...timerState,
      isRunning: true,
      startedAt: now,
      pausedAt: null,
      lastUpdated: now,
    };
    
    setTimerState(newState);
    saveTimerState(newState);
    syncLiveSession(newState);
  }, [timerState, syncLiveSession]);

  const pause = useCallback(() => {
    const now = Date.now();
    const elapsed = calculateElapsedSeconds(timerState);
    
    const newState: TimerState = {
      ...timerState,
      isRunning: false,
      startedAt: null,
      pausedAt: now,
      accumulatedSeconds: elapsed,
      lastUpdated: now,
    };
    
    setTimerState(newState);
    saveTimerState(newState);
    
    if (timerSyncManager) {
      timerSyncManager.pause({
        categoryId: timerState.categoryId,
        elapsedSeconds: elapsed,
        isRunning: false,
        isPaused: true,
        timestamp: now,
      });
    }
    
    setLiveSession({
      categoryId: timerState.categoryId,
      elapsedMinutes: Math.floor(elapsed / 60),
      elapsedSeconds: elapsed,
      isRunning: false,
    });
  }, [timerState, calculateElapsedSeconds]);

  const reset = useCallback(() => {
    const newState: TimerState = {
      ...DEFAULT_TIMER_STATE,
      categoryId: timerState.categoryId,
      totalDurationSeconds: timerState.totalDurationSeconds,
      lastUpdated: Date.now(),
    };
    
    setTimerState(newState);
    setTimeLeft(timerState.totalDurationSeconds);
    clearTimerState();
    setLiveSession(null);
    if (timerSyncManager) timerSyncManager.clear();
  }, [timerState.categoryId, timerState.totalDurationSeconds]);

  const setCategory = useCallback((categoryId: string, durationSeconds: number) => {
    if (timerState.isRunning) return;
    
    const newState: TimerState = {
      ...DEFAULT_TIMER_STATE,
      categoryId,
      totalDurationSeconds: durationSeconds,
      lastUpdated: Date.now(),
    };
    
    setTimerState(newState);
    setTimeLeft(durationSeconds);
    clearTimerState();
    if (timerSyncManager) timerSyncManager.clear();
  }, [timerState.isRunning]);

  const toggle = useCallback(() => {
    if (timerState.isRunning) {
      pause();
    } else {
      start();
    }
  }, [timerState.isRunning, start, pause]);

  return {
    timeLeft,
    isRunning: timerState.isRunning,
    isPaused: !timerState.isRunning && timerState.accumulatedSeconds > 0,
    categoryId: timerState.categoryId,
    totalDurationSeconds: timerState.totalDurationSeconds,
    liveSession,
    isLoaded,
    start,
    pause,
    reset,
    toggle,
    setCategory,
    progress: ((timerState.totalDurationSeconds - timeLeft) / timerState.totalDurationSeconds) * 100,
  };
}
