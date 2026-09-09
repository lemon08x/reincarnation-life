export const GROWTH_RULES_VERSION = 8;
export const GROWTH_AGES = [12, 16, 20, 24, 29, 35, 42, 49, 56, 64, 72, 81] as const;
export const GROWTH_RECALLS = [3, 6] as const;
export const GROWTH_CHAPTERS = ['初步积累', '尝到作用', '扩大选择', '收获与回顾'] as const;
export const ABILITIES = ['hands', 'talk', 'plan'] as const;
export type Ability = typeof ABILITIES[number];
export type Place = 'town' | 'harbor' | 'market';
export type Intention = 'learn' | 'earn' | 'explore';
export const ABILITY_NAMES: Record<Ability, string> = { hands: '动手', talk: '沟通', plan: '筹划' };
export const PLACE_NAMES: Record<Place, string> = { town: '小城', harbor: '河港', market: '街市' };
export const SKILL_NAMES: Record<string, string> = { repair: '修补木器', agreement: '商量约定', ledger: '记账排程' };
export const ABILITY_SKILLS: Record<Ability, string> = { hands: 'repair', talk: 'agreement', plan: 'ledger' };
export interface GrowthGoal { id: string; title: string; approach: Ability; status: 'active' | 'complete'; result?: string }
export interface GrowthSpecialty { id: string; name: string; ability: Ability; sourceFragmentIds: string[]; understandingId: string }
export interface GrowthRecord { fragmentId: string; abilities: Partial<Record<Ability, number>>; learned: string[]; money: number; usedAbility?: Ability; usedSpecialtyId?: string; note: string }
export interface GrowthState {
  abilities: Record<Ability, number>;
  money: number;
  skills: string[];
  specialties: GrowthSpecialty[];
  place: Place;
  identity: string;
  intention: Intention;
  goal?: GrowthGoal;
  achievements: string[];
  records: GrowthRecord[];
  transitions: Array<{ fragmentId: string; from: Place; to: Place; identity: string }>;
}
export function initialGrowth(): GrowthState {
  return { abilities: { hands: 0, talk: 0, plan: 0 }, money: 2, skills: [], specialties: [], place: 'town', identity: '初识生活的少年', intention: 'learn', achievements: [], records: [], transitions: [] };
}
export interface GrowthEffect {
  gain?: Partial<Record<Ability, number>>;
  learn?: string;
  money?: number;
  place?: Place;
  identity?: string;
  intention?: Intention;
  goal?: { id: string; title: string; approach: Ability };
  achievement?: string;
  finishGoal?: boolean;
  relation?: { id: string; label: string };
}
export interface GrowthChoice {
  id: string; text: string; preview: string; outcome: string; later: string; effect: GrowthEffect;
  cost?: number; ability?: Ability; level?: number; skill?: string; specialtyId?: string;
}
export interface GrowthScene {
  id: string; title: string; text: string; slots: number[]; places?: Place[];
  kind: 'childhood' | 'craft' | 'commerce' | 'journey' | 'hearth' | 'service' | 'dusk';
  choices: GrowthChoice[];
  opportunity?: Place;
  continuation?: boolean;
}
