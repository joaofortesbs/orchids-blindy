"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { safeStorage } from '@/lib/utils/safeStorage';
import { STORAGE_KEYS, AUTH_CACHE_EXPIRY, OLD_CACHE_KEYS } from '@/lib/utils/storage.constants';

interface CachedAuth {
  user: User | null;
  session: Session | null;
  timestamp: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string, fullName: string, nickname: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getCachedAuth(): CachedAuth | null {
  const cached = safeStorage.get<CachedAuth>(STORAGE_KEYS.AUTH_CACHE);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > AUTH_CACHE_EXPIRY) {
    safeStorage.remove(STORAGE_KEYS.AUTH_CACHE);
    return null;
  }
  return cached;
}

function setCachedAuth(user: User | null, session: Session | null) {
  if (user && session) {
    safeStorage.set(STORAGE_KEYS.AUTH_CACHE, { user, session, timestamp: Date.now() });
  }
}

function clearCachedAuth() {
  safeStorage.remove(STORAGE_KEYS.AUTH_CACHE);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const supabase = createClient();
  const initRef = useRef(false);

  const cleanupOldCaches = useCallback(() => {
    safeStorage.removeMany(OLD_CACHE_KEYS);
  }, []);

  const createUserProfile = useCallback(async (userId: string, fullName: string, nickname: string) => {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: fullName,
        nickname: nickname,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    
    if (error) console.error('Error creating profile:', error);
  }, [supabase]);

  const initializeUserData = useCallback(async (userId: string) => {
    try {
      const { data: existingSettings } = await supabase
        .from('pomodoro_settings')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!existingSettings) {
        await supabase.from('pomodoro_settings').insert({
          user_id: userId,
          short_break_minutes: 5,
          long_break_minutes: 15,
          cycles_until_long_break: 4,
        });

        const defaultCategories = [
          { name: 'Trabalho', color: '#ef4444', duration_minutes: 25 },
          { name: 'Estudo', color: '#3b82f6', duration_minutes: 30 },
          { name: 'Projeto', color: '#22c55e', duration_minutes: 45 },
        ];

        for (const cat of defaultCategories) {
          await supabase.from('pomodoro_categories').insert({ user_id: userId, ...cat });
        }

        const defaultColumns = [
          { title: 'A FAZER', position: 0 },
          { title: 'EM PROGRESSO', position: 1 },
          { title: 'CONCLUÍDO', position: 2 },
        ];

        for (const col of defaultColumns) {
          await supabase.from('kanban_columns').insert({ user_id: userId, ...col });
        }

        const defaultGoalCategories = [
          { name: 'Saúde', icon: '❤️', position: 0 },
          { name: 'Carreira', icon: '💼', position: 1 },
          { name: 'Finanças', icon: '💰', position: 2 },
          { name: 'Relacionamentos', icon: '👥', position: 3 },
          { name: 'Desenvolvimento Pessoal', icon: '🎯', position: 4 },
          { name: 'Lazer', icon: '🎮', position: 5 },
        ];

        for (const cat of defaultGoalCategories) {
          await supabase.from('goal_categories').insert({ user_id: userId, ...cat });
        }

        await supabase.from('user_settings').insert({
          user_id: userId,
          selected_year: new Date().getFullYear(),
          theme: 'dark',
        });
      }
    } catch (e) {
      console.error('Error initializing user data:', e);
    }
  }, [supabase]);

  useEffect(() => {
    setIsMounted(true);
    cleanupOldCaches();
  }, [cleanupOldCaches]);

  useEffect(() => {
    if (!isMounted || initRef.current) return;
    initRef.current = true;

    const cached = getCachedAuth();
    if (cached?.user && cached?.session) {
      setUser(cached.user);
      setSession(cached.session);
      setIsLoading(false);
      
      supabase.auth.getSession().then(({ data: { session: freshSession } }) => {
        if (freshSession) {
          setSession(freshSession);
          setUser(freshSession.user);
          setCachedAuth(freshSession.user, freshSession);
        } else {
          setUser(null);
          setSession(null);
          clearCachedAuth();
        }
      });
    } else {
      supabase.auth.getSession().then(({ data: { session: freshSession } }) => {
        setSession(freshSession);
        setUser(freshSession?.user ?? null);
        if (freshSession) {
          setCachedAuth(freshSession.user, freshSession);
        }
        setIsLoading(false);
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      if (newSession) {
        setCachedAuth(newSession.user, newSession);
      } else {
        clearCachedAuth();
      }
      
      if (event === 'SIGNED_IN' && newSession?.user) {
        const metadata = newSession.user.user_metadata;
        if (metadata?.full_name && metadata?.nickname) {
          await createUserProfile(newSession.user.id, metadata.full_name, metadata.nickname);
        }
        await initializeUserData(newSession.user.id);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [isMounted, supabase]);

  const signUp = async (email: string, password: string, fullName: string, nickname: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, nickname },
        emailRedirectTo: undefined,
      },
    });

    if (!error && data.user) {
      await createUserProfile(data.user.id, fullName, nickname);
      await initializeUserData(data.user.id);
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Error during sign out:', e);
    }
    
    setUser(null);
    setSession(null);
    clearCachedAuth();
    safeStorage.clearAppData();
    
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }, [supabase]);

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signUp, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
