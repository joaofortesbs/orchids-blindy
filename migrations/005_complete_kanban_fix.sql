-- ============================================================================
-- MIGRATION 005: COMPLETE KANBAN FIX
-- Execute this entire script in your Supabase SQL Editor
-- This fixes all persistence and reordering issues
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: VERIFY AND FIX TABLE STRUCTURE
-- ============================================================================

-- Ensure kanban_columns has all required fields
DO $$ 
BEGIN
  -- Add updated_at if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'kanban_columns' AND column_name = 'updated_at') THEN
    ALTER TABLE kanban_columns ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Ensure kanban_cards has all required fields
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'kanban_cards' AND column_name = 'updated_at') THEN
    ALTER TABLE kanban_cards ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- PART 2: OPTIMIZED INDEXES FOR FAST QUERIES
-- ============================================================================

-- Drop old indexes if they exist with different names
DROP INDEX IF EXISTS idx_columns_user_position;
DROP INDEX IF EXISTS idx_cards_column_position;

-- Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_kanban_columns_user_position 
  ON kanban_columns(user_id, position);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_column_position 
  ON kanban_cards(column_id, position);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_user_column 
  ON kanban_cards(user_id, column_id);

-- ============================================================================
-- PART 3: FIX RLS POLICIES WITH PROPER WITH CHECK CLAUSES
-- ============================================================================

-- kanban_columns policies
DROP POLICY IF EXISTS "Users can view their own columns" ON kanban_columns;
DROP POLICY IF EXISTS "Users can create their own columns" ON kanban_columns;
DROP POLICY IF EXISTS "Users can update their own columns" ON kanban_columns;
DROP POLICY IF EXISTS "Users can delete their own columns" ON kanban_columns;

CREATE POLICY "kanban_columns_select" ON kanban_columns
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "kanban_columns_insert" ON kanban_columns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kanban_columns_update" ON kanban_columns
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kanban_columns_delete" ON kanban_columns
  FOR DELETE USING (auth.uid() = user_id);

-- kanban_cards policies
DROP POLICY IF EXISTS "Users can view their own cards" ON kanban_cards;
DROP POLICY IF EXISTS "Users can create their own cards" ON kanban_cards;
DROP POLICY IF EXISTS "Users can update their own cards" ON kanban_cards;
DROP POLICY IF EXISTS "Users can delete their own cards" ON kanban_cards;

CREATE POLICY "kanban_cards_select" ON kanban_cards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "kanban_cards_insert" ON kanban_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kanban_cards_update" ON kanban_cards
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kanban_cards_delete" ON kanban_cards
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- PART 4: ATOMIC RPC FUNCTIONS FOR BULK OPERATIONS
-- ============================================================================

-- Function to reorder all columns for a user in a single transaction
CREATE OR REPLACE FUNCTION reorder_user_columns(
  p_user_id UUID,
  p_column_orders JSONB -- Array of { "id": "uuid", "position": number }
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_column_id UUID;
  v_position INTEGER;
  v_count INTEGER := 0;
BEGIN
  -- Verify the user making the request
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: User mismatch';
  END IF;
  
  -- Process each column order
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_column_orders)
  LOOP
    v_column_id := (v_item->>'id')::UUID;
    v_position := (v_item->>'position')::INTEGER;
    
    -- Update the column position
    UPDATE kanban_columns 
    SET position = v_position, updated_at = NOW()
    WHERE id = v_column_id AND user_id = p_user_id;
    
    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count > 0;
END;
$$;

-- Function to reorder all cards in a column in a single transaction
CREATE OR REPLACE FUNCTION reorder_column_cards(
  p_user_id UUID,
  p_column_id UUID,
  p_card_orders JSONB -- Array of { "id": "uuid", "position": number }
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_card_id UUID;
  v_position INTEGER;
  v_count INTEGER := 0;
BEGIN
  -- Verify the user making the request
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: User mismatch';
  END IF;
  
  -- Verify the column belongs to the user
  IF NOT EXISTS (SELECT 1 FROM kanban_columns WHERE id = p_column_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Column not found or unauthorized';
  END IF;
  
  -- Process each card order
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_card_orders)
  LOOP
    v_card_id := (v_item->>'id')::UUID;
    v_position := (v_item->>'position')::INTEGER;
    
    -- Update the card position and column
    UPDATE kanban_cards 
    SET position = v_position, column_id = p_column_id, updated_at = NOW()
    WHERE id = v_card_id AND user_id = p_user_id;
    
    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count > 0;
END;
$$;

-- Function to move a card between columns atomically
CREATE OR REPLACE FUNCTION move_card_to_column(
  p_user_id UUID,
  p_card_id UUID,
  p_source_column_id UUID,
  p_target_column_id UUID,
  p_new_position INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card_exists BOOLEAN;
BEGIN
  -- Verify the user making the request
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: User mismatch';
  END IF;
  
  -- Verify the card exists and belongs to the user
  SELECT EXISTS (
    SELECT 1 FROM kanban_cards 
    WHERE id = p_card_id AND user_id = p_user_id
  ) INTO v_card_exists;
  
  IF NOT v_card_exists THEN
    RAISE EXCEPTION 'Card not found or unauthorized';
  END IF;
  
  -- Verify target column exists and belongs to the user
  IF NOT EXISTS (SELECT 1 FROM kanban_columns WHERE id = p_target_column_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Target column not found or unauthorized';
  END IF;
  
  -- Update the card
  UPDATE kanban_cards 
  SET column_id = p_target_column_id, 
      position = p_new_position, 
      updated_at = NOW()
  WHERE id = p_card_id AND user_id = p_user_id;
  
  -- Reorder cards in source column (shift positions down)
  UPDATE kanban_cards 
  SET position = position - 1, updated_at = NOW()
  WHERE column_id = p_source_column_id 
    AND user_id = p_user_id 
    AND position > (SELECT position FROM kanban_cards WHERE id = p_card_id);
  
  -- Reorder cards in target column (shift positions up for cards after insertion point)
  UPDATE kanban_cards 
  SET position = position + 1, updated_at = NOW()
  WHERE column_id = p_target_column_id 
    AND user_id = p_user_id 
    AND id != p_card_id
    AND position >= p_new_position;
  
  RETURN TRUE;
END;
$$;

-- ============================================================================
-- PART 5: UTILITY FUNCTIONS
-- ============================================================================

-- Function to get user's kanban data in a single query
CREATE OR REPLACE FUNCTION get_user_kanban(p_user_id UUID)
RETURNS TABLE (
  column_id UUID,
  column_title TEXT,
  column_position INTEGER,
  card_id UUID,
  card_title TEXT,
  card_description TEXT,
  card_priority TEXT,
  card_tags JSONB,
  card_subtasks JSONB,
  card_position INTEGER,
  card_created_at TIMESTAMPTZ,
  card_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  RETURN QUERY
  SELECT 
    c.id as column_id,
    c.title as column_title,
    c.position as column_position,
    k.id as card_id,
    k.title as card_title,
    k.description as card_description,
    k.priority as card_priority,
    k.tags as card_tags,
    k.subtasks as card_subtasks,
    k.position as card_position,
    k.created_at as card_created_at,
    k.updated_at as card_updated_at
  FROM kanban_columns c
  LEFT JOIN kanban_cards k ON k.column_id = c.id
  WHERE c.user_id = p_user_id
  ORDER BY c.position, k.position;
END;
$$;

-- Function to validate and fix position gaps
CREATE OR REPLACE FUNCTION fix_kanban_positions(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_column RECORD;
  v_new_pos INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Fix column positions
  v_new_pos := 0;
  FOR v_column IN 
    SELECT id FROM kanban_columns 
    WHERE user_id = p_user_id 
    ORDER BY position
  LOOP
    UPDATE kanban_columns SET position = v_new_pos WHERE id = v_column.id;
    v_new_pos := v_new_pos + 1;
  END LOOP;
  
  -- Fix card positions within each column
  FOR v_column IN 
    SELECT id FROM kanban_columns WHERE user_id = p_user_id
  LOOP
    v_new_pos := 0;
    UPDATE kanban_cards 
    SET position = v_new_pos
    WHERE column_id = v_column.id 
    ORDER BY position;
  END LOOP;
END;
$$;

-- ============================================================================
-- PART 6: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION reorder_user_columns(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_column_cards(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION move_card_to_column(UUID, UUID, UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_kanban(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fix_kanban_positions(UUID) TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run these after the migration to verify success)
-- ============================================================================

-- Uncomment and run these to verify:
-- SELECT * FROM pg_policies WHERE tablename IN ('kanban_columns', 'kanban_cards');
-- SELECT proname, prosrc FROM pg_proc WHERE proname LIKE '%kanban%' OR proname LIKE 'reorder%' OR proname LIKE 'move_card%';
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('kanban_columns', 'kanban_cards');
