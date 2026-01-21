"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { timerSyncManager } from '@/lib/utils/timerSync';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/AuthContext';
import { safeStorage } from '@/lib/utils/safeStorage';
import { STORAGE_KEYS } from '@/lib/utils/storage.constants';

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

const TICK_INTERVAL_MS = 200;

function saveTimerState(state: TimerState): void {
  const current = safeStorage.get<TimerState>(STORAGE_KEYS.TIMER_STATE);
  if (current) {
    safeStorage.set(STORAGE_KEYS.TIMER_BACKUP, current);
  }
  safeStorage.set(STORAGE_KEYS.TIMER_STATE, { ...state, lastUpdated: Date.now() });
}

function loadTimerState(): TimerState | null {
  return safeStorage.get<TimerState>(STORAGE_KEYS.TIMER_STATE);
}

function clearTimerStorage(): void {
  safeStorage.remove(STORAGE_KEYS.TIMER_STATE);
  safeStorage.remove(STORAGE_KEYS.TIMER_BACKUP);
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
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStateRef = useRef(timerState);
  const supabaseSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const isProcessingRef = useRef(false);
  const lastTickRef = useRef(Date.now());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  const clearAllIntervals = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    if (!mountedRef.current) return;
    if (isProcessingRef.current) return;
    
    const state = timerStateRef.current;
    if (!state.isRunning || !state.startedAt) return;
    
    const now = Date.now();
    const timeSinceLastTick = now - lastTickRef.current;
    
    if (timeSinceLastTick > 5000 && state.isRunning) {
      console.warn('[useTimerPersistence] Large tick gap detected, recalculating...');
    }
    lastTickRef.current = now;
    
    const elapsed = state.accumulatedSeconds + Math.floor((now - state.startedAt) / 1000);
    const remaining = Math.max(0, state.totalDurationSeconds - elapsed);
    
    setTimeLeft(remaining);
    syncLiveSession(state);
    
    if (remaining <= 0) {
      isProcessingRef.current = true;
      console.log('[useTimerPersistence] Timer completed! Saving session...');
      
      clearAllIntervals();
      
      const completedState: TimerState = {
        ...state,
        isRunning: false,
        startedAt: null,
        pausedAt: null,
        accumulatedSeconds: 0,
        lastUpdated: now,
      };
      
      setTimerState(completedState);
      clearTimerStorage();
      syncToSupabase(completedState);
      syncLiveSession(completedState);
      
      if (onSessionComplete) {
        const durationMinutes = Math.floor(state.totalDurationSeconds / 60);
        console.log('[useTimerPersistence] Calling onSessionComplete:', { categoryId: state.categoryId, durationMinutes });
        try {
          onSessionComplete(state.categoryId, durationMinutes);
        } catch (e) {
          console.error('[useTimerPersistence] onSessionComplete error:', e);
        }
      } else {
        console.warn('[useTimerPersistence] onSessionComplete callback not provided');
      }
      
      isProcessingRef.current = false;
    }
  }, [syncLiveSession, syncToSupabase, onSessionComplete, clearAllIntervals]);

  useEffect(() => {
    if (!isLoaded) return;

    if (timerState.isRunning) {
      clearAllIntervals();
      lastTickRef.current = Date.now();
      
      tick();
      
      intervalRef.current = setInterval(() => {
        if (mountedRef.current) {
          tick();
        }
      }, TICK_INTERVAL_MS);
    } else {
      clearAllIntervals();
    }

    return () => {
      clearAllIntervals();
    };
  }, [timerState.isRunning, isLoaded, tick, clearAllIntervals]);

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
    if (isProcessingRef.current) {
      console.warn('[useTimerPersistence] Toggle blocked - processing in progress');
      return;
    }
    
    const now = Date.now();
    
    setTimerState(prev => {
      let newState: TimerState;
      
      if (prev.isRunning) {
        clearAllIntervals();
        
        const elapsed = prev.accumulatedSeconds + (prev.startedAt ? Math.floor((now - prev.startedAt) / 1000) : 0);
        
        console.log('[useTimerPersistence] PAUSING timer:', { 
          previousAccumulated: prev.accumulatedSeconds,
          calculatedElapsed: elapsed,
          startedAt: prev.startedAt,
          timeSinceStart: prev.startedAt ? Math.floor((now - prev.startedAt) / 1000) : 0,
        });
        
        newState = {
          ...prev,
          isRunning: false,
          startedAt: null,
          pausedAt: now,
          accumulatedSeconds: elapsed,
          lastUpdated: now,
        };
        
        const remaining = Math.max(0, prev.totalDurationSeconds - elapsed);
        setTimeLeft(remaining);
        
        console.log('[useTimerPersistence] Paused state:', {
          newAccumulatedSeconds: newState.accumulatedSeconds,
          timeLeft: remaining,
        });
      } else {
        console.log('[useTimerPersistence] RESUMING timer:', {
          previousAccumulated: prev.accumulatedSeconds,
          totalDuration: prev.totalDurationSeconds,
        });
        
        newState = {
          ...prev,
          isRunning: true,
          startedAt: now,
          pausedAt: null,
          lastUpdated: now,
        };
        
        const remaining = Math.max(0, prev.totalDurationSeconds - prev.accumulatedSeconds);
        setTimeLeft(remaining);
        lastTickRef.current = now;
        
        console.log('[useTimerPersistence] Resumed state:', {
          accumulatedSeconds: newState.accumulatedSeconds,
          timeLeft: remaining,
        });
      }
      
      saveTimerState(newState);
      syncToSupabase(newState);
      syncLiveSession(newState);
      
      return newState;
    });
  }, [syncToSupabase, syncLiveSession, clearAllIntervals]);

  const reset = useCallback(() => {
    console.log('[useTimerPersistence] RESETTING timer');
    clearAllIntervals();
    isProcessingRef.current = false;
    
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
  }, [timerState.categoryId, timerState.totalDurationSeconds, syncToSupabase, syncLiveSession, clearAllIntervals]);

  const setCategory = useCallback((categoryId: string, durationSeconds: number) => {
    if (timerState.isRunning || (timerState.accumulatedSeconds > 0)) {
      console.log('[useTimerPersistence] setCategory blocked - timer is running or paused');
      return;
    }
    
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
