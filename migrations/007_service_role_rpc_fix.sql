-- ============================================================================
-- MIGRATION 007: SERVICE ROLE RPC FIX
-- Execute in Supabase SQL Editor
-- Fixes RPCs to accept user_id parameter when called by service role
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP OLD FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS move_card(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS move_card(UUID, UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS update_card_positions(JSONB);
DROP FUNCTION IF EXISTS update_card_positions(UUID, JSONB);
DROP FUNCTION IF EXISTS update_column_positions(JSONB);
DROP FUNCTION IF EXISTS update_column_positions(UUID, JSONB);
DROP FUNCTION IF EXISTS get_kanban_data();
DROP FUNCTION IF EXISTS get_kanban_data(UUID);

-- ============================================================================
-- STEP 2: CREATE NEW RPC FUNCTIONS WITH USER_ID PARAMETER
-- ============================================================================

-- Function to move a single card to another column
CREATE OR REPLACE FUNCTION move_card(
  p_user_id UUID,
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
  v_old_column_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID required');
  END IF;
  
  SELECT column_id INTO v_old_column_id
  FROM kanban_cards 
  WHERE id = p_card_id AND user_id = p_user_id;
  
  IF v_old_column_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Card not found or not owned by user');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM kanban_columns WHERE id = p_target_column_id AND user_id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target column not found or not owned by user');
  END IF;
  
  UPDATE kanban_cards 
  SET 
    column_id = p_target_column_id,
    position = p_new_position,
    updated_at = NOW()
  WHERE id = p_card_id AND user_id = p_user_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'card_id', p_card_id,
    'old_column_id', v_old_column_id,
    'new_column_id', p_target_column_id,
    'new_position', p_new_position
  );
END;
$$;

-- Function to update multiple card positions at once
CREATE OR REPLACE FUNCTION update_card_positions(
  p_user_id UUID,
  p_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_card_id UUID;
  v_column_id UUID;
  v_position INTEGER;
  v_count INTEGER := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID required');
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
    WHERE id = v_card_id AND user_id = p_user_id;
    
    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'updated_count', v_count);
END;
$$;

-- Function to update multiple column positions at once
CREATE OR REPLACE FUNCTION update_column_positions(
  p_user_id UUID,
  p_updates JSONB
)
RETURNS JSONB
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
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID required');
  END IF;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    v_column_id := (v_item->>'id')::UUID;
    v_position := (v_item->>'position')::INTEGER;
    
    UPDATE kanban_columns 
    SET 
      position = v_position,
      updated_at = NOW()
    WHERE id = v_column_id AND user_id = p_user_id;
    
    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'updated_count', v_count);
END;
$$;

-- Function to get all kanban data for a user
CREATE OR REPLACE FUNCTION get_kanban_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_columns JSONB;
  v_cards JSONB;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID required');
  END IF;
  
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
  WHERE user_id = p_user_id;
  
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
  WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'columns', v_columns,
    'cards', v_cards
  );
END;
$$;

-- ============================================================================
-- STEP 3: GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION move_card(UUID, UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION move_card(UUID, UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION update_card_positions(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_card_positions(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION update_column_positions(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_column_positions(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION get_kanban_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_kanban_data(UUID) TO service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Test with: SELECT move_card('user-uuid', 'card-uuid', 'column-uuid', 0);
