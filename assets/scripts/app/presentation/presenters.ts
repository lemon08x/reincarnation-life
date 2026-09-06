import {
  getChoiceDisplayText,
  getCurrentLifeStage,
  getPendingEvent,
  listAvailablePaths,
} from '../../core/lifeEngine';
import { getMarkDef, markName } from '../../core/lifeMarks';
import { formatHistoryEffects, formatWorldSummary } from '../../core/lifeWorld';
import {
  ActiveScenario,
  EventChoiceConfig,
  GameContent,
  HistoryRegionId,
  LegacyCategory,
  LifeMark,
  LifeRun,
  MarkNature,
  ReincarnatorProfile,
  ScenarioKind,
  TalentDraft,
} from '../../core/model';
import { getLevelProgress, getPermanentBenefits } from '../../core/progression';
import {
  ActionView,
  ChoicePageView,
  FigureCardView,
  HomeView,
  LoadoutItemView,
  LoadoutPageView,
  MarkChipView,
  MarkDeltaView,
  MarkStripView,
  PathPageView,
  PlayPage,
  ReadyPageView,
  RegionCardView,
  ResourceDeltaView,
  ResourceView,
  ResultPageView,
  RewardPageView,
  ScenarioPageView,
  SlotView,
  StateDiffView,
  SummaryPageView,
  TalentCardView,
  TalentPageView,
  TruncatedText,
} from './uiModels';
import {
  SCENE_KIND_NAMES,
  SCENE_VISUALS,
  ageBand,
  getFigureVisual,
  getRegionVisual,
  getSceneVisual,
  sceneKindById,
} from './visualConfig';

export const STORY_PREVIEW_CHARS = 48;
export const MARK_STRIP_LIMIT = 3;
export const LEGACY_CATEGORY_LABELS: Record<LegacyCategory, string> = {
  origin: '出身',
  fate: '命运',
  path: '道路',
  story: '故事',
  boon: '下世祝福',
};

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
  if (run.status !== 'active') {
    return 'result';
  }
  if (run.turnState === 'awaiting-path' || run.turnState === 'awaiting-focus') {
    return 'path';
  }
  if (run.turnState === 'in-scenario') {
    return 'scenario';
  }
  if (run.turnState === 'awaiting-choice') {
    return 'choice';
  }
  if (run.turnState === 'scenario-summary') {
    return 'summary';
  }
  return 'ready';
}

export function presentMarks(marks: LifeMark[] | undefined, content: GameContent): MarkStripView {
  const chips = sortMarks(marks ?? [], content);
  return {
    visible: chips.slice(0, MARK_STRIP_LIMIT),
    overflow: chips.slice(MARK_STRIP_LIMIT),
  };
}

export function presentResources(
  scenario: ActiveScenario,
  previous?: Record<string, number>,
): ResourceView[] {
  return Object.entries(scenario.resourceLabels).map(([key, label]) => {
    const value = scenario.resources[key] ?? 0;
    const from = previous ? previous[key] ?? 0 : value;
    const delta = value - from;
    return {
      key,
      label,
      value,
      delta: delta === 0 ? undefined : delta,
    };
  });
}

export function diffResources(
  before: Record<string, number> | undefined,
  after: Record<string, number>,
  labels: Record<string, string>,
): ResourceDeltaView[] {
  if (!before) {
    return [];
  }
  const keys = unique([...Object.keys(labels), ...Object.keys(before), ...Object.keys(after)]);
  return keys
    .map((key) => {
      const from = before[key] ?? 0;
      const to = after[key] ?? 0;
      return {
        key,
        label: labels[key] ?? key,
        from,
        to,
        delta: to - from,
      };
    })
    .filter((item) => item.delta !== 0);
}

export function diffMarks(
  before: LifeMark[] | undefined,
  after: LifeMark[] | undefined,
  content: GameContent,
): MarkDeltaView[] {
  const previous = before ?? [];
  const next = after ?? [];
  const ids = unique([...previous.map((item) => item.id), ...next.map((item) => item.id)]);
  return ids
    .map((id) => {
      const from = previous.find((item) => item.id === id)?.intensity ?? 0;
      const to = next.find((item) => item.id === id)?.intensity ?? 0;
      const sample: LifeMark = { id, intensity: Math.max(from, to, 1) };
      return {
        id,
        name: markName(sample, content.marks),
        nature: getMarkDef(id, content.marks)?.nature ?? 'aura',
        from,
        to,
        delta: to - from,
        removed: to <= 0 && from > 0,
      };
    })
    .filter((item) => item.delta !== 0 || item.removed);
}

export function presentStateDiff(
  previous: { resources?: Record<string, number>; marks?: LifeMark[] } | undefined,
  current: { resources?: Record<string, number>; marks?: LifeMark[]; resourceLabels?: Record<string, string> },
  content: GameContent,
): StateDiffView {
  return {
    resources: diffResources(previous?.resources, current.resources ?? {}, current.resourceLabels ?? {}),
    marks: diffMarks(previous?.marks, current.marks, content),
  };
}

export function presentHome(profile: ReincarnatorProfile, run: LifeRun | null, content: GameContent): HomeView {
  const progress = getLevelProgress(profile, content);
  const benefits = getPermanentBenefits(profile, content);
  const slotCount = 2 + benefits.legacySlotBonus;
  const slots: SlotView[] = Array.from({ length: slotCount }, (_, index) => {
    const id = profile.equippedLegacyIds[index];
    const legacy = id ? content.legacies.find((item) => item.id === id) : undefined;
    return {
      filled: Boolean(legacy),
      name: legacy?.name,
      category: legacy ? LEGACY_CATEGORY_LABELS[legacy.category] : undefined,
    };
  });
  const boons = profile.pendingBoonIds
    .map((id) => content.legacies.find((item) => item.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const status = !run ? 'none' : run.status === 'active'
    ? 'active'
    : run.status === 'reward-pending'
      ? 'reward-pending'
      : run.status === 'settled'
        ? 'settled'
        : 'none';
  const expCaption = progress.nextThreshold === null
    ? '当前已达到本版本最高轮回等级'
    : `距离下一等级还需 ${Math.max(0, progress.nextThreshold - profile.totalExp)} 经验`;
  return {
    level: profile.level,
    totalExp: profile.totalExp,
    expProgress: progress.progress,
    expCaption,
    nextReward: progress.nextRewardText ?? undefined,
    openingReserve: benefits.attributePointBonus > 0 ? `开局余裕 ${benefits.attributePointBonus}` : '开局不额外带余粮',
    talentCandidates: 3 + benefits.talentCandidateBonus,
    slots,
    boons,
    runStatus: status,
    continueCaption: status === 'active'
      ? (run?.playMode === 'history' ? '历史模式 · 进行中' : `自由模式 · 约 ${run?.age ?? 0} 岁`)
      : status === 'reward-pending'
        ? '选择奖励后才能开启下一世'
        : undefined,
    age: run?.age ?? 20,
    ageBand: ageBand(run?.age ?? 20),
    scene: SCENE_VISUALS.hearth,
  };
}

export function presentTalents(
  draft: TalentDraft,
  selectedIds: string[],
  content: GameContent,
): TalentPageView {
  const selected = selectedIds.filter((id) => draft.candidateIds.includes(id));
  const candidates = draft.candidateIds.map((id) => {
    const talent = content.talents.find((item) => item.id === id);
    if (!talent) {
      return null;
    }
    const mark = talent.grantMarks?.[0];
    const def = mark ? getMarkDef(mark.id, content.marks) : undefined;
    const effectLine = (talent.grantMarks ?? [])
      .map((item) => {
        const intensity = item.intensity ?? 1;
        const ranks = getMarkDef(item.id, content.marks)?.ranks;
        return ranks ? ranks[Math.max(0, Math.min(2, intensity - 1))] : '';
      })
      .filter(Boolean)
      .join(' · ') || firstSentence(talent.description);
    return {
      id: talent.id,
      name: talent.name,
      effectLine,
      description: presentStoryText(talent.description, 36),
      selected: selected.includes(talent.id),
      nature: def?.nature ?? 'aura',
    } satisfies TalentCardView;
  }).filter((item): item is TalentCardView => Boolean(item));
  const slots = Array.from({ length: draft.requiredSelectionCount }, (_, index) => {
    const id = selected[index];
    return candidates.find((item) => item.id === id) ?? null;
  });
  return {
    required: draft.requiredSelectionCount,
    remaining: Math.max(0, draft.requiredSelectionCount - selected.length),
    canBegin: selected.length === draft.requiredSelectionCount,
    candidates,
    slots,
  };
}

export function presentHistoryRegions(content: GameContent): RegionCardView[] {
  const sceneByRegion: Record<HistoryRegionId, ScenarioKind> = {
    'china-ancient': 'studies',
    'china-modern': 'service',
    'west-ancient': 'service',
    'west-modern': 'craft',
  };
  return content.regions.map((region) => ({
    id: region.id,
    name: region.name,
    era: region.era,
    description: presentStoryText(region.description, 36),
    scene: getSceneVisual(sceneByRegion[region.id]),
    region: getRegionVisual(region.id)!,
  }));
}

export function presentHistoryFigures(
  regionId: HistoryRegionId,
  content: GameContent,
  selectedId: string | null = null,
): FigureCardView[] {
  return content.figures
    .filter((figure) => figure.region === regionId)
    .map((figure) => ({
      id: figure.id,
      name: figure.name,
      epithet: figure.epithet,
      opening: presentStoryText(figure.opening, 42),
      look: getFigureVisual(figure.id),
      selected: selectedId === figure.id,
    }));
}

export function presentPaths(run: LifeRun, content: GameContent): PathPageView {
  const paths = listAvailablePaths(run, content).map((path) => ({
    id: path.id,
    title: path.title,
    summary: presentStoryText(path.summary, 36),
    kind: path.kind,
    sceneName: SCENE_KIND_NAMES[path.kind],
    icon: path.icon,
    scene: getSceneVisual(path.kind),
  }));
  const caption = run.playMode === 'history'
    ? `约 ${run.age} 岁 · 历史路上的下一程`
    : `约 ${run.age} 岁 · 选一程走进去`;
  return {
    caption,
    marks: presentMarks(run.marks, content),
    paths,
    age: run.age,
    ageBand: ageBand(run.age),
    region: run.historyRegion,
    figureId: run.figureId,
  };
}

export function presentScenario(
  run: LifeRun,
  content: GameContent,
  previous?: { resources?: Record<string, number>; marks?: LifeMark[] },
): ScenarioPageView {
  const scene = run.currentScenario;
  if (!scene) {
    throw new Error('There is no active scenario to present.');
  }
  const config = content.scenarios.find((item) => item.id === scene.scenarioId);
  const visual = getSceneVisual(scene.kind);
  const eventText = scene.beatText ?? scene.log[scene.log.length - 1] ?? scene.title;
  return {
    title: scene.title,
    kind: scene.kind,
    sceneName: SCENE_KIND_NAMES[scene.kind],
    scene: visual,
    pose: visual.pose,
    age: run.age,
    ageBand: ageBand(run.age),
    turnCurrent: Math.min(scene.turn + 1, scene.maxTurns),
    turnMax: scene.maxTurns,
    turnProgress: scene.maxTurns > 0 ? Math.min(1, (scene.turn + 1) / scene.maxTurns) : 0,
    resources: presentResources(scene, previous?.resources),
    event: presentStoryText(eventText),
    marks: presentMarks(run.marks, content),
    actions: presentScenarioActions(run, content, config?.actions ?? []),
    diffs: presentStateDiff(previous, {
      resources: scene.resources,
      marks: run.marks,
      resourceLabels: scene.resourceLabels,
    }, content),
    region: run.historyRegion,
    figureId: run.figureId,
  };
}

export function presentScenarioActions(
  run: LifeRun,
  content: GameContent,
  actions = content.scenarios.find((item) => item.id === run.currentScenario?.scenarioId)?.actions ?? [],
): ActionView[] {
  const scene = run.currentScenario;
  if (!scene) {
    return [];
  }
  return actions.flatMap((action) => {
    const listed = scene.actionIds.includes(action.id);
    const missing = missingCosts(scene.resources, action.cost, scene.resourceLabels);
    const afford = missing.length === 0;
    if (!listed && afford) {
      return [];
    }
    if (!listed && !action.cost) {
      return [];
    }
    return [{
      id: action.id,
      title: action.title,
      hint: action.hint,
      icon: action.icon,
      costText: formatCost(action.cost, scene.resourceLabels),
      enabled: listed && afford,
      disabledReason: afford ? undefined : `还差${missing.join('、')}`,
    }];
  });
}

export function presentChoices(
  run: LifeRun,
  content: GameContent,
  selectedId: string | null,
  foresightOpen: boolean,
): ChoicePageView {
  const event = getPendingEvent(run, content);
  const choiceIds = run.pendingDecision?.choiceIds ?? [];
  const canForesight = run.capabilities.choiceForesight !== 'none';
  const choices = choiceIds.map((choiceId) => {
    const choice = event.choices?.find((item) => item.id === choiceId);
    if (!choice) {
      return {
        id: choiceId,
        text: choiceId,
        preview: '',
        selected: selectedId === choiceId,
      };
    }
    return {
      id: choice.id,
      text: choice.text,
      preview: choice.preview,
      foresight: canForesight && foresightOpen
        ? foresightForChoice(run, choice, content)
        : undefined,
      selected: selectedId === choice.id,
    };
  });
  const kind = run.currentScenario?.kind ?? sceneKindById(run.completedScenarioIds[run.completedScenarioIds.length - 1] ?? 'hearth');
  const canReroll = (run.fate.eventRerollsRemaining > 0) && !run.pendingDecision?.sourceChoiceId;
  return {
    source: run.pendingDecision?.pressureNote ?? (run.currentScenario ? run.currentScenario.title : '关键时刻'),
    age: run.age,
    ageBand: ageBand(run.age),
    event: presentStoryText(event.text),
    choices,
    selectedId,
    canConfirm: Boolean(selectedId && choices.some((item) => item.id === selectedId)),
    canForesight,
    foresightOpen,
    canReroll,
    rerollsRemaining: run.fate.eventRerollsRemaining,
    scene: getSceneVisual(kind),
    region: run.historyRegion,
    figureId: run.figureId,
  };
}

export function presentSummary(
  run: LifeRun,
  content: GameContent,
  previous?: { marks?: LifeMark[] },
): SummaryPageView {
  const report = run.scenarioReport;
  if (!report) {
    throw new Error('There is no scenario summary to present.');
  }
  const kind = run.currentScenario?.kind ?? sceneKindById(run.completedScenarioIds[run.completedScenarioIds.length - 1] ?? 'hearth');
  return {
    title: report.title,
    years: report.years,
    ageAfter: report.ageAfter,
    ageBand: ageBand(report.ageAfter),
    lines: report.lines.map((line) => presentStoryText(line, 60)),
    marks: presentMarks(run.marks, content),
    diffs: presentStateDiff(previous, { marks: run.marks }, content),
    scene: getSceneVisual(kind),
    region: run.historyRegion,
    figureId: run.figureId,
  };
}

export function presentReady(run: LifeRun, content: GameContent, autoPlaying: boolean): ReadyPageView {
  const family = content.families.find((item) => item.id === run.familyId);
  const stage = getCurrentLifeStage(run, content);
  const focus = stage.focuses.find((item) => item.id === run.currentFocusId);
  const latest = run.history[run.history.length - 1];
  const recent = run.history.slice(-4, -1).reverse().map((entry) => `${entry.age} 岁　${presentStoryText(entry.text, 18).preview}`);
  const kind = inferKindFromRun(run);
  return {
    age: run.age,
    ageBand: ageBand(run.age),
    familyName: family?.name ?? '未知家庭',
    stageLine: `${stage.name}${focus ? `：${focus.name}` : ''}`,
    worldLine: formatWorldSummary(run.world) || '生活还在慢慢展开',
    marks: presentMarks(run.marks, content),
    latest: presentStoryText(latest?.text ?? '人生刚刚开始。'),
    latestAge: latest?.age ?? run.age,
    effectLine: latest ? (formatHistoryEffects(latest) || '平稳度过') : '人生刚刚开始',
    recent,
    autoPlaying,
    scene: getSceneVisual(kind),
  };
}

export function presentResult(run: LifeRun, profile: ReincarnatorProfile, content: GameContent): ResultPageView {
  const ending = content.endings.find((item) => item.id === run.endingId);
  const settlement = run.settlement;
  const progress = getLevelProgress(profile, content);
  const selectedReward = settlement?.selectedRewardId
    ? content.legacies.find((item) => item.id === settlement.selectedRewardId)
    : undefined;
  const rewardText = settlement && settlement.newRewardTexts.length > 0
    ? settlement.newRewardTexts.join('\n')
    : progress.nextThreshold === null
      ? '本版本轮回等级已满'
      : `再获得 ${Math.max(0, progress.nextThreshold - profile.totalExp)} 经验可解锁：${progress.nextRewardText}`;
  const expDetails = settlement
    ? [
      `基础 ${settlement.baseExp}`,
      `人生评价 ${settlement.performanceExp}`,
      settlement.firstDiscoveryExp > 0 ? `新结局 ${settlement.firstDiscoveryExp}` : null,
    ].filter(Boolean).join('　')
    : '';
  const timeline = run.history
    .filter((entry) => Boolean(entry.choiceId))
    .slice(-6)
    .map((entry) => ({
      age: entry.age,
      text: presentStoryText(entry.text, 28),
    }));
  return {
    endingTitle: ending?.title ?? '人生落幕',
    endingDescription: presentStoryText(ending?.description ?? '', 60),
    age: run.age,
    score: settlement?.score ?? 0,
    endReason: run.endReason ?? '',
    worldLine: formatWorldSummary(run.world),
    earnedExp: settlement?.earnedExp ?? 0,
    expDetails,
    leveledUp: Boolean(settlement && settlement.newLevel > settlement.previousLevel),
    levelLine: settlement && settlement.newLevel > settlement.previousLevel
      ? `轮回者升级　${settlement.previousLevel} → ${settlement.newLevel}`
      : `轮回者等级　${profile.level}`,
    rewardText,
    pendingReward: run.status === 'reward-pending',
    selectedRewardName: selectedReward
      ? `${selectedReward.name} · ${LEGACY_CATEGORY_LABELS[selectedReward.category]}`
      : undefined,
    timeline,
    marks: presentMarks(run.marks, content),
    scene: getSceneVisual(inferKindFromRun(run)),
  };
}

export function presentRewards(
  run: LifeRun,
  profile: ReincarnatorProfile,
  content: GameContent,
  selectedId: string | null,
): RewardPageView {
  const ids = run.settlement?.rewardOfferIds ?? [];
  const cards = ids.flatMap((rewardId) => {
    const legacy = content.legacies.find((item) => item.id === rewardId);
    if (!legacy) {
      return [];
    }
    const currentRank = profile.legacyRanks[legacy.id] ?? 0;
    const rankText = legacy.persistence === 'permanent'
      ? `永久 · 获得后 ${currentRank + 1}/${legacy.maxRank} 阶`
      : '祝福 · 仅下一世生效';
    return [{
      id: legacy.id,
      name: legacy.name,
      category: legacy.category,
      categoryLabel: LEGACY_CATEGORY_LABELS[legacy.category],
      description: presentStoryText(legacy.description, 42),
      persistence: legacy.persistence,
      rankText,
      selected: selectedId === legacy.id,
    }];
  });
  return {
    cards,
    selectedId,
    canClaim: Boolean(selectedId && cards.some((item) => item.id === selectedId)),
  };
}

export function presentLoadout(
  profile: ReincarnatorProfile,
  content: GameContent,
  owned: { id: string }[],
  slotCount: number,
  selectedId: string | null,
): LoadoutPageView {
  const slots: SlotView[] = Array.from({ length: slotCount }, (_, index) => {
    const id = profile.equippedLegacyIds[index];
    const legacy = id ? content.legacies.find((item) => item.id === id) : undefined;
    return {
      filled: Boolean(legacy),
      name: legacy?.name,
      category: legacy ? LEGACY_CATEGORY_LABELS[legacy.category] : undefined,
    };
  });
  const hasRoom = profile.equippedLegacyIds.length < slotCount;
  const items: LoadoutItemView[] = owned.flatMap((ref) => {
    const legacy = content.legacies.find((item) => item.id === ref.id);
    if (!legacy) {
      return [];
    }
    const equipped = profile.equippedLegacyIds.includes(legacy.id);
    const enabled = equipped || hasRoom;
    return [{
      id: legacy.id,
      name: legacy.name,
      categoryLabel: LEGACY_CATEGORY_LABELS[legacy.category],
      description: presentStoryText(legacy.description, 42),
      rank: profile.legacyRanks[legacy.id] ?? 0,
      maxRank: legacy.maxRank,
      equipped,
      enabled,
      disabledReason: enabled ? undefined : '传承槽已满',
    }];
  });
  return {
    slots,
    filled: profile.equippedLegacyIds.length,
    slotCount,
    items,
    selectedId,
    selected: items.find((item) => item.id === selectedId),
  };
}

function sortMarks(marks: LifeMark[], content: GameContent): MarkChipView[] {
  const chips = marks.map((mark) => {
    const def = getMarkDef(mark.id, content.marks);
    return {
      id: mark.id,
      name: markName(mark, content.marks),
      nature: def?.nature ?? 'aura',
      intensity: mark.intensity,
      hint: def?.hint ?? '',
    };
  });
  const rank = (nature: MarkNature): number => (nature === 'burden' ? 2 : nature === 'possession' ? 1 : 0);
  return chips.sort((left, right) => rank(left.nature) - rank(right.nature));
}

function missingCosts(
  resources: Record<string, number>,
  cost: Record<string, number> | undefined,
  labels: Record<string, string>,
): string[] {
  if (!cost) {
    return [];
  }
  return Object.entries(cost)
    .filter(([key, value]) => (resources[key] ?? 0) < value)
    .map(([key, value]) => {
      const have = resources[key] ?? 0;
      const label = labels[key] ?? key;
      return `${label} ${value - have}`;
    });
}

function formatCost(cost: Record<string, number> | undefined, labels: Record<string, string>): string | undefined {
  if (!cost || Object.keys(cost).length === 0) {
    return undefined;
  }
  return Object.entries(cost)
    .map(([key, value]) => `${labels[key] ?? key} ${value}`)
    .join(' · ');
}

function foresightForChoice(
  run: LifeRun,
  choice: EventChoiceConfig,
  content: GameContent,
): string {
  if (run.capabilities.choiceForesight === 'direction') {
    return choice.preview;
  }
  const display = getChoiceDisplayText(run, choice, content);
  const extra = display.includes('｜可能：') ? display.split('｜可能：')[1] : '';
  return extra || choice.preview;
}

function inferKindFromRun(run: LifeRun): ScenarioKind {
  if (run.currentScenario) {
    return run.currentScenario.kind;
  }
  const last = run.completedScenarioIds[run.completedScenarioIds.length - 1];
  if (last) {
    return sceneKindById(last);
  }
  if (run.age < 12) {
    return 'childhood';
  }
  if (run.age >= 65) {
    return 'dusk';
  }
  return 'hearth';
}

function firstSentence(text: string): string {
  const match = text.match(/^[^。！？.!?]+[。！？.!?]?/u);
  return (match?.[0] ?? text).trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
