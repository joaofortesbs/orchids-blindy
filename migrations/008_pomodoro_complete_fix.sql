-- Migration 008: Complete Pomodoro Tables Fix
-- This migration creates all pomodoro-related tables with the correct schema
-- Run this in your Supabase SQL Editor
-- IMPORTANT: This migration will DROP and recreate tables to fix schema issues

-- ==============================================
-- 0. DROP EXISTING TABLES WITH WRONG SCHEMA
-- ==============================================
DROP TABLE IF EXISTS pomodoro_sessions CASCADE;
DROP TABLE IF EXISTS pomodoro_settings CASCADE;
DROP TABLE IF EXISTS pomodoro_categories CASCADE;
DROP TABLE IF EXISTS active_sessions CASCADE;

-- ==============================================
-- 1. CREATE POMODORO_CATEGORIES TABLE
-- ==============================================
CREATE TABLE pomodoro_categories (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#00f6ff',
  duration_minutes INTEGER NOT NULL DEFAULT 25,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 2. CREATE POMODORO_SESSIONS TABLE (CORRECT SCHEMA)
-- ==============================================
CREATE TABLE pomodoro_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  category_name TEXT,
  duration_minutes INTEGER NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  session_date TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 3. CREATE POMODORO_SETTINGS TABLE (CORRECT SCHEMA)
-- ==============================================
CREATE TABLE pomodoro_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  short_break_minutes INTEGER NOT NULL DEFAULT 5,
  long_break_minutes INTEGER NOT NULL DEFAULT 15,
  cycles_until_long_break INTEGER NOT NULL DEFAULT 4,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 4. CREATE ACTIVE_SESSIONS TABLE (FOR TIMER STATE)
-- ==============================================
CREATE TABLE active_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  start_time TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  accumulated_seconds INTEGER DEFAULT 0,
  is_running BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- ==============================================
CREATE INDEX IF NOT EXISTS idx_pomodoro_categories_user_id ON pomodoro_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_id ON pomodoro_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_date ON pomodoro_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_completed_at ON pomodoro_sessions(user_id, completed_at DESC);

-- ==============================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ==============================================
ALTER TABLE pomodoro_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pomodoro_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pomodoro_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- 7. RLS POLICIES FOR POMODORO_CATEGORIES
-- ==============================================
DROP POLICY IF EXISTS "pomodoro_categories_select" ON pomodoro_categories;
CREATE POLICY "pomodoro_categories_select" ON pomodoro_categories
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pomodoro_categories_insert" ON pomodoro_categories;
CREATE POLICY "pomodoro_categories_insert" ON pomodoro_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pomodoro_categories_update" ON pomodoro_categories;
CREATE POLICY "pomodoro_categories_update" ON pomodoro_categories
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pomodoro_categories_delete" ON pomodoro_categories;
CREATE POLICY "pomodoro_categories_delete" ON pomodoro_categories
  FOR DELETE USING (auth.uid() = user_id);

-- ==============================================
-- 8. RLS POLICIES FOR POMODORO_SESSIONS
-- ==============================================
DROP POLICY IF EXISTS "pomodoro_sessions_select" ON pomodoro_sessions;
CREATE POLICY "pomodoro_sessions_select" ON pomodoro_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pomodoro_sessions_insert" ON pomodoro_sessions;
CREATE POLICY "pomodoro_sessions_insert" ON pomodoro_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pomodoro_sessions_delete" ON pomodoro_sessions;
CREATE POLICY "pomodoro_sessions_delete" ON pomodoro_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ==============================================
-- 9. RLS POLICIES FOR POMODORO_SETTINGS
-- ==============================================
DROP POLICY IF EXISTS "pomodoro_settings_select" ON pomodoro_settings;
CREATE POLICY "pomodoro_settings_select" ON pomodoro_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pomodoro_settings_insert" ON pomodoro_settings;
CREATE POLICY "pomodoro_settings_insert" ON pomodoro_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pomodoro_settings_update" ON pomodoro_settings;
CREATE POLICY "pomodoro_settings_update" ON pomodoro_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==============================================
-- 10. RLS POLICIES FOR ACTIVE_SESSIONS
-- ==============================================
DROP POLICY IF EXISTS "active_sessions_select" ON active_sessions;
CREATE POLICY "active_sessions_select" ON active_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "active_sessions_insert" ON active_sessions;
CREATE POLICY "active_sessions_insert" ON active_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "active_sessions_update" ON active_sessions;
CREATE POLICY "active_sessions_update" ON active_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "active_sessions_delete" ON active_sessions;
CREATE POLICY "active_sessions_delete" ON active_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ==============================================
-- 11. SERVICE ROLE BYPASS POLICIES (FOR API ROUTES)
-- ==============================================
DROP POLICY IF EXISTS "service_role_pomodoro_sessions" ON pomodoro_sessions;
CREATE POLICY "service_role_pomodoro_sessions" ON pomodoro_sessions
  FOR ALL USING (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
  );

DROP POLICY IF EXISTS "service_role_pomodoro_categories" ON pomodoro_categories;
CREATE POLICY "service_role_pomodoro_categories" ON pomodoro_categories
  FOR ALL USING (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
  );

DROP POLICY IF EXISTS "service_role_pomodoro_settings" ON pomodoro_settings;
CREATE POLICY "service_role_pomodoro_settings" ON pomodoro_settings
  FOR ALL USING (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
  );

DROP POLICY IF EXISTS "service_role_active_sessions" ON active_sessions;
CREATE POLICY "service_role_active_sessions" ON active_sessions
  FOR ALL USING (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
  );

-- ==============================================
-- 12. RPC FUNCTION FOR ADDING SESSION (WITH USER ID PARAM)
-- ==============================================
CREATE OR REPLACE FUNCTION add_pomodoro_session(
  p_user_id UUID,
  p_category_id TEXT,
  p_category_name TEXT,
  p_duration_minutes INTEGER,
  p_session_date TEXT,
  p_completed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO pomodoro_sessions (
    user_id,
    category_id,
    category_name,
    duration_minutes,
    session_date,
    completed_at
  ) VALUES (
    p_user_id,
    p_category_id,
    p_category_name,
    p_duration_minutes,
    p_session_date,
    p_completed_at
  )
  RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION add_pomodoro_session TO authenticated;
GRANT EXECUTE ON FUNCTION add_pomodoro_session TO service_role;
