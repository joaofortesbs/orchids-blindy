import { SupabaseClient } from '@supabase/supabase-js';
import { PomodoroSession, PomodoroSettings, PomodoroCategory, DEFAULT_POMODORO_SETTINGS } from '@/lib/types/blindados';

export class PomodoroService {
  constructor(private supabase: SupabaseClient, private userId: string) {}

  async loadData(): Promise<{ sessions: PomodoroSession[]; settings: PomodoroSettings }> {
    const [catRes, sesRes, setRes] = await Promise.all([
      this.supabase.from('pomodoro_categories').select('*').eq('user_id', this.userId).order('created_at'),
      this.supabase.from('pomodoro_sessions').select('*').eq('user_id', this.userId).order('completed_at', { ascending: false }),
      this.supabase.from('pomodoro_settings').select('*').eq('user_id', this.userId).single(),
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

    return { sessions, settings };
  }

  async addSession(session: Omit<PomodoroSession, 'id'>, categoryName: string): Promise<PomodoroSession | null> {
    const { data, error } = await this.supabase
      .from('pomodoro_sessions')
      .insert({
        user_id: this.userId,
        category_id: session.categoryId,
        category_name: categoryName,
        duration_minutes: session.duration,
        completed_at: session.completedAt,
        session_date: session.date,
      })
      .select()
      .single();

    if (error) {
      console.error('PomodoroService.addSession error:', error.message);
      return null;
    }

    return {
      id: data.id,
      categoryId: data.category_id,
      duration: data.duration_minutes,
      completedAt: data.completed_at,
      date: data.session_date,
    };
  }

  async updateSettings(settings: PomodoroSettings): Promise<boolean> {
    const { error } = await this.supabase.from('pomodoro_settings').upsert({
      user_id: this.userId,
      short_break_minutes: settings.intervals.shortBreak,
      long_break_minutes: settings.intervals.longBreak,
      cycles_until_long_break: settings.intervals.cyclesUntilLongBreak,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('PomodoroService.updateSettings error:', error.message);
      return false;
    }

    for (const cat of settings.categories) {
      if (!cat.id || cat.id.startsWith('temp_') || !cat.id.includes('-')) continue;
      await this.supabase.from('pomodoro_categories').upsert({
        id: cat.id,
        user_id: this.userId,
        name: cat.name,
        color: cat.color,
        duration_minutes: cat.duration || 25,
      });
    }

    return true;
  }
}
