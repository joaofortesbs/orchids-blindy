-- ============================================================================
-- MIGRATION 006: DEFINITIVE KANBAN FIX
-- Execute EVERYTHING in your Supabase SQL Editor
-- This is the FINAL fix for all card movement and persistence issues
-- ============================================================================

-- ============================================================================
-- STEP 1: ENSURE TABLE STRUCTURE IS CORRECT
-- ============================================================================

-- Ensure kanban_cards has all required columns
ALTER TABLE kanban_cards 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure kanban_columns has all required columns  
ALTER TABLE kanban_columns 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- STEP 2: CREATE OPTIMIZED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_kanban_columns_user_position;
DROP INDEX IF EXISTS idx_kanban_cards_column_position;
DROP INDEX IF EXISTS idx_kanban_cards_user_column;
DROP INDEX IF EXISTS idx_cards_user_col_pos;

CREATE INDEX IF NOT EXISTS idx_kanban_columns_user_pos 
  ON kanban_columns(user_id, position);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_col_pos 
  ON kanban_cards(column_id, position);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_user 
  ON kanban_cards(user_id);

-- ============================================================================
-- STEP 3: DROP ALL OLD RLS POLICIES AND CREATE NEW ONES
-- ============================================================================

-- Drop ALL existing policies on kanban_columns
DROP POLICY IF EXISTS "Users can view their own columns" ON kanban_columns;
DROP POLICY IF EXISTS "Users can create their own columns" ON kanban_columns;
DROP POLICY IF EXISTS "Users can update their own columns" ON kanban_columns;
DROP POLICY IF EXISTS "Users can delete their own columns" ON kanban_columns;
DROP POLICY IF EXISTS "kanban_columns_select" ON kanban_columns;
DROP POLICY IF EXISTS "kanban_columns_insert" ON kanban_columns;
DROP POLICY IF EXISTS "kanban_columns_update" ON kanban_columns;
DROP POLICY IF EXISTS "kanban_columns_delete" ON kanban_columns;

-- Drop ALL existing policies on kanban_cards
DROP POLICY IF EXISTS "Users can view their own cards" ON kanban_cards;
DROP POLICY IF EXISTS "Users can create their own cards" ON kanban_cards;
DROP POLICY IF EXISTS "Users can update their own cards" ON kanban_cards;
DROP POLICY IF EXISTS "Users can delete their own cards" ON kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_select" ON kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_insert" ON kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_update" ON kanban_cards;
DROP POLICY IF EXISTS "kanban_cards_delete" ON kanban_cards;

-- Enable RLS
ALTER TABLE kanban_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_cards ENABLE ROW LEVEL SECURITY;

-- Create SIMPLE and EFFECTIVE policies for kanban_columns
CREATE POLICY "columns_select" ON kanban_columns
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "columns_insert" ON kanban_columns
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "columns_update" ON kanban_columns
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "columns_delete" ON kanban_columns
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Create SIMPLE and EFFECTIVE policies for kanban_cards
CREATE POLICY "cards_select" ON kanban_cards
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "cards_insert" ON kanban_cards
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cards_update" ON kanban_cards
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cards_delete" ON kanban_cards
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 4: CREATE ATOMIC RPC FUNCTIONS
-- ============================================================================

-- Function to move a single card to another column
DROP FUNCTION IF EXISTS move_card(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS move_card(UUID, UUID, UUID, INTEGER);

CREATE OR REPLACE FUNCTION move_card(
  p_card_id UUID,
  p_target_column_id UUID,
  p_new_position INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_old_column_id UUID;
  v_result JSONB;
BEGIN
  -- Get the current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get the current column of the card and verify ownership
  SELECT column_id INTO v_old_column_id
  FROM kanban_cards 
  WHERE id = p_card_id AND user_id = v_user_id;
  
  IF v_old_column_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Card not found or not owned by user');
  END IF;
  
  -- Verify target column exists and is owned by user
  IF NOT EXISTS (SELECT 1 FROM kanban_columns WHERE id = p_target_column_id AND user_id = v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target column not found or not owned by user');
  END IF;
  
  -- Update the card
  UPDATE kanban_cards 
  SET 
    column_id = p_target_column_id,
    position = p_new_position,
    updated_at = NOW()
  WHERE id = p_card_id AND user_id = v_user_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'card_id', p_card_id,
    'old_column_id', v_old_column_id,
    'new_column_id', p_target_column_id,
    'new_position', p_new_position
  );
END;
$$;

-- Function to update multiple card positions at once (for reordering within column)
DROP FUNCTION IF EXISTS update_card_positions(JSONB);

CREATE OR REPLACE FUNCTION update_card_positions(
  p_updates JSONB -- Array of { "id": "uuid", "column_id": "uuid", "position": number }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_item JSONB;
  v_card_id UUID;
  v_column_id UUID;
  v_position INTEGER;
  v_count INTEGER := 0;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    v_card_id := (v_item->>'id')::UUID;
    v_column_id := (v_item->>'column_id')::UUID;
    v_position := (v_item->>'position')::INTEGER;
    
    UPDATE kanban_cards 
    SET 
      column_id = COALESCE(v_column_id, column_id),
      position = v_position,
      updated_at = NOW()
    WHERE id = v_card_id AND user_id = v_user_id;
    
    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'updated_count', v_count);
END;
$$;

-- Function to update multiple column positions at once
DROP FUNCTION IF EXISTS update_column_positions(JSONB);

CREATE OR REPLACE FUNCTION update_column_positions(
  p_updates JSONB -- Array of { "id": "uuid", "position": number }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_item JSONB;
  v_column_id UUID;
  v_position INTEGER;
  v_count INTEGER := 0;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    v_column_id := (v_item->>'id')::UUID;
    v_position := (v_item->>'position')::INTEGER;
    
    UPDATE kanban_columns 
    SET 
      position = v_position,
      updated_at = NOW()
    WHERE id = v_column_id AND user_id = v_user_id;
    
    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'updated_count', v_count);
END;
$$;

-- Function to get all kanban data for a user in one query
DROP FUNCTION IF EXISTS get_kanban_data();

CREATE OR REPLACE FUNCTION get_kanban_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_columns JSONB;
  v_cards JSONB;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get all columns
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'title', title,
      'position', position,
      'created_at', created_at,
      'updated_at', updated_at
    ) ORDER BY position
  ), '[]'::jsonb)
  INTO v_columns
  FROM kanban_columns
  WHERE user_id = v_user_id;
  
  -- Get all cards
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'column_id', column_id,
      'title', title,
      'description', description,
      'priority', priority,
      'tags', tags,
      'subtasks', subtasks,
      'position', position,
      'created_at', created_at,
      'updated_at', updated_at
    ) ORDER BY position
  ), '[]'::jsonb)
  INTO v_cards
  FROM kanban_cards
  WHERE user_id = v_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'columns', v_columns,
    'cards', v_cards
  );
END;
$$;

-- ============================================================================
-- STEP 5: GRANT PERMISSIONS TO AUTHENTICATED USERS
-- ============================================================================

GRANT EXECUTE ON FUNCTION move_card(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_card_positions(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_column_positions(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_kanban_data() TO authenticated;

-- ============================================================================
-- STEP 6: CREATE TRIGGER FOR AUTOMATIC updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_kanban_columns_updated_at ON kanban_columns;
CREATE TRIGGER update_kanban_columns_updated_at
  BEFORE UPDATE ON kanban_columns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kanban_cards_updated_at ON kanban_cards;
CREATE TRIGGER update_kanban_cards_updated_at
  BEFORE UPDATE ON kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION: Run these queries to confirm everything works
-- ============================================================================

-- Check policies exist:
-- SELECT * FROM pg_policies WHERE tablename IN ('kanban_columns', 'kanban_cards');

-- Check functions exist:
-- SELECT proname FROM pg_proc WHERE proname IN ('move_card', 'update_card_positions', 'update_column_positions', 'get_kanban_data');

-- Check indexes exist:
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('kanban_columns', 'kanban_cards');

-- Test move_card function (replace with real IDs):
-- SELECT move_card('card-uuid-here', 'target-column-uuid-here', 0);
