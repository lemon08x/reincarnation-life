import { Button, Node } from 'cc';
import { getFigureVisual } from '../app/presentation/visualConfig';
import {
  CarryPageView,
  CausalityPageView,
  EncounterPageView,
  EndingPageView,
  HomeView,
  MarkChipView,
  MarkStripView,
  RecallPageView,
  TruncatedText,
} from '../app/presentation/uiModels';
import { UiKit } from './kit';
import { drawGateScene, drawMarkBadge, drawScene } from './sceneArt';
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
    archiveLife: () => void;
    startLife: () => void;
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

  const cardY = sceneY - sceneH / 2 - 130;
  const card = kit.panel(hud, 0, cardY, 640, 220, THEME.panel, 24, THEME.panelBorder);
  kit.label(card, view.archiveLine, 0, 70, 580, 36, TYPE.subtitle, THEME.ink, true, true);
  kit.label(card, '经历会留下，理解可以改口。事实不会被覆盖。', 0, 28, 580, 32, TYPE.caption, THEME.muted, true);
  if (view.discoveries[0]) {
    kit.label(card, view.discoveries[0].statement.preview, 0, -16, 580, 40, TYPE.body, THEME.ink, true, false, 28);
    kit.label(card, view.discoveries[0].sourceLine || `${view.discoveries[0].sourceCount} 处真实来源`, 0, -58, 580, 28, TYPE.caption, THEME.coralDeep, true);
  } else {
    kit.label(card, '新的一世不需要先有收藏。', 0, -24, 580, 40, TYPE.body, THEME.muted, true);
  }

  const actionY = -430;
  if (view.runStatus === 'active') {
    kit.button(hud, '继续这一世', 0, actionY, 560, 80, THEME.coral, actions.continueLife);
    kit.label(hud, view.continueCaption ?? '', 0, actionY - 64, 560, 28, TYPE.caption, THEME.muted, true);
  } else if (view.runStatus === 'awaiting-archive') {
    kit.button(hud, '收入档案', 0, actionY, 560, 80, THEME.coral, actions.archiveLife);
    kit.label(hud, view.continueCaption ?? '', 0, actionY - 64, 560, 28, TYPE.caption, THEME.muted, true);
  } else {
    kit.button(hud, '开启这一世', 0, actionY, 560, 80, THEME.coral, actions.startLife);
    kit.label(hud, '自由模式已重做。历史入口暂且收起。', 0, actionY - 64, 600, 28, TYPE.caption, THEME.muted, true);
    if (view.lastTitle) {
      kit.button(hud, `上一世：${view.lastTitle}`, 0, actionY - 140, 560, 64, THEME.creamDeep, actions.lastResult, true, THEME.ink, 20);
    }
  }
}

export function renderCarry(
  kit: UiKit,
  view: CarryPageView,
  actions: PageActions & {
    toggle: (id: string) => void;
    begin: () => void;
    skip: () => void;
  },
): void {
  const { hud } = kit.beginPage('carry');
  const top = 640 - kit.layout.top;
  kit.label(hud, '要带着哪段理解上路？', 0, top - 24, 620, 44, TYPE.title - 2, THEME.ink, true, true);
  kit.label(hud, `最多 ${view.max} 条。可以少带，也可以不带。`, 0, top - 64, 620, 28, TYPE.caption, THEME.muted, true);
  view.cards.slice(0, 5).forEach((card, index) => {
    const y = 280 - index * 118;
    const node = kit.panel(hud, 0, y, 640, 108, card.selected ? colorFromRgb([255, 228, 214]) : THEME.panel, 20, card.selected ? THEME.coral : THEME.panelBorder);
    kit.label(node, card.theme, 0, 32, 580, 24, TYPE.caption, THEME.coralDeep, true, true);
    kit.label(node, card.statement.preview, 0, 2, 580, 40, TYPE.body, THEME.ink, true, false, 28);
    kit.label(node, card.sourceLine, 0, -34, 580, 24, TYPE.caption, THEME.muted, true);
    const button = node.addComponent(Button);
    button.transition = Button.Transition.NONE;
    node.on(Button.EventType.CLICK, () => actions.toggle(card.id));
  });
  kit.button(hud, view.selectedCount > 0 ? `带着 ${view.selectedCount} 条理解出发` : '先选，或选择不带', 0, -470, 560, 72, view.selectedCount > 0 ? THEME.coral : THEME.creamDeep, actions.begin, true, view.selectedCount > 0 ? THEME.white : THEME.ink);
  kit.textAction(hud, '不带任何理解，重新开始', 0, -550, actions.skip);
  kit.textAction(hud, '返回轮回空间', 0, -600, actions.goHome);
}

export function renderEncounter(
  kit: UiKit,
  view: EncounterPageView,
  actions: PageActions & {
    select: (id: string) => void;
    confirm: () => void;
    openPast: (id: string) => void;
  },
): void {
  const { hud, scene } = kit.beginPage('encounter');
  const top = 640 - kit.layout.top;
  const sceneH = 250;
  drawScene(kit, scene, 0, top - 28 - sceneH / 2, {
    visual: view.scene,
    width: 680,
    height: sceneH,
    ageBand: view.ageBand,
    figure: getFigureVisual(),
  });
  kit.label(hud, `${view.age} 岁 · 人生点 ${view.lifePoints} / ${view.lifePointCap}`, 0, top - 6, 620, 24, TYPE.caption, THEME.muted, true);
  kit.label(hud, view.title, 0, top - 36, 620, 28, TYPE.subtitle, THEME.ink, true, true);

  const eventCard = kit.panel(hud, 0, 168, 640, 100, THEME.panel, 18, THEME.panelBorder);
  renderExpandable(kit, eventCard, view.event, 0, 10, 600, 56, () => actions.expand('event', view.title, view.event.full));
  if (view.triggerNote.expandable || view.triggerNote.preview) {
    kit.label(hud, view.triggerNote.preview, 0, 108, 620, 24, TYPE.caption, THEME.coralDeep, true);
  }
  if (view.recalled.length > 0) {
    view.recalled.slice(0, 2).forEach((item, index) => {
      kit.textAction(hud, item.text, 0, 78 - index * 36, () => actions.openPast(item.id));
    });
  }

  const count = view.options.length;
  view.options.forEach((option, index) => {
    const y = (count > 3 ? -10 : 8) - index * (count > 3 ? 82 : 92);
    const fill = !option.enabled
      ? THEME.creamDeep
      : option.selected
        ? colorFromRgb([255, 228, 214])
        : THEME.panel;
    const border = option.selected ? THEME.coral : THEME.panelBorder;
    const card = kit.panel(hud, 0, y, 640, count > 3 ? 76 : 86, fill, 16, border);
    kit.label(card, option.text, 0, 16, 600, 28, TYPE.body, THEME.ink, true, true);
    const hint = option.enabled
      ? [option.costLabel, option.preview].filter(Boolean).join(' · ')
      : (option.disabledReason ?? option.preview);
    kit.label(card, hint, 0, -16, 600, 28, TYPE.caption, option.enabled ? THEME.muted : THEME.coralDeep, true);
    if (option.enabled) {
      const button = card.addComponent(Button);
      button.transition = Button.Transition.NONE;
      card.on(Button.EventType.CLICK, () => actions.select(option.id));
    }
    if (option.supportReason) {
      kit.textAction(card, '为何要花点', 250, -28, () => actions.expand(`cost:${option.id}`, option.text, option.supportReason ?? ''));
    }
  });

  kit.button(hud, '确认此路', 0, -470, 280, 72, view.canConfirm ? THEME.coral : THEME.disabled, actions.confirm, view.canConfirm);
  kit.textAction(hud, '返回轮回空间（选择已保存）', 0, -560, actions.goHome);
}

export function renderRecall(
  kit: UiKit,
  view: RecallPageView,
  actions: PageActions & {
    select: (stance: RecallPageView['selectedStance']) => void;
    confirm: () => void;
    openPast: (index: number) => void;
  },
): void {
  const { hud, scene } = kit.beginPage('recall');
  const top = 640 - kit.layout.top;
  drawScene(kit, scene, 0, top - 180, {
    visual: view.scene,
    width: 680,
    height: 240,
    ageBand: view.ageBand,
    figure: getFigureVisual(),
  });
  kit.label(hud, `回望 · 人生点 ${view.lifePoints}`, 0, top - 8, 600, 28, TYPE.caption, THEME.muted, true);
  const prompt = kit.panel(hud, 0, 150, 640, 120, THEME.panel, 20, THEME.panelBorder);
  renderExpandable(kit, prompt, view.prompt, 0, 8, 600, 80, () => actions.expand('recall', '回望', view.prompt.full));
  view.evidence.slice(0, 2).forEach((item, index) => {
    kit.textAction(hud, item.preview, 0, 70 - index * 32, () => actions.openPast(index));
  });
  view.options.forEach((option, index) => {
    const y = -40 - index * 110;
    const card = kit.panel(hud, 0, y, 640, 100, option.selected ? colorFromRgb([255, 228, 214]) : THEME.panel, 18, option.selected ? THEME.coral : THEME.panelBorder);
    kit.label(card, option.label, 0, 28, 580, 28, TYPE.subtitle, THEME.coralDeep, true, true);
    kit.label(card, option.statement.preview, 0, -8, 580, 48, TYPE.body, THEME.ink, true, false, 28);
    const button = card.addComponent(Button);
    button.transition = Button.Transition.NONE;
    card.on(Button.EventType.CLICK, () => actions.select(option.stance));
  });
  kit.label(hud, '三种选择得到同样的人生点。', 0, -380, 600, 24, TYPE.caption, THEME.muted, true);
  kit.button(hud, '确认回望', 0, -450, 280, 72, view.canConfirm ? THEME.coral : THEME.disabled, actions.confirm, view.canConfirm);
  kit.textAction(hud, '返回轮回空间（回望已保存）', 0, -530, actions.goHome);
}

export function renderCausality(
  kit: UiKit,
  view: CausalityPageView,
  actions: PageActions & { back: () => void; openSource: (id: string) => void },
): void {
  const { hud } = kit.beginPage('causality');
  const top = 640 - kit.layout.top;
  kit.label(hud, view.title, 0, top - 20, 620, 40, TYPE.title - 4, THEME.ink, true, true);
  const card = kit.panel(hud, 0, 80, 640, 520, THEME.panel, 24, THEME.panelBorder);
  kit.label(card, '发生了什么', 0, 220, 580, 24, TYPE.caption, THEME.coralDeep, true, true);
  kit.label(card, view.happened.preview, 0, 170, 580, 70, TYPE.body, THEME.ink, true, false, 28);
  if (view.happened.expandable) {
    kit.textAction(card, '展开全文', 0, 120, () => actions.expand('happened', view.title, view.happened.full));
  }
  if (view.response) {
    kit.label(card, `我怎样回应：${view.response.preview}`, 0, 70, 580, 50, TYPE.caption, THEME.ink, true, false, 24);
  }
  if (view.understood) {
    kit.label(card, `当时的理解：${view.understood.preview}`, 0, 20, 580, 40, TYPE.caption, THEME.muted, true, false, 24);
  }
  kit.label(card, `这件事为什么发生：${view.triggerNote || '生活自己走到这里'}`, 0, -30, 580, 50, TYPE.caption, THEME.coralDeep, true, false, 24);
  kit.label(card, view.people.length > 0 ? `相关的人：${view.people.join('、')}` : '这件事里没有把别人卷得很深。', 0, -80, 580, 28, TYPE.caption, THEME.muted, true);
  if (view.later[0]) {
    kit.label(card, `后来：${view.later[0]}`, 0, -120, 580, 40, TYPE.caption, THEME.positive, true, false, 24);
  }
  view.evoked.slice(0, 2).forEach((item, index) => {
    kit.textAction(card, `为何想起：${item.note}`, 0, -170 - index * 36, () => actions.openSource(item.id));
  });
  kit.button(hud, '返回刚才的地方', 0, -430, 560, 80, THEME.coral, actions.back);
  kit.textAction(hud, '回轮回空间', 0, -520, actions.goHome);
}

export function renderEnding(
  kit: UiKit,
  view: EndingPageView,
  actions: PageActions & { archive: () => void; nextLife: () => void },
): void {
  const { hud, scene } = kit.beginPage('ending');
  const top = 640 - kit.layout.top;
  drawScene(kit, scene, 0, top - 170, {
    visual: view.scene,
    width: 680,
    height: 220,
    ageBand: view.ageBand,
    figure: getFigureVisual(),
  });
  kit.label(hud, `${view.age} 岁`, 0, top - 8, 200, 24, TYPE.caption, THEME.muted, true);
  kit.label(hud, view.title, 0, top - 42, 620, 40, TYPE.title - 2, THEME.ink, true, true);
  const card = kit.panel(hud, 0, 40, 640, 430, THEME.panel, 24, THEME.panelBorder);
  kit.label(card, view.text.preview, 0, 170, 580, 60, TYPE.body, THEME.ink, true, false, 30);
  kit.label(card, view.worldLine, 0, 120, 580, 28, TYPE.caption, THEME.coralDeep, true);
  kit.label(card, '哪些经历塑造了你', 0, 84, 580, 24, TYPE.caption, THEME.muted, true, true);
  view.shapedBy.slice(0, 3).forEach((item, index) => {
    kit.label(card, item.preview, 0, 52 - index * 28, 580, 26, TYPE.caption, THEME.ink, true);
  });
  kit.label(card, view.changed[0] ? `你改变了什么：${view.changed[0]}` : '', 0, -50, 580, 40, TYPE.caption, THEME.positive, true, false, 24);
  kit.label(card, view.unresolved[0] ? `仍未解决：${view.unresolved[0]}` : '', 0, -96, 580, 40, TYPE.caption, THEME.muted, true, false, 24);
  if (view.unfulfilled[0]) {
    kit.label(card, view.unfulfilled[0], 0, -140, 580, 40, TYPE.caption, THEME.coralDeep, true, false, 22);
  }
  if (view.pendingArchive) {
    kit.button(hud, '收入档案，准备下一世', 0, -340, 560, 80, THEME.coral, actions.archive);
  } else {
    kit.button(hud, '开启下一世', 0, -340, 560, 80, THEME.coral, actions.nextLife);
  }
  kit.button(hud, '返回轮回空间', 0, -440, 560, 70, THEME.creamDeep, actions.goHome, true, THEME.ink);
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

export function renderMarkStripPublic(
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
