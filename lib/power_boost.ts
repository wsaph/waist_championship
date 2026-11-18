export type PowerFormType =
  | 'majin_buu'
  | 'kabigon'
  | 'stuffed'
  | 'neutral'
  | 'warm_up'
  | 'fire_boost'
  | 'super_saiyan';

export const POWER_GAUGE_MAX = 6;

export interface PowerBoostMeta {
  cheerCount: number;
  temptCount: number;
  netPower: number;
  clampedGauge: number;
  /** Normalized from -1 (Majin Buu) to +1 (Super Saiyan), 0 = center */
  gaugeRatio: number;
  form: PowerFormType;
  icon: string;
  title: string;
  shortLabel: string;
  badgeBgClass: string;
  nextHint: string;
  widthScale: number;
  heightScale: number;
  extraBellyAdd: number;
  extraMuscleAdd: number;
  animSpeedMult: number;
}

export function resolvePowerBoostMeta(cheerCount = 0, temptCount = 0): PowerBoostMeta {
  const c = Math.max(0, Math.floor(cheerCount));
  const t = Math.max(0, Math.floor(temptCount));
  const netPower = c - t;
  const clampedGauge = Math.max(-POWER_GAUGE_MAX, Math.min(POWER_GAUGE_MAX, netPower));
  const gaugeRatio = clampedGauge / POWER_GAUGE_MAX;

  if (netPower >= 6) {
    return {
      cheerCount: c,
      temptCount: t,
      netPower,
      clampedGauge,
      gaugeRatio,
      form: 'super_saiyan',
      icon: '⚡',
      title: '⚡ ร่าง SUPER SAIYAN!!',
      shortLabel: `⚡ไซย่า +${netPower}`,
      badgeBgClass: 'bg-amber-400 text-black border-white',
      nextHint: 'พลังไฟทะลุขีดจำกัดเป็น Super Saiyan แล้ว! (มารผจญต้องส่งของกิน 😈 เพื่อลดไฟ)',
      widthScale: 1.08,
      heightScale: 1.1,
      extraBellyAdd: -0.08,
      extraMuscleAdd: 0.25,
      animSpeedMult: 1.85,
    };
  }

  if (netPower >= 3) {
    const need = 6 - netPower;
    return {
      cheerCount: c,
      temptCount: t,
      netPower,
      clampedGauge,
      gaugeRatio,
      form: 'fire_boost',
      icon: '🔥',
      title: '🔥 โหมดไฟบูสต์ลุกโชน!',
      shortLabel: `🔥ไฟบูสต์ +${netPower}`,
      badgeBgClass: 'bg-orange-500 text-white border-amber-200',
      nextHint: `เติมไฟอีก +${need} ครั้ง จะระเบิดพลังเป็นร่าง Super Saiyan ⚡!`,
      widthScale: 1.03,
      heightScale: 1.04,
      extraBellyAdd: -0.04,
      extraMuscleAdd: 0.12,
      animSpeedMult: 1.45,
    };
  }

  if (netPower >= 1) {
    const need = 3 - netPower;
    return {
      cheerCount: c,
      temptCount: t,
      netPower,
      clampedGauge,
      gaugeRatio,
      form: 'warm_up',
      icon: '🔥',
      title: '🔥 เครื่องเริ่มร้อน!',
      shortLabel: `🔥+${netPower}`,
      badgeBgClass: 'bg-amber-500/90 text-black border-amber-200',
      nextHint: `เติมไฟอีก +${need} ครั้ง เพื่อติดเอฟเฟกต์ไฟบูสต์ 🔥!`,
      widthScale: 1.0,
      heightScale: 1.0,
      extraBellyAdd: 0,
      extraMuscleAdd: 0.04,
      animSpeedMult: 1.16,
    };
  }

  if (netPower <= -6) {
    return {
      cheerCount: c,
      temptCount: t,
      netPower,
      clampedGauge,
      gaugeRatio,
      form: 'majin_buu',
      icon: '🩷',
      title: '🩷 ร่างจอมมารบูตัวเบิ้ม!!',
      shortLabel: `🩷จอมมารบู ${netPower}`,
      badgeBgClass: 'bg-pink-500 text-white border-fuchsia-200',
      nextHint: 'โดนขุนจนกลายร่างเป็นจอมมารบูแล้ว! (เพื่อนต้องช่วยกดเติมไฟ 🔥 เพื่อเบิร์นพุง)',
      widthScale: 1.68,
      heightScale: 1.52,
      extraBellyAdd: 0.45,
      extraMuscleAdd: 0,
      animSpeedMult: 0.62,
    };
  }

  if (netPower <= -3) {
    const need = Math.abs(-6 - netPower);
    return {
      cheerCount: c,
      temptCount: t,
      netPower,
      clampedGauge,
      gaugeRatio,
      form: 'kabigon',
      icon: '💤',
      title: '💤 ร่างคาบิก้อนจอมเขมือบ!',
      shortLabel: `💤คาบิก้อน ${netPower}`,
      badgeBgClass: 'bg-cyan-700 text-amber-100 border-amber-300',
      nextHint: `โดนส่งของกินอีก -${need} ครั้ง จะอ้วนทะลุพิกัดเป็นจอมมารบู 🩷!`,
      widthScale: 1.46,
      heightScale: 1.35,
      extraBellyAdd: 0.35,
      extraMuscleAdd: 0,
      animSpeedMult: 0.54,
    };
  }

  if (netPower <= -1) {
    const need = Math.abs(-3 - netPower);
    return {
      cheerCount: c,
      temptCount: t,
      netPower,
      clampedGauge,
      gaugeRatio,
      form: 'stuffed',
      icon: '🍔',
      title: '🍔 เริ่มอิ่มจุกพุงป่อง!',
      shortLabel: `🍔${netPower}`,
      badgeBgClass: 'bg-rose-500 text-white border-rose-200',
      nextHint: `ส่งของกินอีก -${need} ครั้ง จะตัวขยายเป็นคาบิก้อน 💤!`,
      widthScale: 1.14,
      heightScale: 1.07,
      extraBellyAdd: 0.16,
      extraMuscleAdd: 0,
      animSpeedMult: 0.84,
    };
  }

  return {
    cheerCount: c,
    temptCount: t,
    netPower: 0,
    clampedGauge: 0,
    gaugeRatio: 0,
    form: 'neutral',
    icon: '⚖️',
    title: '⚖️ สมดุลปกติ',
    shortLabel: '⚖️ 0',
    badgeBgClass: 'bg-slate-700 text-amber-100 border-slate-500',
    nextHint: 'เติมไฟ +3 ติดไฟบูสต์ (+6 Super Saiyan) • ส่งของกิน -3 ร่างคาบิก้อน (-6 จอมมารบู)',
    widthScale: 1.0,
    heightScale: 1.0,
    extraBellyAdd: 0,
    extraMuscleAdd: 0,
    animSpeedMult: 1.0,
  };
}
