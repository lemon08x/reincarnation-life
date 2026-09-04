import {
  emptyStats,
  GameContent,
  LifeMark,
  GameSave,
  LifeDomain,
  LIFE_DOMAINS,
  LifeHistoryEntry,
  LifeRelation,
  LifeRun,
  LifeSettlement,
  LifeStatus,
  LifeThread,
  LifeTurnState,
  LifeWorld,
  ReincarnatorProfile,
  RELATION_KINDS,
  RelationKind,
  RULES_VERSION,
  RunFateState,
  SAVE_VERSION,
  ScheduledLifeEvent,
  StageSelection,
  STAT_KEYS,
  Stats,
} from './model';
import { getLifeStageForAge } from './lifeEngine';
import { inferWorldFromTags } from './lifeWorld';
import { applyMarkChanges, inferMarkChanges } from './lifeMarks';
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
        pressureNote: typeof value.pendingDecision.pressureNote === 'string'
          ? value.pendingDecision.pressureNote
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
    marks: normalizeMarks(value.marks, stats, content),
    world: normalizeWorld(value.world, stringArray(value.tags), value.familyId, age),
    history: normalizeHistory(value.history),
    currentStageId: typeof value.currentStageId === 'string'
      ? value.currentStageId
      : currentStage.id,
    currentFocusId: typeof value.currentFocusId === 'string' ? value.currentFocusId : undefined,
    stageSelections,
    scheduledEvents: normalizeScheduledEvents(value.scheduledEvents),
    pendingDecision,
    playMode: value.playMode === 'history' ? 'history' : 'free',
    historyRegion: typeof value.historyRegion === 'string' ? value.historyRegion as LifeRun['historyRegion'] : undefined,
    figureId: typeof value.figureId === 'string' ? value.figureId : undefined,
    chapterIndex: Math.max(0, Math.floor(numberValue(value.chapterIndex, 0))),
    completedScenarioIds: stringArray(value.completedScenarioIds),
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
    worldChanges: stringArray(entry.worldChanges),
    markChanges: stringArray(entry.markChanges),
    touchedDomains: stringArray(entry.touchedDomains).filter((item): item is LifeDomain => (
      LIFE_DOMAINS.includes(item as LifeDomain)
    )),
    pressureNote: typeof entry.pressureNote === 'string' ? entry.pressureNote : undefined,
  }));
}

function normalizeWorld(
  value: unknown,
  tags: string[],
  familyId: unknown,
  age: number,
): LifeWorld {
  if (!isRecord(value)) {
    return inferWorldFromTags(tags, typeof familyId === 'string' ? familyId : '', age);
  }
  const facts: LifeWorld['facts'] = {};
  if (isRecord(value.facts)) {
    for (const [key, fact] of Object.entries(value.facts)) {
      if (isRecord(fact) && typeof fact.value === 'string') {
        facts[key] = {
          value: fact.value,
          sinceAge: Math.max(0, Math.floor(numberValue(fact.sinceAge, age))),
        };
      }
    }
  }
  const relations = Array.isArray(value.relations)
    ? value.relations.filter(isRecord).flatMap((relation): LifeRelation[] => {
      if (typeof relation.id !== 'string') {
        return [];
      }
      const kind: RelationKind = RELATION_KINDS.includes(relation.kind as RelationKind)
        ? relation.kind as RelationKind
        : 'community';
      return [{
        id: relation.id,
        kind,
        label: typeof relation.label === 'string' ? relation.label : relation.id,
        closeness: clampNumber(numberValue(relation.closeness, 4), 0, 10),
        strain: clampNumber(numberValue(relation.strain, 0), 0, 10),
        sinceAge: Math.max(0, Math.floor(numberValue(relation.sinceAge, age))),
        lastTouchedAge: Math.max(0, Math.floor(numberValue(relation.lastTouchedAge, age))),
      }];
    })
    : [];
  const threads = Array.isArray(value.threads)
    ? value.threads.filter(isRecord).flatMap((thread): LifeThread[] => {
      if (typeof thread.id !== 'string' || !LIFE_DOMAINS.includes(thread.domain as LifeDomain)) {
        return [];
      }
      return [{
        id: thread.id,
        domain: thread.domain as LifeDomain,
        label: typeof thread.label === 'string' ? thread.label : thread.id,
        intensity: clampNumber(numberValue(thread.intensity, 2), 0, 10),
        sinceAge: Math.max(0, Math.floor(numberValue(thread.sinceAge, age))),
        lastEventAge: Math.max(0, Math.floor(numberValue(thread.lastEventAge, age))),
      }];
    })
    : [];
  if (Object.keys(facts).length === 0 && relations.length === 0 && threads.length === 0) {
    return inferWorldFromTags(tags, typeof familyId === 'string' ? familyId : '', age);
  }
  return { facts, relations, threads };
}

function normalizeMarks(value: unknown, stats: Stats, content: GameContent): LifeMark[] {
  if (Array.isArray(value)) {
    const fromSave = value.filter(isRecord).flatMap((item): LifeMark[] => {
      if (typeof item.id !== 'string' || !content.marks.some((mark) => mark.id === item.id)) {
        return [];
      }
      const intensity = clampNumber(numberValue(item.intensity, 1), 1, 3);
      return [{ id: item.id, intensity }];
    });
    if (fromSave.length > 0) {
      return fromSave;
    }
  }
  return applyMarkChanges([], inferMarkChanges(stats, true), content.marks).marks;
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
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
  return value === 'awaiting-focus'
    || value === 'awaiting-path'
    || value === 'in-scenario'
    || value === 'awaiting-choice'
    || value === 'scenario-summary'
    || value === 'ready'
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
