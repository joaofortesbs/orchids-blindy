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

- Jan 20, 2026: Ultra-robust persistence v15 (COMPLETE)
  - NEW ARCHITECTURE: API routes + Zustand store + retry logic with exponential backoff
  - Created /api/kanban/move-card - atomic card movement via server-side RPC
  - Created /api/kanban/reorder-cards - atomic card reordering via server-side RPC
  - Created Zustand kanbanStore with queue system and optimistic updates
  - moveCard now uses API route with 3 retries and exponential backoff (500ms, 1s, 2s)
  - updateCardPositions now uses API route with same retry pattern
  - Server-side uses SUPABASE_SERVICE_ROLE_KEY for guaranteed write access
  - All operations are truly atomic and resilient to network failures

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
6. **Definitive Kanban Fix** - `migrations/006_definitive_kanban_fix.sql` - **CRITICAL** Final fix with move_card RPC, update_card_positions, update_column_positions, and get_kanban_data functions
