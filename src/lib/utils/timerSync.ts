"use client";

export interface LiveSessionEvent {
  categoryId: string;
  elapsedSeconds: number;
  isRunning: boolean;
  isPaused: boolean;
  timestamp: number;
}

type Listener = (session: LiveSessionEvent | null) => void;

const STORAGE_KEY = 'blindados_timer_sync_v4';
const PAUSED_STORAGE_KEY = 'blindados_timer_paused_v4';

class TimerSyncManager {
  private listeners: Set<Listener> = new Set();
  private currentSession: LiveSessionEvent | null = null;
  private pausedSession: LiveSessionEvent | null = null;
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initBroadcastChannel();
      this.loadFromStorage();
      window.addEventListener('storage', this.handleStorageChange);
    }
  }

  private initBroadcastChannel() {
    try {
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('blindados_timer_sync_channel_v2');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data.type === 'LIVE_SESSION_UPDATE') {
            this.currentSession = event.data.session;
            this.notifyListeners();
          } else if (event.data.type === 'PAUSED_SESSION_UPDATE') {
            this.pausedSession = event.data.session;
            this.notifyListeners();
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as LiveSessionEvent;
        if (data.isRunning && data.timestamp) {
          const now = Date.now();
          const elapsedSinceStore = Math.floor((now - data.timestamp) / 1000);
          this.currentSession = {
            ...data,
            elapsedSeconds: data.elapsedSeconds + elapsedSinceStore,
            timestamp: now,
          };
        } else {
          this.currentSession = data;
        }
      }
      
      const pausedStored = localStorage.getItem(PAUSED_STORAGE_KEY);
      if (pausedStored) {
        this.pausedSession = JSON.parse(pausedStored) as LiveSessionEvent;
      }
    } catch (e) {
      console.warn('Failed to load timer from storage:', e);
    }
  }

  private handleStorageChange = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        this.currentSession = JSON.parse(event.newValue);
        this.notifyListeners();
      } catch (e) {
        console.warn('Failed to parse storage event:', e);
      }
    } else if (event.key === PAUSED_STORAGE_KEY) {
      try {
        this.pausedSession = event.newValue ? JSON.parse(event.newValue) : null;
        this.notifyListeners();
      } catch (e) {
        console.warn('Failed to parse paused storage event:', e);
      }
    }
  };

  private saveToStorage() {
    try {
      if (this.currentSession) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentSession));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to save timer to storage:', e);
    }
  }

  private savePausedToStorage() {
    try {
      if (this.pausedSession) {
        localStorage.setItem(PAUSED_STORAGE_KEY, JSON.stringify(this.pausedSession));
      } else {
        localStorage.removeItem(PAUSED_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to save paused timer to storage:', e);
    }
  }

  private notifyListeners() {
    const sessionToNotify = this.currentSession || this.pausedSession;
    this.listeners.forEach(listener => {
      try {
        listener(sessionToNotify);
      } catch (e) {
        console.error('Listener error:', e);
      }
    });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    const sessionToNotify = this.currentSession || this.pausedSession;
    listener(sessionToNotify);
    return () => {
      this.listeners.delete(listener);
    };
  }

  update(session: LiveSessionEvent | null) {
    this.currentSession = session;
    this.saveToStorage();
    
    if (session?.isRunning) {
      this.pausedSession = null;
      this.savePausedToStorage();
    }
    
    this.notifyListeners();
    
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'LIVE_SESSION_UPDATE',
          session,
        });
      } catch (e) {
        console.warn('Failed to broadcast:', e);
      }
    }
  }

  pause(session: LiveSessionEvent) {
    const pausedData: LiveSessionEvent = {
      ...session,
      isRunning: false,
      isPaused: true,
      timestamp: Date.now(),
    };
    
    this.currentSession = null;
    this.pausedSession = pausedData;
    
    this.saveToStorage();
    this.savePausedToStorage();
    this.notifyListeners();
    
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'LIVE_SESSION_UPDATE',
          session: null,
        });
        this.broadcastChannel.postMessage({
          type: 'PAUSED_SESSION_UPDATE',
          session: pausedData,
        });
      } catch (e) {
        console.warn('Failed to broadcast pause:', e);
      }
    }
  }

  getCurrentSession(): LiveSessionEvent | null {
    if (this.currentSession?.isRunning && this.currentSession.timestamp) {
      const now = Date.now();
      const elapsed = Math.floor((now - this.currentSession.timestamp) / 1000);
      return {
        ...this.currentSession,
        elapsedSeconds: this.currentSession.elapsedSeconds + elapsed,
      };
    }
    return this.currentSession;
  }

  getPausedSession(): LiveSessionEvent | null {
    return this.pausedSession;
  }

  getActiveSession(): LiveSessionEvent | null {
    return this.getCurrentSession() || this.getPausedSession();
  }

  clear() {
    this.currentSession = null;
    this.pausedSession = null;
    this.saveToStorage();
    this.savePausedToStorage();
    this.notifyListeners();
    
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: 'LIVE_SESSION_UPDATE', session: null });
      this.broadcastChannel.postMessage({ type: 'PAUSED_SESSION_UPDATE', session: null });
    }
  }

  clearPaused() {
    this.pausedSession = null;
    this.savePausedToStorage();
    this.notifyListeners();
    
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: 'PAUSED_SESSION_UPDATE', session: null });
    }
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageChange);
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
    this.listeners.clear();
  }
}

export const timerSyncManager = typeof window !== 'undefined' ? new TimerSyncManager() : null;

export function useTimerSync() {
  if (typeof window === 'undefined') {
    return {
      currentSession: null,
      pausedSession: null,
      activeSession: null,
      update: () => {},
      pause: () => {},
      clear: () => {},
      clearPaused: () => {},
      subscribe: () => () => {},
    };
  }

  return {
    currentSession: timerSyncManager?.getCurrentSession() || null,
    pausedSession: timerSyncManager?.getPausedSession() || null,
    activeSession: timerSyncManager?.getActiveSession() || null,
    update: (session: LiveSessionEvent | null) => timerSyncManager?.update(session),
    pause: (session: LiveSessionEvent) => timerSyncManager?.pause(session),
    clear: () => timerSyncManager?.clear(),
    clearPaused: () => timerSyncManager?.clearPaused(),
    subscribe: (listener: Listener) => timerSyncManager?.subscribe(listener) || (() => {}),
  };
}
