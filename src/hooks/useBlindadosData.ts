"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { BlindadosData, DEFAULT_DATA, KanbanColumn, KanbanCard, PomodoroSession, PomodoroSettings, PomodoroCategory, DEFAULT_POMODORO_SETTINGS } from '@/lib/types/blindados';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/AuthContext';

const SYNC_INTERVAL = 30000;
const BLINDADOS_CACHE_KEY = 'blindy_data_cache_v2';
const PAUSED_SESSION_KEY = 'blindy_paused_session_v1';

interface PausedSessionData {
  categoryId: string;
  elapsedSeconds: number;
  date: string;
  timestamp: number;
}

function getCachedData(): BlindadosData | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(BLINDADOS_CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as BlindadosData;
    if (!parsed.pomodoro?.settings?.intervals) {
      parsed.pomodoro = {
        ...parsed.pomodoro,
        settings: {
          ...parsed.pomodoro?.settings,
          categories: parsed.pomodoro?.settings?.categories || DEFAULT_POMODORO_SETTINGS.categories,
          intervals: DEFAULT_POMODORO_SETTINGS.intervals,
        },
      };
    }
    return parsed;
  } catch {
    return null;
  }
}

function setCachedData(data: BlindadosData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BLINDADOS_CACHE_KEY, JSON.stringify(data));
  } catch {}
}

function getPausedSession(): PausedSessionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const paused = localStorage.getItem(PAUSED_SESSION_KEY);
    if (!paused) return null;
    return JSON.parse(paused);
  } catch {
    return null;
  }
}

function setPausedSession(data: PausedSessionData | null) {
  if (typeof window === 'undefined') return;
  try {
    if (data) {
      localStorage.setItem(PAUSED_SESSION_KEY, JSON.stringify(data));
    } else {
      localStorage.removeItem(PAUSED_SESSION_KEY);
    }
  } catch {}
}

export function useBlindadosData() {
  const [data, setData] = useState<BlindadosData>(DEFAULT_DATA);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [pausedSession, setPausedSessionState] = useState<PausedSessionData | null>(null);
  const { user } = useAuth();
  const supabase = createClient();
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<string>(new Date().toISOString());
  const initRef = useRef(false);
  const dataRef = useRef(data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    setIsMounted(true);
    const cached = getCachedData();
    if (cached) {
      setData(cached);
      setIsLoaded(true);
    }
    const paused = getPausedSession();
    if (paused) {
      setPausedSessionState(paused);
    }
  }, []);

  const loadFromSupabase = useCallback(async () => {
    if (!user) {
      setIsLoaded(true);
      return;
    }

    try {
      setIsSyncing(true);
      const [
        categoriesRes,
        sessionsRes,
        settingsRes,
        columnsRes,
        cardsRes,
      ] = await Promise.all([
        supabase.from('pomodoro_categories').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('pomodoro_sessions').select('*').eq('user_id', user.id).order('completed_at', { ascending: false }),
        supabase.from('pomodoro_settings').select('*').eq('user_id', user.id).single(),
        supabase.from('kanban_columns').select('*').eq('user_id', user.id).order('position'),
        supabase.from('kanban_cards').select('*').eq('user_id', user.id).order('position'),
      ]);

      const categories: PomodoroCategory[] = (categoriesRes.data || []).map(cat => ({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        duration: cat.duration_minutes,
      }));

      const sessions: PomodoroSession[] = (sessionsRes.data || []).map(s => ({
        id: s.id,
        categoryId: s.category_id || '',
        duration: s.duration_minutes,
        completedAt: s.completed_at,
        date: s.session_date,
      }));

      const settings: PomodoroSettings = {
        categories: categories.length > 0 ? categories : DEFAULT_POMODORO_SETTINGS.categories,
        intervals: {
          shortBreak: settingsRes.data?.short_break_minutes ?? DEFAULT_POMODORO_SETTINGS.intervals.shortBreak,
          longBreak: settingsRes.data?.long_break_minutes ?? DEFAULT_POMODORO_SETTINGS.intervals.longBreak,
          cyclesUntilLongBreak: settingsRes.data?.cycles_until_long_break ?? DEFAULT_POMODORO_SETTINGS.intervals.cyclesUntilLongBreak,
        },
      };

      const cardsMap = new Map<string, KanbanCard[]>();
      (cardsRes.data || []).forEach(card => {
        const cards = cardsMap.get(card.column_id) || [];
        cards.push({
          id: card.id,
          title: card.title,
          description: card.description || '',
          priority: card.priority as 'alta' | 'media' | 'baixa',
          tags: card.tags || [],
          subtasks: card.subtasks || [],
          createdAt: card.created_at,
          updatedAt: card.updated_at,
        });
        cardsMap.set(card.column_id, cards);
      });

      const columns: KanbanColumn[] = (columnsRes.data || []).map(col => ({
        id: col.id,
        title: col.title,
        cards: cardsMap.get(col.id) || [],
      }));

      const newData: BlindadosData = {
        pomodoro: { sessions, settings },
        kanban: { columns: columns.length > 0 ? columns : DEFAULT_DATA.kanban.columns },
        lastUpdated: new Date().toISOString(),
      };

      setData(newData);
      setCachedData(newData);
      lastSyncRef.current = new Date().toISOString();
    } catch (error) {
      console.error('Error loading data from Supabase:', error);
    } finally {
      setIsLoaded(true);
      setIsSyncing(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (!isMounted || initRef.current) return;
    initRef.current = true;
    loadFromSupabase();
  }, [isMounted, loadFromSupabase]);

  useEffect(() => {
    if (!user || !isMounted) return;

    syncIntervalRef.current = setInterval(() => {
      loadFromSupabase();
    }, SYNC_INTERVAL);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [user, isMounted, loadFromSupabase]);

  useEffect(() => {
    if (!user || !isMounted) return;

    const channel = supabase
      .channel('db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pomodoro_sessions', filter: `user_id=eq.${user.id}` },
        () => loadFromSupabase()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kanban_cards', filter: `user_id=eq.${user.id}` },
        () => loadFromSupabase()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kanban_columns', filter: `user_id=eq.${user.id}` },
        () => loadFromSupabase()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, isMounted, loadFromSupabase]);

  const updateData = useCallback((updater: (prev: BlindadosData) => BlindadosData) => {
    setData(prev => {
      const newData = updater(prev);
      setCachedData(newData);
      return newData;
    });
  }, []);

  const updateKanbanColumns = useCallback(async (columns: KanbanColumn[]) => {
    if (!user) return;

    updateData(prev => ({
      ...prev,
      kanban: { columns },
      lastUpdated: new Date().toISOString(),
    }));

    try {
      for (let i = 0; i < columns.length; i++) {
        await supabase
          .from('kanban_columns')
          .update({ position: i, title: columns[i].title })
          .eq('id', columns[i].id)
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Error updating kanban columns:', error);
    }
  }, [user, supabase, updateData]);

  const addKanbanColumn = useCallback(async (title: string) => {
    if (!user) return;

    const tempId = `temp_col_${Date.now()}`;
    const newColumn: KanbanColumn = { id: tempId, title: title.toUpperCase(), cards: [] };
    
    updateData(prev => ({
      ...prev,
      kanban: { columns: [...prev.kanban.columns, newColumn] },
      lastUpdated: new Date().toISOString(),
    }));

    try {
      const { data: newCol, error } = await supabase
        .from('kanban_columns')
        .insert({
          user_id: user.id,
          title: title.toUpperCase(),
          position: dataRef.current.kanban.columns.length,
        })
        .select()
        .single();

      if (!error && newCol) {
        updateData(prev => ({
          ...prev,
          kanban: {
            columns: prev.kanban.columns.map(col =>
              col.id === tempId ? { ...col, id: newCol.id } : col
            ),
          },
          lastUpdated: new Date().toISOString(),
        }));
      } else {
        console.error('Error creating column:', error);
        updateData(prev => ({
          ...prev,
          kanban: { columns: prev.kanban.columns.filter(col => col.id !== tempId) },
          lastUpdated: new Date().toISOString(),
        }));
      }
    } catch (error) {
      console.error('Error adding kanban column:', error);
      updateData(prev => ({
        ...prev,
        kanban: { columns: prev.kanban.columns.filter(col => col.id !== tempId) },
        lastUpdated: new Date().toISOString(),
      }));
    }
  }, [user, supabase, updateData]);

  const deleteKanbanColumn = useCallback(async (columnId: string) => {
    if (!user) return;

    const columnBackup = dataRef.current.kanban.columns.find(c => c.id === columnId);
    
    updateData(prev => ({
      ...prev,
      kanban: { columns: prev.kanban.columns.filter(c => c.id !== columnId) },
      lastUpdated: new Date().toISOString(),
    }));

    try {
      const { error } = await supabase.from('kanban_columns').delete().eq('id', columnId).eq('user_id', user.id);
      if (error) {
        console.error('Error deleting column:', error);
        if (columnBackup) {
          updateData(prev => ({
            ...prev,
            kanban: { columns: [...prev.kanban.columns, columnBackup] },
            lastUpdated: new Date().toISOString(),
          }));
        }
      }
    } catch (error) {
      console.error('Error deleting kanban column:', error);
    }
  }, [user, supabase, updateData]);

  const addKanbanCard = useCallback(async (columnId: string, card: Omit<KanbanCard, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;

    const tempId = `temp_card_${Date.now()}`;
    const tempCard: KanbanCard = {
      ...card,
      id: tempId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    updateData(prev => ({
      ...prev,
      kanban: {
        columns: prev.kanban.columns.map(col =>
          col.id === columnId ? { ...col, cards: [...col.cards, tempCard] } : col
        ),
      },
      lastUpdated: new Date().toISOString(),
    }));

    try {
      const column = dataRef.current.kanban.columns.find(c => c.id === columnId);
      const position = column?.cards.length || 0;

      const { data: newCardData, error } = await supabase
        .from('kanban_cards')
        .insert({
          user_id: user.id,
          column_id: columnId,
          title: card.title,
          description: card.description || '',
          priority: card.priority,
          tags: card.tags || [],
          subtasks: card.subtasks || [],
          position,
        })
        .select()
        .single();

      if (!error && newCardData) {
        const newCard: KanbanCard = {
          id: newCardData.id,
          title: newCardData.title,
          description: newCardData.description || '',
          priority: newCardData.priority as 'alta' | 'media' | 'baixa',
          tags: newCardData.tags || [],
          subtasks: newCardData.subtasks || [],
          createdAt: newCardData.created_at,
          updatedAt: newCardData.updated_at,
        };

        updateData(prev => ({
          ...prev,
          kanban: {
            columns: prev.kanban.columns.map(col =>
              col.id === columnId
                ? { ...col, cards: col.cards.map(c => c.id === tempId ? newCard : c) }
                : col
            ),
          },
          lastUpdated: new Date().toISOString(),
        }));
      } else {
        console.error('Error creating card:', error);
        updateData(prev => ({
          ...prev,
          kanban: {
            columns: prev.kanban.columns.map(col =>
              col.id === columnId
                ? { ...col, cards: col.cards.filter(c => c.id !== tempId) }
                : col
            ),
          },
          lastUpdated: new Date().toISOString(),
        }));
      }
    } catch (error) {
      console.error('Error adding kanban card:', error);
      updateData(prev => ({
        ...prev,
        kanban: {
          columns: prev.kanban.columns.map(col =>
            col.id === columnId
              ? { ...col, cards: col.cards.filter(c => c.id !== tempId) }
              : col
          ),
        },
        lastUpdated: new Date().toISOString(),
      }));
    }
  }, [user, supabase, updateData]);

  const updateKanbanCard = useCallback(async (columnId: string, cardId: string, updates: Partial<KanbanCard>) => {
    if (!user) return;

    updateData(prev => ({
      ...prev,
      kanban: {
        columns: prev.kanban.columns.map(col =>
          col.id === columnId
            ? {
                ...col,
                cards: col.cards.map(card =>
                  card.id === cardId ? { ...card, ...updates, updatedAt: new Date().toISOString() } : card
                ),
              }
            : col
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
    } catch (error) {
      console.error('Error updating kanban card:', error);
    }
  }, [user, supabase, updateData]);

  const deleteKanbanCard = useCallback(async (columnId: string, cardId: string) => {
    if (!user) return;

    updateData(prev => ({
      ...prev,
      kanban: {
        columns: prev.kanban.columns.map(col =>
          col.id === columnId ? { ...col, cards: col.cards.filter(c => c.id !== cardId) } : col
        ),
      },
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await supabase.from('kanban_cards').delete().eq('id', cardId).eq('user_id', user.id);
    } catch (error) {
      console.error('Error deleting kanban card:', error);
    }
  }, [user, supabase, updateData]);

  const moveCard = useCallback(async (cardId: string, sourceColumnId: string, targetColumnId: string, targetIndex: number) => {
    if (!user) return;

    const sourceColumn = dataRef.current.kanban.columns.find(c => c.id === sourceColumnId);
    const card = sourceColumn?.cards.find(c => c.id === cardId);
    if (!card) return;

    updateData(prev => {
      const updatedColumns = prev.kanban.columns.map(col => {
        if (col.id === sourceColumnId) return { ...col, cards: col.cards.filter(c => c.id !== cardId) };
        if (col.id === targetColumnId) {
          const newCards = [...col.cards];
          newCards.splice(targetIndex, 0, card);
          return { ...col, cards: newCards };
        }
        return col;
      });
      return { ...prev, kanban: { columns: updatedColumns }, lastUpdated: new Date().toISOString() };
    });

    try {
      await supabase.from('kanban_cards').update({ column_id: targetColumnId, position: targetIndex }).eq('id', cardId).eq('user_id', user.id);
    } catch (error) {
      console.error('Error moving card:', error);
    }
  }, [user, supabase, updateData]);

  const addPomodoroSession = useCallback(async (session: Omit<PomodoroSession, 'id'>) => {
    if (!user) return;

    const tempId = `temp_session_${Date.now()}`;
    const tempSession: PomodoroSession = { ...session, id: tempId };

    updateData(prev => ({
      ...prev,
      pomodoro: { ...prev.pomodoro, sessions: [tempSession, ...prev.pomodoro.sessions] },
      lastUpdated: new Date().toISOString(),
    }));

    setPausedSession(null);
    setPausedSessionState(null);

    try {
      const category = dataRef.current.pomodoro.settings.categories.find(c => c.id === session.categoryId);

      const { data: newSessionData, error } = await supabase
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

      if (!error && newSessionData) {
        const newSession: PomodoroSession = {
          id: newSessionData.id,
          categoryId: newSessionData.category_id,
          duration: newSessionData.duration_minutes,
          completedAt: newSessionData.completed_at,
          date: newSessionData.session_date,
        };

        updateData(prev => ({
          ...prev,
          pomodoro: {
            ...prev.pomodoro,
            sessions: prev.pomodoro.sessions.map(s => s.id === tempId ? newSession : s),
          },
          lastUpdated: new Date().toISOString(),
        }));
      }
    } catch (error) {
      console.error('Error adding pomodoro session:', error);
    }
  }, [user, supabase, updateData]);

  const savePausedSessionData = useCallback((categoryId: string, elapsedSeconds: number, date: string) => {
    const pausedData: PausedSessionData = {
      categoryId,
      elapsedSeconds,
      date,
      timestamp: Date.now(),
    };
    setPausedSession(pausedData);
    setPausedSessionState(pausedData);
  }, []);

  const clearPausedSession = useCallback(() => {
    setPausedSession(null);
    setPausedSessionState(null);
  }, []);

  const updatePomodoroSettings = useCallback(async (settings: PomodoroSettings) => {
    if (!user) return;

    const safeSettings: PomodoroSettings = {
      categories: settings.categories || DEFAULT_POMODORO_SETTINGS.categories,
      intervals: {
        shortBreak: settings.intervals?.shortBreak ?? DEFAULT_POMODORO_SETTINGS.intervals.shortBreak,
        longBreak: settings.intervals?.longBreak ?? DEFAULT_POMODORO_SETTINGS.intervals.longBreak,
        cyclesUntilLongBreak: settings.intervals?.cyclesUntilLongBreak ?? DEFAULT_POMODORO_SETTINGS.intervals.cyclesUntilLongBreak,
      },
    };

    updateData(prev => ({
      ...prev,
      pomodoro: { ...prev.pomodoro, settings: safeSettings },
      lastUpdated: new Date().toISOString(),
    }));

    try {
      await supabase
        .from('pomodoro_settings')
        .update({
          short_break_minutes: safeSettings.intervals.shortBreak,
          long_break_minutes: safeSettings.intervals.longBreak,
          cycles_until_long_break: safeSettings.intervals.cyclesUntilLongBreak,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      const existingCategoryIds = dataRef.current.pomodoro.settings.categories.map(c => c.id);

      for (const cat of safeSettings.categories) {
        if (existingCategoryIds.includes(cat.id)) {
          await supabase
            .from('pomodoro_categories')
            .update({ name: cat.name, color: cat.color, duration_minutes: cat.duration || 25 })
            .eq('id', cat.id)
            .eq('user_id', user.id);
        } else {
          const { data: newCat } = await supabase
            .from('pomodoro_categories')
            .insert({ user_id: user.id, name: cat.name, color: cat.color, duration_minutes: cat.duration || 25 })
            .select()
            .single();
          if (newCat) cat.id = newCat.id;
        }
      }

      const newCategoryIds = safeSettings.categories.map(c => c.id);
      const deletedCategoryIds = existingCategoryIds.filter(id => !newCategoryIds.includes(id));

      for (const id of deletedCategoryIds) {
        await supabase.from('pomodoro_categories').delete().eq('id', id).eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Error updating pomodoro settings:', error);
    }
  }, [user, supabase, updateData]);

  const forceSync = useCallback(async () => {
    await loadFromSupabase();
  }, [loadFromSupabase]);

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
      columns: data.kanban?.columns || DEFAULT_DATA.kanban.columns,
    },
  };

  return {
    data: safeData,
    isLoaded,
    isSyncing,
    lastSync: lastSyncRef.current,
    pausedSession,
    updateKanbanColumns,
    addKanbanColumn,
    deleteKanbanColumn,
    addKanbanCard,
    updateKanbanCard,
    deleteKanbanCard,
    moveCard,
    addPomodoroSession,
    updatePomodoroSettings,
    savePausedSessionData,
    clearPausedSession,
    forceSync,
  };
}
