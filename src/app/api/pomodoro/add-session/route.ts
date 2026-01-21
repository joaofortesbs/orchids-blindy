import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  console.log('[API /pomodoro/add-session] Starting request...');
  
  try {
    const body = await request.json();
    const { categoryId, categoryName, durationMinutes, sessionDate, completedAt } = body;
    
    console.log('[API /pomodoro/add-session] Received:', { categoryId, categoryName, durationMinutes, sessionDate });
    
    if (!categoryId || !durationMinutes) {
      console.error('[API /pomodoro/add-session] Missing required fields');
      return NextResponse.json({ success: false, error: 'Missing required fields: categoryId and durationMinutes are required' }, { status: 400 });
    }
    
    const now = new Date();
    const finalSessionDate = sessionDate || now.toISOString().split('T')[0];
    const finalCompletedAt = completedAt || now.toISOString();
    
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
      console.error('[API /pomodoro/add-session] Auth error:', authError?.message);
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    console.log('[API /pomodoro/add-session] User authenticated:', user.id);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data, error } = await supabase
      .from('pomodoro_sessions')
      .insert({
        user_id: user.id,
        category_id: categoryId,
        category_name: categoryName || '',
        duration_minutes: durationMinutes,
        session_date: finalSessionDate,
        completed_at: finalCompletedAt,
      })
      .select()
      .single();
    
    if (error) {
      console.error('[API /pomodoro/add-session] Insert error:', error.message, error.code, error.details);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    console.log('[API /pomodoro/add-session] SUCCESS - Session created:', data.id);
    
    const session = {
      id: data.id,
      categoryId: data.category_id,
      duration: data.duration_minutes,
      completedAt: data.completed_at,
      date: data.session_date,
    };
    
    return NextResponse.json({ success: true, session });
    
  } catch (e) {
    console.error('[API /pomodoro/add-session] Exception:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
