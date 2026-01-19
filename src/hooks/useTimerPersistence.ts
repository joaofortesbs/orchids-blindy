"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { timerSyncManager } from '@/lib/utils/timerSync';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/AuthContext';

const TIMER_STORAGE_KEY = 'blindados_timer_state_v8';
const TIMER_BACKUP_KEY = 'blindados_timer_backup_v8';

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

function safeStorage() {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
}

function saveTimerState(state: TimerState): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    const current = storage.getItem(TIMER_STORAGE_KEY);
    if (current) storage.setItem(TIMER_BACKUP_KEY, current);
    storage.setItem(TIMER_STORAGE_KEY, JSON.stringify({ ...state, lastUpdated: Date.now() }));
  } catch {}
}

function loadTimerState(): TimerState | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const stored = storage.getItem(TIMER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

function clearTimerStorage(): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(TIMER_STORAGE_KEY);
    storage.removeItem(TIMER_BACKUP_KEY);
  } catch {}
}

export function useTimerPersistence(
  defaultCategoryId: string,
  defaultDurationSeconds: number,
  onSessionComplete?: (categoryId: string, durationMinutes: number) => void,
) {
  const { user } = useAuth();
  const supabase = createClient();
  
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
  const supabaseSyncRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    timerStateRef.current = timerState;
  }, [timerState]);

  const calculateElapsedSeconds = useCallback((state: TimerState): number => {
    if (!state.isRunning || !state.startedAt) return state.accumulatedSeconds;
    return state.accumulatedSeconds + Math.floor((Date.now() - state.startedAt) / 1000);
  }, []);

  const syncToSupabase = useCallback(async (state: TimerState) => {
    if (!user) return;
    
    try {
      const elapsed = calculateElapsedSeconds(state);
      
      if (!state.isRunning && elapsed === 0) {
        await supabase.from('active_sessions').delete().eq('user_id', user.id);
        return;
      }

      await supabase.from('active_sessions').upsert({
        user_id: user.id,
        category_id: state.categoryId,
        start_time: state.startedAt ? new Date(state.startedAt).toISOString() : new Date().toISOString(),
        paused_at: state.pausedAt ? new Date(state.pausedAt).toISOString() : null,
        accumulated_seconds: state.accumulatedSeconds,
        is_running: state.isRunning,
      });
    } catch (e) {
      console.warn('Timer sync to Supabase failed:', e);
    }
  }, [user, supabase, calculateElapsedSeconds]);

  const syncLiveSession = useCallback((state: TimerState) => {
    const elapsed = calculateElapsedSeconds(state);
    
    if ((state.isRunning || state.accumulatedSeconds > 0) && state.categoryId) {
      const session: LiveSession = {
        categoryId: state.categoryId,
        elapsedMinutes: Math.floor(elapsed / 60),
        elapsedSeconds: elapsed,
        isRunning: state.isRunning,
      };
      setLiveSession(session);
      
      if (timerSyncManager) {
        timerSyncManager.update({
          categoryId: state.categoryId,
          elapsedSeconds: elapsed,
          isRunning: state.isRunning,
          isPaused: !state.isRunning && state.accumulatedSeconds > 0,
          timestamp: Date.now(),
        });
      }
    } else {
      setLiveSession(null);
      if (timerSyncManager) timerSyncManager.clear();
    }
  }, [calculateElapsedSeconds]);

  useEffect(() => {
    const init = async () => {
      let state = loadTimerState();
      
      if (user) {
        try {
          const { data: remote } = await supabase
            .from('active_sessions')
            .select('*')
            .eq('user_id', user.id)
            .single();
          
          if (remote) {
            const remoteState: TimerState = {
              isRunning: remote.is_running,
              startedAt: remote.start_time ? new Date(remote.start_time).getTime() : null,
              pausedAt: remote.paused_at ? new Date(remote.paused_at).getTime() : null,
              accumulatedSeconds: remote.accumulated_seconds || 0,
              categoryId: remote.category_id,
              totalDurationSeconds: state?.totalDurationSeconds || defaultDurationSeconds,
              lastUpdated: Date.now(),
            };
            
            if (!state || new Date(remote.start_time || 0).getTime() > (state.lastUpdated || 0)) {
              state = remoteState;
            }
          }
        } catch (e) {
          console.warn('Failed to load remote timer state:', e);
        }
      }

      if (state && state.categoryId) {
        const elapsed = calculateElapsedSeconds(state);
        const remaining = Math.max(0, state.totalDurationSeconds - elapsed);
        
        if (remaining <= 0 && (state.isRunning || state.accumulatedSeconds > 0)) {
          if (onSessionComplete) {
            onSessionComplete(state.categoryId, Math.floor(state.totalDurationSeconds / 60));
          }
          state = { ...DEFAULT_TIMER_STATE, categoryId: defaultCategoryId, totalDurationSeconds: defaultDurationSeconds };
          clearTimerStorage();
          if (user) {
            supabase.from('active_sessions').delete().eq('user_id', user.id);
          }
        }
        
        setTimerState(state);
        setTimeLeft(remaining > 0 ? remaining : state.totalDurationSeconds);
        syncLiveSession(state);
      }
      
      setIsLoaded(true);
    };
    
    init();
  }, [user, supabase, defaultCategoryId, defaultDurationSeconds, onSessionComplete, calculateElapsedSeconds, syncLiveSession]);

  useEffect(() => {
    if (!isLoaded) return;

    if (timerState.isRunning) {
      intervalRef.current = setInterval(() => {
        const state = timerStateRef.current;
        const elapsed = calculateElapsedSeconds(state);
        const remaining = Math.max(0, state.totalDurationSeconds - elapsed);
        
        setTimeLeft(remaining);
        syncLiveSession(state);
        saveTimerState(state);

        if (remaining <= 0) {
          const completedState: TimerState = {
            ...state,
            isRunning: false,
            startedAt: null,
            accumulatedSeconds: 0,
          };
          
          setTimerState(completedState);
          clearTimerStorage();
          syncToSupabase(completedState);
          
          if (onSessionComplete) {
            onSessionComplete(state.categoryId, Math.floor(state.totalDurationSeconds / 60));
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
  }, [timerState.isRunning, isLoaded, onSessionComplete, calculateElapsedSeconds, syncLiveSession, syncToSupabase]);

  useEffect(() => {
    if (!isLoaded || !user) return;

    supabaseSyncRef.current = setInterval(() => {
      const state = timerStateRef.current;
      if (state.isRunning || state.accumulatedSeconds > 0) {
        syncToSupabase(state);
      }
    }, 10000);

    return () => {
      if (supabaseSyncRef.current) {
        clearInterval(supabaseSyncRef.current);
      }
    };
  }, [isLoaded, user, syncToSupabase]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const state = timerStateRef.current;
      saveTimerState(state);
      if (state.isRunning || state.accumulatedSeconds > 0) {
        syncToSupabase(state);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [syncToSupabase]);

  const toggle = useCallback(() => {
    const now = Date.now();
    let newState: TimerState;
    
    if (timerState.isRunning) {
      const elapsed = calculateElapsedSeconds(timerState);
      newState = {
        ...timerState,
        isRunning: false,
        startedAt: null,
        pausedAt: now,
        accumulatedSeconds: elapsed,
        lastUpdated: now,
      };
    } else {
      newState = {
        ...timerState,
        isRunning: true,
        startedAt: now,
        pausedAt: null,
        lastUpdated: now,
      };
    }
    
    setTimerState(newState);
    saveTimerState(newState);
    syncToSupabase(newState);
    syncLiveSession(newState);
  }, [timerState, calculateElapsedSeconds, syncToSupabase, syncLiveSession]);

  const reset = useCallback(() => {
    const newState: TimerState = {
      ...DEFAULT_TIMER_STATE,
      categoryId: timerState.categoryId,
      totalDurationSeconds: timerState.totalDurationSeconds,
      lastUpdated: Date.now(),
    };
    
    setTimerState(newState);
    setTimeLeft(timerState.totalDurationSeconds);
    clearTimerStorage();
    syncToSupabase(newState);
    syncLiveSession(newState);
  }, [timerState.categoryId, timerState.totalDurationSeconds, syncToSupabase, syncLiveSession]);

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
    saveTimerState(newState);
    syncLiveSession(newState);
  }, [timerState.isRunning, syncLiveSession]);

  return {
    timeLeft,
    isRunning: timerState.isRunning,
    isPaused: !timerState.isRunning && timerState.accumulatedSeconds > 0,
    liveSession,
    isLoaded,
    toggle,
    reset,
    setCategory,
    progress: ((timerState.totalDurationSeconds - timeLeft) / timerState.totalDurationSeconds) * 100,
  };
}
