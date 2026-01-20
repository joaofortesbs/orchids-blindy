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

To enable the organizations feature, run the SQL in `migrations/001_organizations.sql` in your Supabase SQL Editor.
