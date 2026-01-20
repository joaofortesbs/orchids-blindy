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

- Jan 20, 2026: Kanban card movement fix v10
  - ROOT CAUSE FIXED: Removed static column IDs from DEFAULT_DATA that conflicted with database UUIDs
  - DEFAULT_KANBAN_COLUMNS now starts empty; columns are loaded from database or created on first use
  - This ensures all column IDs are real database UUIDs, fixing movement to user-created columns
  - Added validation to prevent operations on temporary (unsaved) columns
  - Improved temporary card filtering in updateCardPositions service
  - Added foreign key constraint error detection for better debugging
  - Enhanced logging throughout moveCard and updateCardPositions flow
  - Auto-reload data on persistence failures to sync with database state

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
4. **Update Policies Fix** - `migrations/004_fix_update_policies.sql` - **CRITICAL** Fixes UPDATE policies to include WITH CHECK clause for column reordering to work
