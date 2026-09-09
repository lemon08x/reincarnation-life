import { SPECIALTIES, scenesFor, validateGrowthContent } from '../content/growthContent';
import { startLife as legacyStart } from './legacyLifeEngine';
import { Ability, ABILITIES, ABILITY_NAMES, GROWTH_AGES, GROWTH_RECALLS, GROWTH_RULES_VERSION, GrowthChoice, GrowthScene, GrowthState, PLACE_NAMES, SKILL_NAMES, initialGrowth } from './growthModel';
import { ExperienceFragment, GameContent, LifeRun, PendingOption, RecallStance, ReincarnatorProfile, Understanding } from './model';
import { pickWeighted } from './random';

export function assertGrowthContent(): void {
  const errors = validateGrowthContent();
  if (errors.length) throw new Error(errors.join('\n'));
}
const ownFragments = (r: LifeRun): ExperienceFragment[] => r.fragments.filter(f => f.runId === r.id);
const theme = (a: Ability): 'trust' | 'belonging' | 'worth' => a === 'talk' ? 'trust' : a === 'plan' ? 'belonging' : 'worth';
const unique = <T>(values: T[]): T[] => Array.from(new Set(values));
const interpolate = (text: string, g: GrowthState): string => text.replace(/\{place\}/g, PLACE_NAMES[g.place]);

export function startGrowthLife(profile: ReincarnatorProfile, seed: number, id: string, carried: string[], content: GameContent): LifeRun {
  assertGrowthContent();
  // Reuse birth and archive contracts, but never inherit abilities or active specialties from a past life.
  const birth = legacyStart(profile, seed, id, carried, content);
  const g = initialGrowth();
  const world = { ...birth.world, relations: [...birth.world.relations, { id: 'friend', kind: 'friend' as const, label: '阿岑', closeness: 5, strain: 0, sinceAge: 12, lastTouchedAge: 12 }] };
  return nextGrowthEncounter({ ...birth, world, growth: g, age: GROWTH_AGES[0], rulesVersion: GROWTH_RULES_VERSION,
    lifePoints: 0, lifePointCap: 0, lifePointLog: [], nextEncounterSeq: 1, pendingEncounter: undefined });
}

export function growthOpportunityWeight(scene: GrowthScene, g: GrowthState): number {
  if (!scene.opportunity) return 1;
  const a: Ability = scene.opportunity === 'town' ? 'hands' : scene.opportunity === 'harbor' ? 'plan' : 'talk';
  // Every reasonable opportunity retains positive weight; early learning cannot lock a career.
  return 4 + Math.min(2, g.abilities[a]) + (g.intention === 'learn' && scene.opportunity === 'town' ? 2 : 0)
    + (g.intention === 'earn' && scene.opportunity === 'market' ? 2 : 0)
    + (g.intention === 'explore' && scene.opportunity !== g.place ? 3 : 0);
}

function supportIds(run: LifeRun, c: GrowthChoice): string[] {
  const g = run.growth!;
  if (c.specialtyId) return g.specialties.find(s => s.id === c.specialtyId)?.sourceFragmentIds ?? [];
  if (c.ability) return g.records.filter(r => (r.abilities[c.ability!] ?? 0) > 0 || r.learned.includes(c.skill ?? '')).map(r => r.fragmentId);
  return [];
}

function freezeOption(run: LifeRun, c: GrowthChoice): PendingOption {
  const g = run.growth!;
  const gainKeys = ABILITIES.filter(a => (c.effect.gain?.[a] ?? 0) > 0);
  const fullyTrained = gainKeys.length > 0 && gainKeys.every(a => g.abilities[a] >= 6);
  const unmet = c.cost && !c.effect.money && fullyTrained ? '这项本领已熟练，无需再为练习支付家底'
    : c.specialtyId && !g.specialties.some(s => s.id === c.specialtyId) ? '尚未形成这项专长'
    : c.ability && g.abilities[c.ability] < (c.level ?? 0) ? `需要${ABILITY_NAMES[c.ability]} ${c.level}，当前 ${g.abilities[c.ability]}`
    : c.skill && !g.skills.includes(c.skill) ? `尚未学会${SKILL_NAMES[c.skill]}`
    : (c.cost ?? 0) > g.money ? `需要家底 ${c.cost}，当前 ${g.money}` : undefined;
  const sources = supportIds(run, c);
  const source = run.fragments.find(f => f.id === sources[0]);
  let preview = c.preview;
  for (const a of gainKeys) {
    const amount = Math.min(6 - g.abilities[a], c.effect.gain![a]!);
    preview = preview.replace(new RegExp(`${ABILITY_NAMES[a]} \\+\\d+`, 'g'), amount ? `${ABILITY_NAMES[a]} +${amount}` : `${ABILITY_NAMES[a]}已熟练`);
  }
  return { choiceId: c.id, text: c.text, preview, cost: c.cost ?? 0, costKind: 'free', enabled: !unmet,
    disabledReason: unmet, supportedByFragmentIds: sources,
    supportReason: source && !unmet ? `用上了 ${source.age} 岁积下的办法${c.specialtyId ? ` · ${g.specialties.find(s => s.id === c.specialtyId)?.name}` : ''}` : undefined };
}

function nextGrowthEncounter(run: LifeRun): LifeRun {
  const g = run.growth!;
  const slot = run.encounterCount;
  if (slot >= GROWTH_AGES.length) return closeGrowthLife(run);
  const candidates = scenesFor(g, slot);
  const pick = pickWeighted(candidates, run.rngState, s => growthOpportunityWeight(s, g));
  const s = pick.item;
  const sources = s.continuation ? ownFragments(run).slice(-1).map(f => f.id) : [];
  const options = s.choices.map(c => freezeOption(run, c));
  if (!options.some(o => o.enabled && !o.cost)) throw new Error(`成长事件缺少免费行动：${s.id}`);
  const recalled = unique(options.filter(o => o.enabled).flatMap(o => o.supportedByFragmentIds)).slice(0, 2);
  const age = GROWTH_AGES[slot];
  const note = slot === 0 ? '出生决定起点，后来的路还没有写好。'
    : s.opportunity ? '一次新的机会出现了；接受、留下，都由你决定。'
    : [3, 6, 9].includes(slot) ? '旧本领遇见新处境，看看这次有哪些从前没有的办法。'
    : `${PLACE_NAMES[g.place]}的日子继续往前，你带着已有的积累作出安排。`;
  return { ...run, age, rngState: pick.state, nextEncounterSeq: run.nextEncounterSeq + 1, turnState: 'awaiting-response', pendingRecall: undefined, pendingResult: undefined,
    pendingEncounter: { instanceId: `${run.id}-enc-${run.nextEncounterSeq}`, templateId: s.id, age, title: s.title,
      text: interpolate(s.text, g), sceneKind: s.kind, theme: theme(g.goal?.approach ?? 'hands'), triggerKind: sources.length ? 'consequence' : 'chance', triggerNote: note,
      triggerSourceIds: sources, boundPeople: run.world.relations.map(r => ({ role: r.id, relationId: r.id, label: r.label })),
      recalledFragmentIds: recalled, recalledNotes: recalled.map(id => { const f = run.fragments.find(x => x.id === id)!; return `${f.age} 岁，你曾${f.howIResponded.split('。')[0]}。`; }), options, rngState: pick.state } };
}

export function submitGrowthResponse(run: LifeRun, instanceId: string, choiceId: string): LifeRun {
  if (run.status !== 'active' || run.resolvedEncounterIds.includes(instanceId)) return run;
  const p = run.pendingEncounter;
  if (run.turnState !== 'awaiting-response' || !p || p.instanceId !== instanceId) return run;
  const s = scenesFor(run.growth!, run.encounterCount).find(x => x.id === p.templateId);
  const c = s?.choices.find(x => x.id === choiceId);
  if (!c) throw new Error('这个行动不属于当前事件。');
  const frozen = freezeOption(run, c);
  if (!frozen.enabled || !p.options.some(o => o.choiceId === choiceId && o.enabled)) throw new Error(frozen.disabledReason ?? '这个行动暂时无法执行。');
  const g = JSON.parse(JSON.stringify(run.growth)) as GrowthState;
  const id = `${run.id}-frag-${run.nextFragmentSeq}`;
  const changes: string[] = [];
  const actualGain: Partial<Record<Ability, number>> = {};
  for (const a of ABILITIES) {
    const delta = Math.min(6, g.abilities[a] + (c.effect.gain?.[a] ?? 0)) - g.abilities[a];
    if (delta) { g.abilities[a] += delta; actualGain[a] = delta; changes.push(`${ABILITY_NAMES[a]} +${delta} · 现在 ${g.abilities[a]} / 6`); }
    else if ((c.effect.gain?.[a] ?? 0) > 0) changes.push(`${ABILITY_NAMES[a]}已熟练 · 保留已经掌握的办法`);
  }
  const learned = c.effect.learn && !g.skills.includes(c.effect.learn) ? [c.effect.learn] : [];
  g.skills = unique([...g.skills, ...learned]);
  changes.push(...learned.map(skill => `学会本领：${SKILL_NAMES[skill]}`));
  const cash = (c.effect.money ?? 0) - (c.cost ?? 0);
  g.money += cash;
  if (c.cost) changes.push(`支付家底 ${c.cost}`);
  if (c.effect.money) changes.push(`获得家底 ${c.effect.money}`);
  const from = g.place;
  if (c.effect.place) g.place = c.effect.place;
  if (c.effect.identity) { g.identity = c.effect.identity; changes.push(`现在的生活：${PLACE_NAMES[g.place]} · ${g.identity}`); }
  if (c.effect.place || c.effect.identity) g.transitions.push({ fragmentId: id, from, to: g.place, identity: g.identity });
  if (c.effect.intention) { g.intention = c.effect.intention; changes.push(`为往后准备：${g.intention === 'earn' ? '积攒家底' : g.intention === 'explore' ? '打听外面的机会' : '继续学本领'}`); }
  if (c.effect.goal) { g.goal = { ...c.effect.goal, status: 'active' }; changes.push(`眼前打算：${g.goal.title}`); }
  if (c.effect.finishGoal && g.goal) { g.goal.status = 'complete'; g.goal.result = c.effect.achievement; changes.push(`做成了：${g.goal.title}`); }
  if (c.effect.achievement) g.achievements.push(c.effect.achievement);
  const use = c.specialtyId ? g.specialties.find(x => x.id === c.specialtyId) : undefined;
  if (use) changes.push(`专长派上用场：${use.name}`);
  else if (c.ability) changes.push(`用上积累：${ABILITY_NAMES[c.ability]}`);
  const record = { fragmentId: id, abilities: actualGain, learned, money: cash, usedAbility: c.ability, usedSpecialtyId: c.specialtyId, note: changes.join('；') || c.later };
  g.records.push(record);
  const effectRelation = c.effect.relation;
  const relations = run.world.relations.filter(r => r.id !== effectRelation?.id);
  if (effectRelation) relations.push({ id: effectRelation.id, kind: 'community', label: effectRelation.label, closeness: 5, strain: 0, sinceAge: run.age, lastTouchedAge: run.age });
  const world = { ...run.world, relations, facts: { ...run.world.facts, residence: { value: PLACE_NAMES[g.place], sinceAge: run.age }, occupation: { value: g.identity, sinceAge: run.age } } };
  const understanding = use ? run.understandings.find(u => u.id === use.understandingId) : undefined;
  const fragment: ExperienceFragment = { id, contentKey: `growth:${p.templateId}:${c.id}`, runId: run.id, age: run.age, encounterInstanceId: p.instanceId, templateId: p.templateId,
    theme: theme(c.ability ?? ABILITIES.find(a => (c.effect.gain?.[a] ?? 0) > 0) ?? 'hands'), people: p.boundPeople,
    whatHappened: p.text, howIResponded: `${c.text}。${c.outcome}`, choiceId: c.id, outcomeId: c.id, costPaid: c.cost ?? 0,
    fragmentTags: [...Object.keys(actualGain), ...learned, ...(c.specialtyId ? [c.specialtyId] : [])], recalledFragmentIds: frozen.supportedByFragmentIds,
    understandingAtTime: understanding?.statement, understandingId: understanding?.id,
    laterWhat: [c.later, ...changes], triggerKind: p.triggerKind, triggerNote: p.triggerNote, triggerSourceIds: p.triggerSourceIds, worldChanges: changes };
  const fragments = run.fragments.map(f => p.triggerSourceIds.includes(f.id) ? { ...f, laterWhat: [...f.laterWhat, `${run.age} 岁：${c.outcome}`] } : f);
  return { ...run, growth: g, world, tags: unique([...run.tags, ...fragment.fragmentTags]), fragments: [...fragments, fragment], encounterCount: run.encounterCount + 1,
    nextFragmentSeq: run.nextFragmentSeq + 1, usedTemplateIds: [...run.usedTemplateIds, p.templateId], resolvedEncounterIds: [...run.resolvedEncounterIds, p.instanceId],
    pendingEncounter: undefined, turnState: 'showing-result', pendingResult: { instanceId: p.instanceId, fragmentId: id, title: p.title, response: c.text, outcome: c.outcome, consequence: c.later, changes, costPaid: c.cost ?? 0, sceneKind: p.sceneKind } };
}

function recallGrowth(run: LifeRun): LifeRun {
  const g = run.growth!;
  const candidates = SPECIALTIES.filter(s => g.abilities[s.ability] > 0 && !g.specialties.some(x => x.id === s.id))
    .sort((a, b) => g.abilities[b.ability] - g.abilities[a.ability]).slice(0, 3);
  if (candidates.length < 2) throw new Error('回望缺少有经历支持的专长。');
  const evidence = unique(candidates.flatMap(s => g.records.filter(r => (r.abilities[s.ability] ?? 0) > 0).slice(-2).map(r => r.fragmentId)));
  const stances: RecallStance[] = ['hold', 'revise', 'question'];
  return { ...run, turnState: 'awaiting-recall', pendingResult: undefined, pendingEncounter: undefined,
    pendingRecall: { instanceId: `${run.id}-recall-${run.recallCount + 1}`, recallIndex: run.recallCount === 0 ? 1 : 2,
      seedId: 'growth-specialty', fragmentIds: evidence, prompt: '这些事情确实是你做过的。想想其中哪一种方法，值得带进接下来的生活。职业还会变化，会做的事已经留在身上。',
      options: candidates.map((s, i) => ({ stance: stances[i], specialtyId: s.id, label: s.name, statement: s.statement, effectHint: s.effect })) } };
}

export function continueGrowthResult(run: LifeRun, resultId: string): LifeRun {
  if (run.status !== 'active' || run.turnState !== 'showing-result' || run.pendingResult?.instanceId !== resultId) return run;
  if ((GROWTH_RECALLS as readonly number[]).includes(run.encounterCount) && run.recallCount < GROWTH_RECALLS.indexOf(run.encounterCount as 3 | 6) + 1) return recallGrowth(run);
  return nextGrowthEncounter({ ...run, pendingResult: undefined });
}

export function submitGrowthRecall(run: LifeRun, instanceId: string, stance: RecallStance): LifeRun {
  if (run.status !== 'active' || run.resolvedRecallIds.includes(instanceId)) return run;
  const p = run.pendingRecall;
  if (!p || p.instanceId !== instanceId || run.turnState !== 'awaiting-recall') return run;
  const option = p.options.find(o => o.stance === stance);
  const def = SPECIALTIES.find(s => s.id === option?.specialtyId);
  if (!option || !def) throw new Error('请选择这次回望中的一种方法。');
  const g = run.growth!;
  if (g.specialties.length >= 2 || g.specialties.some(s => s.id === def.id)) throw new Error('这项专长已经记录。');
  const sources = g.records.filter(r => (r.abilities[def.ability] ?? 0) > 0).slice(-2).map(r => r.fragmentId);
  if (!sources.length) throw new Error('专长需要真实的经历来源。');
  const id = `${run.id}-und-${run.nextUnderstandingSeq}-v1`;
  const understanding: Understanding = { id, contentKey: `specialty:${def.id}`, theme: theme(def.ability), statement: `${def.name}：${def.statement}`, stance, effectiveStance: stance, version: 1,
    sourceFragmentIds: sources, createdInRunId: run.id, createdAtAge: run.age };
  return nextGrowthEncounter({ ...run, growth: { ...g, specialties: [...g.specialties, { id: def.id, name: def.name, ability: def.ability, sourceFragmentIds: sources, understandingId: id }] },
    understandings: [...run.understandings, understanding], recallCount: run.recallCount + 1, nextUnderstandingSeq: run.nextUnderstandingSeq + 1,
    resolvedRecallIds: [...run.resolvedRecallIds, instanceId], pendingRecall: undefined });
}

function closeGrowthLife(run: LifeRun): LifeRun {
  const g = run.growth!;
  return { ...run, turnState: 'awaiting-archive', status: 'awaiting-archive', pendingEncounter: undefined, pendingRecall: undefined, pendingResult: undefined,
    closing: { title: `后来，你在${PLACE_NAMES[g.place]}留下了自己的生活`,
      text: `八十一岁，你回看最初的那只木箱。那时并不知道自己后来会成为${g.identity}。${g.transitions.filter(t => t.from !== t.to).length ? '你去过不同的地方，也重新安排过生活。' : '你在熟悉的地方，一点点积下了自己的办法。'} 机会并非都由你决定，但会做的事情、认真履行的约定，以及真正做成的成果，都没有白白经过。`,
      shapedBy: g.records.map(r => { const f = run.fragments.find(x => x.id === r.fragmentId)!; return `${f.age} 岁：${r.note}`; }),
      changed: [...ABILITIES.map(a => `${ABILITY_NAMES[a]}：${g.abilities[a]} / 6`), ...g.skills.map(s => `学会了${SKILL_NAMES[s]}`), ...g.specialties.map(s => `形成方法：${s.name}`)],
      unresolved: [...g.achievements, `留下家底 ${g.money}，现在的身份是${g.identity}`],
      unfulfilled: g.goal?.status === 'active' ? [`尚未完成的打算：${g.goal.title}`] : [] } };
}
