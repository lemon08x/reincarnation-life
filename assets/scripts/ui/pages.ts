import { Button, Label } from 'cc';
import { getFigureVisual, SCENE_VISUALS, SceneVisual, CharacterAgeBand } from '../app/presentation/visualConfig';
import { CarryPageView, CausalityPageView, EncounterPageView, EndingPageView, HomeView, RecallPageView, ResultPageView, JournalPageView, GrowthHud } from '../app/presentation/uiModels';
import { JournalBlock, measureBlocks, textHeight } from '../app/presentation/journalLayout';
import { UiKit } from './kit';
import { drawScene } from './sceneArt';
import { THEME } from './theme';

export interface PageActions {
  goHome: () => void;
  expand: (key: string, title: string, body: string) => void;
  journal?: () => void;
}
interface Footer { text: string; action: () => void; enabled?: boolean; hint?: string }
function page(kit: UiKit, key: string, title: string, subtitle: string, blocks: JournalBlock[], actions: PageActions,
  footer: Footer, visual?: SceneVisual, band: CharacterAgeBand = 'adult', back?: () => void, growth?: GrowthHud): void {
  const { hud, scene } = kit.beginPage(key);
  const top = 640 - kit.layout.top;
  const bottom = -640 + kit.layout.bottom;
  kit.textAction(hud, back ? '‹ 返回' : '‹ 轮回', -264, top - 40, back ?? actions.goHome, 132);
  kit.label(hud, title, 0, top - 38, 384, 52, 34, THEME.ink, true, true);
  if (actions.journal) kit.textAction(hud, '角色', 260, top - 40, actions.journal, 144);
  kit.label(hud, subtitle, 0, top - 94, 624, 36, 24, THEME.muted, true);
  let bodyTop = top - 124;
  if (growth) {
    kit.label(hud, growth.summary, 0, top - 140, 624, 36, 26, THEME.ink, true, true);
    kit.progress(hud, 0, top - 174, 624, 4, growth.progress, THEME.positive);
    kit.label(hud, growth.goal, 0, top - 206, 624, 40, 23, THEME.muted, true);
    bodyTop = top - 240;
  }
  if (visual) {
    drawScene(kit, scene, 0, growth ? top - 318 : top - 216, { visual, width: 632, height: 156, ageBand: band, figure: getFigureVisual() });
    bodyTop = growth ? top - 410 : top - 308;
  }
  const bodyBottom = bottom + 204;
  const viewport = bodyTop - bodyBottom;
  const measured = measureBlocks(blocks, 632, kit.layout.minTouch);
  const contentHeight = Math.max(viewport, measured.height);
  const content = kit.scrollArea(hud, 0, (bodyTop + bodyBottom) / 2, 648, viewport, contentHeight);
  for (const item of measured.items) {
    const block = item.block;
    const y = contentHeight / 2 - item.top - item.height / 2;
    const node = block.kind === 'plain'
      ? kit.createNode(content, 'Paragraph', 0, y, 632, item.height)
      : kit.panel(content, 0, y, 632, item.height, block.selected ? THEME.creamDeep : THEME.panel, 16, block.selected ? THEME.coralDeep : THEME.panelBorder);
    let cursor = item.height / 2 - 18;
    const write = (text: string | undefined, height: number, size: number, line: number, heading = false): void => {
      if (!text || !height) return;
      const label = kit.label(node, text, 0, cursor - height / 2, 592, height, size,
        block.disabled ? THEME.muted : heading ? THEME.coralDeep : size === 24 ? THEME.muted : THEME.ink, false, heading, line);
      label.verticalAlign = Label.VerticalAlign.TOP;
      cursor -= height + 12;
    };
    write(block.title, item.titleHeight, 26, 36, true);
    write(block.body, item.bodyHeight, 30, 44);
    write(block.detail, item.detailHeight, 24, 34);
    if (block.action && !block.disabled) {
      const button = node.addComponent(Button);
      button.transition = Button.Transition.NONE;
      node.on(Button.EventType.CLICK, block.action);
    }
  }
  kit.button(hud, footer.text, 0, bottom + 64, 632, 96, THEME.coralDeep, footer.action, footer.enabled !== false, THEME.white, 28);
  if (footer.hint) kit.label(hud, footer.hint, 0, bottom + 133, 632, 32, 22, THEME.muted, true);
}
const plain = (body: string, title?: string): JournalBlock => ({ title, body, kind: 'plain' });
const link = (title: string, action: () => void, detail?: string): JournalBlock => ({ title: `${title}  ›`, detail, action, kind: 'link' });

export function renderHome(kit: UiKit, view: HomeView, actions: PageActions & { continueLife: () => void; startLife: () => void; lastResult: () => void; family?: { label: string; action: () => void } }): void {
  const blocks: JournalBlock[] = [plain('你不知道后来会去哪里。\n但会做的事，可以跟着你走。', '从一段生活开始')];
  if (view.continueCaption) blocks.push(plain(view.continueCaption));
  if (view.lastTitle) blocks.push(link('上一世的生活', actions.lastResult, view.lastTitle));
  if (actions.family) blocks.push(link(actions.family.label, actions.family.action, '持续经营一个家庭，把积累留给下一代'));
  page(kit, 'home', '轮 回', '', blocks, actions,
    { text: view.runStatus === 'active' ? '继续这一世' : view.runStatus === 'awaiting-archive' ? '看看这一生' : '开始这一世',
      action: view.runStatus === 'active' ? actions.continueLife : view.runStatus === 'awaiting-archive' ? actions.lastResult : actions.startLife });
}
export function renderCarry(kit: UiKit, view: CarryPageView, actions: PageActions & { toggle: (id: string) => void; begin: () => void; skip: () => void; openPast: (id: string) => void }): void {
  const blocks: JournalBlock[] = [plain(`最多带上 ${view.max} 条理解，也可以空着手上路。这里的理解来自前一世，不代表新遇见的人会作出相同回应。`),
    { detail: '带走的是往事与来路。本世能力和专长从实际经历中获得，前世不会替你决定职业或增加数值。', kind: 'plain' }];
  for (const card of view.cards) {
    blocks.push({ title: `${card.selected ? '已选 · ' : ''}${card.theme}`, body: card.statement.full, detail: card.sourceLine,
      selected: card.selected, action: () => actions.toggle(card.id) });
    blocks.push(link('看看它从哪里来', () => actions.openPast(card.id)));
  }
  page(kit, 'carry', '带上什么', `已选 ${view.selectedCount} / ${view.max}`, blocks, actions,
    { text: view.selectedCount ? `带着 ${view.selectedCount} 条理解出发` : '不带理解，重新开始', action: actions.begin });
}

interface FocusOption { text: string; detail: string; disabled?: boolean; action: () => void }
function focusPage(kit: UiKit, key: string, meta: string, title: string, body: string, options: FocusOption[],
  actions: PageActions, feedback: EncounterPageView['feedback'], openPast: (id: string) => void): void {
  const { hud } = kit.beginPage(key);
  const top = 640 - kit.layout.top;
  const bottom = -640 + kit.layout.bottom;
  kit.textAction(hud, '‹', -296, top - 36, actions.goHome, 80);
  kit.label(hud, meta, -20, top - 36, 440, 48, 24, THEME.muted, false);
  if (actions.journal) kit.textAction(hud, '角色', 290, top - 36, actions.journal, 100);
  const feedbackBody = feedback ? textHeight(feedback.text, 584, 26, 36) : 0;
  const delta = feedback?.changes.slice(0, 3).join(' · ') ?? '';
  const feedbackDetail = delta ? textHeight(delta, 584, 24, 34) : 0;
  const feedbackHeight = feedback ? 28 + feedbackBody + (delta ? 10 + feedbackDetail : 0) : 0;
  const titleHeight = textHeight(title, 624, 38, 50);
  const storyHeight = textHeight(body, 624, 30, 42);
  const measured = options.map(o => {
    const nameHeight = textHeight(o.text, 584, 30, 40);
    const detailHeight = textHeight(o.detail, 584, 24, 34);
    return { ...o, nameHeight, detailHeight, height: Math.max(kit.layout.minTouch, 28 + nameHeight + (detailHeight ? 8 + detailHeight : 0)) };
  });
  const total = (feedback ? feedbackHeight + 28 : 0) + titleHeight + 18 + storyHeight + 32 + measured.reduce((n, o) => n + o.height + 14, 0);
  const viewport = top - 88 - (bottom + 14);
  const height = Math.max(total, viewport);
  const parent = kit.scrollArea(hud, 0, (top - 88 + bottom + 14) / 2, 648, viewport, height);
  let cursor = height / 2;
  if (feedback) {
    const node = kit.panel(parent, 0, cursor - feedbackHeight / 2, 624, feedbackHeight, THEME.creamDeep, 12, THEME.creamDeep);
    kit.label(node, feedback.text, 0, feedbackHeight / 2 - 14 - feedbackBody / 2, 584, feedbackBody, 26, THEME.muted, false, false, 36);
    if (delta) kit.label(node, delta, 0, -feedbackHeight / 2 + 14 + feedbackDetail / 2, 584, feedbackDetail, 24, THEME.coralDeep, false, true, 34);
    const button = node.addComponent(Button); button.transition = Button.Transition.NONE;
    node.on(Button.EventType.CLICK, () => openPast(feedback.sourceId));
    cursor -= feedbackHeight + 28;
  }
  kit.label(parent, title, 0, cursor - titleHeight / 2, 624, titleHeight, 38, THEME.ink, false, true, 50);
  cursor -= titleHeight + 18;
  kit.label(parent, body, 0, cursor - storyHeight / 2, 624, storyHeight, 30, THEME.ink, false, false, 42);
  cursor -= storyHeight + 32;
  for (const o of measured) {
    const node = kit.panel(parent, 0, cursor - o.height / 2, 624, o.height, THEME.panel, 14, THEME.panelBorder);
    kit.label(node, o.text, 0, o.height / 2 - 14 - o.nameHeight / 2, 584, o.nameHeight, 30, o.disabled ? THEME.faint : THEME.coralDeep, false, true, 40);
    if (o.detailHeight) kit.label(node, o.detail, 0, -o.height / 2 + 14 + o.detailHeight / 2, 584, o.detailHeight, 24, THEME.muted, false, false, 34);
    if (!o.disabled) { const button = node.addComponent(Button); button.transition = Button.Transition.NONE; node.on(Button.EventType.CLICK, o.action); }
    cursor -= o.height + 14;
  }
}

export function renderEncounter(kit: UiKit, view: EncounterPageView, actions: PageActions & { select: (id: string) => void; openPast: (id: string) => void }): void {
  focusPage(kit, `encounter:${view.instanceId}`, `${view.age} 岁${view.growth ? ` · ${view.growth.place}` : ''}`, view.title, view.event.full,
    view.options.map(o => ({
      text: o.text.replace('照自己的方法：', ''),
      detail: o.disabledReason ?? o.preview.replace('旧本领全部保留。', '').replace('稳定完成，', '').replace('无额外开支', '免费'),
      disabled: !o.enabled, action: () => actions.select(o.id),
    })), actions, view.feedback, actions.openPast);
}
export function renderResult(kit: UiKit, view: ResultPageView, actions: PageActions & { next: () => void; openPast: (id: string) => void }): void {
  if (view.growth) {
    page(kit, `result:${view.instanceId}`, '积下的回响', `${view.age} 岁 · ${view.growth.place}`, [
      plain(view.outcome, view.title), { title: '这一次，留下了', body: view.changes?.join('\n') || view.consequence, detail: view.pointLine },
      plain(view.consequence), link('回看行动与成长的来源', () => actions.openPast(view.fragmentId)),
    ], actions, { text: view.continueLabel, action: actions.next }, view.scene, view.ageBand, undefined, view.growth);
    return;
  }
  page(kit, `result:${view.instanceId}`, '事情的后来', `${view.age} 岁 · ${view.title}`,
    [plain(view.response, '你作出的回应'), plain(view.outcome, '接着发生了什么'), { title: '这件事留下了', body: view.consequence, detail: view.pointLine },
      link('这段经历已收入手记', () => actions.openPast(view.fragmentId))], actions,
    { text: view.continueLabel, action: actions.next }, view.scene, view.ageBand);
}
export function renderRecall(kit: UiKit, view: RecallPageView, actions: PageActions & { select: (stance: 'hold' | 'revise' | 'question') => void; openPast: (id: string) => void }): void {
  focusPage(kit, `recall:${view.instanceId}`, `${view.age} 岁 · 回望`, view.growthMode ? '留下一种自己的方法' : '你现在怎样理解',
    view.growthMode ? '这些事都是你做过的。选一种方法，带进接下来的生活。' : view.prompt.full,
    view.options.map(o => ({ text: o.label, detail: view.growthMode ? o.effectHint : o.statement.full, action: () => actions.select(o.stance) })),
    actions, view.feedback, actions.openPast);
}
export function renderCausality(kit: UiKit, view: CausalityPageView, actions: PageActions & { back: () => void; openSource: (id: string) => void }): void {
  const blocks: JournalBlock[] = [plain(view.happened.full, '那时发生的事')];
  if (view.response) blocks.push(plain(view.response.full, '当时怎样回应'));
  if (view.understood) blocks.push(plain(view.understood.full, '当时的理解'));
  if (view.triggerNote) blocks.push(plain(view.triggerNote, '这件事的来处'));
  if (view.later.length) blocks.push(plain(view.later.join('\n\n'), '此后留下的变化'));
  for (const source of view.sources) blocks.push(link(source.relation, () => actions.openSource(source.id)));
  page(kit, `causality:${view.happened.full.slice(0, 24)}`, '一页往事', view.title, blocks, actions, { text: '返回上一页', action: actions.back }, undefined, 'adult', actions.back);
}
export function renderEnding(kit: UiKit, view: EndingPageView, actions: PageActions & { nextLife: () => void; openPast: (id: string) => void }): void {
  const blocks: JournalBlock[] = [];
  if (view.feedback) blocks.push({ body: view.feedback.text, detail: view.feedback.changes.slice(0, 3).join(' · '), action: () => actions.openPast(view.feedback!.sourceId) });
  blocks.push(plain(view.text.full, view.title), plain(view.unresolved.join('\n'), view.growthMode ? '做成的事，留下的生活' : '留下的理解'));
  page(kit, 'ending', '这一生', '经历已收入手记', blocks, actions, { text: '再活一世', action: actions.nextLife });
}
export function renderJournal(kit: UiKit, view: JournalPageView, actions: PageActions & { back: () => void; openPast: (id: string) => void }): void {
  const blocks: JournalBlock[] = [];
  if (view.characterSummary) blocks.push(plain(view.characterSummary, '现在的你'));
  if (!view.groups.length) blocks.push(plain('还没有记下的经历。开启一世，手记会随着你的回应慢慢写满。'));
  for (const group of view.groups) {
    blocks.push(plain(group.title));
    for (const entry of group.entries) blocks.push(link(entry.label, () => actions.openPast(entry.id), entry.text));
  }
  page(kit, 'journal', '人生手记', '事实、回应与理解，都能翻回去看', blocks, actions,
    { text: '返回刚才的一页', action: actions.back }, undefined, 'adult', actions.back);
}
export function renderError(kit: UiKit, message: string, back: () => void): void {
  page(kit, 'error', '暂时停一停', '', [plain(message)], { goHome: back, expand: () => {} }, { text: '返回轮回', action: back }, SCENE_VISUALS.hearth);
}
export function renderOverlay(kit: UiKit, title: string, body: string, close: () => void): void {
  if (kit.screen) kit.overlay(kit.screen, title, body, close);
}
