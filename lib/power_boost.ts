export type PowerFormType =
  | 'kabigon'
  | 'food_coma'
  | 'stuffed'
  | 'neutral'
  | 'warm_up'
  | 'fire_boost'
  | 'super_saiyan'
  | 'majin_buu';

export const POWER_GAUGE_MAX = 10;

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

  const absStep = Math.min(POWER_GAUGE_MAX, Math.abs(netPower));

  if (netPower >= 10) {
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
      nextHint: 'พลังไฟทะลุขีดจำกัดเป็น Super Saiyan เต็มขั้นแล้ว! (มารผจญต้องส่งของกิน 😈 เพื่อลดไฟ)',
      widthScale: 1.12,
      heightScale: 1.14,
      extraBellyAdd: -0.12,
      extraMuscleAdd: 0.3,
      animSpeedMult: 1.9,
    };
  }

  if (netPower >= 5) {
    const need = 10 - netPower;
    return {
      cheerCount: c,
      temptCount: t,
      netPower,
      clampedGauge,
      gaugeRatio,
      form: 'fire_boost',
      icon: '🔥',
      title: `🔥 โหมดไฟบูสต์ Lv.${netPower}!`,
      shortLabel: `🔥บูสต์ +${netPower}`,
      badgeBgClass: 'bg-orange-500 text-white border-amber-200',
      nextHint: `เติมไฟอีก +${need} ครั้ง จะระเบิดพลังเป็นร่าง Super Saiyan ⚡!`,
      widthScale: Number((1.0 + absStep * 0.011).toFixed(3)),
      heightScale: Number((1.0 + absStep * 0.013).toFixed(3)),
      extraBellyAdd: Number((-absStep * 0.011).toFixed(3)),
      extraMuscleAdd: Number((absStep * 0.028).toFixed(3)),
      animSpeedMult: Number((1.0 + absStep * 0.085).toFixed(2)),
    };
  }

  if (netPower >= 1) {
    const need = 5 - netPower;
    return {
      cheerCount: c,
      temptCount: t,
      netPower,
      clampedGauge,
      gaugeRatio,
      form: 'warm_up',
      icon: '🔥',
      title: `🔥 เครื่องร้อน Lv.${netPower}!`,
      shortLabel: `🔥+${netPower}`,
      badgeBgClass: 'bg-amber-500/90 text-black border-amber-200',
      nextHint: `เติมไฟอีก +${need} ครั้ง เพื่อติดเอฟเฟกต์ไฟบูสต์ 🔥!`,
      widthScale: Number((1.0 + absStep * 0.01).toFixed(3)),
      heightScale: Number((1.0 + absStep * 0.012).toFixed(3)),
      extraBellyAdd: Number((-absStep * 0.009).toFixed(3)),
      extraMuscleAdd: Number((absStep * 0.022).toFixed(3)),
      animSpeedMult: Number((1.0 + absStep * 0.075).toFixed(2)),
    };
  }

  if (netPower <= -10) {
    return {
      cheerCount: c,
      temptCount: t,
      netPower,
      clampedGauge,
      gaugeRatio,
      form: 'kabigon',
      icon: '💤',
      title: '💤 ร่างคาบิก้อนยักษ์หลับปุ๋ย!!',
      shortLabel: `💤คาบิก้อน ${netPower}`,
      badgeBgClass: 'bg-cyan-700 text-amber-100 border-amber-300',
      nextHint: 'โดนขุนจนกลายร่างเป็นคาบิก้อนยักษ์หลับปุ๋ยแล้ว! (เพื่อนต้องช่วยกดเติมไฟ 🔥 เพื่อปลุกเบิร์นพุง)',
      widthScale: 1.68,
      heightScale: 1.48,
      extraBellyAdd: 0.48,
      extraMuscleAdd: 0,
      animSpeedMult: 0.52,
    };
  }

  if (netPower <= -5) {
    const need = Math.abs(-10 - netPower);
    return {
      cheerCount: c,
      temptCount: t,
      netPower,
      clampedGauge,
      gaugeRatio,
      form: 'food_coma',
      icon: '😴',
      title: `😴 จุกแน่น Lv.${absStep}!`,
      shortLabel: `😴จุกแน่น ${netPower}`,
      badgeBgClass: 'bg-sky-700 text-amber-100 border-sky-300',
      nextHint: `โดนส่งของกินอีก -${need} ครั้ง จะขยายยักษ์เป็นร่างคาบิก้อน 💤!`,
      widthScale: Number((1.0 + absStep * 0.064).toFixed(3)),
      heightScale: Number((1.0 + absStep * 0.044).toFixed(3)),
      extraBellyAdd: Number((absStep * 0.046).toFixed(3)),
      extraMuscleAdd: 0,
      animSpeedMult: Number(Math.max(0.56, 1.0 - absStep * 0.045).toFixed(2)),
    };
  }

  if (netPower <= -1) {
    const need = Math.abs(-5 - netPower);
    return {
      cheerCount: c,
      temptCount: t,
      netPower,
      clampedGauge,
      gaugeRatio,
      form: 'stuffed',
      icon: '🍔',
      title: `🍔 เริ่มอิ่มพุงป่อง Lv.${absStep}!`,
      shortLabel: `🍔${netPower}`,
      badgeBgClass: 'bg-rose-500 text-white border-rose-200',
      nextHint: `ส่งของกินอีก -${need} ครั้ง จะเข้าโหมดจุกแน่น 😴 (ครบ -10 แปลงร่างคาบิก้อน 💤)!`,
      widthScale: Number((1.0 + absStep * 0.055).toFixed(3)),
      heightScale: Number((1.0 + absStep * 0.036).toFixed(3)),
      extraBellyAdd: Number((absStep * 0.042).toFixed(3)),
      extraMuscleAdd: 0,
      animSpeedMult: Number(Math.max(0.75, 1.0 - absStep * 0.042).toFixed(2)),
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
    nextHint: 'เติมไฟ +5 ติดไฟบูสต์ (+10 Super Saiyan ⚡) • ส่งของกิน -5 จุกแน่น (-10 คาบิก้อน 💤)',
    widthScale: 1.0,
    heightScale: 1.0,
    extraBellyAdd: 0,
    extraMuscleAdd: 0,
    animSpeedMult: 1.0,
  };
}
