import {
  BuildingCategory,
  BUILDING_CATEGORIES,
  FamilyAccumulation,
  FamilyEvidence,
  FamilySave,
  FamilyState,
  FamilySettlement,
  GenerationOutcome,
  GenerationRun,
  GenerationSummary,
  GENERATION_OUTCOMES,
  MissionProgressKind,
  MissionProgressState,
  PendingFamilyEvent,
  FAMILY_ABILITIES,
  FAMILY_SAVE_VERSION,
  FamilyAbility,
} from './familyModel';

export const FAMILY_CURRENT_SAVE_KEY = 'reincarnation-life.family.v4';

type UnknownRecord = Record<string, unknown>;

export function parseFamilySave(value: unknown): FamilySave | null {
  if (!isRecord(value) || Math.floor(numberValue(value.version, 0)) !== FAMILY_SAVE_VERSION) return null;
  const family = value.family === null || value.family === undefined ? null : parseFamily(value.family);
  if (value.family !== null && value.family !== undefined && !family) return null;
  const currentRun = value.currentRun === null || value.currentRun === undefined ? null : parseRun(value.currentRun);
  if (value.currentRun !== null && value.currentRun !== undefined && !currentRun) return null;
  const lastSettlement = value.lastSettlement === null || value.lastSettlement === undefined ? null : parseSettlement(value.lastSettlement);
  if (value.lastSettlement !== null && value.lastSettlement !== undefined && !lastSettlement) return null;
  return {
    version: FAMILY_SAVE_VERSION,
    family,
    currentRun,
    lastSettlement,
    settledRunIds: stringArray(value.settledRunIds),
    intermissionBuilt: typeof value.intermissionBuilt === 'string' ? value.intermissionBuilt : null,
  };
}

function parseFamily(value: unknown): FamilyState | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null;
  return {
    version: FAMILY_SAVE_VERSION,
    id: value.id,
    name: value.name,
    era: typeof value.era === 'string' ? value.era : '',
    eraIndex: Math.max(0, Math.floor(numberValue(value.eraIndex, 0))),
    generationCount: Math.max(0, Math.floor(numberValue(value.generationCount, 0))),
    funds: Math.max(0, Math.floor(numberValue(value.funds, 0))),
    accumulations: parseAccumulations(value.accumulations),
    evidence: parseEvidence(value.evidence),
    milestone: value.milestone === 'stable-life' || value.milestone === 'raise' || value.milestone === 'enterprise'
      ? value.milestone
      : 'stable-life',
    history: parseSummaries(value.history),
    contributions: parseContributions(value.contributions),
  };
}

function parseAccumulations(value: unknown): FamilyAccumulation[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((item): FamilyAccumulation[] => {
    const category = parseCategory(item.category);
    if (typeof item.id !== 'string' || !category) return [];
    return [{
      id: item.id,
      category,
      level: clamp(Math.floor(numberValue(item.level, 1)), 1, 2),
      name: typeof item.name === 'string' ? item.name : item.id,
      benefit: typeof item.benefit === 'string' ? item.benefit : '',
      source: parseSource(item.source),
    }];
  });
}

function parseSource(value: unknown): { generation: number; text: string } {
  return {
    generation: isRecord(value) ? Math.max(1, Math.floor(numberValue(value.generation, 1))) : 1,
    text: isRecord(value) && typeof value.text === 'string' ? value.text : '',
  };
}

function parseEvidence(value: unknown): FamilyEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((item): FamilyEvidence[] => {
    if (typeof item.id !== 'string') return [];
    return [{
      id: item.id,
      text: typeof item.text === 'string' ? item.text : item.id,
      generation: Math.max(1, Math.floor(numberValue(item.generation, 1))),
    }];
  });
}

function parseSummaries(value: unknown): GenerationSummary[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((item): GenerationSummary[] => {
    if (typeof item.runId !== 'string') return [];
    const outcome = parseOutcome(item.outcome);
    return [{
      runId: item.runId,
      generation: Math.max(1, Math.floor(numberValue(item.generation, 1))),
      memberName: typeof item.memberName === 'string' ? item.memberName : '',
      memberRole: typeof item.memberRole === 'string' ? item.memberRole : '',
      ageSpan: typeof item.ageSpan === 'string' ? item.ageSpan : '',
      era: typeof item.era === 'string' ? item.era : '',
      outcome,
      missionTitle: typeof item.missionTitle === 'string' ? item.missionTitle : '',
      summary: typeof item.summary === 'string' ? item.summary : '',
      leftForFamily: stringArray(item.leftForFamily),
      netFunds: Math.floor(numberValue(item.netFunds, 0)),
    }];
  });
}

function parseContributions(value: unknown): FamilyState['contributions'] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((item): FamilyState['contributions'][number][] => {
    if (typeof item.id !== 'string' || typeof item.runId !== 'string') return [];
    return [{
      id: item.id,
      generation: Math.max(1, Math.floor(numberValue(item.generation, 1))),
      text: typeof item.text === 'string' ? item.text : '',
      kind: parseCategory(item.kind) ?? 'funds',
      runId: item.runId,
    }];
  });
}

function parseRun(value: unknown): GenerationRun | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.missionId !== 'string') return null;
  const status = value.status === 'settled' || value.status === 'active' ? value.status : 'active';
  const progress = parseProgress(value.progress);
  if (!progress) return null;
  const pendingEvent = value.pendingEvent === null || value.pendingEvent === undefined
    ? undefined
    : parsePendingEvent(value.pendingEvent);
  if (value.pendingEvent !== null && value.pendingEvent !== undefined && !pendingEvent) return null;
  return {
    id: value.id,
    generation: Math.max(1, Math.floor(numberValue(value.generation, 1))),
    memberName: typeof value.memberName === 'string' ? value.memberName : '',
    memberRole: typeof value.memberRole === 'string' ? value.memberRole : '',
    ageSpan: typeof value.ageSpan === 'string' ? value.ageSpan : '',
    era: typeof value.era === 'string' ? value.era : '',
    snapshot: isRecord(value.snapshot) ? {
      funds: Math.max(0, Math.floor(numberValue(value.snapshot.funds, 0))),
      securityLevel: Math.max(0, Math.floor(numberValue(value.snapshot.securityLevel, 0))),
      assetNames: stringArray(value.snapshot.assetNames),
      educationLevel: Math.max(0, Math.floor(numberValue(value.snapshot.educationLevel, 0))),
      reputationLevel: Math.max(0, Math.floor(numberValue(value.snapshot.reputationLevel, 0))),
    } : { funds: 0, securityLevel: 0, assetNames: [], educationLevel: 0, reputationLevel: 0 },
    budget: Math.max(0, Math.floor(numberValue(value.budget, 0))),
    allocated: Math.max(0, Math.floor(numberValue(value.allocated, 0))),
    spent: Math.max(0, Math.floor(numberValue(value.spent, 0))),
    income: Math.max(0, Math.floor(numberValue(value.income, 0))),
    abilities: parseAbilities(value.abilities),
    missionId: value.missionId,
    progress,
    eventIndex: Math.max(0, Math.floor(numberValue(value.eventIndex, 0))),
    pendingEvent: pendingEvent ?? undefined,
    resolvedEventIds: stringArray(value.resolvedEventIds),
    actionsTaken: parseActions(value.actionsTaken),
    recentFeedback: isRecord(value.recentFeedback) && typeof value.recentFeedback.text === 'string'
      ? { sourceEventId: typeof value.recentFeedback.sourceEventId === 'string' ? value.recentFeedback.sourceEventId : '', text: value.recentFeedback.text, changes: stringArray(value.recentFeedback.changes) }
      : undefined,
    flags: stringArray(value.flags),
    earnedEvidence: stringArray(value.earnedEvidence),
    grantedAssets: parseAccumulations(value.grantedAssets),
    rngState: Math.floor(numberValue(value.rngState, 1)),
    status,
  };
}

function parseProgress(value: unknown): MissionProgressState | null {
  if (!isRecord(value)) return null;
  const kind = value.kind === 'funds' || value.kind === 'stages' || value.kind === 'orders' ? value.kind as MissionProgressKind : null;
  if (!kind) return null;
  return {
    kind,
    label: typeof value.label === 'string' ? value.label : '',
    target: value.target === undefined ? undefined : Math.max(0, Math.floor(numberValue(value.target, 0))),
    amount: value.amount === undefined ? undefined : Math.max(0, Math.floor(numberValue(value.amount, 0))),
    currentStage: typeof value.currentStage === 'string' ? value.currentStage : undefined,
    stages: value.stages === undefined ? undefined : stringArray(value.stages),
    orders: value.orders === undefined ? undefined : Array.isArray(value.orders)
      ? value.orders.filter(isRecord).flatMap((o) => {
        if (typeof o.id !== 'string') return [];
        return [{ id: o.id, label: typeof o.label === 'string' ? o.label : o.id, done: o.done === true }];
      })
      : [],
  };
}

function parsePendingEvent(value: unknown): PendingFamilyEvent | null {
  if (!isRecord(value) || typeof value.instanceId !== 'string' || typeof value.eventId !== 'string') return null;
  const options = Array.isArray(value.options)
    ? value.options.filter(isRecord).flatMap((o): PendingFamilyEvent['options'][number][] => {
      if (typeof o.optionId !== 'string' || typeof o.text !== 'string') return [];
      return [{
        optionId: o.optionId,
        text: o.text,
        preview: typeof o.preview === 'string' ? o.preview : '',
        cost: Math.max(0, Math.floor(numberValue(o.cost, 0))),
        income: Math.max(0, Math.floor(numberValue(o.income, 0))),
        enabled: o.enabled !== false,
        disabledReason: typeof o.disabledReason === 'string' ? o.disabledReason : undefined,
        sourceLabel: typeof o.sourceLabel === 'string' ? o.sourceLabel : undefined,
      }];
    })
    : [];
  if (options.length < 2) return null;
  return {
    instanceId: value.instanceId,
    eventId: value.eventId,
    phase: typeof value.phase === 'string' ? value.phase as PendingFamilyEvent['phase'] : 'context',
    title: typeof value.title === 'string' ? value.title : '',
    text: typeof value.text === 'string' ? value.text : '',
    scene: typeof value.scene === 'string' ? value.scene as PendingFamilyEvent['scene'] : 'hearth',
    isFinal: value.isFinal === true,
    options,
  };
}

function parseActions(value: unknown): GenerationRun['actionsTaken'] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((item): GenerationRun['actionsTaken'][number][] => {
    if (typeof item.eventId !== 'string' || typeof item.optionId !== 'string') return [];
    return [{
      eventId: item.eventId,
      optionId: item.optionId,
      optionText: typeof item.optionText === 'string' ? item.optionText : '',
      feedback: typeof item.feedback === 'string' ? item.feedback : '',
      budgetDelta: Math.floor(numberValue(item.budgetDelta, 0)),
      abilities: parsePartialAbilities(item.abilities),
      cashIn: stringArray(item.cashIn),
    }];
  });
}

function parsePartialAbilities(value: unknown): Partial<Record<FamilyAbility, number>> {
  const result: Partial<Record<FamilyAbility, number>> = {};
  if (isRecord(value)) {
    for (const ability of FAMILY_ABILITIES) {
      if (typeof value[ability] === 'number') {
        result[ability] = clamp(Math.floor(numberValue(value[ability], 0)), 0, 6);
      }
    }
  }
  return result;
}

function parseAbilities(value: unknown): Record<FamilyAbility, number> {
  const result: Record<FamilyAbility, number> = { hands: 0, talk: 0, plan: 0 };
  if (isRecord(value)) {
    for (const ability of FAMILY_ABILITIES) {
      result[ability] = clamp(Math.floor(numberValue(value[ability], 0)), 0, 6);
    }
  }
  return result;
}

function parseSettlement(value: unknown): FamilySettlement | null {
  if (!isRecord(value) || typeof value.runId !== 'string') return null;
  return {
    runId: value.runId,
    generation: Math.max(1, Math.floor(numberValue(value.generation, 1))),
    memberName: typeof value.memberName === 'string' ? value.memberName : '',
    memberRole: typeof value.memberRole === 'string' ? value.memberRole : '',
    outcome: parseOutcome(value.outcome),
    missionTitle: typeof value.missionTitle === 'string' ? value.missionTitle : '',
    goalResult: typeof value.goalResult === 'string' ? value.goalResult : '',
    net: isRecord(value.net) ? {
      spent: Math.max(0, Math.floor(numberValue(value.net.spent, 0))),
      income: Math.max(0, Math.floor(numberValue(value.net.income, 0))),
      budgetReturned: Math.max(0, Math.floor(numberValue(value.net.budgetReturned, 0))),
      familyFundsAfter: Math.max(0, Math.floor(numberValue(value.net.familyFundsAfter, 0))),
    } : { spent: 0, income: 0, budgetReturned: 0, familyFundsAfter: 0 },
    itemsGained: stringArray(value.itemsGained),
    knowledgeGained: stringArray(value.knowledgeGained),
    leftForFamily: stringArray(value.leftForFamily),
    contributions: parseContributions(value.contributions),
    evidenceAdded: stringArray(value.evidenceAdded),
    summary: typeof value.summary === 'string' ? value.summary : '',
    nextMember: isRecord(value.nextMember) ? {
      name: typeof value.nextMember.name === 'string' ? value.nextMember.name : '',
      role: typeof value.nextMember.role === 'string' ? value.nextMember.role : '',
    } : { name: '', role: '' },
  };
}

function parseCategory(value: unknown): BuildingCategory | null {
  return BUILDING_CATEGORIES.includes(value as BuildingCategory) ? value as BuildingCategory : null;
}

function parseOutcome(value: unknown): GenerationOutcome {
  return GENERATION_OUTCOMES.includes(value as GenerationOutcome) ? value as GenerationOutcome : 'failed';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is string => typeof item === 'string')))
    : [];
}

function numberValue(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}