import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  console.log('[API /pomodoro/update-settings] Starting request...');
  
  try {
    const body = await request.json();
    const { categories, intervals } = body;
    
    console.log('[API /pomodoro/update-settings] Received:', { 
      categoriesCount: categories?.length, 
      intervals 
    });
    
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
      console.error('[API /pomodoro/update-settings] Auth error:', authError?.message);
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    console.log('[API /pomodoro/update-settings] User authenticated:', user.id);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    if (intervals) {
      console.log('[API /pomodoro/update-settings] Saving intervals for user:', user.id, intervals);
      console.log('[API /pomodoro/update-settings] Supabase URL:', supabaseUrl);
      
      const { data: settingsData, error: settingsError, count: settingsCount } = await supabase
        .from('pomodoro_settings')
        .upsert(
          {
            user_id: user.id,
            short_break_minutes: intervals.shortBreak,
            long_break_minutes: intervals.longBreak,
            cycles_until_long_break: intervals.cyclesUntilLongBreak,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select();
      
      if (settingsError) {
        console.error('[API /pomodoro/update-settings] Settings error:', settingsError.message, settingsError.code, settingsError.details);
        return NextResponse.json({ success: false, error: settingsError.message }, { status: 500 });
      }
      console.log('[API /pomodoro/update-settings] Intervals saved successfully, returned data:', JSON.stringify(settingsData));
    }
    
    if (categories && Array.isArray(categories)) {
      console.log('[API /pomodoro/update-settings] Processing', categories.length, 'categories');
      console.log('[API /pomodoro/update-settings] Full categories payload:', JSON.stringify(categories));
      
      const { data: existingCats, error: fetchError } = await supabase
        .from('pomodoro_categories')
        .select('id')
        .eq('user_id', user.id);
      
      if (fetchError) {
        console.error('[API /pomodoro/update-settings] Error fetching existing categories:', fetchError.message, fetchError.code);
      }
      
      console.log('[API /pomodoro/update-settings] Existing categories in DB:', JSON.stringify(existingCats));
      
      const existingIds = new Set((existingCats || []).map(c => c.id));
      const newCatIds = new Set(categories.map((c: any) => c.id));
      
      console.log('[API /pomodoro/update-settings] Existing IDs:', [...existingIds]);
      console.log('[API /pomodoro/update-settings] New category IDs:', [...newCatIds]);
      
      const toDelete = [...existingIds].filter(id => !newCatIds.has(id));
      if (toDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('pomodoro_categories')
          .delete()
          .in('id', toDelete);
        
        if (deleteError) {
          console.error('[API /pomodoro/update-settings] Delete categories error:', deleteError.message);
        } else {
          console.log('[API /pomodoro/update-settings] Deleted', toDelete.length, 'categories');
        }
      }
      
      for (const cat of categories) {
        if (!cat.id) {
          console.warn('[API /pomodoro/update-settings] Category without ID, skipping:', cat);
          continue;
        }
        
        const durationValue = typeof cat.duration === 'number' && cat.duration > 0 ? cat.duration : 25;
        const categoryData = {
          name: cat.name || 'Sem nome',
          color: cat.color || '#3b82f6',
          duration_minutes: durationValue,
        };
        
        console.log('[API /pomodoro/update-settings] Processing category:', cat.id, 'exists:', existingIds.has(cat.id), 'data:', JSON.stringify(categoryData));
        
        if (existingIds.has(cat.id)) {
          const { data: updateData, error } = await supabase.from('pomodoro_categories')
            .update(categoryData)
            .eq('id', cat.id)
            .eq('user_id', user.id)
            .select();
          
          if (error) {
            console.error('[API /pomodoro/update-settings] Update category error:', cat.id, error.message, error.code, error.details);
          } else {
            console.log('[API /pomodoro/update-settings] Updated category:', cat.id, 'result:', JSON.stringify(updateData));
          }
        } else {
          const insertPayload = {
            id: cat.id,
            user_id: user.id,
            ...categoryData,
          };
          console.log('[API /pomodoro/update-settings] Inserting new category:', JSON.stringify(insertPayload));
          
          const { data: insertData, error } = await supabase.from('pomodoro_categories')
            .insert(insertPayload)
            .select();
          
          if (error) {
            console.error('[API /pomodoro/update-settings] Insert category error:', cat.id, error.message, error.code, error.details);
          } else {
            console.log('[API /pomodoro/update-settings] Inserted category:', cat.id, 'result:', JSON.stringify(insertData));
          }
        }
      }
    }
    
    console.log('[API /pomodoro/update-settings] SUCCESS');
    return NextResponse.json({ success: true });
    
  } catch (e) {
    console.error('[API /pomodoro/update-settings] Exception:', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
