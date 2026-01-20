import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { columnId, cardPositions } = await req.json();
    
    if (!columnId || !cardPositions || !Array.isArray(cardPositions)) {
      return NextResponse.json(
        { error: 'Missing required fields: columnId, cardPositions' },
        { status: 400 }
      );
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('[API reorder-cards] Missing Supabase credentials');
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
      console.error('[API reorder-cards] Unauthorized:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const formattedPositions = cardPositions.map(p => ({
      id: p.cardId,
      position: p.position,
    }));
    
    console.log('[API reorder-cards] User:', user.id, 'Calling RPC update_card_positions:', { columnId, positions: formattedPositions });
    
    const { data, error } = await supabase.rpc('update_card_positions', {
      p_column_id: columnId,
      p_positions: formattedPositions,
    });
    
    if (error) {
      console.error('[API reorder-cards] RPC error:', error);
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 500 }
      );
    }
    
    console.log('[API reorder-cards] SUCCESS for user', user.id, ':', data);
    
    return NextResponse.json({ 
      success: true, 
      data,
      timestamp: Date.now(),
    });
    
  } catch (error) {
    console.error('[API reorder-cards] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
