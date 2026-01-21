# Project Overview

A Next.js 15 web application with Supabase backend integration. The app appears to be a Portuguese language application with authentication features.

## Tech Stack

- **Framework**: Next.js 15.5 with Turbopack
- **Language**: TypeScript
- **Database/Auth**: Supabase
- **UI**: Tailwind CSS 4, Radix UI, shadcn/ui components
- **Animation**: Framer Motion
- **Other**: React 19, Recharts, Three.js

## Project Structure

```
src/
  app/        - Next.js app router pages
  components/ - React components
  hooks/      - Custom React hooks
  lib/        - Utility functions
  visual-edits/ - Visual editing tools
public/       - Static assets
```

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (secret)

## Development

Run the development server:
```bash
npm run dev -- -p 5000 -H 0.0.0.0
```

## Build & Deploy

```bash
npm run build
npm run start -- -p 5000 -H 0.0.0.0
```

## Recent Changes

- Jan 21, 2026: POMODORO SETTINGS UPSERT FIX v22 - Duplicate key error resolved
  - CRITICAL: Changed from check-then-update/insert to atomic upsert with { onConflict: 'user_id' }
  - Previous approach had race condition causing "duplicate key violates unique constraint pomodoro_settings_user_id_key"
  - Now uses single atomic upsert call that handles both insert and update
  - Added detailed logging for intervals save operation
  - All Pomodoro settings (categories, intervals) now persist correctly

- Jan 21, 2026: KANBAN CARD EDIT PERSISTENCE v21 - Card edits now save to database
  - CRITICAL: Created `/api/kanban/update-card` route using service role key
  - updateKanbanCard now uses API route instead of client-side Supabase
  - 3 retries with exponential backoff (500ms, 1s, 2s delays)
  - Verifies card ownership before updating
  - Enhanced EditCardModal logging with card ID and update payload
  - All card operations (add, update, move, reorder) now use robust server-side API routes

- Jan 21, 2026: TIMER PAUSE FIX v20 - Pause now works correctly
  - CRITICAL FIX: Pause was resetting timer because categoryDurations effect triggered setCategory even when paused
  - Added isPaused check to prevent category/duration changes while timer is paused
  - Added mountedRef and isProcessingRef guards to prevent race conditions
  - Added clearAllIntervals helper for clean interval management
  - Toggle now correctly preserves accumulatedSeconds on pause
  - setCategory blocked when timer is paused (accumulatedSeconds > 0)
  - Faster tick interval (200ms) for smoother countdown display
  - Added visual "Sessão pausada" indicator when paused
  - Button shows "Continuar" when paused vs "Iniciar" when fresh

- Jan 21, 2026: POMODORO SESSION PERSISTENCE v19 - Sessions now save to database
  - CRITICAL: Created migration 008 with correct pomodoro schema (duration_minutes, session_date, categories)
  - Created /api/pomodoro/add-session route using service role key
  - addPomodoroSession now uses API route with 3 retries and exponential backoff
  - Added detailed logging throughout timer → session complete → save flow
  - All pomodoro operations now use same robust pattern as kanban

- Jan 20, 2026: ADD CARD PERSISTENCE v18 - Cards no longer disappear
  - CRITICAL: Created /api/kanban/add-card route using service role key
  - addKanbanCard now uses API route instead of client-side Supabase
  - 3 retries with exponential backoff (500ms, 1s, 2s delays)
  - Detailed logging at every step for debugging
  - Re-sync from database on failure to ensure consistency
  - All card operations now use robust server-side API routes

- Jan 20, 2026: SERVICE ROLE AUTH FIX v17 - Full persistence working
  - CRITICAL BUG FIXED: RPCs used auth.uid() but Service Role has NO auth identity
  - NEW MIGRATION 007: All RPC functions now accept p_user_id as first parameter
  - API routes now pass authenticated user.id to RPC functions
  - Flow: API verifies user via cookies → passes user.id to RPC → RPC uses p_user_id
  - This was the ROOT CAUSE of "Not authenticated" errors in RPC calls
  - All operations now properly persist to database with service role key

- Jan 20, 2026: DEFINITIVE FIX v16 - Card persistence parameters
  - API route /api/kanban/reorder-cards had WRONG RPC parameters
  - Was sending: { p_column_id, p_positions } - INCORRECT
  - Now sending: { p_updates } with array of { id, column_id, position } - CORRECT

- Jan 20, 2026: Kanban flickering fix v14
  - ROOT CAUSE: Double state updates - handleDragOver updates UI, then moveCard applied optimistic update again
  - SOLUTION: moveCard and updateCardPositions no longer apply optimistic updates (handleDragOver already did)
  - Flow: handleDragOver updates UI → moveCard just persists to DB → no flickering
  - On failure: loadData(true) reloads from database to get authoritative state
  - Cache is synced immediately after drag-over state is set
  - All visual flickering eliminated

- Jan 20, 2026: Kanban atomic RPC fix v13
  - CRITICAL: Now using atomic RPC functions for all card/column operations
  - moveCard now uses `move_card` RPC function for atomic card movement between columns
  - updateCardPositions now uses `update_card_positions` RPC for bulk position updates
  - Added `updateColumnPositionsRPC` method using `update_column_positions` RPC
  - All operations are now truly atomic - no more race conditions or partial updates
  - RLS policies simplified and fixed with proper WITH CHECK clauses

- Jan 20, 2026: Kanban auto-revert fix v12
  - ROOT CAUSE FIXED: Identified that interval sync (every 30s) was overwriting local state with database data
  - Added pendingOperationsRef to track in-flight operations and block sync during them
  - Changed interval from 30s to 60s and added check for pending operations
  - Added lastSyncTimeRef to prevent sync spam (minimum 5s between syncs)
  - Removed automatic loadData() calls on failures - now restores previous state instead
  - All operations now store previousColumns before changes for proper rollback
  - Each operation increments/decrements pendingOperationsRef to protect from sync
  - Added force parameter to loadData() for manual refresh vs automatic sync
  - All changes are now properly persisted and don't auto-revert

- Jan 20, 2026: Kanban card movement fix v11
  - Removed static column IDs from DEFAULT_DATA that conflicted with database UUIDs
  - DEFAULT_KANBAN_COLUMNS now starts empty; columns are loaded from database or created on first use
  - Added isLoaded prop to KanbanBoard to block DnD until data is ready
  - Added canDrag check that blocks drag if isLoaded=false or hasTemporaryColumns=true
  - Added validation to prevent operations on temporary (unsaved) columns
  - Improved temporary card filtering in both hook and service layers

- Jan 20, 2026: Kanban persistence definitive fix v3
  - Fixed JSONB serialization: tags/subtasks now passed as arrays directly to Supabase (not JSON.stringify)
  - Added rowsAffected verification in updateCard/deleteCard to catch silent RLS failures
  - Added detailed debug logs (userId, cardId, rowsAffected) for troubleshooting
  - Hook useBlindadosData now reloads data when update/delete operations fail
  - EditCardModal no longer calls onClose() after onUpdate() to prevent duplicate close
  - All card edits (title, priority, description, tags, subtasks) now persist correctly
  - Card deletion now works and persists to database

- Jan 20, 2026: Kanban persistence complete overhaul v2
  - Fixed card movements between columns persisting all card positions
  - Fixed card reordering within same column persisting positions
  - Added updateCardPositions method to KanbanService for bulk position updates
  - Fixed handleDragEnd to call onMoveCard for cross-column moves
  - Fixed handleDragEnd to call onUpdateCardPositions for same-column reorders
  - Added originalCardPositionRef to track card initial position during drag

- Jan 20, 2026: Kanban and Timer persistence fixes
  - Created migration for Kanban tables (migrations/003_kanban_tables.sql)
  - Added updateColumn method to KanbanService for individual column updates
  - Added updateKanbanColumn function to useBlindadosData hook
  - Fixed column renaming to persist to database immediately
  - Improved error handling with try-catch blocks throughout KanbanService
  - Parallelized column position updates for better performance
  - All Kanban operations now persist without page refresh

- Jan 20, 2026: Teams Section improvements v2
  - Added member filter in Overview (all/in-flow/online/offline)
  - Added teams preview section in Overview showing first 4 teams
  - Created dedicated team detail interface with own metas, rankings and feeds
  - Floating carousel navigation without arrows (hides when viewing team detail)
  - Removed header from Teams section for cleaner look
  - Team cards clickable to open team-specific interface

- Jan 20, 2026: Teams Section complete interface
  - Created comprehensive TeamsSection component with 6 tabs in carousel
  - Visão Geral: Dashboard with stats, active members in flow, top 3 ranking
  - Membros: Grid/list view with status (online/away/busy/offline), roles, permissions
  - Feed: Twitter/ClickUp style feed for team posts with likes/comments
  - Equipes: Team cards with creation modal
  - Ranking: Full leaderboard with points, focus time, streaks
  - Metas: Goals tracking with progress bars (organization/team/individual)
  - Sidebar restructured: Profissional (Painel, Equipes) -> Pessoal (Flows, Visões)

- Jan 20, 2026: Timer fixes and data cleanup
  - Fixed Pomodoro settings not updating countdown immediately when changed
  - Added real-time live session sync (updates chart every second during timer)
  - Added cleanupInvalidSessions function to remove corrupted time entries (>120min)
  - Fixed allowedDevOrigins for Replit proxy

- Jan 20, 2026: Organization management system v2
  - Added "Membros" and "Equipes" sections in sidebar when organization is selected
  - Improved error handling for organization creation with detailed messages
  - Better detection of missing database tables and RLS policy issues
  
- Jan 20, 2026: Organization management system
  - Added organization dropdown to sidebar with creation modal
  - Created database migration for organizations, members, and invites tables (migrations/001_organizations.sql)
  - Added TypeScript types for organization system (src/lib/types/organization.ts)
  - Improved Kanban column drag-and-drop collision detection
  
- Jan 20, 2026: Initial import and Replit environment setup
  - Configured Next.js to allow all dev origins for Replit proxy
  - Set up environment variables and secrets
  - Configured deployment for autoscale

## Database Migrations

Run these migrations in order in your Supabase SQL Editor:

1. **Organizations** - `migrations/001_organizations.sql` - Creates organizations, members, and invites tables
2. **RLS Fix** - `migrations/002_fix_rls_policies.sql` - Fixes RLS policy recursion issues
3. **Kanban** - `migrations/003_kanban_tables.sql` - Creates kanban_columns, kanban_cards, pomodoro_sessions, pomodoro_settings, and active_sessions tables with full RLS policies
4. **Update Policies Fix** - `migrations/004_fix_update_policies.sql` - Fixes UPDATE policies to include WITH CHECK clause
5. **Complete Kanban Fix** - `migrations/005_complete_kanban_fix.sql` - Complete fix with atomic RPCs, optimized indexes, and proper RLS policies
6. **Definitive Kanban Fix** - `migrations/006_definitive_kanban_fix.sql` - Final fix with move_card RPC, update_card_positions, update_column_positions, and get_kanban_data functions
7. **Service Role RPC Fix** - `migrations/007_service_role_rpc_fix.sql` - **CRITICAL** All RPCs now accept p_user_id as first parameter (required for Service Role auth)
