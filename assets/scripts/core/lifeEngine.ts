import {
  ArchiveDiscovery,
  BREAK_HABIT_COST,
  BoundPerson,
  CausalityRecord,
  CostKind,
  EncounterChoiceConfig,
  EncounterOutcomeConfig,
  EncounterTemplate,
  ExperienceFragment,
  GameContent,
  LIFE_POINT_CAP,
  LIFE_POINT_RECALL_GAIN,
  LIFE_POINT_START,
  LIFE_THEMES,
  LifeClosing,
  LifeRun,
  LifeTheme,
  MAX_CARRIED_UNDERSTANDINGS,
  MAX_ENCOUNTERS,
  MAX_RECALLS_PER_LIFE,
  MIN_ENCOUNTERS,
  PURSUE_OPPORTUNITY_COST,
  PendingEncounter,
  PendingOption,
  PendingRecall,
  PersonBinding,
  RECALL_AFTER_COUNTS,
  RULES_VERSION,
  ReincarnatorProfile,
  RecallStance,
  ScheduledEncounter,
  SupportRule,
  Understanding,
  UnderstandingSeed,
  createInitialProfile,
  themeLabel,
} from './model';
import { applyMarkChanges, createStartingMarks } from './lifeMarks';
import {
  applyWorldChange,
  computeWorldPressures,
  formatWorldSummary,
  matchesWorldCondition,
  rippleWorld,
  tickLifeWorld,
  createBirthWorld,
} from './lifeWorld';
import { normalizeSeed, pickWeighted, sampleUnique } from './random';

export { formatWorldSummary } from './lifeWorld';
export { formatMarkList } from './lifeMarks';
export { createInitialProfile };

const THEME_DOMAINS: Record<LifeTheme, Array<'relationship' | 'family' | 'travel' | 'career' | 'craft'>> = {
  trust: ['relationship', 'family'],
  belonging: ['travel', 'family'],
  worth: ['career', 'craft', 'family'],
};

export function startLife(
  profile: ReincarnatorProfile,
  seed: number,
  runId: string,
  carriedUnderstandingIds: string[],
  content: GameContent,
): LifeRun {
  const carryIds = unique(carriedUnderstandingIds).slice(0, MAX_CARRIED_UNDERSTANDINGS);
  for (const id of carryIds) {
    if (!profile.understandings.some((item) => item.id === id)) {
      throw new Error('只能携带档案里真实存在的理解。');
    }
  }

  const rng = normalizeSeed(seed);
  const familyPick = pickWeighted(content.families, rng, (family) => family.weight);
  const temperamentPick = pickWeighted(content.temperaments, familyPick.state, () => 1);
  const remainingThemes = LIFE_THEMES.filter(() => true);
  const lines = sampleUnique(remainingThemes, 2, temperamentPick.state);
  const lineA = lines.items[0];
  const lineB = lines.items[1];

  const family = familyPick.item;
  const temperament = temperamentPick.item;
  const marks = createStartingMarks(family, temperament, content.marks);
  const world = createBirthWorld(family, temperament);
  const carriedUnderstandings = carryIds.map((id) => (
    profile.understandings.find((entry) => entry.id === id) as Understanding
  ));
  const carriedFragments = profile.fragments.filter((fragment) => (
    carriedUnderstandings.some((item) => item.sourceFragmentIds.includes(fragment.id))
  ));
  const carryTags = carriedUnderstandings.map((item) => `carried:${item.contentKey}`);

  const base: LifeRun = {
    id: runId,
    seed: normalizeSeed(seed),
    rngState: lines.state,
    rulesVersion: RULES_VERSION,
    status: 'active',
    turnState: 'awaiting-response',
    age: 8,
    familyId: family.id,
    temperamentId: temperament.id,
    tags: unique([...(family.tags ?? []), ...(temperament.tags ?? []), ...carryTags]),
    marks: marks.marks,
    world,
    lifePoints: LIFE_POINT_START,
    lifePointCap: LIFE_POINT_CAP,
    lifePointLog: [{
      age: 8,
      reason: 'start',
      amount: LIFE_POINT_START,
      balance: LIFE_POINT_START,
      note: '这一世开始时的余地',
    }],
    encounterCount: 0,
    recallCount: 0,
    nextEncounterSeq: 1,
    nextFragmentSeq: 1,
    nextUnderstandingSeq: 1,
    lineA,
    lineB,
    usedTemplateIds: [],
    resolvedEncounterIds: [],
    resolvedRecallIds: [],
    fragments: carriedFragments.map((item) => ({ ...item })),
    understandings: carriedUnderstandings.map((item) => ({ ...item })),
    carriedUnderstandingIds: carryIds,
    scheduled: [],
    skippedYearNotes: [],
  };

  return generateNextEncounter(base, content, 'family');
}

export function submitResponse(
  run: LifeRun,
  encounterInstanceId: string,
  choiceId: string,
  content: GameContent,
): LifeRun {
  if (run.status !== 'active') {
    return run;
  }
  if (run.resolvedEncounterIds.includes(encounterInstanceId)) {
    return run;
  }
  const pending = run.pendingEncounter;
  if (!pending || pending.instanceId !== encounterInstanceId || run.turnState !== 'awaiting-response') {
    throw new Error('当前没有这一次遭遇。');
  }
  const option = pending.options.find((item) => item.choiceId === choiceId);
  if (!option) {
    throw new Error('这个回应不属于当前遭遇。');
  }
  if (!option.enabled) {
    throw new Error(option.disabledReason ?? '这个回应现在不能选。');
  }
  if (option.cost > run.lifePoints) {
    throw new Error('人生点不够，不能这样回应。');
  }

  const template = requireTemplate(pending.templateId, content);
  const choice = template.choices.find((item) => item.id === choiceId);
  if (!choice) {
    throw new Error('未知的回应。');
  }

  let rngState = pending.rngState;
  const outcomePick = pickWeighted(choice.outcomes, rngState, (item) => Math.max(0, item.weight));
  rngState = outcomePick.state;
  const outcome = outcomePick.item;

  const applied = applyWorldChange(run.world, outcome.world, pending.age);
  const rippled = rippleWorld(applied.world, outcome.world, pending.age);
  const markApplied = applyMarkChanges(run.marks, outcome.world.marks ?? [], content.marks);
  const points = run.lifePoints - option.cost;
  const fragmentId = `${run.id}-frag-${run.nextFragmentSeq}`;
  const understanding = latestUnderstanding(run);
  const fragment: ExperienceFragment = {
    id: fragmentId,
    contentKey: `frag:${template.id}:${choice.id}`,
    runId: run.id,
    age: pending.age,
    encounterInstanceId: pending.instanceId,
    templateId: template.id,
    theme: template.theme,
    people: pending.boundPeople,
    whatHappened: interpolate(template.text, pending.boundPeople),
    howIResponded: `${option.text} ${outcome.text}`.trim(),
    choiceId: choice.id,
    outcomeId: outcome.id,
    costPaid: option.cost,
    fragmentTags: [...choice.fragmentTags],
    recalledFragmentIds: [...pending.recalledFragmentIds],
    understandingAtTime: understanding?.statement,
    understandingId: understanding?.id,
    laterWhat: outcome.later ? [outcome.later] : [],
    triggerKind: pending.triggerKind,
    triggerNote: pending.triggerNote,
    triggerSourceIds: [...pending.triggerSourceIds],
    worldChanges: unique([...applied.fragments, ...rippled.fragments, ...markApplied.fragments]),
  };

  const scheduled = [
    ...run.scheduled,
    ...buildSchedules(outcome, pending.instanceId, fragmentId, pending.age),
  ];
  const linked = linkLaterWhat(run.fragments, pending.triggerSourceIds, outcome.later);

  let next: LifeRun = {
    ...run,
    rngState,
    age: pending.age,
    world: rippled.world,
    marks: markApplied.marks,
    tags: unique([...run.tags, ...applied.tags, ...choice.fragmentTags]),
    lifePoints: points,
    lifePointLog: option.cost > 0
      ? [...run.lifePointLog, {
          age: pending.age,
          reason: 'spend',
          amount: -option.cost,
          balance: points,
          encounterInstanceId: pending.instanceId,
          note: option.supportReason ?? (option.costKind === 'pursue-opportunity' ? '主动争取' : '突破惯常反应'),
        }]
      : run.lifePointLog,
    encounterCount: run.encounterCount + 1,
    nextFragmentSeq: run.nextFragmentSeq + 1,
    usedTemplateIds: unique([...run.usedTemplateIds, template.id]),
    resolvedEncounterIds: [...run.resolvedEncounterIds, pending.instanceId],
    fragments: [...linked, fragment],
    scheduled,
    pendingEncounter: undefined,
  };

  if (shouldRecall(next)) {
    return generateRecall(next, content);
  }
  if (shouldClose(next, content)) {
    return closeLife(next, content);
  }
  return generateNextEncounter(next, content);
}

export function submitRecall(
  run: LifeRun,
  recallInstanceId: string,
  stance: RecallStance,
  content: GameContent,
): LifeRun {
  if (run.status !== 'active') {
    return run;
  }
  if (run.resolvedRecallIds.includes(recallInstanceId)) {
    return run;
  }
  const pending = run.pendingRecall;
  if (!pending || pending.instanceId !== recallInstanceId || run.turnState !== 'awaiting-recall') {
    throw new Error('当前没有这一次回望。');
  }
  const option = pending.options.find((item) => item.stance === stance);
  if (!option) {
    throw new Error('回望只能选择坚持、修正或存疑。');
  }

  const seed = content.understandingSeeds.find((item) => item.id === pending.seedId);
  if (!seed) {
    throw new Error('回望缺少可依据的理解。');
  }
  const previous = pending.existingUnderstandingId
    ? run.understandings.find((item) => item.id === pending.existingUnderstandingId)
    : undefined;
  const understandingId = `${run.id}-und-${run.nextUnderstandingSeq}-v${(previous?.version ?? 0) + 1}`;
  const created: Understanding = {
    id: understandingId,
    contentKey: seed.id,
    theme: seed.theme,
    statement: option.statement,
    stance,
    version: (previous?.version ?? 0) + 1,
    previousVersionId: previous?.id,
    sourceFragmentIds: [...pending.fragmentIds],
    createdInRunId: run.id,
    createdAtAge: run.age,
  };
  const points = Math.min(LIFE_POINT_CAP, run.lifePoints + LIFE_POINT_RECALL_GAIN);
  const taggedFragments = run.fragments.map((fragment) => (
    pending.fragmentIds.includes(fragment.id)
      ? { ...fragment, understandingAtTime: fragment.understandingAtTime ?? option.statement, understandingId: fragment.understandingId ?? understandingId }
      : fragment
  ));

  let next: LifeRun = {
    ...run,
    lifePoints: points,
    lifePointLog: [...run.lifePointLog, {
      age: run.age,
      reason: 'recall',
      amount: points - run.lifePoints,
      balance: points,
      note: '回望后多出的余地',
    }],
    recallCount: run.recallCount + 1,
    nextUnderstandingSeq: run.nextUnderstandingSeq + 1,
    resolvedRecallIds: [...run.resolvedRecallIds, pending.instanceId],
    understandings: replaceUnderstanding(run.understandings, created, previous?.id),
    fragments: taggedFragments,
    pendingRecall: undefined,
    turnState: 'awaiting-response',
    tags: unique([...run.tags, `understood:${seed.id}:${stance}`]),
  };

  if (shouldClose(next, content)) {
    return closeLife(next, content);
  }
  return generateNextEncounter(next, content);
}

export function completeArchive(
  profile: ReincarnatorProfile,
  run: LifeRun,
): { profile: ReincarnatorProfile; run: LifeRun } {
  if (run.status === 'settled' && profile.archivedRunIds.includes(run.id)) {
    return { profile, run };
  }
  if (run.status !== 'awaiting-archive' && run.status !== 'settled') {
    throw new Error('这一世还不能收入档案。');
  }
  if (profile.archivedRunIds.includes(run.id)) {
    return {
      profile,
      run: { ...run, status: 'settled', turnState: 'settled' },
    };
  }

  const discoveries = mergeDiscoveries(profile.discoveries, run);
  const settled: LifeRun = {
    ...run,
    status: 'settled',
    turnState: 'settled',
    pendingEncounter: undefined,
    pendingRecall: undefined,
  };
  return {
    profile: {
      ...profile,
      archivedRunIds: [...profile.archivedRunIds, run.id],
      discoveries,
      understandings: [...profile.understandings, ...run.understandings.filter((item) => (
        !profile.understandings.some((existing) => existing.id === item.id)
      ))],
      fragments: [...profile.fragments, ...run.fragments],
      lastClosing: run.closing,
      lastRunId: run.id,
    },
    run: settled,
  };
}

export function getCausality(
  run: LifeRun | null,
  profile: ReincarnatorProfile,
  id: string,
): CausalityRecord | null {
  const fragments = [...(run?.fragments ?? []), ...profile.fragments];
  const understandings = [...(run?.understandings ?? []), ...profile.understandings];
  const fragment = fragments.find((item) => item.id === id || item.encounterInstanceId === id);
  if (fragment) {
    const evoked = fragment.recalledFragmentIds.map((sourceId) => {
      const source = fragments.find((item) => item.id === sourceId);
      return {
        id: sourceId,
        note: source ? `${source.age} 岁：${source.howIResponded}` : '一段已经记下的往事',
      };
    });
    return {
      id: fragment.id,
      kind: 'fragment',
      title: `${fragment.age} 岁的经历`,
      happened: fragment.whatHappened,
      response: fragment.howIResponded,
      understood: fragment.understandingAtTime,
      later: fragment.laterWhat,
      people: fragment.people.map((person) => ({ id: person.relationId, label: person.label })),
      trigger: { kind: fragment.triggerKind, note: fragment.triggerNote },
      evoked,
      sources: [
        ...fragment.triggerSourceIds.map((sourceId) => ({ id: sourceId, relation: '这件事为什么发生' })),
        ...fragment.recalledFragmentIds.map((sourceId) => ({ id: sourceId, relation: '它为什么让我想起过去' })),
      ],
    };
  }
  const understanding = understandings.find((item) => item.id === id);
  if (understanding) {
    return {
      id: understanding.id,
      kind: 'understanding',
      title: '对往事的理解',
      happened: understanding.statement,
      understood: understanding.statement,
      later: [],
      people: [],
      trigger: { kind: 'recall', note: '回望时形成' },
      evoked: understanding.sourceFragmentIds.map((sourceId) => ({ id: sourceId, note: '作为证据的经历' })),
      sources: [
        ...understanding.sourceFragmentIds.map((sourceId) => ({ id: sourceId, relation: '证据' })),
        ...(understanding.previousVersionId
          ? [{ id: understanding.previousVersionId, relation: '此前的理解' }]
          : []),
      ],
    };
  }
  return null;
}

export function listCarryCandidates(profile: ReincarnatorProfile): Understanding[] {
  const latestByKey = new Map<string, Understanding>();
  for (const item of profile.understandings) {
    const current = latestByKey.get(item.contentKey);
    if (!current || item.version > current.version) {
      latestByKey.set(item.contentKey, item);
    }
  }
  return [...latestByKey.values()];
}

export function causalityHasCycle(
  run: LifeRun | null,
  profile: ReincarnatorProfile,
): boolean {
  const records = [
    ...(run?.fragments ?? []),
    ...profile.fragments,
  ];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const walk = (id: string): boolean => {
    if (visiting.has(id)) {
      return true;
    }
    if (visited.has(id)) {
      return false;
    }
    visiting.add(id);
    const fragment = records.find((item) => item.id === id);
    const nextIds = fragment
      ? [...fragment.triggerSourceIds, ...fragment.recalledFragmentIds]
      : [];
    for (const next of nextIds) {
      if (walk(next)) {
        return true;
      }
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return records.some((item) => walk(item.id));
}

function generateNextEncounter(
  run: LifeRun,
  content: GameContent,
  openingTrigger?: PendingEncounter['triggerKind'],
): LifeRun {
  let age = run.age;
  let world = run.world;
  let rngState = run.rngState;
  const notes = [...run.skippedYearNotes];
  const maxSkip = 14;

  for (let step = 0; step < maxSkip; step += 1) {
    const due = dueSchedules(run, age, content);
    const candidates = due.length > 0
      ? due.map((item) => requireTemplate(item.templateId, content))
      : eligibleTemplates(run, content, age);

    if (candidates.length > 0 && (due.length > 0 || run.encounterCount === 0 || step >= 3)) {
      const picked = pickWeighted(candidates, rngState, (item) => Math.max(1, item.weight));
      rngState = picked.state;
      const dueMatch = due.find((item) => item.templateId === picked.item.id);
      return freezeEncounter(run, picked.item, content, {
        age,
        world,
        rngState,
        notes,
        triggerKind: dueMatch
          ? 'consequence'
          : (openingTrigger ?? (isConflict(run, age) ? 'thread-conflict' : 'chance')),
        triggerNote: dueMatch?.note ?? picked.item.triggerNote,
        triggerSourceIds: dueMatch ? [dueMatch.sourceFragmentId] : [],
      });
    }

    age += 1;
    world = tickLifeWorld(world, age);
    if (age % 4 === 0) {
      notes.push(`${age} 岁：寻常年月过去了，关系和处境仍在自己变化。`);
    }
    if (age >= 82 && run.encounterCount >= MIN_ENCOUNTERS) {
      return closeLife({ ...run, age, world, rngState, skippedYearNotes: notes }, content);
    }
  }

  const relaxed = eligibleTemplates(run, content, age, true);
  if (relaxed.length > 0) {
    const picked = pickWeighted(relaxed, rngState, (item) => Math.max(1, item.weight));
    return freezeEncounter(run, picked.item, content, {
      age,
      world,
      rngState: picked.state,
      notes,
      triggerKind: 'era',
      triggerNote: '人生走到这里，这件事仍等着你回应。',
      triggerSourceIds: [],
    });
  }
  if (run.encounterCount >= MIN_ENCOUNTERS) {
    return closeLife({ ...run, age, world, rngState, skippedYearNotes: notes }, content);
  }
  throw new Error('这一世没有可继续的关键遭遇。');
}

function freezeEncounter(
  run: LifeRun,
  template: EncounterTemplate,
  content: GameContent,
  context: {
    age: number;
    world: LifeRun['world'];
    rngState: number;
    notes: string[];
    triggerKind: PendingEncounter['triggerKind'];
    triggerNote: string;
    triggerSourceIds: string[];
  },
): LifeRun {
  const bound = bindPeople({ ...run, world: context.world, age: context.age }, template.people);
  const recalled = recallFragments(run, template, bound.people);
  const options = freezeOptions(
    { ...run, world: bound.world, age: context.age },
    template,
    recalled.ids,
    content,
  );
  if (options.filter((item) => item.cost === 0).length < 2) {
    throw new Error(`Encounter ${template.id} needs at least two free options after filtering.`);
  }
  const instanceId = `${run.id}-enc-${run.nextEncounterSeq}`;
  const pending: PendingEncounter = {
    instanceId,
    templateId: template.id,
    age: context.age,
    text: interpolate(template.text, bound.people),
    title: template.title,
    sceneKind: template.sceneKind,
    theme: template.theme,
    triggerKind: context.triggerKind,
    triggerNote: interpolate(context.triggerNote, bound.people),
    triggerSourceIds: context.triggerSourceIds,
    boundPeople: bound.people,
    recalledFragmentIds: recalled.ids,
    recalledNotes: recalled.notes,
    options,
    rngState: context.rngState,
  };
  return {
    ...run,
    rngState: context.rngState,
    age: context.age,
    world: bound.world,
    skippedYearNotes: context.notes,
    nextEncounterSeq: run.nextEncounterSeq + 1,
    turnState: 'awaiting-response',
    pendingEncounter: pending,
    pendingRecall: undefined,
  };
}

function freezeOptions(
  run: LifeRun,
  template: EncounterTemplate,
  recalledIds: string[],
  content: GameContent,
): PendingOption[] {
  const pressures = computeWorldPressures(run.world, run.age);
  const visible: PendingOption[] = [];
  for (const choice of template.choices) {
    if (!matchesWorldCondition(choice.condition, run, pressures)) {
      continue;
    }
    const support = evaluateSupport(choice.support, run, recalledIds, content);
    if (choice.support?.ifUnsupported === 'hide' && !support.supported) {
      continue;
    }
    let costKind: CostKind = choice.costKind;
    let cost = costOf(choice.costKind);
    let supportReason = choice.supportReason;
    if (choice.support?.ifUnsupported === 'cost-break' && !support.supported) {
      costKind = 'break-habit';
      cost = Math.max(cost, BREAK_HABIT_COST);
      supportReason = support.reason ?? choice.supportReason ?? '这件事和你惯常的反应不一样。';
    }
    if (support.supported && choice.costKind === 'break-habit') {
      cost = 0;
      costKind = 'free';
      supportReason = support.reason;
    }
    const enabled = cost === 0 || cost <= run.lifePoints;
    visible.push({
      choiceId: choice.id,
      text: interpolate(choice.text, peopleMap(run, template)),
      preview: interpolate(choice.preview, peopleMap(run, template)),
      cost,
      costKind,
      supportReason: supportReason ? interpolate(supportReason, peopleMap(run, template)) : undefined,
      supportedByFragmentIds: support.fragmentIds,
      enabled,
      disabledReason: enabled ? undefined : `还需要 ${cost} 人生点，你现在只有 ${run.lifePoints} 点。`,
    });
  }
  return visible.slice(0, 4);
}

function evaluateSupport(
  rule: SupportRule | undefined,
  run: LifeRun,
  recalledIds: string[],
  _content: GameContent,
): { supported: boolean; fragmentIds: string[]; reason?: string } {
  if (!rule) {
    return { supported: true, fragmentIds: [] };
  }
  const fragmentHits = (rule.anyFragmentTags ?? []).length === 0
    ? []
    : run.fragments.filter((item) => rule.anyFragmentTags!.some((tag) => item.fragmentTags.includes(tag)));
  const understandingHits = (rule.understandingIds ?? []).filter((id) => (
    latestUnderstanding(run)?.contentKey === id
    || run.tags.includes(`carried:${id}`)
    || run.tags.includes(`understood:${id}:hold`)
    || run.tags.includes(`understood:${id}:revise`)
  ));
  const anyTag = !rule.anyTags || rule.anyTags.some((tag) => run.tags.includes(tag));
  const required = !rule.requiredTags || rule.requiredTags.every((tag) => run.tags.includes(tag));
  const fragmentSupport = (rule.anyFragmentTags ?? []).length === 0 || fragmentHits.length > 0;
  const understandingSupport = (rule.understandingIds ?? []).length === 0 || understandingHits.length > 0;
  const supported = anyTag && required && fragmentSupport && understandingSupport;
  const ids = unique([
    ...fragmentHits.map((item) => item.id),
    ...recalledIds.filter((id) => fragmentHits.some((item) => item.id === id)),
  ]);
  const reason = supported && fragmentHits[0]
    ? `你想起${fragmentHits[0].age} 岁那次：${fragmentHits[0].howIResponded}`
    : supported && understandingHits[0]
      ? '你带着此前的理解走过来。'
      : undefined;
  return { supported, fragmentIds: ids, reason };
}

function generateRecall(run: LifeRun, content: GameContent): LifeRun {
  const fragments = run.fragments.filter((item) => item.runId === run.id).slice(-3);
  const seed = pickUnderstandingSeed(run, fragments, content);
  const existing = [...run.understandings].reverse().find((item) => item.contentKey === seed.id);
  const evidence = fragments.map((item) => `${item.age} 岁，${item.howIResponded}`).join('；');
  const pending: PendingRecall = {
    instanceId: `${run.id}-recall-${run.recallCount + 1}`,
    recallIndex: run.recallCount === 0 ? 1 : 2,
    fragmentIds: fragments.map((item) => item.id),
    seedId: seed.id,
    existingUnderstandingId: existing?.id,
    prompt: existing
      ? `这些经历在追问你一直带着的理解：${existing.statement}`
      : `到这里，你开始看出一件事。证据是：${evidence}。`,
    options: [
      { stance: 'hold', label: '坚持', statement: existing?.statement ?? seed.initial },
      { stance: 'revise', label: '修正', statement: seed.revised },
      { stance: 'question', label: '存疑', statement: seed.question },
    ],
  };
  return {
    ...run,
    turnState: 'awaiting-recall',
    pendingEncounter: undefined,
    pendingRecall: pending,
  };
}

function pickUnderstandingSeed(
  run: LifeRun,
  fragments: ExperienceFragment[],
  content: GameContent,
): UnderstandingSeed {
  const tags = new Set(fragments.flatMap((item) => item.fragmentTags));
  const matching = content.understandingSeeds.filter((seed) => (
    (seed.theme === run.lineA || seed.theme === run.lineB)
    && seed.anyFragmentTags.some((tag) => tags.has(tag) || run.tags.includes(tag))
  ));
  if (matching[0]) {
    return matching[0];
  }
  return content.understandingSeeds.find((seed) => seed.theme === run.lineA)
    ?? content.understandingSeeds[0];
}

function closeLife(run: LifeRun, content: GameContent): LifeRun {
  const unfulfilled = run.scheduled
    .filter((item) => !run.usedTemplateIds.includes(item.templateId))
    .map((item) => {
      const template = content.encounters.find((entry) => entry.id === item.templateId);
      return `${item.note}${template ? `（${template.title}）` : ''}尚未到来，这一世就在这里收束了。`;
    });
  const shapedBy = run.fragments.map((item) => `${item.age} 岁：${item.howIResponded}`);
  const changed = run.understandings
    .filter((item) => item.createdInRunId === run.id && item.stance === 'revise')
    .map((item) => item.statement);
  const unresolved = run.understandings
    .filter((item) => item.createdInRunId === run.id && item.stance === 'question')
    .map((item) => item.statement);
  const closing: LifeClosing = {
    title: endingTitle(run),
    text: endingText(run),
    shapedBy,
    changed: changed.length > 0 ? changed : ['你把经历留在了身上，但还没有改口去说它意味着什么。'],
    unresolved: unresolved.length > 0 ? unresolved : ['有些问题仍可以带到下一世。'],
    unfulfilled,
  };
  return {
    ...run,
    status: 'awaiting-archive',
    turnState: 'awaiting-archive',
    pendingEncounter: undefined,
    pendingRecall: undefined,
    closing,
  };
}

function endingTitle(run: LifeRun): string {
  if (run.tags.includes('shared-blame') && run.tags.includes('truth-punished')) {
    return '愿意一起承担的人';
  }
  if (run.tags.includes('left-home') && run.tags.includes('reconnected')) {
    return '远方仍有来处';
  }
  if (run.tags.includes('kept-boundary')) {
    return '被需要，却没有被用尽';
  }
  if (run.tags.includes('hid-and-safe')) {
    return '把话藏进日子里';
  }
  return '这一世有过选择';
}

function endingText(run: LifeRun): string {
  const world = formatWorldSummary(run.world);
  const lines = themeLabel(run.lineA);
  const other = themeLabel(run.lineB);
  return `你这一世走在「${lines}」与「${other}」之间。${world ? `如今：${world}。` : ''}经历还在，理解可以改口，事实不会被覆盖。`;
}

function eligibleTemplates(
  run: LifeRun,
  content: GameContent,
  age: number,
  relaxAge = false,
): EncounterTemplate[] {
  const pressures = computeWorldPressures(run.world, age);
  return content.encounters.filter((template) => {
    if (run.usedTemplateIds.includes(template.id)) {
      return false;
    }
    if (!templateMatchesLines(template, run.lineA, run.lineB)) {
      return false;
    }
    if (!relaxAge && (age < template.minAge || age > template.maxAge)) {
      return false;
    }
    if (relaxAge && Math.abs(age - template.minAge) > 18 && Math.abs(age - template.maxAge) > 18) {
      return false;
    }
    return matchesWorldCondition(template.condition, { tags: run.tags, world: run.world }, pressures);
  });
}

function templateMatchesLines(template: EncounterTemplate, lineA: LifeTheme, lineB: LifeTheme): boolean {
  if (template.crossThemes && template.crossThemes.length > 0) {
    return template.crossThemes.every((theme) => theme === lineA || theme === lineB)
      || template.crossThemes.some((theme) => theme === lineA || theme === lineB);
  }
  return template.theme === lineA || template.theme === lineB;
}

function dueSchedules(run: LifeRun, age: number, content: GameContent): ScheduledEncounter[] {
  return run.scheduled.filter((item) => (
    !run.usedTemplateIds.includes(item.templateId)
    && age >= item.earliestAge
    && age <= item.latestAge
    && content.encounters.some((template) => template.id === item.templateId)
  ));
}

function shouldRecall(run: LifeRun): boolean {
  return run.recallCount < MAX_RECALLS_PER_LIFE
    && RECALL_AFTER_COUNTS.includes(run.encounterCount as 3 | 6);
}

function shouldClose(run: LifeRun, content: GameContent): boolean {
  if (run.encounterCount >= MAX_ENCOUNTERS) {
    return true;
  }
  if (run.encounterCount < MIN_ENCOUNTERS) {
    return false;
  }
  if (run.recallCount < MAX_RECALLS_PER_LIFE) {
    return false;
  }
  const due = dueSchedules(run, run.age + 1, content);
  return due.length === 0;
}

function isConflict(run: LifeRun, age: number): boolean {
  const pressures = computeWorldPressures(run.world, age);
  const score = (theme: LifeTheme) => THEME_DOMAINS[theme].reduce((sum, domain) => sum + pressures[domain], 0);
  return score(run.lineA) >= 6 && score(run.lineB) >= 6;
}

function bindPeople(
  run: LifeRun,
  bindings: PersonBinding[],
): { people: BoundPerson[]; world: LifeRun['world'] } {
  let world = run.world;
  const people: BoundPerson[] = [];
  for (const binding of bindings) {
    let relation = world.relations.find((item) => item.id === binding.relationId);
    if (!relation && binding.createIfMissing) {
      const applied = applyWorldChange(world, {
        relations: [{
          id: binding.relationId,
          kind: binding.createIfMissing.kind,
          label: binding.createIfMissing.label,
          closeness: binding.createIfMissing.closeness,
        }],
      }, run.age);
      world = applied.world;
      relation = world.relations.find((item) => item.id === binding.relationId);
    }
    people.push({
      role: binding.role,
      relationId: binding.relationId,
      label: relation?.label ?? binding.fallbackLabel,
    });
  }
  return { people, world };
}

function recallFragments(
  run: LifeRun,
  template: EncounterTemplate,
  people: BoundPerson[],
): { ids: string[]; notes: string[] } {
  const related = run.fragments.filter((item) => (
    item.theme === template.theme
    || item.people.some((person) => people.some((bound) => bound.relationId === person.relationId))
    || run.carriedUnderstandingIds.length > 0 && item.runId !== run.id
  ));
  const picked = related.slice(-2);
  const carried = run.understandings
    .filter((item) => run.carriedUnderstandingIds.includes(item.id))
    .slice(0, 1)
    .flatMap((item) => item.sourceFragmentIds);
  const ids = unique([...picked.map((item) => item.id), ...carried]).slice(0, 3);
  const notes = ids.map((id) => {
    const fragment = run.fragments.find((item) => item.id === id);
    if (fragment) {
      return `你想起${fragment.age} 岁，${fragment.howIResponded}`;
    }
    const carriedItem = run.understandings.find((item) => item.sourceFragmentIds.includes(id));
    return carriedItem ? `你带着上一世的理解：${carriedItem.statement}` : '一段往事被唤起';
  });
  return { ids, notes };
}

function buildSchedules(
  outcome: EncounterOutcomeConfig,
  encounterId: string,
  fragmentId: string,
  age: number,
): ScheduledEncounter[] {
  return (outcome.schedule ?? []).map((item) => ({
    templateId: item.templateId,
    earliestAge: age + item.afterYears,
    latestAge: age + item.afterYears + (item.windowYears ?? 8),
    sourceEncounterInstanceId: encounterId,
    sourceFragmentId: fragmentId,
    note: item.note,
  }));
}

function linkLaterWhat(
  fragments: ExperienceFragment[],
  sourceIds: string[],
  later: string,
): ExperienceFragment[] {
  if (!later || sourceIds.length === 0) {
    return fragments;
  }
  return fragments.map((item) => (
    sourceIds.includes(item.id)
      ? { ...item, laterWhat: unique([...item.laterWhat, later]) }
      : item
  ));
}

function replaceUnderstanding(
  list: Understanding[],
  created: Understanding,
  previousId?: string,
): Understanding[] {
  if (!previousId) {
    return [...list.filter((item) => item.id !== created.id), created];
  }
  return [...list, created];
}

function latestUnderstanding(run: LifeRun): Understanding | undefined {
  const own = run.understandings.filter((item) => item.createdInRunId === run.id);
  if (own.length > 0) {
    return own[own.length - 1];
  }
  return run.understandings.find((item) => run.carriedUnderstandingIds.includes(item.id));
}

function costOf(kind: CostKind): number {
  if (kind === 'break-habit') {
    return BREAK_HABIT_COST;
  }
  if (kind === 'pursue-opportunity') {
    return PURSUE_OPPORTUNITY_COST;
  }
  return 0;
}

function interpolate(text: string, people: BoundPerson[]): string {
  return text.replace(/\{(\w+)\}/g, (_full, role: string) => {
    return people.find((item) => item.role === role)?.label ?? role;
  });
}

function peopleMap(run: LifeRun, template: EncounterTemplate): BoundPerson[] {
  return template.people.map((binding) => {
    const relation = run.world.relations.find((item) => item.id === binding.relationId);
    return {
      role: binding.role,
      relationId: binding.relationId,
      label: relation?.label ?? binding.fallbackLabel,
    };
  });
}

function requireTemplate(id: string, content: GameContent): EncounterTemplate {
  const template = content.encounters.find((item) => item.id === id);
  if (!template) {
    throw new Error(`Unknown encounter: ${id}`);
  }
  return template;
}

function mergeDiscoveries(existing: ArchiveDiscovery[], run: LifeRun): ArchiveDiscovery[] {
  const next = existing.map((item) => ({
    ...item,
    variantStatements: [...item.variantStatements],
    sources: [...item.sources],
  }));
  for (const understanding of run.understandings.filter((item) => item.createdInRunId === run.id)) {
    const sourceFragments = run.fragments.filter((fragment) => understanding.sourceFragmentIds.includes(fragment.id));
    const sources = sourceFragments.map((fragment) => ({
      runId: run.id,
      fragmentId: fragment.id,
      understandingId: understanding.id,
      personLabels: fragment.people.map((person) => person.label),
      age: fragment.age,
    }));
    const found = next.find((item) => item.contentKey === understanding.contentKey);
    if (found) {
      if (!found.variantStatements.includes(understanding.statement)) {
        found.variantStatements.push(understanding.statement);
      }
      found.latestStatement = understanding.statement;
      found.sources.push(...sources.filter((source) => (
        !found.sources.some((item) => item.fragmentId === source.fragmentId && item.runId === source.runId)
      )));
    } else {
      next.push({
        contentKey: understanding.contentKey,
        title: understanding.statement,
        latestStatement: understanding.statement,
        variantStatements: [understanding.statement],
        sources,
      });
    }
  }
  return next;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function findChoice(
  template: EncounterTemplate,
  choiceId: string,
): EncounterChoiceConfig | undefined {
  return template.choices.find((item) => item.id === choiceId);
}
