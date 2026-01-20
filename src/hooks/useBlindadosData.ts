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
  const pendingOperationsRef = useRef(0);
  const lastSyncTimeRef = useRef(0);
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

  const loadData = useCallback(async (force: boolean = false) => {
    if (!user || loadingRef.current) return;
    
    if (!force && pendingOperationsRef.current > 0) {
      console.log('[useBlindadosData] loadData: Skipping - pending operations:', pendingOperationsRef.current);
      return;
    }
    
    const now = Date.now();
    if (!force && now - lastSyncTimeRef.current < 5000) {
      console.log('[useBlindadosData] loadData: Skipping - too soon since last sync');
      return;
    }
    
    const kanbanService = servicesRef.current.kanban;
    const pomodoroService = servicesRef.current.pomodoro;
    
    if (!kanbanService || !pomodoroService) return;
    
    loadingRef.current = true;
    setIsSyncing(true);

    try {
      console.log('[useBlindadosData] loadData: Loading from database...');
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
      lastSyncTimeRef.current = Date.now();
      console.log('[useBlindadosData] loadData: Success - loaded', columns.length, 'columns');
    } catch (e) {
      console.error('[useBlindadosData] loadData error:', e);
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
      const timer = setTimeout(() => loadData(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsLoaded(true);
    }
  }, [user, loadData]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (pendingOperationsRef.current === 0) {
        loadData(false);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [user, loadData]);

  const addKanbanColumn = useCallback(async (title: string) => {
    const kanbanService = servicesRef.current.kanban;
    if (!kanbanService) {
      console.error('[useBlindadosData] addKanbanColumn: service not available');
      return;
    }
    
    const position = dataRef.current.kanban.columns.length;
    const tempId = `temp-col-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticColumn: KanbanColumn = {
      id: tempId,
      title: title.toUpperCase(),
      cards: [],
    };
    
    pendingOperationsRef.current++;
    console.log('[useBlindadosData] addKanbanColumn: Starting - pending ops:', pendingOperationsRef.current);
    
    setData(prev => {
      const updated = {
        ...prev,
        kanban: { columns: [...prev.kanban.columns, optimisticColumn] },
        lastUpdated: new Date().toISOString(),
      };
      setCache(updated);
      return updated;
    });
    
    try {
      const newColumn = await kanbanService.addColumn(title, position);
      
      if (newColumn) {
        console.log('[useBlindadosData] addKanbanColumn: SUCCESS - replacing temp ID with:', newColumn.id);
        setData(prev => {
          const updated = {
            ...prev,
            kanban: { 
              columns: prev.kanban.columns.map(c => 
                c.id === tempId ? newColumn : c
              ) 
            },
            lastUpdated: new Date().toISOString(),
          };
          setCache(updated);
          return updated;
        });
      } else {
        console.error('[useBlindadosData] addKanbanColumn: FAILED - removing optimistic column');
        setData(prev => {
          const updated = {
            ...prev,
            kanban: { columns: prev.kanban.columns.filter(c => c.id !== tempId) },
            lastUpdated: new Date().toISOString(),
          };
          setCache(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error('[useBlindadosData] addKanbanColumn error:', e);
      setData(prev => {
        const updated = {
          ...prev,
          kanban: { columns: prev.kanban.columns.filter(c => c.id !== tempId) },
          lastUpdated: new Date().toISOString(),
        };
        setCache(updated);
        return updated;
      });
    } finally {
      pendingOperationsRef.current--;
      console.log('[useBlindadosData] addKanbanColumn: Done - pending ops:', pendingOperationsRef.current);
    }
  }, []);

  const deleteKanbanColumn = useCallback(async (columnId: string) => {
    const kanbanService = servicesRef.current.kanban;
    if (!kanbanService) return;
    
    const previousColumns = dataRef.current.kanban.columns;
    
    pendingOperationsRef.current++;
    
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
      const success = await kanbanService.deleteColumn(columnId);
      if (!success) {
        console.error('[useBlindadosData] deleteKanbanColumn: FAILED - restoring column');
        setData(prev => {
          const updated = { ...prev, kanban: { columns: previousColumns }, lastUpdated: new Date().toISOString() };
          setCache(updated);
          return updated;
        });
      } else {
        console.log('[useBlindadosData] deleteKanbanColumn: SUCCESS');
      }
    } catch (e) {
      console.error('[useBlindadosData] deleteKanbanColumn error:', e);
      setData(prev => {
        const updated = { ...prev, kanban: { columns: previousColumns }, lastUpdated: new Date().toISOString() };
        setCache(updated);
        return updated;
      });
    } finally {
      pendingOperationsRef.current--;
    }
  }, []);

  const addKanbanCard = useCallback(async (columnId: string, card: Omit<KanbanCard, 'id' | 'createdAt' | 'updatedAt'>) => {
    console.log('[useBlindadosData] addKanbanCard: Starting', { columnId, title: card.title });
    
    if (columnId.startsWith('temp-')) {
      console.error('[useBlindadosData] addKanbanCard: Cannot add card to temporary column');
      return;
    }
    
    const column = dataRef.current.kanban.columns.find(c => c.id === columnId);
    if (!column) {
      console.error('[useBlindadosData] addKanbanCard: column not found:', columnId);
      return;
    }
    
    const position = column.cards.length;
    const now = new Date().toISOString();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticCard: KanbanCard = {
      id: tempId,
      title: card.title,
      description: card.description || '',
      priority: card.priority || 'media',
      tags: card.tags || [],
      subtasks: card.subtasks || [],
      createdAt: now,
      updatedAt: now,
    };
    
    pendingOperationsRef.current++;
    console.log('[useBlindadosData] addKanbanCard: Pending ops:', pendingOperationsRef.current);
    
    setData(prev => {
      const updated = {
        ...prev,
        kanban: {
          columns: prev.kanban.columns.map(c =>
            c.id === columnId ? { ...c, cards: [...c.cards, optimisticCard] } : c
          ),
        },
        lastUpdated: now,
      };
      setCache(updated);
      return updated;
    });
    
    console.log('[useBlindadosData] addKanbanCard: Using API route for robust persistence...');
    
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log('[useBlindadosData] addKanbanCard: Attempt', attempt, 'of', MAX_RETRIES);
        
        const res = await fetch('/api/kanban/add-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            columnId,
            title: card.title,
            description: card.description || '',
            priority: card.priority || 'media',
            tags: card.tags || [],
            subtasks: card.subtasks || [],
            position,
          }),
        });
        
        if (res.ok) {
          const result = await res.json();
          
          if (result.success && result.card) {
            console.log('[useBlindadosData] addKanbanCard: SUCCESS on attempt', attempt, '- Card ID:', result.card.id);
            
            setData(prev => {
              const updated = {
                ...prev,
                kanban: {
                  columns: prev.kanban.columns.map(c =>
                    c.id === columnId 
                      ? { ...c, cards: c.cards.map(existingCard => 
                          existingCard.id === tempId ? result.card : existingCard
                        )}
                      : c
                  ),
                },
                lastUpdated: new Date().toISOString(),
              };
              setCache(updated);
              return updated;
            });
            
            pendingOperationsRef.current--;
            console.log('[useBlindadosData] addKanbanCard: Completed - Pending ops:', pendingOperationsRef.current);
            return;
          }
        }
        
        const errorData = await res.json().catch(() => ({}));
        lastError = new Error(`HTTP ${res.status}: ${errorData.error || 'Unknown error'}`);
        console.warn('[useBlindadosData] addKanbanCard: Attempt', attempt, 'failed:', lastError.message);
        
      } catch (e) {
        lastError = e as Error;
        console.warn('[useBlindadosData] addKanbanCard: Attempt', attempt, 'error:', e);
      }
      
      if (attempt < MAX_RETRIES) {
        const delay = 500 * Math.pow(2, attempt - 1);
        console.log('[useBlindadosData] addKanbanCard: Waiting', delay, 'ms before retry...');
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.error('[useBlindadosData] addKanbanCard: All retries failed:', lastError);
    
    setData(prev => {
      const updated = {
        ...prev,
        kanban: {
          columns: prev.kanban.columns.map(c =>
            c.id === columnId 
              ? { ...c, cards: c.cards.filter(existingCard => existingCard.id !== tempId) }
              : c
          ),
        },
        lastUpdated: new Date().toISOString(),
      };
      setCache(updated);
      return updated;
    });
    
    pendingOperationsRef.current--;
    console.log('[useBlindadosData] addKanbanCard: Failed - Pending ops:', pendingOperationsRef.current);
  }, []);

  const updateKanbanCard = useCallback(async (columnId: string, cardId: string, updates: Partial<KanbanCard>) => {
    const kanbanService = servicesRef.current.kanban;
    if (!kanbanService) return;
    
    if (cardId.startsWith('temp-')) {
      console.log('[useBlindadosData] updateKanbanCard: Skipping temp card');
      return;
    }
    
    const previousColumns = dataRef.current.kanban.columns;
    
    pendingOperationsRef.current++;
    
    setData(prev => {
      const updated = {
        ...prev,
        kanban: {
          columns: prev.kanban.columns.map(c =>
            c.id === columnId
              ? { 
                  ...c, 
                  cards: c.cards.map(card => 
                    card.id === cardId ? { ...card, ...updates, updatedAt: new Date().toISOString() } : card
                  ) 
                }
              : c
          ),
        },
        lastUpdated: new Date().toISOString(),
      };
      setCache(updated);
      return updated;
    });
    
    try {
      const success = await kanbanService.updateCard(cardId, updates);
      if (!success) {
        console.error('[useBlindadosData] updateKanbanCard: FAILED - restoring previous state');
        setData(prev => {
          const updated = { ...prev, kanban: { columns: previousColumns }, lastUpdated: new Date().toISOString() };
          setCache(updated);
          return updated;
        });
      } else {
        console.log('[useBlindadosData] updateKanbanCard: SUCCESS');
      }
    } catch (e) {
      console.error('[useBlindadosData] updateKanbanCard error:', e);
      setData(prev => {
        const updated = { ...prev, kanban: { columns: previousColumns }, lastUpdated: new Date().toISOString() };
        setCache(updated);
        return updated;
      });
    } finally {
      pendingOperationsRef.current--;
    }
  }, []);

  const deleteKanbanCard = useCallback(async (columnId: string, cardId: string) => {
    const kanbanService = servicesRef.current.kanban;
    if (!kanbanService) return;
    
    if (cardId.startsWith('temp-')) {
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
      return;
    }
    
    const previousColumns = dataRef.current.kanban.columns;
    
    pendingOperationsRef.current++;
    
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
      const success = await kanbanService.deleteCard(cardId);
      if (!success) {
        console.error('[useBlindadosData] deleteKanbanCard: FAILED - restoring card');
        setData(prev => {
          const updated = { ...prev, kanban: { columns: previousColumns }, lastUpdated: new Date().toISOString() };
          setCache(updated);
          return updated;
        });
      } else {
        console.log('[useBlindadosData] deleteKanbanCard: SUCCESS');
      }
    } catch (e) {
      console.error('[useBlindadosData] deleteKanbanCard error:', e);
      setData(prev => {
        const updated = { ...prev, kanban: { columns: previousColumns }, lastUpdated: new Date().toISOString() };
        setCache(updated);
        return updated;
      });
    } finally {
      pendingOperationsRef.current--;
    }
  }, []);

  const moveCard = useCallback(async (cardId: string, sourceColId: string, targetColId: string, targetIdx: number) => {
    console.log('[useBlindadosData] moveCard called:', { cardId, sourceColId, targetColId, targetIdx });
    
    if (targetColId.startsWith('temp-')) {
      console.error('[useBlindadosData] moveCard: Cannot move to temporary column');
      return;
    }
    
    if (cardId.startsWith('temp-')) {
      console.error('[useBlindadosData] moveCard: Cannot move temporary card');
      return;
    }
    
    pendingOperationsRef.current++;
    console.log('[useBlindadosData] moveCard: Starting - pending ops:', pendingOperationsRef.current);

    setData(prev => {
      setCache(prev);
      return prev;
    });

    console.log('[useBlindadosData] moveCard: Using API route for atomic persistence...');
    
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch('/api/kanban/move-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cardId, targetColumnId: targetColId, position: targetIdx }),
        });
        
        if (res.ok) {
          const result = await res.json();
          console.log('[useBlindadosData] moveCard: SUCCESS on attempt', attempt, result);
          pendingOperationsRef.current--;
          return;
        }
        
        const errorData = await res.json().catch(() => ({}));
        lastError = new Error(`HTTP ${res.status}: ${errorData.error || 'Unknown error'}`);
        console.warn('[useBlindadosData] moveCard: Attempt', attempt, 'failed:', lastError.message);
        
      } catch (e) {
        lastError = e as Error;
        console.warn('[useBlindadosData] moveCard: Attempt', attempt, 'error:', e);
      }
      
      if (attempt < MAX_RETRIES) {
        const delay = 500 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.error('[useBlindadosData] moveCard: All retries failed:', lastError);
    await loadData(true);
    pendingOperationsRef.current--;
  }, [loadData]);

  const updateKanbanColumn = useCallback(async (columnId: string, updates: { title?: string }) => {
    const kanbanService = servicesRef.current.kanban;
    if (!kanbanService) {
      console.error('[useBlindadosData] updateKanbanColumn: service not available');
      return;
    }
    
    if (columnId.startsWith('temp-')) {
      console.log('[useBlindadosData] updateKanbanColumn: Skipping temp column');
      return;
    }
    
    const previousColumns = dataRef.current.kanban.columns;
    
    pendingOperationsRef.current++;
    
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
        console.error('[useBlindadosData] updateKanbanColumn: FAILED - restoring previous state');
        setData(prev => {
          const updated = { ...prev, kanban: { columns: previousColumns }, lastUpdated: new Date().toISOString() };
          setCache(updated);
          return updated;
        });
      } else {
        console.log('[useBlindadosData] updateKanbanColumn: SUCCESS');
      }
    } catch (e) {
      console.error('[useBlindadosData] updateKanbanColumn error:', e);
      setData(prev => {
        const updated = { ...prev, kanban: { columns: previousColumns }, lastUpdated: new Date().toISOString() };
        setCache(updated);
        return updated;
      });
    } finally {
      pendingOperationsRef.current--;
    }
  }, []);

  const updateKanbanColumns = useCallback(async (columns: KanbanColumn[]) => {
    console.log('[useBlindadosData] updateKanbanColumns called with', columns.length, 'columns');
    
    const kanbanService = servicesRef.current.kanban;
    if (!kanbanService) {
      console.error('[useBlindadosData] updateKanbanColumns: service not available');
      return;
    }
    
    const validColumns = columns.filter(c => !c.id.startsWith('temp-'));
    const hasTemporaryColumns = columns.some(c => c.id.startsWith('temp-'));
    
    if (hasTemporaryColumns) {
      console.log('[useBlindadosData] updateKanbanColumns: Has temporary columns, only updating UI');
      setData(prev => {
        const updated = { ...prev, kanban: { columns }, lastUpdated: new Date().toISOString() };
        setCache(updated);
        return updated;
      });
      return;
    }
    
    const previousColumns = dataRef.current.kanban.columns;
    
    pendingOperationsRef.current++;
    console.log('[useBlindadosData] updateKanbanColumns: Starting - pending ops:', pendingOperationsRef.current);
    
    setData(prev => {
      const updated = { ...prev, kanban: { columns }, lastUpdated: new Date().toISOString() };
      setCache(updated);
      return updated;
    });

    console.log('[useBlindadosData] updateKanbanColumns: Persisting', validColumns.length, 'columns');
    
    try {
      const success = await kanbanService.updateColumnPositions(validColumns.map((c, i) => ({ id: c.id, position: i })));
      console.log('[useBlindadosData] updateKanbanColumns: Persistence result:', success);
      
      if (!success) {
        console.error('[useBlindadosData] updateKanbanColumns: FAILED - restoring previous state');
        setData(prev => {
          const updated = { ...prev, kanban: { columns: previousColumns }, lastUpdated: new Date().toISOString() };
          setCache(updated);
          return updated;
        });
      } else {
        console.log('[useBlindadosData] updateKanbanColumns: SUCCESS');
      }
    } catch (e) {
      console.error('[useBlindadosData] updateKanbanColumns error:', e);
      setData(prev => {
        const updated = { ...prev, kanban: { columns: previousColumns }, lastUpdated: new Date().toISOString() };
        setCache(updated);
        return updated;
      });
    } finally {
      pendingOperationsRef.current--;
      console.log('[useBlindadosData] updateKanbanColumns: Done - pending ops:', pendingOperationsRef.current);
    }
  }, []);

  const updateCardPositions = useCallback(async (columnId: string, cards: KanbanCard[]) => {
    if (columnId.startsWith('temp-')) {
      console.log('[useBlindadosData] updateCardPositions: Skipping - column is temporary');
      return;
    }
    
    const persistableCards = cards.filter(c => !c.id.startsWith('temp-'));
    if (persistableCards.length === 0) {
      console.log('[useBlindadosData] updateCardPositions: No persistable cards');
      return;
    }
    
    pendingOperationsRef.current++;
    console.log('[useBlindadosData] updateCardPositions: Starting - pending ops:', pendingOperationsRef.current);

    setData(prev => {
      setCache(prev);
      return prev;
    });

    console.log('[useBlindadosData] updateCardPositions: Using API route for atomic persistence...');

    const MAX_RETRIES = 3;
    let lastError: Error | null = null;
    const cardPositions = persistableCards.map((c, i) => ({ cardId: c.id, position: i }));
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch('/api/kanban/reorder-cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ columnId, cardPositions }),
        });
        
        if (res.ok) {
          const result = await res.json();
          console.log('[useBlindadosData] updateCardPositions: SUCCESS on attempt', attempt, result);
          pendingOperationsRef.current--;
          return;
        }
        
        const errorData = await res.json().catch(() => ({}));
        lastError = new Error(`HTTP ${res.status}: ${errorData.error || 'Unknown error'}`);
        console.warn('[useBlindadosData] updateCardPositions: Attempt', attempt, 'failed:', lastError.message);
        
      } catch (e) {
        lastError = e as Error;
        console.warn('[useBlindadosData] updateCardPositions: Attempt', attempt, 'error:', e);
      }
      
      if (attempt < MAX_RETRIES) {
        const delay = 500 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.error('[useBlindadosData] updateCardPositions: All retries failed:', lastError);
    await loadData(true);
    pendingOperationsRef.current--;
  }, [loadData]);

  const addPomodoroSession = useCallback(async (session: Omit<PomodoroSession, 'id'>) => {
    const pomodoroService = servicesRef.current.pomodoro;
    if (!pomodoroService) {
      console.error('[useBlindadosData] addPomodoroSession: service not available');
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
      console.error('[useBlindadosData] addPomodoroSession error:', e);
    }
  }, []);

  const updatePomodoroSettings = useCallback(async (settings: PomodoroSettings) => {
    const pomodoroService = servicesRef.current.pomodoro;
    if (!pomodoroService) {
      console.error('[useBlindadosData] updatePomodoroSettings: service not available');
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
      console.error('[useBlindadosData] updatePomodoroSettings error:', e);
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
    updateCardPositions,
    addPomodoroSession,
    updatePomodoroSettings,
    forceSync: () => loadData(true),
  };
}
