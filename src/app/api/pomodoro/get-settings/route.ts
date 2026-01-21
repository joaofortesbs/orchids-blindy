import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  console.log('[API /pomodoro/get-settings] Starting request...');
  
  try {
    const cookieStore = await cookies();
    const authClient = createServerClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );
    
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    
    if (authError || !user) {
      console.error('[API /pomodoro/get-settings] Auth error:', authError?.message);
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    console.log('[API /pomodoro/get-settings] User authenticated:', user.id);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const [catRes, setRes] = await Promise.all([
      supabase.from('pomodoro_categories').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('pomodoro_settings').select('*').eq('user_id', user.id).single(),
    ]);
    
    console.log('[API /pomodoro/get-settings] Categories response:', {
      count: catRes.data?.length || 0,
      error: catRes.error?.message,
      data: catRes.data,
    });
    
    console.log('[API /pomodoro/get-settings] Settings response:', {
      data: setRes.data,
      error: setRes.error?.message,
    });
    
    const categories = (catRes.data || []).map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      color: cat.color,
      duration: cat.duration_minutes,
    }));
    
    const settings = {
      categories,
      intervals: {
        shortBreak: setRes.data?.short_break_minutes ?? 5,
        longBreak: setRes.data?.long_break_minutes ?? 15,
        cyclesUntilLongBreak: setRes.data?.cycles_until_long_break ?? 4,
      },
    };
    
    console.log('[API /pomodoro/get-settings] Returning settings:', JSON.stringify(settings));
    
    return NextResponse.json({ success: true, settings });
    
  } catch (e) {
    console.error('[API /pomodoro/get-settings] Exception:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
