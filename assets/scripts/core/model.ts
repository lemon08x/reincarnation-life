export const SAVE_VERSION = 3;
export const RULES_VERSION = 6;

export const LIFE_POINT_START = 2;
export const LIFE_POINT_CAP = 4;
export const LIFE_POINT_RECALL_GAIN = 1;
export const MAX_RECALLS_PER_LIFE = 2;
export const RECALL_AFTER_COUNTS = [3, 6] as const;
export const MIN_ENCOUNTERS = 6;
export const MAX_ENCOUNTERS = 8;
export const BREAK_HABIT_COST = 1;
export const PURSUE_OPPORTUNITY_COST = 2;
export const MAX_CARRIED_UNDERSTANDINGS = 2;

export const LIFE_THEMES = ['trust', 'belonging', 'worth'] as const;
export type LifeTheme = (typeof LIFE_THEMES)[number];

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

export const MARK_SLOTS = ['body', 'mind', 'bond', 'means'] as const;
export type MarkSlot = (typeof MARK_SLOTS)[number];
export type MarkNature = 'aura' | 'possession' | 'burden';

export type ScenarioKind =
  | 'childhood'
  | 'studies'
  | 'commerce'
  | 'craft'
  | 'journey'
  | 'hearth'
  | 'service'
  | 'dusk';

export type HistoryRegionId = 'china-ancient' | 'china-modern' | 'west-ancient' | 'west-modern';

export type LifeStatus = 'active' | 'awaiting-archive' | 'settled';
export type LifeTurnState =
  | 'awaiting-response'
  | 'awaiting-recall'
  | 'awaiting-archive'
  | 'settled';

export type TriggerKind = 'family' | 'era' | 'chance' | 'consequence' | 'thread-conflict';
export type LifePointReason = 'start' | 'recall' | 'spend';
export type RecallStance = 'hold' | 'revise' | 'question';
export type CostKind = 'free' | 'break-habit' | 'pursue-opportunity';

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
  addTags?: string[];
  setFacts?: Record<string, string>;
  clearFacts?: string[];
  relations?: RelationChange[];
  threads?: ThreadChange[];
  marks?: MarkChange[];
}

export interface EncounterCondition {
  requiredTags?: string[];
  forbiddenTags?: string[];
  anyTags?: string[];
  requiredFacts?: Record<string, string>;
  forbiddenFacts?: string[];
  anyFacts?: Record<string, string[]>;
  requiredRelations?: string[];
  minPressures?: Partial<Record<LifeDomain, number>>;
}

export interface PersonBinding {
  role: string;
  relationId: string;
  fallbackLabel: string;
  createIfMissing?: {
    kind: RelationKind;
    label: string;
    closeness: number;
  };
}

export interface BoundPerson {
  role: string;
  relationId: string;
  label: string;
}

export interface SupportRule {
  anyTags?: string[];
  requiredTags?: string[];
  anyFragmentTags?: string[];
  understandingIds?: string[];
  ifUnsupported: 'hide' | 'cost-break';
}

export interface ScheduledEncounterConfig {
  templateId: string;
  afterYears: number;
  windowYears?: number;
  note: string;
}

export interface EncounterOutcomeConfig {
  id: string;
  weight: number;
  text: string;
  world: WorldChange;
  later: string;
  schedule?: ScheduledEncounterConfig[];
}

export interface EncounterChoiceConfig {
  id: string;
  text: string;
  preview: string;
  costKind: CostKind;
  support?: SupportRule;
  supportReason?: string;
  condition?: EncounterCondition;
  fragmentTags: string[];
  understandingHint?: string;
  outcomes: EncounterOutcomeConfig[];
}

export interface EncounterTemplate {
  id: string;
  theme: LifeTheme;
  crossThemes?: LifeTheme[];
  title: string;
  text: string;
  minAge: number;
  maxAge: number;
  years: number;
  sceneKind: ScenarioKind;
  weight: number;
  people: PersonBinding[];
  triggerKind: TriggerKind;
  triggerNote: string;
  condition?: EncounterCondition;
  choices: EncounterChoiceConfig[];
}

export interface UnderstandingSeed {
  id: string;
  theme: LifeTheme;
  anyFragmentTags: string[];
  initial: string;
  revised: string;
  question: string;
}

export interface TemperamentConfig {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  grantMarks?: MarkChange[];
  world?: WorldChange;
}

export interface FamilyConfig {
  id: string;
  name: string;
  description: string;
  weight: number;
  tags?: string[];
  world?: WorldChange;
  grantMarks?: MarkChange[];
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

export interface GameContent {
  families: FamilyConfig[];
  temperaments: TemperamentConfig[];
  encounters: EncounterTemplate[];
  understandingSeeds: UnderstandingSeed[];
  marks: MarkDef[];
  regions: HistoryRegion[];
  figures: HistoryFigure[];
}

export interface LifePointEntry {
  age: number;
  reason: LifePointReason;
  amount: number;
  balance: number;
  encounterInstanceId?: string;
  note: string;
}

export interface ScheduledEncounter {
  templateId: string;
  earliestAge: number;
  latestAge: number;
  sourceEncounterInstanceId: string;
  sourceFragmentId: string;
  note: string;
}

export interface PendingOption {
  choiceId: string;
  text: string;
  preview: string;
  cost: number;
  costKind: CostKind;
  supportReason?: string;
  supportedByFragmentIds: string[];
  enabled: boolean;
  disabledReason?: string;
}

export interface PendingEncounter {
  instanceId: string;
  templateId: string;
  age: number;
  text: string;
  title: string;
  sceneKind: ScenarioKind;
  theme: LifeTheme;
  triggerKind: TriggerKind;
  triggerNote: string;
  triggerSourceIds: string[];
  boundPeople: BoundPerson[];
  recalledFragmentIds: string[];
  recalledNotes: string[];
  options: PendingOption[];
  rngState: number;
}

export interface PendingRecallOption {
  stance: RecallStance;
  label: string;
  statement: string;
}

export interface PendingRecall {
  instanceId: string;
  recallIndex: 1 | 2;
  fragmentIds: string[];
  seedId: string;
  existingUnderstandingId?: string;
  prompt: string;
  options: PendingRecallOption[];
}

export interface ExperienceFragment {
  id: string;
  contentKey: string;
  runId: string;
  age: number;
  encounterInstanceId: string;
  templateId: string;
  theme: LifeTheme;
  people: BoundPerson[];
  whatHappened: string;
  howIResponded: string;
  choiceId: string;
  outcomeId: string;
  costPaid: number;
  fragmentTags: string[];
  recalledFragmentIds: string[];
  understandingAtTime?: string;
  understandingId?: string;
  laterWhat: string[];
  triggerKind: TriggerKind;
  triggerNote: string;
  triggerSourceIds: string[];
  worldChanges: string[];
}

export interface Understanding {
  id: string;
  contentKey: string;
  theme: LifeTheme;
  statement: string;
  stance: RecallStance;
  version: number;
  previousVersionId?: string;
  sourceFragmentIds: string[];
  createdInRunId: string;
  createdAtAge: number;
}

export interface DiscoverySource {
  runId: string;
  fragmentId: string;
  understandingId?: string;
  personLabels: string[];
  age: number;
}

export interface ArchiveDiscovery {
  contentKey: string;
  title: string;
  latestStatement: string;
  variantStatements: string[];
  sources: DiscoverySource[];
}

export interface LifeClosing {
  title: string;
  text: string;
  shapedBy: string[];
  changed: string[];
  unresolved: string[];
  unfulfilled: string[];
}

export interface CausalityRecord {
  id: string;
  kind: 'fragment' | 'understanding' | 'encounter';
  title: string;
  happened: string;
  response?: string;
  understood?: string;
  later: string[];
  people: Array<{ id: string; label: string }>;
  trigger: { kind: TriggerKind | 'recall'; note: string };
  evoked: Array<{ id: string; note: string }>;
  sources: Array<{ id: string; relation: string }>;
}

export interface LifeRun {
  id: string;
  seed: number;
  rngState: number;
  rulesVersion: number;
  status: LifeStatus;
  turnState: LifeTurnState;
  age: number;
  familyId: string;
  temperamentId: string;
  tags: string[];
  marks: LifeMark[];
  world: LifeWorld;
  lifePoints: number;
  lifePointCap: number;
  lifePointLog: LifePointEntry[];
  encounterCount: number;
  recallCount: number;
  nextEncounterSeq: number;
  nextFragmentSeq: number;
  nextUnderstandingSeq: number;
  lineA: LifeTheme;
  lineB: LifeTheme;
  usedTemplateIds: string[];
  resolvedEncounterIds: string[];
  resolvedRecallIds: string[];
  fragments: ExperienceFragment[];
  understandings: Understanding[];
  carriedUnderstandingIds: string[];
  scheduled: ScheduledEncounter[];
  pendingEncounter?: PendingEncounter;
  pendingRecall?: PendingRecall;
  closing?: LifeClosing;
  skippedYearNotes: string[];
}

export interface ReincarnatorProfile {
  version: number;
  archivedRunIds: string[];
  discoveries: ArchiveDiscovery[];
  understandings: Understanding[];
  fragments: ExperienceFragment[];
  lastClosing?: LifeClosing;
  lastRunId?: string;
}

export interface GameSave {
  version: number;
  profile: ReincarnatorProfile;
  currentRun: LifeRun | null;
}

export function emptyWorld(): LifeWorld {
  return {
    facts: {},
    relations: [],
    threads: [],
  };
}

export function createInitialProfile(): ReincarnatorProfile {
  return {
    version: RULES_VERSION,
    archivedRunIds: [],
    discoveries: [],
    understandings: [],
    fragments: [],
  };
}

export function themeLabel(theme: LifeTheme): string {
  if (theme === 'trust') {
    return '信任与自我保护';
  }
  if (theme === 'belonging') {
    return '离开与归属';
  }
  return '价值与被需要';
}
