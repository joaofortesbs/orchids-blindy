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
    
    // Format for RPC: array of { id, column_id, position }
    // The RPC function update_card_positions expects p_updates as JSONB array
    const formattedUpdates = cardPositions.map((p: { cardId: string; position: number }) => ({
      id: p.cardId,
      column_id: columnId,
      position: p.position,
    }));
    
    console.log('[API reorder-cards] User:', user.id, 'Calling RPC update_card_positions with p_updates:', formattedUpdates);
    
    const { data, error } = await supabase.rpc('update_card_positions', {
      p_user_id: user.id,
      p_updates: formattedUpdates,
    });
    
    if (error) {
      console.error('[API reorder-cards] RPC error:', error);
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 500 }
      );
    }
    
    console.log('[API reorder-cards] SUCCESS for user', user.id, ':', data);
    
    if (data && !data.success) {
      console.error('[API reorder-cards] RPC returned failure:', data);
      return NextResponse.json(
        { error: data.error || 'Operation failed', success: false },
        { status: 400 }
      );
    }
    
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
