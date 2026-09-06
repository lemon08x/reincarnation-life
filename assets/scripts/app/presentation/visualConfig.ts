import { HistoryRegionId, ScenarioKind } from '../../core/model';

export type Rgb = readonly [number, number, number];
export type Rgba = readonly [number, number, number, number];

export type CharacterAgeBand = 'child' | 'youth' | 'adult' | 'elder';
export type CharacterPose = 'idle' | 'wander' | 'read' | 'trade' | 'craft' | 'walk' | 'sit' | 'speak' | 'rest';
export type Architecture = 'eaves' | 'brick' | 'column' | 'factory';
export type HairStyle = 'topknot' | 'long' | 'bun' | 'short' | 'bald' | 'laurel' | 'wavy' | 'hat';
export type FigureProp =
  | 'scroll'
  | 'sword'
  | 'brush'
  | 'knife'
  | 'book'
  | 'rail'
  | 'staff'
  | 'laurel'
  | 'easel'
  | 'flask'
  | 'hat'
  | 'sunflower';

export interface ScenePalette {
  skyTop: Rgb;
  skyBottom: Rgb;
  ground: Rgb;
  groundDark: Rgb;
  building: Rgb;
  buildingDark: Rgb;
  accent: Rgb;
  foliage: Rgb;
  interior: Rgb;
  shadow: Rgba;
}

export interface SceneVisual {
  kind: ScenarioKind;
  name: string;
  pose: CharacterPose;
  palette: ScenePalette;
}

export interface RegionVisual {
  id: HistoryRegionId;
  architecture: Architecture;
  robe: Rgb;
  hair: Rgb;
  accent: Rgb;
  roof: Rgb;
}

export interface FigureVisual {
  id: string;
  hair: Rgb;
  clothes: Rgb;
  accent: Rgb;
  prop: FigureProp;
  hairStyle: HairStyle;
}

export const SCENE_KIND_NAMES: Record<ScenarioKind, string> = {
  childhood: '庭院',
  studies: '书房',
  commerce: '集市',
  craft: '工坊',
  journey: '旅途',
  hearth: '居所',
  service: '议事厅',
  dusk: '暮年庭院',
};

export const SCENE_VISUALS: Record<ScenarioKind, SceneVisual> = {
  childhood: {
    kind: 'childhood',
    name: '庭院',
    pose: 'wander',
    palette: {
      skyTop: [126, 196, 232],
      skyBottom: [232, 246, 252],
      ground: [168, 214, 132],
      groundDark: [120, 168, 92],
      building: [245, 232, 210],
      buildingDark: [214, 186, 150],
      accent: [255, 122, 89],
      foliage: [86, 168, 96],
      interior: [255, 248, 236],
      shadow: [43, 38, 31, 42],
    },
  },
  studies: {
    kind: 'studies',
    name: '书房',
    pose: 'read',
    palette: {
      skyTop: [156, 196, 220],
      skyBottom: [236, 244, 248],
      ground: [186, 160, 122],
      groundDark: [148, 122, 88],
      building: [232, 214, 186],
      buildingDark: [176, 140, 102],
      accent: [92, 148, 196],
      foliage: [102, 154, 108],
      interior: [250, 243, 228],
      shadow: [43, 38, 31, 50],
    },
  },
  commerce: {
    kind: 'commerce',
    name: '集市',
    pose: 'trade',
    palette: {
      skyTop: [255, 186, 122],
      skyBottom: [255, 232, 196],
      ground: [214, 186, 132],
      groundDark: [176, 144, 92],
      building: [255, 214, 168],
      buildingDark: [214, 122, 86],
      accent: [232, 86, 64],
      foliage: [96, 160, 92],
      interior: [255, 244, 220],
      shadow: [43, 38, 31, 46],
    },
  },
  craft: {
    kind: 'craft',
    name: '工坊',
    pose: 'craft',
    palette: {
      skyTop: [168, 196, 204],
      skyBottom: [232, 236, 228],
      ground: [156, 140, 118],
      groundDark: [118, 104, 86],
      building: [186, 154, 122],
      buildingDark: [128, 96, 70],
      accent: [214, 122, 64],
      foliage: [92, 140, 88],
      interior: [244, 228, 204],
      shadow: [43, 38, 31, 55],
    },
  },
  journey: {
    kind: 'journey',
    name: '旅途',
    pose: 'walk',
    palette: {
      skyTop: [92, 168, 220],
      skyBottom: [196, 228, 246],
      ground: [176, 196, 118],
      groundDark: [132, 154, 86],
      building: [186, 168, 150],
      buildingDark: [128, 118, 102],
      accent: [255, 138, 86],
      foliage: [64, 140, 86],
      interior: [236, 244, 232],
      shadow: [43, 38, 31, 40],
    },
  },
  hearth: {
    kind: 'hearth',
    name: '居所',
    pose: 'sit',
    palette: {
      skyTop: [255, 176, 140],
      skyBottom: [255, 228, 204],
      ground: [196, 168, 122],
      groundDark: [154, 128, 88],
      building: [236, 196, 160],
      buildingDark: [196, 122, 86],
      accent: [232, 96, 74],
      foliage: [108, 160, 92],
      interior: [255, 240, 220],
      shadow: [43, 38, 31, 48],
    },
  },
  service: {
    kind: 'service',
    name: '议事厅',
    pose: 'speak',
    palette: {
      skyTop: [140, 168, 204],
      skyBottom: [220, 228, 240],
      ground: [176, 168, 158],
      groundDark: [132, 124, 114],
      building: [214, 210, 204],
      buildingDark: [128, 132, 148],
      accent: [196, 86, 74],
      foliage: [86, 140, 102],
      interior: [244, 242, 236],
      shadow: [43, 38, 31, 52],
    },
  },
  dusk: {
    kind: 'dusk',
    name: '暮年庭院',
    pose: 'rest',
    palette: {
      skyTop: [255, 148, 118],
      skyBottom: [255, 214, 176],
      ground: [168, 140, 96],
      groundDark: [128, 104, 70],
      building: [214, 176, 140],
      buildingDark: [164, 118, 86],
      accent: [232, 108, 78],
      foliage: [132, 148, 78],
      interior: [255, 236, 214],
      shadow: [43, 38, 31, 50],
    },
  },
};

export const REGION_VISUALS: Record<HistoryRegionId, RegionVisual> = {
  'china-ancient': {
    id: 'china-ancient',
    architecture: 'eaves',
    robe: [196, 64, 58],
    hair: [36, 32, 28],
    accent: [214, 168, 64],
    roof: [148, 48, 42],
  },
  'china-modern': {
    id: 'china-modern',
    architecture: 'brick',
    robe: [64, 92, 132],
    hair: [42, 36, 32],
    accent: [196, 86, 64],
    roof: [96, 88, 82],
  },
  'west-ancient': {
    id: 'west-ancient',
    architecture: 'column',
    robe: [236, 228, 214],
    hair: [92, 68, 42],
    accent: [196, 154, 64],
    roof: [214, 204, 186],
  },
  'west-modern': {
    id: 'west-modern',
    architecture: 'factory',
    robe: [54, 64, 86],
    hair: [48, 40, 36],
    accent: [92, 148, 186],
    roof: [86, 92, 102],
  },
};

export const FIGURE_VISUALS: Record<string, FigureVisual> = {
  kongzi: {
    id: 'kongzi',
    hair: [36, 32, 28],
    clothes: [46, 78, 132],
    accent: [214, 176, 86],
    prop: 'scroll',
    hairStyle: 'topknot',
  },
  libai: {
    id: 'libai',
    hair: [32, 28, 24],
    clothes: [236, 244, 246],
    accent: [64, 148, 168],
    prop: 'sword',
    hairStyle: 'long',
  },
  sushi: {
    id: 'sushi',
    hair: [40, 34, 28],
    clothes: [148, 92, 54],
    accent: [214, 160, 74],
    prop: 'brush',
    hairStyle: 'bun',
  },
  qiujin: {
    id: 'qiujin',
    hair: [28, 24, 22],
    clothes: [176, 42, 48],
    accent: [236, 214, 186],
    prop: 'knife',
    hairStyle: 'bun',
  },
  luxun: {
    id: 'luxun',
    hair: [32, 30, 28],
    clothes: [64, 64, 68],
    accent: [196, 86, 64],
    prop: 'book',
    hairStyle: 'short',
  },
  zhantianyou: {
    id: 'zhantianyou',
    hair: [36, 32, 30],
    clothes: [48, 78, 122],
    accent: [186, 140, 74],
    prop: 'rail',
    hairStyle: 'short',
  },
  socrates: {
    id: 'socrates',
    hair: [168, 154, 132],
    clothes: [236, 230, 214],
    accent: [148, 92, 54],
    prop: 'staff',
    hairStyle: 'bald',
  },
  caesar: {
    id: 'caesar',
    hair: [92, 68, 42],
    clothes: [164, 42, 42],
    accent: [214, 176, 74],
    prop: 'laurel',
    hairStyle: 'laurel',
  },
  vinci: {
    id: 'vinci',
    hair: [96, 72, 48],
    clothes: [148, 118, 74],
    accent: [92, 140, 122],
    prop: 'easel',
    hairStyle: 'wavy',
  },
  curie: {
    id: 'curie',
    hair: [54, 44, 38],
    clothes: [86, 122, 168],
    accent: [214, 232, 236],
    prop: 'flask',
    hairStyle: 'bun',
  },
  lincoln: {
    id: 'lincoln',
    hair: [32, 28, 26],
    clothes: [36, 36, 40],
    accent: [214, 196, 160],
    prop: 'hat',
    hairStyle: 'hat',
  },
  vangogh: {
    id: 'vangogh',
    hair: [92, 64, 36],
    clothes: [54, 92, 148],
    accent: [232, 186, 54],
    prop: 'sunflower',
    hairStyle: 'wavy',
  },
};

export const DEFAULT_FIGURE: FigureVisual = {
  id: 'wanderer',
  hair: [42, 34, 28],
  clothes: [232, 122, 92],
  accent: [255, 214, 168],
  prop: 'scroll',
  hairStyle: 'short',
};

export function ageBand(age: number): CharacterAgeBand {
  if (age < 12) {
    return 'child';
  }
  if (age < 18) {
    return 'youth';
  }
  if (age < 60) {
    return 'adult';
  }
  return 'elder';
}

export function getSceneVisual(kind: ScenarioKind): SceneVisual {
  return SCENE_VISUALS[kind];
}

export function getRegionVisual(region?: HistoryRegionId): RegionVisual | undefined {
  return region ? REGION_VISUALS[region] : undefined;
}

export function getFigureVisual(figureId?: string): FigureVisual {
  if (!figureId) {
    return DEFAULT_FIGURE;
  }
  return FIGURE_VISUALS[figureId] ?? DEFAULT_FIGURE;
}

export function sceneKindById(scenarioId: string): ScenarioKind {
  const known: Record<string, ScenarioKind> = {
    childhood: 'childhood',
    studies: 'studies',
    commerce: 'commerce',
    craft: 'craft',
    journey: 'journey',
    hearth: 'hearth',
    service: 'service',
    dusk: 'dusk',
  };
  return known[scenarioId] ?? 'hearth';
}
