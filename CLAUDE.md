# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-project gaming repository containing four distinct applications:

1. **High-Low Reward Game** (Root) - Electron-based Japanese casino game
2. **Arcade Poker v2** - Web-based poker with anime theming  
3. **Game Review Site** - Next.js/Supabase review platform
4. **Horror Photo Roguelike** - React/TypeScript narrative game

## Development Commands

### High-Low Reward Game (Root Directory)
```bash
# Development
npm start                    # Run Electron app in development mode
npm install                  # Install dependencies (Electron + electron-builder)

# Building
npm run build-win           # Build Windows executable
npm run dist                # Alternative build command

# Files: main.js (Electron), high-low-game-casino.html (game logic)
```

### Game Review Site (game-review-site/)
```bash
# Development  
npm run dev                 # Start Next.js dev server with Turbopack
npm run build               # Production build (has type errors - see Known Issues)
npm start                   # Start production server
npm run lint                # Run ESLint

# Database
# Setup: Follow SUPABASE_SETUP.md for complete database configuration
# Environment: Requires .env.local with Supabase credentials
```

### Horror Photo Roguelike (horror-photo-roguelike/)
```bash
# Development
npm run dev                 # Start Vite dev server  
npm run build               # TypeScript compile + Vite build
npm run lint                # Run ESLint
npm run preview             # Preview production build

# Architecture: Zustand stores + React components + TypeScript
```

### Arcade Poker v2 (arcade-poker-v2/)
```bash
# Static files - serve via any HTTP server
# Files: index.html (horizontal), index-vertical.html (mobile)
```

## Architecture Overview

### High-Low Reward Game
- **Single-file architecture**: All game logic in `high-low-game-casino.html`
- **Electron wrapper**: `main.js` creates BrowserWindow, minimal configuration
- **Asset system**: Character images in `images/` with strict naming convention
- **Game mechanics**: Card values 2-14 (Ace high), tie = win, progressive rewards
- **Distribution**: Windows executable via electron-builder

### Game Review Site  
- **Next.js 15 App Router**: Server/client components with Turbopack
- **Supabase integration**: Authentication, database, RLS policies
- **Database schema**: Users, games, reviews, favorites, roles tables
- **Authentication**: Google/Apple OAuth via Supabase Auth
- **Type safety**: Generated types in `types/database.ts`
- **Review system**: 5-dimensional scoring (play/balance/expression/ux/value)

### Horror Photo Roguelike
- **State management**: Multiple Zustand stores (game, story, encyclopedia, extended)
- **Game progression**: 5-day system, 3 rounds per day, choice-based narrative  
- **Photo system**: Seedrandom-based selection, effects modify stats
- **Story routing**: Photo choices influence ending paths (escape/exorcism/contract)
- **Personality system**: Tracks player behavior for ending determination
- **Persistence**: Local storage for progress/discovered content

### Arcade Poker v2
- **Responsive design**: Horizontal desktop + vertical mobile layouts
- **Anime theming**: CSS animations, dealer character integration
- **Static deployment**: No build process required

## Known Issues

### Game Review Site
- **Route handler types**: Next.js 15 params are now Promise-based, causing TypeScript errors in API routes
- **Build warnings**: Turbopack workspace root detection issues due to multiple package.json files
- **Port conflicts**: Dev server auto-adjusts ports (typically 3001 instead of 3000)

### Horror Photo Roguelike  
- **Complex state dependencies**: Multiple stores interact; changes require careful coordination
- **Story progression**: Photo-to-route mapping system may need updates for new content
- **Save system**: Local storage only, no cloud sync

## Development Notes

### Image Asset Management
- **High-Low Game**: Strict naming `character{1-3}_{reward|special}{1-5|1-3}.jpg`
- **Arcade Poker**: Character images in project root
- **Game Review**: Game icons via external URLs or `public/images/games/`

### Database Schema (Game Review Site)
- **Users**: Handle, display name, rank system, personality types
- **Reviews**: Multi-dimensional scoring, privacy controls, helpful voting
- **Games**: Platform arrays, genre tags, external image URLs
- **RLS**: Public read, authenticated write policies

### State Architecture (Horror Photo Roguelike)
- **gameStore**: Core game state, photo selection, effect processing
- **storyStore**: Narrative events, route progression tracking  
- **encyclopediaStore**: Discovery tracking, meta-progression
- **extendedGameStore**: Day/phase progression, personality analysis

## Project-Specific Patterns

### Next.js Route Handlers (Game Review Site)
Current pattern (has type errors):
```typescript
export async function GET(request: Request, { params }: { params: { id: string } })
```

Should be updated to:
```typescript  
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> })
```

### Zustand Store Structure (Horror Photo Roguelike)
```typescript
export const useStore = create<StoreType>()(
  persist(
    (set, get) => ({
      // state and actions
    }),
    {
      name: 'storage-key',
      partialize: (state) => ({ /* selected fields */ })
    }
  )
);
```

### Electron App Configuration (High-Low Game)
- Window: 1280x900, non-resizable
- No menu bar, web security disabled for local file access
- Auto-hide menu bar enabled