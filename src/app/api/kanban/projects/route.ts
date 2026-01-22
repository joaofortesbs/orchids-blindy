import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('[API projects] Missing Supabase credentials');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const cookieStore = await cookies();
    const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: { getAll() { return cookieStore.getAll(); } },
    });
    
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: projects, error } = await supabase
      .from('kanban_projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('[API projects] GET error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    const formattedProjects = (projects || []).map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      createdAt: p.created_at,
    }));
    
    return NextResponse.json({ success: true, projects: formattedProjects });
  } catch (error) {
    console.error('[API projects] GET exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, color } = body;
    
    console.log('[API projects] POST request:', { name, color });
    
    if (!name || !color) {
      return NextResponse.json({ error: 'Missing required fields: name, color' }, { status: 400 });
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('[API projects] Missing Supabase credentials');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const cookieStore = await cookies();
    const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: { getAll() { return cookieStore.getAll(); } },
    });
    
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    
    if (authError || !user) {
      console.error('[API projects] Unauthorized:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[API projects] User authenticated:', user.id);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: project, error } = await supabase
      .from('kanban_projects')
      .insert({
        user_id: user.id,
        name,
        color,
      })
      .select()
      .single();
    
    if (error) {
      console.error('[API projects] POST error:', error.message, error.details, error.hint);
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }
    
    console.log('[API projects] POST success:', project.id);
    
    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        color: project.color,
        createdAt: project.created_at,
      },
    });
  } catch (error) {
    console.error('[API projects] POST exception:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId } = body;
    
    console.log('[API projects] DELETE request:', { projectId });
    
    if (!projectId) {
      return NextResponse.json({ error: 'Missing required field: projectId' }, { status: 400 });
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const cookieStore = await cookies();
    const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: { getAll() { return cookieStore.getAll(); } },
    });
    
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: existingProject, error: checkError } = await supabase
      .from('kanban_projects')
      .select('id, user_id')
      .eq('id', projectId)
      .single();
    
    if (checkError || !existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    if (existingProject.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    const { error: deleteError } = await supabase
      .from('kanban_projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', user.id);
    
    if (deleteError) {
      console.error('[API projects] DELETE error:', deleteError.message);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    
    console.log('[API projects] DELETE success:', projectId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API projects] DELETE exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
