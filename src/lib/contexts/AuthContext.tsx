"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

const AUTH_CACHE_KEY = 'blindy_auth_cache';
const AUTH_CACHE_EXPIRY = 1000 * 60 * 60 * 24 * 7;

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getCachedAuth(): CachedAuth | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY);
    if (!cached) return null;
    const parsed: CachedAuth = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > AUTH_CACHE_EXPIRY) {
      localStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function setCachedAuth(user: User | null, session: Session | null) {
  if (typeof window === 'undefined') return;
  try {
    const cache: CachedAuth = { user, session, timestamp: Date.now() };
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

function clearCachedAuth() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_CACHE_KEY);
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const supabase = createClient();
  const initRef = useRef(false);

  const createUserProfile = async (userId: string, fullName: string, nickname: string) => {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: fullName,
        nickname: nickname,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    
    if (error) console.error('Error creating profile:', error);
  };

  const initializeUserData = async (userId: string) => {
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
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    clearCachedAuth();
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signUp, signIn, signOut }}>
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
