import { SceneVisual } from './visualConfig';
import { BuildingCategory, FamilyAbility, GenerationOutcome } from '../../core/familyModel';
export interface VisualReward { icon: 'coin' | 'hammer' | 'book' | 'person' | 'chair' | 'box' | 'home' | 'check' | 'clock'; text: string }

export interface FamilyHomeView {
  familyName: string;
  era: string;
  generationCount: number;
  stage: string;
  stageNote: string;
  funds: number;
  lastContribution: string;
  lastOutcome: string;
  runStatus: 'none' | 'active' | 'settled';
  primaryAction: 'continue' | 'start';
  continueCaption?: string;
  showMember: boolean;
  buildings: FamilyBuildingView[];
  chapterSummary?: { title: string; stage: string; lines: string[]; nextStep: string };
  scene: SceneVisual;
  houseLevel: number;
  assetLevel: number;
  educationLevel: number;
  reputationLevel: number;
}

export interface FamilyBuildingView {
  id: string;
  category: BuildingCategory;
  categoryName: string;
  name: string;
  cost: number;
  benefit: string;
  available: boolean;
  unavailableReason?: string;
  affordable: boolean;
  builtThisIntermission: boolean;
}

export interface FamilyEventOptionView {
  optionId: string;
  text: string;
  preview: string;
  cost: number;
  income: number;
  enabled: boolean;
  disabledReason?: string;
  sourceLabel?: string;
  shortLabel?: string;
  icon?: VisualReward['icon'];
  rewards?: VisualReward[];
}

export interface FamilyEventView {
  visual?: { kind: 'funds' | 'stages' | 'orders'; amount: number; target: number; slots: Array<{ label: string; done: boolean }>; phase: string; stage: string; abilities: { hands: number; talk: number; plan: number }; assets: { security: number; asset: number; education: number; reputation: number } };
  familyName: string;
  generation: number;
  memberName: string;
  memberRole: string;
  era: string;
  ageSpan: string;
  missionTitle: string;
  goalText: string;
  progressLine: string;
  budget: number;
  feedback?: { text: string; changes: string[] };
  instanceId: string;
  phase: string;
  title: string;
  text: string;
  isFinal: boolean;
  options: FamilyEventOptionView[];
  scene: SceneVisual;
}

export interface FamilySettlementView {
  familyName: string;
  generation: number;
  memberName: string;
  memberRole: string;
  era: string;
  outcome: GenerationOutcome;
  outcomeName: string;
  missionTitle: string;
  goalResult: string;
  netSpent: number;
  netIncome: number;
  budgetReturned: number;
  familyFundsAfter: number;
  itemsGained: string[];
  knowledgeGained: string[];
  leftForFamily: string[];
  evidenceAdded: string[];
  summary: string;
  nextMember: string;
  chapterSummary?: { title: string; stage: string; lines: string[]; nextStep: string };
  scene: SceneVisual;
}

export interface FamilyHistoryView {
  familyName: string;
  stage: string;
  generations: Array<{
    generation: number;
    memberName: string;
    memberRole: string;
    ageSpan: string;
    era: string;
    outcome: GenerationOutcome;
    outcomeName: string;
    missionTitle: string;
    summary: string;
    leftForFamily: string[];
    netFunds: number;
  }>;
  accumulations: Array<{ name: string; benefit: string; source: string }>;
  contributions: string[];
  evidence: Array<{ text: string; generation: number }>;
}

export interface FamilyMemberView {
  familyName: string;
  memberName: string;
  memberRole: string;
  ageSpan: string;
  era: string;
  missionTitle: string;
  goalText: string;
  progressLine: string;
  budget: number;
  allocated: number;
  spent: number;
  income: number;
  abilities: Array<{ ability: FamilyAbility; name: string; level: number }>;
  actionsTaken: Array<{ text: string; feedback: string; budgetDelta: number }>;
}
