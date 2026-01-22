import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { columnId, title, description, priority, tags, subtasks, position, projectId, dueDate, completedAt } = body;
    
    console.log('[API add-card] Request received:', { columnId, title, position });
    
    if (!columnId || !title) {
      console.error('[API add-card] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: columnId, title' },
        { status: 400 }
      );
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('[API add-card] Missing Supabase credentials');
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
      console.error('[API add-card] Unauthorized:', authError?.message || 'No user');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('[API add-card] User authenticated:', user.id);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: column, error: columnError } = await supabase
      .from('kanban_columns')
      .select('id')
      .eq('id', columnId)
      .eq('user_id', user.id)
      .single();
    
    if (columnError || !column) {
      console.error('[API add-card] Column not found or not owned by user:', columnError?.message);
      return NextResponse.json(
        { error: 'Column not found or access denied' },
        { status: 404 }
      );
    }
    
    console.log('[API add-card] Column verified:', columnId);
    
    const cardData: Record<string, unknown> = {
      user_id: user.id,
      column_id: columnId,
      title: title.trim(),
      description: description?.trim() || '',
      priority: priority || 'media',
      tags: tags || [],
      subtasks: subtasks || [],
      position: position ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    if (projectId) cardData.project_id = projectId;
    if (dueDate) cardData.due_date = dueDate;
    if (completedAt) cardData.completed_at = completedAt;
    
    console.log('[API add-card] Inserting card:', { 
      userId: user.id, 
      columnId, 
      title: cardData.title,
      position: cardData.position 
    });
    
    const { data: newCard, error: insertError } = await supabase
      .from('kanban_cards')
      .insert(cardData)
      .select()
      .single();
    
    if (insertError) {
      console.error('[API add-card] Insert error:', {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      });
      return NextResponse.json(
        { error: insertError.message, details: insertError },
        { status: 500 }
      );
    }
    
    if (!newCard) {
      console.error('[API add-card] Insert returned no data');
      return NextResponse.json(
        { error: 'Insert failed - no data returned' },
        { status: 500 }
      );
    }
    
    const duration = Date.now() - startTime;
    console.log('[API add-card] SUCCESS:', {
      cardId: newCard.id,
      columnId: newCard.column_id,
      userId: user.id,
      duration: `${duration}ms`,
    });
    
    const responseCard = {
      id: newCard.id,
      title: newCard.title,
      description: newCard.description || '',
      priority: newCard.priority,
      tags: newCard.tags || [],
      subtasks: newCard.subtasks || [],
      createdAt: newCard.created_at,
      updatedAt: newCard.updated_at,
      projectId: newCard.project_id || undefined,
      dueDate: newCard.due_date || undefined,
      completedAt: newCard.completed_at || undefined,
    };
    
    return NextResponse.json({ 
      success: true, 
      card: responseCard,
      timestamp: Date.now(),
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[API add-card] Unexpected error:', {
      error: String(error),
      duration: `${duration}ms`,
    });
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
