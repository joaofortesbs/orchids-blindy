"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  VisoesData, 
  DEFAULT_VISOES_DATA, 
  VisionBoard, 
  MainGoal, 
  GoalAction, 
  Goal, 
  Book, 
  Reminder, 
  Note, 
  FutureLetter,
  BankAccount,
  Transaction,
  FinancePeriod,
  GoalCategory
} from '@/lib/types/visoes';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/AuthContext';

const VISOES_CACHE_KEY = 'blindy_visoes_cache_v2';
const VISOES_BACKUP_KEY = 'blindy_visoes_backup_v2';
const VISOES_PENDING_OPS_KEY = 'blindy_visoes_pending_ops_v1';
const CACHE_SAVE_INTERVAL = 1000;
const SUPABASE_SYNC_INTERVAL = 30000;

interface CacheData {
  data: VisoesData;
  timestamp: number;
  userId: string;
}

interface PendingOperation {
  id: string;
  type: 'insert' | 'update' | 'delete';
  table: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

function safeStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadCache(userId: string): VisoesData | null {
  const storage = safeStorage();
  if (!storage) return null;
  
  try {
    const cached = storage.getItem(VISOES_CACHE_KEY);
    if (!cached) return null;
    
    const parsed: CacheData = JSON.parse(cached);
    if (parsed.userId !== userId) return null;
    
    return parsed.data;
  } catch (e) {
    console.warn('Failed to load visoes cache:', e);
    return null;
  }
}

function saveCache(data: VisoesData, userId: string): void {
  const storage = safeStorage();
  if (!storage) return;
  
  try {
    const currentCache = storage.getItem(VISOES_CACHE_KEY);
    if (currentCache) {
      storage.setItem(VISOES_BACKUP_KEY, currentCache);
    }
    
    const cacheData: CacheData = {
      data,
      timestamp: Date.now(),
      userId,
    };
    storage.setItem(VISOES_CACHE_KEY, JSON.stringify(cacheData));
  } catch (e) {
    console.warn('Failed to save visoes cache:', e);
  }
}

function loadPendingOps(): PendingOperation[] {
  const storage = safeStorage();
  if (!storage) return [];
  
  try {
    const ops = storage.getItem(VISOES_PENDING_OPS_KEY);
    return ops ? JSON.parse(ops) : [];
  } catch {
    return [];
  }
}

function savePendingOps(ops: PendingOperation[]): void {
  const storage = safeStorage();
  if (!storage) return;
  
  try {
    storage.setItem(VISOES_PENDING_OPS_KEY, JSON.stringify(ops));
  } catch (e) {
    console.warn('Failed to save pending ops:', e);
  }
}

function addPendingOp(op: Omit<PendingOperation, 'id' | 'timestamp'>): void {
  const ops = loadPendingOps();
  ops.push({
    ...op,
    id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
  });
  savePendingOps(ops);
}

function removePendingOp(opId: string): void {
  const ops = loadPendingOps().filter(op => op.id !== opId);
  savePendingOps(ops);
}

export function useVisoesData() {
  const [data, setData] = useState<VisoesData>(DEFAULT_VISOES_DATA);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { user } = useAuth();
  const supabase = createClient();
  
  const cacheIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dataRef = useRef(data);
  const initRef = useRef(false);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const updateLocalData = useCallback((updater: (prev: VisoesData) => VisoesData) => {
    setData(prev => {
      const newData = updater(prev);
      dataRef.current = newData;
      return newData;
    });
  }, []);

  const processPendingOperations = useCallback(async () => {
    if (!user) return;
    
    const ops = loadPendingOps();
    if (ops.length === 0) return;
    
    for (const op of ops) {
      try {
        switch (op.type) {
          case 'insert':
            await supabase.from(op.table).insert(op.payload);
            break;
          case 'update':
            const { id: updateId, ...updatePayload } = op.payload;
            await supabase.from(op.table).update(updatePayload).eq('id', updateId).eq('user_id', user.id);
            break;
          case 'delete':
            await supabase.from(op.table).delete().eq('id', op.payload.id).eq('user_id', user.id);
            break;
        }
        removePendingOp(op.id);
      } catch (e) {
        console.warn(`Failed to process pending op ${op.id}:`, e);
      }
    }
  }, [user, supabase]);

  const loadFromSupabase = useCallback(async () => {
    if (!user) {
      setIsLoaded(true);
      return;
    }

    try {
      setIsSyncing(true);
      
      await processPendingOperations();

      const [
        visionBoardRes,
        mainGoalRes,
        goalActionsRes,
        goalCategoriesRes,
        goalsRes,
        booksRes,
        remindersRes,
        notesRes,
        futureLettersRes,
        bankAccountsRes,
        transactionsRes,
        userSettingsRes,
      ] = await Promise.all([
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

      const visionBoard: VisionBoard[] = (visionBoardRes.data || []).map(v => ({
        id: v.id,
        imageUrl: v.image_url,
        createdAt: v.created_at,
      }));

      const mainGoalData = mainGoalRes.data?.[0];
      const mainGoal: MainGoal | null = mainGoalData ? {
        id: mainGoalData.id,
        text: mainGoalData.text,
        year: mainGoalData.year,
        createdAt: mainGoalData.created_at,
      } : null;

      const goalActions: GoalAction[] = (goalActionsRes.data || []).map(a => ({
        id: a.id,
        text: a.text,
        completed: a.completed,
      }));

      const goalsMap = new Map<string, Goal[]>();
      (goalsRes.data || []).forEach(g => {
        const goals = goalsMap.get(g.category_id) || [];
        goals.push({
          id: g.id,
          text: g.text,
          completed: g.completed,
          categoryId: g.category_id,
        });
        goalsMap.set(g.category_id, goals);
      });

      const goalCategories: GoalCategory[] = (goalCategoriesRes.data || []).map(c => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        goals: goalsMap.get(c.id) || [],
      }));

      const books: Book[] = (booksRes.data || []).map(b => ({
        id: b.id,
        title: b.title,
        author: b.author,
        coverUrl: b.cover_url || '',
        progress: b.progress,
        type: b.type as 'book' | 'podcast' | 'video' | 'course',
      }));

      const reminders: Reminder[] = (remindersRes.data || []).map(r => ({
        id: r.id,
        text: r.text,
        dueDate: r.due_date,
        completed: r.completed,
        createdAt: r.created_at,
      }));

      const notes: Note[] = (notesRes.data || []).map(n => ({
        id: n.id,
        title: n.title,
        content: n.content || '',
        color: n.color,
        createdAt: n.created_at,
        updatedAt: n.updated_at,
      }));

      const futureLetters: FutureLetter[] = (futureLettersRes.data || []).map(l => ({
        id: l.id,
        title: l.title,
        content: l.content,
        openDate: l.open_date,
        isOpened: l.is_opened,
        createdAt: l.created_at,
      }));

      const bankAccounts: BankAccount[] = (bankAccountsRes.data || []).map(a => ({
        id: a.id,
        name: a.name,
        type: a.type as 'fiduciary' | 'crypto',
        accountType: a.account_type,
        personType: a.person_type,
        balance: Number(a.balance) || 0,
        notes: a.notes || '',
      }));

      const transactions: Transaction[] = (transactionsRes.data || []).map(t => ({
        id: t.id,
        bankAccountId: t.bank_account_id,
        title: t.title,
        type: t.type as 'income' | 'expense',
        category: t.category,
        amount: Number(t.amount),
        date: t.date,
        paymentMethod: t.payment_method as Transaction['paymentMethod'],
        status: t.status as 'pending' | 'confirmed',
        notes: t.notes || '',
      }));

      const settings = userSettingsRes.data;
      const financePeriod: FinancePeriod = settings?.finance_start_date && settings?.finance_end_date ? {
        startDate: settings.finance_start_date,
        endDate: settings.finance_end_date,
      } : DEFAULT_VISOES_DATA.financePeriod;

      const newData: VisoesData = {
        visionBoard,
        mainGoal,
        goalActions,
        goalCategories: goalCategories.length > 0 ? goalCategories : DEFAULT_VISOES_DATA.goalCategories,
        books,
        reminders,
        notes,
        futureLetters,
        bankAccounts,
        transactions,
        financePeriod,
        selectedYear: settings?.selected_year || new Date().getFullYear(),
      };

      setData(newData);
      dataRef.current = newData;
      saveCache(newData, user.id);
    } catch (error) {
      console.error('Error loading Visoes data from Supabase:', error);
    } finally {
      setIsLoaded(true);
      setIsSyncing(false);
    }
  }, [user, supabase, processPendingOperations]);

  useEffect(() => {
    if (!isMounted || initRef.current) return;
    initRef.current = true;
    
    if (user) {
      const cached = loadCache(user.id);
      if (cached) {
        setData(cached);
        dataRef.current = cached;
        setIsLoaded(true);
      }
    }
    
    loadFromSupabase();
  }, [isMounted, user, loadFromSupabase]);

  useEffect(() => {
    if (!user || !isMounted) return;
    
    cacheIntervalRef.current = setInterval(() => {
      saveCache(dataRef.current, user.id);
    }, CACHE_SAVE_INTERVAL);
    
    return () => {
      if (cacheIntervalRef.current) {
        clearInterval(cacheIntervalRef.current);
      }
    };
  }, [user, isMounted]);

  useEffect(() => {
    if (!user || !isMounted) return;
    
    syncIntervalRef.current = setInterval(() => {
      loadFromSupabase();
    }, SUPABASE_SYNC_INTERVAL);
    
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [user, isMounted, loadFromSupabase]);

  useEffect(() => {
    if (!user || !isMounted) return;
    
    const handleBeforeUnload = () => {
      saveCache(dataRef.current, user.id);
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCache(dataRef.current, user.id);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, isMounted]);

  const uploadImageToStorage = useCallback(async (base64Data: string): Promise<string | null> => {
    if (!user) return null;
    
    try {
      const base64Match = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!base64Match) {
        return base64Data;
      }
      
      const imageType = base64Match[1];
      const base64Content = base64Match[2];
      
      const byteCharacters = atob(base64Content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: `image/${imageType}` });
      
      const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${imageType}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('vision-board')
        .upload(fileName, blob, {
          contentType: `image/${imageType}`,
          upsert: false,
        });
      
      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        return base64Data;
      }
      
      const { data: publicUrl } = supabase.storage
        .from('vision-board')
        .getPublicUrl(uploadData.path);
      
      return publicUrl.publicUrl;
    } catch (e) {
      console.error('Error processing image upload:', e);
      return base64Data;
    }
  }, [user, supabase]);

  const addVisionImage = useCallback(async (imageUrl: string) => {
    if (!user) return;

    const tempId = `temp_${Date.now()}`;
    const newImage: VisionBoard = {
      id: tempId,
      imageUrl,
      createdAt: new Date().toISOString(),
    };

    updateLocalData(prev => ({
      ...prev,
      visionBoard: [...prev.visionBoard, newImage],
    }));

    try {
      const finalImageUrl = await uploadImageToStorage(imageUrl);
      
      const { data: newImageData, error } = await supabase
        .from('vision_boards')
        .insert({
          user_id: user.id,
          image_url: finalImageUrl || imageUrl,
          position: data.visionBoard.length,
        })
        .select()
        .single();

      if (!error && newImageData) {
        updateLocalData(prev => ({
          ...prev,
          visionBoard: prev.visionBoard.map(v => 
            v.id === tempId ? { ...v, id: newImageData.id, imageUrl: finalImageUrl || imageUrl } : v
          ),
        }));
      } else {
        console.error('Error saving vision board image:', error);
        addPendingOp({
          type: 'insert',
          table: 'vision_boards',
          payload: { user_id: user.id, image_url: finalImageUrl || imageUrl, position: data.visionBoard.length },
        });
      }
    } catch (e) {
      console.error('Error adding vision image:', e);
    }
  }, [user, supabase, data.visionBoard.length, updateLocalData, uploadImageToStorage]);

  const removeVisionImage = useCallback(async (id: string) => {
    if (!user) return;

    updateLocalData(prev => ({
      ...prev,
      visionBoard: prev.visionBoard.filter(v => v.id !== id),
    }));

    const { error } = await supabase.from('vision_boards').delete().eq('id', id).eq('user_id', user.id);
    
    if (error) {
      addPendingOp({ type: 'delete', table: 'vision_boards', payload: { id } });
    }
  }, [user, supabase, updateLocalData]);

  const resetVisionBoard = useCallback(async () => {
    if (!user) return;

    updateLocalData(prev => ({ ...prev, visionBoard: [] }));
    await supabase.from('vision_boards').delete().eq('user_id', user.id);
  }, [user, supabase, updateLocalData]);

  const setMainGoal = useCallback(async (text: string, year: number) => {
    if (!user) return;

    const tempId = `temp_${Date.now()}`;
    const newGoal: MainGoal = { id: tempId, text, year, createdAt: new Date().toISOString() };

    updateLocalData(prev => ({ ...prev, mainGoal: newGoal }));

    await supabase.from('main_goals').delete().eq('user_id', user.id);

    const { data: newGoalData, error } = await supabase
      .from('main_goals')
      .insert({ user_id: user.id, text, year })
      .select()
      .single();

    if (!error && newGoalData) {
      updateLocalData(prev => ({
        ...prev,
        mainGoal: prev.mainGoal ? { ...prev.mainGoal, id: newGoalData.id } : null,
      }));
    }
  }, [user, supabase, updateLocalData]);

  const addGoalAction = useCallback(async (text: string) => {
    if (!user) return;

    const tempId = `temp_${Date.now()}`;
    const newAction: GoalAction = { id: tempId, text, completed: false };

    updateLocalData(prev => ({
      ...prev,
      goalActions: [...prev.goalActions, newAction],
    }));

    const { data: newActionData, error } = await supabase
      .from('goal_actions')
      .insert({
        user_id: user.id,
        text,
        completed: false,
        position: data.goalActions.length,
      })
      .select()
      .single();

    if (!error && newActionData) {
      updateLocalData(prev => ({
        ...prev,
        goalActions: prev.goalActions.map(a => 
          a.id === tempId ? { ...a, id: newActionData.id } : a
        ),
      }));
    }
  }, [user, supabase, data.goalActions.length, updateLocalData]);

  const toggleGoalAction = useCallback(async (id: string) => {
    if (!user) return;

    const action = data.goalActions.find(a => a.id === id);
    if (!action) return;

    updateLocalData(prev => ({
      ...prev,
      goalActions: prev.goalActions.map(a =>
        a.id === id ? { ...a, completed: !a.completed } : a
      ),
    }));

    await supabase.from('goal_actions').update({ completed: !action.completed }).eq('id', id).eq('user_id', user.id);
  }, [user, supabase, data.goalActions, updateLocalData]);

  const removeGoalAction = useCallback(async (id: string) => {
    if (!user) return;

    updateLocalData(prev => ({
      ...prev,
      goalActions: prev.goalActions.filter(a => a.id !== id),
    }));

    await supabase.from('goal_actions').delete().eq('id', id).eq('user_id', user.id);
  }, [user, supabase, updateLocalData]);

  const addGoalToCategory = useCallback(async (categoryId: string, text: string) => {
    if (!user) return;

    const tempId = `temp_${Date.now()}`;
    const newGoal: Goal = { id: tempId, text, completed: false, categoryId };

    updateLocalData(prev => ({
      ...prev,
      goalCategories: prev.goalCategories.map(cat =>
        cat.id === categoryId ? { ...cat, goals: [...cat.goals, newGoal] } : cat
      ),
    }));

    const category = data.goalCategories.find(c => c.id === categoryId);
    const position = category?.goals.length || 0;

    const { data: newGoalData, error } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        category_id: categoryId,
        text,
        completed: false,
        position,
      })
      .select()
      .single();

    if (!error && newGoalData) {
      updateLocalData(prev => ({
        ...prev,
        goalCategories: prev.goalCategories.map(cat =>
          cat.id === categoryId
            ? { ...cat, goals: cat.goals.map(g => g.id === tempId ? { ...g, id: newGoalData.id } : g) }
            : cat
        ),
      }));
    }
  }, [user, supabase, data.goalCategories, updateLocalData]);

  const toggleGoalInCategory = useCallback(async (categoryId: string, goalId: string) => {
    if (!user) return;

    const category = data.goalCategories.find(c => c.id === categoryId);
    const goal = category?.goals.find(g => g.id === goalId);
    if (!goal) return;

    updateLocalData(prev => ({
      ...prev,
      goalCategories: prev.goalCategories.map(cat =>
        cat.id === categoryId
          ? { ...cat, goals: cat.goals.map(g => g.id === goalId ? { ...g, completed: !g.completed } : g) }
          : cat
      ),
    }));

    await supabase.from('goals').update({ completed: !goal.completed }).eq('id', goalId).eq('user_id', user.id);
  }, [user, supabase, data.goalCategories, updateLocalData]);

  const removeGoalFromCategory = useCallback(async (categoryId: string, goalId: string) => {
    if (!user) return;

    updateLocalData(prev => ({
      ...prev,
      goalCategories: prev.goalCategories.map(cat =>
        cat.id === categoryId ? { ...cat, goals: cat.goals.filter(g => g.id !== goalId) } : cat
      ),
    }));

    await supabase.from('goals').delete().eq('id', goalId).eq('user_id', user.id);
  }, [user, supabase, updateLocalData]);

  const addBook = useCallback(async (book: Omit<Book, 'id'>) => {
    if (!user) return;

    const tempId = `temp_${Date.now()}`;
    const newBook: Book = { ...book, id: tempId };

    updateLocalData(prev => ({ ...prev, books: [newBook, ...prev.books] }));

    const { data: newBookData, error } = await supabase
      .from('books')
      .insert({
        user_id: user.id,
        title: book.title,
        author: book.author,
        cover_url: book.coverUrl,
        progress: book.progress,
        type: book.type,
      })
      .select()
      .single();

    if (!error && newBookData) {
      updateLocalData(prev => ({
        ...prev,
        books: prev.books.map(b => b.id === tempId ? { ...b, id: newBookData.id } : b),
      }));
    }
  }, [user, supabase, updateLocalData]);

  const updateBookProgress = useCallback(async (id: string, progress: number) => {
    if (!user) return;

    updateLocalData(prev => ({
      ...prev,
      books: prev.books.map(b => b.id === id ? { ...b, progress } : b),
    }));

    await supabase.from('books').update({ progress }).eq('id', id).eq('user_id', user.id);
  }, [user, supabase, updateLocalData]);

  const removeBook = useCallback(async (id: string) => {
    if (!user) return;

    updateLocalData(prev => ({ ...prev, books: prev.books.filter(b => b.id !== id) }));
    await supabase.from('books').delete().eq('id', id).eq('user_id', user.id);
  }, [user, supabase, updateLocalData]);

  const addReminder = useCallback(async (text: string, dueDate: string | null) => {
    if (!user) return;

    const tempId = `temp_${Date.now()}`;
    const newReminder: Reminder = {
      id: tempId,
      text,
      dueDate,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    updateLocalData(prev => ({ ...prev, reminders: [newReminder, ...prev.reminders] }));

    const { data: newReminderData, error } = await supabase
      .from('reminders')
      .insert({ user_id: user.id, text, due_date: dueDate, completed: false })
      .select()
      .single();

    if (!error && newReminderData) {
      updateLocalData(prev => ({
        ...prev,
        reminders: prev.reminders.map(r => r.id === tempId ? { ...r, id: newReminderData.id } : r),
      }));
    }
  }, [user, supabase, updateLocalData]);

  const toggleReminder = useCallback(async (id: string) => {
    if (!user) return;

    const reminder = data.reminders.find(r => r.id === id);
    if (!reminder) return;

    updateLocalData(prev => ({
      ...prev,
      reminders: prev.reminders.map(r => r.id === id ? { ...r, completed: !r.completed } : r),
    }));

    await supabase.from('reminders').update({ completed: !reminder.completed }).eq('id', id).eq('user_id', user.id);
  }, [user, supabase, data.reminders, updateLocalData]);

  const removeReminder = useCallback(async (id: string) => {
    if (!user) return;

    updateLocalData(prev => ({ ...prev, reminders: prev.reminders.filter(r => r.id !== id) }));
    await supabase.from('reminders').delete().eq('id', id).eq('user_id', user.id);
  }, [user, supabase, updateLocalData]);

  const addNote = useCallback(async (title: string, content: string, color: string = '#ef4444') => {
    if (!user) return;

    const tempId = `temp_${Date.now()}`;
    const now = new Date().toISOString();
    const newNote: Note = { id: tempId, title, content, color, createdAt: now, updatedAt: now };

    updateLocalData(prev => ({ ...prev, notes: [newNote, ...prev.notes] }));

    const { data: newNoteData, error } = await supabase
      .from('notes')
      .insert({ user_id: user.id, title, content, color })
      .select()
      .single();

    if (!error && newNoteData) {
      updateLocalData(prev => ({
        ...prev,
        notes: prev.notes.map(n => n.id === tempId ? { ...n, id: newNoteData.id } : n),
      }));
    }
  }, [user, supabase, updateLocalData]);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    if (!user) return;

    updateLocalData(prev => ({
      ...prev,
      notes: prev.notes.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n),
    }));

    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.color !== undefined) dbUpdates.color = updates.color;

    await supabase.from('notes').update(dbUpdates).eq('id', id).eq('user_id', user.id);
  }, [user, supabase, updateLocalData]);

  const removeNote = useCallback(async (id: string) => {
    if (!user) return;

    updateLocalData(prev => ({ ...prev, notes: prev.notes.filter(n => n.id !== id) }));
    await supabase.from('notes').delete().eq('id', id).eq('user_id', user.id);
  }, [user, supabase, updateLocalData]);

  const addBankAccount = useCallback(async (account: Omit<BankAccount, 'id'>) => {
    if (!user) return;

    const tempId = `temp_${Date.now()}`;
    const newAccount: BankAccount = { ...account, id: tempId };

    updateLocalData(prev => ({ ...prev, bankAccounts: [...prev.bankAccounts, newAccount] }));

    const { data: newAccountData, error } = await supabase
      .from('bank_accounts')
      .insert({
        user_id: user.id,
        name: account.name,
        type: account.type,
        account_type: account.accountType,
        person_type: account.personType,
        balance: account.balance,
        notes: account.notes,
      })
      .select()
      .single();

    if (!error && newAccountData) {
      updateLocalData(prev => ({
        ...prev,
        bankAccounts: prev.bankAccounts.map(a => a.id === tempId ? { ...a, id: newAccountData.id } : a),
      }));
    }
  }, [user, supabase, updateLocalData]);

  const updateBankAccount = useCallback(async (id: string, updates: Partial<BankAccount>) => {
    if (!user) return;

    updateLocalData(prev => ({
      ...prev,
      bankAccounts: prev.bankAccounts.map(a => a.id === id ? { ...a, ...updates } : a),
    }));

    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.accountType !== undefined) dbUpdates.account_type = updates.accountType;
    if (updates.personType !== undefined) dbUpdates.person_type = updates.personType;
    if (updates.balance !== undefined) dbUpdates.balance = updates.balance;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    await supabase.from('bank_accounts').update(dbUpdates).eq('id', id).eq('user_id', user.id);
  }, [user, supabase, updateLocalData]);

  const removeBankAccount = useCallback(async (id: string) => {
    if (!user) return;

    updateLocalData(prev => ({ ...prev, bankAccounts: prev.bankAccounts.filter(a => a.id !== id) }));
    await supabase.from('bank_accounts').delete().eq('id', id).eq('user_id', user.id);
  }, [user, supabase, updateLocalData]);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>) => {
    if (!user) return;

    const tempId = `temp_${Date.now()}`;
    const newTransaction: Transaction = { ...transaction, id: tempId };

    updateLocalData(prev => ({ ...prev, transactions: [newTransaction, ...prev.transactions] }));

    const { data: newTransData, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        bank_account_id: transaction.bankAccountId,
        title: transaction.title,
        type: transaction.type,
        category: transaction.category,
        amount: transaction.amount,
        date: transaction.date,
        payment_method: transaction.paymentMethod,
        status: transaction.status,
        notes: transaction.notes,
      })
      .select()
      .single();

    if (!error && newTransData) {
      updateLocalData(prev => ({
        ...prev,
        transactions: prev.transactions.map(t => t.id === tempId ? { ...t, id: newTransData.id } : t),
      }));
    }
  }, [user, supabase, updateLocalData]);

  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>) => {
    if (!user) return;

    updateLocalData(prev => ({
      ...prev,
      transactions: prev.transactions.map(t => t.id === id ? { ...t, ...updates } : t),
    }));

    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.bankAccountId !== undefined) dbUpdates.bank_account_id = updates.bankAccountId;
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.paymentMethod !== undefined) dbUpdates.payment_method = updates.paymentMethod;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    await supabase.from('transactions').update(dbUpdates).eq('id', id).eq('user_id', user.id);
  }, [user, supabase, updateLocalData]);

  const removeTransaction = useCallback(async (id: string) => {
    if (!user) return;

    updateLocalData(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));
    await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id);
  }, [user, supabase, updateLocalData]);

  const toggleTransactionStatus = useCallback(async (id: string) => {
    if (!user) return;

    const transaction = data.transactions.find(t => t.id === id);
    if (!transaction) return;

    const newStatus = transaction.status === 'pending' ? 'confirmed' : 'pending';

    updateLocalData(prev => ({
      ...prev,
      transactions: prev.transactions.map(t => t.id === id ? { ...t, status: newStatus } : t),
    }));

    await supabase.from('transactions').update({ status: newStatus }).eq('id', id).eq('user_id', user.id);
  }, [user, supabase, data.transactions, updateLocalData]);

  const setFinancePeriod = useCallback(async (period: FinancePeriod) => {
    if (!user) return;

    updateLocalData(prev => ({ ...prev, financePeriod: period }));

    await supabase.from('user_settings').update({
      finance_start_date: period.startDate,
      finance_end_date: period.endDate,
    }).eq('user_id', user.id);
  }, [user, supabase, updateLocalData]);

  const setSelectedYear = useCallback(async (year: number) => {
    if (!user) return;

    updateLocalData(prev => ({ ...prev, selectedYear: year }));
    await supabase.from('user_settings').update({ selected_year: year }).eq('user_id', user.id);
  }, [user, supabase, updateLocalData]);

  const getFinanceSummary = useCallback((startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const filteredTransactions = data.transactions.filter(t => {
      const date = new Date(t.date);
      return date >= start && date <= end;
    });

    const pendingIncome = filteredTransactions.filter(t => t.type === 'income' && t.status === 'pending').reduce((sum, t) => sum + t.amount, 0);
    const pendingExpense = filteredTransactions.filter(t => t.type === 'expense' && t.status === 'pending').reduce((sum, t) => sum + t.amount, 0);
    const confirmedIncome = filteredTransactions.filter(t => t.type === 'income' && t.status === 'confirmed').reduce((sum, t) => sum + t.amount, 0);
    const confirmedExpense = filteredTransactions.filter(t => t.type === 'expense' && t.status === 'confirmed').reduce((sum, t) => sum + t.amount, 0);

    return {
      pendingIncome,
      pendingExpense,
      pendingBalance: pendingIncome - pendingExpense,
      confirmedIncome,
      confirmedExpense,
      confirmedBalance: confirmedIncome - confirmedExpense,
      totalBalance: (pendingIncome - pendingExpense) + (confirmedIncome - confirmedExpense),
      filteredTransactions,
    };
  }, [data.transactions]);

  return {
    data,
    isLoaded,
    isSyncing,
    addVisionImage,
    removeVisionImage,
    resetVisionBoard,
    setMainGoal,
    addGoalAction,
    toggleGoalAction,
    removeGoalAction,
    addGoalToCategory,
    toggleGoalInCategory,
    removeGoalFromCategory,
    addBook,
    updateBookProgress,
    removeBook,
    addReminder,
    toggleReminder,
    removeReminder,
    addNote,
    updateNote,
    removeNote,
    addBankAccount,
    updateBankAccount,
    removeBankAccount,
    addTransaction,
    updateTransaction,
    removeTransaction,
    toggleTransactionStatus,
    setFinancePeriod,
    setSelectedYear,
    getFinanceSummary,
    forceSync: loadFromSupabase,
  };
}
