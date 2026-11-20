export type ShabuIngredient = 'meat' | 'seafood' | 'veggie' | 'sauce';
export type ShabuSlotId = 'P1' | 'P2' | 'P3' | 'P4';

export interface ShabuIngredientMeta {
  id: ShabuIngredient;
  emoji: string;
  label: string;
  stationName: string;
  colorHex: number;
  x: number;
  z: number;
}

export const SHABU_STATIONS: ShabuIngredientMeta[] = [
  { id: 'meat', emoji: '🥩', label: 'เนื้อ/สามชั้น', stationName: 'บาร์เนื้อ & สามชั้น', colorHex: 0xf97316, x: -5.2, z: -2.9 },
  { id: 'seafood', emoji: '🦐', label: 'ซีฟู้ด', stationName: 'บาร์ซีฟู้ดสด', colorHex: 0x38bdf8, x: 5.2, z: -2.9 },
  { id: 'veggie', emoji: '🥬', label: 'ผัก/เห็ด', stationName: 'บาร์ผัก & เห็ด', colorHex: 0x4ade80, x: -5.2, z: 3.1 },
  { id: 'sauce', emoji: '🥣', label: 'น้ำจิ้มสุกี้', stationName: 'บาร์น้ำจิ้มสุกี้', colorHex: 0xc084fc, x: 5.2, z: 3.1 },
];

export const SHABU_STATION_MAP: Record<ShabuIngredient, ShabuIngredientMeta> = {
  meat: SHABU_STATIONS[0],
  seafood: SHABU_STATIONS[1],
  veggie: SHABU_STATIONS[2],
  sauce: SHABU_STATIONS[3],
};

export const SHABU_POT_POS = { x: 0, z: 0.45 };
export const SHABU_GUARD_POS = { x: 0, z: -1.15 };
export const SHABU_BOUNDS = { halfW: 6.4, halfD: 4.3 };

export interface ShabuInputState {
  mx: number; // -1..1
  mz: number; // -1..1
  interact: boolean;
  dash: boolean;
}

export interface ShabuPlayerState {
  slotId: ShabuSlotId;
  x: number;
  z: number;
  vx: number;
  vz: number;
  rotY: number;
  holding: ShabuIngredient | null;
  dashTimer: number;
  dashCooldown: number;
  prevInteract: boolean;
}

export interface ShabuOrderItem {
  ingredient: ShabuIngredient;
  delivered: boolean;
}

export interface ShabuGameState {
  players: ShabuPlayerState[];
  order: ShabuOrderItem[];
  hunger: number; // 0..100 (0 = Guard flips the pot -> Game Over!)
  speedMult: number; // 1.0 -> 2.8
  score: number;
  combo: number;
  maxCombo: number;
  dishesServed: number;
  phase: 'playing' | 'pot_flipped' | 'finished';
  flipTimer: number;
  potY: number;
  potRotX: number;
  potRotZ: number;
  feedbackText: string;
  feedbackTimer: number;
}

export interface ShabuStepEvents {
  pickup?: boolean;
  drop?: boolean;
  serve?: boolean;
  wrong?: boolean;
  dash?: boolean;
  flip?: boolean;
}

const ALL_INGREDIENTS: ShabuIngredient[] = ['meat', 'seafood', 'veggie', 'sauce'];

function generateOrder(dishesServed: number, playerCount: number): ShabuOrderItem[] {
  // จำนวนอาหารที่พี่ยามสั่งเพิ่มตามจำนวนคนเล่น (1คน: 2-3, 2คน: 3-4, 3คน: 4-5, 4คน: 5-6 ชิ้น)
  const baseForPlayers = Math.max(2, Math.min(5, playerCount + 1));
  const waveExtra = dishesServed >= 2 ? 1 : 0;
  const count = Math.min(6, baseForPlayers + waveExtra);
  const items: ShabuOrderItem[] = [];
  for (let i = 0; i < count; i++) {
    const pick = ALL_INGREDIENTS[Math.floor(Math.random() * ALL_INGREDIENTS.length)];
    items.push({ ingredient: pick, delivered: false });
  }
  return items;
}

const SLOT_SPAWNS: Record<ShabuSlotId, { x: number; z: number }> = {
  P1: { x: -2.4, z: 2.3 },
  P2: { x: 2.4, z: 2.3 },
  P3: { x: -2.8, z: -0.6 },
  P4: { x: 2.8, z: -0.6 },
};

export function createInitialShabuState(activeSlots: ShabuSlotId[]): ShabuGameState {
  const players: ShabuPlayerState[] = activeSlots.map((slotId) => ({
    slotId,
    x: SLOT_SPAWNS[slotId].x,
    z: SLOT_SPAWNS[slotId].z,
    vx: 0,
    vz: 0,
    rotY: 0,
    holding: null,
    dashTimer: 0,
    dashCooldown: 0,
    prevInteract: false,
  }));

  return {
    players,
    order: generateOrder(0, players.length),
    hunger: 100,
    speedMult: 1.0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    dishesServed: 0,
    phase: 'playing',
    flipTimer: 0,
    potY: 0.95,
    potRotX: 0,
    potRotZ: 0,
    feedbackText: '',
    feedbackTimer: 0,
  };
}

const WALK_SPEED = 5.6;
const DASH_SPEED = 11.4;
const DASH_DURATION = 0.2;
const DASH_COOLDOWN = 0.85;

// Center table collider (players walk around it, not through it)
const TABLE_HALF_W = 1.65;
const TABLE_HALF_D = 1.1;

export function stepShabuGame(
  state: ShabuGameState,
  inputs: Record<ShabuSlotId, ShabuInputState>,
  dtRaw: number
): ShabuStepEvents {
  const dt = Math.min(0.033, Math.max(0.001, dtRaw));
  const events: ShabuStepEvents = {};

  if (state.feedbackTimer > 0) {
    state.feedbackTimer = Math.max(0, state.feedbackTimer - dt);
    if (state.feedbackTimer === 0) state.feedbackText = '';
  }

  if (state.phase === 'finished') {
    return events;
  }

  if (state.phase === 'pot_flipped') {
    state.flipTimer -= dt;
    // Dramatic pot flying & flipping animation!
    const t = 1.35 - state.flipTimer;
    state.potY = Math.max(0.35, 0.95 + t * 5.2 - 0.5 * 14 * t * t);
    state.potRotX = Math.min(Math.PI * 1.15, t * 5.5);
    state.potRotZ = Math.min(Math.PI * 0.7, t * 3.2);
    if (state.flipTimer <= 0) {
      state.phase = 'finished';
    }
    return events;
  }

  // Drain Guard's hunger meter faster as dishesServed increases
  const baseDrain = 3.15;
  const playerCountScale = 1 + Math.max(0, state.players.length - 1) * 0.16;
  state.speedMult = Math.min(2.85, 1 + state.dishesServed * 0.14);
  state.hunger = Math.max(0, state.hunger - baseDrain * state.speedMult * playerCountScale * dt);

  if (state.hunger <= 0) {
    state.phase = 'pot_flipped';
    state.flipTimer = 1.35;
    state.feedbackText = '🤬 พี่ยามหิวจัด! คว่ำหม้อชาบูแล้ว!!';
    state.feedbackTimer = 2.0;
    events.flip = true;
    return events;
  }

  // Update players
  for (const p of state.players) {
    const inp = inputs[p.slotId] || { mx: 0, mz: 0, interact: false, dash: false };
    if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    if (p.dashTimer > 0) p.dashTimer = Math.max(0, p.dashTimer - dt);

    let dx = inp.mx;
    let dz = inp.mz;
    const len = Math.hypot(dx, dz);
    if (len > 1) {
      dx /= len;
      dz /= len;
    }

    if (inp.dash && p.dashCooldown <= 0 && len > 0.15) {
      p.dashTimer = DASH_DURATION;
      p.dashCooldown = DASH_COOLDOWN;
      events.dash = true;
    }

    const spd = p.dashTimer > 0 ? DASH_SPEED : WALK_SPEED;
    p.vx = dx * spd;
    p.vz = dz * spd;
    p.x += p.vx * dt;
    p.z += p.vz * dt;

    if (len > 0.12) {
      // Character faces +X when rotY = 0
      p.rotY = Math.atan2(-dz, dx);
    }

    // Clamp to room bounds
    p.x = Math.max(-SHABU_BOUNDS.halfW, Math.min(SHABU_BOUNDS.halfW, p.x));
    p.z = Math.max(-SHABU_BOUNDS.halfD + 0.5, Math.min(SHABU_BOUNDS.halfD, p.z));

    // Push player outside center Shabu Table
    const relX = p.x - SHABU_POT_POS.x;
    const relZ = p.z - SHABU_POT_POS.z;
    if (Math.abs(relX) < TABLE_HALF_W && Math.abs(relZ) < TABLE_HALF_D) {
      const penX = TABLE_HALF_W - Math.abs(relX);
      const penZ = TABLE_HALF_D - Math.abs(relZ);
      if (penX < penZ) {
        p.x = SHABU_POT_POS.x + (relX >= 0 ? TABLE_HALF_W : -TABLE_HALF_W);
      } else {
        p.z = SHABU_POT_POS.z + (relZ >= 0 ? TABLE_HALF_D : -TABLE_HALF_D);
      }
    }

    // Edge-triggered Interact (Pick up from station OR drop into hotpot)
    const justPressed = inp.interact && !p.prevInteract;
    p.prevInteract = inp.interact;

    if (justPressed) {
      // 1. Check proximity to center Hotpot first if holding an item
      const distPot = Math.hypot(p.x - SHABU_POT_POS.x, p.z - SHABU_POT_POS.z);
      if (p.holding && distPot < 2.65) {
        const matchIdx = state.order.findIndex(
          (item) => !item.delivered && item.ingredient === p.holding
        );
        if (matchIdx !== -1) {
          state.order[matchIdx].delivered = true;
          p.holding = null;
          state.hunger = Math.min(100, state.hunger + 8);
          events.drop = true;

          // Check if entire order is complete!
          if (state.order.every((it) => it.delivered)) {
            state.dishesServed++;
            state.combo++;
            if (state.combo > state.maxCombo) state.maxCombo = state.combo;
            const gained = 50 * state.order.length + Math.min(180, (state.combo - 1) * 25);
            state.score += gained;
            state.hunger = Math.min(100, state.hunger + 26);
            state.order = generateOrder(state.dishesServed, state.players.length);
            state.feedbackText = `😋 พี่ยามฟิน! +${gained} แต้ม (คอมโบ x${state.combo})`;
            state.feedbackTimer = 1.3;
            events.serve = true;
          }
        } else {
          // Wrong ingredient dropped into pot!
          p.holding = null;
          state.combo = 0;
          state.hunger = Math.max(0, state.hunger - 4);
          state.feedbackText = '❌ พี่ยามไม่ได้สั่งอันนี้! (คอมโบหลุด)';
          state.feedbackTimer = 1.1;
          events.wrong = true;
        }
        continue;
      }

      // 2. Otherwise check proximity to any of the 4 Buffet Stations to pick up / swap
      let nearestStation: ShabuIngredientMeta | null = null;
      let nearestDist = 2.45;
      for (const st of SHABU_STATIONS) {
        const d = Math.hypot(p.x - st.x, p.z - st.z);
        if (d < nearestDist) {
          nearestDist = d;
          nearestStation = st;
        }
      }
      if (nearestStation) {
        p.holding = nearestStation.id;
        events.pickup = true;
      }
    }
  }

  return events;
}

export function computeShabuGpReward(score: number): number {
  return Math.min(15, Math.max(0, Math.floor(score / 100)));
}

let shabuAudioCtx: AudioContext | null = null;
function getShabuAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!shabuAudioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) shabuAudioCtx = new Ctx();
  }
  if (shabuAudioCtx && shabuAudioCtx.state === 'suspended') {
    shabuAudioCtx.resume().catch(() => {});
  }
  return shabuAudioCtx;
}

export function playShabuSound(
  kind: 'pickup' | 'drop' | 'serve' | 'wrong' | 'dash' | 'flip',
  muted = false
): void {
  if (muted) return;
  const ctx = getShabuAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (kind === 'pickup') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.08);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.start(now);
    osc.stop(now + 0.09);
  } else if (kind === 'drop') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.11);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  } else if (kind === 'serve') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.08);
    osc.frequency.setValueAtTime(783.99, now + 0.16);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.start(now);
    osc.stop(now + 0.33);
  } else if (kind === 'wrong') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (kind === 'dash') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.08);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.start(now);
    osc.stop(now + 0.09);
  } else if (kind === 'flip') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.45);
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    osc.start(now);
    osc.stop(now + 0.5);
  }
}
