import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { cardId, targetColumnId, position } = await req.json();
    
    if (!cardId || !targetColumnId || position === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: cardId, targetColumnId, position' },
        { status: 400 }
      );
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('[API move-card] Missing Supabase credentials');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    const cookieStore = await cookies();
    const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    });
    
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    
    if (authError || !user) {
      console.error('[API move-card] Unauthorized:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('[API move-card] User:', user.id, 'Calling RPC move_card:', { cardId, targetColumnId, position });
    
    const { data, error } = await supabase.rpc('move_card', {
      p_card_id: cardId,
      p_target_column_id: targetColumnId,
      p_new_position: position,
    });
    
    if (error) {
      console.error('[API move-card] RPC error:', error);
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 500 }
      );
    }
    
    console.log('[API move-card] SUCCESS for user', user.id, ':', data);
    
    return NextResponse.json({ 
      success: true, 
      data,
      timestamp: Date.now(),
    });
    
  } catch (error) {
    console.error('[API move-card] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
