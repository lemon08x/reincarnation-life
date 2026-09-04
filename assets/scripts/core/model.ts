export const SAVE_VERSION = 2;
export const RULES_VERSION = 5;

export const STAT_KEYS = ['health', 'intellect', 'charm', 'wealth'] as const;

export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;
export type StatDelta = Partial<Record<StatKey, number>>;

export const LIFE_DOMAINS = [
  'health',
  'learning',
  'relationship',
  'career',
  'family',
  'travel',
  'craft',
  'legacy',
] as const;
export type LifeDomain = (typeof LIFE_DOMAINS)[number];

export const RELATION_KINDS = [
  'family',
  'friend',
  'partner',
  'child',
  'mentor',
  'community',
] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

export interface LifeFact {
  value: string;
  sinceAge: number;
}

export interface LifeRelation {
  id: string;
  kind: RelationKind;
  label: string;
  closeness: number;
  strain: number;
  sinceAge: number;
  lastTouchedAge: number;
}

export interface LifeThread {
  id: string;
  domain: LifeDomain;
  label: string;
  intensity: number;
  sinceAge: number;
  lastEventAge: number;
}

export interface LifeWorld {
  facts: Record<string, LifeFact>;
  relations: LifeRelation[];
  threads: LifeThread[];
}

export interface RelationChange {
  id: string;
  kind?: RelationKind;
  label?: string;
  closeness?: number;
  closenessDelta?: number;
  strainDelta?: number;
  remove?: boolean;
}

export interface ThreadChange {
  id: string;
  domain?: LifeDomain;
  label?: string;
  intensity?: number;
  intensityDelta?: number;
  resolve?: boolean;
}

export const MARK_SLOTS = ['body', 'mind', 'bond', 'means'] as const;
export type MarkSlot = (typeof MARK_SLOTS)[number];
export type MarkNature = 'aura' | 'possession' | 'burden';

export interface MarkDef {
  id: string;
  slot: MarkSlot;
  nature: MarkNature;
  ranks: [string, string, string];
  hint: string;
  boostDomains?: LifeDomain[];
  mortality?: number;
  kindBias?: number;
  harshBias?: number;
}

export interface LifeMark {
  id: string;
  intensity: number;
}

export interface MarkChange {
  id: string;
  intensity?: number;
  intensityDelta?: number;
  remove?: boolean;
}

export interface WorldChange {
  stats?: StatDelta;
  addTags?: string[];
  setFacts?: Record<string, string>;
  clearFacts?: string[];
  relations?: RelationChange[];
  threads?: ThreadChange[];
  marks?: MarkChange[];
}

export interface TalentConfig {
  id: string;
  name: string;
  description: string;
  unlockLevel: number;
  effects: StatDelta;
  tags?: string[];
  world?: WorldChange;
  grantMarks?: MarkChange[];
}

export interface FamilyConfig {
  id: string;
  name: string;
  description: string;
  unlockLevel: number;
  weight: number;
  effects: StatDelta;
  tags?: string[];
  world?: WorldChange;
  grantMarks?: MarkChange[];
}

export interface EventCondition {
  minStats?: StatDelta;
  maxStats?: StatDelta;
  requiredTags?: string[];
  forbiddenTags?: string[];
  anyTags?: string[];
  requiredTalentIds?: string[];
  requiredEventIds?: string[];
  requiredFocusIds?: string[];
  requiredCapabilityTags?: string[];
  requiredFacts?: Record<string, string>;
  forbiddenFacts?: string[];
  anyFacts?: Record<string, string[]>;
  requiredRelations?: string[];
  minPressures?: Partial<Record<LifeDomain, number>>;
  requiredMarks?: Record<string, number>;
}

export interface EventCoupling {
  allFacts?: Record<string, string>;
  anyFacts?: Record<string, string[]>;
  allTags?: string[];
  allRelations?: string[];
  minPressures?: Partial<Record<LifeDomain, number>>;
  weightBonus: number;
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
  world?: WorldChange;
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
  domains?: LifeDomain[];
  effects?: StatDelta;
  addTags?: string[];
  world?: WorldChange;
  couplings?: EventCoupling[];
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
  requiredMarks?: Record<string, number>;
}

export interface LifeFocusConfig {
  id: string;
  name: string;
  description: string;
  effects: StatDelta;
  preferredThemes: string[];
  capabilityTags?: string[];
  world?: WorldChange;
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
  marks: MarkDef[];
  scenarios: ScenarioConfig[];
  regions: HistoryRegion[];
  figures: HistoryFigure[];
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
export type LifeTurnState =
  | 'awaiting-focus'
  | 'awaiting-path'
  | 'in-scenario'
  | 'awaiting-choice'
  | 'scenario-summary'
  | 'ready';

export type PlayMode = 'free' | 'history';
export type HistoryRegionId = 'china-ancient' | 'china-modern' | 'west-ancient' | 'west-modern';
export type ScenarioKind =
  | 'childhood'
  | 'studies'
  | 'commerce'
  | 'craft'
  | 'journey'
  | 'hearth'
  | 'service'
  | 'dusk';
export type ScenarioIcon = 'seed' | 'book' | 'coin' | 'hammer' | 'road' | 'home' | 'seal' | 'lamp';

export interface ScenarioOutcome {
  id: string;
  weight: number;
  text: string;
  resources?: Record<string, number>;
  world?: WorldChange;
  addTags?: string[];
}

export interface ScenarioAction {
  id: string;
  title: string;
  hint: string;
  icon: ScenarioIcon;
  cost?: Record<string, number>;
  condition?: EventCondition;
  outcomes: ScenarioOutcome[];
}

export interface ScenarioBeat {
  id: string;
  text: string;
  weight: number;
  once?: boolean;
  condition?: EventCondition;
  resources?: Record<string, number>;
  world?: WorldChange;
  addTags?: string[];
  choices?: EventChoiceConfig[];
}

export interface ScenarioConfig {
  id: string;
  title: string;
  kind: ScenarioKind;
  icon: ScenarioIcon;
  summary: string;
  minAge: number;
  maxAge: number;
  turns: number;
  years: number;
  startResources: Record<string, number>;
  resourceLabels: Record<string, string>;
  actions: ScenarioAction[];
  beats: ScenarioBeat[];
  modes?: PlayMode[];
}

export interface HistoryChapter {
  scenarioId: string;
  title: string;
  intro: string;
  years?: number;
}

export interface HistoryFigure {
  id: string;
  name: string;
  region: HistoryRegionId;
  epithet: string;
  opening: string;
  grantMarks?: MarkChange[];
  chapters: HistoryChapter[];
}

export interface HistoryRegion {
  id: HistoryRegionId;
  name: string;
  era: string;
  description: string;
}

export interface ActiveScenario {
  scenarioId: string;
  title: string;
  kind: ScenarioKind;
  icon: ScenarioIcon;
  turn: number;
  maxTurns: number;
  years: number;
  resources: Record<string, number>;
  resourceLabels: Record<string, string>;
  log: string[];
  actionIds: string[];
  beatId?: string;
  beatText?: string;
  startedAtAge: number;
}

export interface ScenarioReport {
  title: string;
  years: number;
  ageAfter: number;
  lines: string[];
}

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
  pressureNote?: string;
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
  worldChanges?: string[];
  markChanges?: string[];
  touchedDomains?: LifeDomain[];
  pressureNote?: string;
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
  playMode: PlayMode;
  historyRegion?: HistoryRegionId;
  figureId?: string;
  chapterIndex: number;
  age: number;
  familyId: string;
  talentIds: string[];
  allocation: Stats;
  stats: Stats;
  tags: string[];
  marks: LifeMark[];
  world: LifeWorld;
  history: LifeHistoryEntry[];
  currentStageId: string;
  currentFocusId?: string;
  stageSelections: StageSelection[];
  scheduledEvents: ScheduledLifeEvent[];
  pendingDecision?: PendingLifeDecision;
  currentScenario?: ActiveScenario;
  scenarioReport?: ScenarioReport;
  completedScenarioIds: string[];
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

export function emptyWorld(): LifeWorld {
  return {
    facts: {},
    relations: [],
    threads: [],
  };
}

export function mergeStatDeltas(...deltas: Array<StatDelta | undefined>): StatDelta {
  const result = emptyStats();
  for (const delta of deltas) {
    if (!delta) {
      continue;
    }
    for (const key of STAT_KEYS) {
      result[key] += delta[key] ?? 0;
    }
  }
  return result;
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
