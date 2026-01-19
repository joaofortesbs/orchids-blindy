"use client";

import { useState, useEffect, useCallback } from 'react';
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

export function useVisoesData() {
  const [data, setData] = useState<VisoesData>(DEFAULT_VISOES_DATA);
  const [isLoaded, setIsLoaded] = useState(false);
  const { user } = useAuth();
  const supabase = createClient();

  const loadFromSupabase = useCallback(async () => {
    if (!user) {
      setIsLoaded(true);
      return;
    }

    try {
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
      const financePeriod: FinancePeriod | null = settings?.finance_start_date && settings?.finance_end_date ? {
        startDate: settings.finance_start_date,
        endDate: settings.finance_end_date,
      } : null;

      setData({
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
      });
    } catch (error) {
      console.error('Error loading Visoes data from Supabase:', error);
    } finally {
      setIsLoaded(true);
    }
  }, [user, supabase]);

  useEffect(() => {
    loadFromSupabase();
  }, [loadFromSupabase]);

  const addVisionImage = useCallback(async (imageUrl: string) => {
    if (!user) return;

    const { data: newImage, error } = await supabase
      .from('vision_boards')
      .insert({
        user_id: user.id,
        image_url: imageUrl,
        position: data.visionBoard.length,
      })
      .select()
      .single();

    if (!error && newImage) {
      setData(prev => ({
        ...prev,
        visionBoard: [...prev.visionBoard, {
          id: newImage.id,
          imageUrl: newImage.image_url,
          createdAt: newImage.created_at,
        }],
      }));
    }
  }, [user, supabase, data.visionBoard.length]);

  const removeVisionImage = useCallback(async (id: string) => {
    if (!user) return;

    await supabase.from('vision_boards').delete().eq('id', id).eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      visionBoard: prev.visionBoard.filter(v => v.id !== id),
    }));
  }, [user, supabase]);

  const resetVisionBoard = useCallback(async () => {
    if (!user) return;

    await supabase.from('vision_boards').delete().eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      visionBoard: [],
    }));
  }, [user, supabase]);

  const setMainGoal = useCallback(async (text: string, year: number) => {
    if (!user) return;

    await supabase.from('main_goals').delete().eq('user_id', user.id);

    const { data: newGoal, error } = await supabase
      .from('main_goals')
      .insert({
        user_id: user.id,
        text,
        year,
      })
      .select()
      .single();

    if (!error && newGoal) {
      setData(prev => ({
        ...prev,
        mainGoal: {
          id: newGoal.id,
          text: newGoal.text,
          year: newGoal.year,
          createdAt: newGoal.created_at,
        },
      }));
    }
  }, [user, supabase]);

  const addGoalAction = useCallback(async (text: string) => {
    if (!user) return;

    const { data: newAction, error } = await supabase
      .from('goal_actions')
      .insert({
        user_id: user.id,
        text,
        completed: false,
        position: data.goalActions.length,
      })
      .select()
      .single();

    if (!error && newAction) {
      setData(prev => ({
        ...prev,
        goalActions: [...prev.goalActions, {
          id: newAction.id,
          text: newAction.text,
          completed: newAction.completed,
        }],
      }));
    }
  }, [user, supabase, data.goalActions.length]);

  const toggleGoalAction = useCallback(async (id: string) => {
    if (!user) return;

    const action = data.goalActions.find(a => a.id === id);
    if (!action) return;

    await supabase
      .from('goal_actions')
      .update({ completed: !action.completed })
      .eq('id', id)
      .eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      goalActions: prev.goalActions.map(a =>
        a.id === id ? { ...a, completed: !a.completed } : a
      ),
    }));
  }, [user, supabase, data.goalActions]);

  const removeGoalAction = useCallback(async (id: string) => {
    if (!user) return;

    await supabase.from('goal_actions').delete().eq('id', id).eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      goalActions: prev.goalActions.filter(a => a.id !== id),
    }));
  }, [user, supabase]);

  const addGoalToCategory = useCallback(async (categoryId: string, text: string) => {
    if (!user) return;

    const category = data.goalCategories.find(c => c.id === categoryId);
    const position = category?.goals.length || 0;

    const { data: newGoal, error } = await supabase
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

    if (!error && newGoal) {
      setData(prev => ({
        ...prev,
        goalCategories: prev.goalCategories.map(cat =>
          cat.id === categoryId
            ? { ...cat, goals: [...cat.goals, {
                id: newGoal.id,
                text: newGoal.text,
                completed: newGoal.completed,
                categoryId: newGoal.category_id,
              }] }
            : cat
        ),
      }));
    }
  }, [user, supabase, data.goalCategories]);

  const toggleGoalInCategory = useCallback(async (categoryId: string, goalId: string) => {
    if (!user) return;

    const category = data.goalCategories.find(c => c.id === categoryId);
    const goal = category?.goals.find(g => g.id === goalId);
    if (!goal) return;

    await supabase
      .from('goals')
      .update({ completed: !goal.completed })
      .eq('id', goalId)
      .eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      goalCategories: prev.goalCategories.map(cat =>
        cat.id === categoryId
          ? {
              ...cat,
              goals: cat.goals.map(g =>
                g.id === goalId ? { ...g, completed: !g.completed } : g
              ),
            }
          : cat
      ),
    }));
  }, [user, supabase, data.goalCategories]);

  const removeGoalFromCategory = useCallback(async (categoryId: string, goalId: string) => {
    if (!user) return;

    await supabase.from('goals').delete().eq('id', goalId).eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      goalCategories: prev.goalCategories.map(cat =>
        cat.id === categoryId
          ? { ...cat, goals: cat.goals.filter(g => g.id !== goalId) }
          : cat
      ),
    }));
  }, [user, supabase]);

  const addBook = useCallback(async (book: Omit<Book, 'id'>) => {
    if (!user) return;

    const { data: newBook, error } = await supabase
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

    if (!error && newBook) {
      setData(prev => ({
        ...prev,
        books: [{
          id: newBook.id,
          title: newBook.title,
          author: newBook.author,
          coverUrl: newBook.cover_url || '',
          progress: newBook.progress,
          type: newBook.type as 'book' | 'podcast' | 'video' | 'course',
        }, ...prev.books],
      }));
    }
  }, [user, supabase]);

  const updateBookProgress = useCallback(async (id: string, progress: number) => {
    if (!user) return;

    await supabase
      .from('books')
      .update({ progress, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      books: prev.books.map(b =>
        b.id === id ? { ...b, progress } : b
      ),
    }));
  }, [user, supabase]);

  const removeBook = useCallback(async (id: string) => {
    if (!user) return;

    await supabase.from('books').delete().eq('id', id).eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      books: prev.books.filter(b => b.id !== id),
    }));
  }, [user, supabase]);

  const addReminder = useCallback(async (text: string, dueDate: string | null) => {
    if (!user) return;

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

    if (!error && newReminder) {
      setData(prev => ({
        ...prev,
        reminders: [{
          id: newReminder.id,
          text: newReminder.text,
          dueDate: newReminder.due_date,
          completed: newReminder.completed,
          createdAt: newReminder.created_at,
        }, ...prev.reminders],
      }));
    }
  }, [user, supabase]);

  const toggleReminder = useCallback(async (id: string) => {
    if (!user) return;

    const reminder = data.reminders.find(r => r.id === id);
    if (!reminder) return;

    await supabase
      .from('reminders')
      .update({ completed: !reminder.completed })
      .eq('id', id)
      .eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      reminders: prev.reminders.map(r =>
        r.id === id ? { ...r, completed: !r.completed } : r
      ),
    }));
  }, [user, supabase, data.reminders]);

  const removeReminder = useCallback(async (id: string) => {
    if (!user) return;

    await supabase.from('reminders').delete().eq('id', id).eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      reminders: prev.reminders.filter(r => r.id !== id),
    }));
  }, [user, supabase]);

  const addNote = useCallback(async (title: string, content: string, color: string = '#ef4444') => {
    if (!user) return;

    const { data: newNote, error } = await supabase
      .from('notes')
      .insert({
        user_id: user.id,
        title,
        content,
        color,
      })
      .select()
      .single();

    if (!error && newNote) {
      setData(prev => ({
        ...prev,
        notes: [{
          id: newNote.id,
          title: newNote.title,
          content: newNote.content || '',
          color: newNote.color,
          createdAt: newNote.created_at,
          updatedAt: newNote.updated_at,
        }, ...prev.notes],
      }));
    }
  }, [user, supabase]);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    if (!user) return;

    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.color !== undefined) dbUpdates.color = updates.color;

    await supabase
      .from('notes')
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      notes: prev.notes.map(n =>
        n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
      ),
    }));
  }, [user, supabase]);

  const removeNote = useCallback(async (id: string) => {
    if (!user) return;

    await supabase.from('notes').delete().eq('id', id).eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      notes: prev.notes.filter(n => n.id !== id),
    }));
  }, [user, supabase]);

  const addFutureLetter = useCallback(async (title: string, content: string, openDate: string) => {
    if (!user) return;

    const { data: newLetter, error } = await supabase
      .from('future_letters')
      .insert({
        user_id: user.id,
        title,
        content,
        open_date: openDate,
        is_opened: false,
      })
      .select()
      .single();

    if (!error && newLetter) {
      setData(prev => ({
        ...prev,
        futureLetters: [{
          id: newLetter.id,
          title: newLetter.title,
          content: newLetter.content,
          openDate: newLetter.open_date,
          isOpened: newLetter.is_opened,
          createdAt: newLetter.created_at,
        }, ...prev.futureLetters],
      }));
    }
  }, [user, supabase]);

  const openFutureLetter = useCallback(async (id: string) => {
    if (!user) return;

    await supabase
      .from('future_letters')
      .update({ is_opened: true })
      .eq('id', id)
      .eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      futureLetters: prev.futureLetters.map(l =>
        l.id === id ? { ...l, isOpened: true } : l
      ),
    }));
  }, [user, supabase]);

  const removeFutureLetter = useCallback(async (id: string) => {
    if (!user) return;

    await supabase.from('future_letters').delete().eq('id', id).eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      futureLetters: prev.futureLetters.filter(l => l.id !== id),
    }));
  }, [user, supabase]);

  const addBankAccount = useCallback(async (account: Omit<BankAccount, 'id'>) => {
    if (!user) return;

    const { data: newAccount, error } = await supabase
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

    if (!error && newAccount) {
      setData(prev => ({
        ...prev,
        bankAccounts: [...prev.bankAccounts, {
          id: newAccount.id,
          name: newAccount.name,
          type: newAccount.type as 'fiduciary' | 'crypto',
          accountType: newAccount.account_type,
          personType: newAccount.person_type,
          balance: Number(newAccount.balance) || 0,
          notes: newAccount.notes || '',
        }],
      }));
    }
  }, [user, supabase]);

  const updateBankAccount = useCallback(async (id: string, updates: Partial<BankAccount>) => {
    if (!user) return;

    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.accountType !== undefined) dbUpdates.account_type = updates.accountType;
    if (updates.personType !== undefined) dbUpdates.person_type = updates.personType;
    if (updates.balance !== undefined) dbUpdates.balance = updates.balance;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    await supabase
      .from('bank_accounts')
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      bankAccounts: prev.bankAccounts.map(a =>
        a.id === id ? { ...a, ...updates } : a
      ),
    }));
  }, [user, supabase]);

  const removeBankAccount = useCallback(async (id: string) => {
    if (!user) return;

    await supabase.from('bank_accounts').delete().eq('id', id).eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      bankAccounts: prev.bankAccounts.filter(a => a.id !== id),
    }));
  }, [user, supabase]);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>) => {
    if (!user) return;

    const { data: newTrans, error } = await supabase
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

    if (!error && newTrans) {
      setData(prev => ({
        ...prev,
        transactions: [{
          id: newTrans.id,
          bankAccountId: newTrans.bank_account_id,
          title: newTrans.title,
          type: newTrans.type as 'income' | 'expense',
          category: newTrans.category,
          amount: Number(newTrans.amount),
          date: newTrans.date,
          paymentMethod: newTrans.payment_method as Transaction['paymentMethod'],
          status: newTrans.status as 'pending' | 'confirmed',
          notes: newTrans.notes || '',
        }, ...prev.transactions],
      }));
    }
  }, [user, supabase]);

  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>) => {
    if (!user) return;

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

    await supabase
      .from('transactions')
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      transactions: prev.transactions.map(t =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
  }, [user, supabase]);

  const removeTransaction = useCallback(async (id: string) => {
    if (!user) return;

    await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== id),
    }));
  }, [user, supabase]);

  const toggleTransactionStatus = useCallback(async (id: string) => {
    if (!user) return;

    const transaction = data.transactions.find(t => t.id === id);
    if (!transaction) return;

    const newStatus = transaction.status === 'pending' ? 'confirmed' : 'pending';

    await supabase
      .from('transactions')
      .update({ status: newStatus })
      .eq('id', id)
      .eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      transactions: prev.transactions.map(t =>
        t.id === id ? { ...t, status: newStatus } : t
      ),
    }));
  }, [user, supabase, data.transactions]);

  const setFinancePeriod = useCallback(async (period: FinancePeriod) => {
    if (!user) return;

    await supabase
      .from('user_settings')
      .update({
        finance_start_date: period.startDate,
        finance_end_date: period.endDate,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      financePeriod: period,
    }));
  }, [user, supabase]);

  const setSelectedYear = useCallback(async (year: number) => {
    if (!user) return;

    await supabase
      .from('user_settings')
      .update({
        selected_year: year,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    setData(prev => ({
      ...prev,
      selectedYear: year,
    }));
  }, [user, supabase]);

  const getFinanceSummary = useCallback((startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const filteredTransactions = data.transactions.filter(t => {
      const date = new Date(t.date);
      return date >= start && date <= end;
    });

    const pendingIncome = filteredTransactions
      .filter(t => t.type === 'income' && t.status === 'pending')
      .reduce((sum, t) => sum + t.amount, 0);

    const pendingExpense = filteredTransactions
      .filter(t => t.type === 'expense' && t.status === 'pending')
      .reduce((sum, t) => sum + t.amount, 0);

    const confirmedIncome = filteredTransactions
      .filter(t => t.type === 'income' && t.status === 'confirmed')
      .reduce((sum, t) => sum + t.amount, 0);

    const confirmedExpense = filteredTransactions
      .filter(t => t.type === 'expense' && t.status === 'confirmed')
      .reduce((sum, t) => sum + t.amount, 0);

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
    addFutureLetter,
    openFutureLetter,
    removeFutureLetter,
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
  };
}
