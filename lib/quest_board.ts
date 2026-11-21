export const QUEST_MIN_DURATION_DAYS = 1;
export const QUEST_BETTING_WINDOW_DAYS = 7;
export const QUEST_MIN_STAKE = 10;
export const QUEST_MAX_STAKE = 500;
export const QUEST_COOP_BONUS_STEP = 0.1; // +10% per additional party member

export type QuestStatus = 'open' | 'active' | 'voting' | 'completed' | 'failed';
export type QuestType = 'template' | 'custom';
export type BetSide = 'success' | 'fail';
export type VoteChoice = 'pass' | 'fail';
export type PartyInviteStatus = 'invited' | 'accepted' | 'declined';

export interface QuestTemplateDef {
  key: string;
  icon: string;
  label: string;
  defaultTitle: string;
  defaultUnit: string;
  defaultTarget: number;
  placeholderDesc: string;
}

export const QUEST_TEMPLATES: QuestTemplateDef[] = [
  {
    key: 'steps_month',
    icon: '👟',
    label: 'เดินสะสมรายเดือน',
    defaultTitle: 'พิชิต 250,000 ก้าวใน 30 วัน',
    defaultUnit: 'ก้าว',
    defaultTarget: 250000,
    placeholderDesc: 'สะสมจำนวนก้าวเดินให้ครบตามเป้าภายในระยะเวลาที่กำหนด พร้อมแนบภาพสรุปจากแอปสุขภาพตอนจบเควส',
  },
  {
    key: 'workout_streak',
    icon: '🏋️',
    label: 'ออกกำลังกายต่อเนื่อง',
    defaultTitle: 'ออกกำลังกายอย่างน้อย 20 วันใน 1 เดือน',
    defaultUnit: 'วัน',
    defaultTarget: 20,
    placeholderDesc: 'ออกกำลังกายอย่างน้อยวันละ 30 นาที ให้ครบจำนวนวันที่กำหนดในรอบ 30 วัน',
  },
  {
    key: 'weight_cut',
    icon: '⚖️',
    label: 'ลดน้ำหนักท้าดวล',
    defaultTitle: 'ลดน้ำหนักให้ได้ 3 กก. ใน 30 วัน',
    defaultUnit: 'กก.',
    defaultTarget: 3,
    placeholderDesc: 'ชั่งน้ำหนักวันเริ่มต้นและวันจบเควสให้เห็นความเปลี่ยนแปลงตามเป้าหมาย',
  },
  {
    key: 'waist_cut',
    icon: '📏',
    label: 'ลดรอบเอวพิชิตพุง',
    defaultTitle: 'ลดรอบเอว 2 นิ้วภายใน 1 เดือน',
    defaultUnit: 'นิ้ว',
    defaultTarget: 2,
    placeholderDesc: 'วัดรอบเอววันเริ่มและวันจบเควสเทียบกัน ต้องลดลงตามเป้าที่ตกลงไว้',
  },
  {
    key: 'healthy_habit',
    icon: '🥗',
    label: 'ภารกิจนิสัยสุขภาพดี',
    defaultTitle: 'งดชานมไข่มุก & น้ำหวานครบ 30 วัน',
    defaultUnit: 'วัน',
    defaultTarget: 30,
    placeholderDesc: 'ทำภารกิจดูแลสุขภาพต่อเนื่องทุกวันจนครบกำหนด พร้อมสรุปผลให้เพื่อนในสนามตรวจ',
  },
];

export interface QuestUserBrief {
  id: number;
  name: string;
  emoji: string;
  colorHex: string;
}

export interface QuestSponsorView {
  id: number;
  userId: number;
  userName: string;
  userEmoji: string;
  amount: number;
  payoutAmount: number | null;
}

export interface QuestPartyMemberView {
  id: number;
  userId: number;
  userName: string;
  userEmoji: string;
  userColorHex: string;
  role: 'leader' | 'member';
  inviteStatus: PartyInviteStatus;
  proofText: string;
  memberCompleted: boolean;
  payoutAmount: number | null;
}

export interface QuestBetView {
  id: number;
  userId: number;
  userName: string;
  userEmoji: string;
  side: BetSide;
  amount: number;
  payoutAmount: number | null;
}

export interface QuestVoteView {
  id: number;
  voterId: number;
  voterName: string;
  voterEmoji: string;
  vote: VoteChoice;
  comment: string;
}

export interface QuestBoardItem {
  id: number;
  creatorId: number;
  creatorName: string;
  creatorEmoji: string;
  creatorColorHex: string;
  title: string;
  description: string;
  questType: QuestType;
  templateKey: string;
  targetValue: number;
  targetUnit: string;
  aiSummary: string;
  durationDays: number;
  status: QuestStatus;
  acceptorId: number | null;
  startDate: string;
  endDate: string;
  acceptedAt: string | null;
  bettingEndsAt: string | null;
  submittedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: number | null;
  resolutionNote: string;
  createdAt: string;
  sponsors: QuestSponsorView[];
  totalSponsorPool: number;
  party: QuestPartyMemberView[];
  activePartyCount: number;
  coopMultiplier: number;
  coopBonusPct: number;
  perMemberReward: number;
  bets: QuestBetView[];
  successBetPool: number;
  failBetPool: number;
  totalBetPool: number;
  votes: QuestVoteView[];
  passVoteCount: number;
  failVoteCount: number;
  isBettingOpen: boolean;
  bettingMsRemaining: number;
}

/**
 * Parses a YYYY-MM-DD date string strictly into UTC midnight timestamp (ms).
 * Returns null if invalid format or calendar date.
 */
export function parseIsoDateOnlyUtc(dateStr: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateStr || '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

/**
 * Computes day difference between startDate and endDate (YYYY-MM-DD).
 * Returns null if either date is invalid.
 */
export function computeDateRangeDays(startDate: string, endDate: string): number | null {
  const startMs = parseIsoDateOnlyUtc(startDate);
  const endMs = parseIsoDateOnlyUtc(endDate);
  if (startMs === null || endMs === null) return null;
  return Math.round((endMs - startMs) / 86_400_000);
}

/**
 * Validates that a quest's startDate -> endDate spans at least QUEST_MIN_DURATION_DAYS (30 days).
 */
export function validateQuestDateRange(
  startDate: string,
  endDate: string,
  minDays: number = QUEST_MIN_DURATION_DAYS
): { ok: true; days: number } | { ok: false; error: string } {
  const days = computeDateRangeDays(startDate, endDate);
  if (days === null) {
    return { ok: false, error: 'รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)' };
  }
  const required = Math.max(1, Math.floor(minDays));
  if (days < required) {
    return {
      ok: false,
      error:
        required <= 1
          ? 'วันสิ้นสุดต้องอยู่หลังวันเริ่มต้นอย่างน้อย 1 วัน'
          : `ระยะเวลาเควสต้องอย่างน้อย ${required} วัน (ปัจจุบันเลือกไว้ ${days} วัน)`,
    };
  }
  return { ok: true, days };
}

/**
 * Co-op reward multiplier:
 * 1 player  -> 1.00 (100%)
 * 2 players -> 1.10 (110%) each
 * 3 players -> 1.20 (120%) each
 * N players -> 1 + 0.10 * (N - 1) each
 */
export function computeCoopMultiplier(activePartyCount: number): number {
  const count = Math.max(1, Math.floor(activePartyCount));
  return Number((1 + QUEST_COOP_BONUS_STEP * (count - 1)).toFixed(4));
}

export function computePerMemberQuestReward(
  totalSponsorPool: number,
  activePartyCount: number
): number {
  if (totalSponsorPool <= 0) return 0;
  const mult = computeCoopMultiplier(activePartyCount);
  return Math.round(totalSponsorPool * mult);
}

/**
 * Sponsor payout:
 * - On quest success: 200% (2x) of contributed Gacha coins
 * - On quest failure: 0 (sponsors lose their stake)
 */
export function computeSponsorPayout(amount: number, succeeded: boolean): number {
  if (!succeeded || amount <= 0) return 0;
  return Math.round(amount * 2);
}

export interface BetInput {
  userId: number;
  side: BetSide;
  amount: number;
}

export interface BetPayoutResult {
  userId: number;
  side: BetSide;
  stake: number;
  proRataShare: number;
  payout: number;
  usedMinGuarantee: boolean;
}

/**
 * Betting payout calculation:
 * - Winning side gets: own stake + pro-rata share of losing pool
 * - Guaranteed minimum for winners: 2x their own stake
 * - Losing side gets: 0
 */
export function computeBetPayouts(
  bets: BetInput[],
  winningSide: BetSide
): BetPayoutResult[] {
  const totalWinningPool = bets
    .filter((b) => b.side === winningSide && b.amount > 0)
    .reduce((sum, b) => sum + b.amount, 0);
  const totalLosingPool = bets
    .filter((b) => b.side !== winningSide && b.amount > 0)
    .reduce((sum, b) => sum + b.amount, 0);

  return bets.map((b) => {
    const stake = Math.max(0, Math.floor(b.amount));
    if (b.side !== winningSide || stake <= 0) {
      return {
        userId: b.userId,
        side: b.side,
        stake,
        proRataShare: 0,
        payout: 0,
        usedMinGuarantee: false,
      };
    }

    const proRataShare =
      totalWinningPool > 0
        ? Math.floor((stake / totalWinningPool) * totalLosingPool)
        : 0;
    const naturalPayout = stake + proRataShare;
    const minGuarantee = stake * 2;
    const payout = Math.max(naturalPayout, minGuarantee);

    return {
      userId: b.userId,
      side: b.side,
      stake,
      proRataShare,
      payout,
      usedMinGuarantee: naturalPayout < minGuarantee,
    };
  });
}

/**
 * Checks whether a quest's 7-day betting window is currently open.
 */
export function computeBettingWindowState(
  status: QuestStatus,
  bettingEndsAt: string | null,
  nowMs: number = Date.now()
): { isBettingOpen: boolean; bettingMsRemaining: number } {
  if (status !== 'active' || !bettingEndsAt) {
    return { isBettingOpen: false, bettingMsRemaining: 0 };
  }
  const endMs = Date.parse(bettingEndsAt);
  if (!Number.isFinite(endMs) || endMs <= nowMs) {
    return { isBettingOpen: false, bettingMsRemaining: 0 };
  }
  return {
    isBettingOpen: true,
    bettingMsRemaining: endMs - nowMs,
  };
}

/**
 * Validates stake amount against min/max per user per quest.
 */
export function validateStakeIncrement(
  existingTotal: number,
  addAmount: number
): { ok: true; nextTotal: number } | { ok: false; error: string } {
  const add = Math.floor(addAmount);
  if (!Number.isFinite(add) || add <= 0) {
    return { ok: false, error: 'กรุณาระบุจำนวนเหรียญ Gacha ที่มากกว่า 0' };
  }
  const nextTotal = Math.max(0, Math.floor(existingTotal)) + add;
  if (existingTotal === 0 && add < QUEST_MIN_STAKE) {
    return {
      ok: false,
      error: `ลงขั้นต่ำ ${QUEST_MIN_STAKE} 💰 ต่อเควส`,
    };
  }
  if (nextTotal > QUEST_MAX_STAKE) {
    const remaining = Math.max(0, QUEST_MAX_STAKE - existingTotal);
    return {
      ok: false,
      error: `จำกัดสูงสุด ${QUEST_MAX_STAKE} 💰 ต่อคน/เควส (ลงเพิ่มได้อีก ${remaining} 💰)`,
    };
  }
  return { ok: true, nextTotal };
}

/**
 * Builds a deterministic fallback rule summary when Gemini API is unavailable.
 */
export function buildFallbackQuestSummary(
  title: string,
  description: string,
  _durationDays?: number
): { summary: string; verificationTip: string } {
  const cleanTitle = title.trim();
  const cleanDesc = description.trim();
  const snippet = cleanDesc.length > 140 ? `${cleanDesc.slice(0, 137)}...` : cleanDesc;
  return {
    summary: `เป้าหมาย: ${cleanTitle} — ${snippet || 'ทำให้สำเร็จตามเงื่อนไขที่ตกลงไว้ครบทุกคนในปาร์ตี้'}`,
    verificationTip: 'เมื่อครบกำหนด ให้ผู้ทำเควสทุกคนแนบสรุปผล/หลักฐาน เพื่อส่งให้เพื่อนในสนามโหวตหรือผู้สร้างเควสยืนยันผล',
  };
}

export function formatBangkokDatePlusDays(daysOffset: number = 0): string {
  const now = new Date(Date.now() + 7 * 3600_000 + daysOffset * 86_400_000);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatCountdownTh(ms: number): string {
  if (ms <= 0) return 'ปิดรับเดิมพันแล้ว';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days} วัน ${hours} ชม.`;
  if (hours > 0) return `${hours} ชม. ${mins} นาที`;
  return `${Math.max(1, mins)} นาที`;
}
