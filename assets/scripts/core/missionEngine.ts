import { FamilyContent, validateFamilyContent } from '../content/familyContent';
import {
  FamilyAbility,
  FamilyOptionDef,
  FamilyOptionGate,
  FamilySettlement,
  FamilyState,
  GenerationOutcome,
  GenerationRun,
  MissionDefinition,
  PendingFamilyEvent,
  PendingFamilyOption,
  FAMILY_ABILITY_NAMES,
  FAMILY_ABILITIES,
} from './familyModel';
import { categoryLevel, generationName, hasAccumulation, memberFor, ageSpanFor, computeMilestone, eraNameFor } from './familyEngine';
import { nextRandom, normalizeSeed } from './random';

// 任务引擎：任务筛选、阶段推进、条件判断、个人成长与代际结算。

function validateMission(mission: MissionDefinition, errors: string[]): void {
  const eventIds = new Set<string>();
  for (const e of mission.events) {
    if (eventIds.has(e.id)) errors.push(`${mission.id} 重复事件 ${e.id}`);
    eventIds.add(e.id);
    if (!e.title || !e.text) errors.push(`${mission.id}/${e.id} 文案缺失`);
    if (!e.options.length) errors.push(`${mission.id}/${e.id} 没有选项`);
    const optionIds = new Set<string>();
    const free = e.options.some(o => !o.effect.cost && !o.requires);
    if (!free) errors.push(`${mission.id}/${e.id} 缺少无条件可选的行动`);
    for (const o of e.options) {
      if (optionIds.has(o.id)) errors.push(`${mission.id}/${e.id} 重复选项 ${o.id}`);
      optionIds.add(o.id);
      if (!o.text || !o.preview || !o.effect.outcome) errors.push(`${mission.id}/${e.id}/${o.id} 文案缺失`);
    }
  }
  if (mission.progressKind === 'funds' && !mission.outcomeRules.fundsTarget) errors.push(`${mission.id} 缺少资金目标`);
  if (mission.progressKind === 'stages' && (!mission.outcomeRules.stageAchieved || !mission.outcomeRules.stagePartial)) errors.push(`${mission.id} 缺少阶段判定`);
  if (mission.progressKind === 'orders' && (!mission.outcomeRules.ordersAchieved || !mission.outcomeRules.ordersPartial)) errors.push(`${mission.id} 缺少订单判定`);
  for (const outcome of ['achieved', 'partial', 'failed'] as const) {
    if (!mission.settlementCopy[outcome]) errors.push(`${mission.id} 缺少${outcome}结算文案`);
  }
}

export function assertFamilyContent(content: FamilyContent): void {
  const errors = validateFamilyContent(content);
  for (const mission of content.missions) validateMission(mission, errors);
  const missionIds = new Set<string>();
  for (const mission of content.missions) {
    if (missionIds.has(mission.id)) errors.push(`重复任务 ${mission.id}`);
    missionIds.add(mission.id);
  }
  if (errors.length) throw new Error(`家庭玩法内容不完整：\n${errors.join('\n')}`);
}

export function missionEligible(mission: MissionDefinition, family: FamilyState): boolean {
  const el = mission.familyEligibility;
  if (el.minSecurity !== undefined && categoryLevel(family, 'security') < el.minSecurity) return false;
  if (el.maxSecurity !== undefined && categoryLevel(family, 'security') >= el.maxSecurity) return false;
  if (el.minGenerations !== undefined && family.generationCount < el.minGenerations) return false;
  if (el.minEducation !== undefined && categoryLevel(family, 'education') < el.minEducation) return false;
  if (el.minReputation !== undefined && categoryLevel(family, 'reputation') < el.minReputation) return false;
  if (el.requireAssets) {
    for (const id of el.requireAssets) if (!hasAccumulation(family, id)) return false;
  }
  return true;
}

function fallbackMission(family: FamilyState, content: FamilyContent): MissionDefinition | undefined {
  const security = categoryLevel(family, 'security');
  const preferred = security >= 1 ? 'independent-work' : 'stabilize-life';
  return content.missions.find(m => m.id === preferred) ?? content.missions[0];
}

export function selectMission(family: FamilyState, content: FamilyContent, rngState: number): { mission: MissionDefinition; state: number } {
  const eligible = content.missions.filter(m => missionEligible(m, family));
  const pool = eligible.length ? eligible : [fallbackMission(family, content)].filter((m): m is MissionDefinition => Boolean(m));
  if (!pool.length) throw new Error('家庭状态没有匹配的任务。');
  const priority: Record<string, number> = { 'shop-orders': 3, 'independent-work': 2, 'stabilize-life': 1 };
  const ordered = [...pool].sort((a, b) => (priority[b.id] ?? 0) - (priority[a.id] ?? 0));
  const top = ordered.filter(m => (priority[m.id] ?? 0) === (priority[ordered[0].id] ?? 0));
  const step = nextRandom(normalizeSeed(rngState));
  const mission = top[Math.floor(step.value * top.length)];
  return { mission, state: step.state };
}

function initialProgress(mission: MissionDefinition): GenerationRun['progress'] {
  if (mission.progressKind === 'funds') {
    return { kind: 'funds', label: mission.progressLabel, target: mission.target, amount: 0 };
  }
  if (mission.progressKind === 'stages') {
    return {
      kind: 'stages',
      label: mission.progressLabel,
      stages: [...(mission.stages ?? [])],
      currentStage: mission.stages?.[0] ?? '',
    };
  }
  return {
    kind: 'orders',
    label: mission.progressLabel,
    orders: (mission.orders ?? []).map(o => ({ id: o.id, label: o.label, done: false })),
  };
}

export function startGeneration(
  family: FamilyState,
  content: FamilyContent,
  seed: number,
  runId: string,
): { family: FamilyState; run: GenerationRun } {
  assertFamilyContent(content);
  const generation = family.generationCount + 1;
  const { mission, state } = selectMission(family, content, seed);
  const member = memberFor(content, generation, state);
  const routeStep = nextRandom(member.state);
  const routeFlag = routeStep.value < 0.5 ? 'route-a' : 'route-b';
  const allocated = family.funds;
  const snapshot = {
    funds: family.funds,
    securityLevel: categoryLevel(family, 'security'),
    assetNames: family.accumulations.filter(a => a.category === 'asset').map(a => a.name),
    educationLevel: categoryLevel(family, 'education'),
    reputationLevel: categoryLevel(family, 'reputation'),
  };
  const [ageStart, ageEnd] = ageSpanFor(content, generation);
  const run: GenerationRun = {
    id: runId,
    generation,
    memberName: member.name,
    memberRole: member.role,
    ageSpan: `${ageStart}–${ageEnd} 岁`,
    era: eraNameFor(content, generation),
    snapshot,
    budget: allocated,
    allocated,
    spent: 0,
    income: 0,
    abilities: { hands: 0, talk: 0, plan: 0 },
    missionId: mission.id,
    progress: initialProgress(mission),
    eventIndex: 0,
    resolvedEventIds: [],
    actionsTaken: [],
    flags: [routeFlag],
    earnedEvidence: [],
    grantedAssets: [],
    rngState: routeStep.state,
    status: 'active',
  };
  const pendingEvent = buildPendingEvent(run, family, mission);
  return { family: { ...family, funds: 0 }, run: { ...run, pendingEvent } };
}

// 派生标记：结算前根据实际进度补充，不改写已保存的 flags。
export function derivedFlags(run: GenerationRun, mission: MissionDefinition): string[] {
  const flags = [...run.flags];
  if (mission.progressKind === 'funds') {
    const target = run.progress.target ?? mission.outcomeRules.fundsTarget ?? 0;
    if ((run.progress.amount ?? 0) >= target) flags.push('enough-funds');
  }
  if (mission.progressKind === 'stages' && run.progress.currentStage === mission.outcomeRules.stageAchieved) {
    flags.push('work-accepted');
  }
  if (mission.progressKind === 'orders') {
    const done = ordersDone(run);
    if (done >= (mission.outcomeRules.ordersAchieved ?? 3)) flags.push('all-orders-done');
  }
  return flags;
}

function ordersDone(run: GenerationRun): number {
  return run.progress.orders?.filter(o => o.done).length ?? 0;
}

function gateReason(gate: FamilyOptionGate, run: GenerationRun, family: FamilyState, flags: string[]): string | undefined {
  if (gate.assetIds) {
    const missing = gate.assetIds.filter(id => !hasAccumulation(family, id));
    if (missing.length) return '需要家里有对应的积累。';
  }
  if (gate.educationMin !== undefined && categoryLevel(family, 'education') < gate.educationMin) return `需要家学 ${gate.educationMin} 级。`;
  if (gate.reputationMin !== undefined && categoryLevel(family, 'reputation') < gate.reputationMin) return `需要声誉 ${gate.reputationMin} 级。`;
  if (gate.securityMin !== undefined && categoryLevel(family, 'security') < gate.securityMin) return `需要生活保障 ${gate.securityMin} 级。`;
  if (gate.ability) {
    const level = run.abilities[gate.ability.ability];
    if (level < gate.ability.level) return `需要${FAMILY_ABILITY_NAMES[gate.ability.ability]} ${gate.ability.level}。`;
  }
  if (gate.flags) {
    const missing = gate.flags.filter(f => !flags.includes(f));
    if (missing.length) return '条件尚未达成。';
  }
  if (gate.anyOf) {
    for (const sub of gate.anyOf) {
      if (!gateReason(sub, run, family, flags)) return undefined;
    }
    return '条件尚未达成。';
  }
  return undefined;
}

function optionCostAndIncome(def: FamilyOptionDef, run: GenerationRun, family: FamilyState): { cost: number; income: number } {
  let cost = def.effect.cost ?? 0;
  let income = def.effect.income ?? 0;
  if (def.effect.payTarget && run.progress.kind === 'funds') {
    cost += Math.max(0, run.progress.target ?? 0);
  }
  const education = categoryLevel(family, 'education');
  const reputation = categoryLevel(family, 'reputation');
  if (education >= 2 && !def.effect.payTarget && (def.effect.abilities || def.effect.progress?.stage)) {
    cost = Math.max(0, cost - 1);
  }
  if (reputation >= 2 && (def.requires?.reputationMin || def.cashIn?.some(id => id.startsWith('reputation:')))) {
    income += 1;
  }
  return { cost, income };
}

function evaluateOption(def: FamilyOptionDef, run: GenerationRun, family: FamilyState, flags: string[]): PendingFamilyOption {
  const { cost, income } = optionCostAndIncome(def, run, family);
  const gateIssue = gateReason(def.requires ?? {}, run, family, flags);
  let reason = gateIssue ? (def.unmetText ?? gateIssue) : undefined;
  if (!reason && cost > run.budget) {
    reason = `需要预算 ${cost} 两，本代剩余 ${run.budget} 两`;
  }
  const sourceLabel = def.cashIn?.length
    ? def.cashIn.map(id => {
      const acc = family.accumulations.find(a => a.id === id);
      return acc ? `用了家里的${acc.name}` : undefined;
    }).filter((x): x is string => Boolean(x)).join(' · ')
    : undefined;
  let preview = def.preview;
  if (def.effect.payTarget && run.progress.kind === 'funds') {
    preview = `${def.preview}（扣除 ${cost} 两）`;
  }
  return {
    optionId: def.id,
    text: def.text,
    preview,
    cost,
    income,
    enabled: !reason,
    disabledReason: reason,
    sourceLabel,
  };
}

export function buildPendingEvent(run: GenerationRun, family: FamilyState, mission: MissionDefinition): PendingFamilyEvent {
  const flags = derivedFlags(run, mission);
  // 跳过不满足条件的分支事件
  let index = run.eventIndex;
  while (index < mission.events.length) {
    const def = mission.events[index];
    const skip = def.skipUnlessFlags && !def.skipUnlessFlags.every(f => flags.includes(f));
    if (!skip) break;
    index += 1;
  }
  const def = mission.events[index];
  if (!def) throw new Error('任务事件已全部结束。');
  const alt = def.alts && flags.includes('route-b') ? def.alts[0] : undefined;
  const options = def.options
    .filter(o => {
      // 兑现家庭积累的选项在条件不满足时隐藏，条件满足时作为「新打开的选项」出现。
      if (o.cashIn?.length) {
        return !gateReason(o.requires ?? {}, run, family, flags);
      }
      return true;
    })
    .map(o => evaluateOption(o, run, family, flags));
  if (!options.some(o => o.enabled && o.cost === 0)) {
    throw new Error(`事件 ${def.id} 缺少可免费执行的行动。`);
  }
  const instanceId = `${run.id}-event-${index + 1}`;
  return {
    instanceId,
    eventId: def.id,
    phase: def.phase,
    title: alt?.title ?? def.title,
    text: alt?.text ?? def.text,
    scene: alt?.scene ?? def.scene,
    isFinal: index === mission.events.length - 1,
    options,
  };
}

export function progressView(run: GenerationRun): string {
  const p = run.progress;
  if (p.kind === 'funds') {
    const remaining = Math.max(0, (p.target ?? 0) - (p.amount ?? 0));
    return `${p.label}：还需补足 ${remaining} 两（已 ${p.amount ?? 0} / ${p.target}）`;
  }
  if (p.kind === 'stages') {
    return `${p.label}：${p.stages?.join(' → ') ?? ''}（当前：${p.currentStage}）`;
  }
  const done = ordersDone(run);
  return `${p.label}：${done}/${p.orders?.length ?? 0} 单`;
}

export function chooseAndAdvance(
  run: GenerationRun,
  family: FamilyState,
  content: FamilyContent,
  instanceId: string,
  optionId: string,
): { run: GenerationRun; family: FamilyState; settlement?: FamilySettlement } {
  const mission = content.missions.find(m => m.id === run.missionId);
  if (!mission) throw new Error(`找不到任务 ${run.missionId}。`);
  if (run.status !== 'active' || !run.pendingEvent) return { run, family };
  const event = run.pendingEvent;
  if (event.instanceId !== instanceId) return { run, family };
  if (run.resolvedEventIds.includes(instanceId)) return { run, family };
  const def = mission.events[run.eventIndex];
  const optionDef = def?.options.find(o => o.id === optionId);
  if (!def || !optionDef) throw new Error('这个行动不属于当前事件。');
  const flags = derivedFlags(run, mission);
  const pending = evaluateOption(optionDef, run, family, flags);
  if (!pending.enabled) throw new Error(pending.disabledReason ?? '这个行动暂时无法执行。');

  const next = applyOption(run, optionDef, pending, event.instanceId);
  const nextIndex = skipIndex(next, mission, next.eventIndex + 1);
  if (nextIndex >= mission.events.length) {
    return settleRun(next, family, mission, content);
  }
  const pendingEvent = buildPendingEvent({ ...next, eventIndex: nextIndex }, family, mission);
  return { run: { ...next, eventIndex: nextIndex, pendingEvent }, family };
}

function skipIndex(run: GenerationRun, mission: MissionDefinition, from: number): number {
  const flags = derivedFlags(run, mission);
  let index = from;
  while (index < mission.events.length) {
    const def = mission.events[index];
    const skip = def.skipUnlessFlags && !def.skipUnlessFlags.every(f => flags.includes(f));
    if (!skip) break;
    index += 1;
  }
  return index;
}

function applyOption(
  run: GenerationRun,
  def: FamilyOptionDef,
  pending: PendingFamilyOption,
  instanceId: string,
): GenerationRun {
  const effect = def.effect;
  const changes: string[] = [];
  const abilities: Partial<Record<FamilyAbility, number>> = {};
  if (effect.abilities) {
    for (const ability of FAMILY_ABILITIES) {
      const delta = effect.abilities[ability] ?? 0;
      if (delta > 0) {
        const gain = Math.min(6, run.abilities[ability] + delta) - run.abilities[ability];
        if (gain > 0) {
          abilities[ability] = gain;
          changes.push(`${FAMILY_ABILITY_NAMES[ability]} +${gain}`);
        }
      }
    }
  }
  const budget = run.budget - pending.cost + pending.income;
  if (budget < 0) throw new Error('本代预算不足。');
  const progress = { ...run.progress };
  const pg = effect.progress;
  if (pg) {
    if (pg.amount) {
      progress.amount = (progress.amount ?? 0) + pg.amount;
    }
    if (pg.targetDelta) {
      progress.target = Math.max(4, (progress.target ?? 0) + pg.targetDelta);
    }
    if (pg.stage && progress.currentStage !== pg.stage) {
      const stages = progress.stages ?? [];
      const current = stages.indexOf(progress.currentStage ?? '');
      const target = stages.indexOf(pg.stage);
      if (target > current) {
        progress.currentStage = pg.stage;
        changes.push(`阶段推进：${pg.stage}`);
      }
    }
    if (pg.orderId && progress.orders) {
      const order = progress.orders.find(o => o.id === pg.orderId);
      if (order && !order.done) {
        order.done = true;
        changes.push(`交付订单：${order.label}`);
      }
    }
  }
  // 资金类任务：实际收入计入「已补足」进度；协商类选项通过 targetDelta 降低目标。
  if (progress.kind === 'funds' && pending.income > 0) {
    progress.amount = (progress.amount ?? 0) + pending.income;
  }
  const feedbackText = effect.outcome;
  if (pending.cost) changes.push(`花费预算 ${pending.cost} 两`);
  if (pending.income) changes.push(`收入 ${pending.income} 两`);
  if (pending.sourceLabel) changes.push(pending.sourceLabel);
  const flags = [...run.flags, ...(effect.flags ?? [])];
  const earnedEvidence = [...run.earnedEvidence, ...(effect.evidence ?? [])];
  const grantedAssets = effect.grantAsset
    ? [...run.grantedAssets, { ...effect.grantAsset, source: { generation: run.generation, text: `第${generationName(run.generation)}代：${effect.grantAsset.name}` } }]
    : run.grantedAssets;
  const action: GenerationRun['actionsTaken'][number] = {
    eventId: instanceId,
    optionId: def.id,
    optionText: def.text,
    feedback: feedbackText,
    budgetDelta: pending.income - pending.cost,
    abilities,
    cashIn: def.cashIn ?? [],
  };
  return {
    ...run,
    budget,
    spent: run.spent + pending.cost,
    income: run.income + pending.income,
    abilities: { ...run.abilities, ...Object.fromEntries(Object.entries(abilities).map(([k, v]) => [k, (run.abilities[k as FamilyAbility] ?? 0) + (v ?? 0)])) },
    progress,
    flags,
    earnedEvidence,
    grantedAssets,
    actionsTaken: [...run.actionsTaken, action],
    resolvedEventIds: [...run.resolvedEventIds, instanceId],
    recentFeedback: { sourceEventId: instanceId, text: feedbackText, changes },
    pendingEvent: undefined,
  };
}

export function computeOutcome(run: GenerationRun, mission: MissionDefinition): GenerationOutcome {
  const p = run.progress;
  if (p.kind === 'funds') {
    const target = p.target ?? mission.outcomeRules.fundsTarget ?? 0;
    const amount = p.amount ?? 0;
    if (amount >= target) return 'achieved';
    if (amount >= Math.ceil(target * (mission.outcomeRules.partialRatio ?? 0.5))) return 'partial';
    return 'failed';
  }
  if (p.kind === 'stages') {
    if (p.currentStage === mission.outcomeRules.stageAchieved) return 'achieved';
    if (p.currentStage === mission.outcomeRules.stagePartial) return 'partial';
    return 'failed';
  }
  const done = ordersDone(run);
  if (done >= (mission.outcomeRules.ordersAchieved ?? 3)) return 'achieved';
  if (done >= (mission.outcomeRules.ordersPartial ?? 2)) return 'partial';
  return 'failed';
}

export function settleRun(
  run: GenerationRun,
  family: FamilyState,
  mission: MissionDefinition,
  content: FamilyContent,
): { run: GenerationRun; family: FamilyState; settlement: FamilySettlement } {
  const outcome = computeOutcome(run, mission);
  const earnedEvidence = outcome === 'failed'
    ? run.earnedEvidence.filter(id => id !== 'delivered')
    : run.earnedEvidence;
  const evidence = unique([...family.evidence.map(e => e.id), ...earnedEvidence]);
  const evidenceAdded = earnedEvidence.filter(id => !family.evidence.some(e => e.id === id));
  const accumulations = [...family.accumulations];
  const contributions = [...family.contributions];
  const itemsGained: string[] = [];
  for (const asset of run.grantedAssets) {
    const existing = accumulations.find(a => a.id === asset.id);
    if (!existing) {
      accumulations.push({ ...asset, source: { generation: run.generation, text: `第${generationName(run.generation)}代：${asset.name}` } });
      contributions.push({ id: `contrib-${run.id}-${asset.id}`, generation: run.generation, text: `第${generationName(run.generation)}代：${asset.name}`, kind: asset.category, runId: run.id });
      itemsGained.push(asset.name);
    }
  }
  const familyFundsAfter = family.funds + run.budget;
  const eraIndex = Math.min(family.generationCount + 1, content.eraNames.length - 1);
  const updatedFamily: FamilyState = {
    ...family,
    funds: familyFundsAfter,
    eraIndex,
    era: content.eraNames[eraIndex],
    generationCount: family.generationCount + 1,
    accumulations,
    evidence: evidence.map((id) => {
      const existing = family.evidence.find(e => e.id === id);
      return existing ?? { id, text: evidenceText(id), generation: run.generation };
    }),
    milestone: computeMilestone({ ...family, accumulations }),
    history: [
      ...family.history,
      {
        runId: run.id,
        generation: run.generation,
        memberName: run.memberName,
        memberRole: run.memberRole,
        ageSpan: run.ageSpan,
        era: run.era,
        outcome,
        missionTitle: mission.title,
        summary: mission.settlementCopy[outcome],
        leftForFamily: leftForFamilyList(run, itemsGained, earnedEvidence),
        netFunds: run.budget - run.allocated,
      },
    ],
    contributions,
  };
  const next = memberFor(content, run.generation + 1, run.rngState);
  const settlement: FamilySettlement = {
    runId: run.id,
    generation: run.generation,
    memberName: run.memberName,
    memberRole: run.memberRole,
    outcome,
    missionTitle: mission.title,
    goalResult: mission.settlementCopy[outcome],
    net: { spent: run.spent, income: run.income, budgetReturned: run.budget, familyFundsAfter },
    itemsGained,
    knowledgeGained: evidenceAdded.map(id => evidenceText(id)),
    leftForFamily: leftForFamilyList(run, itemsGained, earnedEvidence),
    contributions: contributions.filter(c => c.runId === run.id),
    evidenceAdded,
    summary: `${run.memberName}这一代：${mission.settlementCopy[outcome]}`,
    nextMember: { name: next.name, role: next.role },
  };
  return {
    run: { ...run, status: 'settled', pendingEvent: undefined, recentFeedback: run.recentFeedback },
    family: updatedFamily,
    settlement,
  };
}

function leftForFamilyList(run: GenerationRun, itemsGained: string[], evidenceIds: string[] = run.earnedEvidence): string[] {
  const lines: string[] = [];
  if (run.budget > 0) lines.push(`本代预算结余 ${run.budget} 两`);
  for (const name of itemsGained) lines.push(`家里留下了${name}`);
  for (const ev of evidenceIds) lines.push(evidenceText(ev));
  return lines;
}

export function evidenceText(id: string): string {
  switch (id) {
    case 'delivered': return '曾按时交付，留下可靠的交付记录';
    case 'learned': return '曾真正学过知识与方法';
    case 'crafted': return '曾亲手做过手艺活';
    case 'reserved': return '曾为家里备下储备';
    default: return '留下了一段实际的经历';
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}