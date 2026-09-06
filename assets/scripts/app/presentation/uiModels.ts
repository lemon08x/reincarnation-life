import { MarkNature, RecallStance, ScenarioKind, TriggerKind } from '../../core/model';
import { CharacterAgeBand, SceneVisual } from './visualConfig';

export type PlayPage =
  | 'home'
  | 'carry'
  | 'encounter'
  | 'recall'
  | 'causality'
  | 'ending';

export interface TruncatedText {
  preview: string;
  full: string;
  expandable: boolean;
}

export interface MarkChipView {
  id: string;
  name: string;
  nature: MarkNature;
  intensity: number;
  hint: string;
}

export interface MarkStripView {
  visible: MarkChipView[];
  overflow: MarkChipView[];
}

export interface DiscoveryView {
  contentKey: string;
  title: string;
  statement: TruncatedText;
  sourceCount: number;
  sourceLine: string;
}

export interface CarryCardView {
  id: string;
  statement: TruncatedText;
  theme: string;
  sourceLine: string;
  selected: boolean;
}

export interface HomeView {
  lifeCount: number;
  discoveryCount: number;
  runStatus: 'none' | 'active' | 'awaiting-archive' | 'settled';
  continueCaption?: string;
  archiveLine: string;
  lastTitle?: string;
  scene: SceneVisual;
  age: number;
  ageBand: CharacterAgeBand;
  discoveries: DiscoveryView[];
}

export interface CarryPageView {
  cards: CarryCardView[];
  selectedCount: number;
  max: number;
  canSkip: boolean;
}

export interface RecalledChipView {
  id: string;
  text: string;
}

export interface ResponseOptionView {
  id: string;
  text: string;
  preview: string;
  cost: number;
  costLabel?: string;
  supportReason?: string;
  enabled: boolean;
  disabledReason?: string;
  selected: boolean;
}

export interface EncounterPageView {
  title: string;
  age: number;
  ageBand: CharacterAgeBand;
  lifePoints: number;
  lifePointCap: number;
  worldLine: string;
  event: TruncatedText;
  triggerNote: TruncatedText;
  triggerKind: TriggerKind;
  marks: MarkStripView;
  recalled: RecalledChipView[];
  options: ResponseOptionView[];
  selectedId: string | null;
  canConfirm: boolean;
  scene: SceneVisual;
  sceneKind: ScenarioKind;
}

export interface RecallOptionView {
  stance: RecallStance;
  label: string;
  statement: TruncatedText;
  selected: boolean;
}

export interface RecallPageView {
  prompt: TruncatedText;
  evidence: TruncatedText[];
  age: number;
  ageBand: CharacterAgeBand;
  lifePoints: number;
  options: RecallOptionView[];
  selectedStance: RecallStance | null;
  canConfirm: boolean;
  scene: SceneVisual;
}

export interface CausalityPageView {
  title: string;
  happened: TruncatedText;
  response?: TruncatedText;
  understood?: TruncatedText;
  later: string[];
  people: string[];
  triggerNote: string;
  evoked: Array<{ id: string; note: string }>;
  sources: Array<{ id: string; relation: string }>;
}

export interface EndingPageView {
  title: string;
  text: TruncatedText;
  age: number;
  ageBand: CharacterAgeBand;
  worldLine: string;
  shapedBy: TruncatedText[];
  changed: string[];
  unresolved: string[];
  unfulfilled: string[];
  pendingArchive: boolean;
  scene: SceneVisual;
}
