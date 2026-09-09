/** Text and card measurements shared by the canvas renderer and geometry checks. */
export interface JournalBlock {
  title?: string;
  body?: string;
  detail?: string;
  action?: () => void;
  selected?: boolean;
  disabled?: boolean;
  kind?: 'plain' | 'card' | 'link';
}
export interface MeasuredBlock {
  block: JournalBlock;
  top: number;
  height: number;
  titleHeight: number;
  bodyHeight: number;
  detailHeight: number;
}
export function textHeight(text: string, width: number, fontSize: number, lineHeight: number): number {
  if (!text) return 0;
  const capacity = Math.max(1, Math.floor(width / fontSize) - 1);
  // CJK punctuation and full-width characters count as a full em. Reserve a column for wrapping.
  return text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(Array.from(line).length / capacity)), 0) * lineHeight;
}
export function measureBlocks(blocks: JournalBlock[], width = 632, minTouch = 88): { items: MeasuredBlock[]; height: number } {
  let top = 0;
  const items = blocks.map(block => {
    const inner = width - 40;
    const titleHeight = textHeight(block.title ?? '', inner, 26, 36);
    const bodyHeight = textHeight(block.body ?? '', inner, 30, 44);
    const detailHeight = textHeight(block.detail ?? '', inner, 24, 34);
    const count = [titleHeight, bodyHeight, detailHeight].filter(Boolean).length;
    const height = Math.max(block.action ? minTouch : 0, 36 + titleHeight + bodyHeight + detailHeight + Math.max(0, count - 1) * 12);
    const item = { block, top, height, titleHeight, bodyHeight, detailHeight };
    top += height + 16;
    return item;
  });
  return { items, height: Math.max(0, top) };
}
