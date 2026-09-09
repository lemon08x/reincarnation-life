import {
  BuildingCategory,
  BuildingOption,
  FAMILY_ABILITY_NAMES,
  FAMILY_MILESTONE_DESCRIPTIONS,
  FAMILY_MILESTONE_NAMES,
  FamilySave,
  FamilyState,
} from '../../core/familyModel';
import { buildChapterSummary, categoryLevel, computeMilestone, presentStageLabel } from '../../core/familyEngine';
import { progressView } from '../../core/missionEngine';
import { FamilyContent } from '../../content/familyContent';
import { SCENE_VISUALS, SceneVisual } from './visualConfig';
import { ACTION_LABELS } from './familyVisualCopy';
import {
  FamilyEventOptionView,
  FamilyEventView,
  FamilyHistoryView,
  FamilyHomeView,
  FamilyMemberView,
  FamilySettlementView,
} from './familyUiModels';

const CATEGORY_NAMES: Record<BuildingCategory, string> = {
  security: '生活保障',
  asset: '生产资产',
  education: '教育与家学',
  reputation: '声誉与联系',
};

function familyScene(houseLevel: number, assetLevel: number, reputationLevel: number): SceneVisual {
  if (assetLevel >= 2 || reputationLevel >= 2) return SCENE_VISUALS.commerce;
  if (assetLevel >= 1) return SCENE_VISUALS.craft;
  void houseLevel;
  return SCENE_VISUALS.hearth;
}

export function presentFamilyHome(
  save: FamilySave,
  content: FamilyContent,
  buildings: BuildingOption[],
): FamilyHomeView {
  const family = save.family;
  if (!family) throw new Error('还没有家庭。');
  const run = save.currentRun;
  const houseLevel = categoryLevel(family, 'security');
  const assetLevel = categoryLevel(family, 'asset');
  const educationLevel = categoryLevel(family, 'education');
  const reputationLevel = categoryLevel(family, 'reputation');
  const last = family.history[family.history.length - 1];
  const chapter = buildChapterSummary(family, content);
  return {
    familyName: family.name,
    era: family.era,
    generationCount: family.generationCount,
    stage: presentStageLabel(family),
    stageNote: FAMILY_MILESTONE_DESCRIPTIONS[computeMilestone(family)],
    funds: family.funds,
    lastContribution: last ? `${last.memberName}（第${last.generation}代 · ${last.missionTitle}）` : '还没有完成的代际。',
    lastOutcome: last ? last.summary : '从第一代开始，让家里的日子先立起来。',
    runStatus: !run ? 'none' : run.status === 'active' ? 'active' : 'settled',
    primaryAction: run?.status === 'active' ? 'continue' : 'start',
    showMember: Boolean(run),
    continueCaption: run?.status === 'active'
      ? `${run.memberName}正在做「${missionTitleFor(content, run.missionId)}」：${progressView(run)}`
      : run?.status === 'settled'
        ? `${run.memberName}的「${missionTitleFor(content, run.missionId)}」已结算，可以开始下一代。`
        : undefined,
    buildings: buildings.map(b => ({
      id: b.id,
      category: b.category,
      categoryName: CATEGORY_NAMES[b.category],
      name: b.name,
      cost: b.cost,
      benefit: b.benefit,
      available: b.available,
      unavailableReason: b.unavailableReason,
      affordable: b.affordable,
      builtThisIntermission: b.intermissionUsed,
    })),
    chapterSummary: chapter ?? undefined,
    scene: familyScene(houseLevel, assetLevel, reputationLevel),
    houseLevel,
    assetLevel,
    educationLevel,
    reputationLevel,
  };
}

export function presentFamilyEvent(save: FamilySave, content: FamilyContent): FamilyEventView {
  const run = save.currentRun;
  const family = save.family;
  const pending = run?.pendingEvent;
  if (!run || !family || !pending) throw new Error('当前没有等待回应的事件。');
  const mission = content.missions.find(m => m.id === run.missionId);
  if (!mission) throw new Error('找不到当前任务。');
  return {
    familyName: family.name,
    generation: run.generation,
    visual: {
      kind: run.progress.kind,
      amount: run.progress.kind === 'funds' ? run.progress.amount ?? 0 : run.progress.kind === 'orders' ? run.progress.orders?.filter(o => o.done).length ?? 0 : (run.progress.stages?.indexOf(run.progress.currentStage ?? '') ?? 0) + 1,
      target: run.progress.kind === 'funds' ? run.progress.target ?? 8 : run.progress.kind === 'orders' ? run.progress.orders?.length ?? 3 : run.progress.stages?.length ?? 3,
      slots: run.progress.kind === 'orders' ? (run.progress.orders ?? []).map(o => ({label:o.label,done:o.done})) : (run.progress.stages ?? []).map((s,i) => ({label:s,done:i <= (run.progress.stages?.indexOf(run.progress.currentStage ?? '') ?? -1)})),
      phase: pending.phase, stage: run.progress.currentStage ?? '', abilities: {...run.abilities},
      assets: {security:categoryLevel(family,'security'),asset:categoryLevel(family,'asset'),education:categoryLevel(family,'education'),reputation:categoryLevel(family,'reputation')},
    },
    memberName: run.memberName,
    memberRole: run.memberRole,
    era: run.era,
    ageSpan: run.ageSpan,
    missionTitle: mission.title,
    goalText: mission.goalText,
    progressLine: `${progressView(run)} · 本代预算 ${run.budget} 两`,
    budget: run.budget,
    feedback: run.recentFeedback,
    instanceId: pending.instanceId,
    phase: phaseName(pending.phase),
    title: pending.title,
    text: pending.text,
    isFinal: pending.isFinal,
    options: pending.options.map((o): FamilyEventOptionView => {
      const def = mission.events.find(e=>e.id===pending.eventId)?.options.find(c=>c.id===o.optionId);
      const effect = def?.effect;
      const icon: NonNullable<FamilyEventOptionView['icon']> = effect?.grantAsset ? (effect.grantAsset.category === 'education' ? 'book' : effect.grantAsset.category === 'asset' ? 'hammer' : 'home') : /mentor|apprentice|negotiate|reputation|merchant|ask-/.test(o.optionId) ? 'person' : /repair|redo|tools|workshop|make|batch/.test(o.optionId) ? 'hammer' : /notes|teaching|write|books|rules|sort/.test(o.optionId) ? 'book' : effect?.progress?.orderId ? 'chair' : effect?.payTarget ? 'coin' : o.income ? 'box' : 'clock';
      const rewards: NonNullable<FamilyEventOptionView['rewards']> = [];
      if(o.cost) rewards.push({icon:'coin',text:`−${o.cost}`});
      if(o.income) rewards.push({icon:'coin',text:`+${o.income}`});
      for(const a of ['hands','talk','plan'] as const) { const gain=Math.min(6-run.abilities[a],effect?.abilities?.[a]??0);if(gain>0)rewards.push({icon:a==='hands'?'hammer':a==='talk'?'person':'book',text:`+${gain}`}); }
      if(effect?.progress?.orderId)rewards.push({icon:'chair',text:run.progress.orders?.find(x=>x.id===effect.progress?.orderId)?.done?'已交付':'+1'});
      if(effect?.progress?.stage)rewards.push({icon:'check',text:effect.progress.stage});
      if(effect?.progress?.targetDelta)rewards.push({icon:'coin',text:`目标 ${effect.progress.targetDelta}`});
      if(effect?.grantAsset)rewards.push({icon,text:'留下'});
      return {
      optionId: o.optionId,
      text: o.text,
      preview: o.preview,
      cost: o.cost,
      income: o.income,
      enabled: o.enabled,
      disabledReason: o.disabledReason,
      sourceLabel: o.sourceLabel,
      shortLabel: ACTION_LABELS[o.optionId] ?? o.text, icon, rewards,
    };}),
    scene: SCENE_VISUALS[pending.scene],
  };
}

export function presentFamilySettlement(save: FamilySave, content: FamilyContent): FamilySettlementView {
  const family = save.family;
  const settlement = save.lastSettlement;
  const run = save.currentRun;
  if (!family || !settlement) throw new Error('还没有可展示的结算。');
  const chapter = run && run.generation >= 3 ? buildChapterSummary(family, content) : null;
  return {
    familyName: family.name,
    generation: settlement.generation,
    memberName: settlement.memberName,
    memberRole: settlement.memberRole,
    era: run?.era ?? family.era,
    outcome: settlement.outcome,
    outcomeName: GENERATION_OUTCOME_LABELS[settlement.outcome],
    missionTitle: settlement.missionTitle,
    goalResult: settlement.goalResult,
    netSpent: settlement.net.spent,
    netIncome: settlement.net.income,
    budgetReturned: settlement.net.budgetReturned,
    familyFundsAfter: settlement.net.familyFundsAfter,
    itemsGained: settlement.itemsGained,
    knowledgeGained: settlement.knowledgeGained,
    leftForFamily: settlement.leftForFamily,
    evidenceAdded: settlement.evidenceAdded,
    summary: settlement.summary,
    nextMember: `${settlement.nextMember.name}（${settlement.nextMember.role}）`,
    chapterSummary: chapter ?? undefined,
    scene: SCENE_VISUALS.dusk,
  };
}

const GENERATION_OUTCOME_LABELS: Record<'achieved' | 'partial' | 'failed', string> = {
  achieved: '达成目标',
  partial: '部分达成',
  failed: '未达成',
};

export function presentFamilyHistory(save: FamilySave): FamilyHistoryView {
  const family = save.family;
  if (!family) throw new Error('还没有家庭。');
  return {
    familyName: family.name,
    stage: presentStageLabel(family),
    generations: family.history.map(h => ({
      generation: h.generation,
      memberName: h.memberName,
      memberRole: h.memberRole,
      ageSpan: h.ageSpan,
      era: h.era,
      outcome: h.outcome,
      outcomeName: GENERATION_OUTCOME_LABELS[h.outcome],
      missionTitle: h.missionTitle,
      summary: h.summary,
      leftForFamily: h.leftForFamily,
      netFunds: h.netFunds,
    })),
    accumulations: family.accumulations.map(a => ({ name: a.name, benefit: a.benefit, source: a.source.text })),
    contributions: family.contributions.map(c => c.text),
    evidence: family.evidence.map(e => ({ text: e.text, generation: e.generation })),
  };
}

export function presentFamilyMember(save: FamilySave, content: FamilyContent): FamilyMemberView {
  const run = save.currentRun;
  const family = save.family;
  if (!run || !family) throw new Error('这一代还没有开始。');
  const mission = content.missions.find(m => m.id === run.missionId);
  return {
    familyName: family.name,
    memberName: run.memberName,
    memberRole: run.memberRole,
    ageSpan: run.ageSpan,
    era: run.era,
    missionTitle: mission?.title ?? '',
    goalText: mission?.goalText ?? '',
    progressLine: progressView(run),
    budget: run.budget,
    allocated: run.allocated,
    spent: run.spent,
    income: run.income,
    abilities: (['hands', 'talk', 'plan'] as const).map(a => ({ ability: a, name: FAMILY_ABILITY_NAMES[a], level: run.abilities[a] })),
    actionsTaken: run.actionsTaken.map(a => ({ text: a.optionText, feedback: a.feedback, budgetDelta: a.budgetDelta })),
  };
}

export function familyMilestoneName(milestone: FamilyState['milestone']): string {
  return FAMILY_MILESTONE_NAMES[milestone];
}

function phaseName(phase: string): string {
  switch (phase) {
    case 'context': return '处境';
    case 'prepare': return '准备';
    case 'opportunity': return '机会';
    case 'apply': return '运用';
    case 'difficulty': return '困难';
    case 'settle': return '结算';
    case 'branch': return '转折';
    default: return phase;
  }
}

function missionTitleFor(content: FamilyContent, missionId: string): string {
  return content.missions.find(m => m.id === missionId)?.title ?? '当前任务';
}
