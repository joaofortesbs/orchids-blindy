"use client";

function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export const safeStorage = {
  get<T>(key: string, defaultValue: T | null = null): T | null {
    if (!isStorageAvailable()) return defaultValue;
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue;
      return JSON.parse(item) as T;
    } catch {
      return defaultValue;
    }
  },
  
  getString(key: string, defaultValue: string = ''): string {
    if (!isStorageAvailable()) return defaultValue;
    try {
      return localStorage.getItem(key) || defaultValue;
    } catch {
      return defaultValue;
    }
  },
  
  set<T>(key: string, value: T): boolean {
    if (!isStorageAvailable()) return false;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  
  setString(key: string, value: string): boolean {
    if (!isStorageAvailable()) return false;
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  
  remove(key: string): boolean {
    if (!isStorageAvailable()) return false;
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
  
  removeMany(keys: string[]): void {
    if (!isStorageAvailable()) return;
    keys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch {}
    });
  },
  
  removeByPrefix(prefix: string): void {
    if (!isStorageAvailable()) return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch {}
  },
  
  clear(): void {
    if (!isStorageAvailable()) return;
    try {
      localStorage.clear();
    } catch {}
  },
  
  clearAppData(): void {
    if (!isStorageAvailable()) return;
    const prefixes = ['blindy_', 'blindados_', 'sb-', 'supabase'];
    prefixes.forEach(prefix => safeStorage.removeByPrefix(prefix));
  }
};
