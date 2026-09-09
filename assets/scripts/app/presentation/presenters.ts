import { formatMarkList, getMarkDef, markName } from '../../core/lifeMarks';
import { compactStory } from '../../content/compactCopy';
import { ABILITIES, ABILITY_NAMES, GROWTH_CHAPTERS, GROWTH_RECALLS, PLACE_NAMES, SKILL_NAMES } from '../../core/growthModel';
import { formatWorldSummary } from '../../core/lifeWorld';
import {
  CausalityRecord,
  GameContent,
  LifeMark,
  LifeRun,
  MAX_CARRIED_UNDERSTANDINGS,
  RecallStance,
  ReincarnatorProfile,
  Understanding,
  CHAPTER_TITLES,
  RECALL_AFTER_COUNTS,
  themeLabel,
} from '../../core/model';
import {
  CarryCardView,
  CarryPageView,
  CausalityPageView,
  DiscoveryView,
  EncounterPageView,
  EndingPageView,
  HomeView,
  MarkChipView,
  MarkStripView,
  PlayPage,
  RecallPageView,
  ResultPageView,
  JournalPageView,
  TruncatedText,
  GrowthHud,
} from './uiModels';
import { SCENE_VISUALS, ageBand, getSceneVisual } from './visualConfig';

export const STORY_PREVIEW_CHARS = 48;
export const MARK_STRIP_LIMIT = 3;

export function presentStoryText(full: string, maxChars = STORY_PREVIEW_CHARS): TruncatedText {
  const trimmed = full.trim();
  if (trimmed.length <= maxChars) {
    return { preview: trimmed, full: trimmed, expandable: false };
  }
  const cut = trimmed.slice(0, maxChars).replace(/[，。、；：,\s]+$/u, '');
  return {
    preview: `${cut}…`,
    full: trimmed,
    expandable: true,
  };
}

export function routePlayPage(run: LifeRun | null): PlayPage {
  if (!run) {
    return 'home';
  }
  if (run.status === 'awaiting-archive' || run.status === 'settled') {
    return 'ending';
  }
  if (run.turnState === 'awaiting-recall') {
    return 'recall';
  }
  if (run.turnState === 'showing-result') return 'result';
  if (run.turnState === 'awaiting-response') {
    return 'encounter';
  }
  return 'home';
}

export function presentMarks(marks: LifeMark[] | undefined, content: GameContent): MarkStripView {
  const chips = (marks ?? []).map((mark) => {
    const def = getMarkDef(mark.id, content.marks);
    return {
      id: mark.id,
      name: markName(mark, content.marks),
      nature: def?.nature ?? 'aura',
      intensity: mark.intensity,
      hint: def?.hint ?? '',
    } satisfies MarkChipView;
  });
  return {
    visible: chips.slice(0, MARK_STRIP_LIMIT),
    overflow: chips.slice(MARK_STRIP_LIMIT),
  };
}

export function presentHome(
  profile: ReincarnatorProfile,
  run: LifeRun | null,
): HomeView {
  const status = !run
    ? 'none'
    : run.status === 'active'
      ? 'active'
      : run.status === 'awaiting-archive'
        ? 'awaiting-archive'
        : 'settled';
  const discoveries = profile.discoveries.slice(-4).map((item) => ({
    contentKey: item.contentKey,
    title: item.title,
    statement: presentStoryText(item.latestStatement, 36),
    sourceCount: item.sources.length,
    sourceLine: item.sources
      .map((source) => `${source.age} 岁 · ${source.personLabels.join('、') || '独自经历'}`)
      .slice(0, 2)
      .join('；'),
  } satisfies DiscoveryView));
  return {
    lifeCount: profile.archivedRunIds.length,
    discoveryCount: profile.discoveries.length,
    runStatus: status,
    continueCaption: status === 'active'
      ? run?.growth ? `${run.age} 岁 · ${PLACE_NAMES[run.growth.place]} · ${run.growth.identity}` : `旧人生续玩 · ${run?.age ?? 0} 岁 · 人生点 ${run?.lifePoints ?? 0}`
      : status === 'awaiting-archive'
        ? '把这一世的经历收入档案'
        : undefined,
    archiveLine: profile.archivedRunIds.length === 0
      ? '从一段新的生活开始。这一世的本领，会由你自己积下。'
      : `${profile.archivedRunIds.length} 世已收入 · ${profile.discoveries.length} 条理解`,
    lastTitle: profile.lastClosing?.title,
    scene: SCENE_VISUALS.hearth,
    age: run?.age ?? 28,
    ageBand: ageBand(run?.age ?? 28),
    discoveries,
  };
}

export function presentCarry(
  candidates: Understanding[],
  selectedIds: string[],
): CarryPageView {
  const selected = selectedIds.slice(0, MAX_CARRIED_UNDERSTANDINGS);
  return {
    max: MAX_CARRIED_UNDERSTANDINGS,
    selectedCount: selected.length,
    canSkip: true,
    cards: candidates.map((item) => ({
      id: item.id,
      statement: presentStoryText(item.statement, 42),
      theme: themeLabel(item.theme),
      sourceLine: `来自 ${item.sourceFragmentIds.length} 段真实经历`,
      selected: selected.includes(item.id),
    } satisfies CarryCardView)),
  };
}

export function presentEncounter(
  run: LifeRun,
  content: GameContent,
  selectedId: string | null,
): EncounterPageView {
  const pending = run.pendingEncounter;
  if (!pending) {
    throw new Error('There is no pending encounter to present.');
  }
  return {
    growth: presentGrowthHud(run),
    feedback: run.recentFeedback,
    instanceId: pending.instanceId,
    chapter: (run.growth ? GROWTH_CHAPTERS : CHAPTER_TITLES)[Math.min(3, Math.floor(run.encounterCount / 3))],
    progress: `第 ${Math.min(4, Math.floor(run.encounterCount / 3) + 1)} 章 · 时刻 ${run.encounterCount + 1} / 12`,
    title: pending.title,
    age: pending.age,
    ageBand: ageBand(pending.age),
    lifePoints: run.lifePoints,
    lifePointCap: run.lifePointCap,
    worldLine: run.growth ? `${PLACE_NAMES[run.growth.place]} · ${run.growth.identity}` : formatWorldSummary(run.world),
    event: presentStoryText(run.growth ? compactStory(pending.templateId, pending.text) : pending.text, 72),
    triggerNote: presentStoryText(pending.triggerNote, 40),
    triggerKind: pending.triggerKind,
    marks: presentMarks(run.marks, content),
    recalled: pending.recalledFragmentIds.map((id, index) => ({
      id,
      text: pending.recalledNotes[index] ?? '一段被唤起的往事',
    })),
    options: pending.options.map((option) => ({
      id: option.choiceId,
      text: option.text,
      preview: option.preview,
      cost: option.cost,
      costLabel: option.cost === 0
        ? undefined
        : run.growth ? `家底 ${option.cost}` : option.costKind === 'pursue-opportunity'
          ? `争取 · ${option.cost} 点`
          : `突破 · ${option.cost} 点`,
      supportReason: option.supportReason,
      enabled: option.enabled,
      disabledReason: option.disabledReason,
      selected: selectedId === option.choiceId,
      sourceIds: option.supportedByFragmentIds,
    })),
    selectedId,
    canConfirm: Boolean(selectedId && pending.options.some((item) => item.choiceId === selectedId && item.enabled)),
    scene: getSceneVisual(pending.sceneKind),
    sceneKind: pending.sceneKind,
  };
}

export function presentRecall(
  run: LifeRun,
  selectedStance: RecallStance | null,
): RecallPageView {
  const pending = run.pendingRecall;
  if (!pending) {
    throw new Error('There is no pending recall to present.');
  }
  const evidence = pending.fragmentIds.map((id) => {
    const fragment = run.fragments.find((item) => item.id === id);
    return presentStoryText(fragment ? `${fragment.age} 岁 · ${fragment.whatHappened}\n\n你当时的回应：${fragment.howIResponded}\n留下的变化：${fragment.laterWhat[0] ?? ''}` : '一段作为证据的经历', 56);
  });
  return {
    growthMode: Boolean(run.growth),
    feedback: run.recentFeedback,
    instanceId: pending.instanceId,
    prompt: presentStoryText(pending.prompt, 70),
    evidence,
    age: run.age,
    ageBand: ageBand(run.age),
    lifePoints: run.lifePoints,
    options: pending.options.map((option) => ({
      stance: option.stance,
      label: option.label,
      statement: presentStoryText(option.statement, 48),
      selected: selectedStance === option.stance,
      effectHint: option.effectHint ?? '',
    })),
    selectedStance,
    canConfirm: pending.options.some(o => o.stance === selectedStance),
    scene: SCENE_VISUALS.dusk,
  };
}

export function presentCausality(record: CausalityRecord): CausalityPageView {
  return {
    title: record.title,
    happened: presentStoryText(record.happened, 80),
    response: record.response ? presentStoryText(record.response, 60) : undefined,
    understood: record.understood ? presentStoryText(record.understood, 50) : undefined,
    later: record.later,
    people: record.people.map((item) => item.label),
    triggerNote: record.trigger.note,
    evoked: record.evoked,
    sources: record.sources,
  };
}

export function presentEnding(run: LifeRun, content: GameContent): EndingPageView {
  const closing = run.closing;
  if (!closing) {
    throw new Error('There is no closing to present.');
  }
  return {
    growthMode: Boolean(run.growth),
    feedback: run.recentFeedback,
    title: closing.title,
    text: presentStoryText(closing.text, 70),
    age: run.age,
    ageBand: ageBand(run.age),
    worldLine: formatWorldSummary(run.world) || formatMarkList(run.marks, content.marks),
    shapedBy: closing.shapedBy.map((item) => presentStoryText(item, 42)),
    changed: closing.changed,
    unresolved: closing.unresolved,
    unfulfilled: closing.unfulfilled,
    pendingArchive: run.status === 'awaiting-archive',
    scene: SCENE_VISUALS.dusk,
  };
}

export function presentResult(run: LifeRun): ResultPageView {
  const result = run.pendingResult;
  if (!result) throw new Error('没有等待阅读的结果。');
  return { ...result, age: run.age, ageBand: ageBand(run.age), scene: getSceneVisual(result.sceneKind),
    growth: presentGrowthHud(run),
    pointLine: run.growth ? `现在的家底 ${run.growth.money}${result.costPaid ? ` · 本次支付 ${result.costPaid}` : ' · 本次无额外开支'}` : `${result.costPaid ? `这次用了 ${result.costPaid} 点心力` : '这次没有消耗人生点'} · 还剩 ${run.lifePoints} / ${run.lifePointCap} 点`,
    continueLabel: ((run.growth ? GROWTH_RECALLS : RECALL_AFTER_COUNTS) as readonly number[]).includes(run.encounterCount) ? run.growth ? '从经历中，形成自己的方法' : '停下来，回望这些经历' : run.encounterCount === 12 ? '翻到这一生的末页' : '带着这件事，继续生活',
  };
}

export function presentJournal(profile: ReincarnatorProfile, run: LifeRun | null): JournalPageView {
  const ids = Array.from(new Set([...(run ? [run.id] : []), ...profile.archivedRunIds.slice().reverse()]));
  return { characterSummary: run?.growth ? [ `${PLACE_NAMES[run.growth.place]} · ${run.growth.identity}`, ABILITIES.map(a => `${ABILITY_NAMES[a]} ${run.growth!.abilities[a]} / 6`).join('  ·  '), `家底 ${run.growth.money}`, `本领：${run.growth.skills.map(s => SKILL_NAMES[s]).join('、') || '正在学习'}`, `专长：${run.growth.specialties.map(s => s.name).join('、') || '从经历中慢慢形成'}`, presentGrowthHud(run)!.goal ].join('\n') : undefined,
    groups: ids.map(id => {
    const fragments = (id === run?.id ? run.fragments : profile.fragments).filter(f => f.runId === id);
    const understandings = (id === run?.id ? run.understandings : profile.understandings).filter(u => u.createdInRunId === id);
    const number = profile.archivedRunIds.indexOf(id);
    return { title: id === run?.id && run.status === 'active' ? '正在经历的这一世' : `第 ${number >= 0 ? number + 1 : profile.archivedRunIds.length + 1} 世`,
      entries: [
        ...fragments.map(f => ({ id: f.id, age: f.age, label: `${f.age} 岁 · 经历`, text: f.whatHappened })),
        ...understandings.map(u => ({ id: u.id, age: u.createdAtAge, label: u.contentKey.startsWith('specialty:') ? `${u.createdAtAge} 岁 · 形成的方法` : `${u.createdAtAge} 岁 · ${themeLabel(u.theme)}的理解 · 第 ${u.version} 次`, text: u.statement })),
      ].sort((a, b) => a.age - b.age),
    };
  }) };
}

export function presentGrowthHud(run: LifeRun): GrowthHud | undefined {
  const g = run.growth;
  if (!g) return undefined;
  const best = [...ABILITIES].sort((a, b) => g.abilities[b] - g.abilities[a]).slice(0, 2);
  const goal = g.goal ? `${g.goal.status === 'complete' ? '已做成' : '眼前打算'}：${g.goal.title}`
    : run.encounterCount < 3 ? '先学会一些办法，往后的路还未写好'
    : `为往后准备：${g.intention === 'earn' ? '积攒家底' : g.intention === 'explore' ? '寻找新的机会' : '继续学本领'}`;
  return { identity: g.identity, place: PLACE_NAMES[g.place], summary: `${best.map(a => `${ABILITY_NAMES[a]} ${g.abilities[a]}`).join('    ')}    家底 ${g.money}`,
    goal, progress: run.encounterCount / 12, specialties: g.specialties.map(s => s.name) };
}
