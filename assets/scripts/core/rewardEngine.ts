import {
  GameContent,
  LegacyCondition,
  LegacyConfig,
  LifeRun,
  LifeSettlement,
  ReincarnatorProfile,
  SAVE_VERSION,
} from './model';
import { calculateLifeScore } from './lifeEngine';
import { getLegacySlotCount, getLevelForExp, getRewardTextsBetween } from './progression';
import { normalizeSeed, pickWeighted } from './random';

export interface SettlementPreparationResult {
  profile: ReincarnatorProfile;
  run: LifeRun;
  settlement: LifeSettlement;
  newlyGranted: boolean;
}

export interface RewardClaimResult {
  profile: ReincarnatorProfile;
  run: LifeRun;
  selectedRewardId: string;
  newlyClaimed: boolean;
}

export function prepareSettlement(
  profile: ReincarnatorProfile,
  run: LifeRun,
  content: GameContent,
): SettlementPreparationResult {
  if (run.status === 'active') {
    throw new Error('An active life cannot be settled.');
  }
  if (run.settlement) {
    return {
      profile,
      run,
      settlement: run.settlement,
      newlyGranted: false,
    };
  }
  if (profile.settledRunIds.includes(run.id)) {
    throw new Error(`Run ${run.id} has already granted reincarnation experience.`);
  }
  if (!run.endingId) {
    throw new Error('An ended life must have an ending before settlement.');
  }

  const score = calculateLifeScore(run);
  const baseExp = 10;
  const performanceExp = Math.floor(score / 10);
  const isFirstDiscovery = !profile.discoveredEndingIds.includes(run.endingId);
  const firstDiscoveryExp = isFirstDiscovery ? 20 : 0;
  const earnedExp = baseExp + performanceExp + firstDiscoveryExp;
  const previousLevel = profile.level;
  const totalExp = profile.totalExp + earnedExp;
  const newLevel = getLevelForExp(totalExp, content);
  const profileAfterExperience: ReincarnatorProfile = {
    ...profile,
    version: SAVE_VERSION,
    totalExp,
    level: newLevel,
    discoveredEndingIds: isFirstDiscovery
      ? [...profile.discoveredEndingIds, run.endingId]
      : [...profile.discoveredEndingIds],
    settledRunIds: [...profile.settledRunIds, run.id].slice(-100),
  };
  const rewardOfferIds = draftRewardOffers(profileAfterExperience, run, content);
  const settlement: LifeSettlement = {
    score,
    earnedExp,
    baseExp,
    performanceExp,
    firstDiscoveryExp,
    previousLevel,
    newLevel,
    newRewardTexts: getRewardTextsBetween(previousLevel, newLevel, content),
    rewardOfferIds,
  };
  const pendingRun: LifeRun = {
    ...run,
    status: 'reward-pending',
    settlement,
  };

  return {
    profile: profileAfterExperience,
    run: pendingRun,
    settlement,
    newlyGranted: true,
  };
}

export function claimLegacyReward(
  profile: ReincarnatorProfile,
  run: LifeRun,
  rewardId: string,
  content: GameContent,
): RewardClaimResult {
  const settlement = run.settlement;
  if (!settlement) {
    throw new Error('This life does not have a prepared settlement.');
  }
  if (settlement.selectedRewardId) {
    if (settlement.selectedRewardId !== rewardId) {
      throw new Error('A different reincarnation reward was already selected.');
    }
    return {
      profile,
      run,
      selectedRewardId: rewardId,
      newlyClaimed: false,
    };
  }
  if (run.status !== 'reward-pending') {
    throw new Error('This life is not waiting for a reincarnation reward.');
  }
  if (profile.rewardedRunIds.includes(run.id)) {
    throw new Error(`Run ${run.id} has already granted a reincarnation reward.`);
  }
  if (!settlement.rewardOfferIds.includes(rewardId)) {
    throw new Error('The selected reward was not offered for this life.');
  }

  const reward = content.legacies.find((legacy) => legacy.id === rewardId);
  if (!reward) {
    throw new Error(`Unknown reincarnation reward: ${rewardId}`);
  }

  let nextProfile: ReincarnatorProfile = {
    ...profile,
    rewardedRunIds: [...profile.rewardedRunIds, run.id].slice(-100),
  };

  if (reward.persistence === 'next-life') {
    nextProfile = {
      ...nextProfile,
      pendingBoonIds: [...nextProfile.pendingBoonIds, reward.id],
    };
  } else {
    const currentRank = nextProfile.legacyRanks[reward.id] ?? 0;
    const nextRank = Math.min(reward.maxRank, currentRank + 1);
    let equippedLegacyIds = [...nextProfile.equippedLegacyIds];
    if (currentRank === 0 && equippedLegacyIds.length < getLegacySlotCount(nextProfile, content)) {
      equippedLegacyIds.push(reward.id);
    }
    nextProfile = {
      ...nextProfile,
      legacyRanks: {
        ...nextProfile.legacyRanks,
        [reward.id]: nextRank,
      },
      equippedLegacyIds,
    };
  }

  const settledRun: LifeRun = {
    ...run,
    status: 'settled',
    settlement: {
      ...settlement,
      selectedRewardId: reward.id,
    },
  };
  return {
    profile: nextProfile,
    run: settledRun,
    selectedRewardId: reward.id,
    newlyClaimed: true,
  };
}

export function draftRewardOffers(
  profile: ReincarnatorProfile,
  run: LifeRun,
  content: GameContent,
): string[] {
  const eligible = content.legacies.filter((legacy) => isLegacyClaimable(legacy, profile));
  if (eligible.length < 3) {
    throw new Error('At least three reincarnation rewards must be claimable.');
  }

  let state = normalizeSeed(run.rngState ^ hashString(run.id) ^ Math.imul(run.age + 1, 2654435761));
  const selected: LegacyConfig[] = [];
  const contextual = eligible.filter((legacy) => legacy.condition && matchesLegacyCondition(legacy.condition, run));

  if (contextual.length > 0) {
    const pick = pickWeighted(contextual, state, () => 1);
    selected.push(pick.item);
    state = pick.state;
  }

  while (selected.length < 3) {
    const remaining = eligible.filter((legacy) => !selected.some((item) => item.id === legacy.id));
    const unusedCategory = remaining.filter((legacy) => !selected.some((item) => item.category === legacy.category));
    const pool = unusedCategory.length > 0 ? unusedCategory : remaining;
    const pick = pickWeighted(pool, state, (legacy) => {
      const contextualWeight = legacy.condition && matchesLegacyCondition(legacy.condition, run) ? 3 : 1;
      const boonWeight = selected.some((item) => item.category === 'boon') && legacy.category === 'boon' ? 0.5 : 1;
      return contextualWeight * boonWeight;
    });
    selected.push(pick.item);
    state = pick.state;
  }

  return selected.map((legacy) => legacy.id);
}

function isLegacyClaimable(legacy: LegacyConfig, profile: ReincarnatorProfile): boolean {
  if (legacy.unlockLevel > profile.level) {
    return false;
  }
  if (legacy.persistence === 'next-life') {
    return !profile.pendingBoonIds.includes(legacy.id);
  }
  return (profile.legacyRanks[legacy.id] ?? 0) < legacy.maxRank;
}

function matchesLegacyCondition(condition: LegacyCondition, run: LifeRun): boolean {
  if (condition.minAge !== undefined && run.age < condition.minAge) {
    return false;
  }
  if (condition.maxAge !== undefined && run.age > condition.maxAge) {
    return false;
  }
  if (condition.endingIds && (!run.endingId || !condition.endingIds.includes(run.endingId))) {
    return false;
  }
  if (condition.requiredTags?.some((tag) => !run.tags.includes(tag))) {
    return false;
  }
  if (condition.anyTags && !condition.anyTags.some((tag) => run.tags.includes(tag))) {
    return false;
  }
  return true;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
