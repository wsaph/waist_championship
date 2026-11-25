# Pluggable Competitive & Co-op Mini-Game System (`games/`) — Agent Playbook

This directory isolates all **competitive sports & party mini-games** from `app/page.tsx`, `lib/`, and `components/` so each game owns its physics/rules, 3D island zone, modal UI, DB schema, and server handlers in one self-contained folder.

---

## 1. Directory Layout

```text
games/
├── AGENTS.md                        # This guide
├── index.ts                         # Client/shared barrel exports (@/games)
├── types.ts                         # Core TypeScript contracts (GameModule, GameLobbyBroadcastInfo, etc.)
├── islandActorShowcase3d.ts         # Zero-flicker 3D character showcase & single-session lock helper
├── registry.ts                      # Master registry (GAME_MODULES, ALL_GAME_REALTIME_EVENTS, 3D zone controller)
├── schema.ts                        # Acyclic DB schema initializers called by lib/turso_client.ts
├── useIslandGames.ts                # Centralized React hook managing sessions, live lobbies & 15s auto-expiry
├── components/
│   └── GameHudHost.tsx              # Generic floating lobby/lock banners, proximity buttons & dynamic modal host
├── shared/
│   └── realtimeSync.ts              # Shared Supabase Realtime room controllers & 60FPS state interpolators
├── volleyball/                      # 🏐 3D Beach/Snow Volleyball (1v1 & 2v2) + 2D Pikachu Canvas (/volleyball)
├── soccer/                          # ⚽ 3D Soccer Hub with sub-modes:
│   ├── shared/                      #    Shared avatars, SFX & VirtualGamepad
│   ├── match3v3/                    #    Mini PES 3v3 real-time pitch physics, AI & broadcast camera
│   └── penalty/                     #    1v1 Penalty Shootout rules & PES shooter/keeper scene
├── sumo/                            # 🏯 Hokkaido Dohyo Sumo Ring (1v1 PvP & Yokozuna Rank Progression)
├── taekwondo/                       # 🥋 Taekwondo Dojang (Solo Target Kicking & 1v1 3D Torii PvP)
├── casino/                          # 🃏 Guard Casino Table with sub-modes in modes/:
│   └── modes/                       #    pokdeng.ts, blackjack.ts, holdem.ts, oldmaid.ts
└── shabu/                           # 🍲 Co-op Shabu Buffet Kitchen (1-4 Players)
```

---

## 2. Supabase Realtime Quota & Single-Session Lock Standard

To keep the island responsive on Supabase Free/Pro tiers while players enjoy multiple activities simultaneously:
1. **Low-Frequency Island Lobby & Score Sync (`waist-arena-live`)**:
   - Games broadcast `GameLobbyBroadcastInfo` (`status: 'waiting' | 'started' | 'closed'`, `scoreLeft`, `scoreRight`, `roster`) only when lobby slots change, when a point/goal is scored, or via a lightweight ~4.5s heartbeat (auto-expiring after 15s if a host closes their browser tab abruptly).
2. **Zero-Quota Spectator Showcase (`singleSessionLock: true`)**:
   - Non-playing islanders see the **actual 3D characters (`buildCharacterMesh`)** of active players both **on the 3D island sport zone** (`createIslandActorShowcaseController`) and inside the **Locked Showcase UI** of the game modal without opening a high-frequency room WebSocket (`0 extra connections / 0 msg/s`).
3. **Zero Database Writes During Live Rallies**:
   - Leaderboard/progress tables are written only once at match completion via `schema.ts` / `server.ts`.

---

## 3. Adding a New Mini-Game or Sub-Mode

- **New Sub-Mode inside an existing category**:
  - For Soccer: add a folder under `games/soccer/<mode>/` reusing `games/soccer/shared/`.
  - For Casino: add an evaluator file under `games/casino/modes/<mode>.ts` and export it in `games/casino/modes/index.ts`.
- **Brand-New Island Mini-Game (`games/<slug>/`)**:
  1. Create `games/<slug>/index.ts` exporting a `GameModule` (wrapping its Modal with `next/dynamic(..., { ssr: false })`).
  2. If the game has a dedicated 3D structure on the island, implement `createIslandZone(ctx)` in `games/<slug>/islandZone3d.ts` and dispose all Three.js geometries/materials/textures + HTML tags in `dispose()`.
  3. If DB-backed, export an acyclic `ensure<Slug>Schema(client, safeAlter)` in `games/<slug>/schema.ts` (never import `@/lib/turso_client` inside `schema.ts`) and register it in `games/schema.ts`.
  4. Append `<slug>GameModule` to `GAME_MODULES` in `games/registry.ts`.
