"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  VisoesData, 
  DEFAULT_VISOES_DATA, 
  Note, 
  Book, 
  BankAccount, 
  Transaction,
  GoalCategory,
  DEFAULT_GOAL_CATEGORIES,
  VisionBoard,
} from '@/lib/types/visoes';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/AuthContext';

const CACHE_KEY = 'blindy_visoes_v9';

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
  const [data, setData] = useState<VisoesData>(() => {
    const cached = getCache();
    return cached || DEFAULT_VISOES_DATA;
  });
  const [isLoaded, setIsLoaded] = useState(() => getCache() !== null);
  const [isSyncing, setIsSyncing] = useState(false);
  const { user } = useAuth();

  const supabase = useMemo(() => createClient(), []);
  
  const dataRef = useRef(data);
  const loadingRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const loadData = useCallback(async () => {
    if (!user || loadingRef.current) return;
    
    loadingRef.current = true;
    setIsSyncing(true);

    try {
      const results = await Promise.allSettled([
        supabase.from('vision_boards').select('*').eq('user_id', user.id).order('position'),
        supabase.from('main_goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('goal_actions').select('*').eq('user_id', user.id).order('position'),
        supabase.from('goal_categories').select('*').eq('user_id', user.id).order('position'),
        supabase.from('goals').select('*').eq('user_id', user.id).order('position'),
        supabase.from('books').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('reminders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('notes').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
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

      const vbData = getValue(results[0], []) as Array<{ id: string; image_url: string; created_at: string; position?: number }>;
        const mgData = getValue(results[1], []) as Array<{ id: string; text: string; year: number; created_at: string }>;
        const gaData = getValue(results[2], []) as Array<{ id: string; text: string; completed: boolean }>;
        const gcData = getValue(results[3], []) as Array<{ id: string; name: string; icon: string }>;
        const gData = getValue(results[4], []) as Array<{ id: string; text: string; completed: boolean; category_id: string }>;
        const bData = getValue(results[5], []) as Array<{ id: string; title: string; author: string; cover_url: string; progress: number; type: string }>;
        const rData = getValue(results[6], []) as Array<{ id: string; text: string; due_date: string | null; completed: boolean; created_at: string }>;
        const nData = getValue(results[7], []) as Array<{ id: string; title: string; content: string; color: string; created_at: string; updated_at: string }>;
        const baData = getValue(results[8], []) as Array<{ id: string; name: string; type: string; account_type?: string; person_type?: string; balance: number; notes?: string }>;
        const tData = getValue(results[9], []) as Array<{ id: string; bank_account_id: string | null; title: string; type: string; category?: string; amount: number; date: string; status: string; payment_method?: string; notes?: string }>;
        
        let usData: { finance_start_date?: string; finance_end_date?: string; selected_year?: number } | null = null;
        if (results[10].status === 'fulfilled' && results[10].value.data) {
          usData = results[10].value.data as { finance_start_date?: string; finance_end_date?: string; selected_year?: number };
        }

        const goalsMap = new Map();
        gData.forEach(item => {
          const list = goalsMap.get(item.category_id) || [];
          list.push({ id: item.id, text: item.text, completed: item.completed, categoryId: item.category_id });
          goalsMap.set(item.category_id, list);
        });

        const goalCategories: GoalCategory[] = gcData.length > 0 
          ? gcData.map(c => ({ id: c.id, name: c.name, icon: c.icon, goals: goalsMap.get(c.id) || [] }))
          : DEFAULT_GOAL_CATEGORIES.map(cat => ({ ...cat, goals: goalsMap.get(cat.id) || [] }));

        const sortedVb = [...vbData].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

        const newData: VisoesData = {
          visionBoard: sortedVb.map((v, idx) => ({ id: v.id, imageUrl: v.image_url, createdAt: v.created_at, position: v.position ?? idx })),
        mainGoal: mgData[0] ? { id: mgData[0].id, text: mgData[0].text, year: mgData[0].year, createdAt: mgData[0].created_at } : null,
        goalActions: gaData.map(a => ({ id: a.id, text: a.text, completed: a.completed })),
        goalCategories,
        books: bData.map(item => ({ id: item.id, title: item.title, author: item.author, coverUrl: item.cover_url || '', progress: item.progress, type: item.type as Book['type'] })),
        reminders: rData.map(item => ({ id: item.id, text: item.text, dueDate: item.due_date, completed: item.completed, createdAt: item.created_at })),
        notes: nData.map(item => ({ id: item.id, title: item.title, content: item.content || '', color: item.color, createdAt: item.created_at, updatedAt: item.updated_at })),
        futureLetters: [],
        bankAccounts: baData.map(item => ({ 
          id: item.id, 
          name: item.name, 
          type: item.type as BankAccount['type'], 
          accountType: item.account_type || '',
          personType: item.person_type || '',
          balance: Number(item.balance) || 0,
          notes: item.notes || '',
        })),
        transactions: tData.map(item => ({ 
          id: item.id, 
          bankAccountId: item.bank_account_id, 
          title: item.title, 
          type: item.type as Transaction['type'], 
          category: item.category || 'OUTROS',
          amount: Number(item.amount), 
          date: item.date, 
          status: item.status as Transaction['status'],
          paymentMethod: (item.payment_method || 'pix') as Transaction['paymentMethod'],
          notes: item.notes || '',
        })),
        financePeriod: usData?.finance_start_date ? { startDate: usData.finance_start_date, endDate: usData.finance_end_date || '' } : DEFAULT_VISOES_DATA.financePeriod,
        selectedYear: usData?.selected_year || new Date().getFullYear(),
      };

      setData(newData);
      setCache(newData);
    } catch (e) {
      console.error('Visoes load error:', e);
    } finally {
      setIsLoaded(true);
      setIsSyncing(false);
      loadingRef.current = false;
      initialLoadDoneRef.current = true;
    }
  }, [user, supabase]);

  useEffect(() => {
    if (!isLoaded) {
      const cached = getCache();
      if (cached) {
        setData(cached);
        setIsLoaded(true);
      }
    }
    
    if (user && !initialLoadDoneRef.current) {
      loadData();
    } else if (!user) {
      setIsLoaded(true);
    }
  }, [user, loadData, isLoaded]);

  const addVisionImage = useCallback(async (imageUrl: string) => {
    if (!user) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const position = dataRef.current.visionBoard.length;
    const tempImage: VisionBoard = {
      id: tempId,
      imageUrl,
      createdAt: new Date().toISOString(),
      position,
    };

    setData(prev => {
      const updated = { ...prev, visionBoard: [...prev.visionBoard, tempImage] };
      setCache(updated);
      return updated;
    });

    (async () => {
      try {
        let finalUrl = imageUrl;
        
        if (imageUrl.startsWith('data:')) {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const ext = blob.type.split('/')[1] || 'png';
          const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('vision-board')
            .upload(fileName, blob, { contentType: blob.type, upsert: false });

          if (!uploadError && uploadData) {
            const { data: publicUrlData } = supabase.storage
              .from('vision-board')
              .getPublicUrl(uploadData.path);
            finalUrl = publicUrlData.publicUrl;
          }
        }

        const { data: newImage, error } = await supabase
          .from('vision_boards')
          .insert({ user_id: user.id, image_url: finalUrl, position })
          .select()
          .single();

        if (!error && newImage) {
          setData(prev => {
            const updated = {
              ...prev,
              visionBoard: prev.visionBoard.map(v =>
                v.id === tempId
                  ? { id: newImage.id, imageUrl: finalUrl, createdAt: newImage.created_at, position: newImage.position ?? position }
                  : v
              ),
            };
            setCache(updated);
            return updated;
          });
        }
      } catch (e) {
        console.error('Upload error:', e);
      }
    })();
  }, [user, supabase]);

  const removeVisionImage = useCallback(async (id: string) => {
    if (!user) return;

    const imageToRemove = dataRef.current.visionBoard.find(v => v.id === id);

    setData(prev => {
      const filtered = prev.visionBoard.filter(v => v.id !== id);
      const reindexed = filtered.map((v, idx) => ({ ...v, position: idx }));
      const updated = { ...prev, visionBoard: reindexed };
      setCache(updated);
      return updated;
    });

    if (!id.startsWith('temp-')) {
      await supabase.from('vision_boards').delete().eq('id', id).eq('user_id', user.id);
      
      if (imageToRemove?.imageUrl && !imageToRemove.imageUrl.startsWith('data:')) {
        try {
          const urlParts = imageToRemove.imageUrl.split('/vision-board/');
          if (urlParts[1]) {
            await supabase.storage.from('vision-board').remove([urlParts[1]]);
          }
        } catch {}
      }
    }
  }, [user, supabase]);

  const reorderVisionImages = useCallback(async (images: VisionBoard[]) => {
    if (!user) return;

    const reindexed = images.map((img, idx) => ({ ...img, position: idx }));

    setData(prev => {
      const updated = { ...prev, visionBoard: reindexed };
      setCache(updated);
      return updated;
    });

    const updates = reindexed
      .filter(img => !img.id.startsWith('temp-'))
      .map(img => supabase.from('vision_boards').update({ position: img.position }).eq('id', img.id).eq('user_id', user.id));
    
    await Promise.all(updates);
  }, [user, supabase]);

  const resetVisionBoard = useCallback(async () => {
    if (!user) return;

    setData(prev => {
      const updated = { ...prev, visionBoard: [] };
      setCache(updated);
      return updated;
    });

    await supabase.from('vision_boards').delete().eq('user_id', user.id);
  }, [user, supabase]);

  const setMainGoal = useCallback(async (text: string, year: number) => {
    if (!user) {
      console.error('setMainGoal: No user');
      return;
    }

    const tempGoal = { id: `temp-${Date.now()}`, text, year, createdAt: new Date().toISOString() };
    setData(prev => {
      const updated = { ...prev, mainGoal: tempGoal };
      setCache(updated);
      return updated;
    });

    try {
      const { data: existing } = await supabase
        .from('main_goals')
        .select('id')
        .eq('user_id', user.id)
        .eq('year', year)
        .single();

      let result;
      if (existing) {
        const { data, error } = await supabase
          .from('main_goals')
          .update({ text })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) console.error('setMainGoal update error:', error);
        result = data;
      } else {
        const { data, error } = await supabase
          .from('main_goals')
          .insert({ user_id: user.id, text, year })
          .select()
          .single();
        if (error) console.error('setMainGoal insert error:', error);
        result = data;
      }

      if (result) {
        setData(prev => {
          const updated = { ...prev, mainGoal: { id: result.id, text: result.text, year: result.year, createdAt: result.created_at } };
          setCache(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error('setMainGoal exception:', e);
    }
  }, [user, supabase]);

  const addGoalAction = useCallback(async (text: string) => {
    if (!user) return;

    const position = dataRef.current.goalActions.length;
    const { data: newAction } = await supabase
      .from('goal_actions')
      .insert({ user_id: user.id, text, completed: false, position })
      .select()
      .single();

    if (newAction) {
      setData(prev => {
        const updated = { ...prev, goalActions: [...prev.goalActions, { id: newAction.id, text: newAction.text, completed: newAction.completed }] };
        setCache(updated);
        return updated;
      });
    }
  }, [user, supabase]);

  const toggleGoalAction = useCallback(async (id: string) => {
    if (!user) return;

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

    await supabase.from('goal_actions').update({ completed: newCompleted }).eq('id', id).eq('user_id', user.id);
  }, [user, supabase]);

  const removeGoalAction = useCallback(async (id: string) => {
    if (!user) return;

    setData(prev => {
      const updated = { ...prev, goalActions: prev.goalActions.filter(a => a.id !== id) };
      setCache(updated);
      return updated;
    });

    await supabase.from('goal_actions').delete().eq('id', id).eq('user_id', user.id);
  }, [user, supabase]);

  const addGoalToCategory = useCallback(async (categoryId: string, text: string) => {
    if (!user) return;

    const category = dataRef.current.goalCategories.find(c => c.id === categoryId);
    const position = category?.goals.length || 0;
    
    const { data: newGoal } = await supabase
      .from('goals')
      .insert({ user_id: user.id, category_id: categoryId, text, completed: false, position })
      .select()
      .single();

    if (newGoal) {
      setData(prev => {
        const updated = {
          ...prev,
          goalCategories: prev.goalCategories.map(c =>
            c.id === categoryId
              ? { ...c, goals: [...c.goals, { id: newGoal.id, text: newGoal.text, completed: newGoal.completed, categoryId }] }
              : c
          ),
        };
        setCache(updated);
        return updated;
      });
    }
  }, [user, supabase]);

  const toggleGoalInCategory = useCallback(async (categoryId: string, goalId: string) => {
    if (!user) return;

    const category = dataRef.current.goalCategories.find(c => c.id === categoryId);
    const goal = category?.goals.find(g => g.id === goalId);
    if (!goal) return;

    const newCompleted = !goal.completed;

    setData(prev => {
      const updated = {
        ...prev,
        goalCategories: prev.goalCategories.map(c =>
          c.id === categoryId
            ? { ...c, goals: c.goals.map(g => g.id === goalId ? { ...g, completed: newCompleted } : g) }
            : c
        ),
      };
      setCache(updated);
      return updated;
    });

    await supabase.from('goals').update({ completed: newCompleted }).eq('id', goalId).eq('user_id', user.id);
  }, [user, supabase]);

  const removeGoalFromCategory = useCallback(async (categoryId: string, goalId: string) => {
    if (!user) return;

    setData(prev => {
      const updated = {
        ...prev,
        goalCategories: prev.goalCategories.map(c =>
          c.id === categoryId
            ? { ...c, goals: c.goals.filter(g => g.id !== goalId) }
            : c
        ),
      };
      setCache(updated);
      return updated;
    });

    await supabase.from('goals').delete().eq('id', goalId).eq('user_id', user.id);
  }, [user, supabase]);

  const addBook = useCallback(async (book: Omit<Book, 'id'>) => {
    if (!user) return;

    const { data: newBook } = await supabase
      .from('books')
      .insert({ user_id: user.id, title: book.title, author: book.author, cover_url: book.coverUrl, progress: book.progress, type: book.type })
      .select()
      .single();

    if (newBook) {
      setData(prev => {
        const updated = { ...prev, books: [{ id: newBook.id, title: newBook.title, author: newBook.author, coverUrl: newBook.cover_url || '', progress: newBook.progress, type: newBook.type }, ...prev.books] };
        setCache(updated);
        return updated;
      });
    }
  }, [user, supabase]);

  const updateBookProgress = useCallback(async (id: string, progress: number) => {
    if (!user) return;

    setData(prev => {
      const updated = { ...prev, books: prev.books.map(b => b.id === id ? { ...b, progress } : b) };
      setCache(updated);
      return updated;
    });

    await supabase.from('books').update({ progress }).eq('id', id).eq('user_id', user.id);
  }, [user, supabase]);

  const removeBook = useCallback(async (id: string) => {
    if (!user) return;

    setData(prev => {
      const updated = { ...prev, books: prev.books.filter(b => b.id !== id) };
      setCache(updated);
      return updated;
    });

    await supabase.from('books').delete().eq('id', id).eq('user_id', user.id);
  }, [user, supabase]);

  const addReminder = useCallback(async (text: string, dueDate: string | null) => {
    if (!user) {
      console.error('addReminder: No user');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const tempReminder = { id: tempId, text, dueDate, completed: false, createdAt: new Date().toISOString() };
    
    setData(prev => {
      const updated = { ...prev, reminders: [tempReminder, ...prev.reminders] };
      setCache(updated);
      return updated;
    });

    try {
      const { data: newReminder, error } = await supabase
        .from('reminders')
        .insert({ user_id: user.id, text, due_date: dueDate, completed: false })
        .select()
        .single();

      if (error) {
        console.error('addReminder error:', error);
        return;
      }

      if (newReminder) {
        setData(prev => {
          const updated = { 
            ...prev, 
            reminders: prev.reminders.map(r => 
              r.id === tempId 
                ? { id: newReminder.id, text: newReminder.text, dueDate: newReminder.due_date, completed: newReminder.completed, createdAt: newReminder.created_at }
                : r
            )
          };
          setCache(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error('addReminder exception:', e);
    }
  }, [user, supabase]);

  const toggleReminder = useCallback(async (id: string) => {
    if (!user) return;

    const reminder = dataRef.current.reminders.find(r => r.id === id);
    if (!reminder) return;

    const newCompleted = !reminder.completed;

    setData(prev => {
      const updated = { ...prev, reminders: prev.reminders.map(r => r.id === id ? { ...r, completed: newCompleted } : r) };
      setCache(updated);
      return updated;
    });

    await supabase.from('reminders').update({ completed: newCompleted }).eq('id', id).eq('user_id', user.id);
  }, [user, supabase]);

  const removeReminder = useCallback(async (id: string) => {
    if (!user) return;

    setData(prev => {
      const updated = { ...prev, reminders: prev.reminders.filter(r => r.id !== id) };
      setCache(updated);
      return updated;
    });

    await supabase.from('reminders').delete().eq('id', id).eq('user_id', user.id);
  }, [user, supabase]);

  const addNote = useCallback(async (title: string, content: string, color: string) => {
    if (!user) return;

    const { data: newNote } = await supabase
      .from('notes')
      .insert({ user_id: user.id, title, content, color })
      .select()
      .single();

    if (newNote) {
      setData(prev => {
        const updated = { ...prev, notes: [{ id: newNote.id, title: newNote.title, content: newNote.content || '', color: newNote.color, createdAt: newNote.created_at, updatedAt: newNote.updated_at }, ...prev.notes] };
        setCache(updated);
        return updated;
      });
    }
  }, [user, supabase]);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    if (!user) return;

    setData(prev => {
      const updated = { ...prev, notes: prev.notes.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n) };
      setCache(updated);
      return updated;
    });

    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.color !== undefined) dbUpdates.color = updates.color;

    await supabase.from('notes').update(dbUpdates).eq('id', id).eq('user_id', user.id);
  }, [user, supabase]);

  const removeNote = useCallback(async (id: string) => {
    if (!user) return;

    setData(prev => {
      const updated = { ...prev, notes: prev.notes.filter(n => n.id !== id) };
      setCache(updated);
      return updated;
    });

    await supabase.from('notes').delete().eq('id', id).eq('user_id', user.id);
  }, [user, supabase]);

  const addBankAccount = useCallback(async (account: Omit<BankAccount, 'id'>) => {
    if (!user) {
      console.error('addBankAccount: No user');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const tempAccount: BankAccount = { id: tempId, ...account };
    
    setData(prev => {
      const updated = { ...prev, bankAccounts: [...prev.bankAccounts, tempAccount] };
      setCache(updated);
      return updated;
    });

    try {
      const { data: newAccount, error } = await supabase
        .from('bank_accounts')
        .insert({ 
          user_id: user.id, 
          name: account.name, 
          type: account.type, 
          account_type: account.accountType || null, 
          person_type: account.personType || null, 
          balance: account.balance || 0, 
          notes: account.notes || null 
        })
        .select()
        .single();

      if (error) {
        console.error('addBankAccount error:', error);
        return;
      }

      if (newAccount) {
        setData(prev => {
          const updated = { 
            ...prev, 
            bankAccounts: prev.bankAccounts.map(a => 
              a.id === tempId 
                ? { id: newAccount.id, name: newAccount.name, type: newAccount.type, accountType: newAccount.account_type || '', personType: newAccount.person_type || '', balance: Number(newAccount.balance), notes: newAccount.notes || '' }
                : a
            ) 
          };
          setCache(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error('addBankAccount exception:', e);
    }
  }, [user, supabase]);

  const updateBankAccount = useCallback(async (id: string, updates: Partial<BankAccount>) => {
    if (!user) return;

    setData(prev => {
      const updated = { ...prev, bankAccounts: prev.bankAccounts.map(a => a.id === id ? { ...a, ...updates } : a) };
      setCache(updated);
      return updated;
    });

    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.accountType !== undefined) dbUpdates.account_type = updates.accountType;
    if (updates.personType !== undefined) dbUpdates.person_type = updates.personType;
    if (updates.balance !== undefined) dbUpdates.balance = updates.balance;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    await supabase.from('bank_accounts').update(dbUpdates).eq('id', id).eq('user_id', user.id);
  }, [user, supabase]);

  const removeBankAccount = useCallback(async (id: string) => {
    if (!user) return;

    setData(prev => {
      const updated = { ...prev, bankAccounts: prev.bankAccounts.filter(a => a.id !== id) };
      setCache(updated);
      return updated;
    });

    await supabase.from('bank_accounts').delete().eq('id', id).eq('user_id', user.id);
  }, [user, supabase]);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>) => {
    if (!user) {
      console.error('addTransaction: No user');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const tempTx: Transaction = { id: tempId, ...transaction };
    
    setData(prev => {
      const updated = { ...prev, transactions: [tempTx, ...prev.transactions] };
      setCache(updated);
      return updated;
    });

    try {
      const { data: newTransaction, error } = await supabase
        .from('transactions')
        .insert({ 
          user_id: user.id, 
          title: transaction.title, 
          type: transaction.type, 
          category: transaction.category || 'OUTROS',
          amount: transaction.amount, 
          date: transaction.date, 
          status: transaction.status || 'pending',
          payment_method: transaction.paymentMethod || 'pix',
          notes: transaction.notes || null,
          bank_account_id: transaction.bankAccountId || null,
        })
        .select()
        .single();

      if (error) {
        console.error('addTransaction error:', error);
        return;
      }

      if (newTransaction) {
        setData(prev => {
          const newTx: Transaction = { 
            id: newTransaction.id, 
            title: newTransaction.title, 
            type: newTransaction.type, 
            category: newTransaction.category || 'OUTROS',
            amount: Number(newTransaction.amount), 
            date: newTransaction.date, 
            status: newTransaction.status,
            paymentMethod: newTransaction.payment_method || 'pix',
            notes: newTransaction.notes || '',
            bankAccountId: newTransaction.bank_account_id,
          };
          const updated = { 
            ...prev, 
            transactions: prev.transactions.map(t => t.id === tempId ? newTx : t)
          };
          setCache(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error('addTransaction exception:', e);
    }
  }, [user, supabase]);

  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>) => {
    if (!user) return;

    setData(prev => {
      const updated = { ...prev, transactions: prev.transactions.map(t => t.id === id ? { ...t, ...updates } : t) };
      setCache(updated);
      return updated;
    });

    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.paymentMethod !== undefined) dbUpdates.payment_method = updates.paymentMethod;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.bankAccountId !== undefined) dbUpdates.bank_account_id = updates.bankAccountId;

    await supabase.from('transactions').update(dbUpdates).eq('id', id).eq('user_id', user.id);
  }, [user, supabase]);

  const removeTransaction = useCallback(async (id: string) => {
    if (!user) return;

    setData(prev => {
      const updated = { ...prev, transactions: prev.transactions.filter(t => t.id !== id) };
      setCache(updated);
      return updated;
    });

    await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id);
  }, [user, supabase]);

  const toggleTransactionStatus = useCallback(async (id: string) => {
    if (!user) return;

    const transaction = dataRef.current.transactions.find(t => t.id === id);
    if (!transaction) return;

    const newStatus = transaction.status === 'pending' ? 'confirmed' : 'pending';

    setData(prev => {
      const updated = { ...prev, transactions: prev.transactions.map(t => t.id === id ? { ...t, status: newStatus as Transaction['status'] } : t) };
      setCache(updated);
      return updated;
    });

    await supabase.from('transactions').update({ status: newStatus }).eq('id', id).eq('user_id', user.id);
  }, [user, supabase]);

  const setFinancePeriod = useCallback(async (period: { startDate: string; endDate: string }) => {
    if (!user) return;

    setData(prev => {
      const updated = { ...prev, financePeriod: period };
      setCache(updated);
      return updated;
    });

    await supabase.from('user_settings').upsert({ 
      user_id: user.id, 
      finance_start_date: period.startDate, 
      finance_end_date: period.endDate 
    });
  }, [user, supabase]);

  const setSelectedYear = useCallback(async (year: number) => {
    if (!user) return;

    setData(prev => {
      const updated = { ...prev, selectedYear: year };
      setCache(updated);
      return updated;
    });

    await supabase.from('user_settings').upsert({ user_id: user.id, selected_year: year });
  }, [user, supabase]);

  return {
    data,
    isLoaded,
    isSyncing,
    addVisionImage,
    removeVisionImage,
    reorderVisionImages,
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
    forceSync: loadData,
  };
}
