# Seasonal Festival System (`festivals/`) — Agent Playbook

This directory isolates all **seasonal & holiday island events** (such as **Loy Krathong**, and future events like **New Year**, **Songkran**, **Chinese New Year**, **Valentine**, or **Halloween**) so `app/page.tsx`, `lib/`, and `components/` remain clean and maintainable year-round.

---

## 1. Directory Layout

```text
festivals/
├── AGENTS.md                        # This guide
├── index.ts                         # Client/shared barrel exports (@/festivals)
├── types.ts                         # Core TypeScript contracts (type-only module)
├── schedule.ts                      # Pure phase scheduler & weather target resolver
├── defaultSky3d.ts                  # Lightweight standard starry night sky for non-festival nights
├── registry.ts                      # Client registry (FESTIVAL_MODULES, sky/realtime helpers)
├── schema.ts                        # Acyclic DB schema initializers called by lib/turso_client.ts
├── server.ts                        # Server API dispatcher (/api/festivals/[festivalId]) + session guard
├── useActiveFestival.ts             # Rules-of-Hooks-safe React controller used by app/page.tsx
├── components/
│   └── FestivalHudControls.tsx      # Generic Header badge, Mobile menu item, Shore actions & Modal host
└── loy-krathong/                    # Reference implementation: 3D Loy Krathong Festival
    ├── index.ts                     # Exports loyKrathongFestivalModule
    ├── catalog.ts                   # Styles, wishes, NPC items, schedule (+07:00), payload sanitizer
    ├── krathong3d.ts                # 3D Krathong mesh builder, candle/water animation, orbit math
    ├── sky3d.ts                     # Full-moon rabbit sky, halos, moonbeams, sea shimmer, sky lanterns
    ├── sceneController.ts           # Zero-flicker 3D world sync, HTML wish bubbles, raycast tap
    ├── bgm.ts                       # YouTube track (95s3Y8nVMV4) + WebAudio Ranat-Ek/Chhing fallback + SFX
    ├── clientAdapter.ts             # Fetch, launch, cycle-my-items, and realtime broadcast adapter
    ├── LoyKrathongModal.tsx         # 360° 3D preview & wish composer modal (dynamically imported, ssr: false)
    ├── LoyKrathongShoreActions.tsx  # Shoreline action buttons ("🪷 ลอยกระทงริมหาด!" & "🔍 ส่องกระทงฉัน")
    ├── schema.ts                    # Acyclic `krathongs` table DDL (must NOT import lib/turso_client)
    └── server.ts                    # `krathongs` DB queries & GET/POST handlers
```

---

## 2. Festival Lifecycle (`upcoming` -> `live` -> `encore` -> `ended`)

Every festival schedule (`FestivalSchedule` in `types.ts`) is evaluated by `computeFestivalPhase(schedule, nowMs)` using **Thailand time (`+07:00`)** ISO strings:

1. **`upcoming`** (`nowMs < liveStartMs`, when `liveStartMs` is set):
   - Dormant. Nothing is rendered or polled.
2. **`live`** (`liveStartMs <= nowMs < liveEndMs`):
   - Festival world mode (`isWorldActive`) turns **ON automatically** when players enter the island.
   - Top bar displays the live sky/mode toggle pill (e.g., `🌕 คืนวันเพ็ญ` / `🌤️ อากาศจริง`).
   - If `bgm.autoPlayOnLiveInteraction` is `true` and the player hasn't muted BGM, their first click/keypress unlocks and plays the festival BGM track.
3. **`encore` ("ควันหลง")** (`liveEndMs <= nowMs < encoreEndMs`):
   - **Automatic morning cutoff**: At `liveEndMs` (typically `07:00:00+07:00` the morning after the festival), `useActiveFestival` automatically turns off forced festival sky (`isWorldActive = false`) and closes any open festival modal so the island returns to normal daytime weather.
   - A 1-day post-event revisit button (`hud.encoreInactiveLabel`, e.g., `🪷 ควันหลงลอยกระทง`) appears in the top bar and mobile menu so players who missed the live night can toggle the festival world back on, listen to the BGM, view shared items from everyone on the island, and participate before `encoreEndMs`.
4. **`ended`** (`nowMs >= encoreEndMs`):
   - Festival UI buttons, shoreline actions, sky overrides, BGM auto-preload, and background polling all stop automatically. Historical DB rows remain safely stored.

> **Priority rule**: When multiple festivals are registered in `FESTIVAL_MODULES`, any festival in `'live'` phase always takes precedence over `'encore'`. Ties break by descending `definition.priority`!

---

## 3. Playbook A: Re-running an Existing Festival Next Year

For an annual festival like Loy Krathong:
1. Open `festivals/loy-krathong/catalog.ts`.
2. Update `LOY_KRATHONG_LIVE_END_MS` (and optional `liveStartMs`) + `LOY_KRATHONG_ENCORE_END_MS` with explicit `+07:00` offsets.
3. Run `node --test tests/*.test.mjs` (update any hardcoded year assertions if applicable) and `npx tsc --noEmit`.

---

## 4. Playbook B: Adding a Brand-New Seasonal Festival

Follow these steps to create `festivals/<slug>/` without adding festival-specific clutter to `app/page.tsx`:

1. **Define Metadata & Catalog (`festivals/<slug>/catalog.ts`)**:
   - Export `<SLUG>_DEFINITION: FestivalDefinition` with `id`, `schedule` (`+07:00` timestamps), optional `weatherOverride`, `bgm` descriptor, `realtimeEvents`, and Thai `hud` copy (including `encore` "ควันหลง" labels).
   - Keep `catalog.ts` free of runtime `@/` imports (use `import type` from `../types`) so `node --test` can import and test it directly.
2. **Build 3D Assets & Scene Controller (`festivals/<slug>/sceneController.ts` & optional `sky3d.ts`)**:
   - Implement `createSceneController(ctx): FestivalSceneController`.
   - Respect `ctx.qualityTier` (`'lite' | 'medium' | 'high'`) for visible object caps and label distances.
   - Diff active 3D meshes by key instead of recreating meshes every frame (zero flicker).
   - Escape any user-supplied text before injecting into `labelsContainer` HTML tags, and remove all DOM tags in `dispose()`.
3. **Register BGM (`festivals/<slug>/bgm.ts`)**:
   - Call `registerFestivalBgmTrack(...)` from `@/lib/bgm` with an optional `youtubeVideoId` and a WebAudio `onSynthStep` fallback in case YouTube embeds are blocked.
4. **Create UI Surfaces (`Modal` & `ShoreActions`)**:
   - Wrap heavy Three.js preview modals with `next/dynamic(..., { ssr: false })` inside `festivals/<slug>/index.ts`.
   - Implement `FestivalClientAdapter` as a **plain object (no React hooks inside)** so `useActiveFestival` never violates React's Rules of Hooks when switching phases or festivals.
5. **Server Schema & API (`festivals/<slug>/schema.ts` & `festivals/<slug>/server.ts`)**:
   - Export `ensure<Slug>Schema(client, safeAlter)` in `festivals/<slug>/schema.ts` (do **not** import `@/lib/turso_client` here so DB bootstrap stays strictly acyclic) and append it to `FESTIVAL_SCHEMA_INITIALIZERS` in `festivals/schema.ts`.
   - Export `handleGet` / `handlePost` in `festivals/<slug>/server.ts` and append the handler to `FESTIVAL_SERVER_HANDLERS` in `festivals/server.ts`. This serves `/api/festivals/<id>` via `app/api/festivals/[festivalId]/route.ts` with automatic `assertActiveUserSession` enforcement whenever `userId` is present in a `POST` body!
6. **Register Client Module (`festivals/registry.ts`)**:
   - Append `<slug>FestivalModule` to `FESTIVAL_MODULES`.
   - All `definition.realtimeEvents` are automatically subscribed on the Supabase Realtime channel and routed to your `clientAdapter.onRealtimeEvent`.
7. **Write Automated Tests (`tests/festivals.test.mjs`)**:
   - Test phase boundaries (`upcoming`, `live`, `encore`, `ended`), overlap priority, payload sanitization, 3D mesh/orbit helpers in headless Node, and DB handlers using `createClient({ url: ':memory:' })`.
