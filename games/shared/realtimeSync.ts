// lib/realtime_sync.ts
// Supabase Realtime Presence + 20Hz Host-Authoritative Broadcast + Event-Driven Input + 60FPS Lerp
// Strictly ZERO database writes during gameplay!

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import {
  COURT_WIDTH,
  GROUND_Y,
  getActiveSlots,
  getTeamForSlot,
  type ChibiSkinId,
  type GameEvents,
  type GameMode,
  type MatchPhase,
  type MatchState,
  type PlayerInput,
  type PlayerSlot,
  type TeamSide,
} from '@/games/volleyball/2d/physics2d';

export const HOST_BROADCAST_HZ = 20;
export const HOST_BROADCAST_INTERVAL_MS = 1000 / HOST_BROADCAST_HZ; // 50 ms

export interface PresencePlayer {
  clientId: string;
  userId?: number | null;
  name: string;
  skin: ChibiSkinId;
  color: string;
  desiredSlot: PlayerSlot;
  slotUpdatedAt: number;
  ready: boolean;
  joinedAt: number;
  isCreator: boolean;
}

export interface ResolvedLobbyState {
  mode: GameMode;
  hostClientId: string | null;
  slots: Partial<Record<PlayerSlot, PresencePlayer>>;
  onlinePlayers: PresencePlayer[];
  allSlotsFilled: boolean;
  allReady: boolean;
}

export interface NetPlayerSnapshot {
  s: PlayerSlot;
  x: number;
  y: number;
  vx: number;
  vy: number;
  f: 1 | -1;
  dt: number;
  dd: 1 | -1;
  sp: number;
  ap: number;
  bot?: 1;
}

export interface NetStateSnapshot {
  seq: number;
  hid?: string;
  ts: number;
  ph: MatchPhase;
  pt: number;
  sb: number;
  sr: number;
  sv: TeamSide;
  ls: TeamSide | null;
  w: TeamSide | null;
  rh: number;
  bx: number;
  by: number;
  bvx: number;
  bvy: number;
  br: number;
  bsp: 0 | 1;
  pl: NetPlayerSnapshot[];
  ev?: GameEvents;
}

export interface GuestInputPacket {
  clientId: string;
  slot: PlayerSlot;
  seq: number;
  inp: PlayerInput;
}

export interface StartMatchPacket {
  matchUid: string;
  mode: GameMode;
  hostClientId: string;
  slots: Partial<Record<PlayerSlot, PresencePlayer>>;
  startedAt: number;
}

export interface RoomConfigPacket {
  mode: GameMode;
  hostClientId: string;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;
const r2 = (n: number): number => Math.round(n * 100) / 100;

export function generateRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

let singletonSupabase: SupabaseClient | null = null;

export function getRealtimeSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!singletonSupabase) {
    singletonSupabase = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return singletonSupabase;
}

/**
 * Creates an isolated SupabaseClient per room controller so `sb.channel(topic)`
 * never collides with an in-flight `untrack()` / React StrictMode remount!
 */
function createDedicatedRoomSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: {
      params: {
        eventsPerSecond: 40,
      },
    },
  });
}

export function inputsEqual(a: PlayerInput, b: PlayerInput): boolean {
  return (
    a.left === b.left &&
    a.right === b.right &&
    a.jump === b.jump &&
    a.down === b.down &&
    a.action === b.action
  );
}

/**
 * Deterministic Host Election & Conflict-Free Slot Assignment across all Presence members!
 * Eliminates 2v2 race conditions when multiple guests join or click slots simultaneously.
 */
export function resolveLobbyPresence(
  members: PresencePlayer[],
  mode: GameMode
): ResolvedLobbyState {
  // Sort deterministically for Host election: original room creator first, then earliest joinedAt
  const byHostOrder = [...members].sort((a, b) => {
    if (a.isCreator !== b.isCreator) return a.isCreator ? -1 : 1;
    if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
    return a.clientId.localeCompare(b.clientId);
  });

  const hostClientId = byHostOrder[0]?.clientId ?? null;
  const validSlots = getActiveSlots(mode);
  const assigned: Partial<Record<PlayerSlot, PresencePlayer>> = {};
  const overflow: PresencePlayer[] = [];

  // Sort for slot claim priority: earliest claim on that slot wins cleanly
  const bySlotClaim = [...byHostOrder].sort((a, b) => {
    if (a.slotUpdatedAt !== b.slotUpdatedAt) return a.slotUpdatedAt - b.slotUpdatedAt;
    return a.joinedAt - b.joinedAt;
  });

  for (const m of bySlotClaim) {
    if (validSlots.includes(m.desiredSlot) && !assigned[m.desiredSlot]) {
      assigned[m.desiredSlot] = m;
    } else {
      overflow.push(m);
    }
  }

  // Place any colliding/overflow players into balanced open slots (P1 -> P3 -> P2 -> P4)
  const balancedOrder: PlayerSlot[] =
    mode === '2v2' ? ['P1', 'P3', 'P2', 'P4'] : ['P1', 'P3'];
  for (const m of overflow) {
    const fallbackSlot =
      balancedOrder.find((s) => !assigned[s]) ||
      validSlots.find((s) => !assigned[s]);
    if (fallbackSlot) {
      assigned[fallbackSlot] = m;
    }
  }

  const filledCount = validSlots.filter((s) => Boolean(assigned[s])).length;
  const allSlotsFilled = filledCount === validSlots.length;
  const allReady =
    allSlotsFilled &&
    validSlots.every((s) => {
      const occupant = assigned[s];
      if (!occupant) return false;
      // Host is implicitly ready when pressing Start, or explicitly ready
      return occupant.clientId === hostClientId || occupant.ready;
    });

  return {
    mode,
    hostClientId,
    slots: assigned,
    onlinePlayers: byHostOrder,
    allSlotsFilled,
    allReady,
  };
}

export function packNetState(
  state: MatchState,
  seq: number,
  events?: GameEvents,
  hostId?: string
): NetStateSnapshot {
  const hasEv =
    events &&
    Boolean(events.hit || events.spike || events.dive || events.scored || events.matchWon);

  return {
    seq,
    hid: hostId,
    ts: Date.now(),
    ph: state.phase,
    pt: r2(state.phaseTimer),
    sb: state.scoreBlue,
    sr: state.scoreRed,
    sv: state.servingTeam,
    ls: state.lastScoringTeam,
    w: state.winner,
    rh: state.rallyHits,
    bx: r1(state.ball.x),
    by: r1(state.ball.y),
    bvx: r1(state.ball.vx),
    bvy: r1(state.ball.vy),
    br: r2(state.ball.rotation),
    bsp: state.ball.isSpiked ? 1 : 0,
    pl: state.players.map((p) => ({
      s: p.slot,
      x: r1(p.x),
      y: r1(p.y),
      vx: r1(p.vx),
      vy: r1(p.vy),
      f: p.facing,
      dt: r2(p.diveTimer),
      dd: p.diveDir,
      sp: r2(p.spikeTimer),
      ap: r2(p.animPhase),
      bot: p.isBot ? 1 : undefined,
    })),
    ev: hasEv ? events : undefined,
  };
}

/**
 * Client-Side Linear Interpolation (Lerp) Buffer for 60 FPS Guest Rendering!
 * Smoothly blends between 20 Hz (50 ms) Host snapshots with short dead-reckoning bridge on jitter.
 */
export class ClientStateInterpolator {
  private prevSnap: NetStateSnapshot | null = null;
  private currSnap: NetStateSnapshot | null = null;
  private currRecvPerfMs = 0;
  private expectedIntervalMs = HOST_BROADCAST_INTERVAL_MS;
  private lastSeq = -1;
  private lastHostId: string | null = null;

  reset(): void {
    this.prevSnap = null;
    this.currSnap = null;
    this.currRecvPerfMs = 0;
    this.lastSeq = -1;
    this.lastHostId = null;
  }

  pushSnapshot(snap: NetStateSnapshot, nowPerfMs: number): boolean {
    const hostChanged = Boolean(snap.hid && this.lastHostId && snap.hid !== this.lastHostId);
    const seqRestartedOnNewHost = !snap.hid && snap.seq <= 5 && this.lastSeq > 15;
    if (hostChanged || seqRestartedOnNewHost) {
      this.lastSeq = -1;
    }
    if (snap.seq <= this.lastSeq) return false; // Ignore out-of-order packets
    if (snap.hid) {
      this.lastHostId = snap.hid;
    }

    if (this.currSnap) {
      const measuredGap = nowPerfMs - this.currRecvPerfMs;
      if (measuredGap >= 25 && measuredGap <= 130) {
        this.expectedIntervalMs = this.expectedIntervalMs * 0.75 + measuredGap * 0.25;
      }
      this.prevSnap = this.currSnap;
    } else {
      this.prevSnap = snap;
    }

    this.currSnap = snap;
    this.currRecvPerfMs = nowPerfMs;
    this.lastSeq = snap.seq;
    return true;
  }

  /**
   * Writes 60 FPS interpolated coordinates into `target` MatchState.
   */
  applyInterpolated(target: MatchState, nowPerfMs: number, dt: number): void {
    const curr = this.currSnap;
    if (!curr) return;
    const prev = this.prevSnap || curr;

    if (target.screenShake > 0) {
      target.screenShake = Math.max(0, target.screenShake - dt * 3.5);
    }

    target.phase = curr.ph;
    target.phaseTimer = curr.pt;
    target.scoreBlue = curr.sb;
    target.scoreRed = curr.sr;
    target.servingTeam = curr.sv;
    target.lastScoringTeam = curr.ls;
    target.winner = curr.w;
    target.rallyHits = curr.rh;

    const elapsedMs = Math.max(0, nowPerfMs - this.currRecvPerfMs);
    const windowMs = Math.max(42, Math.min(85, this.expectedIntervalMs));
    const rawAlpha = elapsedMs / windowMs;

    // Detect rally reset / teleport so ball doesn't smear across the net on new serve
    const ballTeleported =
      Math.hypot(curr.bx - prev.bx, curr.by - prev.by) > 280 ||
      (curr.ph === 'serve_wait' && prev.ph !== 'serve_wait');

    if (ballTeleported) {
      target.ball.x = curr.bx;
      target.ball.y = curr.by;
    } else if (rawAlpha <= 1.0) {
      // Pure Linear Interpolation (Lerp) between prev and curr 20Hz frames
      target.ball.x = prev.bx + (curr.bx - prev.bx) * rawAlpha;
      target.ball.y = prev.by + (curr.by - prev.by) * rawAlpha;
    } else {
      // Gentle bounded extrapolation up to 60ms if a Wi-Fi packet arrives slightly late
      const extraSec = Math.min(0.06, (elapsedMs - windowMs) / 1000);
      target.ball.x = Math.max(
        31,
        Math.min(COURT_WIDTH - 31, curr.bx + curr.bvx * extraSec)
      );
      target.ball.y = Math.min(GROUND_Y - 31, curr.by + curr.bvy * extraSec);
    }

    target.ball.vx = curr.bvx;
    target.ball.vy = curr.bvy;
    target.ball.isSpiked = curr.bsp === 1;
    target.ball.rotation += (curr.bvx * 0.014) * dt;

    for (const np of curr.pl) {
      const lp = target.players.find((p) => p.slot === np.s);
      if (!lp) continue;
      const pp = prev.pl.find((p) => p.s === np.s) || np;
      const jumpedFar = Math.hypot(np.x - pp.x, np.y - pp.y) > 240;

      if (jumpedFar || (curr.ph === 'serve_wait' && prev.ph !== 'serve_wait')) {
        lp.x = np.x;
        lp.y = np.y;
      } else if (rawAlpha <= 1.0) {
        lp.x = pp.x + (np.x - pp.x) * rawAlpha;
        lp.y = pp.y + (np.y - pp.y) * rawAlpha;
      } else {
        const extraSec = Math.min(0.05, (elapsedMs - windowMs) / 1000);
        lp.x = np.x + np.vx * extraSec;
        lp.y = Math.min(GROUND_Y, np.y + np.vy * extraSec);
      }

      lp.vx = np.vx;
      lp.vy = np.vy;
      lp.facing = np.f;
      lp.diveTimer = np.dt;
      lp.diveDir = np.dd;
      lp.spikeTimer = np.sp;
      lp.isBot = np.bot === 1;
      if (Math.abs(np.vx) > 20) {
        lp.animPhase += dt * 15;
      } else {
        lp.animPhase += dt * 3.5;
      }
    }
  }
}

export interface RoomCallbacks {
  onLobbyChange: (lobby: ResolvedLobbyState) => void;
  onPlayerDisconnected: (member: PresencePlayer, newHostName?: string) => void;
  onHostMigrated: (newHostClientId: string, newHostName: string) => void;
  onMatchStart: (pkt: StartMatchPacket) => void;
  onReturnToLobby: () => void;
  onGuestInput: (pkt: GuestInputPacket) => void;
  onStateSnapshot: (snap: NetStateSnapshot) => void;
  onConnectionStatus?: (connected: boolean, transport: 'supabase' | 'local_tab') => void;
}

/**
 * Manages Supabase Realtime Channel (Presence + Broadcast) for a 4-digit Room Code,
 * plus automatic BroadcastChannel fallback when testing across local tabs without Supabase keys.
 */
export class VolleyballRoomController {
  readonly roomCode: string;
  readonly clientId: string;
  private me: PresencePlayer;
  private mode: GameMode;
  private callbacks: RoomCallbacks;
  private sb: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private localBc: BroadcastChannel | null = null;
  private localPeers = new Map<string, { member: PresencePlayer; seenAt: number }>();
  private localHeartbeatIv: ReturnType<typeof setInterval> | null = null;
  private knownOnline = new Map<string, PresencePlayer>();
  private currentHostId: string | null = null;
  private lastSentInput: PlayerInput = {
    left: false,
    right: false,
    jump: false,
    down: false,
    action: false,
  };
  private inputSeq = 0;
  private destroyed = false;

  constructor(opts: {
    roomCode: string;
    initialMode: GameMode;
    me: Omit<PresencePlayer, 'joinedAt' | 'slotUpdatedAt'>;
    callbacks: RoomCallbacks;
  }) {
    this.roomCode = opts.roomCode.trim();
    this.clientId = opts.me.clientId;
    this.mode = opts.initialMode;
    this.callbacks = opts.callbacks;
    const now = Date.now();
    this.me = {
      ...opts.me,
      joinedAt: now,
      slotUpdatedAt: now,
    };
    this.knownOnline.set(this.clientId, this.me);
  }

  connect(): void {
    if (this.destroyed || this.channel || this.localBc) return;
    const sb = createDedicatedRoomSupabaseClient();

    if (sb) {
      this.sb = sb;
      // Primary: Supabase Realtime Presence + Broadcast on `room_code` channel
      const ch = sb.channel(`vb_room_${this.roomCode}`, {
        config: {
          presence: { key: this.clientId },
          broadcast: { self: false, ack: false },
        },
      });

      ch.on('presence', { event: 'sync' }, () => {
        if (this.destroyed) return;
        this.reconcileSupabasePresence(ch);
      })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          if (this.destroyed) return;
          this.handlePresenceLeaves(leftPresences as unknown as PresencePlayer[], () => {
            this.reconcileSupabasePresence(ch);
          });
        })
        .on('broadcast', { event: 'room_cfg' }, ({ payload }) => {
          if (this.destroyed || !payload) return;
          const cfg = payload as RoomConfigPacket;
          if (cfg.mode === '1v1' || cfg.mode === '2v2') {
            this.mode = cfg.mode;
            this.emitLobby();
          }
        })
        .on('broadcast', { event: 'start_match' }, ({ payload }) => {
          if (this.destroyed || !payload) return;
          const pkt = payload as StartMatchPacket;
          this.mode = pkt.mode;
          this.callbacks.onMatchStart(pkt);
        })
        .on('broadcast', { event: 'back_to_lobby' }, () => {
          if (this.destroyed) return;
          this.callbacks.onReturnToLobby();
        })
        .on('broadcast', { event: 'guest_input' }, ({ payload }) => {
          if (this.destroyed || !payload) return;
          this.callbacks.onGuestInput(payload as GuestInputPacket);
        })
        .on('broadcast', { event: 'state_sync' }, ({ payload }) => {
          if (this.destroyed || !payload) return;
          this.callbacks.onStateSnapshot(payload as NetStateSnapshot);
        })
        .subscribe(async (status) => {
          if (this.destroyed) return;
          if (status === 'SUBSCRIBED') {
            this.callbacks.onConnectionStatus?.(true, 'supabase');
            await ch.track(this.me);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            this.callbacks.onConnectionStatus?.(false, 'supabase');
          }
        });

      this.channel = ch;
    } else if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      // Fallback when NEXT_PUBLIC_SUPABASE_* are not set yet: multi-tab local Presence simulation!
      const bc = new BroadcastChannel(`vb_local_room_${this.roomCode}`);
      this.localPeers.set(this.clientId, { member: this.me, seenAt: Date.now() });
      this.callbacks.onConnectionStatus?.(true, 'local_tab');

      bc.onmessage = (ev) => {
        if (this.destroyed || !ev.data) return;
        const { event, payload } = ev.data as { event: string; payload: unknown };
        if (event === 'presence_ping') {
          const peer = payload as PresencePlayer;
          if (peer?.clientId && peer.clientId !== this.clientId) {
            const isNew = !this.localPeers.has(peer.clientId);
            this.localPeers.set(peer.clientId, { member: peer, seenAt: Date.now() });
            this.syncLocalPeers();
            if (isNew && this.currentHostId === this.clientId) {
              bc.postMessage({
                event: 'room_cfg',
                payload: { mode: this.mode, hostClientId: this.clientId },
              });
            }
          }
        } else if (event === 'presence_leave') {
          const leftId = (payload as { clientId?: string })?.clientId;
          if (leftId && this.localPeers.has(leftId)) {
            const departed = this.localPeers.get(leftId)!.member;
            this.localPeers.delete(leftId);
            this.handlePresenceLeaves([departed], () => this.syncLocalPeers());
          }
        } else if (event === 'room_cfg') {
          const cfg = payload as RoomConfigPacket;
          if (cfg.mode === '1v1' || cfg.mode === '2v2') {
            this.mode = cfg.mode;
            this.emitLobby();
          }
        } else if (event === 'start_match') {
          const pkt = payload as StartMatchPacket;
          this.mode = pkt.mode;
          this.callbacks.onMatchStart(pkt);
        } else if (event === 'back_to_lobby') {
          this.callbacks.onReturnToLobby();
        } else if (event === 'guest_input') {
          this.callbacks.onGuestInput(payload as GuestInputPacket);
        } else if (event === 'state_sync') {
          this.callbacks.onStateSnapshot(payload as NetStateSnapshot);
        }
      };

      this.localBc = bc;
      bc.postMessage({ event: 'presence_ping', payload: this.me });
      this.syncLocalPeers();

      this.localHeartbeatIv = setInterval(() => {
        if (this.destroyed || !this.localBc) return;
        const now = Date.now();
        this.localPeers.set(this.clientId, { member: this.me, seenAt: now });
        this.localBc.postMessage({ event: 'presence_ping', payload: this.me });

        const expired: PresencePlayer[] = [];
        for (const [cid, entry] of this.localPeers.entries()) {
          if (cid !== this.clientId && now - entry.seenAt > 3600) {
            expired.push(entry.member);
            this.localPeers.delete(cid);
          }
        }
        if (expired.length > 0) {
          this.handlePresenceLeaves(expired, () => this.syncLocalPeers());
        }
      }, 1100);
    } else {
      this.emitLobby();
    }
  }

  private reconcileSupabasePresence(ch: RealtimeChannel): void {
    const rawState = ch.presenceState<PresencePlayer>();
    const nextMap = new Map<string, PresencePlayer>();

    for (const presences of Object.values(rawState)) {
      if (Array.isArray(presences) && presences.length > 0) {
        const latest = presences[presences.length - 1];
        if (latest?.clientId) {
          nextMap.set(latest.clientId, latest);
        }
      }
    }

    if (!nextMap.has(this.clientId)) {
      nextMap.set(this.clientId, this.me);
    }

    const prevHost = this.currentHostId;
    this.knownOnline = nextMap;
    const resolved = this.emitLobby();

    if (
      prevHost &&
      resolved.hostClientId &&
      prevHost !== resolved.hostClientId &&
      !nextMap.has(prevHost)
    ) {
      const newHost = nextMap.get(resolved.hostClientId);
      if (newHost) {
        this.callbacks.onHostMigrated(newHost.clientId, newHost.name);
      }
    }

    // Whenever a new Guest joins, Host broadcasts current mode so Guest switches 1v1/2v2 automatically
    if (resolved.hostClientId === this.clientId) {
      this.sendBroadcast('room_cfg', {
        mode: this.mode,
        hostClientId: this.clientId,
      } satisfies RoomConfigPacket);
    }
  }

  private syncLocalPeers(): void {
    const nextMap = new Map<string, PresencePlayer>();
    for (const [cid, entry] of this.localPeers.entries()) {
      nextMap.set(cid, entry.member);
    }
    const prevHost = this.currentHostId;
    this.knownOnline = nextMap;
    const resolved = this.emitLobby();

    if (
      prevHost &&
      resolved.hostClientId &&
      prevHost !== resolved.hostClientId &&
      !nextMap.has(prevHost)
    ) {
      const newHost = nextMap.get(resolved.hostClientId);
      if (newHost) {
        this.callbacks.onHostMigrated(newHost.clientId, newHost.name);
      }
    }
  }

  private handlePresenceLeaves(
    leftList: PresencePlayer[],
    refreshFn: () => void
  ): void {
    const prevHost = this.currentHostId;
    refreshFn();
    const nextHostMember = this.currentHostId
      ? this.knownOnline.get(this.currentHostId)
      : undefined;

    for (const left of leftList) {
      if (!left?.clientId || left.clientId === this.clientId) continue;
      // Only notify if all tabs/connections for that clientId are truly gone
      if (!this.knownOnline.has(left.clientId)) {
        const migratedTo =
          prevHost === left.clientId && nextHostMember
            ? nextHostMember.name
            : undefined;
        this.callbacks.onPlayerDisconnected(left, migratedTo);
      }
    }
  }

  private emitLobby(): ResolvedLobbyState {
    const resolved = resolveLobbyPresence(
      Array.from(this.knownOnline.values()),
      this.mode
    );
    this.currentHostId = resolved.hostClientId;
    this.callbacks.onLobbyChange(resolved);
    return resolved;
  }

  private sendBroadcast(event: string, payload: unknown): void {
    if (this.destroyed) return;
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event,
        payload,
      });
    } else if (this.localBc) {
      this.localBc.postMessage({ event, payload });
    }
  }

  async updateMyPresence(
    patch: Partial<Pick<PresencePlayer, 'desiredSlot' | 'ready' | 'name' | 'skin' | 'color'>>
  ): Promise<void> {
    if (this.destroyed) return;
    const slotChanged =
      patch.desiredSlot !== undefined && patch.desiredSlot !== this.me.desiredSlot;
    this.me = {
      ...this.me,
      ...patch,
      slotUpdatedAt: slotChanged ? Date.now() : this.me.slotUpdatedAt,
    };
    this.knownOnline.set(this.clientId, this.me);
    this.emitLobby();

    if (this.channel) {
      await this.channel.track(this.me);
    } else if (this.localBc) {
      this.localPeers.set(this.clientId, { member: this.me, seenAt: Date.now() });
      this.localBc.postMessage({ event: 'presence_ping', payload: this.me });
    }
  }

  setRoomMode(nextMode: GameMode): void {
    if (this.currentHostId !== this.clientId) return;
    this.mode = nextMode;
    this.emitLobby();
    this.sendBroadcast('room_cfg', {
      mode: nextMode,
      hostClientId: this.clientId,
    } satisfies RoomConfigPacket);
  }

  broadcastMatchStart(pkt: StartMatchPacket): void {
    this.mode = pkt.mode;
    this.sendBroadcast('start_match', pkt);
  }

  broadcastReturnToLobby(): void {
    this.sendBroadcast('back_to_lobby', { ts: Date.now() });
  }

  /**
   * Host-only: Broadcasts compact state at 20 Hz (50 ms) over Supabase Broadcast.
   */
  broadcastHostState(snap: NetStateSnapshot): void {
    this.sendBroadcast('state_sync', snap);
  }

  /**
   * Event-Driven Guest Input: Sends ONLY when a key/button transitions (keydown / keyup).
   * NEVER call this in a frame loop; duplicate states are filtered out automatically!
   */
  sendGuestInputOnChange(slot: PlayerSlot, nextInput: PlayerInput): void {
    if (inputsEqual(this.lastSentInput, nextInput)) return;
    this.lastSentInput = { ...nextInput };
    this.inputSeq += 1;
    const pkt: GuestInputPacket = {
      clientId: this.clientId,
      slot,
      seq: this.inputSeq,
      inp: { ...nextInput },
    };
    this.sendBroadcast('guest_input', pkt);
  }

  resetSentInputState(): void {
    this.lastSentInput = {
      left: false,
      right: false,
      jump: false,
      down: false,
      action: false,
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.localHeartbeatIv) {
      clearInterval(this.localHeartbeatIv);
      this.localHeartbeatIv = null;
    }
    if (this.localBc) {
      try {
        this.localBc.postMessage({
          event: 'presence_leave',
          payload: { clientId: this.clientId },
        });
        this.localBc.close();
      } catch {
        // ignore
      }
      this.localBc = null;
    }
    if (this.channel || this.sb) {
      const sb = this.sb;
      const ch = this.channel;
      this.channel = null;
      this.sb = null;
      if (ch && sb) {
        void ch
          .untrack()
          .catch(() => { })
          .finally(() => {
            void sb.removeChannel(ch).finally(() => {
              sb.realtime.disconnect();
            });
          });
      } else if (sb) {
        sb.realtime.disconnect();
      }
    }
  }
}

// ============================================================================
// 3D Street Mini-Goal 3v3 (Up to 6 Players!) & 1v1 Penalty Shootout — Realtime Sync
// - 3v3 Mode: 6 Selectable Slots (`B1, B2, B3` vs `R1, R2, R3`), ~18 Hz (55ms) Host Broadcast,
//   Event-Driven Per-Slot Guest Input, 60 FPS Client Lerp, & Safe AI Takeover / Host Migration!
// - Penalty Mode: Zero per-frame messages! Broadcasts ONLY on Shooter Lock, Keeper Lock, & Turn Reveal.
// ============================================================================

import type {
  FootballAvatarProfile,
  KeeperLockChoice,
  PenaltySide,
  ResolvedTurnResult,
  ShooterLockChoice,
} from '@/games/soccer/penalty/rules';
import {
  ALL_FOOTBALL_SLOTS,
  BLUE_SLOTS,
  RED_SLOTS,
  type FootballFrameEvents,
  type FootballMatchPhase,
  type FootballMatchState,
  type FootballSlotId,
  type FootballTeam,
  type TeamControlInput,
} from '@/games/soccer/match3v3/physics';
import type { RenderPitchSnapshot, RenderPlayerFrame } from '@/games/soccer/match3v3/scene3d';

export type FootballLobbyMode = 'penalty' | 'match_3v3';

/** ~18.2 Hz (55ms) keeps 6-player Football + 4-player Volleyball + Main Island well under Supabase Free Tier limits! */
export const FOOTBALL_BROADCAST_INTERVAL_MS = 55;

const BALANCED_SLOT_CASCADE: readonly FootballSlotId[] = [
  'B1',
  'R1',
  'B2',
  'R2',
  'B3',
  'R3',
] as const;

export interface PenaltyPresenceMember {
  clientId: string;
  userId?: number | null;
  name: string;
  modelId: string;
  avatar?: FootballAvatarProfile | null;
  desiredSlot?: FootballSlotId;
  slotUpdatedAt?: number;
  ready: boolean;
  joinedAt: number;
  isCreator: boolean;
}

export interface PenaltyResolvedLobby {
  matchMode: FootballLobbyMode;
  hostClientId: string | null;
  slots: Partial<Record<FootballSlotId, PenaltyPresenceMember>>;
  p1: PenaltyPresenceMember | null;
  p2: PenaltyPresenceMember | null;
  onlinePlayers: PenaltyPresenceMember[];
  humanCount: number;
  maxPlayers: 2 | 6;
  bothPresent: boolean;
  allSlotsFilled: boolean;
  allHumansReady: boolean;
  allReady: boolean;
}

export interface PenaltyStartPacket {
  matchUid: string;
  roomCode: string;
  matchMode: FootballLobbyMode;
  hostClientId: string;
  slots: Partial<Record<FootballSlotId, PenaltyPresenceMember>>;
  slotAvatars?: Partial<Record<FootballSlotId, FootballAvatarProfile>>;
  slotModels?: Partial<Record<FootballSlotId, string>>;
  slotNames?: Partial<Record<FootballSlotId, string>>;
  p1: PenaltyPresenceMember;
  p2: PenaltyPresenceMember;
  startedAt: number;
}

export interface FootballCompactPlayerSnap {
  id: FootballSlotId;
  b?: 1; // 1 when AI Bot controls this slot
  cp?: 1; // 1 when calling for pass
  x: number;
  z: number;
  vx: number;
  vz: number;
  y: number; // yaw quantized
  st: number; // stamina
  ch: number; // shootCharge
  sl: number; // slideTimer
}

export interface FootballNetSnapshot {
  seq: number;
  hid?: string;
  ts: number;
  ph: FootballMatchPhase;
  tm: number; // timeRemaining
  sb: number; // scoreBlue
  sr: number; // scoreRed
  w: FootballTeam | null;
  bx: number;
  by: number;
  bz: number;
  bvx: number;
  bvz: number;
  pw: 0 | 1;
  pl: FootballCompactPlayerSnap[];
  gs?: Partial<Record<FootballSlotId, number>>;
  ev?: FootballFrameEvents;
}

export interface FootballGuestInputPacket {
  clientId: string;
  slot: FootballSlotId;
  seq: number;
  inp: TeamControlInput;
}

export function serializeFootballSnapshot(
  state: FootballMatchState,
  seq: number,
  accumEvents?: FootballFrameEvents,
  hostId?: string
): FootballNetSnapshot {
  const includeGoalsMap =
    Boolean(accumEvents?.goalTeam) || state.phase === 'finished' || state.phase === 'tie_to_penalty';
  return {
    seq,
    hid: hostId,
    ts: Date.now(),
    ph: state.phase,
    tm: Math.round(state.timeRemaining * 10) / 10,
    sb: state.scoreBlue,
    sr: state.scoreRed,
    w: state.winner,
    bx: r2(state.ball.x),
    by: r2(state.ball.y),
    bz: r2(state.ball.z),
    bvx: r2(state.ball.vx),
    bvz: r2(state.ball.vz),
    pw: state.ball.isPowerShot ? 1 : 0,
    pl: state.players.map((p) => ({
      id: p.id,
      b: p.isBot ? 1 : undefined,
      cp: p.callForPassTimer > 0.05 ? 1 : undefined,
      x: r2(p.x),
      z: r2(p.z),
      vx: r2(p.vx),
      vz: r2(p.vz),
      y: r2(p.facingYaw),
      st: Math.round(p.stamina),
      ch: Math.round(p.shootCharge),
      sl: r2(p.slideTimer),
    })),
    gs: includeGoalsMap ? { ...state.goalsBySlot } : undefined,
    ev: accumEvents && Object.keys(accumEvents).length > 0 ? accumEvents : undefined,
  };
}

function lerpYawAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

/**
 * 60 FPS Client-side Linear Interpolation (Lerp) for 6-Player Street Football Guests
 * between ~18 Hz (55 ms) Host snapshots.
 */
export class FootballStateInterpolator {
  private prev: FootballNetSnapshot | null = null;
  private curr: FootballNetSnapshot | null = null;
  private recvPerfMs = 0;
  private lastSeq = 0;
  private lastHostId: string | null = null;

  pushSnapshot(snap: FootballNetSnapshot, nowPerfMs: number): boolean {
    const hostChanged = Boolean(snap.hid && this.lastHostId && snap.hid !== this.lastHostId);
    const seqRestartedOnNewHost = !snap.hid && snap.seq <= 5 && this.lastSeq > 15;
    if (hostChanged || seqRestartedOnNewHost) {
      this.lastSeq = 0;
    }
    if (snap.seq <= this.lastSeq) return false;
    if (snap.hid) {
      this.lastHostId = snap.hid;
    }
    this.lastSeq = snap.seq;
    this.prev = this.curr || snap;
    this.curr = snap;
    this.recvPerfMs = nowPerfMs;
    return true;
  }

  sample(nowPerfMs: number): RenderPitchSnapshot | null {
    if (!this.curr) return null;
    const a = this.prev || this.curr;
    const b = this.curr;
    const alpha = Math.max(
      0,
      Math.min(1.18, (nowPerfMs - this.recvPerfMs) / FOOTBALL_BROADCAST_INTERVAL_MS)
    );
    const t = Math.min(1, alpha);

    // Jump directly without lerping across large kickoff teleports
    const ballJump = Math.hypot(b.bx - a.bx, b.bz - a.bz) > 8.5;
    const bt = ballJump ? 1 : t;

    const players: RenderPlayerFrame[] = b.pl.map((bp) => {
      const ap = a.pl.find((x) => x.id === bp.id) || bp;
      const pJump = Math.hypot(bp.x - ap.x, bp.z - ap.z) > 6.5;
      const pt = pJump ? 1 : t;
      return {
        id: bp.id,
        isBot: bp.b === 1,
        x: ap.x + (bp.x - ap.x) * pt,
        z: ap.z + (bp.z - ap.z) * pt,
        vx: bp.vx,
        vz: bp.vz,
        yaw: lerpYawAngle(ap.y, bp.y, pt),
        stamina: bp.st,
        shootCharge: bp.ch,
        slideTimer: bp.sl,
        callForPass: bp.cp === 1,
      };
    });

    return {
      ballX: a.bx + (b.bx - a.bx) * bt,
      ballY: a.by + (b.by - a.by) * bt,
      ballZ: a.bz + (b.bz - a.bz) * bt,
      ballVx: b.bvx,
      ballVz: b.bvz,
      isPowerShot: b.pw === 1,
      players,
    };
  }

  reset(): void {
    this.prev = null;
    this.curr = null;
    this.lastSeq = 0;
    this.lastHostId = null;
  }
}

export interface PenaltyShooterLockPacket {
  matchUid: string;
  turnIndex: number;
  clientId: string;
  slot?: FootballSlotId;
  choice: ShooterLockChoice;
}

export interface PenaltyKeeperLockPacket {
  matchUid: string;
  turnIndex: number;
  clientId: string;
  slot?: FootballSlotId;
  choice: KeeperLockChoice;
}

export interface PenaltyTurnRevealPacket {
  matchUid: string;
  result: ResolvedTurnResult;
}

export function resolvePenaltyLobbyPresence(
  members: PenaltyPresenceMember[],
  matchMode: FootballLobbyMode = 'match_3v3'
): PenaltyResolvedLobby {
  const maxPlayers: 2 | 6 = matchMode === 'match_3v3' ? 6 : 2;
  if (members.length === 0) {
    return {
      matchMode,
      hostClientId: null,
      slots: {},
      p1: null,
      p2: null,
      onlinePlayers: [],
      humanCount: 0,
      maxPlayers,
      bothPresent: false,
      allSlotsFilled: false,
      allHumansReady: false,
      allReady: false,
    };
  }

  const sorted = [...members].sort((a, b) => {
    if (a.isCreator !== b.isCreator) return a.isCreator ? -1 : 1;
    if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
    return a.clientId.localeCompare(b.clientId);
  });

  const hostClientId = sorted[0]?.clientId ?? null;
  const activeMembers = sorted.slice(0, maxPlayers);
  const allowedSlots: readonly FootballSlotId[] =
    matchMode === 'match_3v3' ? ALL_FOOTBALL_SLOTS : (['B1', 'R1'] as const);
  const cascadeOrder: readonly FootballSlotId[] =
    matchMode === 'match_3v3' ? BALANCED_SLOT_CASCADE : (['B1', 'R1'] as const);

  const slots: Partial<Record<FootballSlotId, PenaltyPresenceMember>> = {};
  const unplaced: PenaltyPresenceMember[] = [];

  // First pass: honor explicit valid `desiredSlot` (earlier joiner/claimant keeps slot on tie)
  const bySlotClaim = [...activeMembers].sort((a, b) => {
    const ta = a.slotUpdatedAt ?? a.joinedAt;
    const tb = b.slotUpdatedAt ?? b.joinedAt;
    if (ta !== tb) return ta - tb;
    return a.joinedAt - b.joinedAt;
  });

  for (const m of bySlotClaim) {
    const want = m.desiredSlot;
    if (want && allowedSlots.includes(want) && !slots[want]) {
      slots[want] = m;
    } else {
      unplaced.push(m);
    }
  }

  // Second pass: place remaining players in balanced B1 -> R1 -> B2 -> R2 -> B3 -> R3 cascade
  for (const m of unplaced) {
    const openSlot = cascadeOrder.find((s) => !slots[s]);
    if (openSlot) {
      slots[openSlot] = m;
    }
  }

  const firstBlue =
    BLUE_SLOTS.map((s) => slots[s]).find((x): x is PenaltyPresenceMember => Boolean(x)) ?? null;
  const firstRed =
    RED_SLOTS.map((s) => slots[s]).find((x): x is PenaltyPresenceMember => Boolean(x)) ?? null;

  const seatedMembers = Object.values(slots).filter(
    (x): x is PenaltyPresenceMember => Boolean(x)
  );
  const humanCount = seatedMembers.length;
  const bothPresent = Boolean(firstBlue && firstRed);
  const allSlotsFilled = humanCount >= maxPlayers;
  const allHumansReady =
    humanCount >= 1 &&
    seatedMembers.every((m) => m.clientId === hostClientId || m.ready);

  const allReady =
    matchMode === 'penalty'
      ? Boolean(slots.B1 && slots.R1 && allHumansReady)
      : Boolean(bothPresent && allHumansReady);

  return {
    matchMode,
    hostClientId,
    slots,
    p1: firstBlue,
    p2: firstRed,
    onlinePlayers: sorted.slice(0, 6),
    humanCount,
    maxPlayers,
    bothPresent,
    allSlotsFilled,
    allHumansReady,
    allReady,
  };
}

export interface PenaltyRoomCallbacks {
  onLobbyChange: (lobby: PenaltyResolvedLobby) => void;
  onOpponentLeft: (leftMember: PenaltyPresenceMember, newHostId: string | null) => void;
  onMatchStart: (pkt: PenaltyStartPacket) => void;
  onShooterLockedNotice: (turnIndex: number) => void;
  onKeeperLockedNotice: (turnIndex: number) => void;
  onShooterChoiceForHost: (pkt: PenaltyShooterLockPacket) => void;
  onKeeperChoiceForHost: (pkt: PenaltyKeeperLockPacket) => void;
  onTurnReveal: (pkt: PenaltyTurnRevealPacket) => void;
  onFootballGuestInput?: (pkt: FootballGuestInputPacket) => void;
  onFootballStateSnapshot?: (snap: FootballNetSnapshot) => void;
  onTieBreakToPenalty?: (matchUid: string, tiedScore?: number) => void;
  onReturnToLobby: () => void;
  onConnectionStatus?: (connected: boolean, transport: 'supabase' | 'local_tab') => void;
}

function quantizeAxis(v: number): number {
  if (Math.abs(v) < 0.08) return 0;
  return Math.round(Math.max(-1, Math.min(1, v)) * 10) / 10;
}

function teamInputsEqual(a: TeamControlInput, b: TeamControlInput): boolean {
  return (
    a.moveX === b.moveX &&
    a.moveZ === b.moveZ &&
    a.passSeq === b.passSeq &&
    a.shootCharging === b.shootCharging &&
    a.shootSeq === b.shootSeq &&
    a.sprint === b.sprint &&
    a.tackleSeq === b.tackleSeq
  );
}

export class PenaltyRoomController {
  readonly roomCode: string;
  readonly clientId: string;
  private me: PenaltyPresenceMember;
  private matchMode: FootballLobbyMode;
  private callbacks: PenaltyRoomCallbacks;
  private sb: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private localBc: BroadcastChannel | null = null;
  private localHeartbeatIv: ReturnType<typeof setInterval> | null = null;
  private localPeers = new Map<string, { member: PenaltyPresenceMember; seenAt: number }>();
  private knownOnline = new Map<string, PenaltyPresenceMember>();
  private lastSentFbInput: TeamControlInput = {
    moveX: 0,
    moveZ: 0,
    passSeq: 0,
    shootCharging: false,
    shootSeq: 0,
    sprint: false,
    tackleSeq: 0,
  };
  private fbInputSeq = 0;
  private destroyed = false;

  constructor(opts: {
    roomCode: string;
    initialMatchMode?: FootballLobbyMode;
    me: Omit<PenaltyPresenceMember, 'joinedAt'>;
    callbacks: PenaltyRoomCallbacks;
  }) {
    this.roomCode = opts.roomCode;
    this.clientId = opts.me.clientId;
    this.matchMode = opts.initialMatchMode || 'match_3v3';
    this.me = {
      ...opts.me,
      joinedAt: Date.now(),
    };
    this.callbacks = opts.callbacks;
    this.knownOnline.set(this.clientId, this.me);
  }

  connect(): void {
    if (this.destroyed || this.channel || this.localBc) return;
    const sb = createDedicatedRoomSupabaseClient();

    if (sb) {
      this.sb = sb;
      const ch = sb.channel(`penalty_room_${this.roomCode}`, {
        config: {
          presence: { key: this.clientId },
          broadcast: { self: false, ack: false },
        },
      });

      const syncPresence = () => {
        if (this.destroyed) return;
        const raw = ch.presenceState<PenaltyPresenceMember>();
        const nextMap = new Map<string, PenaltyPresenceMember>();
        for (const arr of Object.values(raw)) {
          if (Array.isArray(arr) && arr.length > 0) {
            const latest = arr[arr.length - 1];
            if (latest?.clientId) {
              nextMap.set(latest.clientId, latest);
            }
          }
        }
        if (!nextMap.has(this.clientId)) {
          nextMap.set(this.clientId, this.me);
        }
        this.knownOnline = nextMap;
        const resolved = this.emitLobby();
        if (resolved.hostClientId === this.clientId) {
          this.sendBroadcast('room_mode', { matchMode: this.matchMode });
        }
      };

      ch.on('presence', { event: 'sync' }, syncPresence)
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          if (this.destroyed) return;
          syncPresence();
          const resolved = resolvePenaltyLobbyPresence(
            Array.from(this.knownOnline.values()),
            this.matchMode
          );
          const leftList = (leftPresences || []) as unknown as PenaltyPresenceMember[];
          for (const left of leftList) {
            if (!left?.clientId || left.clientId === this.clientId) continue;
            if (!this.knownOnline.has(left.clientId)) {
              this.callbacks.onOpponentLeft(left, resolved.hostClientId);
            }
          }
        })
        .on('broadcast', { event: 'room_mode' }, ({ payload }) => {
          if (!this.destroyed && payload) {
            const m = (payload as { matchMode?: string }).matchMode;
            if (m === 'penalty' || m === 'match_3v3') {
              this.matchMode = m;
              this.emitLobby();
            }
          }
        })
        .on('broadcast', { event: 'penalty_start' }, ({ payload }) => {
          if (!this.destroyed && payload) {
            const pkt = payload as PenaltyStartPacket;
            if (pkt.matchMode) this.matchMode = pkt.matchMode;
            this.callbacks.onMatchStart(pkt);
          }
        })
        .on('broadcast', { event: 'shooter_locked_notice' }, ({ payload }) => {
          if (!this.destroyed && payload) {
            this.callbacks.onShooterLockedNotice(Number((payload as { turnIndex: number }).turnIndex));
          }
        })
        .on('broadcast', { event: 'keeper_locked_notice' }, ({ payload }) => {
          if (!this.destroyed && payload) {
            this.callbacks.onKeeperLockedNotice(Number((payload as { turnIndex: number }).turnIndex));
          }
        })
        .on('broadcast', { event: 'shooter_lock' }, ({ payload }) => {
          if (!this.destroyed && payload) {
            this.callbacks.onShooterChoiceForHost(payload as PenaltyShooterLockPacket);
          }
        })
        .on('broadcast', { event: 'keeper_lock' }, ({ payload }) => {
          if (!this.destroyed && payload) {
            this.callbacks.onKeeperChoiceForHost(payload as PenaltyKeeperLockPacket);
          }
        })
        .on('broadcast', { event: 'turn_reveal' }, ({ payload }) => {
          if (!this.destroyed && payload) {
            this.callbacks.onTurnReveal(payload as PenaltyTurnRevealPacket);
          }
        })
        .on('broadcast', { event: 'fb_input' }, ({ payload }) => {
          if (!this.destroyed && payload) {
            this.callbacks.onFootballGuestInput?.(payload as FootballGuestInputPacket);
          }
        })
        .on('broadcast', { event: 'fb_state' }, ({ payload }) => {
          if (!this.destroyed && payload) {
            this.callbacks.onFootballStateSnapshot?.(payload as FootballNetSnapshot);
          }
        })
        .on('broadcast', { event: 'tie_to_penalty' }, ({ payload }) => {
          if (!this.destroyed && payload) {
            const p = payload as { matchUid?: string; tiedScore?: number };
            this.callbacks.onTieBreakToPenalty?.(
              String(p.matchUid || ''),
              typeof p.tiedScore === 'number' ? p.tiedScore : undefined
            );
          }
        })
        .on('broadcast', { event: 'back_to_lobby' }, () => {
          if (!this.destroyed) {
            this.callbacks.onReturnToLobby();
          }
        })
        .subscribe(async (status) => {
          if (this.destroyed) return;
          if (status === 'SUBSCRIBED') {
            this.callbacks.onConnectionStatus?.(true, 'supabase');
            await ch.track(this.me);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            this.callbacks.onConnectionStatus?.(false, 'supabase');
          }
        });

      this.channel = ch;
    } else if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel(`penalty_local_room_${this.roomCode}`);
      this.localPeers.set(this.clientId, { member: this.me, seenAt: Date.now() });
      this.callbacks.onConnectionStatus?.(true, 'local_tab');

      bc.onmessage = (ev) => {
        if (this.destroyed || !ev.data) return;
        const { event, payload } = ev.data as { event: string; payload: unknown };
        if (event === 'presence_ping') {
          const peer = payload as PenaltyPresenceMember;
          if (peer?.clientId && peer.clientId !== this.clientId) {
            const isNew = !this.localPeers.has(peer.clientId);
            this.localPeers.set(peer.clientId, { member: peer, seenAt: Date.now() });
            const resolved = this.syncLocalPeers();
            if (isNew && resolved.hostClientId === this.clientId) {
              bc.postMessage({ event: 'room_mode', payload: { matchMode: this.matchMode } });
            }
          }
        } else if (event === 'presence_leave') {
          const leftId = (payload as { clientId?: string })?.clientId;
          if (leftId && this.localPeers.has(leftId)) {
            const gone = this.localPeers.get(leftId)!.member;
            this.localPeers.delete(leftId);
            const resolved = this.syncLocalPeers();
            this.callbacks.onOpponentLeft(gone, resolved.hostClientId);
          }
        } else if (event === 'room_mode') {
          const m = (payload as { matchMode?: string })?.matchMode;
          if (m === 'penalty' || m === 'match_3v3') {
            this.matchMode = m;
            this.emitLobby();
          }
        } else if (event === 'penalty_start') {
          const pkt = payload as PenaltyStartPacket;
          if (pkt.matchMode) this.matchMode = pkt.matchMode;
          this.callbacks.onMatchStart(pkt);
        } else if (event === 'shooter_locked_notice') {
          this.callbacks.onShooterLockedNotice(Number((payload as { turnIndex: number }).turnIndex));
        } else if (event === 'keeper_locked_notice') {
          this.callbacks.onKeeperLockedNotice(Number((payload as { turnIndex: number }).turnIndex));
        } else if (event === 'shooter_lock') {
          this.callbacks.onShooterChoiceForHost(payload as PenaltyShooterLockPacket);
        } else if (event === 'keeper_lock') {
          this.callbacks.onKeeperChoiceForHost(payload as PenaltyKeeperLockPacket);
        } else if (event === 'turn_reveal') {
          this.callbacks.onTurnReveal(payload as PenaltyTurnRevealPacket);
        } else if (event === 'fb_input') {
          this.callbacks.onFootballGuestInput?.(payload as FootballGuestInputPacket);
        } else if (event === 'fb_state') {
          this.callbacks.onFootballStateSnapshot?.(payload as FootballNetSnapshot);
        } else if (event === 'tie_to_penalty') {
          const p = payload as { matchUid?: string; tiedScore?: number };
          this.callbacks.onTieBreakToPenalty?.(
            String(p?.matchUid || ''),
            typeof p?.tiedScore === 'number' ? p.tiedScore : undefined
          );
        } else if (event === 'back_to_lobby') {
          this.callbacks.onReturnToLobby();
        }
      };

      this.localBc = bc;
      bc.postMessage({ event: 'presence_ping', payload: this.me });
      this.syncLocalPeers();

      this.localHeartbeatIv = setInterval(() => {
        if (this.destroyed || !this.localBc) return;
        const now = Date.now();
        this.localPeers.set(this.clientId, { member: this.me, seenAt: now });
        this.localBc.postMessage({ event: 'presence_ping', payload: this.me });
        for (const [cid, entry] of this.localPeers.entries()) {
          if (cid !== this.clientId && now - entry.seenAt > 3600) {
            this.localPeers.delete(cid);
            const resolved = this.syncLocalPeers();
            this.callbacks.onOpponentLeft(entry.member, resolved.hostClientId);
          }
        }
      }, 1100);
    } else {
      this.emitLobby();
    }
  }

  private syncLocalPeers(): PenaltyResolvedLobby {
    const nextMap = new Map<string, PenaltyPresenceMember>();
    for (const [cid, entry] of this.localPeers.entries()) {
      nextMap.set(cid, entry.member);
    }
    this.knownOnline = nextMap;
    return this.emitLobby();
  }

  private emitLobby(): PenaltyResolvedLobby {
    const resolved = resolvePenaltyLobbyPresence(
      Array.from(this.knownOnline.values()),
      this.matchMode
    );
    this.callbacks.onLobbyChange(resolved);
    return resolved;
  }

  private sendBroadcast(event: string, payload: unknown): void {
    if (this.destroyed) return;
    if (this.channel) {
      this.channel.send({ type: 'broadcast', event, payload });
    } else if (this.localBc) {
      this.localBc.postMessage({ event, payload });
    }
  }

  async updateMyPresence(
    patch: Partial<
      Pick<
        PenaltyPresenceMember,
        'ready' | 'modelId' | 'name' | 'avatar' | 'desiredSlot' | 'slotUpdatedAt'
      >
    >
  ): Promise<void> {
    if (this.destroyed) return;
    this.me = { ...this.me, ...patch };
    this.knownOnline.set(this.clientId, this.me);
    this.emitLobby();
    if (this.channel) {
      await this.channel.track(this.me);
    } else if (this.localBc) {
      this.localPeers.set(this.clientId, { member: this.me, seenAt: Date.now() });
      this.localBc.postMessage({ event: 'presence_ping', payload: this.me });
    }
  }

  setLobbyMatchMode(nextMode: FootballLobbyMode): void {
    this.matchMode = nextMode;
    this.emitLobby();
    this.sendBroadcast('room_mode', { matchMode: nextMode });
  }

  broadcastMatchStart(pkt: PenaltyStartPacket): void {
    this.matchMode = pkt.matchMode;
    this.sendBroadcast('penalty_start', pkt);
  }

  /**
   * Host-only: Broadcasts 3v3 field state at ~18 Hz (every 55 ms).
   */
  broadcastFootballHostState(snap: FootballNetSnapshot): void {
    this.sendBroadcast('fb_state', snap);
  }

  /**
   * Event-Driven Guest Input for 6-Player Street Football:
   * Transmits ONLY when quantized movement or button states change for `mySlot`!
   */
  sendFootballGuestInputOnChange(mySlot: FootballSlotId, rawInput: TeamControlInput): void {
    const quantized: TeamControlInput = {
      ...rawInput,
      moveX: quantizeAxis(rawInput.moveX),
      moveZ: quantizeAxis(rawInput.moveZ),
    };
    if (teamInputsEqual(this.lastSentFbInput, quantized)) return;
    this.lastSentFbInput = { ...quantized };
    this.fbInputSeq += 1;
    const pkt: FootballGuestInputPacket = {
      clientId: this.clientId,
      slot: mySlot,
      seq: this.fbInputSeq,
      inp: quantized,
    };
    this.sendBroadcast('fb_input', pkt);
  }

  resetFootballInputCache(): void {
    this.lastSentFbInput = {
      moveX: 0,
      moveZ: 0,
      passSeq: 0,
      shootCharging: false,
      shootSeq: 0,
      sprint: false,
      tackleSeq: 0,
    };
  }

  broadcastTieBreakToPenalty(matchUid: string, tiedScore?: number): void {
    this.sendBroadcast('tie_to_penalty', { matchUid, tiedScore });
  }

  sendShooterLock(pkt: PenaltyShooterLockPacket, amIHost: boolean): void {
    this.sendBroadcast('shooter_locked_notice', { turnIndex: pkt.turnIndex });
    if (!amIHost) {
      this.sendBroadcast('shooter_lock', pkt);
    }
  }

  sendKeeperLock(pkt: PenaltyKeeperLockPacket, amIHost: boolean): void {
    this.sendBroadcast('keeper_locked_notice', { turnIndex: pkt.turnIndex });
    if (!amIHost) {
      this.sendBroadcast('keeper_lock', pkt);
    }
  }

  broadcastTurnReveal(pkt: PenaltyTurnRevealPacket): void {
    this.sendBroadcast('turn_reveal', pkt);
  }

  broadcastReturnToLobby(): void {
    this.sendBroadcast('back_to_lobby', { ts: Date.now() });
  }

  getMySide(p1Id: string): PenaltySide {
    return this.clientId === p1Id ? 'p1' : 'p2';
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.localHeartbeatIv) {
      clearInterval(this.localHeartbeatIv);
      this.localHeartbeatIv = null;
    }
    if (this.localBc) {
      try {
        this.localBc.postMessage({ event: 'presence_leave', payload: { clientId: this.clientId } });
        this.localBc.close();
      } catch {
        // ignore
      }
      this.localBc = null;
    }
    if (this.channel || this.sb) {
      const sb = this.sb;
      const ch = this.channel;
      this.channel = null;
      this.sb = null;
      if (ch && sb) {
        void ch
          .untrack()
          .catch(() => { })
          .finally(() => {
            void sb.removeChannel(ch).finally(() => {
              sb.realtime.disconnect();
            });
          });
      } else if (sb) {
        sb.realtime.disconnect();
      }
    }
  }
}
