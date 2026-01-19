import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: { status: string; latency?: number; error?: string };
    auth: { status: string; error?: string };
    tables: { name: string; status: string; count?: number; error?: string }[];
  };
  autoFixes: { table: string; action: string; result: string }[];
}

const REQUIRED_TABLES = [
  'profiles',
  'pomodoro_settings',
  'pomodoro_categories',
  'pomodoro_sessions',
  'kanban_columns',
  'kanban_cards',
  'vision_boards',
  'main_goals',
  'goal_actions',
  'goal_categories',
  'goals',
  'books',
  'reminders',
  'notes',
  'future_letters',
  'bank_accounts',
  'transactions',
  'user_settings',
];

async function checkDatabaseConnection(supabase: ReturnType<typeof createClient>): Promise<{ status: string; latency?: number; error?: string }> {
  const start = Date.now();
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    const latency = Date.now() - start;
    
    if (error && !error.message.includes('no rows')) {
      return { status: 'error', latency, error: error.message };
    }
    
    return { status: 'ok', latency };
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

async function checkTable(supabase: ReturnType<typeof createClient>, tableName: string): Promise<{ name: string; status: string; count?: number; error?: string }> {
  try {
    const { count, error } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
    
    if (error) {
      return { name: tableName, status: 'error', error: error.message };
    }
    
    return { name: tableName, status: 'ok', count: count || 0 };
  } catch (e) {
    return { name: tableName, status: 'error', error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

async function autoFixUserData(supabase: ReturnType<typeof createClient>, userId: string): Promise<{ table: string; action: string; result: string }[]> {
  const fixes: { table: string; action: string; result: string }[] = [];

  try {
    const { data: settings } = await supabase.from('pomodoro_settings').select('id').eq('user_id', userId).single();
    
    if (!settings) {
      await supabase.from('pomodoro_settings').insert({
        user_id: userId,
        short_break_minutes: 5,
        long_break_minutes: 15,
        cycles_until_long_break: 4,
      });
      fixes.push({ table: 'pomodoro_settings', action: 'create_default', result: 'success' });
    }
  } catch (e) {
    fixes.push({ table: 'pomodoro_settings', action: 'create_default', result: `error: ${e instanceof Error ? e.message : 'unknown'}` });
  }

  try {
    const { data: categories } = await supabase.from('pomodoro_categories').select('id').eq('user_id', userId);
    
    if (!categories || categories.length === 0) {
      const defaultCategories = [
        { name: 'Trabalho', color: '#ef4444', duration_minutes: 25 },
        { name: 'Estudo', color: '#3b82f6', duration_minutes: 30 },
        { name: 'Projeto', color: '#22c55e', duration_minutes: 45 },
      ];
      
      for (const cat of defaultCategories) {
        await supabase.from('pomodoro_categories').insert({ user_id: userId, ...cat });
      }
      fixes.push({ table: 'pomodoro_categories', action: 'create_defaults', result: 'success' });
    }
  } catch (e) {
    fixes.push({ table: 'pomodoro_categories', action: 'create_defaults', result: `error: ${e instanceof Error ? e.message : 'unknown'}` });
  }

  try {
    const { data: columns } = await supabase.from('kanban_columns').select('id').eq('user_id', userId);
    
    if (!columns || columns.length === 0) {
      const defaultColumns = [
        { title: 'A FAZER', position: 0 },
        { title: 'EM PROGRESSO', position: 1 },
        { title: 'CONCLUÍDO', position: 2 },
      ];
      
      for (const col of defaultColumns) {
        await supabase.from('kanban_columns').insert({ user_id: userId, ...col });
      }
      fixes.push({ table: 'kanban_columns', action: 'create_defaults', result: 'success' });
    }
  } catch (e) {
    fixes.push({ table: 'kanban_columns', action: 'create_defaults', result: `error: ${e instanceof Error ? e.message : 'unknown'}` });
  }

  try {
    const { data: goalCats } = await supabase.from('goal_categories').select('id').eq('user_id', userId);
    
    if (!goalCats || goalCats.length === 0) {
      const defaultGoalCategories = [
        { name: 'Saúde', icon: '❤️', position: 0 },
        { name: 'Carreira', icon: '💼', position: 1 },
        { name: 'Finanças', icon: '💰', position: 2 },
        { name: 'Relacionamentos', icon: '👥', position: 3 },
        { name: 'Desenvolvimento Pessoal', icon: '🎯', position: 4 },
        { name: 'Lazer', icon: '🎮', position: 5 },
      ];
      
      for (const cat of defaultGoalCategories) {
        await supabase.from('goal_categories').insert({ user_id: userId, ...cat });
      }
      fixes.push({ table: 'goal_categories', action: 'create_defaults', result: 'success' });
    }
  } catch (e) {
    fixes.push({ table: 'goal_categories', action: 'create_defaults', result: `error: ${e instanceof Error ? e.message : 'unknown'}` });
  }

  try {
    const { data: userSettings } = await supabase.from('user_settings').select('id').eq('user_id', userId).single();
    
    if (!userSettings) {
      await supabase.from('user_settings').insert({
        user_id: userId,
        selected_year: new Date().getFullYear(),
        theme: 'dark',
      });
      fixes.push({ table: 'user_settings', action: 'create_default', result: 'success' });
    }
  } catch (e) {
    fixes.push({ table: 'user_settings', action: 'create_default', result: `error: ${e instanceof Error ? e.message : 'unknown'}` });
  }

  return fixes;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const autoFix = searchParams.get('autoFix') === 'true';

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: 'error', error: 'Missing Supabase configuration' },
        auth: { status: 'error', error: 'Missing configuration' },
        tables: [],
      },
      autoFixes: [],
    } as HealthCheckResult, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'pending' },
      auth: { status: 'ok' },
      tables: [],
    },
    autoFixes: [],
  };

  result.checks.database = await checkDatabaseConnection(supabase);
  if (result.checks.database.status !== 'ok') {
    result.status = 'unhealthy';
  }

  for (const table of REQUIRED_TABLES) {
    const tableCheck = await checkTable(supabase, table);
    result.checks.tables.push(tableCheck);
    if (tableCheck.status !== 'ok') {
      result.status = 'degraded';
    }
  }

  if (userId && autoFix) {
    result.autoFixes = await autoFixUserData(supabase, userId);
  }

  const hasErrors = result.checks.tables.some(t => t.status === 'error');
  if (hasErrors) {
    result.status = 'degraded';
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, action } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing userId or action' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (action) {
      case 'fix_user_data':
        const fixes = await autoFixUserData(supabase, userId);
        return NextResponse.json({ success: true, fixes });

      case 'validate_sessions':
        const { data: sessions, error: sessionsError } = await supabase
          .from('pomodoro_sessions')
          .select('id, category_id, duration_minutes')
          .eq('user_id', userId);

        if (sessionsError) {
          return NextResponse.json({ error: sessionsError.message }, { status: 500 });
        }

        const invalidSessions = sessions?.filter(s => !s.category_id || s.duration_minutes <= 0) || [];
        
        if (invalidSessions.length > 0) {
          for (const session of invalidSessions) {
            if (session.duration_minutes <= 0) {
              await supabase.from('pomodoro_sessions').delete().eq('id', session.id);
            }
          }
        }

        return NextResponse.json({ 
          success: true, 
          totalSessions: sessions?.length || 0,
          invalidRemoved: invalidSessions.length,
        });

      case 'cleanup_orphans':
        const { data: categories } = await supabase
          .from('pomodoro_categories')
          .select('id')
          .eq('user_id', userId);
        
        const categoryIds = categories?.map(c => c.id) || [];
        
        if (categoryIds.length > 0) {
          const { data: orphanSessions } = await supabase
            .from('pomodoro_sessions')
            .select('id, category_id')
            .eq('user_id', userId)
            .not('category_id', 'in', `(${categoryIds.join(',')})`);
          
          const orphanCount = orphanSessions?.length || 0;
          
          if (orphanCount > 0 && categoryIds[0]) {
            await supabase
              .from('pomodoro_sessions')
              .update({ category_id: categoryIds[0] })
              .eq('user_id', userId)
              .not('category_id', 'in', `(${categoryIds.join(',')})`);
          }
          
          return NextResponse.json({ success: true, orphansFixed: orphanCount });
        }
        
        return NextResponse.json({ success: true, orphansFixed: 0 });

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
