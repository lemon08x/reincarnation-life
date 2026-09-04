import {
  emptyRunCapabilities,
  GameContent,
  LegacyEffect,
  LevelProgress,
  PermanentBenefits,
  ReincarnatorProfile,
  RunCapabilities,
  SAVE_VERSION,
} from './model';

export const BASE_LEGACY_SLOTS = 2;

export function getLevelForExp(totalExp: number, content: GameContent): number {
  const ordered = [...content.levels].sort((left, right) => left.requiredExp - right.requiredExp);
  let level = ordered[0]?.level ?? 1;

  for (const milestone of ordered) {
    if (totalExp < milestone.requiredExp) {
      break;
    }
    level = milestone.level;
  }

  return level;
}

export function createInitialProfile(content: GameContent): ReincarnatorProfile {
  return {
    version: SAVE_VERSION,
    totalExp: 0,
    level: getLevelForExp(0, content),
    discoveredEndingIds: [],
    settledRunIds: [],
    rewardedRunIds: [],
    legacyRanks: {},
    equippedLegacyIds: [],
    pendingBoonIds: [],
  };
}

export function normalizeProfile(
  profile: ReincarnatorProfile,
  content: GameContent,
): ReincarnatorProfile {
  const candidate = profile as ReincarnatorProfile & {
    rewardedRunIds?: unknown;
    legacyRanks?: unknown;
    equippedLegacyIds?: unknown;
    pendingBoonIds?: unknown;
  };
  const totalExp = Math.max(0, Math.floor(Number(candidate.totalExp) || 0));
  const level = getLevelForExp(totalExp, content);
  const legacyRanks = normalizeLegacyRanks(candidate.legacyRanks, content);
  const provisional: ReincarnatorProfile = {
    version: SAVE_VERSION,
    totalExp,
    level,
    discoveredEndingIds: uniqueStrings(candidate.discoveredEndingIds),
    settledRunIds: uniqueStrings(candidate.settledRunIds).slice(-100),
    rewardedRunIds: uniqueStrings(candidate.rewardedRunIds).slice(-100),
    legacyRanks,
    equippedLegacyIds: [],
    pendingBoonIds: uniqueStrings(candidate.pendingBoonIds).filter((legacyId) => {
      const legacy = content.legacies.find((item) => item.id === legacyId);
      return legacy?.persistence === 'next-life';
    }),
  };
  provisional.equippedLegacyIds = uniqueStrings(candidate.equippedLegacyIds)
    .filter((legacyId) => legacyRanks[legacyId] > 0)
    .filter((legacyId) => content.legacies.some((legacy) => (
      legacy.id === legacyId && legacy.persistence === 'permanent'
    )))
    .slice(0, getLegacySlotCount(provisional, content));
  return provisional;
}

export function getPermanentBenefits(
  profile: ReincarnatorProfile,
  content: GameContent,
): PermanentBenefits {
  const benefits: PermanentBenefits = {
    attributePointBonus: 0,
    talentCandidateBonus: 0,
    legacySlotBonus: 0,
  };

  for (const milestone of content.levels) {
    if (milestone.level > profile.level || !milestone.benefits) {
      continue;
    }
    benefits.attributePointBonus += milestone.benefits.attributePointBonus ?? 0;
    benefits.talentCandidateBonus += milestone.benefits.talentCandidateBonus ?? 0;
    benefits.legacySlotBonus += milestone.benefits.legacySlotBonus ?? 0;
  }

  return benefits;
}

export function getLegacySlotCount(
  profile: ReincarnatorProfile,
  content: GameContent,
): number {
  return BASE_LEGACY_SLOTS + getPermanentBenefits(profile, content).legacySlotBonus;
}

export function getRunCapabilities(
  profile: ReincarnatorProfile,
  content: GameContent,
): RunCapabilities {
  const result = emptyRunCapabilities();
  const levelBenefits = getPermanentBenefits(profile, content);
  result.startingPointBonus += levelBenefits.attributePointBonus;
  result.talentCandidateBonus += levelBenefits.talentCandidateBonus;

  for (const legacyId of profile.equippedLegacyIds) {
    const legacy = content.legacies.find((item) => item.id === legacyId && item.persistence === 'permanent');
    const rank = Math.max(0, Math.floor(profile.legacyRanks[legacyId] ?? 0));
    if (legacy && rank > 0) {
      applyLegacyEffect(result, legacy.effect, rank);
    }
  }

  for (const boonId of profile.pendingBoonIds) {
    const boon = content.legacies.find((item) => item.id === boonId && item.persistence === 'next-life');
    if (boon) {
      applyLegacyEffect(result, boon.effect, 1);
    }
  }

  result.eventThemeBoosts = uniqueStrings(result.eventThemeBoosts);
  result.choiceTags = uniqueStrings(result.choiceTags);
  result.contentTags = uniqueStrings(result.contentTags);
  return result;
}

export function getRewardTextsBetween(
  previousLevel: number,
  newLevel: number,
  content: GameContent,
): string[] {
  return content.levels
    .filter((milestone) => milestone.level > previousLevel && milestone.level <= newLevel)
    .sort((left, right) => left.level - right.level)
    .map((milestone) => `轮回 ${milestone.level} 级：${milestone.rewardText}`);
}

export function getLevelProgress(
  profile: ReincarnatorProfile,
  content: GameContent,
): LevelProgress {
  const ordered = [...content.levels].sort((left, right) => left.requiredExp - right.requiredExp);
  const current = [...ordered]
    .reverse()
    .find((milestone) => milestone.level <= profile.level) ?? ordered[0];
  const next = ordered.find((milestone) => milestone.level > profile.level) ?? null;
  const currentThreshold = current?.requiredExp ?? 0;

  if (!next) {
    return {
      currentLevel: profile.level,
      currentThreshold,
      nextThreshold: null,
      progress: 1,
      nextRewardText: null,
    };
  }

  const span = Math.max(1, next.requiredExp - currentThreshold);
  const progress = Math.min(1, Math.max(0, (profile.totalExp - currentThreshold) / span));
  return {
    currentLevel: profile.level,
    currentThreshold,
    nextThreshold: next.requiredExp,
    progress,
    nextRewardText: next.rewardText,
  };
}

function applyLegacyEffect(target: RunCapabilities, effect: LegacyEffect, rank: number): void {
  switch (effect.type) {
    case 'starting-points':
      target.startingPointBonus += effect.amount * rank;
      break;
    case 'talent-candidates':
      target.talentCandidateBonus += effect.amount * rank;
      break;
    case 'event-reroll':
      target.eventRerolls += effect.charges * rank;
      break;
    case 'choice-foresight':
      target.choiceForesight = effect.detail === 'range' || target.choiceForesight === 'range'
        ? 'range'
        : 'direction';
      break;
    case 'death-guard':
      target.deathGuards += effect.charges * rank;
      break;
    case 'negative-shield':
      target.negativeShields += effect.charges * rank;
      break;
    case 'event-theme-boost':
      target.eventThemeBoosts.push(effect.theme);
      break;
    case 'unlock-choice-tag':
      target.choiceTags.push(effect.tag);
      break;
    case 'unlock-content-tag':
      target.contentTags.push(effect.tag);
      target.choiceTags.push(effect.tag);
      break;
  }
}

function normalizeLegacyRanks(value: unknown, content: GameContent): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const source = value as Record<string, unknown>;
  const result: Record<string, number> = {};
  for (const legacy of content.legacies) {
    if (legacy.persistence !== 'permanent') {
      continue;
    }
    const rank = Math.max(0, Math.floor(Number(source[legacy.id]) || 0));
    if (rank > 0) {
      result[legacy.id] = Math.min(legacy.maxRank, rank);
    }
  }
  return result;
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.filter((item): item is string => typeof item === 'string'))];
}
