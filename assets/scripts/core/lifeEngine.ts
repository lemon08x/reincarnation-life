import {
  emptyStats,
  EventChoiceConfig,
  EventCondition,
  EventOutcomeConfig,
  GameContent,
  LifeEventConfig,
  LifeFocusConfig,
  LifeRun,
  LifeStageConfig,
  PendingLifeDecision,
  ReincarnatorProfile,
  RULES_VERSION,
  ScheduledLifeEvent,
  STAT_KEYS,
  StatDelta,
  Stats,
  TalentDraft,
} from './model';
import { getRunCapabilities } from './progression';
import { nextRandom, normalizeSeed, pickWeighted, sampleUnique } from './random';

export const BASE_ALLOCATION_POINTS = 10;
export const BASE_TALENT_CANDIDATES = 3;
export const SELECTED_TALENT_COUNT = 2;
export const BASE_STAT_VALUE = 2;
export const MAX_STAT_VALUE = 30;
export const DEFAULT_MAX_PASSIVE_YEARS = 3;

interface EventSelection {
  event: LifeEventConfig;
  state: number;
  remainingSchedules: ScheduledLifeEvent[];
  sourceChoiceId?: string;
}

export function getAllocationPointTotal(
  profile: ReincarnatorProfile,
  content: GameContent,
): number {
  return BASE_ALLOCATION_POINTS + getRunCapabilities(profile, content).startingPointBonus;
}

export function drawTalentDraft(
  profile: ReincarnatorProfile,
  seed: number,
  content: GameContent,
): TalentDraft {
  const eligible = content.talents.filter((talent) => talent.unlockLevel <= profile.level);
  if (eligible.length < SELECTED_TALENT_COUNT) {
    throw new Error('Not enough unlocked talents to start a life.');
  }

  const candidateCount = Math.min(
    eligible.length,
    BASE_TALENT_CANDIDATES + getRunCapabilities(profile, content).talentCandidateBonus,
  );
  const sampled = sampleUnique(eligible, candidateCount, normalizeSeed(seed));

  return {
    seed: normalizeSeed(seed),
    rngState: sampled.state,
    candidateIds: sampled.items.map((talent) => talent.id),
    requiredSelectionCount: Math.min(SELECTED_TALENT_COUNT, sampled.items.length),
  };
}

export function startLife(
  profile: ReincarnatorProfile,
  draft: TalentDraft,
  selectedTalentIds: string[],
  allocation: Stats,
  runId: string,
  content: GameContent,
): LifeRun {
  validateTalentSelection(draft, selectedTalentIds);
  validateAllocation(allocation, getAllocationPointTotal(profile, content));

  const unlockedFamilies = content.families.filter((family) => family.unlockLevel <= profile.level);
  if (unlockedFamilies.length === 0) {
    throw new Error('No family background is available.');
  }

  const familyPick = pickWeighted(unlockedFamilies, draft.rngState, (family) => family.weight);
  const selectedTalents = selectedTalentIds.map((talentId) => {
    const talent = content.talents.find((candidate) => candidate.id === talentId);
    if (!talent) {
      throw new Error(`Unknown talent: ${talentId}`);
    }
    return talent;
  });

  let stats = addStats(
    {
      health: BASE_STAT_VALUE,
      intellect: BASE_STAT_VALUE,
      charm: BASE_STAT_VALUE,
      wealth: BASE_STAT_VALUE,
    },
    allocation,
  );
  stats = addStats(stats, familyPick.item.effects);
  for (const talent of selectedTalents) {
    stats = addStats(stats, talent.effects);
  }

  const startingEffects = mergeDeltas(
    familyPick.item.effects,
    ...selectedTalents.map((talent) => talent.effects),
  );
  const tags = unique([
    ...(familyPick.item.tags ?? []),
    ...selectedTalents.flatMap((talent) => talent.tags ?? []),
  ]);
  const capabilities = getRunCapabilities(profile, content);
  const initialStage = getLifeStageForAge(0, content);

  return {
    id: runId,
    seed: draft.seed,
    rngState: familyPick.state,
    rulesVersion: RULES_VERSION,
    profileLevelAtStart: profile.level,
    status: 'active',
    turnState: 'awaiting-focus',
    age: 0,
    familyId: familyPick.item.id,
    talentIds: [...selectedTalentIds],
    allocation: { ...allocation },
    stats,
    tags,
    history: [
      {
        age: 0,
        eventId: `birth:${familyPick.item.id}`,
        text: `你出生在${familyPick.item.name}。${familyPick.item.description}`,
        effects: startingEffects,
        tagsAdded: [...(familyPick.item.tags ?? [])],
      },
    ],
    currentStageId: initialStage.id,
    currentFocusId: undefined,
    stageSelections: [],
    scheduledEvents: [],
    pendingDecision: undefined,
    capabilities,
    fate: {
      eventRerollsRemaining: capabilities.eventRerolls,
      deathGuardsRemaining: capabilities.deathGuards,
      negativeShieldsRemaining: capabilities.negativeShields,
    },
  };
}

export function getLifeStageForAge(age: number, content: GameContent): LifeStageConfig {
  const stage = content.stages.find((candidate) => age >= candidate.minAge && age <= candidate.maxAge)
    ?? [...content.stages].sort((left, right) => right.maxAge - left.maxAge)[0];
  if (!stage) {
    throw new Error(`No life stage is configured for age ${age}.`);
  }
  return stage;
}

export function getCurrentLifeStage(run: LifeRun, content: GameContent): LifeStageConfig {
  const stage = content.stages.find((candidate) => candidate.id === run.currentStageId);
  if (!stage) {
    throw new Error(`Unknown life stage: ${run.currentStageId}`);
  }
  return stage;
}

export function chooseStageFocus(
  run: LifeRun,
  focusId: string,
  content: GameContent,
): LifeRun {
  if (run.status !== 'active' || run.turnState !== 'awaiting-focus') {
    throw new Error('This life is not waiting for a stage focus.');
  }
  const stage = getCurrentLifeStage(run, content);
  const focus = stage.focuses.find((candidate) => candidate.id === focusId);
  if (!focus) {
    throw new Error(`Focus ${focusId} is not available in ${stage.name}.`);
  }
  if (run.stageSelections.some((selection) => selection.stageId === stage.id)) {
    throw new Error(`A focus was already selected for ${stage.name}.`);
  }

  const focusTag = `focus:${focus.id}`;
  return {
    ...run,
    turnState: 'ready',
    currentFocusId: focus.id,
    stats: addStats(run.stats, focus.effects),
    tags: unique([...run.tags, focusTag]),
    stageSelections: [
      ...run.stageSelections,
      {
        stageId: stage.id,
        focusId: focus.id,
        selectedAtAge: stage.minAge,
      },
    ],
    history: [
      ...run.history,
      {
        age: run.age,
        eventId: `focus:${stage.id}`,
        text: run.age < stage.minAge
          ? `即将进入${stage.name}，你决定${focus.name}。`
          : `在${stage.name}，你决定${focus.name}。`,
        effects: { ...focus.effects },
        tagsAdded: [focusTag],
      },
    ],
  };
}

export function advanceToNextMoment(
  run: LifeRun,
  content: GameContent,
  maxPassiveYears = DEFAULT_MAX_PASSIVE_YEARS,
): LifeRun {
  if (run.status !== 'active') {
    throw new Error('Only an active life can advance.');
  }
  if (run.turnState !== 'ready') {
    throw new Error('Resolve the current focus or event choice before advancing.');
  }

  let nextRun = run;
  const limit = Math.max(1, Math.floor(maxPassiveYears));

  for (let offset = 0; offset < limit; offset += 1) {
    const nextAge = nextRun.age + 1;
    const nextStage = getLifeStageForAge(nextAge, content);
    if (nextStage.id !== nextRun.currentStageId) {
      return {
        ...nextRun,
        currentStageId: nextStage.id,
        currentFocusId: undefined,
        turnState: 'awaiting-focus',
      };
    }

    nextRun = advanceOneYear(nextRun, nextAge, content);
    if (nextRun.status !== 'active' || nextRun.turnState !== 'ready') {
      break;
    }
  }

  return nextRun;
}

export function resolveEventChoice(
  run: LifeRun,
  choiceId: string,
  content: GameContent,
): LifeRun {
  if (run.status !== 'active' || run.turnState !== 'awaiting-choice' || !run.pendingDecision) {
    throw new Error('This life is not waiting for an event choice.');
  }
  const event = getPendingEvent(run, content);
  const choice = event.choices?.find((candidate) => candidate.id === choiceId);
  if (!choice || !run.pendingDecision.choiceIds.includes(choice.id)) {
    throw new Error(`Choice ${choiceId} is not available for the current event.`);
  }
  return resolveChoice(run, event, choice, content);
}

export function rerollPendingDecision(run: LifeRun, content: GameContent): LifeRun {
  const pending = run.pendingDecision;
  if (run.status !== 'active' || run.turnState !== 'awaiting-choice' || !pending) {
    throw new Error('There is no pending event to rewrite.');
  }
  if (run.fate.eventRerollsRemaining <= 0) {
    throw new Error('No event rewrites remain in this life.');
  }
  if (pending.sourceChoiceId) {
    throw new Error('A consequence from an earlier choice cannot be rewritten.');
  }

  const excludedIds = unique([pending.eventId, ...pending.rerolledEventIds]);
  const eligible = content.events.filter((event) => {
    if (excludedIds.includes(event.id) || !event.choices) {
      return false;
    }
    if (!isEventEligible(event, pending.age, run, content)) {
      return false;
    }
    return getEligibleChoices(event, run, content).length >= 2;
  });
  if (eligible.length === 0) {
    throw new Error('No other key event is available at this age.');
  }

  const eventPick = pickWeighted(eligible, run.rngState, (event) => getEventWeight(event, run, content));
  const choiceIds = getEligibleChoices(eventPick.item, run, content).map((choice) => choice.id);
  return {
    ...run,
    rngState: eventPick.state,
    fate: {
      ...run.fate,
      eventRerollsRemaining: run.fate.eventRerollsRemaining - 1,
    },
    pendingDecision: {
      ...pending,
      eventId: eventPick.item.id,
      choiceIds,
      rerolledEventIds: excludedIds,
    },
  };
}

export function getPendingEvent(run: LifeRun, content: GameContent): LifeEventConfig {
  if (!run.pendingDecision) {
    throw new Error('There is no pending event.');
  }
  const event = content.events.find((candidate) => candidate.id === run.pendingDecision?.eventId);
  if (!event) {
    throw new Error(`Unknown pending event: ${run.pendingDecision.eventId}`);
  }
  return event;
}

export function getChoiceDisplayText(
  run: LifeRun,
  choice: EventChoiceConfig,
): string {
  if (run.capabilities.choiceForesight !== 'range') {
    return `${choice.text}\n${choice.preview}`;
  }
  const possibleEffects = unique(choice.outcomes.map((outcome) => {
    const combined = mergeDeltas(run.pendingDecision?.automaticEffects ?? {}, outcome.effects ?? {});
    return formatStatDelta(combined) || '属性平稳';
  }));
  return `${choice.text}\n${choice.preview}｜可能：${possibleEffects.join(' / ')}`;
}

export function calculateLifeScore(run: LifeRun): number {
  const statScore = STAT_KEYS.reduce((sum, key) => sum + Math.max(0, run.stats[key]), 0) * 3;
  const experienceScore = unique(run.tags).length * 5;
  const decisionScore = run.history.filter((entry) => Boolean(entry.choiceId)).length * 4;
  return Math.max(0, Math.floor(run.age * 2 + statScore + experienceScore + decisionScore));
}

export function getMortalityChance(age: number, health: number): number {
  if (age >= 100) {
    return 1;
  }

  let baseChance = 0.0002;
  if (age >= 90) {
    baseChance = 0.22;
  } else if (age >= 80) {
    baseChance = 0.1;
  } else if (age >= 70) {
    baseChance = 0.04;
  } else if (age >= 60) {
    baseChance = 0.015;
  } else if (age >= 50) {
    baseChance = 0.005;
  } else if (age >= 30) {
    baseChance = 0.001;
  }

  const healthPenaltyRate = age < 40 ? 0.001 : age < 60 ? 0.003 : 0.006;
  const lowHealthPenalty = Math.max(0, 5 - health) * healthPenaltyRate;
  const highHealthProtection = Math.max(0, health - 12) * 0.001;
  return Math.min(0.95, Math.max(0, baseChance + lowHealthPenalty - highHealthProtection));
}

export function formatStatDelta(delta: StatDelta): string {
  const labels: Record<keyof Stats, string> = {
    health: '体魄',
    intellect: '心智',
    charm: '人缘',
    wealth: '家底',
  };
  return STAT_KEYS
    .filter((key) => Boolean(delta[key]))
    .map((key) => `${labels[key]} ${(delta[key] ?? 0) > 0 ? '+' : ''}${delta[key]}`)
    .join('　');
}

function advanceOneYear(run: LifeRun, age: number, content: GameContent): LifeRun {
  const selection = selectEvent(run, age, content);
  const agingEffect: StatDelta = age >= 50 && age % 5 === 0 ? { health: -1 } : {};
  const eligibleChoices = getEligibleChoices(selection.event, run, content);
  const baseRun: LifeRun = {
    ...run,
    age,
    rngState: selection.state,
    scheduledEvents: selection.remainingSchedules,
  };

  if (selection.event.choices && eligibleChoices.length >= 2) {
    const pendingDecision: PendingLifeDecision = {
      age,
      eventId: selection.event.id,
      choiceIds: eligibleChoices.map((choice) => choice.id),
      automaticEffects: agingEffect,
      rerolledEventIds: [],
      sourceChoiceId: selection.sourceChoiceId,
    };
    return {
      ...baseRun,
      turnState: 'awaiting-choice',
      pendingDecision,
    };
  }

  if (selection.event.choices && eligibleChoices.length === 1) {
    return resolveChoice(
      {
        ...baseRun,
        turnState: 'awaiting-choice',
        pendingDecision: {
          age,
          eventId: selection.event.id,
          choiceIds: [eligibleChoices[0].id],
          automaticEffects: agingEffect,
          rerolledEventIds: [],
          sourceChoiceId: selection.sourceChoiceId,
        },
      },
      selection.event,
      eligibleChoices[0],
      content,
    );
  }

  const mitigated = mitigateNegativeEffects(
    mergeDeltas(selection.event.effects ?? {}, agingEffect),
    baseRun,
  );
  const addedTags = selection.event.addTags ?? [];
  const nextRun: LifeRun = {
    ...baseRun,
    stats: addStats(baseRun.stats, mitigated.effects),
    tags: unique([...baseRun.tags, ...addedTags]),
    fate: mitigated.fate,
    history: [
      ...baseRun.history,
      {
        age,
        eventId: selection.event.id,
        text: mitigated.shielded
          ? `${selection.event.text} 下世微光替你减轻了损失。`
          : selection.event.text,
        effects: mitigated.effects,
        tagsAdded: [...addedTags],
        causedByChoiceId: selection.sourceChoiceId,
      },
    ],
  };
  return finishYear(nextRun, selection.event.terminalReason, content);
}

function resolveChoice(
  run: LifeRun,
  event: LifeEventConfig,
  choice: EventChoiceConfig,
  content: GameContent,
): LifeRun {
  const pending = run.pendingDecision;
  if (!pending) {
    throw new Error('A pending decision is required.');
  }
  const outcomePick = pickWeighted(choice.outcomes, run.rngState, (outcome) => outcome.weight);
  const outcome = outcomePick.item;
  const mitigated = mitigateNegativeEffects(
    mergeDeltas(pending.automaticEffects, outcome.effects ?? {}),
    run,
  );
  const addedTags = outcome.addTags ?? [];
  const choiceKey = `${event.id}:${choice.id}`;
  const scheduled = createSchedules(run.age, choiceKey, outcome);
  const resolved: LifeRun = {
    ...run,
    rngState: outcomePick.state,
    turnState: 'ready',
    pendingDecision: undefined,
    stats: addStats(run.stats, mitigated.effects),
    tags: unique([...run.tags, ...addedTags]),
    fate: mitigated.fate,
    scheduledEvents: [...run.scheduledEvents, ...scheduled],
    history: [
      ...run.history,
      {
        age: run.age,
        eventId: event.id,
        text: `${event.text}\n你选择了“${choice.text}”。${outcome.text}${mitigated.shielded ? ' 下世微光替你减轻了损失。' : ''}`,
        effects: mitigated.effects,
        tagsAdded: [...addedTags],
        choiceId: choice.id,
        outcomeId: outcome.id,
        causedByChoiceId: pending.sourceChoiceId,
      },
    ],
  };
  return finishYear(resolved, outcome.terminalReason ?? event.terminalReason, content);
}

function selectEvent(run: LifeRun, age: number, content: GameContent): EventSelection {
  const schedules = run.scheduledEvents.filter((scheduled) => {
    if (scheduled.latestAge < age) {
      return false;
    }
    return !run.history.some((entry) => entry.eventId === scheduled.eventId);
  });
  const due = schedules
    .filter((scheduled) => age >= scheduled.earliestAge && age <= scheduled.latestAge)
    .map((scheduled) => ({
      scheduled,
      event: content.events.find((candidate) => candidate.id === scheduled.eventId),
    }))
    .filter((item): item is { scheduled: ScheduledLifeEvent; event: LifeEventConfig } => (
      Boolean(item.event) && isEventEligible(item.event as LifeEventConfig, age, run, content)
    ));

  if (due.length > 0) {
    const pick = pickWeighted(due, run.rngState, (item) => item.event.weight);
    return {
      event: pick.item.event,
      state: pick.state,
      remainingSchedules: schedules.filter((item) => item !== pick.item.scheduled),
      sourceChoiceId: pick.item.scheduled.sourceChoiceId,
    };
  }

  const eligible = content.events.filter((event) => isEventEligible(event, age, run, content));
  if (eligible.length === 0) {
    throw new Error(`No eligible event exists for age ${age}.`);
  }
  const lastEventId = [...run.history].reverse().find((entry) => (
    content.events.some((event) => event.id === entry.eventId)
  ))?.eventId;
  const withoutImmediateRepeat = eligible.filter((event) => event.id !== lastEventId);
  const eventPool = withoutImmediateRepeat.length > 0 ? withoutImmediateRepeat : eligible;
  const eventPick = pickWeighted(eventPool, run.rngState, (event) => getEventWeight(event, run, content));
  return {
    event: eventPick.item,
    state: eventPick.state,
    remainingSchedules: schedules,
  };
}

function getEventWeight(event: LifeEventConfig, run: LifeRun, content: GameContent): number {
  const themes = event.themes ?? inferThemes(event.effects ?? {});
  const focus = getCurrentFocus(run, content);
  const focusMatch = focus?.preferredThemes.some((theme) => themes.includes(theme)) ? 1 : 0;
  const legacyMatches = run.capabilities.eventThemeBoosts.filter((theme) => themes.includes(theme)).length;
  return event.weight * (1 + focusMatch * 0.75 + legacyMatches * 0.5);
}

function getCurrentFocus(run: LifeRun, content: GameContent): LifeFocusConfig | undefined {
  if (!run.currentFocusId) {
    return undefined;
  }
  return getCurrentLifeStage(run, content).focuses.find((focus) => focus.id === run.currentFocusId);
}

function getEligibleChoices(
  event: LifeEventConfig,
  run: LifeRun,
  content: GameContent,
): EventChoiceConfig[] {
  return (event.choices ?? []).filter((choice) => matchesCondition(choice.condition, run, content));
}

function isEventEligible(
  event: LifeEventConfig,
  age: number,
  run: LifeRun,
  content: GameContent,
): boolean {
  if (age < event.minAge || age > event.maxAge) {
    return false;
  }
  if ((event.unlockLevel ?? 1) > run.profileLevelAtStart) {
    return false;
  }
  if (event.once && run.history.some((entry) => entry.eventId === event.id)) {
    return false;
  }
  return matchesCondition(event.condition, run, content);
}

function matchesCondition(
  condition: EventCondition | undefined,
  run: LifeRun,
  content: GameContent,
): boolean {
  if (!condition) {
    return true;
  }
  if (condition.minStats && STAT_KEYS.some((key) => {
    const minimum = condition.minStats?.[key];
    return minimum !== undefined && run.stats[key] < minimum;
  })) {
    return false;
  }
  if (condition.maxStats && STAT_KEYS.some((key) => {
    const maximum = condition.maxStats?.[key];
    return maximum !== undefined && run.stats[key] > maximum;
  })) {
    return false;
  }
  if (condition.requiredTags?.some((tag) => !run.tags.includes(tag))) {
    return false;
  }
  if (condition.forbiddenTags?.some((tag) => run.tags.includes(tag))) {
    return false;
  }
  if (condition.requiredTalentIds?.some((talentId) => !run.talentIds.includes(talentId))) {
    return false;
  }
  if (condition.requiredEventIds?.some((eventId) => !run.history.some((entry) => entry.eventId === eventId))) {
    return false;
  }
  if (condition.requiredFocusIds?.some((focusId) => run.currentFocusId !== focusId)) {
    return false;
  }
  const capabilityTags = getActiveCapabilityTags(run, content);
  if (condition.requiredCapabilityTags?.some((tag) => !capabilityTags.includes(tag))) {
    return false;
  }
  return true;
}

function getActiveCapabilityTags(run: LifeRun, content: GameContent): string[] {
  const focus = getCurrentFocus(run, content);
  return unique([
    ...run.capabilities.choiceTags,
    ...run.capabilities.contentTags,
    ...(focus?.capabilityTags ?? []),
  ]);
}

function createSchedules(
  currentAge: number,
  sourceChoiceId: string,
  outcome: EventOutcomeConfig,
): ScheduledLifeEvent[] {
  return (outcome.schedule ?? []).map((scheduled) => {
    const earliestAge = currentAge + Math.max(1, Math.floor(scheduled.afterYears));
    return {
      eventId: scheduled.eventId,
      earliestAge,
      latestAge: earliestAge + Math.max(0, Math.floor(scheduled.windowYears ?? 2)),
      sourceChoiceId,
    };
  });
}

function mitigateNegativeEffects(
  effects: StatDelta,
  run: LifeRun,
): { effects: StatDelta; fate: LifeRun['fate']; shielded: boolean } {
  const hasNegative = STAT_KEYS.some((key) => (effects[key] ?? 0) < 0);
  if (!hasNegative || run.fate.negativeShieldsRemaining <= 0) {
    return { effects, fate: run.fate, shielded: false };
  }
  const mitigated: StatDelta = { ...effects };
  for (const key of STAT_KEYS) {
    const value = mitigated[key];
    if (value !== undefined && value < 0) {
      mitigated[key] = Math.min(0, value + 1);
    }
  }
  return {
    effects: mitigated,
    fate: {
      ...run.fate,
      negativeShieldsRemaining: run.fate.negativeShieldsRemaining - 1,
    },
    shielded: true,
  };
}

function finishYear(run: LifeRun, explicitEndReason: string | undefined, content: GameContent): LifeRun {
  let nextRun = run;
  let endReason = explicitEndReason;
  let preventableDeath = false;

  if (!endReason && nextRun.stats.health <= 0) {
    endReason = '身体没能继续支撑，你走完了这一生。';
    preventableDeath = true;
  }

  if (!endReason) {
    const mortalityStep = nextRandom(nextRun.rngState);
    nextRun = { ...nextRun, rngState: mortalityStep.state };
    if (mortalityStep.value < getMortalityChance(nextRun.age, nextRun.stats.health)) {
      endReason = nextRun.age < 50
        ? '命运在意料之外收走了这一世。'
        : '岁月与身体一同慢了下来，你走完了这一生。';
      preventableDeath = true;
    }
  }

  if (endReason && preventableDeath && nextRun.fate.deathGuardsRemaining > 0) {
    return {
      ...nextRun,
      stats: {
        ...nextRun.stats,
        health: Math.max(1, nextRun.stats.health),
      },
      tags: unique([...nextRun.tags, 'escaped_death']),
      fate: {
        ...nextRun.fate,
        deathGuardsRemaining: nextRun.fate.deathGuardsRemaining - 1,
      },
      history: appendToLatestHistory(nextRun.history, '轮回深处借来的一口气，让你留了下来。'),
    };
  }

  if (endReason) {
    return {
      ...nextRun,
      status: 'ended',
      turnState: 'ready',
      pendingDecision: undefined,
      endReason,
      endingId: determineEnding(nextRun, content),
    };
  }

  return nextRun;
}

function determineEnding(run: LifeRun, content: GameContent): string {
  const ending = [...content.endings]
    .sort((left, right) => right.priority - left.priority)
    .find((candidate) => {
      if (candidate.minAge !== undefined && run.age < candidate.minAge) {
        return false;
      }
      if (candidate.maxAge !== undefined && run.age > candidate.maxAge) {
        return false;
      }
      if (candidate.minStats && STAT_KEYS.some((key) => {
        const minimum = candidate.minStats?.[key];
        return minimum !== undefined && run.stats[key] < minimum;
      })) {
        return false;
      }
      if (candidate.requiredTags?.some((tag) => !run.tags.includes(tag))) {
        return false;
      }
      return true;
    });

  if (!ending) {
    throw new Error('No ending matches this life.');
  }
  return ending.id;
}

function validateTalentSelection(draft: TalentDraft, selectedTalentIds: string[]): void {
  const selected = unique(selectedTalentIds);
  if (selected.length !== draft.requiredSelectionCount) {
    throw new Error(`Exactly ${draft.requiredSelectionCount} talents must be selected.`);
  }
  if (selected.some((talentId) => !draft.candidateIds.includes(talentId))) {
    throw new Error('A selected talent was not offered in this draft.');
  }
}

function validateAllocation(allocation: Stats, expectedTotal: number): void {
  const values = STAT_KEYS.map((key) => allocation[key]);
  if (values.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error('Allocated stat points must be non-negative integers.');
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total !== expectedTotal) {
    throw new Error(`Expected ${expectedTotal} allocated points, received ${total}.`);
  }
}

function inferThemes(delta: StatDelta): string[] {
  const themes: string[] = [];
  if (delta.health !== undefined) {
    themes.push('health');
  }
  if (delta.intellect !== undefined) {
    themes.push('learning');
  }
  if (delta.charm !== undefined) {
    themes.push('relationship');
  }
  if (delta.wealth !== undefined) {
    themes.push('career');
  }
  return themes;
}

function appendToLatestHistory(
  history: LifeRun['history'],
  suffix: string,
): LifeRun['history'] {
  if (history.length === 0) {
    return history;
  }
  const latest = history[history.length - 1];
  return [
    ...history.slice(0, -1),
    {
      ...latest,
      text: `${latest.text} ${suffix}`,
    },
  ];
}

function addStats(base: Stats, delta: StatDelta): Stats {
  const result = { ...base };
  for (const key of STAT_KEYS) {
    result[key] = clamp(result[key] + (delta[key] ?? 0), 0, MAX_STAT_VALUE);
  }
  return result;
}

function mergeDeltas(...deltas: StatDelta[]): StatDelta {
  const result = emptyStats();
  for (const delta of deltas) {
    for (const key of STAT_KEYS) {
      result[key] += delta[key] ?? 0;
    }
  }
  return result;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
