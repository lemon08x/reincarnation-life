import {
  emptyStats,
  GameContent,
  GameSave,
  LifeHistoryEntry,
  LifeRun,
  LifeSettlement,
  LifeStatus,
  LifeTurnState,
  ReincarnatorProfile,
  RULES_VERSION,
  RunFateState,
  SAVE_VERSION,
  ScheduledLifeEvent,
  StageSelection,
  STAT_KEYS,
  Stats,
} from './model';
import { getLifeStageForAge } from './lifeEngine';
import { getRunCapabilities, normalizeProfile } from './progression';

type UnknownRecord = Record<string, unknown>;

export function migrateGameSave(value: unknown, content: GameContent): GameSave | null {
  if (!isRecord(value) || !isRecord(value.profile)) {
    return null;
  }
  const version = Math.floor(numberValue(value.version, 1));
  if (version < 1 || version > SAVE_VERSION) {
    return null;
  }

  const profile = normalizeProfile(value.profile as unknown as ReincarnatorProfile, content);
  const currentRun = value.currentRun === null || value.currentRun === undefined
    ? null
    : migrateLifeRun(value.currentRun, profile, content);
  if (value.currentRun !== null && value.currentRun !== undefined && !currentRun) {
    return null;
  }

  return {
    version: SAVE_VERSION,
    profile,
    currentRun,
  };
}

function migrateLifeRun(
  value: unknown,
  profile: ReincarnatorProfile,
  content: GameContent,
): LifeRun | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.familyId !== 'string') {
    return null;
  }
  const age = Math.max(0, Math.floor(numberValue(value.age, 0)));
  const stats = normalizeStats(value.stats);
  const allocation = normalizeStats(value.allocation);
  const capabilities = isRecord(value.capabilities)
    ? {
        ...getRunCapabilities(profile, content),
        startingPointBonus: numberValue(value.capabilities.startingPointBonus, 0),
        talentCandidateBonus: numberValue(value.capabilities.talentCandidateBonus, 0),
        eventRerolls: numberValue(value.capabilities.eventRerolls, 0),
        choiceForesight: value.capabilities.choiceForesight === 'range'
          ? 'range' as const
          : value.capabilities.choiceForesight === 'direction'
            ? 'direction' as const
            : 'none' as const,
        deathGuards: numberValue(value.capabilities.deathGuards, 0),
        negativeShields: numberValue(value.capabilities.negativeShields, 0),
        eventThemeBoosts: stringArray(value.capabilities.eventThemeBoosts),
        choiceTags: stringArray(value.capabilities.choiceTags),
        contentTags: stringArray(value.capabilities.contentTags),
      }
    : getRunCapabilities(profile, content);
  const currentStage = getLifeStageForAge(age, content);
  const stageSelections = normalizeStageSelections(value.stageSelections);
  const pendingDecision = isRecord(value.pendingDecision)
    && typeof value.pendingDecision.eventId === 'string'
    ? {
        age: Math.max(0, Math.floor(numberValue(value.pendingDecision.age, age))),
        eventId: value.pendingDecision.eventId,
        choiceIds: stringArray(value.pendingDecision.choiceIds),
        automaticEffects: normalizeStats(value.pendingDecision.automaticEffects, true),
        rerolledEventIds: stringArray(value.pendingDecision.rerolledEventIds),
        sourceChoiceId: typeof value.pendingDecision.sourceChoiceId === 'string'
          ? value.pendingDecision.sourceChoiceId
          : undefined,
      }
    : undefined;
  const status = normalizeStatus(value.status);
  const inferredTurnState: LifeTurnState = status === 'active'
    ? pendingDecision
      ? 'awaiting-choice'
      : stageSelections.some((selection) => selection.stageId === currentStage.id)
        ? 'ready'
        : 'awaiting-focus'
    : 'ready';
  const turnState = normalizeTurnState(value.turnState, inferredTurnState);
  const fate = normalizeFate(value.fate, {
    eventRerollsRemaining: capabilities.eventRerolls,
    deathGuardsRemaining: capabilities.deathGuards,
    negativeShieldsRemaining: capabilities.negativeShields,
  });
  const settlement = normalizeSettlement(value.settlement);

  return {
    id: value.id,
    seed: Math.floor(numberValue(value.seed, 1)),
    rngState: Math.floor(numberValue(value.rngState, 1)),
    rulesVersion: RULES_VERSION,
    profileLevelAtStart: Math.max(1, Math.floor(numberValue(value.profileLevelAtStart, profile.level))),
    status,
    turnState,
    age,
    familyId: value.familyId,
    talentIds: stringArray(value.talentIds),
    allocation,
    stats,
    tags: stringArray(value.tags),
    history: normalizeHistory(value.history),
    currentStageId: typeof value.currentStageId === 'string'
      ? value.currentStageId
      : currentStage.id,
    currentFocusId: typeof value.currentFocusId === 'string' ? value.currentFocusId : undefined,
    stageSelections,
    scheduledEvents: normalizeScheduledEvents(value.scheduledEvents),
    pendingDecision,
    capabilities,
    fate,
    endReason: typeof value.endReason === 'string' ? value.endReason : undefined,
    endingId: typeof value.endingId === 'string' ? value.endingId : undefined,
    settlement,
  };
}

function normalizeStats(value: unknown, partial = false): Stats {
  const result = emptyStats();
  if (!isRecord(value)) {
    return result;
  }
  for (const key of STAT_KEYS) {
    if (value[key] !== undefined || !partial) {
      result[key] = numberValue(value[key], 0);
    }
  }
  return result;
}

function normalizeHistory(value: unknown): LifeHistoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).map((entry) => ({
    age: Math.max(0, Math.floor(numberValue(entry.age, 0))),
    eventId: typeof entry.eventId === 'string' ? entry.eventId : 'unknown',
    text: typeof entry.text === 'string' ? entry.text : '',
    effects: normalizeStats(entry.effects, true),
    tagsAdded: stringArray(entry.tagsAdded),
    choiceId: typeof entry.choiceId === 'string' ? entry.choiceId : undefined,
    outcomeId: typeof entry.outcomeId === 'string' ? entry.outcomeId : undefined,
    causedByChoiceId: typeof entry.causedByChoiceId === 'string' ? entry.causedByChoiceId : undefined,
  }));
}

function normalizeStageSelections(value: unknown): StageSelection[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).flatMap((selection) => {
    if (typeof selection.stageId !== 'string' || typeof selection.focusId !== 'string') {
      return [];
    }
    return [{
      stageId: selection.stageId,
      focusId: selection.focusId,
      selectedAtAge: Math.max(0, Math.floor(numberValue(selection.selectedAtAge, 0))),
    }];
  });
}

function normalizeScheduledEvents(value: unknown): ScheduledLifeEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).flatMap((scheduled) => {
    if (typeof scheduled.eventId !== 'string' || typeof scheduled.sourceChoiceId !== 'string') {
      return [];
    }
    return [{
      eventId: scheduled.eventId,
      earliestAge: Math.max(0, Math.floor(numberValue(scheduled.earliestAge, 0))),
      latestAge: Math.max(0, Math.floor(numberValue(scheduled.latestAge, 0))),
      sourceChoiceId: scheduled.sourceChoiceId,
    }];
  });
}

function normalizeFate(value: unknown, fallback: RunFateState): RunFateState {
  if (!isRecord(value)) {
    return fallback;
  }
  return {
    eventRerollsRemaining: Math.max(0, Math.floor(numberValue(
      value.eventRerollsRemaining,
      fallback.eventRerollsRemaining,
    ))),
    deathGuardsRemaining: Math.max(0, Math.floor(numberValue(
      value.deathGuardsRemaining,
      fallback.deathGuardsRemaining,
    ))),
    negativeShieldsRemaining: Math.max(0, Math.floor(numberValue(
      value.negativeShieldsRemaining,
      fallback.negativeShieldsRemaining,
    ))),
  };
}

function normalizeSettlement(value: unknown): LifeSettlement | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return {
    score: Math.max(0, Math.floor(numberValue(value.score, 0))),
    earnedExp: Math.max(0, Math.floor(numberValue(value.earnedExp, 0))),
    baseExp: Math.max(0, Math.floor(numberValue(value.baseExp, 0))),
    performanceExp: Math.max(0, Math.floor(numberValue(value.performanceExp, 0))),
    firstDiscoveryExp: Math.max(0, Math.floor(numberValue(value.firstDiscoveryExp, 0))),
    previousLevel: Math.max(1, Math.floor(numberValue(value.previousLevel, 1))),
    newLevel: Math.max(1, Math.floor(numberValue(value.newLevel, 1))),
    newRewardTexts: stringArray(value.newRewardTexts),
    rewardOfferIds: stringArray(value.rewardOfferIds),
    selectedRewardId: typeof value.selectedRewardId === 'string' ? value.selectedRewardId : undefined,
  };
}

function normalizeStatus(value: unknown): LifeStatus {
  return value === 'active' || value === 'ended' || value === 'reward-pending' || value === 'settled'
    ? value
    : 'active';
}

function normalizeTurnState(value: unknown, fallback: LifeTurnState): LifeTurnState {
  return value === 'awaiting-focus' || value === 'ready' || value === 'awaiting-choice'
    ? value
    : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string'))]
    : [];
}

function numberValue(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
