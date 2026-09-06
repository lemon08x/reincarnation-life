import { formatMarkList, getMarkDef, markName } from '../../core/lifeMarks';
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
  TruncatedText,
} from './uiModels';
import { SCENE_VISUALS, ageBand, getSceneVisual } from './visualConfig';

export const STORY_PREVIEW_CHARS = 48;
export const MARK_STRIP_LIMIT = 3;

export function presentStoryText(full: string, maxChars = STORY_PREVIEW_CHARS): TruncatedText {
  const trimmed = full.replace(/\s+/g, ' ').trim();
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
      ? `进行中 · 约 ${run?.age ?? 0} 岁 · 人生点 ${run?.lifePoints ?? 0}`
      : status === 'awaiting-archive'
        ? '把这一世的经历收入档案'
        : undefined,
    archiveLine: profile.archivedRunIds.length === 0
      ? '还没有收入档案的经历。第一次回望不需要上一世的收藏。'
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
    title: pending.title,
    age: pending.age,
    ageBand: ageBand(pending.age),
    lifePoints: run.lifePoints,
    lifePointCap: run.lifePointCap,
    worldLine: formatWorldSummary(run.world),
    event: presentStoryText(pending.text, 72),
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
        : option.costKind === 'pursue-opportunity'
          ? `争取 · ${option.cost} 点`
          : `突破 · ${option.cost} 点`,
      supportReason: option.supportReason,
      enabled: option.enabled,
      disabledReason: option.disabledReason,
      selected: selectedId === option.choiceId,
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
    return presentStoryText(fragment ? `${fragment.age} 岁：${fragment.howIResponded}` : '一段作为证据的经历', 56);
  });
  return {
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
    })),
    selectedStance,
    canConfirm: selectedStance !== null,
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
    title: closing.title,
    text: presentStoryText(closing.text, 70),
    age: run.age,
    ageBand: ageBand(run.age),
    worldLine: formatWorldSummary(run.world) || formatMarkList(run.marks, content.marks),
    shapedBy: closing.shapedBy.slice(0, 6).map((item) => presentStoryText(item, 42)),
    changed: closing.changed,
    unresolved: closing.unresolved,
    unfulfilled: closing.unfulfilled,
    pendingArchive: run.status === 'awaiting-archive',
    scene: SCENE_VISUALS.dusk,
  };
}


