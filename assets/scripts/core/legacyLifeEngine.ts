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
  MOMENT_AGES,
  MAX_RECALLS_PER_LIFE,
  MIN_ENCOUNTERS,
  PURSUE_OPPORTUNITY_COST,
  PendingEncounter,
  PendingOption,
  PersonBinding,
  RECALL_AFTER_COUNTS,
  ReincarnatorProfile,
  RecallStance,
  ScheduledEncounter,
  SupportRule,
  Understanding,
  UnderstandingSeed,
  createInitialProfile,
} from './model';
import { applyMarkChanges, createStartingMarks } from './lifeMarks';
import {
  applyWorldChange,
  computeWorldPressures,
  matchesWorldCondition,
  rippleWorld,
  tickLifeWorld,
  createBirthWorld,
} from './lifeWorld';
import { normalizeSeed, pickWeighted, sampleUnique } from './random';

const RULES_VERSION = 7;

export { formatWorldSummary } from './lifeWorld';
export { formatMarkList } from './lifeMarks';
export { createInitialProfile };

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
  const birthWorld = createBirthWorld(family, temperament);
  const world = { ...birthWorld, relations: birthWorld.relations.map(r => r.id === 'parents' ? { ...r, label: '母亲' } : r) };
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
  const choice = choicesFor(run, template).find((item) => item.id === choiceId);
  if (!choice) {
    throw new Error('未知的回应。');
  }

  let rngState = pending.rngState;
  const outcomePick = pickWeighted(choice.outcomes.filter(item => matchesWorldCondition(item.condition, run, computeWorldPressures(run.world, run.age))), rngState, (item) => Math.max(0, item.weight));
  rngState = outcomePick.state;
  const outcome = outcomePick.item;

  const applied = applyWorldChange(run.world, outcome.world, pending.age);
  const rippled = rippleWorld(applied.world, outcome.world, pending.age);
  const markApplied = applyMarkChanges(run.marks, outcome.world.marks ?? [], content.marks);
  const points = run.lifePoints - option.cost;
  const fragmentId = `${run.id}-frag-${run.nextFragmentSeq}`;
  const understanding = latestUnderstanding(run, template.theme);
  const fragment: ExperienceFragment = {
    id: fragmentId,
    contentKey: `frag:${template.id}:${choice.id}:${outcome.id}`,
    runId: run.id,
    age: pending.age,
    encounterInstanceId: pending.instanceId,
    templateId: template.id,
    theme: template.theme,
    people: pending.boundPeople,
    whatHappened: pending.text,
    howIResponded: `${option.text}。${interpolate(outcome.text, pending.boundPeople)}`.trim(),
    choiceId: choice.id,
    outcomeId: outcome.id,
    costPaid: option.cost,
    fragmentTags: [...choice.fragmentTags],
    recalledFragmentIds: [...pending.recalledFragmentIds],
    understandingAtTime: understanding?.statement,
    understandingId: understanding?.id,
    laterWhat: outcome.later ? [interpolate(outcome.later, pending.boundPeople)] : [],
    triggerKind: pending.triggerKind,
    triggerNote: pending.triggerNote,
    triggerSourceIds: [...pending.triggerSourceIds],
    worldChanges: unique([...applied.fragments, ...rippled.fragments, ...markApplied.fragments]),
  };

  const scheduled = [
    ...run.scheduled,
    ...buildSchedules(outcome, pending.instanceId, fragmentId, pending.age),
  ];
  const linked = linkLaterWhat(run.fragments, pending.triggerSourceIds, `${pending.age} 岁，${pending.title}：${interpolate(outcome.text, pending.boundPeople)}`);

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

  return {
    ...next, turnState: 'showing-result',
    pendingResult: {
      instanceId: pending.instanceId, fragmentId, title: pending.title,
      response: option.text, outcome: interpolate(outcome.text, pending.boundPeople),
      consequence: interpolate(outcome.later, pending.boundPeople), changes: fragment.worldChanges,
      costPaid: option.cost, sceneKind: pending.sceneKind,
    },
  };
}

export function continueAfterResult(run: LifeRun, resultId: string, content: GameContent): LifeRun {
  if (run.status !== 'active' || run.turnState !== 'showing-result' || run.pendingResult?.instanceId !== resultId) return run;
  const next = { ...run, pendingResult: undefined };
  if (shouldRecall(next)) return generateRecall(next, content);
  if (shouldClose(next, content)) return closeLife(next, content);
  return generateNextEncounter(next, content);
}

// Preserve existing facts when continuing an earlier v3 life. An obsolete pending card is regenerated.
export function upgradeActiveRun(run: LifeRun, content: GameContent): LifeRun {
  if (run.rulesVersion >= RULES_VERSION || run.status !== 'active') return run;
  const next = { ...run, rulesVersion: RULES_VERSION, pendingEncounter: undefined, pendingRecall: undefined,
    pendingResult: undefined, scheduled: run.scheduled.filter(s => content.encounters.some(t => t.id === s.templateId)) };
  if (next.encounterCount >= MAX_ENCOUNTERS) return closeLife(next, content);
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
    effectiveStance: stance === 'hold' ? previous?.effectiveStance ?? previous?.stance ?? 'hold' : stance,
    version: (previous?.version ?? 0) + 1,
    previousVersionId: previous?.id,
    sourceFragmentIds: [...pending.fragmentIds],
    createdInRunId: run.id,
    createdAtAge: run.age,
  };
  const points = Math.min(LIFE_POINT_CAP, run.lifePoints + LIFE_POINT_RECALL_GAIN);

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
    fragments: run.fragments,
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
      fragments: [...profile.fragments, ...run.fragments.filter(f => !profile.fragments.some(old => old.id === f.id))],
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
        ...(fragment.understandingId ? [{ id: fragment.understandingId, relation: '当时这样理解的依据' }] : []),
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
        ...understanding.sourceFragmentIds.map((sourceId) => ({ id: sourceId, relation: `${fragments.find(f => f.id === sourceId)?.age ?? ''} 岁 · 作为证据的经历` })),
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
    const current = latestByKey.get(`${item.contentKey}:${item.stance}`);
    if (!current || item.version > current.version) {
      latestByKey.set(`${item.contentKey}:${item.stance}`, item);
    }
  }
  return Array.from(latestByKey.values());
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

function generateNextEncounter(run: LifeRun, content: GameContent, openingTrigger?: PendingEncounter['triggerKind']): LifeRun {
  const age = Math.max(run.age, MOMENT_AGES[Math.min(run.encounterCount, MOMENT_AGES.length - 1)]);
  const chapter = Math.min(3, Math.floor(run.encounterCount / 3));
  let world = run.world;
  for (let year = run.age + 1; year <= age; year++) world = tickLifeWorld(world, year);
  const current = { ...run, age, world };
  let candidates = eligibleTemplates(current, content, age);
  const chapterFragments = run.fragments.filter(f => f.runId === run.id && content.encounters.find(t => t.id === f.templateId)?.chapter === chapter);
  const missing = [run.lineA, run.lineB].filter(theme => !chapterFragments.some(f => f.theme === theme));
  if (missing.length) candidates = candidates.filter(t => !t.crossThemes && missing.includes(t.theme));
  else if (candidates.some(t => t.crossThemes)) candidates = candidates.filter(t => Boolean(t.crossThemes));
  const due = dueSchedules(current, age, content).filter(d => candidates.some(t => t.id === d.templateId));
  if (due.length) candidates = candidates.filter(t => due.some(d => d.templateId === t.id));
  if (!candidates.length) throw new Error(`第 ${chapter + 1} 章缺少可继续的故事，请检查内容覆盖。`);
  const pick = pickWeighted(candidates, run.rngState, t => t.weight);
  const source = due.find(d => d.templateId === pick.item.id);
  const last = run.fragments.filter(f => f.runId === run.id).slice(-1)[0];
  const note = run.encounterCount === 0
    ? `${content.families.find(f => f.id === run.familyId)?.description ?? ''} 你的第一段记忆，从这条小城的街巷开始。`
    : `${age - run.age} 年过去了。${last?.laterWhat[0] ?? ''}`;
  return freezeEncounter(run, pick.item, content, {
    age, world, rngState: pick.state, notes: [...run.skippedYearNotes, note],
    triggerKind: source ? 'consequence' : openingTrigger ?? (pick.item.crossThemes ? 'thread-conflict' : 'chance'),
    triggerNote: source?.note ?? note, triggerSourceIds: source ? [source.sourceFragmentId] : [],
  });
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
    text: interpolate(template.variants?.find(v => matchesWorldCondition(v.condition, run, computeWorldPressures(run.world, context.age)))?.text ?? template.text, bound.people),
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
  for (const choice of choicesFor(run, template)) {
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
      disabledReason: enabled ? undefined : `需要 ${cost} 人生点，你现在有 ${run.lifePoints} 点。`,
    });
  }
  return visible.slice(0, 4);
}

function choicesFor(run: LifeRun, template: EncounterTemplate): EncounterChoiceConfig[] {
  const understanding = latestUnderstanding(run, template.theme);
  if ((understanding?.effectiveStance ?? understanding?.stance) !== 'question' || template.chapter === 0) return template.choices;
  if (template.questionChoice) return [...template.choices, { ...template.questionChoice, supportReason: `回望留下的问题，让你愿意先问一问：${understanding?.statement}` }];
  return [...template.choices, {
    id: 'ask-first', text: '先问清彼此的担心，今天暂不承诺', preview: '把决定留到下一次谈话；眼前的机会也可能错过。',
    costKind: 'free' as const, fragmentTags: [`question-${template.theme}`],
    supportReason: `你还带着这个问题：${understanding?.statement}`,
    outcomes: [{ id: 'asked', weight: 1,
      text: '你先说出自己还没想清的部分，听对方把担心讲完。这次谈话没有立刻定下办法；你们约好再谈，眼前的事情先各自处理。',
      later: `关于「${template.title}」，你保留了一次需要继续的谈话，没有替任何人许下承诺。`,
      world: { setFacts: { [`question:${template.id}`]: 'open' } },
    }],
  }];
}

function evaluateSupport(rule: SupportRule | undefined, run: LifeRun, _recalledIds: string[], content: GameContent): { supported: boolean; fragmentIds: string[]; reason?: string } {
  if (!rule) return { supported: false, fragmentIds: [] };
  const hits = run.fragments.filter(f => rule.anyFragmentTags?.some(tag => f.fragmentTags.includes(tag)));
  const effective = run.understandings.filter(u => latestUnderstanding(run, u.theme)?.id === u.id);
  const insights = effective.filter(u => {
    const seed = content.understandingSeeds.find(s => s.id === u.contentKey);
    const stance = u.effectiveStance ?? u.stance;
    return (stance === 'revise' && seed?.revisedResponseTags?.some(tag => rule.anyFragmentTags?.includes(tag)))
      || (rule.understandingIds?.includes(u.contentKey) && (rule.understandingStances ?? ['revise']).includes(stance));
  });
  const required = (!rule.requiredTags || rule.requiredTags.every(t => run.tags.includes(t)))
    && (!rule.anyTags || rule.anyTags.some(t => run.tags.includes(t)));
  const supported = required && (hits.length > 0 || insights.length > 0);
  const last = hits[hits.length - 1];
  return { supported, fragmentIds: unique([...hits.map(f => f.id), ...insights.flatMap(u => u.sourceFragmentIds)]),
    reason: last ? `你在${last.runId === run.id ? '这一世' : '前一世'} ${last.age} 岁试过类似的做法。这次开口不必额外消耗人生点。`
      : insights[0] ? `你记得自己回望时说过：“${insights[0].statement}” 这次可以试着照此行动。` : undefined };
}

function generateRecall(run: LifeRun, content: GameContent): LifeRun {
  const own = run.fragments.filter(f => f.runId === run.id);
  const previous = run.understandings.filter(u => u.createdInRunId === run.id).slice(-1)[0];
  const seed = pickUnderstandingSeed(run, own, content);
  const relevant = own.filter(f => f.theme === seed.theme);
  const early = relevant[0];
  const newest = relevant[relevant.length - 1];
  const contrasted = relevant.slice(1).reverse().find(f => !seed.anyFragmentTags.some(t => f.fragmentTags.includes(t)));
  const evidence = Array.from(new Set([early, ...(previous ? [newest] : [contrasted ?? newest])].filter((f): f is ExperienceFragment => Boolean(f))));
  const existing = previous?.contentKey === seed.id ? previous : run.understandings.slice().reverse().find(u => u.contentKey === seed.id);
  const prompt = existing
    ? `你曾这样理解：${existing.statement} 如今又经历了${newest.age} 岁的这件事。你愿意怎样继续看待它？`
    : `把这两件事放在一起，你注意到自己曾经怎样回应。它们还不能概括整个人生，但可以先留下一种理解。`;
  return { ...run, turnState: 'awaiting-recall', pendingEncounter: undefined, pendingResult: undefined,
    pendingRecall: { instanceId: `${run.id}-recall-${run.recallCount + 1}`, recallIndex: run.recallCount === 0 ? 1 : 2,
      fragmentIds: evidence.map(f => f.id), seedId: seed.id, existingUnderstandingId: existing?.id, prompt,
      options: [
        { stance: 'hold', label: existing ? '仍愿意这样做' : '先记住这种做法', statement: existing?.statement ?? seed.initial, effectHint: '保留已有的回应方式，新的尝试仍可以付出心力。' },
        { stance: 'revise', label: '试着换一种理解', statement: previous ? seed.matureRevised ?? seed.revised : seed.revised, effectHint: '以后遇到相关的协商，开口会更容易。' },
        { stance: 'question', label: '把问题留着', statement: previous ? seed.matureQuestion ?? seed.question : seed.question, effectHint: '以后遇到相关的事，可以先追问，再决定是否承诺。' },
      ],
    },
  };
}

function pickUnderstandingSeed(run: LifeRun, fragments: ExperienceFragment[], content: GameContent): UnderstandingSeed {
  const previous = run.understandings.filter(u => u.createdInRunId === run.id).slice(-1)[0];
  if (previous) {
    const seed = content.understandingSeeds.find(s => s.id === previous.contentKey);
    if (seed && fragments.some(f => f.theme === seed.theme && f.age > previous.createdAtAge)) return seed;
  }
  const count = (theme: LifeTheme) => fragments.filter(f => f.theme === theme).length;
  const theme = count(run.lineA) >= count(run.lineB) ? run.lineA : run.lineB;
  const first = fragments.find(f => f.theme === theme);
  const seed = content.understandingSeeds.find(s => s.theme === theme && s.anyFragmentTags.some(t => first?.fragmentTags.includes(t)));
  if (!seed) throw new Error('回望缺少实际经历支持，不能凭空生成理解。');
  return seed;
}

function closeLife(run: LifeRun, content: GameContent): LifeRun {
  const unfulfilled = run.scheduled
    .filter((item) => !run.usedTemplateIds.includes(item.templateId))
    .map((item) => {
      const template = content.encounters.find((entry) => entry.id === item.templateId);
      return `${item.note}${template ? `（${template.title}）` : ''}尚未到来，这一世就在这里收束了。`;
    });
  const shapedBy = run.fragments.filter(f => f.runId === run.id).map((item) => `${item.age} 岁：${item.howIResponded}`);
  const changed = run.understandings
    .filter((item) => item.createdInRunId === run.id && item.stance === 'revise')
    .map((item) => item.statement);
  const unresolved = run.understandings
    .filter((item) => item.createdInRunId === run.id && item.stance === 'question')
    .map((item) => item.statement);
  for (const fragment of run.fragments.filter(f => f.runId === run.id && f.choiceId === 'ask-first')) {
    unresolved.push(`${fragment.age} 岁：${fragment.laterWhat[0]}`);
  }
  const closing: LifeClosing = {
    title: endingTitle(run),
    text: endingText(run),
    shapedBy,
    changed: changed.length > 0 ? unique(changed) : ['你把经历留在了身上，但还没有改口去说它意味着什么。'],
    unresolved: unresolved.length > 0 ? unique(unresolved) : ['有些问题仍可以带到下一世。'],
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
  const facts = run.world.facts;
  if (facts.lastTeaching?.value === 'passed-on') return '你把一次过错，讲成了另一个人的开始';
  if (facts.lastPiece?.value === 'unfinished') return '未完成的，也留在这一生里';
  if (facts.lastJourney?.value === 'together') return '后来，相见本身就是目的';
  if (facts.oldAccount?.value === 'two-voices') return '同一段往事，终于容下两种声音';
  return '这一生，留下了自己的回应';
}
function endingText(run: LifeRun): string {
  const latest = run.fragments.filter(f => f.runId === run.id).slice(-1)[0];
  return `八十一岁的一个傍晚，你把手边的东西收好。${latest?.laterWhat[0] ?? ''} 又过了一些平常日子，这一生慢慢走到了尽头。回头看时，最清楚的仍是那些人，以及你们曾怎样回应彼此。`;
}
function eligibleTemplates(run: LifeRun, content: GameContent, age: number): EncounterTemplate[] {
  const chapter = Math.min(3, Math.floor(run.encounterCount / 3));
  return content.encounters.filter(t => t.chapter === chapter && !run.usedTemplateIds.includes(t.id)
    && templateMatchesLines(t, run.lineA, run.lineB) && age >= t.minAge && age <= t.maxAge
    && matchesWorldCondition(t.condition, run, computeWorldPressures(run.world, age)));
}
function templateMatchesLines(template: EncounterTemplate, lineA: LifeTheme, lineB: LifeTheme): boolean {
  return template.crossThemes?.length ? template.crossThemes.every(t => t === lineA || t === lineB) : template.theme === lineA || template.theme === lineB;
}
function dueSchedules(run: LifeRun, age: number, content: GameContent): ScheduledEncounter[] {
  return run.scheduled.filter(s => !run.usedTemplateIds.includes(s.templateId) && age >= s.earliestAge && age <= s.latestAge
    && content.encounters.some(t => t.id === s.templateId && matchesWorldCondition(t.condition, run, computeWorldPressures(run.world, age))));
}
function shouldRecall(run: LifeRun): boolean {
  return run.recallCount < MAX_RECALLS_PER_LIFE && RECALL_AFTER_COUNTS.includes(run.encounterCount);
}
function shouldClose(run: LifeRun, _content: GameContent): boolean {
  return run.encounterCount >= MIN_ENCOUNTERS && run.age >= MOMENT_AGES[MOMENT_AGES.length - 1];
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

function recallFragments(run: LifeRun, template: EncounterTemplate, _people: BoundPerson[]): { ids: string[]; notes: string[] } {
  const own = run.fragments.filter(f => f.runId === run.id && f.theme === template.theme);
  const borrowed = run.understandings.filter(u => run.carriedUnderstandingIds.includes(u.id) && u.theme === template.theme).flatMap(u => u.sourceFragmentIds);
  const ids = unique([...(own[0] ? [own[0].id] : []), ...own.slice(-1).map(f => f.id), ...borrowed]);
  return { ids, notes: ids.map(id => {
    const f = run.fragments.find(item => item.id === id);
    return f ? `${f.runId === run.id ? '这一世' : '前一世'} · ${f.age} 岁：${f.whatHappened}` : '从上一世带来的一个问题';
  }) };
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

function latestUnderstanding(run: LifeRun, theme?: LifeTheme): Understanding | undefined {
  const relevant = run.understandings.filter(u => !theme || u.theme === theme);
  return relevant.filter(u => u.createdInRunId === run.id).slice(-1)[0]
    ?? relevant.filter(u => run.carriedUnderstandingIds.includes(u.id)).slice(-1)[0];
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
      runId: fragment.runId,
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
  return Array.from(new Set(values.filter(Boolean)));
}

export function findChoice(
  template: EncounterTemplate,
  choiceId: string,
): EncounterChoiceConfig | undefined {
  return template.choices.find((item) => item.id === choiceId);
}
