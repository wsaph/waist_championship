// lib/penalty_rules.ts
// Core rules, 6-zone goal math, Timing Power Bar, 5-kick + Sudden Death state machine, and AI for 3D Penalty Shootout

export type PenaltySide = 'p1' | 'p2';

export type PenaltyZone =
  | 'top_left'
  | 'top_center'
  | 'top_right'
  | 'bottom_left'
  | 'bottom_center'
  | 'bottom_right';

export type PowerBarZone = 'yellow' | 'green' | 'red';

export type ShotOutcome = 'goal' | 'saved' | 'over' | 'post';

export type PenaltyDifficulty = 'easy' | 'normal' | 'hard';

export interface FootballAvatarProfile {
  playerId?: number;
  name: string;
  emoji?: string;
  colorHex: string;
  species: string;
  equipHat?: string;
  equipFace?: string;
  equipArmor?: string;
  equipWings?: string;
  equipAura?: string;
  propColors?: Record<string, string>;
  bellyScale?: number;
  muscleScale?: number;
}

export interface GoalZoneMeta {
  id: PenaltyZone;
  label: string;
  shortLabel: string;
  row: 'top' | 'bottom';
  col: 'left' | 'center' | 'right';
  /** Target world X inside goal frame (meters, negative = left of shooter, positive = right of shooter) */
  targetX: number;
  /** Target world Y inside goal frame (meters above ground) */
  targetY: number;
}

export const GOAL_WIDTH = 7.32;
export const GOAL_HEIGHT = 2.65;
export const GOAL_DEPTH = 2.2;
export const GOAL_Z = -11.0;
export const PENALTY_SPOT_Z = 0.0;
export const REGULATION_KICKS = 5;
export const GK_DECISION_SECONDS = 8;
export const MATCH_DURATION_SEC_FALLBACK = 180;

export const GOAL_ZONES: GoalZoneMeta[] = [
  {
    id: 'top_left',
    label: 'ซ้ายบน',
    shortLabel: '↖ ซ้ายบน',
    row: 'top',
    col: 'left',
    targetX: -2.55,
    targetY: 2.02,
  },
  {
    id: 'top_center',
    label: 'กลางบน',
    shortLabel: '⬆ กลางบน',
    row: 'top',
    col: 'center',
    targetX: 0,
    targetY: 2.05,
  },
  {
    id: 'top_right',
    label: 'ขวาบน',
    shortLabel: '↗ ขวาบน',
    row: 'top',
    col: 'right',
    targetX: 2.55,
    targetY: 2.02,
  },
  {
    id: 'bottom_left',
    label: 'ซ้ายล่าง',
    shortLabel: '↙ ซ้ายล่าง',
    row: 'bottom',
    col: 'left',
    targetX: -2.65,
    targetY: 0.62,
  },
  {
    id: 'bottom_center',
    label: 'กลางล่าง',
    shortLabel: '⬇ กลางล่าง',
    row: 'bottom',
    col: 'center',
    targetX: 0,
    targetY: 0.58,
  },
  {
    id: 'bottom_right',
    label: 'ขวาล่าง',
    shortLabel: '↘ ขวาล่าง',
    row: 'bottom',
    col: 'right',
    targetX: 2.65,
    targetY: 0.62,
  },
];

export function getGoalZoneMeta(zone: PenaltyZone): GoalZoneMeta {
  return GOAL_ZONES.find((z) => z.id === zone) || GOAL_ZONES[0];
}

export interface PenaltyCharacterDef {
  id: string;
  name: string;
  emoji: string;
  /** Primary .glb path in public/models/ */
  glbPath: string;
  /** Secondary .glb path if primary custom file is not placed yet */
  fallbackGlbPath?: string;
  accentColor: string;
  earStyle: 'fox' | 'bunny' | 'bear' | 'cat' | 'dog' | 'frog' | 'duck';
}

export const PENALTY_CHARACTERS: PenaltyCharacterDef[] = [
  {
    id: 'fox_hero',
    name: 'จิ้งจอกสลาตัน (Fox Hero)',
    emoji: '🦊',
    glbPath: '/models/fox_hero.glb',
    fallbackGlbPath: '/models/fox.glb',
    accentColor: '#F97316',
    earStyle: 'fox',
  },
  {
    id: 'bunny_hero',
    name: 'กระต่ายสายฟ้า (Bunny Hero)',
    emoji: '🐰',
    glbPath: '/models/bunny_hero.glb',
    fallbackGlbPath: '/models/bunny.glb',
    accentColor: '#F472B6',
    earStyle: 'bunny',
  },
  {
    id: 'husky_hero',
    name: 'ฮัสกี้จอมเซฟ (Husky Hero)',
    emoji: '🐺',
    glbPath: '/models/husky_hero.glb',
    accentColor: '#38BDF8',
    earStyle: 'dog',
  },
  {
    id: 'lion_hero',
    name: 'สิงโตกัปตัน (Lion Hero)',
    emoji: '🦁',
    glbPath: '/models/lion_hero.glb',
    accentColor: '#FACC15',
    earStyle: 'cat',
  },
  {
    id: 'panda_hero',
    name: 'แพนด้าปั่นโค้ง (Panda Hero)',
    emoji: '🐼',
    glbPath: '/models/panda_hero.glb',
    accentColor: '#A3E635',
    earStyle: 'bear',
  },
  {
    id: 'tiger_hero',
    name: 'เสือดาวซัลโว (Tiger Hero)',
    emoji: '🐯',
    glbPath: '/models/tiger_hero.glb',
    accentColor: '#FB923C',
    earStyle: 'cat',
  },
  {
    id: 'capybara_hero',
    name: 'คาปิบาร่านิ่งสนิท (Capybara)',
    emoji: '🦫',
    glbPath: '/models/capybara_hero.glb',
    accentColor: '#D97706',
    earStyle: 'bear',
  },
  {
    id: 'frog_hero',
    name: 'กบสปริงเหินเวหา (Frog Hero)',
    emoji: '🐸',
    glbPath: '/models/frog_hero.glb',
    accentColor: '#22C55E',
    earStyle: 'frog',
  },
  {
    id: 'duck_hero',
    name: 'เป็ดทองคำ (Duck Hero)',
    emoji: '🦆',
    glbPath: '/models/duck_hero.glb',
    accentColor: '#FDE047',
    earStyle: 'duck',
  },
  {
    id: 'alpaca_hero',
    name: 'อัลปาก้าปุยเมฆ (Alpaca)',
    emoji: '🦙',
    glbPath: '/models/alpaca_hero.glb',
    accentColor: '#C084FC',
    earStyle: 'bunny',
  },
  {
    id: 'cat',
    name: 'เหมียวสายพริ้ว (Cat Striker)',
    emoji: '🐱',
    glbPath: '/models/cat.glb',
    accentColor: '#FB7185',
    earStyle: 'cat',
  },
  {
    id: 'bear',
    name: 'หมีจอมพลัง (Grizzly Keeper)',
    emoji: '🐻',
    glbPath: '/models/bear.glb',
    accentColor: '#A16207',
    earStyle: 'bear',
  },
];

export function getPenaltyCharacter(modelId?: string): PenaltyCharacterDef {
  if (!modelId) return PENALTY_CHARACTERS[0];
  return (
    PENALTY_CHARACTERS.find((c) => c.id === modelId || c.glbPath === modelId) ||
    PENALTY_CHARACTERS[0]
  );
}

export function mapSpeciesOrEmojiToPenaltyChar(species?: string, emoji?: string): string {
  const sp = (species || '').toLowerCase();
  if (sp.includes('fox') || sp.includes('kitsune')) return 'fox_hero';
  if (sp.includes('bunny') || sp.includes('rabbit') || sp.includes('lop')) return 'bunny_hero';
  if (sp.includes('husky') || sp.includes('dog') || sp.includes('corgi') || sp.includes('shiba'))
    return 'husky_hero';
  if (sp.includes('lion') || sp.includes('dragon')) return 'lion_hero';
  if (sp.includes('panda') || sp.includes('raccoon')) return 'panda_hero';
  if (sp.includes('tiger') || sp.includes('bengal')) return 'tiger_hero';
  if (sp.includes('capybara')) return 'capybara_hero';
  if (sp.includes('frog') || sp.includes('trex')) return 'frog_hero';
  if (sp.includes('duck')) return 'duck_hero';
  if (sp.includes('alpaca') || sp.includes('sheep') || sp.includes('unicorn')) return 'alpaca_hero';
  if (sp.includes('cat')) return 'cat';
  if (sp.includes('bear')) return 'bear';

  if (emoji === '🐰') return 'bunny_hero';
  if (emoji === '🐺' || emoji === '🐶') return 'husky_hero';
  if (emoji === '🦁') return 'lion_hero';
  if (emoji === '🐼') return 'panda_hero';
  if (emoji === '🐯') return 'tiger_hero';
  if (emoji === '🐸') return 'frog_hero';
  if (emoji === '🦆' || emoji === '🐥') return 'duck_hero';
  if (emoji === '🐱') return 'cat';
  if (emoji === '🐻') return 'bear';
  return 'fox_hero';
}

/**
 * Timing Power Bar Zone Thresholds (0..100):
 * - 0..54  : Yellow (ยิงปกติ)
 * - 55..80 : Green  (Sweet Spot! ยิงคมและแรงพุ่งเสียบมุม)
 * - 81..100: Red    (ยิงแรงเกิน! มีโอกาสเหินข้ามคาน / ชนเสา)
 */
export const POWER_GREEN_MIN = 55;
export const POWER_GREEN_MAX = 80;

export function classifyPowerZone(powerValue: number): PowerBarZone {
  const clamped = Math.max(0, Math.min(100, powerValue));
  if (clamped > POWER_GREEN_MAX) return 'red';
  if (clamped >= POWER_GREEN_MIN) return 'green';
  return 'yellow';
}

/**
 * Smooth back-and-forth cursor (0..100..0) for Timing Power Bar.
 * @param elapsedSec Elapsed seconds since power bar started oscillating
 * @param cyclesPerSec Speed of oscillation (default ~1.05 back-and-forth cycles/sec)
 */
export function computePowerBarCursor(elapsedSec: number, cyclesPerSec = 1.08): number {
  const t = Math.max(0, elapsedSec) * cyclesPerSec * 2;
  const phase = t % 2;
  const raw = phase <= 1 ? phase : 2 - phase;
  return Math.round(raw * 1000) / 10;
}

export interface ShooterLockChoice {
  zone: PenaltyZone;
  /** 0..100 */
  power: number;
  powerZone: PowerBarZone;
}

export interface KeeperLockChoice {
  zone: PenaltyZone;
  timedOut?: boolean;
}

export interface ResolvedTurnResult {
  turnIndex: number;
  roundNumber: number;
  isSuddenDeath: boolean;
  shooterSide: PenaltySide;
  keeperSide: PenaltySide;
  shooterZone: PenaltyZone;
  keeperZone: PenaltyZone;
  power: number;
  powerZone: PowerBarZone;
  outcome: ShotOutcome;
  scored: boolean;
  /** Final 3D ball destination X at goal plane */
  ballEndX: number;
  /** Final 3D ball destination Y at goal plane */
  ballEndY: number;
  /** Horizontal curve amount (-1..1) for PES-style swerve */
  curveX: number;
  /** Ball flight duration in seconds */
  flightDurationSec: number;
}

/**
 * Deterministic shot outcome calculator run once by Host (or local Practice engine)
 * when BOTH Shooter and Goalkeeper have locked their selections.
 */
export function resolvePenaltyTurn(params: {
  turnIndex: number;
  shooterSide: PenaltySide;
  shooter: ShooterLockChoice;
  keeper: KeeperLockChoice;
  /** Deterministic random float in [0, 1) generated once by Host */
  roll: number;
}): ResolvedTurnResult {
  const { turnIndex, shooterSide, shooter, keeper } = params;
  const keeperSide: PenaltySide = shooterSide === 'p1' ? 'p2' : 'p1';
  const roundNumber = Math.floor(turnIndex / 2) + 1;
  const isSuddenDeath = roundNumber > REGULATION_KICKS;

  const power = Math.max(0, Math.min(100, shooter.power));
  const powerZone = classifyPowerZone(power);
  const meta = getGoalZoneMeta(shooter.zone);
  const sameZone = shooter.zone === keeper.zone;
  const roll = Math.max(0, Math.min(0.9999, params.roll));

  let outcome: ShotOutcome = 'goal';
  let ballEndX = meta.targetX;
  let ballEndY = meta.targetY;

  if (powerZone === 'red') {
    // Overpower zone (81..100): high chance of blazing over the crossbar or smashing the post!
    const overRatio = (power - POWER_GREEN_MAX) / (100 - POWER_GREEN_MAX); // 0.05..1.0
    const missChance = 0.56 + overRatio * 0.34; // 56% -> 90% miss risk!
    if (roll < missChance) {
      if (meta.row === 'top' || roll < missChance * 0.58) {
        outcome = 'over';
        ballEndX = meta.targetX * (0.95 + overRatio * 0.14);
        ballEndY = GOAL_HEIGHT + 0.55 + overRatio * 0.85;
      } else {
        outcome = 'post';
        const postSign = meta.col === 'left' ? -1 : meta.col === 'right' ? 1 : roll < 0.3 ? -1 : 1;
        ballEndX = postSign * (GOAL_WIDTH * 0.5);
        ballEndY = 1.25;
      }
    } else {
      outcome = sameZone ? 'saved' : 'goal';
    }
  } else if (powerZone === 'green') {
    // Sweet spot (55..80): clinical, high-velocity strike tucked right into the corner!
    const cornerBoost = meta.col === 'center' ? 0 : meta.col === 'left' ? -0.22 : 0.22;
    ballEndX = meta.targetX + cornerBoost;
    ballEndY = meta.row === 'top' ? meta.targetY + 0.16 : meta.targetY - 0.08;

    if (!sameZone) {
      outcome = 'goal';
    } else {
      // Even when GK guesses the right corner, a dead-center Green Perfect strike (63..74)
      // in a corner has a 35% chance to whip past the fingertips!
      const isDeadCenterGreen = power >= 63 && power <= 74 && meta.col !== 'center';
      outcome = isDeadCenterGreen && roll < 0.35 ? 'goal' : 'saved';
    }
  } else {
    // Yellow zone (0..54): standard accuracy & speed
    if (sameZone) {
      outcome = 'saved';
    } else if (
      power < 16 &&
      meta.row === 'bottom' &&
      keeper.zone === 'bottom_center' &&
      roll < 0.18
    ) {
      // Ultra-weak scuffed roller near center can be reached by a stay-at-home keeper
      outcome = 'saved';
    } else {
      outcome = 'goal';
    }
  }

  // Compute stylish PES ball curve & flight speed based on shot power
  const baseSpeedFactor =
    powerZone === 'red'
      ? 0.44
      : powerZone === 'green'
        ? 0.52
        : 0.68 - (power / Math.max(1, POWER_GREEN_MIN)) * 0.12;

  const curveSign = meta.col === 'left' ? 1 : meta.col === 'right' ? -1 : roll > 0.5 ? 0.5 : -0.5;
  const curveMagnitude =
    powerZone === 'green' ? 0.85 : powerZone === 'red' ? 0.45 : 0.55;

  return {
    turnIndex,
    roundNumber,
    isSuddenDeath,
    shooterSide,
    keeperSide,
    shooterZone: shooter.zone,
    keeperZone: keeper.zone,
    power,
    powerZone,
    outcome,
    scored: outcome === 'goal',
    ballEndX: Math.round(ballEndX * 100) / 100,
    ballEndY: Math.round(ballEndY * 100) / 100,
    curveX: Math.round(curveSign * curveMagnitude * 100) / 100,
    flightDurationSec: Math.round(baseSpeedFactor * 100) / 100,
  };
}

export type KickDotStatus = 'pending' | 'goal' | 'miss';

export interface ShootoutScoreSummary {
  p1Goals: number;
  p2Goals: number;
  p1Taken: number;
  p2Taken: number;
  /** Always at least 5 dots for regulation; appends extra pair dots during Sudden Death */
  p1Dots: KickDotStatus[];
  p2Dots: KickDotStatus[];
  isSuddenDeath: boolean;
  isFinished: boolean;
  winner: PenaltySide | null;
  nextShooter: PenaltySide;
  currentRound: number;
}

/**
 * Evaluates full 5-kick regulation + mathematical early clinch + Sudden Death rules!
 */
export function evaluateShootoutProgress(history: ResolvedTurnResult[]): ShootoutScoreSummary {
  let p1Goals = 0;
  let p2Goals = 0;
  let p1Taken = 0;
  let p2Taken = 0;
  const p1Raw: KickDotStatus[] = [];
  const p2Raw: KickDotStatus[] = [];

  let isFinished = false;
  let winner: PenaltySide | null = null;

  for (const turn of history) {
    if (turn.shooterSide === 'p1') {
      p1Taken += 1;
      if (turn.scored) p1Goals += 1;
      p1Raw.push(turn.scored ? 'goal' : 'miss');
    } else {
      p2Taken += 1;
      if (turn.scored) p2Goals += 1;
      p2Raw.push(turn.scored ? 'goal' : 'miss');
    }

    if (p1Taken <= REGULATION_KICKS && p2Taken <= REGULATION_KICKS) {
      const p1Rem = REGULATION_KICKS - p1Taken;
      const p2Rem = REGULATION_KICKS - p2Taken;
      if (p1Goals > p2Goals + p2Rem) {
        isFinished = true;
        winner = 'p1';
        break;
      }
      if (p2Goals > p1Goals + p1Rem) {
        isFinished = true;
        winner = 'p2';
        break;
      }
    } else if (p1Taken === p2Taken && p1Taken > REGULATION_KICKS) {
      // Sudden Death: evaluated after both sides have taken the same number of kicks
      if (p1Goals !== p2Goals) {
        isFinished = true;
        winner = p1Goals > p2Goals ? 'p1' : 'p2';
        break;
      }
    }
  }

  const isSuddenDeath =
    !isFinished && p1Taken >= REGULATION_KICKS && p2Taken >= REGULATION_KICKS && p1Goals === p2Goals
      ? true
      : Math.max(p1Taken, p2Taken) > REGULATION_KICKS;

  const totalSlots = Math.max(
    REGULATION_KICKS,
    p1Raw.length,
    p2Raw.length,
    isSuddenDeath && !isFinished ? Math.max(p1Raw.length, p2Raw.length) + (p1Raw.length === p2Raw.length ? 1 : 0) : REGULATION_KICKS
  );

  const p1Dots: KickDotStatus[] = Array.from({ length: totalSlots }, (_, idx) => p1Raw[idx] ?? 'pending');
  const p2Dots: KickDotStatus[] = Array.from({ length: totalSlots }, (_, idx) => p2Raw[idx] ?? 'pending');

  const nextTurnIdx = history.length;
  const nextShooter: PenaltySide = nextTurnIdx % 2 === 0 ? 'p1' : 'p2';
  const currentRound = Math.floor(nextTurnIdx / 2) + 1;

  return {
    p1Goals,
    p2Goals,
    p1Taken,
    p2Taken,
    p1Dots,
    p2Dots,
    isSuddenDeath,
    isFinished,
    winner,
    nextShooter,
    currentRound,
  };
}

export function chooseAiShooterAction(difficulty: PenaltyDifficulty): ShooterLockChoice {
  const cornerZones: PenaltyZone[] = ['top_left', 'top_right', 'bottom_left', 'bottom_right'];
  const allZones = GOAL_ZONES.map((z) => z.id);
  const pickPool = difficulty === 'hard' && Math.random() < 0.8 ? cornerZones : allZones;
  const zone = pickPool[Math.floor(Math.random() * pickPool.length)];

  let power: number;
  const r = Math.random();
  if (difficulty === 'easy') {
    // Easy AI sometimes overhits into Red or shoots soft Yellow
    power = r < 0.28 ? 84 + Math.random() * 14 : r < 0.65 ? 28 + Math.random() * 24 : 58 + Math.random() * 18;
  } else if (difficulty === 'hard') {
    // Hard AI hits Green sweet spot frequently, rarely overhits
    power = r < 0.72 ? 60 + Math.random() * 17 : r < 0.92 ? 42 + Math.random() * 12 : 83 + Math.random() * 10;
  } else {
    // Normal AI
    power = r < 0.52 ? 57 + Math.random() * 21 : r < 0.84 ? 34 + Math.random() * 20 : 82 + Math.random() * 14;
  }
  const roundedPower = Math.round(power * 10) / 10;
  return {
    zone,
    power: roundedPower,
    powerZone: classifyPowerZone(roundedPower),
  };
}

export function chooseAiKeeperZone(
  difficulty: PenaltyDifficulty,
  recentPlayerShots: PenaltyZone[] = []
): KeeperLockChoice {
  const allZones = GOAL_ZONES.map((z) => z.id);
  // Pro AI notices if the human keeps spamming the same zone!
  if (difficulty !== 'easy' && recentPlayerShots.length >= 2) {
    const last = recentPlayerShots[recentPlayerShots.length - 1];
    const prev = recentPlayerShots[recentPlayerShots.length - 2];
    if (last === prev && Math.random() < (difficulty === 'hard' ? 0.65 : 0.4)) {
      return { zone: last };
    }
  }
  const idx = Math.floor(Math.random() * allZones.length);
  return { zone: allZones[idx] };
}
