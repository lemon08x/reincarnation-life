export const SAVE_VERSION = 2;
export const RULES_VERSION = 2;

export const STAT_KEYS = ['health', 'intellect', 'charm', 'wealth'] as const;

export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;
export type StatDelta = Partial<Record<StatKey, number>>;

export interface TalentConfig {
  id: string;
  name: string;
  description: string;
  unlockLevel: number;
  effects: StatDelta;
  tags?: string[];
}

export interface FamilyConfig {
  id: string;
  name: string;
  description: string;
  unlockLevel: number;
  weight: number;
  effects: StatDelta;
  tags?: string[];
}

export interface EventCondition {
  minStats?: StatDelta;
  maxStats?: StatDelta;
  requiredTags?: string[];
  forbiddenTags?: string[];
  requiredTalentIds?: string[];
  requiredEventIds?: string[];
  requiredFocusIds?: string[];
  requiredCapabilityTags?: string[];
}

export interface ScheduledEventConfig {
  eventId: string;
  afterYears: number;
  windowYears?: number;
}

export interface EventOutcomeConfig {
  id: string;
  weight: number;
  text: string;
  effects?: StatDelta;
  addTags?: string[];
  schedule?: ScheduledEventConfig[];
  terminalReason?: string;
}

export interface EventChoiceConfig {
  id: string;
  text: string;
  preview: string;
  condition?: EventCondition;
  outcomes: EventOutcomeConfig[];
}

export interface LifeEventConfig {
  id: string;
  minAge: number;
  maxAge: number;
  text: string;
  weight: number;
  unlockLevel?: number;
  once?: boolean;
  themes?: string[];
  effects?: StatDelta;
  addTags?: string[];
  condition?: EventCondition;
  choices?: EventChoiceConfig[];
  terminalReason?: string;
}

export interface EndingConfig {
  id: string;
  title: string;
  description: string;
  priority: number;
  minAge?: number;
  maxAge?: number;
  minStats?: StatDelta;
  requiredTags?: string[];
}

export interface LifeFocusConfig {
  id: string;
  name: string;
  description: string;
  effects: StatDelta;
  preferredThemes: string[];
  capabilityTags?: string[];
}

export interface LifeStageConfig {
  id: string;
  name: string;
  minAge: number;
  maxAge: number;
  focuses: LifeFocusConfig[];
}

export interface PermanentBenefits {
  attributePointBonus: number;
  talentCandidateBonus: number;
  legacySlotBonus: number;
}

export interface LevelConfig {
  level: number;
  requiredExp: number;
  rewardText: string;
  benefits?: Partial<PermanentBenefits>;
}

export type LegacyCategory = 'origin' | 'fate' | 'path' | 'story' | 'boon';
export type LegacyPersistence = 'permanent' | 'next-life';

export type LegacyEffect =
  | { type: 'starting-points'; amount: number }
  | { type: 'talent-candidates'; amount: number }
  | { type: 'event-reroll'; charges: number }
  | { type: 'choice-foresight'; detail: 'direction' | 'range' }
  | { type: 'death-guard'; charges: number }
  | { type: 'negative-shield'; charges: number }
  | { type: 'event-theme-boost'; theme: string }
  | { type: 'unlock-choice-tag'; tag: string }
  | { type: 'unlock-content-tag'; tag: string };

export interface LegacyCondition {
  anyTags?: string[];
  requiredTags?: string[];
  endingIds?: string[];
  minAge?: number;
  maxAge?: number;
}

export interface LegacyConfig {
  id: string;
  name: string;
  description: string;
  category: LegacyCategory;
  persistence: LegacyPersistence;
  unlockLevel: number;
  maxRank: number;
  effect: LegacyEffect;
  condition?: LegacyCondition;
}

export interface GameContent {
  talents: TalentConfig[];
  families: FamilyConfig[];
  events: LifeEventConfig[];
  endings: EndingConfig[];
  levels: LevelConfig[];
  stages: LifeStageConfig[];
  legacies: LegacyConfig[];
}

export interface ReincarnatorProfile {
  version: number;
  totalExp: number;
  level: number;
  discoveredEndingIds: string[];
  settledRunIds: string[];
  rewardedRunIds: string[];
  legacyRanks: Record<string, number>;
  equippedLegacyIds: string[];
  pendingBoonIds: string[];
}

export type LifeStatus = 'active' | 'ended' | 'reward-pending' | 'settled';
export type LifeTurnState = 'awaiting-focus' | 'ready' | 'awaiting-choice';

export interface RunCapabilities {
  startingPointBonus: number;
  talentCandidateBonus: number;
  eventRerolls: number;
  choiceForesight: 'none' | 'direction' | 'range';
  deathGuards: number;
  negativeShields: number;
  eventThemeBoosts: string[];
  choiceTags: string[];
  contentTags: string[];
}

export interface RunFateState {
  eventRerollsRemaining: number;
  deathGuardsRemaining: number;
  negativeShieldsRemaining: number;
}

export interface StageSelection {
  stageId: string;
  focusId: string;
  selectedAtAge: number;
}

export interface ScheduledLifeEvent {
  eventId: string;
  earliestAge: number;
  latestAge: number;
  sourceChoiceId: string;
}

export interface PendingLifeDecision {
  age: number;
  eventId: string;
  choiceIds: string[];
  automaticEffects: StatDelta;
  rerolledEventIds: string[];
  sourceChoiceId?: string;
}

export interface LifeHistoryEntry {
  age: number;
  eventId: string;
  text: string;
  effects: StatDelta;
  tagsAdded: string[];
  choiceId?: string;
  outcomeId?: string;
  causedByChoiceId?: string;
}

export interface LifeSettlement {
  score: number;
  earnedExp: number;
  baseExp: number;
  performanceExp: number;
  firstDiscoveryExp: number;
  previousLevel: number;
  newLevel: number;
  newRewardTexts: string[];
  rewardOfferIds: string[];
  selectedRewardId?: string;
}

export interface LifeRun {
  id: string;
  seed: number;
  rngState: number;
  rulesVersion: number;
  profileLevelAtStart: number;
  status: LifeStatus;
  turnState: LifeTurnState;
  age: number;
  familyId: string;
  talentIds: string[];
  allocation: Stats;
  stats: Stats;
  tags: string[];
  history: LifeHistoryEntry[];
  currentStageId: string;
  currentFocusId?: string;
  stageSelections: StageSelection[];
  scheduledEvents: ScheduledLifeEvent[];
  pendingDecision?: PendingLifeDecision;
  capabilities: RunCapabilities;
  fate: RunFateState;
  endReason?: string;
  endingId?: string;
  settlement?: LifeSettlement;
}

export interface TalentDraft {
  seed: number;
  rngState: number;
  candidateIds: string[];
  requiredSelectionCount: number;
}

export interface GameSave {
  version: number;
  profile: ReincarnatorProfile;
  currentRun: LifeRun | null;
}

export interface LevelProgress {
  currentLevel: number;
  currentThreshold: number;
  nextThreshold: number | null;
  progress: number;
  nextRewardText: string | null;
}

export function emptyStats(): Stats {
  return {
    health: 0,
    intellect: 0,
    charm: 0,
    wealth: 0,
  };
}

export function emptyRunCapabilities(): RunCapabilities {
  return {
    startingPointBonus: 0,
    talentCandidateBonus: 0,
    eventRerolls: 0,
    choiceForesight: 'none',
    deathGuards: 0,
    negativeShields: 0,
    eventThemeBoosts: [],
    choiceTags: [],
    contentTags: [],
  };
}
