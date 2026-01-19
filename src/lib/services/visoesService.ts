import { SupabaseClient } from '@supabase/supabase-js';
import { 
  VisoesData, 
  DEFAULT_VISOES_DATA,
  VisionBoard, 
  GoalAction, 
  GoalCategory,
  Book,
  Reminder,
  Note,
  FutureLetter,
  BankAccount,
  Transaction,
} from '@/lib/types/visoes';

export class VisoesService {
  constructor(private supabase: SupabaseClient, private userId: string) {}

  async loadAll(): Promise<VisoesData> {
    const results = await Promise.allSettled([
      this.supabase.from('vision_boards').select('*').eq('user_id', this.userId).order('position'),
      this.supabase.from('main_goals').select('*').eq('user_id', this.userId).order('created_at', { ascending: false }).limit(1),
      this.supabase.from('goal_actions').select('*').eq('user_id', this.userId).order('position'),
      this.supabase.from('goal_categories').select('*').eq('user_id', this.userId).order('position'),
      this.supabase.from('goals').select('*').eq('user_id', this.userId).order('position'),
      this.supabase.from('books').select('*').eq('user_id', this.userId).order('created_at', { ascending: false }),
      this.supabase.from('reminders').select('*').eq('user_id', this.userId).order('created_at', { ascending: false }),
      this.supabase.from('notes').select('*').eq('user_id', this.userId).order('created_at', { ascending: false }),
      this.supabase.from('future_letters').select('*').eq('user_id', this.userId).order('created_at', { ascending: false }),
      this.supabase.from('bank_accounts').select('*').eq('user_id', this.userId).order('created_at'),
      this.supabase.from('transactions').select('*').eq('user_id', this.userId).order('date', { ascending: false }),
      this.supabase.from('user_settings').select('*').eq('user_id', this.userId).single(),
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

    return {
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
  }

  async addVisionImage(imageUrl: string, position: number): Promise<VisionBoard | null> {
    const { data, error } = await this.supabase
      .from('vision_boards')
      .insert({ user_id: this.userId, image_url: imageUrl, position })
      .select()
      .single();

    if (error) {
      console.error('VisoesService.addVisionImage error:', error.message);
      return null;
    }

    return { id: data.id, imageUrl: data.image_url, createdAt: data.created_at };
  }

  async removeVisionImage(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('vision_boards')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId);

    if (error) {
      console.error('VisoesService.removeVisionImage error:', error.message);
      return false;
    }
    return true;
  }

  async setMainGoal(text: string, year: number): Promise<{ id: string; text: string; year: number; createdAt: string } | null> {
    const { data: existing } = await this.supabase
      .from('main_goals')
      .select('id')
      .eq('user_id', this.userId)
      .eq('year', year)
      .single();

    let result;
    if (existing) {
      const { data, error } = await this.supabase
        .from('main_goals')
        .update({ text, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) {
        console.error('VisoesService.setMainGoal update error:', error.message);
        return null;
      }
      result = data;
    } else {
      const { data, error } = await this.supabase
        .from('main_goals')
        .insert({ user_id: this.userId, text, year })
        .select()
        .single();
      if (error) {
        console.error('VisoesService.setMainGoal insert error:', error.message);
        return null;
      }
      result = data;
    }

    return { id: result.id, text: result.text, year: result.year, createdAt: result.created_at };
  }

  async addGoalAction(text: string, position: number): Promise<GoalAction | null> {
    const { data, error } = await this.supabase
      .from('goal_actions')
      .insert({ user_id: this.userId, text, completed: false, position })
      .select()
      .single();

    if (error) {
      console.error('VisoesService.addGoalAction error:', error.message);
      return null;
    }

    return { id: data.id, text: data.text, completed: data.completed };
  }

  async toggleGoalAction(id: string, completed: boolean): Promise<boolean> {
    const { error } = await this.supabase
      .from('goal_actions')
      .update({ completed })
      .eq('id', id)
      .eq('user_id', this.userId);

    if (error) {
      console.error('VisoesService.toggleGoalAction error:', error.message);
      return false;
    }
    return true;
  }

  async deleteGoalAction(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('goal_actions')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId);

    if (error) {
      console.error('VisoesService.deleteGoalAction error:', error.message);
      return false;
    }
    return true;
  }

  async addReminder(text: string, dueDate: string | null): Promise<Reminder | null> {
    const { data, error } = await this.supabase
      .from('reminders')
      .insert({ user_id: this.userId, text, due_date: dueDate, completed: false })
      .select()
      .single();

    if (error) {
      console.error('VisoesService.addReminder error:', error.message);
      return null;
    }

    return { id: data.id, text: data.text, dueDate: data.due_date, completed: data.completed, createdAt: data.created_at };
  }

  async toggleReminder(id: string, completed: boolean): Promise<boolean> {
    const { error } = await this.supabase
      .from('reminders')
      .update({ completed })
      .eq('id', id)
      .eq('user_id', this.userId);

    if (error) {
      console.error('VisoesService.toggleReminder error:', error.message);
      return false;
    }
    return true;
  }

  async deleteReminder(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('reminders')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId);

    if (error) {
      console.error('VisoesService.deleteReminder error:', error.message);
      return false;
    }
    return true;
  }

  async addNote(title: string, content: string, color: string): Promise<Note | null> {
    const { data, error } = await this.supabase
      .from('notes')
      .insert({ user_id: this.userId, title, content, color })
      .select()
      .single();

    if (error) {
      console.error('VisoesService.addNote error:', error.message);
      return null;
    }

    return { id: data.id, title: data.title, content: data.content || '', color: data.color, createdAt: data.created_at, updatedAt: data.updated_at };
  }

  async updateNote(id: string, updates: Partial<Note>): Promise<boolean> {
    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.color !== undefined) dbUpdates.color = updates.color;

    const { error } = await this.supabase
      .from('notes')
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', this.userId);

    if (error) {
      console.error('VisoesService.updateNote error:', error.message);
      return false;
    }
    return true;
  }

  async deleteNote(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId);

    if (error) {
      console.error('VisoesService.deleteNote error:', error.message);
      return false;
    }
    return true;
  }

  async uploadImage(imageData: string): Promise<string> {
    if (!imageData.startsWith('data:')) return imageData;

    try {
      const response = await fetch(imageData);
      const blob = await response.blob();
      const ext = blob.type.split('/')[1] || 'png';
      const fileName = `${this.userId}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
      
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from('vision-board')
        .upload(fileName, blob, { contentType: blob.type, upsert: false });

      if (uploadError) {
        console.error('VisoesService.uploadImage error:', uploadError);
        return imageData;
      }

      const { data: publicUrlData } = this.supabase.storage
        .from('vision-board')
        .getPublicUrl(uploadData.path);

      return publicUrlData.publicUrl;
    } catch (e) {
      console.error('VisoesService.uploadImage error:', e);
      return imageData;
    }
  }
}
