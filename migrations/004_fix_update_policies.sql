-- Fix UPDATE policies to include WITH CHECK clause
-- This ensures updates work correctly with RLS

-- Fix kanban_columns update policy
DROP POLICY IF EXISTS "Users can update their own columns" ON kanban_columns;
CREATE POLICY "Users can update their own columns" ON kanban_columns
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fix kanban_cards update policy
DROP POLICY IF EXISTS "Users can update their own cards" ON kanban_cards;
CREATE POLICY "Users can update their own cards" ON kanban_cards
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fix pomodoro_settings update policy
DROP POLICY IF EXISTS "Users can update their own settings" ON pomodoro_settings;
CREATE POLICY "Users can update their own settings" ON pomodoro_settings
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fix active_sessions update policy
DROP POLICY IF EXISTS "Users can update their own active session" ON active_sessions;
CREATE POLICY "Users can update their own active session" ON active_sessions
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
