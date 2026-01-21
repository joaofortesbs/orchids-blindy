-- Migration 009: Create Pomodoro tables with robust persistence
-- Run this in your Supabase SQL Editor

-- 1. Create pomodoro_settings table for interval configuration
CREATE TABLE IF NOT EXISTS pomodoro_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  short_break_minutes INTEGER NOT NULL DEFAULT 5,
  long_break_minutes INTEGER NOT NULL DEFAULT 15,
  cycles_until_long_break INTEGER NOT NULL DEFAULT 4,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create pomodoro_categories table for timer categories
CREATE TABLE IF NOT EXISTS pomodoro_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50) NOT NULL DEFAULT '#3b82f6',
  duration_minutes INTEGER NOT NULL DEFAULT 25,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create pomodoro_sessions table for completed sessions
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category_id UUID REFERENCES pomodoro_categories(id) ON DELETE SET NULL,
  category_name VARCHAR(255),
  duration_minutes INTEGER NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pomodoro_settings_user_id ON pomodoro_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_categories_user_id ON pomodoro_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_id ON pomodoro_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_date ON pomodoro_sessions(session_date);

-- 5. Create unique index to prevent duplicate category names per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_pomodoro_categories_user_name ON pomodoro_categories(user_id, name);

-- 6. Disable RLS for service role access (optional - service role bypasses RLS anyway)
ALTER TABLE pomodoro_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE pomodoro_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE pomodoro_sessions DISABLE ROW LEVEL SECURITY;

-- Verification query (run separately to check tables exist):
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'pomodoro%';
