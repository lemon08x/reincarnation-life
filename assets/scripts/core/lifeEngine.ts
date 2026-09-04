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
  TalentDraft,
  WorldChange,
} from './model';
import {
  agingMarkChanges,
  applyMarkChanges,
  bodyCollapsed,
  createStartingMarks,
  formatMarkPreview,
  getMortalityChanceFromMarks,
  inferMarkChanges,
  markEventMultiplier,
  markOutcomeMultiplier,
  matchesRequiredMarks,
  mitigateBurdenChanges,
  statsFromMarks,
} from './lifeMarks';
import {
  applyFocusToWorld,
  applyWorldChange,
  compileOutcomeChange,
  compileWorldChange,
  computeWorldPressures,
  createBirthWorld,
  describePressureNote,
  evaluateCouplingBonus,
  formatChangePreview,
  getEventDomains,
  getNetworkWeightMultiplier,
  getWorld,
  matchesWorldCondition,
  rippleWorld,
  tickLifeWorld,
} from './lifeWorld';
import {
  choosePath as enterPath,
  continueAfterSummary,
  progressScenarioAfterBeat,
  resolveScenarioAction as playScenarioAction,
} from './lifeScenario';
import { getRunCapabilities } from './progression';
import { nextRandom, normalizeSeed, pickWeighted, sampleUnique } from './random';

export {
  eligibleScenarioActions,
  formatScenarioResources,
  listAvailablePaths,
} from './lifeScenario';

export {
  formatHistoryEffects,
  formatWorldSummary,
} from './lifeWorld';
export { formatMarkList } from './lifeMarks';

export const BASE_TALENT_CANDIDATES = 3;
export const SELECTED_TALENT_COUNT = 2;
export const DEFAULT_MAX_PASSIVE_YEARS = 3;

interface EventSelection {
  event: LifeEventConfig;
  state: number;
  remainingSchedules: ScheduledLifeEvent[];
  sourceChoiceId?: string;
  pressureNote?: string;
}

export function getOpeningReserve(
  profile: ReincarnatorProfile,
  content: GameContent,
): number {
  return getRunCapabilities(profile, content).startingPointBonus;
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
  runId: string,
  content: GameContent,
): LifeRun {
  validateTalentSelection(draft, selectedTalentIds);

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

  const startingMarks = createStartingMarks(
    familyPick.item,
    selectedTalents,
    getOpeningReserve(profile, content),
    content.marks,
  );
  const stats = statsFromMarks(startingMarks.marks);
  const tags = unique([
    ...(familyPick.item.tags ?? []),
    ...selectedTalents.flatMap((talent) => talent.tags ?? []),
  ]);
  const capabilities = getRunCapabilities(profile, content);
  const initialStage = getLifeStageForAge(0, content);
  const world = createBirthWorld(familyPick.item, selectedTalents);

  return {
    id: runId,
    seed: draft.seed,
    rngState: familyPick.state,
    rulesVersion: RULES_VERSION,
    profileLevelAtStart: profile.level,
    status: 'active',
    turnState: 'awaiting-path',
    playMode: 'free',
    chapterIndex: 0,
    age: 0,
    familyId: familyPick.item.id,
    talentIds: [...selectedTalentIds],
    allocation: emptyStats(),
    stats,
    tags,
    marks: startingMarks.marks,
    world,
    history: [
      {
        age: 0,
        eventId: `birth:${familyPick.item.id}`,
        text: `你出生在${familyPick.item.name}。${familyPick.item.description}`,
        effects: emptyStats(),
        tagsAdded: [...(familyPick.item.tags ?? [])],
        markChanges: startingMarks.fragments,
      },
    ],
    currentStageId: initialStage.id,
    currentFocusId: undefined,
    stageSelections: [],
    scheduledEvents: [],
    pendingDecision: undefined,
    completedScenarioIds: [],
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
  const focusedWorld = applyFocusToWorld(getWorld(run), focus, run.age);
  return {
    ...run,
    turnState: 'ready',
    currentFocusId: focus.id,
    tags: unique([...run.tags, focusTag]),
    world: focusedWorld.world,
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
        effects: emptyStats(),
        tagsAdded: [focusTag],
        worldChanges: focusedWorld.fragments,
        touchedDomains: getEventDomains({
          id: focus.id,
          minAge: 0,
          maxAge: 100,
          text: focus.name,
          weight: 1,
          themes: focus.preferredThemes,
        }),
      },
    ],
  };
}

export function chooseLifePath(run: LifeRun, scenarioId: string, content: GameContent): LifeRun {
  return enterPath(run, scenarioId, content);
}

export function resolveScenarioAction(run: LifeRun, actionId: string, content: GameContent): LifeRun {
  return playScenarioAction(run, actionId, content);
}

export function continueScenario(run: LifeRun, content: GameContent): LifeRun {
  const next = continueAfterSummary(run, content);
  if (next.status === 'ended') {
    return finishYear({ ...next, status: 'active', turnState: 'ready' }, next.endReason, content);
  }
  return next;
}

export function startHistoryLife(
  profile: ReincarnatorProfile,
  figureId: string,
  runId: string,
  content: GameContent,
): LifeRun {
  const figure = content.figures.find((item) => item.id === figureId);
  if (!figure) {
    throw new Error(`Unknown figure: ${figureId}`);
  }
  const family = content.families[0];
  if (!family) {
    throw new Error('No family background is available.');
  }
  const granted = applyMarkChanges([], figure.grantMarks ?? [], content.marks);
  const capabilities = getRunCapabilities(profile, content);
  const world = createBirthWorld(family, []);
  return {
    id: runId,
    seed: 1,
    rngState: normalizeSeed(profile.totalExp + profile.settledRunIds.length + 17),
    rulesVersion: RULES_VERSION,
    profileLevelAtStart: profile.level,
    status: 'active',
    turnState: 'awaiting-path',
    playMode: 'history',
    historyRegion: figure.region,
    figureId: figure.id,
    chapterIndex: 0,
    age: 0,
    familyId: family.id,
    talentIds: [],
    allocation: emptyStats(),
    stats: statsFromMarks(granted.marks),
    tags: [],
    marks: granted.marks,
    world,
    history: [{
      age: 0,
      eventId: `history:${figure.id}`,
      text: figure.opening,
      effects: emptyStats(),
      tagsAdded: [],
      markChanges: granted.fragments,
    }],
    currentStageId: getLifeStageForAge(0, content).id,
    stageSelections: [],
    scheduledEvents: [],
    completedScenarioIds: [],
    capabilities,
    fate: {
      eventRerollsRemaining: capabilities.eventRerolls,
      deathGuardsRemaining: capabilities.deathGuards,
      negativeShieldsRemaining: capabilities.negativeShields,
    },
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
  const resolved = resolveChoice(run, event, choice, content);
  if (resolved.status === 'active' && resolved.currentScenario) {
    return progressScenarioAfterBeat({ ...resolved, turnState: 'in-scenario' }, content);
  }
  return resolved;
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
  const pressures = computeWorldPressures(getWorld(run), run.stats, pending.age);
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
      pressureNote: describePressureNote(
        eventPick.item,
        pressures,
        evaluateCouplingBonus(eventPick.item, run, pressures),
      ),
    },
  };
}

export function getPendingEvent(run: LifeRun, content: GameContent): LifeEventConfig {
  if (!run.pendingDecision) {
    throw new Error('There is no pending event.');
  }
  const event = content.events.find((candidate) => candidate.id === run.pendingDecision?.eventId);
  if (event) {
    return event;
  }
  const parts = run.pendingDecision.eventId.split(':');
  if (parts.length >= 3 && parts[1] === 'beat') {
    const scenario = content.scenarios.find((item) => item.id === parts[0]);
    const beat = scenario?.beats.find((item) => item.id === parts.slice(2).join(':'));
    if (scenario && beat) {
      return {
        id: run.pendingDecision.eventId,
        minAge: 0,
        maxAge: 100,
        text: run.currentScenario?.beatText ?? beat.text,
        weight: beat.weight,
        choices: beat.choices,
      };
    }
  }
  throw new Error(`Unknown pending event: ${run.pendingDecision.eventId}`);
}

export function getChoiceDisplayText(
  run: LifeRun,
  choice: EventChoiceConfig,
  content?: GameContent,
): string {
  if (run.capabilities.choiceForesight !== 'range') {
    return `${choice.text}\n${choice.preview}`;
  }
  const catalog = content?.marks ?? [];
  const possibleEffects = unique(choice.outcomes.map((outcome) => {
    const compiled = compileOutcomeChange(outcome, run.pendingDecision?.automaticEffects);
    const inferred = inferMarkChanges(compiled.stats ?? {}, true);
    const markText = formatMarkPreview([...(compiled.marks ?? []), ...inferred], catalog);
    const worldText = formatChangePreview({ ...compiled, stats: {} });
    return [markText, worldText].filter(Boolean).join('　') || '生活继续';
  }));
  return `${choice.text}\n${choice.preview}｜可能：${possibleEffects.join(' / ')}`;
}

export function calculateLifeScore(run: LifeRun, content?: GameContent): number {
  const catalog = content?.marks ?? [];
  const markScore = (run.marks ?? []).reduce((sum, mark) => {
    const nature = catalog.find((item) => item.id === mark.id)?.nature;
    return sum + (nature === 'burden' ? mark.intensity : mark.intensity * 4);
  }, 0);
  const experienceScore = unique(run.tags).length * 5;
  const decisionScore = run.history.filter((entry) => Boolean(entry.choiceId)).length * 4;
  const world = getWorld(run);
  const worldScore = Object.keys(world.facts).length * 2
    + world.relations.filter((relation) => relation.closeness >= 3).length * 4;
  return Math.max(0, Math.floor(run.age * 2 + markScore + experienceScore + decisionScore + worldScore));
}

export function listEligibleEvents(
  run: LifeRun,
  age: number,
  content: GameContent,
): LifeEventConfig[] {
  return content.events.filter((event) => isEventEligible(event, age, run, content));
}

export function getEventSelectionWeight(
  event: LifeEventConfig,
  run: LifeRun,
  content: GameContent,
): number {
  return getEventWeight(event, run, content);
}

function advanceOneYear(run: LifeRun, age: number, content: GameContent): LifeRun {
  const selection = selectEvent(run, age, content);
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
      automaticEffects: {},
      rerolledEventIds: [],
      sourceChoiceId: selection.sourceChoiceId,
      pressureNote: selection.pressureNote,
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
          automaticEffects: {},
          rerolledEventIds: [],
          sourceChoiceId: selection.sourceChoiceId,
          pressureNote: selection.pressureNote,
        },
      },
      selection.event,
      eligibleChoices[0],
      content,
    );
  }

  return settleWorldEvent(
    baseRun,
    selection.event,
    compileWorldChange({
      effects: selection.event.effects,
      addTags: selection.event.addTags,
      world: selection.event.world,
    }),
    {
      text: selection.event.text,
      causedByChoiceId: selection.sourceChoiceId,
      pressureNote: selection.pressureNote,
    },
    selection.event.terminalReason,
    content,
  );
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
  const outcomePick = pickWeighted(choice.outcomes, run.rngState, (outcome) => (
    outcome.weight * markOutcomeMultiplier(run.marks ?? [], outcome, content.marks)
  ));
  const outcome = outcomePick.item;
  const choiceKey = `${event.id}:${choice.id}`;
  const scheduled = createSchedules(run.age, choiceKey, outcome);
  return settleWorldEvent(
    {
      ...run,
      rngState: outcomePick.state,
    },
    event,
    compileOutcomeChange(outcome, pending.automaticEffects),
    {
      text: `${event.text}\n你选择了“${choice.text}”。${outcome.text}`,
      choiceId: choice.id,
      outcomeId: outcome.id,
      causedByChoiceId: pending.sourceChoiceId,
      pressureNote: pending.pressureNote,
      extraSchedules: scheduled,
      clearPending: true,
    },
    outcome.terminalReason ?? event.terminalReason,
    content,
  );
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

  const runWithWorld = { ...run, world: getWorld(run) };
  const pressures = computeWorldPressures(runWithWorld.world, run.stats, age);

  if (due.length > 0) {
    const pick = pickWeighted(due, run.rngState, (item) => (
      getEventWeight(item.event, runWithWorld, content)
    ));
    return {
      event: pick.item.event,
      state: pick.state,
      remainingSchedules: schedules.filter((item) => item !== pick.item.scheduled),
      sourceChoiceId: pick.item.scheduled.sourceChoiceId,
      pressureNote: describePressureNote(
        pick.item.event,
        pressures,
        evaluateCouplingBonus(pick.item.event, runWithWorld, pressures),
      ),
    };
  }

  const eligible = content.events.filter((event) => isEventEligible(event, age, runWithWorld, content));
  if (eligible.length === 0) {
    throw new Error(`No eligible event exists for age ${age}.`);
  }
  const lastEventId = [...run.history].reverse().find((entry) => (
    content.events.some((event) => event.id === entry.eventId)
  ))?.eventId;
  const withoutImmediateRepeat = eligible.filter((event) => event.id !== lastEventId);
  const eventPool = withoutImmediateRepeat.length > 0 ? withoutImmediateRepeat : eligible;
  const eventPick = pickWeighted(eventPool, run.rngState, (event) => (
    getEventWeight(event, runWithWorld, content)
  ));
  return {
    event: eventPick.item,
    state: eventPick.state,
    remainingSchedules: schedules,
    pressureNote: describePressureNote(
      eventPick.item,
      pressures,
      evaluateCouplingBonus(eventPick.item, runWithWorld, pressures),
    ),
  };
}

function getEventWeight(event: LifeEventConfig, run: LifeRun, content: GameContent): number {
  const domains = getEventDomains(event);
  const themes = event.themes ?? domains;
  const focus = getCurrentFocus(run, content);
  const focusMatch = focus?.preferredThemes.some((theme) => themes.includes(theme)) ? 1 : 0;
  const legacyMatches = run.capabilities.eventThemeBoosts.filter((theme) => themes.includes(theme)).length;
  const pressures = computeWorldPressures(getWorld(run), run.stats, run.age);
  const network = getNetworkWeightMultiplier(event, { ...run, world: getWorld(run) }, pressures);
  const coupling = evaluateCouplingBonus(event, { ...run, world: getWorld(run) }, pressures);
  const marks = markEventMultiplier(run.marks ?? [], event, content.marks);
  return Math.max(
    0.05,
    event.weight * (1 + focusMatch * 0.75 + legacyMatches * 0.5) * network * marks + coupling,
  );
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
  const pressures = computeWorldPressures(getWorld(run), run.stats, age);
  return matchesCondition(event.condition, run, content)
    && matchesWorldCondition(event.condition, { ...run, world: getWorld(run) }, pressures);
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
  if (!matchesRequiredMarks(run.marks ?? [], condition.requiredMarks)) {
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

function finishYear(run: LifeRun, explicitEndReason: string | undefined, content: GameContent): LifeRun {
  let nextRun = run;
  let endReason = explicitEndReason;
  let preventableDeath = false;

  if (!endReason && bodyCollapsed(nextRun.marks ?? [])) {
    endReason = '身体没能继续支撑，你走完了这一生。';
    preventableDeath = true;
  }

  if (!endReason) {
    const mortalityStep = nextRandom(nextRun.rngState);
    nextRun = { ...nextRun, rngState: mortalityStep.state };
    if (mortalityStep.value < getMortalityChanceFromMarks(nextRun.age, nextRun.marks ?? [], content.marks)) {
      endReason = nextRun.age < 50
        ? '命运在意料之外收走了这一世。'
        : '岁月与身体一同慢了下来，你走完了这一生。';
      preventableDeath = true;
    }
  }

  if (endReason && preventableDeath && nextRun.fate.deathGuardsRemaining > 0) {
    const spared = applyMarkChanges(nextRun.marks ?? [], [
      { id: 'wear', intensityDelta: -1 },
      { id: 'vitality', intensityDelta: 1 },
    ], content.marks);
    return {
      ...nextRun,
      marks: spared.marks,
      stats: statsFromMarks(spared.marks),
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
      if (!matchesRequiredMarks(run.marks ?? [], candidate.requiredMarks)) {
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

function settleWorldEvent(
  run: LifeRun,
  event: LifeEventConfig,
  compiled: WorldChange,
  details: {
    text: string;
    choiceId?: string;
    outcomeId?: string;
    causedByChoiceId?: string;
    pressureNote?: string;
    extraSchedules?: ScheduledLifeEvent[];
    clearPending?: boolean;
  },
  terminalReason: string | undefined,
  content: GameContent,
): LifeRun {
  const meaningful = Boolean(event.once || event.choices);
  const inferred = inferMarkChanges(compiled.stats ?? {}, meaningful);
  let markChanges = [...agingMarkChanges(run.age), ...(compiled.marks ?? []), ...inferred];
  let shielded = false;
  let fate = run.fate;
  const hasBurden = markChanges.some((change) => (
    (change.intensityDelta ?? 0) > 0
    && content.marks.find((item) => item.id === change.id)?.nature === 'burden'
  ));
  if (hasBurden && fate.negativeShieldsRemaining > 0) {
    markChanges = mitigateBurdenChanges(markChanges, content.marks);
    fate = { ...fate, negativeShieldsRemaining: fate.negativeShieldsRemaining - 1 };
    shielded = true;
  }
  const appliedMarks = applyMarkChanges(run.marks ?? [], markChanges, content.marks);
  const nextStats = statsFromMarks(appliedMarks.marks);
  const change: WorldChange = { ...compiled, stats: compiled.stats ?? {} };
  const applied = applyWorldChange(getWorld(run), change, run.age);
  const rippled = rippleWorld(applied.world, change, compiled.stats ?? {}, run.age);
  const ticked = tickLifeWorld(rippled.world, nextStats, run.age);
  const fragments = unique([...applied.fragments, ...rippled.fragments]);
  const nextRun: LifeRun = {
    ...run,
    turnState: details.clearPending ? 'ready' : run.turnState,
    pendingDecision: details.clearPending ? undefined : run.pendingDecision,
    stats: nextStats,
    tags: unique([...run.tags, ...applied.tags]),
    marks: appliedMarks.marks,
    world: ticked,
    fate,
    scheduledEvents: [...run.scheduledEvents, ...(details.extraSchedules ?? [])],
    history: [
      ...run.history,
      {
        age: run.age,
        eventId: event.id,
        text: shielded ? `${details.text} 下世微光替你减轻了损失。` : details.text,
        effects: emptyStats(),
        tagsAdded: [...applied.tags],
        choiceId: details.choiceId,
        outcomeId: details.outcomeId,
        causedByChoiceId: details.causedByChoiceId,
        worldChanges: fragments,
        markChanges: appliedMarks.fragments,
        touchedDomains: getEventDomains(event),
        pressureNote: details.pressureNote,
      },
    ],
  };
  return finishYear(nextRun, terminalReason, content);
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

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
