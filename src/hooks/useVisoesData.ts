"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  VisoesData, 
  DEFAULT_VISOES_DATA, 
  VisionBoard, 
  GoalAction,
  Note,
} from '@/lib/types/visoes';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/AuthContext';

const VISOES_CACHE_KEY = 'blindy_visoes_cache_v5';
const CACHE_SAVE_INTERVAL = 2000;
const SUPABASE_SYNC_INTERVAL = 30000;

function safeStorage() {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
}

function getCachedData(): VisoesData | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const cached = storage.getItem(VISOES_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch { return null; }
}

function setCachedData(data: VisoesData) {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(VISOES_CACHE_KEY, JSON.stringify(data));
  } catch {}
}

export function useVisoesData() {
  const [data, setData] = useState<VisoesData>(DEFAULT_VISOES_DATA);
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
      setIsLoaded(true);
    }
  }, []);

  const loadFromSupabase = useCallback(async () => {
    if (!user) {
      setIsLoaded(true);
      return;
    }
    
    try {
      setIsSyncing(true);

      const results = await Promise.allSettled([
        supabase.from('vision_boards').select('*').eq('user_id', user.id).order('position'),
        supabase.from('main_goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('goal_actions').select('*').eq('user_id', user.id).order('position'),
        supabase.from('goal_categories').select('*').eq('user_id', user.id).order('position'),
        supabase.from('goals').select('*').eq('user_id', user.id).order('position'),
        supabase.from('books').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('reminders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('notes').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('future_letters').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('bank_accounts').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
      ]);

      const getValue = <T,>(result: PromiseSettledResult<{ data: T | null; error: unknown }>, defaultValue: T): T => {
        if (result.status === 'fulfilled' && result.value.data) {
          return result.value.data;
        }
        return defaultValue;
      };

      const vbData = getValue(results[0], []) as Array<{ id: string; image_url: string; created_at: string }>;
      const mgData = getValue(results[1], []) as Array<{ id: string; text: string; year: number; created_at: string }>;
      const gaData = getValue(results[2], []) as Array<{ id: string; text: string; completed: boolean }>;
      const gcData = getValue(results[3], []) as Array<{ id: string; name: string; icon: string }>;
      const gData = getValue(results[4], []) as Array<{ id: string; text: string; completed: boolean; category_id: string }>;
      const bData = getValue(results[5], []) as Array<{ id: string; title: string; author: string; cover_url: string; progress: number; type: string }>;
      const rData = getValue(results[6], []) as Array<{ id: string; text: string; due_date: string | null; completed: boolean; created_at: string }>;
      const nData = getValue(results[7], []) as Array<{ id: string; title: string; content: string; color: string; created_at: string; updated_at: string }>;
      const flData = getValue(results[8], []) as Array<{ id: string; title: string; content: string; open_date: string; is_opened: boolean; created_at: string }>;
      const baData = getValue(results[9], []) as Array<{ id: string; name: string; type: string; balance: number }>;
      const tData = getValue(results[10], []) as Array<{ id: string; bank_account_id: string; title: string; type: string; amount: number; date: string; status: string }>;
      
      let usData: { finance_start_date?: string; finance_end_date?: string; selected_year?: number } | null = null;
      if (results[11].status === 'fulfilled' && results[11].value.data) {
        usData = results[11].value.data as { finance_start_date?: string; finance_end_date?: string; selected_year?: number };
      }

      const goalsMap = new Map();
      gData.forEach(item => {
        const list = goalsMap.get(item.category_id) || [];
        list.push({ id: item.id, text: item.text, completed: item.completed, categoryId: item.category_id });
        goalsMap.set(item.category_id, list);
      });

      const newData: VisoesData = {
        visionBoard: vbData.map(v => ({ id: v.id, imageUrl: v.image_url, createdAt: v.created_at })),
        mainGoal: mgData[0] ? { id: mgData[0].id, text: mgData[0].text, year: mgData[0].year, createdAt: mgData[0].created_at } : null,
        goalActions: gaData.map(a => ({ id: a.id, text: a.text, completed: a.completed })),
        goalCategories: gcData.map(c => ({ id: c.id, name: c.name, icon: c.icon, goals: goalsMap.get(c.id) || [] })),
        books: bData.map(item => ({ id: item.id, title: item.title, author: item.author, coverUrl: item.cover_url || '', progress: item.progress, type: item.type })),
        reminders: rData.map(item => ({ id: item.id, text: item.text, dueDate: item.due_date, completed: item.completed, createdAt: item.created_at })),
        notes: nData.map(item => ({ id: item.id, title: item.title, content: item.content || '', color: item.color, createdAt: item.created_at, updatedAt: item.updated_at })),
        futureLetters: flData.map(item => ({ id: item.id, title: item.title, content: item.content, openDate: item.open_date, isOpened: item.is_opened, createdAt: item.created_at })),
        bankAccounts: baData.map(item => ({ id: item.id, name: item.name, type: item.type, balance: Number(item.balance) || 0 })),
        transactions: tData.map(item => ({ id: item.id, bankAccountId: item.bank_account_id, title: item.title, type: item.type, amount: Number(item.amount), date: item.date, status: item.status })),
        financePeriod: usData?.finance_start_date ? { startDate: usData.finance_start_date, endDate: usData.finance_end_date || '' } : DEFAULT_VISOES_DATA.financePeriod,
        selectedYear: usData?.selected_year || new Date().getFullYear(),
      };

      setData(newData);
      setCachedData(newData);
    } catch (e) {
      console.error('Sync error:', e);
    } finally {
      setIsLoaded(true);
      setIsSyncing(false);
    }
  }, [user, supabase]);

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
      syncTimerRef.current = setInterval(loadFromSupabase, SUPABASE_SYNC_INTERVAL);
    }
    return () => {
      if (cacheTimerRef.current) clearInterval(cacheTimerRef.current);
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [isMounted, user, loadFromSupabase]);

  const uploadImageToStorage = useCallback(async (imageData: string): Promise<string> => {
    if (!user) return imageData;
    if (!imageData.startsWith('data:')) return imageData;

    try {
      const response = await fetch(imageData);
      const blob = await response.blob();
      const ext = blob.type.split('/')[1] || 'png';
      const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('vision-board')
        .upload(fileName, blob, { contentType: blob.type, upsert: false });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return imageData;
      }

      const { data: publicUrlData } = supabase.storage
        .from('vision-board')
        .getPublicUrl(uploadData.path);

      return publicUrlData.publicUrl;
    } catch (e) {
      console.error('Error uploading image:', e);
      return imageData;
    }
  }, [user, supabase]);

  const addVisionImage = useCallback(async (imageUrl: string) => {
    if (!user) return;

    try {
      const finalUrl = await uploadImageToStorage(imageUrl);
      
      const { data: newImage, error } = await supabase
        .from('vision_boards')
        .insert({
          user_id: user.id,
          image_url: finalUrl,
          position: dataRef.current.visionBoard.length,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving vision board image:', error.message);
        return;
      }

      const visionImage: VisionBoard = {
        id: newImage.id,
        imageUrl: newImage.image_url,
        createdAt: newImage.created_at,
      };

      setData(prev => ({
        ...prev,
        visionBoard: [...prev.visionBoard, visionImage],
      }));
    } catch (e) {
      console.error('Error adding vision image:', e);
    }
  }, [user, supabase, uploadImageToStorage]);

  const removeVisionImage = useCallback(async (id: string) => {
    if (!user) return;

    setData(prev => ({
      ...prev,
      visionBoard: prev.visionBoard.filter(v => v.id !== id),
    }));

    try {
      await supabase.from('vision_boards').delete().eq('id', id).eq('user_id', user.id);
    } catch (e) {
      console.error('Error removing vision image:', e);
    }
  }, [user, supabase]);

  const setMainGoal = useCallback(async (text: string, year: number) => {
    if (!user) return;

    try {
      const { data: existingGoal } = await supabase
        .from('main_goals')
        .select('id')
        .eq('user_id', user.id)
        .eq('year', year)
        .single();

      let newGoal;
      if (existingGoal) {
        const { data, error } = await supabase
          .from('main_goals')
          .update({ text, updated_at: new Date().toISOString() })
          .eq('id', existingGoal.id)
          .select()
          .single();
        if (error) throw error;
        newGoal = data;
      } else {
        const { data, error } = await supabase
          .from('main_goals')
          .insert({ user_id: user.id, text, year })
          .select()
          .single();
        if (error) throw error;
        newGoal = data;
      }

      setData(prev => ({
        ...prev,
        mainGoal: { id: newGoal.id, text: newGoal.text, year: newGoal.year, createdAt: newGoal.created_at },
      }));
    } catch (e) {
      console.error('Error setting main goal:', e);
    }
  }, [user, supabase]);

  const addGoalAction = useCallback(async (text: string) => {
    if (!user) return;

    try {
      const { data: newAction, error } = await supabase
        .from('goal_actions')
        .insert({
          user_id: user.id,
          text,
          completed: false,
          position: dataRef.current.goalActions.length,
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding goal action:', error.message);
        return;
      }

      const goalAction: GoalAction = {
        id: newAction.id,
        text: newAction.text,
        completed: newAction.completed,
      };

      setData(prev => ({
        ...prev,
        goalActions: [...prev.goalActions, goalAction],
      }));
    } catch (e) {
      console.error('Error adding goal action:', e);
    }
  }, [user, supabase]);

  const toggleGoalAction = useCallback(async (id: string) => {
    if (!user) return;

    const action = dataRef.current.goalActions.find(a => a.id === id);
    if (!action) return;

    const newCompleted = !action.completed;

    setData(prev => ({
      ...prev,
      goalActions: prev.goalActions.map(a => 
        a.id === id ? { ...a, completed: newCompleted } : a
      ),
    }));

    try {
      await supabase.from('goal_actions').update({ completed: newCompleted }).eq('id', id).eq('user_id', user.id);
    } catch (e) {
      console.error('Error toggling goal action:', e);
    }
  }, [user, supabase]);

  const addReminder = useCallback(async (text: string, dueDate: string | null) => {
    if (!user) return;

    try {
      const { data: newReminder, error } = await supabase
        .from('reminders')
        .insert({
          user_id: user.id,
          text,
          due_date: dueDate,
          completed: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding reminder:', error.message);
        return;
      }

      setData(prev => ({
        ...prev,
        reminders: [
          { id: newReminder.id, text: newReminder.text, dueDate: newReminder.due_date, completed: newReminder.completed, createdAt: newReminder.created_at },
          ...prev.reminders
        ],
      }));
    } catch (e) {
      console.error('Error adding reminder:', e);
    }
  }, [user, supabase]);

  const toggleReminder = useCallback(async (id: string) => {
    if (!user) return;

    const reminder = dataRef.current.reminders.find(r => r.id === id);
    if (!reminder) return;

    const newCompleted = !reminder.completed;

    setData(prev => ({
      ...prev,
      reminders: prev.reminders.map(r => 
        r.id === id ? { ...r, completed: newCompleted } : r
      ),
    }));

    try {
      await supabase.from('reminders').update({ completed: newCompleted }).eq('id', id).eq('user_id', user.id);
    } catch (e) {
      console.error('Error toggling reminder:', e);
    }
  }, [user, supabase]);

  const addNote = useCallback(async (title: string, content: string, color: string) => {
    if (!user) return;

    try {
      const { data: newNote, error } = await supabase
        .from('notes')
        .insert({ user_id: user.id, title, content, color })
        .select()
        .single();

      if (error) {
        console.error('Error adding note:', error.message);
        return;
      }

      const note: Note = {
        id: newNote.id,
        title: newNote.title,
        content: newNote.content || '',
        color: newNote.color,
        createdAt: newNote.created_at,
        updatedAt: newNote.updated_at,
      };

      setData(prev => ({
        ...prev,
        notes: [note, ...prev.notes],
      }));
    } catch (e) {
      console.error('Error adding note:', e);
    }
  }, [user, supabase]);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    if (!user) return;

    setData(prev => ({
      ...prev,
      notes: prev.notes.map(n => 
        n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
      ),
    }));

    try {
      const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.content !== undefined) dbUpdates.content = updates.content;
      if (updates.color !== undefined) dbUpdates.color = updates.color;

      await supabase.from('notes').update(dbUpdates).eq('id', id).eq('user_id', user.id);
    } catch (e) {
      console.error('Error updating note:', e);
    }
  }, [user, supabase]);

  const removeNote = useCallback(async (id: string) => {
    if (!user) return;

    setData(prev => ({
      ...prev,
      notes: prev.notes.filter(n => n.id !== id),
    }));

    try {
      await supabase.from('notes').delete().eq('id', id).eq('user_id', user.id);
    } catch (e) {
      console.error('Error removing note:', e);
    }
  }, [user, supabase]);

  return {
    data,
    isLoaded,
    isSyncing,
    addVisionImage,
    removeVisionImage,
    setMainGoal,
    addGoalAction,
    toggleGoalAction,
    addReminder,
    toggleReminder,
    addNote,
    updateNote,
    removeNote,
    forceSync: loadFromSupabase,
  };
}
