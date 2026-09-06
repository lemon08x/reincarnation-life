import { Button, Node } from 'cc';
import { getFigureVisual, getRegionVisual } from '../app/presentation/visualConfig';
import {
  ActionView,
  ChoicePageView,
  FigureCardView,
  HomeView,
  LoadoutPageView,
  MarkChipView,
  MarkStripView,
  PathPageView,
  ReadyPageView,
  RegionCardView,
  ResourceView,
  ResultPageView,
  RewardPageView,
  ScenarioPageView,
  SlotView,
  SummaryPageView,
  TalentPageView,
  TruncatedText,
} from '../app/presentation/uiModels';
import { UiKit } from './kit';
import { drawGateScene, drawMarkBadge, drawPortrait, drawScene } from './sceneArt';
import { THEME, TYPE, colorFromRgb } from './theme';

export interface PageActions {
  goHome: () => void;
  expand: (key: string, title: string, body: string) => void;
}

export function renderHome(
  kit: UiKit,
  view: HomeView,
  actions: PageActions & {
    continueLife: () => void;
    claimReward: () => void;
    freeMode: () => void;
    historyMode: () => void;
    loadout: () => void;
    lastResult: () => void;
  },
): void {
  const { hud, scene } = kit.beginPage('home');
  const top = 640 - kit.layout.top;
  const sceneH = kit.layout.sceneHeight;
  const sceneY = top - 36 - sceneH / 2;
  drawGateScene(kit, scene, 0, sceneY, {
    visual: view.scene,
    width: 680,
    height: sceneH,
    ageBand: view.ageBand,
    figure: getFigureVisual(),
  });
  kit.label(hud, '轮　回', 0, top - 8, 600, 40, TYPE.caption + 2, THEME.ink, true, true);

  const cardY = sceneY - sceneH / 2 - 118;
  const card = kit.panel(hud, 0, cardY, 640, 200, THEME.panel, 24, THEME.panelBorder);
  kit.label(card, `${view.level} 级`, -210, 58, 160, 40, TYPE.numeric - 8, THEME.ink, true, true);
  kit.label(card, `经验 ${view.totalExp}`, -210, 18, 180, 28, TYPE.caption, THEME.muted, true);
  kit.progress(card, 70, 58, 320, 16, view.expProgress, THEME.coral);
  kit.label(card, view.expCaption, 70, 28, 340, 28, TYPE.caption, THEME.muted, false);
  kit.label(card, `${view.openingReserve}　·　天赋候选 ${view.talentCandidates}`, 0, -8, 580, 28, TYPE.caption, THEME.ink, true);
  renderSlots(kit, card, view.slots, 0, -58, 560);
  if (view.boons.length > 0) {
    kit.label(hud, `下世祝福：${view.boons.join(' · ')}`, 0, cardY - 118, 600, 28, TYPE.caption, THEME.positive, true);
  }

  const actionY = -430;
  if (view.runStatus === 'active') {
    kit.button(hud, '继续这一世', 0, actionY, 560, 80, THEME.coral, actions.continueLife);
    kit.label(hud, view.continueCaption ?? '', 0, actionY - 64, 560, 28, TYPE.caption, THEME.muted, true);
  } else if (view.runStatus === 'reward-pending') {
    kit.button(hud, '领取本世传承', 0, actionY, 560, 80, THEME.coral, actions.claimReward);
    kit.label(hud, view.continueCaption ?? '', 0, actionY - 64, 560, 28, TYPE.caption, THEME.muted, true);
  } else {
    kit.button(hud, '自由模式', -150, actionY, 260, 80, THEME.coral, actions.freeMode);
    kit.button(hud, '历史模式', 150, actionY, 260, 80, THEME.coralDeep, actions.historyMode);
    kit.label(hud, '自由是随机一世 · 历史是走在前人路上', 0, actionY - 64, 600, 28, TYPE.caption, THEME.muted, true);
    if (view.runStatus === 'settled') {
      kit.button(hud, '查看上一世结算', 0, actionY - 130, 560, 64, THEME.creamDeep, actions.lastResult, true, THEME.ink);
    }
  }
  if (view.slots.some((slot) => slot.filled) && view.runStatus !== 'active' && view.runStatus !== 'reward-pending') {
    kit.textAction(hud, '调整本世传承', 0, -580, actions.loadout);
  }
}

export function renderTalents(
  kit: UiKit,
  view: TalentPageView,
  actions: PageActions & { toggle: (id: string) => void; begin: () => void },
): void {
  const { hud } = kit.beginPage('talents');
  const top = 640 - kit.layout.top;
  kit.label(hud, '选择本世天赋', 0, top - 24, 600, 44, TYPE.title, THEME.ink, true, true);
  kit.label(hud, `从 ${view.candidates.length} 项中选择 ${view.required} 项`, 0, top - 64, 600, 28, TYPE.caption, THEME.muted, true);
  const firstY = top - 160;
  view.candidates.forEach((talent, index) => {
    const y = firstY - index * 118;
    const card = kit.panel(hud, 0, y, 630, 108, talent.selected ? colorFromRgb([255, 228, 214]) : THEME.panel, 20, talent.selected ? THEME.coral : THEME.panelBorder);
    drawMarkBadge(kit, card, -250, 8, talent.nature, talent.nature === 'burden' ? THEME.coralDeep : talent.nature === 'possession' ? THEME.skyDeep : THEME.grass);
    kit.label(card, talent.name, -40, 22, 360, 32, TYPE.subtitle, THEME.ink, false, true);
    kit.label(card, talent.effectLine, -40, -12, 360, 28, TYPE.caption, THEME.muted, false);
    if (talent.description.expandable) {
      kit.textAction(card, '详情', 250, -28, () => actions.expand(`talent:${talent.id}`, talent.name, talent.description.full));
    }
    const button = card.addComponent(Button);
    button.transition = Button.Transition.NONE;
    card.on(Button.EventType.CLICK, () => actions.toggle(talent.id));
  });
  renderSlots(kit, hud, view.slots.map((item) => ({ filled: Boolean(item), name: item?.name })), 0, -430, 560);
  kit.button(
    hud,
    view.canBegin ? '投身这一世' : `还需选择 ${view.remaining} 项`,
    0,
    -510,
    560,
    80,
    view.canBegin ? THEME.coral : THEME.disabled,
    actions.begin,
    view.canBegin,
  );
  kit.textAction(hud, '返回轮回空间', 0, -590, actions.goHome);
}

export function renderHistoryRegions(
  kit: UiKit,
  regions: RegionCardView[],
  actions: PageActions & { openRegion: (id: RegionCardView['id']) => void },
): void {
  const { hud } = kit.beginPage('history-regions');
  const top = 640 - kit.layout.top;
  kit.label(hud, '历史模式', 0, top - 20, 600, 44, TYPE.title, THEME.ink, true, true);
  kit.label(hud, '古今中外 · 走在前人留下的路上', 0, top - 62, 600, 28, TYPE.caption, THEME.muted, true);
  regions.forEach((region, index) => {
    const y = 280 - index * 168;
    const card = kit.panel(hud, 0, y, 630, 150, THEME.panel, 22, THEME.panelBorder);
    drawScene(kit, card, -210, 0, {
      visual: region.scene,
      width: 180,
      height: 126,
      ageBand: 'adult',
      region: region.region,
    });
    kit.label(card, `${region.era}　${region.name}`, 80, 32, 360, 36, TYPE.subtitle, THEME.ink, false, true);
    kit.label(card, region.description.preview, 80, -18, 360, 70, TYPE.caption, THEME.muted, false, false, 24);
    const button = card.addComponent(Button);
    button.transition = Button.Transition.NONE;
    card.on(Button.EventType.CLICK, () => actions.openRegion(region.id));
  });
  kit.textAction(hud, '返回轮回空间', 0, -590, actions.goHome);
}

export function renderHistoryFigures(
  kit: UiKit,
  title: string,
  figures: FigureCardView[],
  actions: PageActions & { select: (id: string) => void; confirm: () => void; back: () => void },
): void {
  const { hud } = kit.beginPage('history-figures');
  const top = 640 - kit.layout.top;
  const selected = figures.find((item) => item.selected);
  kit.label(hud, title, 0, top - 20, 600, 44, TYPE.title, THEME.ink, true, true);
  kit.label(hud, '选一条被走过的路，选择仍由你来做', 0, top - 62, 600, 28, TYPE.caption, THEME.muted, true);
  figures.forEach((figure, index) => {
    const y = 250 - index * 168;
    const card = kit.panel(hud, 0, y, 630, 152, figure.selected ? colorFromRgb([255, 228, 214]) : THEME.panel, 22, figure.selected ? THEME.coral : THEME.panelBorder);
    drawPortrait(kit, card, -230, 6, 112, figure.look);
    kit.label(card, `${figure.name}　·　${figure.epithet}`, 70, 42, 380, 36, TYPE.subtitle, THEME.ink, false, true);
    kit.label(card, figure.opening.preview, 70, -10, 380, 70, TYPE.caption, THEME.muted, false, false, 24);
    if (figure.opening.expandable) {
      kit.textAction(card, '简介', 240, -58, () => actions.expand(`figure:${figure.id}`, figure.name, figure.opening.full));
    }
    const button = card.addComponent(Button);
    button.transition = Button.Transition.NONE;
    card.on(Button.EventType.CLICK, () => actions.select(figure.id));
  });
  kit.button(hud, selected ? `沿 ${selected.name} 的路走` : '先选一位前人', 0, -470, 560, 72, selected ? THEME.coral : THEME.disabled, actions.confirm, Boolean(selected));
  kit.textAction(hud, '返回地域', 0, -560, actions.back);
}

export function renderPaths(
  kit: UiKit,
  view: PathPageView,
  actions: PageActions & { choose: (id: string) => void },
): void {
  const { hud } = kit.beginPage('path');
  const top = 640 - kit.layout.top;
  kit.label(hud, '此刻要走进哪一程？', 0, top - 18, 620, 44, TYPE.title - 2, THEME.ink, true, true);
  kit.label(hud, view.caption, 0, top - 58, 620, 28, TYPE.caption, THEME.muted, true);
  renderMarkStrip(kit, hud, view.marks, 0, top - 100, actions);
  if (view.paths.length === 0) {
    kit.label(hud, '没有可走的路了。', 0, 80, 520, 80, TYPE.subtitle, THEME.ink, true);
  }
  view.paths.slice(0, 3).forEach((path, index) => {
    const y = 210 - index * 195;
    const card = kit.panel(hud, 0, y, 630, 178, THEME.panel, 22, THEME.panelBorder);
    drawScene(kit, card, -200, 0, {
      visual: path.scene,
      width: 200,
      height: 150,
      ageBand: view.ageBand,
      figure: getFigureVisual(view.figureId),
      region: getRegionVisual(view.region),
    });
    kit.label(card, path.title, 90, 36, 340, 36, TYPE.subtitle, THEME.ink, false, true);
    kit.label(card, path.sceneName, 90, 6, 340, 24, TYPE.caption, THEME.coralDeep, false);
    kit.label(card, path.summary.preview, 90, -32, 340, 70, TYPE.caption, THEME.muted, false, false, 24);
    const button = card.addComponent(Button);
    button.transition = Button.Transition.NONE;
    card.on(Button.EventType.CLICK, () => actions.choose(path.id));
  });
  kit.textAction(hud, '返回轮回空间（本世已自动保存）', 0, -590, actions.goHome);
}

export function renderScenario(
  kit: UiKit,
  view: ScenarioPageView,
  actions: PageActions & { act: (id: string) => void },
  keepScene: boolean,
): void {
  const { hud, scene } = kit.beginPage('scenario', keepScene);
  const top = 640 - kit.layout.top;
  const sceneH = kit.layout.sceneHeight;
  const sceneY = top - 86 - sceneH / 2;
  if (!keepScene || !scene.getChildByName(`Scene:${view.kind}`)) {
    scene.removeAllChildren();
    drawScene(kit, scene, 0, sceneY, {
      visual: view.scene,
      width: 680,
      height: sceneH,
      ageBand: view.ageBand,
      figure: getFigureVisual(view.figureId),
      region: getRegionVisual(view.region),
    });
  }
  kit.label(hud, view.title, 0, top - 10, 560, 36, TYPE.subtitle, THEME.ink, true, true);
  kit.label(hud, `约 ${view.age} 岁　·　第 ${view.turnCurrent} / ${view.turnMax} 回`, 0, top - 42, 560, 24, TYPE.caption, THEME.muted, true);
  kit.progress(hud, 0, top - 66, 420, 10, view.turnProgress, THEME.skyDeep);
  renderResources(kit, hud, view.resources, 0, sceneY - sceneH / 2 - 28);
  const eventY = sceneY - sceneH / 2 - 108;
  const eventCard = kit.panel(hud, 0, eventY, 640, 96, THEME.panel, 18, THEME.panelBorder);
  renderExpandable(kit, eventCard, view.event, 0, 8, 600, 56, () => actions.expand('event', view.title, view.event.full));
  renderMarkStrip(kit, hud, view.marks, 0, eventY - 70, actions);
  renderActions(kit, hud, view.actions, -320, actions.act);
  view.diffs.resources.forEach((delta) => {
    kit.floatLabel(hud, `${delta.delta > 0 ? '+' : ''}${delta.delta} ${delta.label}`, 0, eventY + 60, delta.delta > 0 ? THEME.positive : THEME.coralDeep);
  });
  kit.textAction(hud, '返回轮回空间（本世已自动保存）', 0, -600, actions.goHome);
}

export function renderChoices(
  kit: UiKit,
  view: ChoicePageView,
  actions: PageActions & {
    select: (id: string) => void;
    confirm: () => void;
    toggleForesight: () => void;
    reroll: () => void;
  },
): void {
  const { hud, scene } = kit.beginPage('choice');
  const top = 640 - kit.layout.top;
  const sceneH = 280;
  drawScene(kit, scene, 0, top - 40 - sceneH / 2, {
    visual: view.scene,
    width: 680,
    height: sceneH,
    ageBand: view.ageBand,
    figure: getFigureVisual(view.figureId),
    region: getRegionVisual(view.region),
  });
  kit.label(hud, `${view.age} 岁 · ${view.source}`, 0, top - 8, 600, 24, TYPE.caption, THEME.muted, true);
  const eventCard = kit.panel(hud, 0, 150, 640, 100, THEME.panel, 18, THEME.panelBorder);
  renderExpandable(kit, eventCard, view.event, 0, 8, 600, 64, () => actions.expand('choice-event', '此刻', view.event.full));
  const count = view.choices.length;
  view.choices.forEach((choice, index) => {
    const y = 20 - index * (count > 3 ? 88 : 100);
    const card = kit.panel(hud, 0, y, 640, count > 3 ? 80 : 92, choice.selected ? colorFromRgb([255, 228, 214]) : THEME.panel, 16, choice.selected ? THEME.coral : THEME.panelBorder);
    kit.label(card, choice.text, 0, 16, 600, 32, TYPE.body, THEME.ink, true, true);
    kit.label(card, choice.foresight ?? choice.preview, 0, -16, 600, 32, TYPE.caption, choice.foresight ? THEME.positive : THEME.muted, true);
    const button = card.addComponent(Button);
    button.transition = Button.Transition.NONE;
    card.on(Button.EventType.CLICK, () => actions.select(choice.id));
  });
  const bottom = -430;
  kit.button(hud, '确认此路', 0, bottom, 280, 72, view.canConfirm ? THEME.coral : THEME.disabled, actions.confirm, view.canConfirm);
  if (view.canForesight) {
    kit.button(hud, view.foresightOpen ? '收起预见' : '预见可能', -220, bottom, 180, 72, THEME.skyDeep, actions.toggleForesight, true, THEME.white, 20);
  }
  if (view.canReroll) {
    kit.textAction(hud, `改写这次遭遇（剩余 ${view.rerollsRemaining} 次）`, 0, bottom - 70, actions.reroll);
  }
  kit.textAction(hud, '返回轮回空间（选择已保存）', 0, -590, actions.goHome);
}

export function renderSummary(
  kit: UiKit,
  view: SummaryPageView,
  actions: PageActions & { next: () => void },
): void {
  const { hud, scene } = kit.beginPage('summary');
  const top = 640 - kit.layout.top;
  drawScene(kit, scene, 0, top - 200, {
    visual: view.scene,
    width: 680,
    height: 280,
    ageBand: view.ageBand,
    figure: getFigureVisual(view.figureId),
    region: getRegionVisual(view.region),
  });
  kit.label(hud, `${view.title} · 一程结束`, 0, top - 16, 620, 40, TYPE.subtitle, THEME.ink, true, true);
  kit.label(hud, `大约过了 ${view.years} 年，如今约 ${view.ageAfter} 岁`, 0, top - 52, 620, 28, TYPE.caption, THEME.muted, true);
  const card = kit.panel(hud, 0, -40, 640, 360, THEME.panel, 24, THEME.panelBorder);
  view.lines.forEach((line, index) => {
    kit.label(card, line.preview, 0, 130 - index * 70, 580, 60, TYPE.body, THEME.ink, true, false, 32);
  });
  view.diffs.marks.forEach((mark, index) => {
    kit.label(hud, `${mark.removed ? '消散' : mark.delta > 0 ? '留下' : '淡了'} ${mark.name}`, 0, -250 - index * 24, 560, 24, TYPE.caption, THEME.positive, true);
  });
  kit.button(hud, '下一程', 0, -430, 560, 80, THEME.coral, actions.next);
  kit.textAction(hud, '返回轮回空间', 0, -520, actions.goHome);
}

export function renderReady(
  kit: UiKit,
  view: ReadyPageView,
  actions: PageActions & { advance: () => void; toggleAuto: () => void },
): void {
  const { hud, scene } = kit.beginPage('ready');
  const top = 640 - kit.layout.top;
  const sceneH = 360;
  drawScene(kit, scene, 0, top - 70 - sceneH / 2, {
    visual: view.scene,
    width: 680,
    height: sceneH,
    ageBand: view.ageBand,
    figure: getFigureVisual(),
  });
  kit.label(hud, `${view.age} 岁`, 0, top - 8, 200, 40, TYPE.title, THEME.ink, true, true);
  kit.label(hud, `${view.familyName}　·　${view.stageLine}`, 0, top - 44, 600, 24, TYPE.caption, THEME.muted, true);
  kit.label(hud, view.worldLine, 0, 80, 600, 28, TYPE.caption, THEME.coralDeep, true);
  renderMarkStrip(kit, hud, view.marks, 0, 40, actions);
  const card = kit.panel(hud, 0, -80, 640, 180, THEME.panel, 22, THEME.panelBorder);
  kit.label(card, `${view.latestAge} 岁`, 0, 58, 200, 28, TYPE.caption, THEME.coral, true, true);
  renderExpandable(kit, card, view.latest, 0, 8, 580, 80, () => actions.expand('ready', '这一年', view.latest.full));
  kit.label(card, view.effectLine, 0, -62, 580, 28, TYPE.caption, THEME.positive, true);
  kit.button(hud, '继续人生', -150, -320, 280, 80, THEME.coral, actions.advance);
  kit.button(hud, view.autoPlaying ? '暂停快进' : '快进至抉择', 170, -320, 260, 80, view.autoPlaying ? THEME.coralDeep : THEME.creamDeep, actions.toggleAuto, true, view.autoPlaying ? THEME.white : THEME.ink);
  kit.textAction(hud, '返回轮回空间（本世已自动保存）', 0, -420, actions.goHome);
}

export function renderResult(
  kit: UiKit,
  view: ResultPageView,
  actions: PageActions & { rewards: () => void; nextLife: () => void },
): void {
  const { hud, scene } = kit.beginPage('result');
  const top = 640 - kit.layout.top;
  drawScene(kit, scene, 0, top - 180, {
    visual: view.scene,
    width: 680,
    height: 240,
    ageBand: view.age >= 60 ? 'elder' : 'adult',
    figure: getFigureVisual(),
  });
  kit.label(hud, '本世已终', 0, top - 8, 560, 28, TYPE.caption, THEME.muted, true);
  kit.label(hud, view.endingTitle, 0, top - 48, 620, 44, TYPE.title, THEME.ink, true, true);
  const card = kit.panel(hud, 0, 40, 640, 420, THEME.panel, 24, THEME.panelBorder);
  kit.label(card, `${view.age} 岁　·　评价 ${view.score}`, 0, 170, 560, 36, TYPE.subtitle, THEME.ink, true, true);
  kit.label(card, view.endReason, 0, 130, 560, 32, TYPE.caption, THEME.muted, true);
  kit.label(card, view.worldLine, 0, 96, 560, 28, TYPE.caption, THEME.coralDeep, true);
  kit.label(card, `本世获得　+${view.earnedExp} 轮回经验`, 0, 52, 560, 32, TYPE.subtitle - 4, THEME.coralDeep, true, true);
  kit.label(card, view.expDetails, 0, 18, 560, 24, TYPE.caption, THEME.muted, true);
  kit.label(card, view.levelLine, 0, -18, 560, 28, TYPE.body, THEME.ink, true, true);
  kit.label(card, view.rewardText, 0, -70, 560, 70, TYPE.caption, THEME.positive, true, false, 24);
  view.timeline.slice(0, 3).forEach((item, index) => {
    kit.label(card, `${item.age} 岁　${item.text.preview}`, 0, -140 - index * 28, 580, 26, TYPE.caption, THEME.muted, false);
  });
  if (view.pendingReward) {
    kit.button(hud, '选择轮回传承', 0, -330, 560, 80, THEME.coral, actions.rewards);
  } else {
    if (view.selectedRewardName) {
      kit.label(hud, `本世传承：${view.selectedRewardName}`, 0, -280, 560, 28, TYPE.caption, THEME.positive, true, true);
    }
    kit.button(hud, '带着传承再活一世', 0, -340, 560, 80, THEME.coral, actions.nextLife);
  }
  kit.button(hud, '返回轮回空间', 0, -440, 560, 70, THEME.creamDeep, actions.goHome, true, THEME.ink);
}

export function renderRewards(
  kit: UiKit,
  view: RewardPageView,
  actions: PageActions & { select: (id: string) => void; claim: () => void },
): void {
  const { hud } = kit.beginPage('rewards');
  const top = 640 - kit.layout.top;
  kit.label(hud, '选择一份轮回传承', 0, top - 20, 620, 44, TYPE.title - 2, THEME.ink, true, true);
  kit.label(hud, '三选一 · 选中后确认领取', 0, top - 60, 620, 28, TYPE.caption, THEME.muted, true);
  view.cards.forEach((cardView, index) => {
    const y = 250 - index * 200;
    const card = kit.panel(hud, 0, y, 630, 184, cardView.selected ? colorFromRgb([255, 228, 214]) : THEME.panel, 22, cardView.selected ? THEME.coral : THEME.panelBorder);
    drawMarkBadge(kit, card, -250, 20, cardView.category, THEME.coral);
    kit.label(card, `${cardView.categoryLabel}｜${cardView.name}`, 20, 50, 420, 32, TYPE.subtitle, THEME.ink, false, true);
    kit.label(card, cardView.description.preview, 20, 6, 420, 56, TYPE.caption, THEME.muted, false, false, 24);
    kit.label(card, cardView.rankText, 20, -50, 420, 24, TYPE.caption, THEME.coralDeep, false);
    if (cardView.description.expandable) {
      kit.textAction(card, '完整说明', 240, -58, () => actions.expand(`reward:${cardView.id}`, cardView.name, cardView.description.full));
    }
    const button = card.addComponent(Button);
    button.transition = Button.Transition.NONE;
    card.on(Button.EventType.CLICK, () => actions.select(cardView.id));
  });
  kit.button(hud, '确认领取', 0, -430, 560, 80, view.canClaim ? THEME.coral : THEME.disabled, actions.claim, view.canClaim);
  kit.textAction(hud, '返回查看本世结算', 0, -520, actions.goHome);
}

export function renderLoadout(
  kit: UiKit,
  view: LoadoutPageView,
  actions: PageActions & { select: (id: string) => void; toggle: (id: string) => void },
): void {
  const { hud } = kit.beginPage('loadout');
  const top = 640 - kit.layout.top;
  kit.label(hud, '装配轮回传承', 0, top - 18, 620, 40, TYPE.title - 2, THEME.ink, true, true);
  kit.label(hud, `已装备 ${view.filled}/${view.slotCount} · 新人生开始前可随时调整`, 0, top - 56, 620, 28, TYPE.caption, THEME.muted, true);
  renderSlots(kit, hud, view.slots, 0, top - 110, 600);
  const rows = Math.ceil(view.items.length / 2);
  const contentHeight = Math.max(320, rows * 150 + 20);
  const grid = kit.scrollArea(hud, 0, 40, 640, 360, contentHeight);
  view.items.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = col === 0 ? -155 : 155;
    const y = contentHeight / 2 - 70 - row * 150;
    const card = kit.panel(grid, x, y, 300, 136, item.equipped ? colorFromRgb([255, 228, 214]) : THEME.panel, 16, item.equipped ? THEME.coral : THEME.panelBorder);
    kit.label(card, item.name, 0, 36, 270, 28, TYPE.body, THEME.ink, true, true);
    kit.label(card, `${item.categoryLabel} · ${item.rank}/${item.maxRank} 阶`, 0, 8, 270, 22, TYPE.caption, THEME.muted, true);
    kit.label(card, item.equipped ? '已装备' : (item.enabled ? '点选查看' : item.disabledReason ?? ''), 0, -24, 270, 22, TYPE.caption, item.equipped ? THEME.coralDeep : THEME.muted, true);
    const button = card.addComponent(Button);
    button.transition = Button.Transition.NONE;
    card.on(Button.EventType.CLICK, () => actions.select(item.id));
  });
  if (view.selected) {
    kit.label(hud, view.selected.description.full, 0, -230, 600, 90, TYPE.caption, THEME.ink, true, false, 24);
    kit.button(
      hud,
      view.selected.equipped ? '卸下' : '装备',
      0,
      -330,
      360,
      72,
      view.selected.enabled ? THEME.coral : THEME.disabled,
      () => actions.toggle(view.selected!.id),
      view.selected.enabled,
    );
  }
  kit.textAction(hud, '返回轮回空间', 0, -430, actions.goHome);
}

export function renderError(kit: UiKit, message: string, goHome: () => void): void {
  const { hud } = kit.beginPage('error');
  kit.label(hud, '这一世暂时停住了', 0, 220, 590, 80, TYPE.title, THEME.ink, true, true);
  kit.panel(hud, 0, 10, 590, 250, THEME.panel, 24, THEME.panelBorder);
  kit.label(hud, message, 0, 10, 510, 180, TYPE.body, THEME.coralDeep, true, false, 34);
  kit.button(hud, '返回轮回空间', 0, -220, 520, 86, THEME.coral, goHome);
}

export function renderOverlay(kit: UiKit, title: string, body: string, onClose: () => void): void {
  if (!kit.hudLayer) {
    return;
  }
  kit.overlay(kit.hudLayer, title, body, onClose);
}

function renderSlots(kit: UiKit, parent: Node, slots: SlotView[], x: number, y: number, width: number): void {
  const gap = 16;
  const slotW = Math.min(180, (width - gap * (slots.length - 1)) / Math.max(1, slots.length));
  const origin = x - ((slots.length - 1) * (slotW + gap)) / 2;
  slots.forEach((slot, index) => {
    const node = kit.panel(parent, origin + index * (slotW + gap), y, slotW, 56, slot.filled ? colorFromRgb([255, 228, 214]) : THEME.creamDeep, 14, slot.filled ? THEME.coral : THEME.panelBorder);
    kit.label(node, slot.filled ? (slot.name ?? '已装备') : '空槽', 0, 0, slotW - 12, 40, TYPE.caption, slot.filled ? THEME.ink : THEME.faint, true);
  });
}

function renderMarkStrip(
  kit: UiKit,
  parent: Node,
  marks: MarkStripView,
  x: number,
  y: number,
  actions: PageActions,
): void {
  if (marks.visible.length === 0) {
    kit.label(parent, '尚无留下的光环或行囊', x, y, 560, 28, TYPE.caption, THEME.muted, true);
    return;
  }
  const items = marks.visible;
  const width = 170;
  const origin = x - ((items.length - 1) * (width + 12)) / 2;
  items.forEach((mark, index) => {
    renderMarkChip(kit, parent, mark, origin + index * (width + 12), y);
  });
  if (marks.overflow.length > 0) {
    kit.textAction(parent, `还有 ${marks.overflow.length} 项`, x + 250, y, () => {
      const body = [...marks.visible, ...marks.overflow].map((item) => `${item.name}　${item.hint}`).join('\n\n');
      actions.expand('marks', '光环、行囊与负累', body);
    });
  }
}

function renderMarkChip(kit: UiKit, parent: Node, mark: MarkChipView, x: number, y: number): void {
  const fill = mark.nature === 'burden' ? THEME.coralDeep : mark.nature === 'possession' ? THEME.skyDeep : THEME.grass;
  const node = kit.panel(parent, x, y, 170, 40, THEME.white, 14, fill);
  drawMarkBadge(kit, node, -62, 0, mark.nature, fill);
  kit.label(node, mark.name, 12, 0, 110, 28, TYPE.caption, THEME.ink, false, true);
}

function renderResources(kit: UiKit, parent: Node, resources: ResourceView[], x: number, y: number): void {
  const width = 150;
  const origin = x - ((resources.length - 1) * (width + 10)) / 2;
  resources.forEach((resource, index) => {
    const node = kit.panel(parent, origin + index * (width + 10), y, width, 40, THEME.white, 12, THEME.panelBorder);
    const delta = resource.delta ? ` ${resource.delta > 0 ? '+' : ''}${resource.delta}` : '';
    kit.label(node, `${resource.label} ${resource.value}${delta}`, 0, 0, width - 8, 28, TYPE.caption, resource.delta && resource.delta > 0 ? THEME.positive : THEME.ink, true, true);
  });
}

function renderActions(kit: UiKit, parent: Node, actions: ActionView[], y: number, onAct: (id: string) => void): void {
  const count = actions.length;
  const width = count >= 3 ? 190 : count === 2 ? 280 : 360;
  const origin = -((count - 1) * (width + 12)) / 2;
  actions.forEach((action, index) => {
    const x = origin + index * (width + 12);
    const card = kit.panel(parent, x, y, width, 150, action.enabled ? THEME.panel : THEME.creamDeep, 18, action.enabled ? THEME.coral : THEME.panelBorder);
    kit.label(card, action.title, 0, 40, width - 16, 32, TYPE.body, THEME.ink, true, true);
    kit.label(card, action.hint, 0, 4, width - 20, 44, TYPE.caption, THEME.muted, true, false, 22);
    kit.label(card, action.enabled ? (action.costText ?? '') : (action.disabledReason ?? ''), 0, -42, width - 16, 26, TYPE.caption, THEME.coralDeep, true);
    if (action.enabled) {
      const button = card.addComponent(Button);
      button.transition = Button.Transition.NONE;
      card.on(Button.EventType.CLICK, () => onAct(action.id));
    }
  });
}

function renderExpandable(
  kit: UiKit,
  parent: Node,
  story: TruncatedText,
  x: number,
  y: number,
  width: number,
  height: number,
  onExpand: () => void,
): void {
  kit.label(parent, story.preview, x, y + (story.expandable ? 8 : 0), width, height, TYPE.body, THEME.ink, true, false, 30);
  if (story.expandable) {
    kit.textAction(parent, '展开全文', x, y - height / 2 + 14, onExpand);
  }
}
