import type { ScenarioKind } from './model';

// 家庭与代际成长（v4）核心类型。独立于旧轮回模型，不把家庭状态塞进 ReincarnatorProfile。
export const FAMILY_SAVE_VERSION = 4;
export const FAMILY_RULES_VERSION = 1;
export const FAMILY_SAVE_KEY = 'reincarnation-life.family.v4';

export const FAMILY_ABILITIES = ['hands', 'talk', 'plan'] as const;
export type FamilyAbility = (typeof FAMILY_ABILITIES)[number];
export const FAMILY_ABILITY_NAMES: Record<FamilyAbility, string> = {
  hands: '动手',
  talk: '沟通',
  plan: '筹划',
};

export const FAMILY_MILESTONES = ['stable-life', 'raise', 'enterprise'] as const;
export type FamilyMilestone = (typeof FAMILY_MILESTONES)[number];
export const FAMILY_MILESTONE_NAMES: Record<FamilyMilestone, string> = {
  'stable-life': '安稳度日',
  raise: '有条件培养后辈',
  enterprise: '拥有可持续的家业',
};
export const FAMILY_MILESTONE_DESCRIPTIONS: Record<FamilyMilestone, string> = {
  'stable-life': '生活有保障，家人不必为基本开支发愁。',
  raise: '有余力供后辈学习，也积累起可信的名声。',
  enterprise: '拥有能持续经营的家业，可以由一代一代接下去。',
};

export const GENERATION_OUTCOMES = ['achieved', 'partial', 'failed'] as const;
export type GenerationOutcome = (typeof GENERATION_OUTCOMES)[number];
export const GENERATION_OUTCOME_NAMES: Record<GenerationOutcome, string> = {
  achieved: '达成目标',
  partial: '部分达成',
  failed: '未达成',
};

export const BUILDING_CATEGORIES = ['security', 'asset', 'education', 'reputation'] as const;
export type BuildingCategory = (typeof BUILDING_CATEGORIES)[number];
export const BUILDING_CATEGORY_NAMES: Record<BuildingCategory, string> = {
  security: '生活保障',
  asset: '生产资产',
  education: '教育与家学',
  reputation: '声誉与联系',
};

export type MissionPhase = 'context' | 'prepare' | 'opportunity' | 'apply' | 'difficulty' | 'settle' | 'branch';
export type MissionProgressKind = 'funds' | 'stages' | 'orders';

export interface AccumulationSource {
  generation: number;
  text: string; // 例如「第一代：修好旧屋」
}

// 长期积累（资产 / 家学 / 声誉 / 保障）：具有具体用途的状态，不是可刷取的点数条。
export interface FamilyAccumulation {
  id: string; // 稳定实例 ID，如 'asset:basic-tools'
  category: BuildingCategory;
  level: number; // 1 | 2
  name: string;
  benefit: string; // 下一代获得的具体作用
  source: AccumulationSource;
}

export interface FamilyEvidence {
  id: string; // 'delivered' | 'learned' | 'crafted' | 'reserved'
  text: string;
  generation: number;
}

export interface ContributionRecord {
  id: string;
  generation: number;
  text: string; // 「第一代：修好旧屋」
  kind: BuildingCategory | 'funds';
  runId: string;
}

export interface GenerationSummary {
  runId: string;
  generation: number;
  memberName: string;
  memberRole: string;
  ageSpan: string;
  era: string;
  outcome: GenerationOutcome;
  missionTitle: string;
  summary: string;
  leftForFamily: string[];
  netFunds: number;
}

export interface FamilyState {
  version: number;
  id: string;
  name: string;
  era: string;
  eraIndex: number;
  generationCount: number; // 已结算的代次数
  funds: number; // 家庭资金（唯一可分配资源）
  accumulations: FamilyAccumulation[];
  evidence: FamilyEvidence[];
  milestone: FamilyMilestone;
  history: GenerationSummary[];
  contributions: ContributionRecord[];
}

export interface FamilyOptionGate {
  assetIds?: string[];
  educationMin?: number;
  reputationMin?: number;
  securityMin?: number;
  ability?: { ability: FamilyAbility; level: number };
  flags?: string[];
  anyOf?: FamilyOptionGate[];
}

export interface FamilyOptionEffect {
  cost?: number;
  income?: number;
  payTarget?: boolean; // 从本代预算扣除当前约定开支
  abilities?: Partial<Record<FamilyAbility, number>>;
  flags?: string[];
  progress?: { amount?: number; targetDelta?: number; stage?: string; orderId?: string };
  evidence?: string[]; // 本代实际获得的资质
  grantAsset?: { id: string; category: BuildingCategory; level: number; name: string; benefit: string };
  outcome: string; // 结果叙述（反馈正文）
}

export interface FamilyOptionDef {
  id: string;
  text: string;
  preview: string;
  requires?: FamilyOptionGate;
  cashIn?: string[]; // 兑现的家庭积累 id，用于来源标签
  unmetText?: string; // 条件不满足时的展示原因
  effect: FamilyOptionEffect;
}

export interface FamilyEventDef {
  id: string;
  phase: MissionPhase;
  title: string;
  text: string;
  scene: ScenarioKind;
  options: FamilyOptionDef[];
  skipUnlessFlags?: string[]; // 分支事件：不满足条件时跳过
  alts?: Array<{ title: string; text: string; scene?: ScenarioKind }>; // 随机处境变体，选项结构保持不变
}

export interface MissionOutcomeRules {
  fundsTarget?: number;
  partialRatio?: number;
  stageAchieved?: string;
  stagePartial?: string;
  ordersAchieved?: number;
  ordersPartial?: number;
}

export interface MissionEligibility {
  minSecurity?: number;
  maxSecurity?: number; // 生活保障等级低于此值时仍可选（安居未解决）
  minGenerations?: number;
  requireAssets?: string[];
  minEducation?: number;
  minReputation?: number;
}

export interface MissionDefinition {
  id: string;
  title: string;
  goalText: string; // 开局可见目标
  progressKind: MissionProgressKind;
  progressLabel: string;
  target?: number; // funds
  stages?: string[]; // stages
  orders?: Array<{ id: string; label: string }>;
  events: FamilyEventDef[];
  outcomeRules: MissionOutcomeRules;
  familyEligibility: MissionEligibility;
  ageSpan: [number, number];
  settlementCopy: Record<GenerationOutcome, string>;
}

export interface FamilyOrderState {
  id: string;
  label: string;
  done: boolean;
}

export interface MissionProgressState {
  kind: MissionProgressKind;
  label: string;
  target?: number;
  amount?: number;
  currentStage?: string;
  stages?: string[];
  orders?: FamilyOrderState[];
}

export interface PendingFamilyOption {
  optionId: string;
  text: string;
  preview: string;
  cost: number;
  income: number;
  enabled: boolean;
  disabledReason?: string;
  sourceLabel?: string; // 「用了家里的基础工具」
}

export interface PendingFamilyEvent {
  instanceId: string;
  eventId: string;
  phase: MissionPhase;
  title: string;
  text: string;
  scene: ScenarioKind;
  isFinal: boolean;
  options: PendingFamilyOption[];
}

export interface FamilyActionTaken {
  eventId: string;
  optionId: string;
  optionText: string;
  feedback: string;
  budgetDelta: number;
  abilities: Partial<Record<FamilyAbility, number>>;
  cashIn: string[];
}

export interface FamilyFeedback {
  sourceEventId: string;
  text: string;
  changes: string[];
}

export interface FamilyRunSnapshot {
  funds: number;
  securityLevel: number;
  assetNames: string[];
  educationLevel: number;
  reputationLevel: number;
}

export interface GenerationRun {
  id: string; // 稳定实例 ID
  generation: number;
  memberName: string;
  memberRole: string;
  ageSpan: string;
  era: string;
  snapshot: FamilyRunSnapshot;
  budget: number; // 本代可用预算（含收入）
  allocated: number; // 开局从家庭资金拨出的预算
  spent: number;
  income: number;
  abilities: Record<FamilyAbility, number>;
  missionId: string;
  progress: MissionProgressState;
  eventIndex: number;
  pendingEvent?: PendingFamilyEvent;
  resolvedEventIds: string[];
  actionsTaken: FamilyActionTaken[];
  recentFeedback?: FamilyFeedback;
  flags: string[];
  earnedEvidence: string[];
  grantedAssets: FamilyAccumulation[];
  rngState: number;
  status: 'active' | 'settled';
}

export interface FamilySettlement {
  runId: string;
  generation: number;
  memberName: string;
  memberRole: string;
  outcome: GenerationOutcome;
  missionTitle: string;
  goalResult: string;
  net: { spent: number; income: number; budgetReturned: number; familyFundsAfter: number };
  itemsGained: string[];
  knowledgeGained: string[];
  leftForFamily: string[];
  contributions: ContributionRecord[];
  evidenceAdded: string[];
  summary: string;
  nextMember: { name: string; role: string };
}

export interface FamilySave {
  version: number;
  family: FamilyState | null;
  currentRun: GenerationRun | null;
  lastSettlement: FamilySettlement | null;
  settledRunIds: string[];
  intermissionBuilt: string | null; // 本次局间已完成的一项建设
}

export interface BuildingDef {
  id: string; // 与积累 id 一致，如 'asset:basic-tools'
  category: BuildingCategory;
  level: number;
  name: string;
  cost: number;
  requireAccumulation?: string;
  requireEvidence?: string[]; // 关键资质需要本代实际经历
  benefit: string; // 下一代获得的具体作用
  requirementText: string;
  order: number;
}

export interface BuildingOption {
  id: string;
  category: BuildingCategory;
  name: string;
  cost: number;
  benefit: string;
  available: boolean;
  unavailableReason?: string;
  affordable: boolean;
  intermissionUsed: boolean; // 本次局间已经完成一项建设
}

export function createEmptyFamilySave(): FamilySave {
  return {
    version: FAMILY_SAVE_VERSION,
    family: null,
    currentRun: null,
    lastSettlement: null,
    settledRunIds: [],
    intermissionBuilt: null,
  };
}