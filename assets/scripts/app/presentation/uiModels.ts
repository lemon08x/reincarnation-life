import {
  HistoryRegionId,
  LegacyCategory,
  LegacyPersistence,
  MarkNature,
  ScenarioIcon,
  ScenarioKind,
} from '../../core/model';
import {
  CharacterAgeBand,
  CharacterPose,
  FigureVisual,
  RegionVisual,
  SceneVisual,
} from './visualConfig';

export type PlayPage =
  | 'home'
  | 'path'
  | 'scenario'
  | 'choice'
  | 'summary'
  | 'ready'
  | 'result';

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

export interface ResourceView {
  key: string;
  label: string;
  value: number;
  delta?: number;
}

export interface ResourceDeltaView {
  key: string;
  label: string;
  from: number;
  to: number;
  delta: number;
}

export interface MarkDeltaView {
  id: string;
  name: string;
  nature: MarkNature;
  from: number;
  to: number;
  delta: number;
  removed: boolean;
}

export interface StateDiffView {
  resources: ResourceDeltaView[];
  marks: MarkDeltaView[];
}

export interface ActionView {
  id: string;
  title: string;
  hint: string;
  icon: ScenarioIcon;
  costText?: string;
  enabled: boolean;
  disabledReason?: string;
}

export interface ChoiceView {
  id: string;
  text: string;
  preview: string;
  foresight?: string;
  selected: boolean;
}

export interface SlotView {
  filled: boolean;
  name?: string;
  category?: string;
}

export interface TimelineItemView {
  age: number;
  text: TruncatedText;
}

export interface HomeView {
  level: number;
  totalExp: number;
  expProgress: number;
  expCaption: string;
  nextReward?: string;
  openingReserve: string;
  talentCandidates: number;
  slots: SlotView[];
  boons: string[];
  runStatus: 'none' | 'active' | 'reward-pending' | 'settled';
  continueCaption?: string;
  age: number;
  ageBand: CharacterAgeBand;
  scene: SceneVisual;
}

export interface TalentCardView {
  id: string;
  name: string;
  effectLine: string;
  description: TruncatedText;
  selected: boolean;
  nature: MarkNature;
}

export interface TalentPageView {
  required: number;
  remaining: number;
  canBegin: boolean;
  candidates: TalentCardView[];
  slots: Array<TalentCardView | null>;
}

export interface RegionCardView {
  id: HistoryRegionId;
  name: string;
  era: string;
  description: TruncatedText;
  scene: SceneVisual;
  region: RegionVisual;
}

export interface FigureCardView {
  id: string;
  name: string;
  epithet: string;
  opening: TruncatedText;
  look: FigureVisual;
  selected: boolean;
}

export interface PathCardView {
  id: string;
  title: string;
  summary: TruncatedText;
  kind: ScenarioKind;
  sceneName: string;
  icon: ScenarioIcon;
  scene: SceneVisual;
}

export interface PathPageView {
  caption: string;
  marks: MarkStripView;
  paths: PathCardView[];
  age: number;
  ageBand: CharacterAgeBand;
  region?: HistoryRegionId;
  figureId?: string;
}

export interface ScenarioPageView {
  title: string;
  kind: ScenarioKind;
  sceneName: string;
  scene: SceneVisual;
  pose: CharacterPose;
  age: number;
  ageBand: CharacterAgeBand;
  turnCurrent: number;
  turnMax: number;
  turnProgress: number;
  resources: ResourceView[];
  event: TruncatedText;
  marks: MarkStripView;
  actions: ActionView[];
  diffs: StateDiffView;
  region?: HistoryRegionId;
  figureId?: string;
}

export interface ChoicePageView {
  source: string;
  age: number;
  ageBand: CharacterAgeBand;
  event: TruncatedText;
  choices: ChoiceView[];
  selectedId: string | null;
  canConfirm: boolean;
  canForesight: boolean;
  foresightOpen: boolean;
  canReroll: boolean;
  rerollsRemaining: number;
  scene: SceneVisual;
  region?: HistoryRegionId;
  figureId?: string;
}

export interface SummaryPageView {
  title: string;
  years: number;
  ageAfter: number;
  ageBand: CharacterAgeBand;
  lines: TruncatedText[];
  marks: MarkStripView;
  diffs: StateDiffView;
  scene: SceneVisual;
  region?: HistoryRegionId;
  figureId?: string;
}

export interface ReadyPageView {
  age: number;
  ageBand: CharacterAgeBand;
  familyName: string;
  stageLine: string;
  worldLine: string;
  marks: MarkStripView;
  latest: TruncatedText;
  latestAge: number;
  effectLine: string;
  recent: string[];
  autoPlaying: boolean;
  scene: SceneVisual;
}

export interface ResultPageView {
  endingTitle: string;
  endingDescription: TruncatedText;
  age: number;
  score: number;
  endReason: string;
  worldLine: string;
  earnedExp: number;
  expDetails: string;
  leveledUp: boolean;
  levelLine: string;
  rewardText: string;
  pendingReward: boolean;
  selectedRewardName?: string;
  timeline: TimelineItemView[];
  marks: MarkStripView;
  scene: SceneVisual;
}

export interface RewardCardView {
  id: string;
  name: string;
  category: LegacyCategory;
  categoryLabel: string;
  description: TruncatedText;
  persistence: LegacyPersistence;
  rankText: string;
  selected: boolean;
}

export interface RewardPageView {
  cards: RewardCardView[];
  selectedId: string | null;
  canClaim: boolean;
}

export interface LoadoutItemView {
  id: string;
  name: string;
  categoryLabel: string;
  description: TruncatedText;
  rank: number;
  maxRank: number;
  equipped: boolean;
  enabled: boolean;
  disabledReason?: string;
}

export interface LoadoutPageView {
  slots: SlotView[];
  filled: number;
  slotCount: number;
  items: LoadoutItemView[];
  selectedId: string | null;
  selected?: LoadoutItemView;
}
