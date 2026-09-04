import {
  ActiveScenario,
  EventChoiceConfig,
  GameContent,
  HistoryFigure,
  LifeRun,
  ScenarioAction,
  ScenarioConfig,
  ScenarioReport,
  WorldChange,
} from './model';
import { applyMarkChanges, statsFromMarks } from './lifeMarks';
import { applyWorldChange, getWorld } from './lifeWorld';
import { pickWeighted } from './random';

export function getFigure(run: LifeRun, content: GameContent): HistoryFigure | undefined {
  if (!run.figureId) {
    return undefined;
  }
  return content.figures.find((item) => item.id === run.figureId);
}

export function listAvailablePaths(run: LifeRun, content: GameContent): ScenarioConfig[] {
  const figure = getFigure(run, content);
  if (figure) {
    const chapter = figure.chapters[run.chapterIndex];
    if (!chapter) {
      return [];
    }
    const scenario = content.scenarios.find((item) => item.id === chapter.scenarioId);
    return scenario ? [{ ...scenario, title: chapter.title, summary: chapter.intro }] : [];
  }

  const remaining = content.scenarios.filter((scenario) => {
    if (scenario.modes && !scenario.modes.includes('free') && run.playMode !== 'history') {
      return false;
    }
    if (run.completedScenarioIds.includes(scenario.id) && scenario.id !== 'commerce' && scenario.id !== 'journey') {
      return false;
    }
    if (run.age < scenario.minAge || run.age > scenario.maxAge) {
      return false;
    }
    if (scenario.id === 'childhood' && run.completedScenarioIds.includes('childhood')) {
      return false;
    }
    if (scenario.id === 'dusk' && run.age < 50) {
      return false;
    }
    return true;
  });

  if (!run.completedScenarioIds.includes('childhood') && run.age <= 12) {
    const childhood = remaining.find((item) => item.id === 'childhood');
    return childhood ? [childhood] : remaining.slice(0, 3);
  }

  const ranked = [...remaining].sort((left, right) => pathWeight(right, run) - pathWeight(left, run));
  return ranked.slice(0, 3);
}

export function choosePath(run: LifeRun, scenarioId: string, content: GameContent): LifeRun {
  if (run.status !== 'active' || (run.turnState !== 'awaiting-path' && run.turnState !== 'awaiting-focus' && run.turnState !== 'ready')) {
    throw new Error('This life is not waiting for a path.');
  }
  const paths = listAvailablePaths(run, content);
  const scenario = paths.find((item) => item.id === scenarioId) ?? content.scenarios.find((item) => item.id === scenarioId);
  if (!scenario) {
    throw new Error(`Path ${scenarioId} is not available.`);
  }
  const figure = getFigure(run, content);
  const chapter = figure?.chapters[run.chapterIndex];
  const title = chapter?.title ?? scenario.title;
  const years = chapter?.years ?? scenario.years;
  const intro = chapter?.intro ?? scenario.summary;
  const active: ActiveScenario = {
    scenarioId: scenario.id,
    title,
    kind: scenario.kind,
    icon: scenario.icon,
    turn: 0,
    maxTurns: scenario.turns,
    years,
    resources: { ...scenario.startResources },
    resourceLabels: { ...scenario.resourceLabels },
    log: [intro],
    actionIds: scenario.actions.map((item) => item.id),
    startedAtAge: run.age,
  };
  return beginScenarioTurn({
    ...run,
    currentScenario: active,
    scenarioReport: undefined,
    pendingDecision: undefined,
    history: [
      ...run.history,
      {
        age: run.age,
        eventId: `path:${scenario.id}`,
        text: `你走进「${title}」。${intro}`,
        effects: {},
        tagsAdded: [],
      },
    ],
  }, content);
}

export function resolveScenarioAction(run: LifeRun, actionId: string, content: GameContent): LifeRun {
  if (run.status !== 'active' || run.turnState !== 'in-scenario' || !run.currentScenario) {
    throw new Error('This life is not waiting for a scenario action.');
  }
  const scenario = getScenarioConfig(run, content);
  const action = scenario.actions.find((item) => item.id === actionId);
  if (!action || !run.currentScenario.actionIds.includes(actionId)) {
    throw new Error(`Action ${actionId} is not available.`);
  }
  if (!canAfford(run.currentScenario.resources, action.cost)) {
    throw new Error('Not enough resources for this action.');
  }
  const pick = pickWeighted(action.outcomes, run.rngState, (outcome) => outcome.weight);
  const paid = spend(run.currentScenario.resources, action.cost);
  const gained = applyResourceDelta(paid, pick.item.resources);
  let nextRun: LifeRun = {
    ...run,
    rngState: pick.state,
    currentScenario: {
      ...run.currentScenario,
      resources: gained,
      log: [...run.currentScenario.log, pick.item.text].slice(-8),
      turn: run.currentScenario.turn + 1,
      beatId: undefined,
      beatText: undefined,
    },
    tags: unique([...run.tags, ...(pick.item.addTags ?? [])]),
  };
  nextRun = applyScenarioWorld(nextRun, pick.item.world, content);
  nextRun = {
    ...nextRun,
    history: [
      ...nextRun.history,
      {
        age: nextRun.age,
        eventId: `${scenario.id}:${action.id}`,
        text: `在「${run.currentScenario.title}」里，你选择了“${action.title}”。${pick.item.text}`,
        effects: {},
        tagsAdded: [...(pick.item.addTags ?? [])],
        choiceId: action.id,
        outcomeId: pick.item.id,
        worldChanges: [],
        markChanges: [],
      },
    ],
  };
  return finishScenarioTurn(nextRun, content);
}

export function progressScenarioAfterBeat(run: LifeRun, content: GameContent): LifeRun {
  if (!run.currentScenario) {
    return run;
  }
  const advanced: LifeRun = {
    ...run,
    currentScenario: {
      ...run.currentScenario,
      turn: run.currentScenario.turn + 1,
      beatId: undefined,
      beatText: undefined,
      log: run.currentScenario.beatText
        ? [...run.currentScenario.log, run.currentScenario.beatText].slice(-8)
        : run.currentScenario.log,
    },
    pendingDecision: undefined,
    turnState: 'in-scenario',
  };
  return finishScenarioTurn(advanced, content);
}

export function continueAfterSummary(run: LifeRun, content: GameContent): LifeRun {
  if (run.status !== 'active' || run.turnState !== 'scenario-summary') {
    throw new Error('This life is not waiting to leave a scenario.');
  }
  const figure = getFigure(run, content);
  const nextChapter = (run.chapterIndex + 1);
  const historyDone = Boolean(figure && nextChapter >= figure.chapters.length);
  const duskDone = run.completedScenarioIds.includes('dusk');
  const nextRun: LifeRun = {
    ...run,
    turnState: 'awaiting-path',
    currentScenario: undefined,
    scenarioReport: undefined,
    chapterIndex: figure ? nextChapter : run.chapterIndex,
    currentStageId: stageIdForAge(run.age, content),
  };
  if (historyDone || duskDone || run.age >= 92 || listAvailablePaths(nextRun, content).length === 0) {
    return {
      ...nextRun,
      turnState: 'ready',
      status: 'ended',
      endReason: historyDone
        ? '这条被走过的路，在这一世走到了尽头。'
        : duskDone || run.age >= 92
          ? '余年也已过完，你把这一世轻轻放下。'
          : '可走的路都走完了，这一世到此为止。',
    };
  }
  return nextRun;
}

export function formatScenarioResources(scenario: ActiveScenario): string {
  return Object.entries(scenario.resourceLabels).map(([key, label]) => (
    `${label} ${scenario.resources[key] ?? 0}`
  )).join('　');
}

export function getScenarioConfig(run: LifeRun, content: GameContent): ScenarioConfig {
  const id = run.currentScenario?.scenarioId;
  const scenario = content.scenarios.find((item) => item.id === id);
  if (!scenario) {
    throw new Error('There is no active scenario.');
  }
  return scenario;
}

export function eligibleScenarioActions(run: LifeRun, content: GameContent): ScenarioAction[] {
  if (!run.currentScenario) {
    return [];
  }
  const scenario = getScenarioConfig(run, content);
  return scenario.actions.filter((action) => (
    run.currentScenario?.actionIds.includes(action.id)
    && canAfford(run.currentScenario.resources, action.cost)
  ));
}

function beginScenarioTurn(run: LifeRun, content: GameContent): LifeRun {
  if (!run.currentScenario) {
    return run;
  }
  const scenario = getScenarioConfig(run, content);
  const usedBeats = new Set(run.history.map((entry) => entry.eventId));
  const beats = scenario.beats.filter((beat) => {
    if (beat.once && usedBeats.has(`${scenario.id}:beat:${beat.id}`)) {
      return false;
    }
    return true;
  });
  if (beats.length === 0) {
    return {
      ...run,
      turnState: 'in-scenario',
      currentScenario: {
        ...run.currentScenario,
        actionIds: eligibleScenarioActions(run, content).map((item) => item.id),
      },
    };
  }
  const pick = pickWeighted(beats, run.rngState, (beat) => beat.weight);
  const beat = pick.item;
  const choices = (beat.choices ?? []).filter((choice) => actionAllowed(choice, run));
  let nextRun: LifeRun = {
    ...run,
    rngState: pick.state,
    currentScenario: {
      ...run.currentScenario,
      beatId: beat.id,
      beatText: beat.text,
      resources: applyResourceDelta(run.currentScenario.resources, beat.resources),
      log: [...run.currentScenario.log, beat.text].slice(-8),
    },
    tags: unique([...run.tags, ...(beat.addTags ?? [])]),
  };
  nextRun = applyScenarioWorld(nextRun, beat.world, content);
  if (choices.length >= 2) {
    return {
      ...nextRun,
      turnState: 'awaiting-choice',
      pendingDecision: {
        age: nextRun.age,
        eventId: `${scenario.id}:beat:${beat.id}`,
        choiceIds: choices.map((item) => item.id),
        automaticEffects: {},
        rerolledEventIds: [],
      },
    };
  }
  return {
    ...nextRun,
    turnState: 'in-scenario',
    currentScenario: {
      ...nextRun.currentScenario!,
      actionIds: scenario.actions.filter((action) => (
        canAfford(nextRun.currentScenario!.resources, action.cost)
      )).map((item) => item.id),
    },
  };
}

function finishScenarioTurn(run: LifeRun, content: GameContent): LifeRun {
  const active = run.currentScenario;
  if (!active) {
    return run;
  }
  if (active.turn >= active.maxTurns) {
    return completeScenario(run, content);
  }
  return beginScenarioTurn(run, content);
}

function completeScenario(run: LifeRun, content: GameContent): LifeRun {
  const active = run.currentScenario;
  if (!active) {
    return run;
  }
  const ageAfter = Math.min(100, run.age + active.years);
  const converted = convertResourcesToMarks(run, active, content);
  const lines = [
    `这一程走了约 ${active.years} 年。`,
    ...active.log.slice(-3),
    ...converted.fragments,
  ];
  const report: ScenarioReport = {
    title: active.title,
    years: active.years,
    ageAfter,
    lines,
  };
  return {
    ...converted.run,
    age: ageAfter,
    turnState: 'scenario-summary',
    pendingDecision: undefined,
    completedScenarioIds: unique([...run.completedScenarioIds, active.scenarioId]),
    currentStageId: stageIdForAge(ageAfter, content),
    scenarioReport: report,
    currentScenario: {
      ...active,
      beatText: undefined,
      actionIds: [],
    },
    history: [
      ...converted.run.history,
      {
        age: ageAfter,
        eventId: `summary:${active.scenarioId}`,
        text: `「${active.title}」告一段落。${lines.join(' ')}`,
        effects: {},
        tagsAdded: [`scene:${active.scenarioId}`],
        markChanges: converted.fragments,
      },
    ],
    tags: unique([...converted.run.tags, `scene:${active.scenarioId}`]),
  };
}

function convertResourcesToMarks(
  run: LifeRun,
  active: ActiveScenario,
  content: GameContent,
): { run: LifeRun; fragments: string[] } {
  const changes = [];
  if ((active.resources.mastery ?? 0) >= 4) {
    changes.push({ id: 'clarity', intensityDelta: 1 });
  }
  if ((active.resources.purse ?? 0) >= 5) {
    changes.push({ id: 'means', intensityDelta: 1 });
  }
  if ((active.resources.skill ?? 0) >= 4) {
    changes.push({ id: 'tools', intensityDelta: 1 });
  }
  if ((active.resources.toil ?? 0) >= 3 || (active.resources.stamina ?? 1) <= 0) {
    changes.push({ id: 'wear', intensityDelta: 1 });
  }
  if ((active.resources.warmth ?? 0) >= 4) {
    changes.push({ id: 'presence', intensityDelta: 1 });
  }
  const applied = applyMarkChanges(run.marks ?? [], changes, content.marks);
  return {
    run: {
      ...run,
      marks: applied.marks,
      stats: statsFromMarks(applied.marks),
    },
    fragments: applied.fragments,
  };
}

function applyScenarioWorld(
  run: LifeRun,
  worldChange: WorldChange | undefined,
  content: GameContent,
): LifeRun {
  if (!worldChange) {
    return run;
  }
  const applied = applyWorldChange(getWorld(run), worldChange, run.age);
  const marks = applyMarkChanges(run.marks ?? [], worldChange.marks ?? [], content.marks);
  return {
    ...run,
    world: applied.world,
    marks: marks.marks,
    stats: statsFromMarks(marks.marks),
    tags: unique([...run.tags, ...applied.tags]),
  };
}

function pathWeight(scenario: ScenarioConfig, run: LifeRun): number {
  let score = 1;
  if (scenario.kind === 'studies' && run.tags.includes('loves_stories')) {
    score += 2;
  }
  if (scenario.kind === 'commerce' && (run.marks ?? []).some((mark) => mark.id === 'means' || mark.id === 'lucky')) {
    score += 2;
  }
  if (scenario.kind === 'craft' && run.tags.includes('has_craft')) {
    score += 2;
  }
  if (scenario.kind === 'hearth' && run.tags.includes('has_loved')) {
    score += 2;
  }
  if (scenario.kind === 'journey' && run.world.facts.residence?.value === 'hometown') {
    score += 1;
  }
  return score;
}

function canAfford(resources: Record<string, number>, cost?: Record<string, number>): boolean {
  if (!cost) {
    return true;
  }
  return Object.entries(cost).every(([key, value]) => (resources[key] ?? 0) >= value);
}

function spend(resources: Record<string, number>, cost?: Record<string, number>): Record<string, number> {
  return applyResourceDelta(resources, negate(cost));
}

function applyResourceDelta(
  resources: Record<string, number>,
  delta?: Record<string, number>,
): Record<string, number> {
  if (!delta) {
    return { ...resources };
  }
  const next = { ...resources };
  for (const [key, value] of Object.entries(delta)) {
    next[key] = (next[key] ?? 0) + value;
  }
  return next;
}

function negate(cost?: Record<string, number>): Record<string, number> | undefined {
  if (!cost) {
    return undefined;
  }
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(cost)) {
    next[key] = -value;
  }
  return next;
}

function actionAllowed(_choice: EventChoiceConfig, _run: LifeRun): boolean {
  return true;
}

function stageIdForAge(age: number, content: GameContent): string {
  const stage = content.stages.find((item) => age >= item.minAge && age <= item.maxAge);
  return stage?.id ?? content.stages[content.stages.length - 1]?.id ?? 'childhood';
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
