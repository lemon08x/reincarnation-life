import { Color, sys, view } from 'cc';

export const DESIGN_WIDTH = 720;
export const DESIGN_HEIGHT = 1280;
export const SCENE_RATIO = 0.42;
export const MIN_TOUCH_PX = 44;

export const THEME = {
  cream: rgb(255, 248, 238),
  creamDeep: rgb(247, 236, 214),
  sky: rgb(157, 214, 242),
  skyDeep: rgb(92, 168, 220),
  grass: rgb(123, 196, 127),
  grassDeep: rgb(86, 154, 96),
  coral: rgb(255, 122, 89),
  coralDeep: rgb(216, 74, 58),
  ink: rgb(43, 38, 31),
  muted: rgb(96, 86, 74),
  faint: rgb(168, 156, 138),
  white: rgb(255, 252, 247),
  panel: rgb(255, 251, 244),
  panelBorder: rgb(226, 208, 182),
  positive: rgb(46, 122, 86),
  disabled: rgb(186, 176, 162),
  shadow: rgba(43, 38, 31, 36),
};

export const TYPE = {
  title: 36,
  subtitle: 22,
  body: 22,
  caption: 16,
  numeric: 42,
};

export interface SafeLayout {
  width: number;
  height: number;
  top: number;
  bottom: number;
  minTouch: number;
  sceneHeight: number;
}

export function rgb(r: number, g: number, b: number): Color {
  return new Color(r, g, b, 255);
}

export function rgba(r: number, g: number, b: number, a: number): Color {
  return new Color(r, g, b, a);
}

export function colorFromRgb(values: readonly [number, number, number], alpha = 255): Color {
  return new Color(values[0], values[1], values[2], alpha);
}

export function computeLayout(): SafeLayout {
  const scale = Math.max(0.25, view.getVisibleSize().width / DESIGN_WIDTH);
  const minTouch = Math.ceil(MIN_TOUCH_PX / scale);
  let top = 28;
  let bottom = 28;
  try {
    const safe = sys.getSafeAreaRect();
    const frame = view.getFrameSize();
    if (frame.height > 0 && safe.height > 0) {
      const pixelScale = DESIGN_HEIGHT / frame.height;
      top = Math.max(top, Math.round((frame.height - safe.y - safe.height) * pixelScale));
      bottom = Math.max(bottom, Math.round(safe.y * pixelScale));
    }
  } catch {
    top = 28;
    bottom = 28;
  }
  return {
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    top,
    bottom,
    minTouch,
    sceneHeight: Math.round(DESIGN_HEIGHT * SCENE_RATIO),
  };
}
