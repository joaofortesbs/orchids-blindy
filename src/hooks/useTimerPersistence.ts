"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

const TIMER_STORAGE_KEY = 'blindados_timer_state_v4';
const LIVE_SESSION_STORAGE_KEY = 'blindados_live_session_v2';
const ACCUMULATED_TIME_KEY = 'blindados_accumulated_time_v1';
const TIMER_BROADCAST_CHANNEL = 'blindados_timer_sync_v2';

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

export interface LiveSessionData {
  categoryId: string;
  elapsedSeconds: number;
  timestamp: number;
  startedAt: number;
}

export interface AccumulatedTimeData {
  categoryId: string;
  date: string;
  totalSeconds: number;
  lastUpdated: number;
}

function saveLiveSessionData(data: LiveSessionData | null): void {
  try {
    if (data) {
      localStorage.setItem(LIVE_SESSION_STORAGE_KEY, JSON.stringify(data));
    } else {
      localStorage.removeItem(LIVE_SESSION_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Error saving live session data:', error);
  }
}

function loadLiveSessionData(): LiveSessionData | null {
  try {
    const stored = localStorage.getItem(LIVE_SESSION_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  } catch (error) {
    console.error('Error loading live session data:', error);
    return null;
  }
}

function getAccumulatedTimeKey(categoryId: string, date: string): string {
  return `${ACCUMULATED_TIME_KEY}_${categoryId}_${date}`;
}

function saveAccumulatedTime(categoryId: string, date: string, seconds: number): void {
  try {
    const key = getAccumulatedTimeKey(categoryId, date);
    const data: AccumulatedTimeData = {
      categoryId,
      date,
      totalSeconds: seconds,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving accumulated time:', error);
  }
}

function loadAccumulatedTime(categoryId: string, date: string): number {
  try {
    const key = getAccumulatedTimeKey(categoryId, date);
    const stored = localStorage.getItem(key);
    if (stored) {
      const data: AccumulatedTimeData = JSON.parse(stored);
      return data.totalSeconds;
    }
    return 0;
  } catch (error) {
    console.error('Error loading accumulated time:', error);
    return 0;
  }
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

function saveTimerState(state: TimerState): void {
  try {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({
      ...state,
      lastUpdated: Date.now(),
    }));
  } catch (error) {
    console.error('Error saving timer state:', error);
  }
}

function loadTimerState(): TimerState | null {
  try {
    const stored = localStorage.getItem(TIMER_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed;
    }
    return null;
  } catch (error) {
    console.error('Error loading timer state:', error);
    return null;
  }
}

function clearTimerState(): void {
  try {
    localStorage.removeItem(TIMER_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing timer state:', error);
  }
}

function getTodayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function useTimerPersistence(
  defaultCategoryId: string,
  defaultDurationSeconds: number,
  onSessionComplete?: (categoryId: string, durationMinutes: number) => void,
  onPartialSessionSave?: (categoryId: string, durationMinutes: number) => void
) {
  const [timerState, setTimerState] = useState<TimerState>({
    ...DEFAULT_TIMER_STATE,
    categoryId: defaultCategoryId,
    totalDurationSeconds: defaultDurationSeconds,
  });
  
  const [timeLeft, setTimeLeft] = useState(defaultDurationSeconds);
  const [isLoaded, setIsLoaded] = useState(false);
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedSecondsRef = useRef<number>(0);
  const sessionStartTimeRef = useRef<number | null>(null);

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

  const broadcastState = useCallback((state: TimerState, liveSessionData?: LiveSession | null) => {
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'TIMER_STATE_UPDATE',
          state,
          liveSession: liveSessionData,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error('Error broadcasting state:', error);
      }
    }
  }, []);

  const updateLiveSession = useCallback((state: TimerState, saveToStorage: boolean = true): LiveSession | null => {
    if (state.isRunning && state.categoryId && state.startedAt) {
      const elapsed = calculateElapsedSeconds(state);
      const session: LiveSession = {
        categoryId: state.categoryId,
        elapsedMinutes: Math.floor(elapsed / 60),
        elapsedSeconds: elapsed,
        isRunning: true,
      };
      setLiveSession(session);
      
      if (saveToStorage) {
        saveLiveSessionData({
          categoryId: state.categoryId,
          elapsedSeconds: elapsed,
          timestamp: Date.now(),
          startedAt: state.startedAt,
        });
        
        const today = getTodayDate();
        saveAccumulatedTime(state.categoryId, today, elapsed);
      }
      
      return session;
    } else {
      setLiveSession(null);
      if (saveToStorage) {
        saveLiveSessionData(null);
      }
      return null;
    }
  }, [calculateElapsedSeconds]);

  useEffect(() => {
    const stored = loadTimerState();
    const storedLiveSession = loadLiveSessionData();
    
    if (stored && stored.categoryId) {
      if (stored.isRunning && stored.startedAt) {
        const now = Date.now();
        const runningSeconds = Math.floor((now - stored.startedAt) / 1000);
        const totalElapsed = stored.accumulatedSeconds + runningSeconds;
        const currentTimeLeft = Math.max(0, stored.totalDurationSeconds - totalElapsed);
        
        if (currentTimeLeft <= 0) {
          clearTimerState();
          saveLiveSessionData(null);
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
          sessionStartTimeRef.current = stored.startedAt;
          updateLiveSession(stored, true);
        }
      } else {
        setTimerState(stored);
        setTimeLeft(calculateTimeLeft(stored));
      }
    } else if (storedLiveSession && storedLiveSession.startedAt) {
      const now = Date.now();
      const runningSeconds = Math.floor((now - storedLiveSession.startedAt) / 1000);
      
      const restoredState: TimerState = {
        isRunning: true,
        startedAt: storedLiveSession.startedAt,
        pausedAt: null,
        accumulatedSeconds: 0,
        categoryId: storedLiveSession.categoryId,
        totalDurationSeconds: defaultDurationSeconds,
        lastUpdated: now,
      };
      
      const timeRemaining = Math.max(0, defaultDurationSeconds - runningSeconds);
      
      if (timeRemaining <= 0) {
        clearTimerState();
        saveLiveSessionData(null);
        if (onSessionComplete) {
          onSessionComplete(storedLiveSession.categoryId, Math.floor(defaultDurationSeconds / 60));
        }
        setTimerState({
          ...DEFAULT_TIMER_STATE,
          categoryId: defaultCategoryId,
          totalDurationSeconds: defaultDurationSeconds,
        });
        setTimeLeft(defaultDurationSeconds);
      } else {
        setTimerState(restoredState);
        setTimeLeft(timeRemaining);
        sessionStartTimeRef.current = storedLiveSession.startedAt;
        updateLiveSession(restoredState, true);
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
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      broadcastChannelRef.current = new BroadcastChannel(TIMER_BROADCAST_CHANNEL);
      
      broadcastChannelRef.current.onmessage = (event) => {
        if (event.data.type === 'TIMER_STATE_UPDATE') {
          const receivedState = event.data.state as TimerState;
          const receivedLiveSession = event.data.liveSession as LiveSession | null;
          
          setTimerState(receivedState);
          setTimeLeft(calculateTimeLeft(receivedState));
          
          if (receivedLiveSession) {
            setLiveSession(receivedLiveSession);
          } else if (!receivedState.isRunning) {
            setLiveSession(null);
          }
          
          if (receivedState.startedAt) {
            sessionStartTimeRef.current = receivedState.startedAt;
          }
        } else if (event.data.type === 'REQUEST_STATE') {
          const currentLiveSession = updateLiveSession(timerState, false);
          broadcastState(timerState, currentLiveSession);
        }
      };

      broadcastChannelRef.current.postMessage({ type: 'REQUEST_STATE' });
    }

    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    const handleBeforeUnload = () => {
      if (timerState.isRunning && timerState.startedAt) {
        saveTimerState(timerState);
        const elapsed = calculateElapsedSeconds(timerState);
        saveLiveSessionData({
          categoryId: timerState.categoryId,
          elapsedSeconds: elapsed,
          timestamp: Date.now(),
          startedAt: timerState.startedAt,
        });
        const today = getTodayDate();
        saveAccumulatedTime(timerState.categoryId, today, elapsed);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && timerState.isRunning) {
        saveTimerState(timerState);
        updateLiveSession(timerState, true);
      } else if (document.visibilityState === 'visible') {
        if (timerState.isRunning && timerState.startedAt) {
          const newTimeLeft = calculateTimeLeft(timerState);
          setTimeLeft(newTimeLeft);
          updateLiveSession(timerState, true);
          broadcastState(timerState, liveSession);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoaded, timerState, liveSession, updateLiveSession, calculateTimeLeft, calculateElapsedSeconds, broadcastState]);

  useEffect(() => {
    if (!isLoaded) return;

    if (timerState.isRunning && timerState.startedAt) {
      intervalRef.current = setInterval(() => {
        const newTimeLeft = calculateTimeLeft(timerState);
        setTimeLeft(newTimeLeft);
        
        const currentSession = updateLiveSession(timerState, true);
        
        saveTimerState(timerState);
        
        broadcastState(timerState, currentSession);

        if (newTimeLeft <= 0) {
          const completedState: TimerState = {
            ...timerState,
            isRunning: false,
            startedAt: null,
            accumulatedSeconds: timerState.totalDurationSeconds,
          };
          
          setTimerState(completedState);
          clearTimerState();
          saveLiveSessionData(null);
          setLiveSession(null);
          broadcastState(completedState, null);
          sessionStartTimeRef.current = null;
          lastSavedSecondsRef.current = 0;
          
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
  }, [timerState.isRunning, timerState.startedAt, isLoaded, onSessionComplete, calculateTimeLeft, timerState, updateLiveSession, broadcastState]);

  const start = useCallback(() => {
    const now = Date.now();
    const newState: TimerState = {
      ...timerState,
      isRunning: true,
      startedAt: now,
      pausedAt: null,
      lastUpdated: now,
    };
    
    sessionStartTimeRef.current = now;
    lastSavedSecondsRef.current = 0;
    
    setTimerState(newState);
    saveTimerState(newState);
    
    const session = updateLiveSession(newState, true);
    broadcastState(newState, session);
  }, [timerState, broadcastState, updateLiveSession]);

  const pause = useCallback(() => {
    const now = Date.now();
    const elapsed = calculateElapsedSeconds(timerState);
    
    const today = getTodayDate();
    saveAccumulatedTime(timerState.categoryId, today, elapsed);
    
    if (onPartialSessionSave && elapsed > 0) {
      onPartialSessionSave(timerState.categoryId, elapsed / 60);
    }
    
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
    setLiveSession(null);
    saveLiveSessionData(null);
    broadcastState(newState, null);
    
    sessionStartTimeRef.current = null;
    lastSavedSecondsRef.current = 0;
  }, [timerState, calculateElapsedSeconds, broadcastState, onPartialSessionSave]);

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
    saveLiveSessionData(null);
    broadcastState(newState, null);
    
    sessionStartTimeRef.current = null;
    lastSavedSecondsRef.current = 0;
  }, [timerState.categoryId, timerState.totalDurationSeconds, broadcastState]);

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
    broadcastState(newState, null);
  }, [timerState.isRunning, broadcastState]);

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
