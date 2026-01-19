"use client";

import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';

const AUTO_FIX_INTERVAL = 60000;
const HEALTH_CHECK_KEY = 'blindy_last_health_check';

export function useAutoFix() {
  const { user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

  const runHealthCheck = useCallback(async () => {
    if (!user || isRunningRef.current) return;
    
    isRunningRef.current = true;
    
    try {
      const response = await fetch(`/api/health?userId=${user.id}&autoFix=true`);
      const result = await response.json();
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(HEALTH_CHECK_KEY, JSON.stringify({
          timestamp: Date.now(),
          status: result.status,
          fixes: result.autoFixes?.length || 0,
        }));
      }
      
      if (result.autoFixes && result.autoFixes.length > 0) {
        console.log('[AutoFix] Applied fixes:', result.autoFixes);
      }
      
      return result;
    } catch (e) {
      console.warn('[AutoFix] Health check failed:', e);
      return null;
    } finally {
      isRunningRef.current = false;
    }
  }, [user]);

  const fixUserData = useCallback(async () => {
    if (!user) return null;
    
    try {
      const response = await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action: 'fix_user_data' }),
      });
      
      return await response.json();
    } catch (e) {
      console.error('[AutoFix] Fix user data failed:', e);
      return null;
    }
  }, [user]);

  const validateSessions = useCallback(async () => {
    if (!user) return null;
    
    try {
      const response = await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action: 'validate_sessions' }),
      });
      
      return await response.json();
    } catch (e) {
      console.error('[AutoFix] Validate sessions failed:', e);
      return null;
    }
  }, [user]);

  const cleanupOrphans = useCallback(async () => {
    if (!user) return null;
    
    try {
      const response = await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action: 'cleanup_orphans' }),
      });
      
      return await response.json();
    } catch (e) {
      console.error('[AutoFix] Cleanup orphans failed:', e);
      return null;
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    runHealthCheck();

    intervalRef.current = setInterval(() => {
      runHealthCheck();
    }, AUTO_FIX_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user, runHealthCheck]);

  return {
    runHealthCheck,
    fixUserData,
    validateSessions,
    cleanupOrphans,
  };
}
