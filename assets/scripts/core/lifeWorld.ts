import {
  emptyWorld,
  EventCondition,
  EventOutcomeConfig,
  FamilyConfig,
  LifeDomain,
  LIFE_DOMAINS,
  LifeEventConfig,
  LifeFocusConfig,
  LifeHistoryEntry,
  LifeRelation,
  LifeRun,
  LifeThread,
  LifeWorld,
  mergeStatDeltas,
  RelationChange,
  STAT_KEYS,
  StatDelta,
  Stats,
  TalentConfig,
  ThreadChange,
  WorldChange,
} from './model';

export const DOMAIN_LABELS: Record<LifeDomain, string> = {
  health: '身体',
  learning: '求知',
  relationship: '人情',
  career: '事业',
  family: '家庭',
  travel: '远行',
  craft: '手艺',
  legacy: '传承',
};

const FACT_LABELS: Record<string, Record<string, string>> = {
  residence: {
    hometown: '故乡',
    city: '城市',
    traveling: '在路上',
    moving: '迁居中',
    returned: '归来',
  },
  household: {
    stable: '安稳日子',
    books: '书香门第',
    shop: '开门做生意',
    crowded: '人多热闹',
    moving: '居无定所',
  },
  schooling: {
    started: '求学',
    exam: '备考',
    continued: '继续学',
  },
  occupation: {
    employed: '有工作',
    craft: '手上有手艺',
    venture: '自己的事',
    searching: '另找出路',
    retired: '退休',
    semi_retired: '半退',
  },
  partnership: {
    loved: '心动过',
    home: '成家',
    independent: '各自生活',
    parted: '分开过',
    guarded: '把心收着',
  },
  parenting: {
    child: '有孩子',
  },
  health: {
    well: '身体尚可',
    warning: '身体示警',
    recovering: '在调养',
    neglected: '透支身体',
    treated: '正经看过病',
  },
};

const THEME_TO_DOMAIN: Record<string, LifeDomain> = {
  health: 'health',
  learning: 'learning',
  relationship: 'relationship',
  career: 'career',
  family: 'family',
  travel: 'travel',
  craft: 'craft',
  legacy: 'legacy',
  risk: 'career',
};

export type WorldPressures = Record<LifeDomain, number>;

export function createBirthWorld(
  family: FamilyConfig,
  talents: TalentConfig[],
): LifeWorld {
  let world = applyWorldChange(emptyWorld(), {
    setFacts: { residence: 'hometown', health: 'well' },
    relations: [{
      id: 'parents',
      kind: 'family',
      label: '家人',
      closeness: 5,
    }],
    threads: [{
      id: 'family_origin',
      domain: 'family',
      label: '原生家庭',
      intensity: 1,
    }],
  }, 0).world;

  if (family.world) {
    world = applyWorldChange(world, family.world, 0).world;
  }
  for (const talent of talents) {
    if (talent.world) {
      world = applyWorldChange(world, talent.world, 0).world;
    }
  }
  return world;
}

export function getEventDomains(event: LifeEventConfig): LifeDomain[] {
  const declared = [...(event.domains ?? []), ...(event.themes ?? [])]
    .map((item) => THEME_TO_DOMAIN[item])
    .filter((item): item is LifeDomain => Boolean(item));
  if (declared.length > 0) {
    return unique(declared);
  }
  return inferDomainsFromDelta(event.effects ?? event.world?.stats ?? {});
}

export function compileWorldChange(input: {
  effects?: StatDelta;
  addTags?: string[];
  world?: WorldChange;
  extraStats?: StatDelta;
}): WorldChange {
  return {
    stats: mergeStatDeltas(input.effects, input.world?.stats, input.extraStats),
    addTags: unique([...(input.addTags ?? []), ...(input.world?.addTags ?? [])]),
    setFacts: { ...(input.world?.setFacts ?? {}) },
    clearFacts: [...(input.world?.clearFacts ?? [])],
    relations: [...(input.world?.relations ?? [])],
    threads: [...(input.world?.threads ?? [])],
    marks: [...(input.world?.marks ?? [])],
  };
}

export function compileOutcomeChange(
  outcome: EventOutcomeConfig,
  extraStats?: StatDelta,
): WorldChange {
  return compileWorldChange({
    effects: outcome.effects,
    addTags: outcome.addTags,
    world: outcome.world,
    extraStats,
  });
}

export function applyWorldChange(
  world: LifeWorld,
  change: WorldChange,
  age: number,
): { world: LifeWorld; tags: string[]; fragments: string[] } {
  const facts = { ...world.facts };
  const fragments: string[] = [];

  for (const key of change.clearFacts ?? []) {
    if (facts[key]) {
      fragments.push(`不再${describeFact(key, facts[key].value)}`);
      delete facts[key];
    }
  }
  for (const [key, value] of Object.entries(change.setFacts ?? {})) {
    const previous = facts[key];
    facts[key] = {
      value,
      sinceAge: previous?.value === value ? previous.sinceAge : age,
    };
    const label = describeFact(key, value);
    if (label && previous?.value !== value) {
      fragments.push(label);
    }
  }

  let relations = [...world.relations];
  for (const update of change.relations ?? []) {
    const applied = applyRelationChange(relations, update, age);
    relations = applied.relations;
    fragments.push(...applied.fragments);
  }

  let threads = [...world.threads];
  for (const update of change.threads ?? []) {
    const applied = applyThreadChange(threads, update, age);
    threads = applied.threads;
    fragments.push(...applied.fragments);
  }

  return {
    world: { facts, relations, threads },
    tags: [...(change.addTags ?? [])],
    fragments: unique(fragments).slice(0, 4),
  };
}

export function applyFocusToWorld(
  world: LifeWorld,
  focus: LifeFocusConfig,
  age: number,
): { world: LifeWorld; fragments: string[] } {
  const domain = normalizeDomain(focus.preferredThemes[0]) ?? 'family';
  const compiled = compileWorldChange({
    world: mergeWorldChanges(focus.world, {
      threads: [{
        id: `strand:${domain}`,
        domain,
        label: DOMAIN_LABELS[domain],
        intensityDelta: 2,
      }],
    }),
  });
  const applied = applyWorldChange(world, compiled, age);
  return { world: applied.world, fragments: applied.fragments };
}

export function rippleWorld(
  world: LifeWorld,
  change: WorldChange,
  statsDelta: StatDelta,
  age: number,
): { world: LifeWorld; fragments: string[] } {
  let next = world;
  const fragments: string[] = [];
  const touchedRelationIds = new Set((change.relations ?? []).map((item) => item.id));
  const newResidence = change.setFacts?.residence;

  if ((newResidence === 'city' || newResidence === 'traveling') && !touchedRelationIds.has('parents')) {
    const parents = next.relations.find((item) => item.id === 'parents');
    if (parents && parents.closeness > 0) {
      const applied = applyWorldChange(next, {
        relations: [{ id: 'parents', closenessDelta: -1, strainDelta: 1 }],
      }, age);
      next = applied.world;
      fragments.push('故乡的家人远了一些');
    }
  }

  if (threadTouchesCareer(change)) {
    const homePerson = next.relations.find((item) => item.kind === 'partner' || item.kind === 'child');
    if (homePerson && !touchedRelationIds.has(homePerson.id)) {
      const applied = applyWorldChange(next, {
        relations: [{ id: homePerson.id, strainDelta: 1 }],
      }, age);
      next = applied.world;
      fragments.push('家里的节奏被工作打乱了一点');
    }
  }

  if ((statsDelta.health ?? 0) <= -2) {
    const tiredThreads = next.threads
      .filter((thread) => thread.intensity < 10)
      .map((thread) => ({ id: thread.id, intensityDelta: 1 }));
    if (tiredThreads.length > 0) {
      next = applyWorldChange(next, { threads: tiredThreads }, age).world;
      fragments.push('身体把压力还给了生活的其他角落');
    }
  }

  const addedChild = change.setFacts?.parenting === 'child'
    || Boolean(change.relations?.some((item) => item.id === 'child' && !item.remove));
  const career = next.threads.find((thread) => thread.domain === 'career');
  if (addedChild && career) {
    next = applyWorldChange(next, {
      threads: [{ id: career.id, intensityDelta: 1 }],
    }, age).world;
    fragments.push('事业与孩子开始互相抢时间');
  }

  return { world: next, fragments: unique(fragments).slice(0, 3) };
}

export function tickLifeWorld(world: LifeWorld, _stats: Stats, age: number): LifeWorld {
  const relations = world.relations.map((relation) => {
    const neglectedYears = age - relation.lastTouchedAge;
    if (neglectedYears < 8 || neglectedYears % 4 !== 0 || relation.closeness <= 0) {
      return relation;
    }
    return {
      ...relation,
      closeness: clamp(relation.closeness - 1, 0, 10),
      strain: clamp(relation.strain + (relation.closeness <= 2 ? 1 : 0), 0, 10),
    };
  });

  let threads = world.threads.map((thread) => {
    const supported = threadSupportedByFacts(thread.domain, world);
    const neglected = age - thread.lastEventAge >= 6;
    if (supported) {
      return {
        ...thread,
        intensity: Math.max(thread.intensity, minimumSupportedIntensity(thread.domain, world)),
      };
    }
    if (neglected && thread.intensity > 1) {
      return { ...thread, intensity: thread.intensity - 1 };
    }
    return thread;
  });

  if (world.facts.occupation && !threads.some((thread) => thread.domain === 'career')) {
    threads = [...threads, {
      id: 'career_life',
      domain: 'career',
      label: '谋生',
      intensity: 2,
      sinceAge: world.facts.occupation.sinceAge,
      lastEventAge: age,
    }];
  }
  if ((world.facts.partnership?.value === 'home' || world.facts.parenting)
    && !threads.some((thread) => thread.domain === 'family' && thread.id !== 'family_origin')) {
    threads = [...threads, {
      id: 'family_own',
      domain: 'family',
      label: '自己的家',
      intensity: 2,
      sinceAge: age,
      lastEventAge: age,
    }];
  }

  return { facts: world.facts, relations, threads };
}

export function computeWorldPressures(world: LifeWorld, stats: Stats, age = 0): WorldPressures {
  const pressures = emptyPressures();
  for (const thread of world.threads) {
    pressures[thread.domain] += thread.intensity;
  }

  const residence = world.facts.residence?.value;
  const occupation = world.facts.occupation?.value;
  const partnership = world.facts.partnership?.value;
  const healthFact = world.facts.health?.value;
  const schooling = world.facts.schooling?.value;

  if (occupation === 'employed' || occupation === 'craft' || occupation === 'venture') {
    pressures.career += 2;
  }
  if (occupation === 'searching') {
    pressures.career += 3;
  }
  if (occupation === 'craft') {
    pressures.craft += 3;
  }
  if (partnership === 'home' || world.facts.parenting) {
    pressures.family += 2;
  }
  if (schooling === 'exam') {
    pressures.learning += 3;
  } else if (schooling) {
    pressures.learning += 1;
  }
  if (healthFact === 'neglected') {
    pressures.health += 3;
  } else if (healthFact === 'warning') {
    pressures.health += 2;
  }
  if (residence === 'city' || residence === 'traveling') {
    pressures.travel += 1;
  }

  const parents = world.relations.find((item) => item.id === 'parents');
  if (parents) {
    pressures.family += Math.ceil(parents.closeness / 3);
    if (residence === 'city') {
      pressures.family += 1;
    }
  }
  const friend = world.relations.find((item) => item.id === 'friend');
  if (friend) {
    pressures.relationship += Math.ceil(friend.closeness / 2);
    if (age - friend.lastTouchedAge >= 8) {
      pressures.relationship += 2;
    }
  }
  const partner = world.relations.find((item) => item.kind === 'partner');
  if (partner) {
    pressures.relationship += Math.ceil(partner.closeness / 2);
    pressures.family += Math.ceil(partner.strain / 2);
    pressures.career += Math.min(partner.strain, 3);
  }
  if (world.relations.some((item) => item.kind === 'child')) {
    pressures.family += 3;
  }

  pressures.health += Math.max(0, 8 - stats.health);
  for (const domain of LIFE_DOMAINS) {
    pressures[domain] = clamp(pressures[domain], 0, 12);
  }
  return pressures;
}

export function getNetworkWeightMultiplier(
  event: LifeEventConfig,
  run: LifeRun,
  pressures: WorldPressures,
): number {
  const domains = getEventDomains(event);
  if (domains.length === 0) {
    return 1;
  }

  const pressureMatch = domains.reduce((sum, domain) => sum + (pressures[domain] ?? 0), 0)
    / (8 * domains.length);
  const recency = recencyPenalty(run, domains);
  const starvation = starvationBoost(run, pressures, domains);
  const cross = domains.length >= 2
    ? 1 + Math.min(...domains.map((domain) => pressures[domain] ?? 0)) * 0.08
    : 1;
  return Math.max(0.25, (1 + pressureMatch) * recency * starvation * cross);
}

export function evaluateCouplingBonus(
  event: LifeEventConfig,
  run: LifeRun,
  pressures: WorldPressures,
): number {
  return (event.couplings ?? []).reduce((sum, coupling) => {
    const world = getWorld(run);
    if (coupling.allFacts && Object.entries(coupling.allFacts).some(([key, value]) => (
      world.facts[key]?.value !== value
    ))) {
      return sum;
    }
    if (coupling.anyFacts && Object.entries(coupling.anyFacts).some(([key, values]) => (
      !values.includes(world.facts[key]?.value ?? '')
    ))) {
      return sum;
    }
    if (coupling.allTags?.some((tag) => !run.tags.includes(tag))) {
      return sum;
    }
    if (coupling.allRelations?.some((id) => !world.relations.some((item) => item.id === id))) {
      return sum;
    }
    if (coupling.minPressures && LIFE_DOMAINS.some((domain) => {
      const minimum = coupling.minPressures?.[domain];
      return minimum !== undefined && pressures[domain] < minimum;
    })) {
      return sum;
    }
    return sum + Math.max(0, coupling.weightBonus);
  }, 0);
}

export function matchesWorldCondition(
  condition: EventCondition | undefined,
  run: LifeRun,
  pressures: WorldPressures,
): boolean {
  if (!condition) {
    return true;
  }
  if (condition.anyTags && !condition.anyTags.some((tag) => run.tags.includes(tag))) {
    return false;
  }
  const world = getWorld(run);
  if (condition.requiredFacts) {
    for (const [key, value] of Object.entries(condition.requiredFacts)) {
      if (world.facts[key]?.value !== value) {
        return false;
      }
    }
  }
  if (condition.forbiddenFacts?.some((key) => Boolean(world.facts[key]))) {
    return false;
  }
  if (condition.anyFacts) {
    for (const [key, values] of Object.entries(condition.anyFacts)) {
      if (!values.includes(world.facts[key]?.value ?? '')) {
        return false;
      }
    }
  }
  if (condition.requiredRelations?.some((id) => !world.relations.some((item) => item.id === id))) {
    return false;
  }
  if (condition.minPressures && LIFE_DOMAINS.some((domain) => {
    const minimum = condition.minPressures?.[domain];
    return minimum !== undefined && pressures[domain] < minimum;
  })) {
    return false;
  }
  return true;
}

export function describePressureNote(
  event: LifeEventConfig,
  pressures: WorldPressures,
  couplingBonus: number,
): string | undefined {
  const hot = getEventDomains(event).filter((domain) => (pressures[domain] ?? 0) >= 4);
  if (hot.length >= 2) {
    return `${DOMAIN_LABELS[hot[0]]}与${DOMAIN_LABELS[hot[1]]}同时吃紧`;
  }
  if (hot.length === 1 && (pressures[hot[0]] ?? 0) >= 6) {
    return `${DOMAIN_LABELS[hot[0]]}一路压了过来`;
  }
  if (couplingBonus > 0) {
    return '几条生活线索撞在了一起';
  }
  return undefined;
}

export function formatWorldSummary(world: LifeWorld | undefined): string {
  if (!world) {
    return '';
  }
  const parts: string[] = [];
  for (const key of ['residence', 'occupation', 'partnership', 'parenting', 'schooling', 'health']) {
    const fact = world.facts[key];
    if (fact) {
      const label = describeFact(key, fact.value);
      if (label) {
        parts.push(label);
      }
    }
  }
  const closePeople = world.relations
    .filter((item) => item.closeness >= 5)
    .map((item) => `${item.label}${item.closeness >= 8 ? '很亲' : ''}`);
  parts.push(...closePeople.slice(0, 2));
  return unique(parts).slice(0, 4).join(' · ');
}

export function formatChangePreview(change: WorldChange): string {
  const statText = formatStatPreview(change.stats ?? {});
  const worldText = [
    ...Object.entries(change.setFacts ?? {}).map(([key, value]) => describeFact(key, value)),
    ...(change.relations ?? []).map((item) => describeRelationPreview(item)),
    ...(change.threads ?? []).map((item) => describeThreadPreview(item)),
  ].filter(Boolean);
  return [...(statText ? [statText] : []), ...worldText].slice(0, 4).join('　');
}

export function formatHistoryEffects(entry: LifeHistoryEntry): string {
  const worldText = (entry.worldChanges ?? []).filter(Boolean);
  const markText = (entry.markChanges ?? []).filter(Boolean);
  const parts = [...markText, ...worldText].slice(0, 4);
  return parts.join('　·　');
}

export function inferWorldFromTags(tags: string[], _familyId: string, age: number): LifeWorld {
  const change: WorldChange = {
    setFacts: { residence: 'hometown' },
    relations: [{
      id: 'parents',
      kind: 'family',
      label: '家人',
      closeness: 5,
    }],
    threads: [{
      id: 'family_origin',
      domain: 'family',
      label: '原生家庭',
      intensity: 1,
    }],
  };
  if (tags.includes('started_school')) {
    change.setFacts = { ...change.setFacts, schooling: 'started' };
  }
  if (tags.includes('has_career')) {
    change.setFacts = { ...change.setFacts, occupation: 'employed' };
  }
  if (tags.includes('has_craft')) {
    change.setFacts = { ...change.setFacts, occupation: 'craft' };
  }
  if (tags.includes('left_hometown')) {
    change.setFacts = { ...change.setFacts, residence: 'city' };
  }
  if (tags.includes('stayed_hometown')) {
    change.setFacts = { ...change.setFacts, residence: 'hometown' };
  }
  if (tags.includes('has_loved')) {
    change.setFacts = { ...change.setFacts, partnership: 'loved' };
    change.relations = [...(change.relations ?? []), {
      id: 'partner',
      kind: 'partner',
      label: '恋人',
      closeness: 5,
    }];
  }
  if (tags.includes('made_a_home')) {
    change.setFacts = { ...change.setFacts, partnership: 'home' };
    change.relations = [...(change.relations ?? []), {
      id: 'partner',
      kind: 'partner',
      label: '伴侣',
      closeness: 6,
    }];
  }
  if (tags.includes('raised_child')) {
    change.setFacts = { ...change.setFacts, parenting: 'child' };
    change.relations = [...(change.relations ?? []), {
      id: 'child',
      kind: 'child',
      label: '孩子',
      closeness: 6,
    }];
  }
  if (tags.includes('lifelong_friend')) {
    change.relations = [...(change.relations ?? []), {
      id: 'friend',
      kind: 'friend',
      label: '故人',
      closeness: 6,
    }];
  }
  if (tags.includes('health_warning')) {
    change.setFacts = { ...change.setFacts, health: 'warning' };
  }
  if (tags.includes('retired') || tags.includes('semi_retired')) {
    change.setFacts = {
      ...change.setFacts,
      occupation: tags.includes('semi_retired') ? 'semi_retired' : 'retired',
    };
  }
  return applyWorldChange(emptyWorld(), change, age).world;
}

export function getWorld(run: LifeRun): LifeWorld {
  return run.world ?? emptyWorld();
}

function applyRelationChange(
  relations: LifeRelation[],
  update: RelationChange,
  age: number,
): { relations: LifeRelation[]; fragments: string[] } {
  const fragments: string[] = [];
  if (update.remove) {
    const existing = relations.find((item) => item.id === update.id);
    if (!existing) {
      return { relations, fragments };
    }
    fragments.push(`${existing.label}离开了你的生活`);
    return {
      relations: relations.filter((item) => item.id !== update.id),
      fragments,
    };
  }

  const index = relations.findIndex((item) => item.id === update.id);
  const current = index >= 0 ? relations[index] : undefined;
  if (!current && !update.kind) {
    return { relations, fragments };
  }
  const next: LifeRelation = {
    id: update.id,
    kind: update.kind ?? current?.kind ?? 'community',
    label: update.label ?? current?.label ?? update.id,
    closeness: clamp(
      update.closeness ?? ((current?.closeness ?? 4) + (update.closenessDelta ?? 0)),
      0,
      10,
    ),
    strain: clamp((current?.strain ?? 0) + (update.strainDelta ?? 0), 0, 10),
    sinceAge: current?.sinceAge ?? age,
    lastTouchedAge: age,
  };
  if (!current) {
    fragments.push(`生命里多了${next.label}`);
  } else if ((update.closenessDelta ?? 0) > 0 || (update.closeness ?? 0) > current.closeness) {
    fragments.push(`${next.label}更近了`);
  } else if ((update.closenessDelta ?? 0) < 0) {
    fragments.push(`${next.label}远了一些`);
  } else if ((update.strainDelta ?? 0) > 0) {
    fragments.push(`${next.label}那边更累了`);
  }

  const copy = [...relations];
  if (index >= 0) {
    copy[index] = next;
  } else {
    copy.push(next);
  }
  return { relations: copy, fragments };
}

function applyThreadChange(
  threads: LifeThread[],
  update: ThreadChange,
  age: number,
): { threads: LifeThread[]; fragments: string[] } {
  const fragments: string[] = [];
  if (update.resolve) {
    const existing = threads.find((item) => item.id === update.id);
    if (!existing) {
      return { threads, fragments };
    }
    fragments.push(`${existing.label}告一段落`);
    return {
      threads: threads.filter((item) => item.id !== update.id),
      fragments,
    };
  }

  const index = threads.findIndex((item) => item.id === update.id);
  const current = index >= 0 ? threads[index] : undefined;
  const domain = update.domain ?? current?.domain;
  if (!domain) {
    return { threads, fragments };
  }
  const next: LifeThread = {
    id: update.id,
    domain,
    label: update.label ?? current?.label ?? DOMAIN_LABELS[domain],
    intensity: clamp(
      update.intensity ?? ((current?.intensity ?? 2) + (update.intensityDelta ?? 0)),
      0,
      10,
    ),
    sinceAge: current?.sinceAge ?? age,
    lastEventAge: age,
  };
  if (!current) {
    fragments.push(`${next.label}成了生活的一条线`);
  } else if ((update.intensityDelta ?? 0) > 0 || (update.intensity ?? 0) > current.intensity) {
    fragments.push(`${next.label}更占地方了`);
  }

  const copy = [...threads];
  if (index >= 0) {
    copy[index] = next;
  } else {
    copy.push(next);
  }
  return { threads: copy, fragments };
}

function recencyPenalty(run: LifeRun, domains: LifeDomain[]): number {
  if (domains.length !== 1) {
    return 1;
  }
  const recent = [...run.history].reverse().find((entry) => (
    !entry.eventId.startsWith('birth:') && !entry.eventId.startsWith('focus:')
  ));
  const recentDomains = recent?.touchedDomains ?? [];
  if (recentDomains.length === 1 && recentDomains[0] === domains[0]) {
    return 0.52;
  }
  return 1;
}

function starvationBoost(
  run: LifeRun,
  pressures: WorldPressures,
  domains: LifeDomain[],
): number {
  const recentDomains = new Set(
    run.history.slice(-6).flatMap((entry) => entry.touchedDomains ?? []),
  );
  const starving = LIFE_DOMAINS.filter((domain) => (
    pressures[domain] >= 5 && !recentDomains.has(domain)
  ));
  if (starving.some((domain) => domains.includes(domain))) {
    return 1.55;
  }
  return 1;
}

function threadTouchesCareer(change: WorldChange): boolean {
  if (change.setFacts?.occupation === 'employed'
    || change.setFacts?.occupation === 'venture'
    || change.setFacts?.occupation === 'craft') {
    return true;
  }
  return (change.threads ?? []).some((item) => (
    item.domain === 'career' && ((item.intensityDelta ?? 0) > 0 || (item.intensity ?? 0) >= 4)
  ));
}

function threadSupportedByFacts(domain: LifeDomain, world: LifeWorld): boolean {
  if (domain === 'career') {
    return Boolean(world.facts.occupation && world.facts.occupation.value !== 'retired');
  }
  if (domain === 'family') {
    return world.facts.partnership?.value === 'home' || Boolean(world.facts.parenting);
  }
  if (domain === 'craft') {
    return world.facts.occupation?.value === 'craft';
  }
  if (domain === 'health') {
    return world.facts.health?.value === 'warning' || world.facts.health?.value === 'neglected';
  }
  return false;
}

function minimumSupportedIntensity(domain: LifeDomain, world: LifeWorld): number {
  if (domain === 'career' && world.facts.occupation?.value === 'searching') {
    return 4;
  }
  if (domain === 'family' && world.facts.parenting) {
    return 3;
  }
  return 2;
}

function inferDomainsFromDelta(delta: StatDelta): LifeDomain[] {
  const domains: LifeDomain[] = [];
  if (delta.health !== undefined) {
    domains.push('health');
  }
  if (delta.intellect !== undefined) {
    domains.push('learning');
  }
  if (delta.charm !== undefined) {
    domains.push('relationship');
  }
  if (delta.wealth !== undefined) {
    domains.push('career');
  }
  return domains;
}

function normalizeDomain(theme: string | undefined): LifeDomain | undefined {
  return theme ? THEME_TO_DOMAIN[theme] : undefined;
}

function describeFact(key: string, value: string): string {
  return FACT_LABELS[key]?.[value] ?? '';
}

function describeRelationPreview(change: RelationChange): string {
  if (change.remove) {
    return `${change.label ?? change.id}离开`;
  }
  if ((change.closenessDelta ?? 0) > 0 || change.closeness !== undefined) {
    return `${change.label ?? change.id}走近`;
  }
  if ((change.closenessDelta ?? 0) < 0) {
    return `${change.label ?? change.id}疏远`;
  }
  return '';
}

function describeThreadPreview(change: ThreadChange): string {
  if (change.resolve) {
    return `${change.label ?? change.id}告一段落`;
  }
  if ((change.intensityDelta ?? 0) > 0 || change.intensity !== undefined) {
    return `${change.label ?? DOMAIN_LABELS[change.domain ?? 'family']}加重`;
  }
  return '';
}

function formatStatPreview(delta: StatDelta): string {
  const labels: Record<(typeof STAT_KEYS)[number], string> = {
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

function mergeWorldChanges(
  base: WorldChange | undefined,
  extra: WorldChange,
): WorldChange {
  return {
    stats: mergeStatDeltas(base?.stats, extra.stats),
    addTags: unique([...(base?.addTags ?? []), ...(extra.addTags ?? [])]),
    setFacts: { ...(base?.setFacts ?? {}), ...(extra.setFacts ?? {}) },
    clearFacts: [...(base?.clearFacts ?? []), ...(extra.clearFacts ?? [])],
    relations: [...(base?.relations ?? []), ...(extra.relations ?? [])],
    threads: [...(base?.threads ?? []), ...(extra.threads ?? [])],
    marks: [...(base?.marks ?? []), ...(extra.marks ?? [])],
  };
}

function emptyPressures(): WorldPressures {
  return {
    health: 0,
    learning: 0,
    relationship: 0,
    career: 0,
    family: 0,
    travel: 0,
    craft: 0,
    legacy: 0,
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values.filter((item) => Boolean(item)))];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
