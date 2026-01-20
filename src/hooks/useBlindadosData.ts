"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BlindadosData, DEFAULT_DATA, KanbanColumn, KanbanCard, PomodoroSession, PomodoroSettings, DEFAULT_POMODORO_SETTINGS } from '@/lib/types/blindados';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/AuthContext';
import { KanbanService } from '@/lib/services/kanbanService';
import { PomodoroService } from '@/lib/services/pomodoroService';
import { safeStorage } from '@/lib/utils/safeStorage';
import { STORAGE_KEYS } from '@/lib/utils/storage.constants';

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function getCache(): BlindadosData | null {
  const data = safeStorage.get<BlindadosData>(STORAGE_KEYS.DATA_CACHE);
  if (!data?.kanban?.columns) return null;
  const hasValidColumns = data.kanban.columns.every(col => isValidUUID(col.id));
  if (!hasValidColumns) {
    safeStorage.remove(STORAGE_KEYS.DATA_CACHE);
    return null;
  }
  return data;
}

function setCache(data: BlindadosData) {
  safeStorage.set(STORAGE_KEYS.DATA_CACHE, data);
}

export function useBlindadosData() {
  const [data, setData] = useState<BlindadosData>(DEFAULT_DATA);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { user } = useAuth();
  
  const supabase = useMemo(() => createClient(), []);
  
  const dataRef = useRef(data);
  const loadingRef = useRef(false);
  const servicesRef = useRef<{ kanban: KanbanService | null; pomodoro: PomodoroService | null }>({
    kanban: null,
    pomodoro: null,
  });

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (user) {
      servicesRef.current.kanban = new KanbanService(supabase, user.id);
      servicesRef.current.pomodoro = new PomodoroService(supabase, user.id);
    } else {
      servicesRef.current.kanban = null;
      servicesRef.current.pomodoro = null;
    }
  }, [user, supabase]);

  const loadData = useCallback(async () => {
    if (!user || loadingRef.current) return;
    
    const kanbanService = servicesRef.current.kanban;
    const pomodoroService = servicesRef.current.pomodoro;
    
    if (!kanbanService || !pomodoroService) return;
    
    loadingRef.current = true;
    setIsSyncing(true);

    try {
      const [columns, pomodoroData] = await Promise.all([
        kanbanService.loadColumns(),
        pomodoroService.loadData(),
      ]);

      const newData: BlindadosData = {
        pomodoro: pomodoroData,
        kanban: { columns },
        lastUpdated: new Date().toISOString(),
      };

      setData(newData);
      setCache(newData);
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setIsLoaded(true);
      setIsSyncing(false);
      loadingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    const cached = getCache();
    if (cached) {
      setData(cached);
      setIsLoaded(true);
    }
    
    if (user) {
      const timer = setTimeout(loadData, 100);
      return () => clearTimeout(timer);
    } else {
      setIsLoaded(true);
    }
  }, [user, loadData]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [user, loadData]);

  const addKanbanColumn = useCallback(async (title: string) => {
    const kanbanService = servicesRef.current.kanban;
    if (!kanbanService) {
      console.error('addKanbanColumn: service not available');
      return;
    }
    
    const position = dataRef.current.kanban.columns.length;
    
    try {
      const newColumn = await kanbanService.addColumn(title, position);
      
      if (newColumn) {
        setData(prev => {
          const updated = {
            ...prev,
            kanban: { columns: [...prev.kanban.columns, newColumn] },
            lastUpdated: new Date().toISOString(),
          };
          setCache(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error('addKanbanColumn error:', e);
    }
  }, []);

  const deleteKanbanColumn = useCallback(async (columnId: string) => {
    const kanbanService = servicesRef.current.kanban;
    if (!kanbanService) return;
    
    setData(prev => {
      const updated = {
        ...prev,
        kanban: { columns: prev.kanban.columns.filter(c => c.id !== columnId) },
        lastUpdated: new Date().toISOString(),
      };
      setCache(updated);
      return updated;
    });
    
    try {
      await kanbanService.deleteColumn(columnId);
    } catch (e) {
      console.error('deleteKanbanColumn error:', e);
    }
  }, []);

  const addKanbanCard = useCallback(async (columnId: string, card: Omit<KanbanCard, 'id' | 'createdAt' | 'updatedAt'>) => {
    const kanbanService = servicesRef.current.kanban;
    if (!kanbanService) {
      console.error('addKanbanCard: service not available');
      return;
    }
    
    const column = dataRef.current.kanban.columns.find(c => c.id === columnId);
    if (!column) {
      console.error('addKanbanCard: column not found:', columnId);
      return;
    }
    
    const position = column.cards.length;
    
    try {
      const newCard = await kanbanService.addCard(columnId, card, position);
      
      if (newCard) {
        setData(prev => {
          const updated = {
            ...prev,
            kanban: {
              columns: prev.kanban.columns.map(c =>
                c.id === columnId ? { ...c, cards: [...c.cards, newCard] } : c
              ),
            },
            lastUpdated: new Date().toISOString(),
          };
          setCache(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error('addKanbanCard error:', e);
    }
  }, []);

  const updateKanbanCard = useCallback(async (columnId: string, cardId: string, updates: Partial<KanbanCard>) => {
    const kanbanService = servicesRef.current.kanban;
    if (!kanbanService) return;
    
    setData(prev => {
      const updated = {
        ...prev,
        kanban: {
          columns: prev.kanban.columns.map(c =>
            c.id === columnId
              ? { ...c, cards: c.cards.map(card => card.id === cardId ? { ...card, ...updates, updatedAt: new Date().toISOString() } : card) }
              : c
          ),
        },
        lastUpdated: new Date().toISOString(),
      };
      setCache(updated);
      return updated;
    });
    
    try {
      await kanbanService.updateCard(cardId, updates);
    } catch (e) {
      console.error('updateKanbanCard error:', e);
    }
  }, []);

  const deleteKanbanCard = useCallback(async (columnId: string, cardId: string) => {
    const kanbanService = servicesRef.current.kanban;
    if (!kanbanService) return;
    
    setData(prev => {
      const updated = {
        ...prev,
        kanban: {
          columns: prev.kanban.columns.map(c =>
            c.id === columnId ? { ...c, cards: c.cards.filter(card => card.id !== cardId) } : c
          ),
        },
        lastUpdated: new Date().toISOString(),
      };
      setCache(updated);
      return updated;
    });
    
    try {
      await kanbanService.deleteCard(cardId);
    } catch (e) {
      console.error('deleteKanbanCard error:', e);
    }
  }, []);

  const moveCard = useCallback(async (cardId: string, sourceColId: string, targetColId: string, targetIdx: number) => {
    const kanbanService = servicesRef.current.kanban;
    if (!kanbanService) return;
    
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
      const updated = { ...prev, kanban: { columns: newCols }, lastUpdated: new Date().toISOString() };
      setCache(updated);
      return updated;
    });

    try {
      await kanbanService.moveCard(cardId, targetColId, targetIdx);
    } catch (e) {
      console.error('moveCard error:', e);
    }
  }, []);

  const updateKanbanColumn = useCallback(async (columnId: string, updates: { title?: string }) => {
    const kanbanService = servicesRef.current.kanban;
    if (!kanbanService) {
      console.error('updateKanbanColumn: service not available');
      return;
    }
    
    setData(prev => {
      const updated = {
        ...prev,
        kanban: {
          columns: prev.kanban.columns.map(c =>
            c.id === columnId ? { ...c, title: updates.title?.toUpperCase() ?? c.title } : c
          ),
        },
        lastUpdated: new Date().toISOString(),
      };
      setCache(updated);
      return updated;
    });

    try {
      const success = await kanbanService.updateColumn(columnId, updates);
      if (!success) {
        console.error('updateKanbanColumn: failed to persist to database');
      }
    } catch (e) {
      console.error('updateKanbanColumn error:', e);
    }
  }, []);

  const updateKanbanColumns = useCallback(async (columns: KanbanColumn[]) => {
    const kanbanService = servicesRef.current.kanban;
    if (!kanbanService) return;
    
    setData(prev => {
      const updated = { ...prev, kanban: { columns }, lastUpdated: new Date().toISOString() };
      setCache(updated);
      return updated;
    });

    try {
      await kanbanService.updateColumnPositions(columns.map((c, i) => ({ id: c.id, title: c.title, position: i })));
    } catch (e) {
      console.error('updateKanbanColumns error:', e);
    }
  }, []);

  const addPomodoroSession = useCallback(async (session: Omit<PomodoroSession, 'id'>) => {
    const pomodoroService = servicesRef.current.pomodoro;
    if (!pomodoroService) {
      console.error('addPomodoroSession: service not available');
      return;
    }
    
    const category = dataRef.current.pomodoro.settings.categories.find(c => c.id === session.categoryId);
    
    try {
      const newSession = await pomodoroService.addSession(session, category?.name || '');
      
      if (newSession) {
        setData(prev => {
          const updated = {
            ...prev,
            pomodoro: { ...prev.pomodoro, sessions: [newSession, ...prev.pomodoro.sessions] },
            lastUpdated: new Date().toISOString(),
          };
          setCache(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error('addPomodoroSession error:', e);
    }
  }, []);

  const updatePomodoroSettings = useCallback(async (settings: PomodoroSettings) => {
    const pomodoroService = servicesRef.current.pomodoro;
    if (!pomodoroService) {
      console.error('updatePomodoroSettings: service not available');
      return;
    }
    
    setData(prev => {
      const updated = { ...prev, pomodoro: { ...prev.pomodoro, settings }, lastUpdated: new Date().toISOString() };
      setCache(updated);
      return updated;
    });
    
    try {
      await pomodoroService.updateSettings(settings);
    } catch (e) {
      console.error('updatePomodoroSettings error:', e);
    }
  }, []);

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
    kanban: { columns: data.kanban?.columns || [] },
  };

  return {
    data: safeData,
    isLoaded,
    isSyncing,
    updateKanbanColumns,
    updateKanbanColumn,
    addKanbanColumn,
    deleteKanbanColumn,
    addKanbanCard,
    updateKanbanCard,
    deleteKanbanCard,
    moveCard,
    addPomodoroSession,
    updatePomodoroSettings,
    forceSync: loadData,
  };
}
