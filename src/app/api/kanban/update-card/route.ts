import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { cardId, title, description, priority, tags, subtasks } = body;
    
    console.log('[API update-card] Request received:', { cardId, title, priority });
    
    if (!cardId) {
      console.error('[API update-card] Missing required field: cardId');
      return NextResponse.json(
        { error: 'Missing required field: cardId' },
        { status: 400 }
      );
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('[API update-card] Missing Supabase credentials');
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
      console.error('[API update-card] Unauthorized:', authError?.message || 'No user');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('[API update-card] User authenticated:', user.id);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: existingCard, error: cardCheckError } = await supabase
      .from('kanban_cards')
      .select('id, user_id')
      .eq('id', cardId)
      .single();
    
    if (cardCheckError || !existingCard) {
      console.error('[API update-card] Card not found:', cardCheckError?.message);
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }
    
    if (existingCard.user_id !== user.id) {
      console.error('[API update-card] Card not owned by user:', { cardUserId: existingCard.user_id, requestUserId: user.id });
      return NextResponse.json(
        { error: 'Access denied - card not owned by user' },
        { status: 403 }
      );
    }
    
    console.log('[API update-card] Card ownership verified:', cardId);
    
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || '';
    if (priority !== undefined) updateData.priority = priority;
    if (tags !== undefined) updateData.tags = tags;
    if (subtasks !== undefined) updateData.subtasks = subtasks;
    
    console.log('[API update-card] Updating card:', { 
      cardId, 
      userId: user.id, 
      fields: Object.keys(updateData).filter(k => k !== 'updated_at'),
    });
    
    const { data: updatedCard, error: updateError } = await supabase
      .from('kanban_cards')
      .update(updateData)
      .eq('id', cardId)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('[API update-card] Update error:', {
        message: updateError.message,
        code: updateError.code,
        details: updateError.details,
        hint: updateError.hint,
      });
      return NextResponse.json(
        { error: updateError.message, details: updateError },
        { status: 500 }
      );
    }
    
    if (!updatedCard) {
      console.error('[API update-card] Update returned no data');
      return NextResponse.json(
        { error: 'Update failed - no data returned' },
        { status: 500 }
      );
    }
    
    const duration = Date.now() - startTime;
    console.log('[API update-card] SUCCESS:', {
      cardId: updatedCard.id,
      userId: user.id,
      duration: `${duration}ms`,
    });
    
    const responseCard = {
      id: updatedCard.id,
      title: updatedCard.title,
      description: updatedCard.description || '',
      priority: updatedCard.priority,
      tags: updatedCard.tags || [],
      subtasks: updatedCard.subtasks || [],
      createdAt: updatedCard.created_at,
      updatedAt: updatedCard.updated_at,
    };
    
    return NextResponse.json({ 
      success: true, 
      card: responseCard,
      timestamp: Date.now(),
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[API update-card] Unexpected error:', {
      error: String(error),
      duration: `${duration}ms`,
    });
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
