import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function DELETE(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { cardId } = body;
    
    console.log('[API delete-card] Request received:', { cardId });
    
    if (!cardId) {
      console.error('[API delete-card] Missing required field: cardId');
      return NextResponse.json(
        { error: 'Missing required field: cardId' },
        { status: 400 }
      );
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('[API delete-card] Missing Supabase credentials');
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
      console.error('[API delete-card] Unauthorized:', authError?.message || 'No user');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('[API delete-card] User authenticated:', user.id);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: existingCard, error: cardCheckError } = await supabase
      .from('kanban_cards')
      .select('id, user_id')
      .eq('id', cardId)
      .single();
    
    if (cardCheckError || !existingCard) {
      console.error('[API delete-card] Card not found:', cardCheckError?.message);
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }
    
    if (existingCard.user_id !== user.id) {
      console.error('[API delete-card] Card not owned by user:', { cardUserId: existingCard.user_id, requestUserId: user.id });
      return NextResponse.json(
        { error: 'Access denied - card not owned by user' },
        { status: 403 }
      );
    }
    
    console.log('[API delete-card] Card ownership verified:', cardId);
    
    const { error: deleteError } = await supabase
      .from('kanban_cards')
      .delete()
      .eq('id', cardId)
      .eq('user_id', user.id);
    
    if (deleteError) {
      console.error('[API delete-card] Delete error:', {
        message: deleteError.message,
        code: deleteError.code,
        details: deleteError.details,
        hint: deleteError.hint,
      });
      return NextResponse.json(
        { error: deleteError.message, details: deleteError },
        { status: 500 }
      );
    }
    
    const duration = Date.now() - startTime;
    console.log('[API delete-card] SUCCESS:', {
      cardId,
      userId: user.id,
      duration: `${duration}ms`,
    });
    
    return NextResponse.json({ 
      success: true, 
      timestamp: Date.now(),
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[API delete-card] Unexpected error:', {
      error: String(error),
      duration: `${duration}ms`,
    });
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
