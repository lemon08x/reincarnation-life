import { Button, Label, Node } from 'cc';
import { textHeight } from '../app/presentation/journalLayout';
import { FamilyHistoryView, FamilyMemberView } from '../app/presentation/familyUiModels';
import { UiKit } from './kit';
import { THEME } from './theme';

export interface FamilyPageActions {
  goLegacy: () => void;
  showHistory: () => void;
  showMember: () => void;
  expand: (key: string, title: string, body: string) => void;
}

export interface FamilyRow {
  title?: string;
  body?: string;
  detail?: string;
  action?: () => void;
  disabled?: boolean;
  selected?: boolean;
}

interface Footer {
  text: string;
  action: () => void;
  enabled?: boolean;
}

function header(
  kit: UiKit,
  hud: Node,
  back: () => void,
  backLabel: string,
  title: string,
  subtitle: string,
  right?: { text: string; action: () => void },
): number {
  const top = 640 - kit.layout.top;
  kit.textAction(hud, backLabel, -264, top - 40, back, 132);
  kit.label(hud, title, 0, top - 38, right ? 360 : 384, 52, 34, THEME.ink, true, true);
  if (right) kit.textAction(hud, right.text, 260, top - 40, right.action, 144);
  kit.label(hud, subtitle, 0, top - 94, 624, 36, 24, THEME.muted, true);
  return top;
}

function buildRows(
  kit: UiKit,
  hud: Node,
  top: number,
  bottom: number,
  rows: FamilyRow[],
): void {
  const bodyTop = top - 124;
  const bodyBottom = bottom + 204;
  const viewport = bodyTop - bodyBottom;
  const items = rows.map(row => {
    const titleH = textHeight(row.title ?? '', 592, 26, 36);
    const bodyH = textHeight(row.body ?? '', 592, 28, 40);
    const detailH = textHeight(row.detail ?? '', 592, 22, 32);
    const count = [titleH, bodyH, detailH].filter(Boolean).length;
    const height = Math.max(row.action || row.selected ? kit.layout.minTouch : 0, 30 + titleH + bodyH + detailH + Math.max(0, count - 1) * 10);
    return { ...row, titleH, bodyH, detailH, height };
  });
  const total = items.reduce((sum, item) => sum + item.height + 14, 0);
  const contentHeight = Math.max(viewport, total);
  const content = kit.scrollArea(hud, 0, (bodyTop + bodyBottom) / 2, 648, viewport, contentHeight);
  let cursor = contentHeight / 2;
  for (const item of items) {
    const node = item.action || item.selected
      ? kit.panel(content, 0, cursor - item.height / 2, 632, item.height, item.selected ? THEME.creamDeep : THEME.panel, 14, item.selected ? THEME.coralDeep : THEME.panelBorder)
      : kit.createNode(content, 'Row', 0, cursor - item.height / 2, 632, item.height);
    let y = item.height / 2 - 16;
    if (item.title) {
      kit.label(node, item.title, 0, y - item.titleH / 2, 592, item.titleH, 26, item.disabled ? THEME.muted : THEME.coralDeep, false, true, 36);
      y -= item.titleH + 8;
    }
    if (item.body) {
      const label = kit.label(node, item.body, 0, y - item.bodyH / 2, 592, item.bodyH, 28, item.disabled ? THEME.faint : THEME.ink, false, false, 40);
      label.verticalAlign = Label.VerticalAlign.TOP;
      y -= item.bodyH + 8;
    }
    if (item.detail) {
      kit.label(node, item.detail, 0, y - item.detailH / 2, 592, item.detailH, 22, item.disabled ? THEME.faint : THEME.muted, false, false, 32);
    }
    if (item.action && !item.disabled) {
      const button = node.addComponent(Button);
      button.transition = Button.Transition.NONE;
      node.on(Button.EventType.CLICK, item.action);
    }
    cursor -= item.height + 14;
  }
}

interface PageOptions {
  back?: () => void;
  right?: { text: string; action: () => void };
  drawScene?: (scene: Node, top: number) => number; // 返回场景占用的额外高度
}

function familyPage(
  kit: UiKit,
  key: string,
  title: string,
  subtitle: string,
  rows: FamilyRow[],
  actions: FamilyPageActions,
  footer?: Footer,
  options?: PageOptions,
): void {
  const { hud, scene } = kit.beginPage(key);
  const top = header(
    kit, hud, options?.back ?? actions.goLegacy, options?.back ? '‹ 返回' : '‹ 轮回',
    title, subtitle, options?.right,
  );
  let bodyTop = top - 124;
  if (options?.drawScene) {
    bodyTop = options.drawScene(scene, top);
  }
  const bottom = -640 + kit.layout.bottom;
  buildRows(kit, hud, bodyTop + 124, bottom, rows);
  if (footer) {
    kit.button(hud, footer.text, 0, bottom + 64, 632, 92, THEME.coralDeep, footer.action, footer.enabled !== false, THEME.white, 28);
  }
}

export { renderFamilyHome, renderFamilyEvent, renderFamilySettlement } from './familyVisualPages';

export function renderFamilyHistory(kit: UiKit, view: FamilyHistoryView, actions: FamilyPageActions & { back: () => void }): void {
  const rows: FamilyRow[] = [];
  rows.push({ title: `家族阶段：${view.stage}`, body: `已结算 ${view.generations.length} 代。` });
  for (const g of view.generations) {
    rows.push({
      title: `第 ${g.generation} 代 · ${g.memberName}（${g.memberRole}） · ${g.outcomeName}`,
      body: g.summary,
      detail: `${g.era} · ${g.ageSpan} · ${g.leftForFamily.join('；') || '没有留下什么'}`,
    });
  }
  if (view.accumulations.length) {
    rows.push({ title: '家里的积累', body: view.accumulations.map(a => `${a.name}（${a.source}）：${a.benefit}`).join('\n') });
  }
  if (view.contributions.length) rows.push({ title: '贡献记录', body: view.contributions.join('\n') });
  if (view.evidence.length) rows.push({ title: '家族经历', body: view.evidence.map(e => `第${e.generation}代 · ${e.text}`).join('\n') });
  familyPage(kit, 'family-history', '家 史', view.familyName, rows, actions, { text: '返回', action: actions.back }, { back: actions.back });
}

export function renderFamilyMember(kit: UiKit, view: FamilyMemberView, actions: FamilyPageActions & { back: () => void }): void {
  const rows: FamilyRow[] = [
    { title: `${view.memberName} · ${view.memberRole}`, body: `${view.ageSpan} · ${view.era}`, detail: `目标：${view.goalText}` },
    { title: '本代预算', body: `可用 ${view.budget} 两（拨出 ${view.allocated} 两 · 收入 ${view.income} 两 · 花费 ${view.spent} 两）`, detail: view.progressLine },
    { title: '个人能力', body: view.abilities.map(a => `${a.name} ${a.level}`).join(' · ') },
  ];
  if (view.actionsTaken.length) {
    rows.push({ title: '这一代做过的事', body: view.actionsTaken.slice(-5).map(a => `· ${a.text}（${a.budgetDelta >= 0 ? '+' : ''}${a.budgetDelta} 两）`).join('\n') });
  }
  familyPage(kit, 'family-member', '本 代 详 情', `${view.familyName} · ${view.missionTitle}`, rows, actions, { text: '返回', action: actions.back }, { back: actions.back });
}