export const DAILY_CHECKIN_NORMAL_BONUS = 10;
export const DAILY_CHECKIN_CHAMPION_BONUS = 15;

export interface SeasonStepSnapshotInput {
  userId: number;
  currentStepCount: number;
  stepsAddedSinceCutoff: number;
}

export interface MorningChampionsResult {
  maxStepsAt7Am: number;
  championUserIds: number[];
}

export interface DailyCheckinRewardResult {
  earned: number;
  isMorningChampion: boolean;
  championStepsAt7Am: number;
  coChampionCount: number;
}

/**
 * Reconstructs each participant's exact cumulative season step count at the 07:00 Bangkok
 * (00:00 UTC) daily reset boundary by subtracting net steps logged at or after the cutoff,
 * and returns all co-champions tied for the highest step count (> 0).
 */
export function computeMorningChampionsAt7Am(
  entries: readonly SeasonStepSnapshotInput[]
): MorningChampionsResult {
  const computed: Array<{ userId: number; stepsAt7Am: number }> = [];
  let maxStepsAt7Am = 0;

  for (const raw of entries) {
    const uid = Number(raw.userId);
    if (!Number.isFinite(uid) || uid <= 0) continue;
    const cur = Number.isFinite(raw.currentStepCount) ? Math.round(raw.currentStepCount) : 0;
    const added = Number.isFinite(raw.stepsAddedSinceCutoff)
      ? Math.round(raw.stepsAddedSinceCutoff)
      : 0;
    const stepsAt7Am = Math.max(0, cur - added);
    computed.push({ userId: uid, stepsAt7Am });
    if (stepsAt7Am > maxStepsAt7Am) {
      maxStepsAt7Am = stepsAt7Am;
    }
  }

  if (maxStepsAt7Am <= 0) {
    return { maxStepsAt7Am: 0, championUserIds: [] };
  }

  const seen = new Set<number>();
  const championUserIds: number[] = [];
  for (const item of computed) {
    if (item.stepsAt7Am === maxStepsAt7Am && !seen.has(item.userId)) {
      seen.add(item.userId);
      championUserIds.push(item.userId);
    }
  }

  return { maxStepsAt7Am, championUserIds };
}

export function resolveDailyCheckinReward(
  userId: number,
  entries: readonly SeasonStepSnapshotInput[]
): DailyCheckinRewardResult {
  const { maxStepsAt7Am, championUserIds } = computeMorningChampionsAt7Am(entries);
  const isMorningChampion = championUserIds.includes(Number(userId));
  return {
    earned: isMorningChampion ? DAILY_CHECKIN_CHAMPION_BONUS : DAILY_CHECKIN_NORMAL_BONUS,
    isMorningChampion,
    championStepsAt7Am: isMorningChampion ? maxStepsAt7Am : 0,
    coChampionCount: isMorningChampion ? championUserIds.length : 0,
  };
}
