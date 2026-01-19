"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { BlindadosData, DEFAULT_DATA, KanbanColumn, KanbanCard, PomodoroSession, PomodoroSettings, PomodoroCategory, DEFAULT_POMODORO_SETTINGS } from '@/lib/types/blindados';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/AuthContext';

const SYNC_INTERVAL = 30000;
const CACHE_SAVE_INTERVAL = 2000;
const BLINDADOS_CACHE_KEY = 'blindy_data_cache_v5';

function safeStorage() {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
}

function getCachedData(): BlindadosData | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const cached = storage.getItem(BLINDADOS_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch { return null; }
}

function setCachedData(data: BlindadosData) {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(BLINDADOS_CACHE_KEY, JSON.stringify(data));
  } catch {}
}

const DEFAULT_COLUMN_TITLES = ['A FAZER', 'EM PROGRESSO', 'CONCLUÍDO'];

export function useBlindadosData() {
  const [data, setData] = useState<BlindadosData>(DEFAULT_DATA);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { user } = useAuth();
  const supabase = createClient();
  
  const dataRef = useRef(data);
  const initRef = useRef(false);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cacheTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    setIsMounted(true);
    const cached = getCachedData();
    if (cached) {
      setData(cached);
    }
  }, []);

  const createDefaultColumns = useCallback(async () => {
    if (!user) return [];
    
    const columns: KanbanColumn[] = [];
    
    for (let i = 0; i < DEFAULT_COLUMN_TITLES.length; i++) {
      const { data: newCol, error } = await supabase
        .from('kanban_columns')
        .insert({
          user_id: user.id,
          title: DEFAULT_COLUMN_TITLES[i],
          position: i,
        })
        .select()
        .single();
      
      if (!error && newCol) {
        columns.push({
          id: newCol.id,
          title: newCol.title,
          cards: [],
        });
      }
    }
    
    return columns;
  }, [user, supabase]);

  const loadFromSupabase = useCallback(async () => {
    if (!user) {
      setIsLoaded(true);
      return;
    }
    
    try {
      setIsSyncing(true);

      const [catRes, sesRes, setRes, colRes, crdRes] = await Promise.all([
        supabase.from('pomodoro_categories').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('pomodoro_sessions').select('*').eq('user_id', user.id).order('completed_at', { ascending: false }),
        supabase.from('pomodoro_settings').select('*').eq('user_id', user.id).single(),
        supabase.from('kanban_columns').select('*').eq('user_id', user.id).order('position'),
        supabase.from('kanban_cards').select('*').eq('user_id', user.id).order('position'),
      ]);

      const categories: PomodoroCategory[] = (catRes.data || []).map(cat => ({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        duration: cat.duration_minutes,
      }));

      const sessions: PomodoroSession[] = (sesRes.data || []).map(s => ({
        id: s.id,
        categoryId: s.category_id || '',
        duration: s.duration_minutes,
        completedAt: s.completed_at,
        date: s.session_date,
      }));

      const settings: PomodoroSettings = {
        categories: categories.length > 0 ? categories : DEFAULT_POMODORO_SETTINGS.categories,
        intervals: {
          shortBreak: setRes.data?.short_break_minutes ?? DEFAULT_POMODORO_SETTINGS.intervals.shortBreak,
          longBreak: setRes.data?.long_break_minutes ?? DEFAULT_POMODORO_SETTINGS.intervals.longBreak,
          cyclesUntilLongBreak: setRes.data?.cycles_until_long_break ?? DEFAULT_POMODORO_SETTINGS.intervals.cyclesUntilLongBreak,
        },
      };

      const cardsMap = new Map<string, KanbanCard[]>();
      (crdRes.data || []).forEach(card => {
        const list = cardsMap.get(card.column_id) || [];
        list.push({
          id: card.id,
          title: card.title,
          description: card.description || '',
          priority: card.priority as 'alta' | 'media' | 'baixa',
          tags: card.tags || [],
          subtasks: card.subtasks || [],
          createdAt: card.created_at,
          updatedAt: card.updated_at,
        });
        cardsMap.set(card.column_id, list);
      });

      let columns: KanbanColumn[] = (colRes.data || []).map(col => ({
        id: col.id,
        title: col.title,
        cards: cardsMap.get(col.id) || [],
      }));

      if (columns.length === 0) {
        columns = await createDefaultColumns();
      }

      const newData: BlindadosData = {
        pomodoro: { sessions, settings },
        kanban: { columns },
        lastUpdated: new Date().toISOString(),
      };

      setData(newData);
      setCachedData(newData);
    } catch (e) {
      console.error('Sync error:', e);
    } finally {
      setIsLoaded(true);
      setIsSyncing(false);
    }
  }, [user, supabase, createDefaultColumns]);

  useEffect(() => {
    if (isMounted && !initRef.current) {
      initRef.current = true;
      loadFromSupabase();
    }
  }, [isMounted, loadFromSupabase]);

  useEffect(() => {
    if (!isMounted) return;
    cacheTimerRef.current = setInterval(() => setCachedData(dataRef.current), CACHE_SAVE_INTERVAL);
    if (user) {
      syncTimerRef.current = setInterval(loadFromSupabase, SYNC_INTERVAL);
    }
    return () => {
      if (cacheTimerRef.current) clearInterval(cacheTimerRef.current);
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [isMounted, user, loadFromSupabase]);

  const addKanbanColumn = useCallback(async (title: string) => {
    if (!user) return;
    
    const position = dataRef.current.kanban.columns.length;
    
    try {
      const { data: newCol, error } = await supabase
        .from('kanban_columns')
        .insert({
          user_id: user.id,
          title: title.toUpperCase(),
          position,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating column:', error.message);
        return;
      }

      const column: KanbanColumn = {
        id: newCol.id,
        title: newCol.title,
        cards: [],
      };

      setData(prev => ({
        ...prev,
        kanban: { columns: [...prev.kanban.columns, column] },
        lastUpdated: new Date().toISOString(),
      }));
    } catch (e) {
      console.error('Error adding column:', e);
    }
  }, [user, supabase]);

  const deleteKanbanColumn = useCallback(async (columnId: string) => {
    if (!user) return;
    
    setData(prev => ({
      ...prev,
      kanban: { columns: prev.kanban.columns.filter(c => c.id !== columnId) },
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await supabase.from('kanban_columns').delete().eq('id', columnId).eq('user_id', user.id);
    } catch (e) {
      console.error('Error deleting column:', e);
    }
  }, [user, supabase]);

  const addKanbanCard = useCallback(async (columnId: string, card: Omit<KanbanCard, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;
    
    const column = dataRef.current.kanban.columns.find(c => c.id === columnId);
    if (!column) {
      console.error('Column not found:', columnId);
      return;
    }
    
    const position = column.cards.length;

    try {
      const { data: newCard, error } = await supabase
        .from('kanban_cards')
        .insert({
          user_id: user.id,
          column_id: columnId,
          title: card.title,
          description: card.description || '',
          priority: card.priority || 'media',
          tags: card.tags || [],
          subtasks: card.subtasks || [],
          position,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating card:', error.message, error.details, error.hint);
        return;
      }

      const kanbanCard: KanbanCard = {
        id: newCard.id,
        title: newCard.title,
        description: newCard.description || '',
        priority: newCard.priority as 'alta' | 'media' | 'baixa',
        tags: newCard.tags || [],
        subtasks: newCard.subtasks || [],
        createdAt: newCard.created_at,
        updatedAt: newCard.updated_at,
      };

      setData(prev => ({
        ...prev,
        kanban: {
          columns: prev.kanban.columns.map(c =>
            c.id === columnId ? { ...c, cards: [...c.cards, kanbanCard] } : c
          ),
        },
        lastUpdated: new Date().toISOString(),
      }));
    } catch (e) {
      console.error('Error adding card:', e);
    }
  }, [user, supabase]);

  const updateKanbanCard = useCallback(async (columnId: string, cardId: string, updates: Partial<KanbanCard>) => {
    if (!user) return;

    setData(prev => ({
      ...prev,
      kanban: {
        columns: prev.kanban.columns.map(c =>
          c.id === columnId
            ? {
                ...c,
                cards: c.cards.map(card =>
                  card.id === cardId ? { ...card, ...updates, updatedAt: new Date().toISOString() } : card
                ),
              }
            : c
        ),
      },
      lastUpdated: new Date().toISOString(),
    }));

    try {
      const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.subtasks !== undefined) dbUpdates.subtasks = updates.subtasks;

      await supabase.from('kanban_cards').update(dbUpdates).eq('id', cardId).eq('user_id', user.id);
    } catch (e) {
      console.error('Error updating card:', e);
    }
  }, [user, supabase]);

  const deleteKanbanCard = useCallback(async (columnId: string, cardId: string) => {
    if (!user) return;

    setData(prev => ({
      ...prev,
      kanban: {
        columns: prev.kanban.columns.map(c =>
          c.id === columnId ? { ...c, cards: c.cards.filter(card => card.id !== cardId) } : c
        ),
      },
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await supabase.from('kanban_cards').delete().eq('id', cardId).eq('user_id', user.id);
    } catch (e) {
      console.error('Error deleting card:', e);
    }
  }, [user, supabase]);

  const moveCard = useCallback(async (cardId: string, sourceColId: string, targetColId: string, targetIdx: number) => {
    if (!user) return;
    
    const card = dataRef.current.kanban.columns.find(c => c.id === sourceColId)?.cards.find(c => c.id === cardId);
    if (!card) return;

    setData(prev => {
      const newCols = prev.kanban.columns.map(c => {
        if (c.id === sourceColId) return { ...c, cards: c.cards.filter(card => card.id !== cardId) };
        if (c.id === targetColId) {
          const list = [...c.cards];
          list.splice(targetIdx, 0, card);
          return { ...c, cards: list };
        }
        return c;
      });
      return { ...prev, kanban: { columns: newCols }, lastUpdated: new Date().toISOString() };
    });

    try {
      await supabase.from('kanban_cards').update({ column_id: targetColId, position: targetIdx }).eq('id', cardId).eq('user_id', user.id);
    } catch (e) {
      console.error('Error moving card:', e);
    }
  }, [user, supabase]);

  const updateKanbanColumns = useCallback(async (columns: KanbanColumn[]) => {
    if (!user) return;

    setData(prev => ({
      ...prev,
      kanban: { columns },
      lastUpdated: new Date().toISOString(),
    }));

    try {
      for (let i = 0; i < columns.length; i++) {
        await supabase.from('kanban_columns').update({ position: i, title: columns[i].title }).eq('id', columns[i].id).eq('user_id', user.id);
      }
    } catch (e) {
      console.error('Error updating columns:', e);
    }
  }, [user, supabase]);

  const addPomodoroSession = useCallback(async (session: Omit<PomodoroSession, 'id'>) => {
    if (!user) return;

    const category = dataRef.current.pomodoro.settings.categories.find(c => c.id === session.categoryId);

    try {
      const { data: newSession, error } = await supabase
        .from('pomodoro_sessions')
        .insert({
          user_id: user.id,
          category_id: session.categoryId,
          category_name: category?.name || '',
          duration_minutes: session.duration,
          completed_at: session.completedAt,
          session_date: session.date,
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding session:', error.message);
        return;
      }

      const pomodoroSession: PomodoroSession = {
        id: newSession.id,
        categoryId: newSession.category_id,
        duration: newSession.duration_minutes,
        completedAt: newSession.completed_at,
        date: newSession.session_date,
      };

      setData(prev => ({
        ...prev,
        pomodoro: { ...prev.pomodoro, sessions: [pomodoroSession, ...prev.pomodoro.sessions] },
        lastUpdated: new Date().toISOString(),
      }));
    } catch (e) {
      console.error('Error adding session:', e);
    }
  }, [user, supabase]);

  const updatePomodoroSettings = useCallback(async (settings: PomodoroSettings) => {
    if (!user) return;

    setData(prev => ({
      ...prev,
      pomodoro: { ...prev.pomodoro, settings },
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await supabase.from('pomodoro_settings').upsert({
        user_id: user.id,
        short_break_minutes: settings.intervals.shortBreak,
        long_break_minutes: settings.intervals.longBreak,
        cycles_until_long_break: settings.intervals.cyclesUntilLongBreak,
        updated_at: new Date().toISOString(),
      });

      for (const cat of settings.categories) {
        if (cat.id.startsWith('temp_') || !cat.id.includes('-')) continue;
        await supabase.from('pomodoro_categories').upsert({
          id: cat.id,
          user_id: user.id,
          name: cat.name,
          color: cat.color,
          duration_minutes: cat.duration || 25,
        });
      }
    } catch (e) {
      console.error('Error updating settings:', e);
    }
  }, [user, supabase]);

  const safeData: BlindadosData = {
    ...data,
    pomodoro: {
      ...data.pomodoro,
      settings: {
        categories: data.pomodoro?.settings?.categories || DEFAULT_POMODORO_SETTINGS.categories,
        intervals: {
          shortBreak: data.pomodoro?.settings?.intervals?.shortBreak ?? DEFAULT_POMODORO_SETTINGS.intervals.shortBreak,
          longBreak: data.pomodoro?.settings?.intervals?.longBreak ?? DEFAULT_POMODORO_SETTINGS.intervals.longBreak,
          cyclesUntilLongBreak: data.pomodoro?.settings?.intervals?.cyclesUntilLongBreak ?? DEFAULT_POMODORO_SETTINGS.intervals.cyclesUntilLongBreak,
        },
      },
      sessions: data.pomodoro?.sessions || [],
    },
    kanban: {
      columns: data.kanban?.columns || [],
    },
  };

  return {
    data: safeData,
    isLoaded,
    isSyncing,
    updateKanbanColumns,
    addKanbanColumn,
    deleteKanbanColumn,
    addKanbanCard,
    updateKanbanCard,
    deleteKanbanCard,
    moveCard,
    addPomodoroSession,
    updatePomodoroSettings,
    forceSync: loadFromSupabase,
  };
}
