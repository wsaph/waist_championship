<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Waist Championship 3D (`ศึกชิงบัลลังก์เอวเอส 3D`) — Agent Guide

## 1. Tech Stack & Architecture
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript (`strict: true`). Remember that `context.params` in dynamic Route Handlers (`app/api/.../[param]/route.ts`) is a `Promise` in Next.js 16.
- **3D Engine**: Three.js (`three`) with adaptive device quality tiers (`high` / `medium` / `lite` in `lib/device_perf.ts`). Always clean up GPU geometries/materials/textures with `disposeObject3D(...)` and remove projected HTML tags on scene teardown.
- **Database**: Turso / libSQL (`@libsql/client`) via `lib/turso_client.ts` (`file:local.db` fallback in local dev). Schema migrations run idempotently inside `ensureSchema()`.
- **Realtime**: Dual-layer sync in `app/page.tsx` — `BroadcastChannel` for instant same-browser tab sync plus Supabase Realtime (`waist-arena-live`) for cross-device sync, backed by diff-polling.

## 2. Directory Map
- `app/` — Next.js App Router UI (`app/page.tsx` main 3D island arena, standalone `/volleyball` & `/penalty` pages) and REST Route Handlers (`app/api/*`).
- `components/` — Non-competitive island feature modals (`PetCafeModal.tsx`, `QuestBoardModal.tsx`, `GuardDanceLoader.tsx`).
- `lib/` — Core 3D character/mount/prop builders, RPG/fishing/prank catalogs, BGM engine (`lib/bgm.ts`), device performance utilities (`lib/device_perf.ts`), and DB client (`lib/turso_client.ts`).
- `games/` — **Pluggable Competitive & Party Mini-Game System** (`volleyball`, `soccer` [`match3v3/` + `penalty/`], `sumo`, `taekwondo`, `casino` [`modes/pokdeng`, `blackjack`, `holdem`, `oldmaid`], and `shabu`). See [`games/AGENTS.md`](./games/AGENTS.md) for full module contracts, single-session arena locking, and 3D character showcase helpers.
- `festivals/` — **Pluggable Seasonal Festival System** (Loy Krathong, and future festivals such as New Year, Songkran, Halloween, Valentine, etc.). See [`festivals/AGENTS.md`](./festivals/AGENTS.md) for full module contracts and step-by-step instructions.
- `tests/` — Automated Node test suites (`node --test tests/*.test.mjs`).

## 3. Competitive & Party Mini-Game System (`games/`)
**Do NOT hardcode mini-game session states, live lobby banners, 3D Sports Plaza zone meshes, proximity checks, or modal mounts directly inside `app/page.tsx`.**

Instead, `app/page.tsx` integrates with `@/games` through generic hooks and controllers:
- `useIslandGames(...)` — Manages the active game session, live lobby map across all 6 games, 15s auto-expiry on abrupt host disconnect, zone proximity flags, realtime broadcast routing (`ALL_GAME_REALTIME_EVENTS`), and pair-activity menu delegation.
- `createIslandGameZonesController(...)` — Mounts, animates, projects tags, checks proximity, and disposes 3D Sports Plaza zones (`volleyball`, `soccer`, `sumo`, `taekwondo`) plus live 3D playing character showcases (`createIslandActorShowcaseController`).
- `<GameFloatingBanners />`, `<GameProximityActions />`, `<GameModalHost />`, `<LockedArenaShowcaseModal />` — Declarative HUD & single-session arena lock UI (rendering live 3D character avatars with zero extra WebSocket connections when a match is in progress to conserve Supabase Realtime quota).
- `games/schema.ts` & `games/<slug>/server.ts` — Acyclic DB table migrations (`ensureGameSchemas` called by `lib/turso_client.ts`) and server handlers backing `/api/volleyball/leaderboard`, `/api/penalty/leaderboard`, `/api/sumo`, `/api/taekwondo`, and `/api/pokdeng`.

Before modifying an existing mini-game or creating a new competitive game, read [`games/AGENTS.md`](./games/AGENTS.md).

## 4. Seasonal Festival System (`festivals/`)
**Do NOT hardcode seasonal festival state, 3D sky/props, polling, BGM tracks, or festival buttons directly inside `app/page.tsx`.**

Instead, `app/page.tsx` integrates with `@/festivals` through generic hooks and controllers:
- `useActiveFestival(...)` — Resolves whichever festival in `festivals/registry.ts` is currently in `'live'` or `'encore'` phase, manages the automatic morning cutoff (`'live'` -> `'encore'` 1-day revisit button `"ควันหลง..."` -> `'ended'`), syncs festival BGM (`lib/bgm.ts`), and polls/submits festival items.
- `createIslandNightSkyController(...)` & `resolveIslandWeatherTargets(...)` — Applies optional festival sky/lighting overrides (e.g., Loy Krathong full-moon night sky + sky lanterns) while rendering the lightweight standard starry night sky (`festivals/defaultSky3d.ts`) in normal island mode.
- `FestivalModule.createSceneController(...)` — Mounts, animates, raycasts, and disposes 3D festival objects in the island scene without flickering.
- `<FestivalHeaderBadge />`, `<FestivalMobileMenuItem />`, `<FestivalShoreActions />`, `<FestivalModalHost />` — Declarative UI surfaces driven by `FestivalDefinition`.
- `festivals/schema.ts`, `festivals/server.ts` & `app/api/festivals/[festivalId]/route.ts` — Separates acyclic DB table migrations (`ensureFestivalSchemas` called by `lib/turso_client.ts`) from API dispatching (`dispatchFestivalGet` / `dispatchFestivalPost` with automatic `assertActiveUserSession` enforcement).

Before modifying an existing festival or creating a new seasonal event, read [`festivals/AGENTS.md`](./festivals/AGENTS.md).

## 5. Verification & Git Rules
- Run TypeScript check: `npx tsc --noEmit`
- Run unit/integration tests: `node --test tests/*.test.mjs`
- Run production build check when touching App Router / UI / Three.js bundles: `npm run build`
- **Git safety**: Never `git push` or overwrite uncommitted user work unless explicitly asked by the user. Keep the managed `<!-- BEGIN:nextjs-agent-rules -->` block at the top of this file intact.
