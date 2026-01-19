"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { VisoesData, DEFAULT_VISOES_DATA, Note } from '@/lib/types/visoes';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/AuthContext';
import { VisoesService } from '@/lib/services/visoesService';

const CACHE_KEY = 'blindy_visoes_v7';

function getCache(): VisoesData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCache(data: VisoesData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {}
}

export function useVisoesData() {
  const [data, setData] = useState<VisoesData>(DEFAULT_VISOES_DATA);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { user } = useAuth();

  const supabase = useMemo(() => createClient(), []);
  
  const dataRef = useRef(data);
  const loadingRef = useRef(false);
  const serviceRef = useRef<VisoesService | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (user) {
      serviceRef.current = new VisoesService(supabase, user.id);
    } else {
      serviceRef.current = null;
    }
  }, [user, supabase]);

  const loadData = useCallback(async () => {
    if (!user || loadingRef.current) return;
    
    const service = serviceRef.current;
    if (!service) return;
    
    loadingRef.current = true;
    setIsSyncing(true);

    try {
      const newData = await service.loadAll();
      setData(newData);
      setCache(newData);
    } catch (e) {
      console.error('Visoes load error:', e);
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

  const addVisionImage = useCallback(async (imageUrl: string) => {
    const service = serviceRef.current;
    if (!service) return;

    try {
      const finalUrl = await service.uploadImage(imageUrl);
      const position = dataRef.current.visionBoard.length;
      const newImage = await service.addVisionImage(finalUrl, position);

      if (newImage) {
        setData(prev => {
          const updated = { ...prev, visionBoard: [...prev.visionBoard, newImage] };
          setCache(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error('addVisionImage error:', e);
    }
  }, []);

  const removeVisionImage = useCallback(async (id: string) => {
    const service = serviceRef.current;
    if (!service) return;

    setData(prev => {
      const updated = { ...prev, visionBoard: prev.visionBoard.filter(v => v.id !== id) };
      setCache(updated);
      return updated;
    });

    try {
      await service.removeVisionImage(id);
    } catch (e) {
      console.error('removeVisionImage error:', e);
    }
  }, []);

  const setMainGoal = useCallback(async (text: string, year: number) => {
    const service = serviceRef.current;
    if (!service) return;

    try {
      const result = await service.setMainGoal(text, year);
      if (result) {
        setData(prev => {
          const updated = { ...prev, mainGoal: result };
          setCache(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error('setMainGoal error:', e);
    }
  }, []);

  const addGoalAction = useCallback(async (text: string) => {
    const service = serviceRef.current;
    if (!service) return;

    try {
      const position = dataRef.current.goalActions.length;
      const newAction = await service.addGoalAction(text, position);

      if (newAction) {
        setData(prev => {
          const updated = { ...prev, goalActions: [...prev.goalActions, newAction] };
          setCache(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error('addGoalAction error:', e);
    }
  }, []);

  const toggleGoalAction = useCallback(async (id: string) => {
    const service = serviceRef.current;
    if (!service) return;

    const action = dataRef.current.goalActions.find(a => a.id === id);
    if (!action) return;

    const newCompleted = !action.completed;

    setData(prev => {
      const updated = {
        ...prev,
        goalActions: prev.goalActions.map(a => a.id === id ? { ...a, completed: newCompleted } : a),
      };
      setCache(updated);
      return updated;
    });

    try {
      await service.toggleGoalAction(id, newCompleted);
    } catch (e) {
      console.error('toggleGoalAction error:', e);
    }
  }, []);

  const deleteGoalAction = useCallback(async (id: string) => {
    const service = serviceRef.current;
    if (!service) return;

    setData(prev => {
      const updated = { ...prev, goalActions: prev.goalActions.filter(a => a.id !== id) };
      setCache(updated);
      return updated;
    });

    try {
      await service.deleteGoalAction(id);
    } catch (e) {
      console.error('deleteGoalAction error:', e);
    }
  }, []);

  const addReminder = useCallback(async (text: string, dueDate: string | null) => {
    const service = serviceRef.current;
    if (!service) return;

    try {
      const newReminder = await service.addReminder(text, dueDate);

      if (newReminder) {
        setData(prev => {
          const updated = { ...prev, reminders: [newReminder, ...prev.reminders] };
          setCache(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error('addReminder error:', e);
    }
  }, []);

  const toggleReminder = useCallback(async (id: string) => {
    const service = serviceRef.current;
    if (!service) return;

    const reminder = dataRef.current.reminders.find(r => r.id === id);
    if (!reminder) return;

    const newCompleted = !reminder.completed;

    setData(prev => {
      const updated = {
        ...prev,
        reminders: prev.reminders.map(r => r.id === id ? { ...r, completed: newCompleted } : r),
      };
      setCache(updated);
      return updated;
    });

    try {
      await service.toggleReminder(id, newCompleted);
    } catch (e) {
      console.error('toggleReminder error:', e);
    }
  }, []);

  const deleteReminder = useCallback(async (id: string) => {
    const service = serviceRef.current;
    if (!service) return;

    setData(prev => {
      const updated = { ...prev, reminders: prev.reminders.filter(r => r.id !== id) };
      setCache(updated);
      return updated;
    });

    try {
      await service.deleteReminder(id);
    } catch (e) {
      console.error('deleteReminder error:', e);
    }
  }, []);

  const addNote = useCallback(async (title: string, content: string, color: string) => {
    const service = serviceRef.current;
    if (!service) return;

    try {
      const newNote = await service.addNote(title, content, color);

      if (newNote) {
        setData(prev => {
          const updated = { ...prev, notes: [newNote, ...prev.notes] };
          setCache(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error('addNote error:', e);
    }
  }, []);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    const service = serviceRef.current;
    if (!service) return;

    setData(prev => {
      const updated = {
        ...prev,
        notes: prev.notes.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n),
      };
      setCache(updated);
      return updated;
    });

    try {
      await service.updateNote(id, updates);
    } catch (e) {
      console.error('updateNote error:', e);
    }
  }, []);

  const removeNote = useCallback(async (id: string) => {
    const service = serviceRef.current;
    if (!service) return;

    setData(prev => {
      const updated = { ...prev, notes: prev.notes.filter(n => n.id !== id) };
      setCache(updated);
      return updated;
    });

    try {
      await service.deleteNote(id);
    } catch (e) {
      console.error('removeNote error:', e);
    }
  }, []);

  return {
    data,
    isLoaded,
    isSyncing,
    addVisionImage,
    removeVisionImage,
    setMainGoal,
    addGoalAction,
    toggleGoalAction,
    deleteGoalAction,
    addReminder,
    toggleReminder,
    deleteReminder,
    addNote,
    updateNote,
    removeNote,
    forceSync: loadData,
  };
}
