-- Migration for Kanban board tables
-- Run this in your Supabase SQL Editor to create the necessary tables

-- Create kanban_columns table
CREATE TABLE IF NOT EXISTS kanban_columns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create kanban_cards table
CREATE TABLE IF NOT EXISTS kanban_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES kanban_columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  priority TEXT DEFAULT 'media' CHECK (priority IN ('alta', 'media', 'baixa')),
  tags JSONB DEFAULT '[]'::jsonb,
  subtasks JSONB DEFAULT '[]'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create pomodoro_sessions table if not exists
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  category_name TEXT,
  duration INTEGER NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create pomodoro_settings table if not exists
CREATE TABLE IF NOT EXISTS pomodoro_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create active_sessions table for timer state persistence
CREATE TABLE IF NOT EXISTS active_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  start_time TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  accumulated_seconds INTEGER DEFAULT 0,
  is_running BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_kanban_columns_user_id ON kanban_columns(user_id);
CREATE INDEX IF NOT EXISTS idx_kanban_columns_position ON kanban_columns(user_id, position);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_user_id ON kanban_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_column_id ON kanban_cards(column_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_position ON kanban_cards(column_id, position);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_id ON pomodoro_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_completed_at ON pomodoro_sessions(user_id, completed_at);

-- Enable Row Level Security
ALTER TABLE kanban_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE pomodoro_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pomodoro_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kanban_columns
DROP POLICY IF EXISTS "Users can view their own columns" ON kanban_columns;
CREATE POLICY "Users can view their own columns" ON kanban_columns
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own columns" ON kanban_columns;
CREATE POLICY "Users can create their own columns" ON kanban_columns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own columns" ON kanban_columns;
CREATE POLICY "Users can update their own columns" ON kanban_columns
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own columns" ON kanban_columns;
CREATE POLICY "Users can delete their own columns" ON kanban_columns
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for kanban_cards
DROP POLICY IF EXISTS "Users can view their own cards" ON kanban_cards;
CREATE POLICY "Users can view their own cards" ON kanban_cards
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own cards" ON kanban_cards;
CREATE POLICY "Users can create their own cards" ON kanban_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own cards" ON kanban_cards;
CREATE POLICY "Users can update their own cards" ON kanban_cards
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own cards" ON kanban_cards;
CREATE POLICY "Users can delete their own cards" ON kanban_cards
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for pomodoro_sessions
DROP POLICY IF EXISTS "Users can view their own sessions" ON pomodoro_sessions;
CREATE POLICY "Users can view their own sessions" ON pomodoro_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own sessions" ON pomodoro_sessions;
CREATE POLICY "Users can create their own sessions" ON pomodoro_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sessions" ON pomodoro_sessions;
CREATE POLICY "Users can delete their own sessions" ON pomodoro_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for pomodoro_settings
DROP POLICY IF EXISTS "Users can view their own settings" ON pomodoro_settings;
CREATE POLICY "Users can view their own settings" ON pomodoro_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own settings" ON pomodoro_settings;
CREATE POLICY "Users can create their own settings" ON pomodoro_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own settings" ON pomodoro_settings;
CREATE POLICY "Users can update their own settings" ON pomodoro_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for active_sessions
DROP POLICY IF EXISTS "Users can view their own active session" ON active_sessions;
CREATE POLICY "Users can view their own active session" ON active_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own active session" ON active_sessions;
CREATE POLICY "Users can create their own active session" ON active_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own active session" ON active_sessions;
CREATE POLICY "Users can update their own active session" ON active_sessions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own active session" ON active_sessions;
CREATE POLICY "Users can delete their own active session" ON active_sessions
  FOR DELETE USING (auth.uid() = user_id);
