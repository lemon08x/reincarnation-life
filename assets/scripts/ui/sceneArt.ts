import { Color, Graphics, Node } from 'cc';
import { CharacterAgeBand, FigureVisual, RegionVisual, SceneVisual } from '../app/presentation/visualConfig';
import { UiKit } from './kit';
import { colorFromRgb, rgba } from './theme';

export interface SceneDrawSpec {
  visual: SceneVisual;
  width: number;
  height: number;
  ageBand: CharacterAgeBand;
  figure?: FigureVisual;
  region?: RegionVisual;
  poseTime?: number;
}

export function drawGateScene(kit: UiKit, parent: Node, x: number, y: number, spec: SceneDrawSpec): Node {
  const node = drawScene(kit, parent, x, y, spec);
  const gate = kit.createNode(node, 'Gate', 0, spec.height * 0.02, spec.width, spec.height);
  const g = gate.addComponent(Graphics);
  g.strokeColor = colorFromRgb(spec.visual.palette.accent);
  g.lineWidth = 10;
  g.circle(0, 8, Math.min(spec.width, spec.height) * 0.28);
  g.stroke();
  g.lineWidth = 4;
  g.strokeColor = colorFromRgb(spec.visual.palette.buildingDark, 160);
  g.circle(0, 8, Math.min(spec.width, spec.height) * 0.22);
  g.stroke();
  g.fillColor = colorFromRgb(spec.visual.palette.accent, 28);
  g.circle(0, 8, Math.min(spec.width, spec.height) * 0.2);
  g.fill();
  return node;
}

export function drawScene(kit: UiKit, parent: Node, x: number, y: number, spec: SceneDrawSpec): Node {
  const node = kit.createNode(parent, `Scene:${spec.visual.kind}`, x, y, spec.width, spec.height);
  const graphics = node.addComponent(Graphics);
  paintScene(graphics, spec);
  const actor = kit.createNode(node, 'Actor', 0, -spec.height * 0.08, 180, 240);
  const actorGfx = actor.addComponent(Graphics);
  paintCharacter(actorGfx, spec, 0, 0);
  kit.animate((time) => {
    actor.setPosition(0, -spec.height * 0.08 + Math.sin(time * 2.1) * 4, 0);
  });
  return node;
}

export function drawPortrait(kit: UiKit, parent: Node, x: number, y: number, size: number, figure: FigureVisual, ageBand: CharacterAgeBand = 'adult'): Node {
  const node = kit.createNode(parent, `Portrait:${figure.id}`, x, y, size, size);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = colorFromRgb(figure.accent, 80);
  graphics.circle(0, 0, size * 0.48);
  graphics.fill();
  graphics.fillColor = new Color(255, 248, 236, 255);
  graphics.circle(0, 0, size * 0.42);
  graphics.fill();
  paintCharacter(graphics, {
    visual: {
      kind: 'hearth',
      name: '',
      pose: 'idle',
      palette: {
        skyTop: [255, 248, 236],
        skyBottom: [255, 248, 236],
        ground: [255, 248, 236],
        groundDark: [255, 248, 236],
        building: [255, 248, 236],
        buildingDark: [255, 248, 236],
        accent: figure.accent,
        foliage: [120, 160, 100],
        interior: [255, 248, 236],
        shadow: [0, 0, 0, 20],
      },
    },
    width: size,
    height: size,
    ageBand,
    figure,
  }, 0, -size * 0.08, size / 220);
  return node;
}

export function drawMarkBadge(kit: UiKit, parent: Node, x: number, y: number, nature: string, fill: Color): Node {
  const node = kit.createNode(parent, `Badge:${nature}`, x, y, 44, 44);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = fill;
  if (nature === 'burden') {
    graphics.roundRect(-16, -14, 32, 28, 6);
    graphics.fill();
  } else if (nature === 'possession') {
    graphics.moveTo(0, 16);
    graphics.lineTo(-16, 4);
    graphics.lineTo(-16, -14);
    graphics.lineTo(16, -14);
    graphics.lineTo(16, 4);
    graphics.close();
    graphics.fill();
  } else {
    graphics.circle(0, 0, 15);
    graphics.fill();
    graphics.fillColor = new Color(255, 255, 255, 90);
    graphics.circle(4, 5, 5);
    graphics.fill();
  }
  return node;
}

function paintScene(g: Graphics, spec: SceneDrawSpec): void {
  const w = spec.width;
  const h = spec.height;
  const palette = spec.visual.palette;
  const region = spec.region;
  paintSky(g, w, h, palette.skyTop, palette.skyBottom);
  paintGround(g, w, h, palette.ground, palette.groundDark, palette.shadow);
  paintArchitecture(g, spec.visual.kind, w, h, palette, region);
  paintForeground(g, spec.visual.kind, w, h, palette);
}

function paintSky(g: Graphics, w: number, h: number, top: readonly [number, number, number], bottom: readonly [number, number, number]): void {
  const bands = 10;
  for (let i = 0; i < bands; i += 1) {
    const t = i / (bands - 1);
    g.fillColor = colorFromRgb([
      Math.round(top[0] + (bottom[0] - top[0]) * t),
      Math.round(top[1] + (bottom[1] - top[1]) * t),
      Math.round(top[2] + (bottom[2] - top[2]) * t),
    ]);
    const y = h / 2 - (i + 1) * (h / bands);
    g.rect(-w / 2, y, w, h / bands + 1);
    g.fill();
  }
}

function paintGround(
  g: Graphics,
  w: number,
  h: number,
  ground: readonly [number, number, number],
  dark: readonly [number, number, number],
  shadow: readonly [number, number, number, number],
): void {
  g.fillColor = colorFromRgb(ground);
  g.moveTo(-w / 2, -h / 2);
  g.lineTo(w / 2, -h / 2);
  g.lineTo(w * 0.22, -h * 0.12);
  g.lineTo(-w * 0.22, -h * 0.12);
  g.close();
  g.fill();
  g.fillColor = colorFromRgb(dark);
  g.moveTo(-w * 0.18, -h / 2);
  g.lineTo(w * 0.18, -h / 2);
  g.lineTo(w * 0.08, -h * 0.18);
  g.lineTo(-w * 0.08, -h * 0.18);
  g.close();
  g.fill();
  g.fillColor = rgba(shadow[0], shadow[1], shadow[2], shadow[3]);
  g.ellipse(0, -h * 0.22, 70, 16);
  g.fill();
}

function paintArchitecture(
  g: Graphics,
  kind: SceneVisual['kind'],
  w: number,
  h: number,
  palette: SceneVisual['palette'],
  region?: RegionVisual,
): void {
  const roof = region?.roof ?? palette.buildingDark;
  const wall = region ? shift(palette.building, region.robe, 0.18) : palette.building;
  if (kind === 'childhood' || kind === 'dusk' || kind === 'hearth') {
    paintHouse(g, -w * 0.22, -h * 0.02, 210, 150, wall, roof, palette.interior, region);
    paintTree(g, w * 0.28, -h * 0.02, palette.foliage, palette.buildingDark);
    if (kind === 'dusk') {
      g.fillColor = colorFromRgb(palette.accent, 120);
      g.circle(w * 0.3, h * 0.28, 28);
      g.fill();
    }
  } else if (kind === 'studies') {
    paintHouse(g, 0, 10, 280, 170, wall, roof, palette.interior, region);
    paintWindow(g, -40, 20, palette.accent);
    paintWindow(g, 40, 20, palette.accent);
  } else if (kind === 'commerce') {
    paintStall(g, -w * 0.22, -20, palette.accent, wall);
    paintStall(g, w * 0.2, -8, palette.buildingDark, palette.interior);
    paintTree(g, w * 0.34, 10, palette.foliage, palette.buildingDark);
  } else if (kind === 'craft') {
    paintWorkshop(g, 0, 8, wall, roof, palette.accent);
  } else if (kind === 'journey') {
    paintHills(g, w, h, palette.foliage, palette.buildingDark);
    paintPath(g, w, h, palette.groundDark);
  } else if (kind === 'service') {
    paintHall(g, 0, 16, wall, roof, region);
  }
}

function paintForeground(g: Graphics, kind: SceneVisual['kind'], w: number, h: number, palette: SceneVisual['palette']): void {
  g.fillColor = colorFromRgb(palette.foliage, 180);
  if (kind === 'childhood' || kind === 'dusk') {
    g.circle(-w * 0.42, -h * 0.28, 36);
    g.fill();
    g.circle(w * 0.4, -h * 0.32, 28);
    g.fill();
  }
  if (kind === 'commerce') {
    g.fillColor = colorFromRgb(palette.accent);
    g.roundRect(-w * 0.38, -h * 0.34, 34, 22, 6);
    g.fill();
    g.roundRect(w * 0.3, -h * 0.3, 28, 18, 6);
    g.fill();
  }
  if (kind === 'craft') {
    g.fillColor = colorFromRgb(palette.buildingDark);
    g.rect(-w * 0.34, -h * 0.32, 40, 12);
    g.fill();
  }
}

function paintHouse(
  g: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  wall: readonly [number, number, number],
  roof: readonly [number, number, number],
  interior: readonly [number, number, number],
  region?: RegionVisual,
): void {
  g.fillColor = colorFromRgb(wall);
  g.roundRect(x - width / 2, y - height / 2, width, height * 0.72, 10);
  g.fill();
  g.fillColor = colorFromRgb(roof);
  if (region?.architecture === 'column') {
    g.moveTo(x - width / 2 - 8, y + height * 0.18);
    g.lineTo(x + width / 2 + 8, y + height * 0.18);
    g.lineTo(x + width / 2 - 10, y + height * 0.42);
    g.lineTo(x - width / 2 + 10, y + height * 0.42);
    g.close();
    g.fill();
  } else {
    g.moveTo(x, y + height * 0.48);
    g.lineTo(x - width / 2 - 16, y + height * 0.12);
    g.lineTo(x + width / 2 + 16, y + height * 0.12);
    g.close();
    g.fill();
  }
  g.fillColor = colorFromRgb(interior);
  g.roundRect(x - 16, y - height / 2, 32, 44, 6);
  g.fill();
}

function paintWindow(g: Graphics, x: number, y: number, accent: readonly [number, number, number]): void {
  g.fillColor = colorFromRgb(accent, 160);
  g.roundRect(x - 18, y - 16, 36, 32, 4);
  g.fill();
}

function paintTree(g: Graphics, x: number, y: number, foliage: readonly [number, number, number], trunk: readonly [number, number, number]): void {
  g.fillColor = colorFromRgb(trunk);
  g.roundRect(x - 8, y - 50, 16, 56, 4);
  g.fill();
  g.fillColor = colorFromRgb(foliage);
  g.circle(x, y + 18, 36);
  g.fill();
  g.circle(x - 22, y + 6, 22);
  g.fill();
  g.circle(x + 20, y + 8, 24);
  g.fill();
}

function paintStall(
  g: Graphics,
  x: number,
  y: number,
  cloth: readonly [number, number, number],
  wood: readonly [number, number, number],
): void {
  g.fillColor = colorFromRgb(wood);
  g.roundRect(x - 60, y - 30, 120, 50, 8);
  g.fill();
  g.fillColor = colorFromRgb(cloth);
  g.moveTo(x - 70, y + 28);
  g.lineTo(x + 70, y + 28);
  g.lineTo(x + 54, y + 52);
  g.lineTo(x - 54, y + 52);
  g.close();
  g.fill();
}

function paintWorkshop(
  g: Graphics,
  x: number,
  y: number,
  wall: readonly [number, number, number],
  roof: readonly [number, number, number],
  ember: readonly [number, number, number],
): void {
  g.fillColor = colorFromRgb(wall);
  g.roundRect(x - 130, y - 40, 260, 110, 12);
  g.fill();
  g.fillColor = colorFromRgb(roof);
  g.rect(x - 140, y + 50, 280, 18);
  g.fill();
  g.fillColor = colorFromRgb(ember);
  g.circle(x + 70, y - 10, 16);
  g.fill();
}

function paintHills(
  g: Graphics,
  w: number,
  h: number,
  near: readonly [number, number, number],
  far: readonly [number, number, number],
): void {
  g.fillColor = colorFromRgb(far, 180);
  g.ellipse(-w * 0.2, h * 0.08, 160, 50);
  g.fill();
  g.ellipse(w * 0.24, h * 0.12, 140, 46);
  g.fill();
  g.fillColor = colorFromRgb(near);
  g.ellipse(-w * 0.28, -h * 0.02, 120, 40);
  g.fill();
}

function paintPath(g: Graphics, w: number, h: number, color: readonly [number, number, number]): void {
  g.fillColor = colorFromRgb(color);
  g.moveTo(-w * 0.05, -h * 0.12);
  g.lineTo(w * 0.05, -h * 0.12);
  g.lineTo(w * 0.14, -h / 2);
  g.lineTo(-w * 0.14, -h / 2);
  g.close();
  g.fill();
}

function paintHall(
  g: Graphics,
  x: number,
  y: number,
  wall: readonly [number, number, number],
  roof: readonly [number, number, number],
  region?: RegionVisual,
): void {
  g.fillColor = colorFromRgb(wall);
  g.roundRect(x - 150, y - 50, 300, 130, 8);
  g.fill();
  g.fillColor = colorFromRgb(roof);
  g.rect(x - 160, y + 70, 320, 20);
  g.fill();
  const column = region?.architecture === 'column' ? [236, 230, 214] as const : [214, 206, 196] as const;
  g.fillColor = colorFromRgb(column);
  for (const offset of [-110, -40, 40, 110]) {
    g.roundRect(x + offset - 8, y - 50, 16, 120, 4);
    g.fill();
  }
}

function paintCharacter(g: Graphics, spec: SceneDrawSpec, x: number, y: number, scale = 1): void {
  const look = spec.figure;
  const band = spec.ageBand;
  const s = scale * (band === 'child' ? 0.72 : band === 'youth' ? 0.9 : band === 'elder' ? 0.92 : 1);
  const lean = band === 'elder' ? 6 : 0;
  const skin = new Color(242, 196, 162, 255);
  const hair = colorFromRgb(look?.hair ?? [42, 34, 28]);
  const clothes = colorFromRgb(look?.clothes ?? spec.visual.palette.accent);
  const accent = colorFromRgb(look?.accent ?? spec.visual.palette.buildingDark);
  g.fillColor = rgba(43, 38, 31, 40);
  g.ellipse(x + lean, y - 58 * s, 28 * s, 8 * s);
  g.fill();
  g.fillColor = clothes;
  g.roundRect(x - 22 * s + lean, y - 52 * s, 44 * s, 58 * s, 14 * s);
  g.fill();
  g.fillColor = accent;
  g.roundRect(x - 18 * s + lean, y - 8 * s, 36 * s, 12 * s, 4 * s);
  g.fill();
  g.fillColor = skin;
  g.circle(x + lean, y + 28 * s, (band === 'child' ? 22 : 18) * s);
  g.fill();
  paintHair(g, x + lean, y + 36 * s, s, hair, look?.hairStyle ?? 'short', band);
  paintFace(g, x + lean, y + 28 * s, s, spec.visual.pose);
  paintProp(g, x + 28 * s + lean, y, s, look?.prop ?? 'scroll', accent, clothes);
}

function paintHair(g: Graphics, x: number, y: number, s: number, color: Color, style: string, band: CharacterAgeBand): void {
  const hair = band === 'elder' ? new Color(186, 178, 168, 255) : color;
  g.fillColor = hair;
  if (style === 'bald') {
    g.circle(x, y + 2 * s, 10 * s);
    g.fill();
    return;
  }
  if (style === 'topknot') {
    g.circle(x, y + 4 * s, 16 * s);
    g.fill();
    g.circle(x, y + 20 * s, 8 * s);
    g.fill();
    return;
  }
  if (style === 'long' || style === 'wavy') {
    g.circle(x, y + 4 * s, 17 * s);
    g.fill();
    g.roundRect(x - 16 * s, y - 18 * s, 10 * s, 32 * s, 4 * s);
    g.fill();
    g.roundRect(x + 6 * s, y - 18 * s, 10 * s, 32 * s, 4 * s);
    g.fill();
    return;
  }
  if (style === 'bun') {
    g.circle(x, y + 4 * s, 16 * s);
    g.fill();
    g.circle(x + 14 * s, y + 8 * s, 8 * s);
    g.fill();
    return;
  }
  if (style === 'laurel' || style === 'hat') {
    g.circle(x, y + 2 * s, 16 * s);
    g.fill();
    g.fillColor = style === 'hat' ? new Color(28, 28, 32, 255) : new Color(120, 168, 74, 255);
    g.roundRect(x - 20 * s, y + 10 * s, 40 * s, 10 * s, 4 * s);
    g.fill();
    if (style === 'hat') {
      g.rect(x - 12 * s, y + 10 * s, 24 * s, 22 * s);
      g.fill();
    }
    return;
  }
  g.circle(x, y + 4 * s, 16 * s);
  g.fill();
}

function paintFace(g: Graphics, x: number, y: number, s: number, pose: string): void {
  g.fillColor = new Color(43, 38, 31, 255);
  g.circle(x - 6 * s, y + 2 * s, 1.8 * s);
  g.fill();
  g.circle(x + 6 * s, y + 2 * s, 1.8 * s);
  g.fill();
  g.lineWidth = 2;
  g.strokeColor = new Color(43, 38, 31, 220);
  if (pose === 'rest' || pose === 'sit') {
    g.moveTo(x - 5 * s, y - 6 * s);
    g.lineTo(x + 5 * s, y - 5 * s);
  } else {
    g.moveTo(x - 5 * s, y - 6 * s);
    g.quadraticCurveTo(x, y - 10 * s, x + 5 * s, y - 6 * s);
  }
  g.stroke();
}

function paintProp(
  g: Graphics,
  x: number,
  y: number,
  s: number,
  prop: string,
  accent: Color,
  clothes: Color,
): void {
  g.fillColor = accent;
  if (prop === 'sword' || prop === 'knife' || prop === 'rail') {
    g.rect(x - 3 * s, y - 20 * s, 6 * s, 48 * s);
    g.fill();
    return;
  }
  if (prop === 'staff') {
    g.rect(x - 3 * s, y - 36 * s, 6 * s, 70 * s);
    g.fill();
    return;
  }
  if (prop === 'flask') {
    g.roundRect(x - 8 * s, y - 4 * s, 16 * s, 22 * s, 4 * s);
    g.fill();
    return;
  }
  if (prop === 'sunflower') {
    g.circle(x, y + 8 * s, 12 * s);
    g.fill();
    g.fillColor = clothes;
    g.circle(x, y + 8 * s, 5 * s);
    g.fill();
    return;
  }
  g.roundRect(x - 10 * s, y - 6 * s, 20 * s, 26 * s, 3 * s);
  g.fill();
}

function shift(
  base: readonly [number, number, number],
  tint: readonly [number, number, number],
  amount: number,
): readonly [number, number, number] {
  return [
    Math.round(base[0] + (tint[0] - base[0]) * amount),
    Math.round(base[1] + (tint[1] - base[1]) * amount),
    Math.round(base[2] + (tint[2] - base[2]) * amount),
  ];
}
