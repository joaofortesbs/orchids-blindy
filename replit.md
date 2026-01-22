# Project Overview

This is a Next.js 15 web application with a Supabase backend, designed to be a Portuguese language application. It includes robust authentication features and focuses on productivity tools like a Pomodoro timer and a Kanban board. The project aims to provide a comprehensive, integrated environment for personal and team productivity, with features such as detailed session tracking, task management, team collaboration, and goal setting.

# User Preferences

I prefer detailed explanations. I want iterative development. Ask before making major changes. Do not make changes to the folder `visual-edits/`.

# System Architecture

The application is built with Next.js 15.5 using Turbopack for performance, and TypeScript for type safety. Supabase handles both database and authentication needs. The UI is crafted with Tailwind CSS 4, Radix UI, and shadcn/ui components, ensuring a modern and responsive design. Animations are powered by Framer Motion, and data visualization uses Recharts, with some advanced 3D elements handled by Three.js.

Key architectural decisions include:
- **Modular Structure**: The project is organized into `app/` for Next.js routes, `components/` for reusable UI elements, `hooks/` for custom React hooks, and `lib/` for utility functions.
- **API Routes for Persistence**: All critical data operations (Kanban card management, Pomodoro session logging, settings updates) are handled via Next.js API routes. These routes leverage Supabase's service role key for secure, server-side interactions and incorporate retry mechanisms with exponential backoff for robustness.
- **Atomic Database Operations**: Supabase Remote Procedure Calls (RPCs) are used for complex operations like moving or reordering Kanban cards and columns, ensuring atomicity and preventing race conditions. These RPCs are designed to accept `p_user_id` for proper authorization via the service role key.
- **Real-time Synchronization**: The Pomodoro timer includes real-time session syncing, and Kanban board operations are designed to minimize flickering and ensure data consistency across clients.
- **Comprehensive Productivity Features**:
    - **Pomodoro Timer**: Tracks work sessions, categorizes them, and provides detailed statistics with various chart views (bar, line, circular score chart) and period filtering. Sessions are persisted and linked to categories via UUIDs.
    - **Kanban Board**: Supports drag-and-drop for cards and columns, with persistence for all operations (add, update, move, reorder, delete). Features include card editing (title, priority, description, tags, subtasks). **Advanced features**:
        - **Project-based Organization**: Cards can be assigned to color-coded projects with a dropdown selector and "Todos" view for all cards.
        - **Date/Calendar System**: Date picker for filtering, dueDate field for cards, smart visibility based on selected date.
        - **Column Behavior Rules**: 'active' columns keep tasks visible indefinitely; 'completion' columns hide tasks after their completion date.
        - **Separated Filtering Architecture**: Filtering is applied at render-time only, keeping DnD logic using the original columns array to prevent reordering bugs.
    - **Team Management**: Includes features for organization creation, member management (roles, permissions), team-specific dashboards, feeds, ranking systems, and goal tracking.
- **Robust Error Handling**: Authentication flows include detailed error messages for email confirmation, rate limiting, and invalid credentials. Persistence operations incorporate try-catch blocks and error logging, with mechanisms to reload data on failure.
- **Supabase Integration for Projects**: The Kanban system now fully persists projects to Supabase via `kanban_projects` table. Cards support `projectId`, `dueDate`, and `completedAt` fields that are saved to the database. Columns support `behavior` field for active/completion rules.

# Database Migrations

The following SQL migrations may need to be executed in Supabase SQL Editor:
- `supabase/migrations/001_add_projects_and_fields.sql` - Creates `kanban_projects` table and adds new columns to `kanban_cards` and `kanban_columns`

# External Dependencies

- **Supabase**: Backend-as-a-Service for database (PostgreSQL) and authentication.
- **Next.js 15.5**: React framework for web applications.
- **React 19**: JavaScript library for building user interfaces.
- **TypeScript**: Superset of JavaScript that adds static typing.
- **Tailwind CSS 4**: Utility-first CSS framework for styling.
- **Radix UI**: Unstyled UI component library.
- **shadcn/ui**: Re-usable components built using Radix UI and Tailwind CSS.
- **Framer Motion**: Library for production-ready motion and animation.
- **Recharts**: Redefined chart library built with React and D3.
- **Three.js**: JavaScript 3D library.