import { parseGrowth } from './growthSave';
import {
  ArchiveDiscovery,
  BoundPerson,
  CausalityRecord,
  DiscoverySource,
  ExperienceFragment,
  GameSave,
  LIFE_THEMES,
  LifeClosing,
  LifeMark,
  LifePointEntry,
  LifeRun,
  LifeTheme,
  LifeWorld,
  PendingEncounter,
  PendingOption,
  PendingResult,
  PendingRecall,
  PendingRecallOption,
  ReincarnatorProfile,
  RULES_VERSION,
  SAVE_VERSION,
  ScheduledEncounter,
  Understanding,
  emptyWorld,
} from './model';

export const CURRENT_SAVE_KEY = 'reincarnation-life.save.v3';
export const OBSOLETE_SAVE_KEYS = [
  'reincarnation-life.save.v1',
  'reincarnation-life.save.v2',
  'reincarnation-life.save.backup',
] as const;

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type UnknownRecord = Record<string, unknown>;

export function clearObsoleteSaveKeys(storage: StorageAdapter): string[] {
  const removed: string[] = [];
  for (const key of OBSOLETE_SAVE_KEYS) {
    if (storage.getItem(key) !== null) {
      storage.removeItem(key);
      removed.push(key);
    }
  }
  return removed;
}

export function parseGameSave(value: unknown): GameSave | null {
  if (!isRecord(value) || Math.floor(numberValue(value.version, 0)) !== SAVE_VERSION) {
    return null;
  }
  if (!isRecord(value.profile)) {
    return null;
  }
  const profile = parseProfile(value.profile);
  if (!profile) {
    return null;
  }
  const currentRun = value.currentRun === null || value.currentRun === undefined
    ? null
    : parseLifeRun(value.currentRun);
  if (value.currentRun !== null && value.currentRun !== undefined && !currentRun) {
    return null;
  }
  return {
    version: SAVE_VERSION,
    profile,
    currentRun,
  };
}

function parseProfile(value: UnknownRecord): ReincarnatorProfile | null {
  return {
    version: RULES_VERSION,
    archivedRunIds: stringArray(value.archivedRunIds),
    discoveries: parseDiscoveries(value.discoveries),
    understandings: parseUnderstandings(value.understandings),
    fragments: parseFragments(value.fragments),
    lastClosing: parseClosing(value.lastClosing),
    lastRunId: typeof value.lastRunId === 'string' ? value.lastRunId : undefined,
  };
}

function parseLifeRun(value: unknown): LifeRun | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.familyId !== 'string') {
    return null;
  }
  const lineA = parseTheme(value.lineA);
  const lineB = parseTheme(value.lineB);
  if (!lineA || !lineB) {
    return null;
  }
  const status = value.status === 'awaiting-archive' || value.status === 'settled' || value.status === 'active'
    ? value.status
    : 'active';
  const turnState = value.turnState === 'showing-result' || value.turnState === 'awaiting-recall'
    || value.turnState === 'awaiting-archive'
    || value.turnState === 'settled'
    || value.turnState === 'awaiting-response'
    ? value.turnState
    : 'awaiting-response';
  const pendingEncounter = parsePendingEncounter(value.pendingEncounter);
  const pendingRecall = parsePendingRecall(value.pendingRecall);
  const growth = value.growth === undefined ? undefined : parseGrowth(value.growth);
  if (growth === null || (numberValue(value.rulesVersion, 7) >= 8 && !growth)) return null;
  return {
    growth,
    id: value.id,
    seed: Math.floor(numberValue(value.seed, 1)),
    rngState: Math.floor(numberValue(value.rngState, 1)),
    rulesVersion: Math.floor(numberValue(value.rulesVersion, 6)),
    status,
    turnState,
    age: Math.max(0, Math.floor(numberValue(value.age, 0))),
    familyId: value.familyId,
    temperamentId: typeof value.temperamentId === 'string' ? value.temperamentId : 'quiet',
    tags: stringArray(value.tags),
    marks: parseMarks(value.marks),
    world: parseWorld(value.world),
    lifePoints: clamp(Math.floor(numberValue(value.lifePoints, 2)), 0, 4),
    lifePointCap: growth ? 0 : 4,
    lifePointLog: parsePointLog(value.lifePointLog),
    encounterCount: Math.max(0, Math.floor(numberValue(value.encounterCount, 0))),
    recallCount: Math.max(0, Math.floor(numberValue(value.recallCount, 0))),
    nextEncounterSeq: Math.max(1, Math.floor(numberValue(value.nextEncounterSeq, 1))),
    nextFragmentSeq: Math.max(1, Math.floor(numberValue(value.nextFragmentSeq, 1))),
    nextUnderstandingSeq: Math.max(1, Math.floor(numberValue(value.nextUnderstandingSeq, 1))),
    lineA,
    lineB,
    usedTemplateIds: stringArray(value.usedTemplateIds),
    resolvedEncounterIds: stringArray(value.resolvedEncounterIds),
    resolvedRecallIds: stringArray(value.resolvedRecallIds),
    fragments: parseFragments(value.fragments),
    understandings: parseUnderstandings(value.understandings),
    carriedUnderstandingIds: stringArray(value.carriedUnderstandingIds),
    scheduled: parseScheduled(value.scheduled),
    pendingEncounter,
    pendingRecall,
    pendingResult: parseResult(value.pendingResult),
    recentFeedback: isRecord(value.recentFeedback) && typeof value.recentFeedback.sourceId === 'string' && typeof value.recentFeedback.text === 'string'
      ? { sourceId: value.recentFeedback.sourceId, text: value.recentFeedback.text, changes: stringArray(value.recentFeedback.changes) } : undefined,
    closing: parseClosing(value.closing),
    skippedYearNotes: stringArray(value.skippedYearNotes),
  };
}

function parsePendingEncounter(value: unknown): PendingEncounter | undefined {
  if (!isRecord(value) || typeof value.instanceId !== 'string' || typeof value.templateId !== 'string') {
    return undefined;
  }
  const theme = parseTheme(value.theme);
  if (!theme) {
    return undefined;
  }
  const options = Array.isArray(value.options)
    ? value.options.filter(isRecord).flatMap((option): PendingOption[] => {
      if (typeof option.choiceId !== 'string' || typeof option.text !== 'string') {
        return [];
      }
      const costKind = option.costKind === 'break-habit' || option.costKind === 'pursue-opportunity'
        ? option.costKind
        : 'free';
      return [{
        choiceId: option.choiceId,
        text: option.text,
        preview: typeof option.preview === 'string' ? option.preview : '',
        cost: Math.max(0, Math.floor(numberValue(option.cost, 0))),
        costKind,
        supportReason: typeof option.supportReason === 'string' ? option.supportReason : undefined,
        supportedByFragmentIds: stringArray(option.supportedByFragmentIds),
        enabled: option.enabled !== false,
        disabledReason: typeof option.disabledReason === 'string' ? option.disabledReason : undefined,
      }];
    })
    : [];
  if (options.length < 2) {
    return undefined;
  }
  return {
    instanceId: value.instanceId,
    templateId: value.templateId,
    age: Math.max(0, Math.floor(numberValue(value.age, 0))),
    text: typeof value.text === 'string' ? value.text : '',
    title: typeof value.title === 'string' ? value.title : '',
    sceneKind: typeof value.sceneKind === 'string' ? value.sceneKind as PendingEncounter['sceneKind'] : 'hearth',
    theme,
    triggerKind: parseTrigger(value.triggerKind),
    triggerNote: typeof value.triggerNote === 'string' ? value.triggerNote : '',
    triggerSourceIds: stringArray(value.triggerSourceIds),
    boundPeople: parsePeople(value.boundPeople),
    recalledFragmentIds: stringArray(value.recalledFragmentIds),
    recalledNotes: stringArray(value.recalledNotes),
    options,
    rngState: Math.floor(numberValue(value.rngState, 1)),
  };
}

function parsePendingRecall(value: unknown): PendingRecall | undefined {
  if (!isRecord(value) || typeof value.instanceId !== 'string' || typeof value.seedId !== 'string') {
    return undefined;
  }
  const options = Array.isArray(value.options)
    ? value.options.filter(isRecord).flatMap((option): PendingRecallOption[] => {
      if (option.stance !== 'hold' && option.stance !== 'revise' && option.stance !== 'question') {
        return [];
      }
      return [{
        stance: option.stance,
        specialtyId: typeof option.specialtyId === 'string' ? option.specialtyId : undefined,
        label: typeof option.label === 'string' ? option.label : option.stance,
        statement: typeof option.statement === 'string' ? option.statement : '',
        effectHint: typeof option.effectHint === 'string' ? option.effectHint : undefined,
      }];
    })
    : [];
  if (options.length < 2) {
    return undefined;
  }
  return {
    instanceId: value.instanceId,
    recallIndex: numberValue(value.recallIndex, 1) >= 2 ? 2 : 1,
    fragmentIds: stringArray(value.fragmentIds),
    seedId: value.seedId,
    existingUnderstandingId: typeof value.existingUnderstandingId === 'string'
      ? value.existingUnderstandingId
      : undefined,
    prompt: typeof value.prompt === 'string' ? value.prompt : '',
    options,
  };
}

function parseFragments(value: unknown): ExperienceFragment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).flatMap((item): ExperienceFragment[] => {
    const theme = parseTheme(item.theme);
    if (typeof item.id !== 'string' || typeof item.runId !== 'string' || !theme) {
      return [];
    }
    return [{
      id: item.id,
      contentKey: typeof item.contentKey === 'string' ? item.contentKey : item.id,
      runId: item.runId,
      age: Math.max(0, Math.floor(numberValue(item.age, 0))),
      encounterInstanceId: typeof item.encounterInstanceId === 'string' ? item.encounterInstanceId : item.id,
      templateId: typeof item.templateId === 'string' ? item.templateId : '',
      theme,
      people: parsePeople(item.people),
      whatHappened: typeof item.whatHappened === 'string' ? item.whatHappened : '',
      howIResponded: typeof item.howIResponded === 'string' ? item.howIResponded : '',
      choiceId: typeof item.choiceId === 'string' ? item.choiceId : '',
      outcomeId: typeof item.outcomeId === 'string' ? item.outcomeId : '',
      costPaid: Math.max(0, Math.floor(numberValue(item.costPaid, 0))),
      fragmentTags: stringArray(item.fragmentTags),
      recalledFragmentIds: stringArray(item.recalledFragmentIds),
      understandingAtTime: typeof item.understandingAtTime === 'string' ? item.understandingAtTime : undefined,
      understandingId: typeof item.understandingId === 'string' ? item.understandingId : undefined,
      laterWhat: stringArray(item.laterWhat),
      triggerKind: parseTrigger(item.triggerKind),
      triggerNote: typeof item.triggerNote === 'string' ? item.triggerNote : '',
      triggerSourceIds: stringArray(item.triggerSourceIds),
      worldChanges: stringArray(item.worldChanges),
    }];
  });
}

function parseUnderstandings(value: unknown): Understanding[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).flatMap((item): Understanding[] => {
    const theme = parseTheme(item.theme);
    if (typeof item.id !== 'string' || !theme || typeof item.statement !== 'string') {
      return [];
    }
    const stance = item.stance === 'revise' || item.stance === 'question' || item.stance === 'hold'
      ? item.stance
      : 'hold';
    return [{
      id: item.id,
      contentKey: typeof item.contentKey === 'string' ? item.contentKey : item.id,
      theme,
      statement: item.statement,
      stance,
      effectiveStance: item.effectiveStance === 'revise' || item.effectiveStance === 'question' ? item.effectiveStance : stance,
      version: Math.max(1, Math.floor(numberValue(item.version, 1))),
      previousVersionId: typeof item.previousVersionId === 'string' ? item.previousVersionId : undefined,
      sourceFragmentIds: stringArray(item.sourceFragmentIds),
      createdInRunId: typeof item.createdInRunId === 'string' ? item.createdInRunId : '',
      createdAtAge: Math.max(0, Math.floor(numberValue(item.createdAtAge, 0))),
    }];
  });
}

function parseDiscoveries(value: unknown): ArchiveDiscovery[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).flatMap((item): ArchiveDiscovery[] => {
    if (typeof item.contentKey !== 'string') {
      return [];
    }
    const sources = Array.isArray(item.sources)
      ? item.sources.filter(isRecord).flatMap((source): DiscoverySource[] => {
        if (typeof source.runId !== 'string' || typeof source.fragmentId !== 'string') {
          return [];
        }
        return [{
          runId: source.runId,
          fragmentId: source.fragmentId,
          understandingId: typeof source.understandingId === 'string' ? source.understandingId : undefined,
          personLabels: stringArray(source.personLabels),
          age: Math.max(0, Math.floor(numberValue(source.age, 0))),
        }];
      })
      : [];
    return [{
      contentKey: item.contentKey,
      title: typeof item.title === 'string' ? item.title : item.contentKey,
      latestStatement: typeof item.latestStatement === 'string' ? item.latestStatement : '',
      variantStatements: stringArray(item.variantStatements),
      sources,
    }];
  });
}

function parseScheduled(value: unknown): ScheduledEncounter[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).flatMap((item): ScheduledEncounter[] => {
    if (typeof item.templateId !== 'string' || typeof item.sourceEncounterInstanceId !== 'string') {
      return [];
    }
    return [{
      templateId: item.templateId,
      earliestAge: Math.max(0, Math.floor(numberValue(item.earliestAge, 0))),
      latestAge: Math.max(0, Math.floor(numberValue(item.latestAge, 0))),
      sourceEncounterInstanceId: item.sourceEncounterInstanceId,
      sourceFragmentId: typeof item.sourceFragmentId === 'string' ? item.sourceFragmentId : '',
      note: typeof item.note === 'string' ? item.note : '',
    }];
  });
}

function parseWorld(value: unknown): LifeWorld {
  if (!isRecord(value)) {
    return emptyWorld();
  }
  const facts: LifeWorld['facts'] = {};
  if (isRecord(value.facts)) {
    for (const [key, fact] of Object.entries(value.facts)) {
      if (isRecord(fact) && typeof fact.value === 'string') {
        facts[key] = {
          value: fact.value,
          sinceAge: Math.max(0, Math.floor(numberValue(fact.sinceAge, 0))),
        };
      }
    }
  }
  const relations = Array.isArray(value.relations)
    ? value.relations.filter(isRecord).flatMap((relation) => {
      if (typeof relation.id !== 'string') {
        return [];
      }
      return [{
        id: relation.id,
        kind: typeof relation.kind === 'string' ? relation.kind as LifeWorld['relations'][number]['kind'] : 'community' as const,
        label: typeof relation.label === 'string' ? relation.label : relation.id,
        closeness: clamp(numberValue(relation.closeness, 4), 0, 10),
        strain: clamp(numberValue(relation.strain, 0), 0, 10),
        sinceAge: Math.max(0, Math.floor(numberValue(relation.sinceAge, 0))),
        lastTouchedAge: Math.max(0, Math.floor(numberValue(relation.lastTouchedAge, 0))),
      }];
    })
    : [];
  const threads = Array.isArray(value.threads)
    ? value.threads.filter(isRecord).flatMap((thread) => {
      if (typeof thread.id !== 'string' || typeof thread.domain !== 'string') {
        return [];
      }
      return [{
        id: thread.id,
        domain: thread.domain as LifeWorld['threads'][number]['domain'],
        label: typeof thread.label === 'string' ? thread.label : thread.id,
        intensity: clamp(numberValue(thread.intensity, 2), 0, 10),
        sinceAge: Math.max(0, Math.floor(numberValue(thread.sinceAge, 0))),
        lastEventAge: Math.max(0, Math.floor(numberValue(thread.lastEventAge, 0))),
      }];
    })
    : [];
  return { facts, relations, threads };
}

function parseMarks(value: unknown): LifeMark[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).flatMap((item): LifeMark[] => {
    if (typeof item.id !== 'string') {
      return [];
    }
    return [{ id: item.id, intensity: clamp(numberValue(item.intensity, 1), 1, 3) }];
  });
}

function parsePointLog(value: unknown): LifePointEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).flatMap((item): LifePointEntry[] => {
    const reason = item.reason === 'recall' || item.reason === 'spend' || item.reason === 'start'
      ? item.reason
      : 'start';
    return [{
      age: Math.max(0, Math.floor(numberValue(item.age, 0))),
      reason,
      amount: Math.floor(numberValue(item.amount, 0)),
      balance: Math.max(0, Math.floor(numberValue(item.balance, 0))),
      encounterInstanceId: typeof item.encounterInstanceId === 'string' ? item.encounterInstanceId : undefined,
      note: typeof item.note === 'string' ? item.note : '',
    }];
  });
}

function parsePeople(value: unknown): BoundPerson[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).flatMap((item): BoundPerson[] => {
    if (typeof item.role !== 'string' || typeof item.relationId !== 'string') {
      return [];
    }
    return [{
      role: item.role,
      relationId: item.relationId,
      label: typeof item.label === 'string' ? item.label : item.relationId,
    }];
  });
}

function parseClosing(value: unknown): LifeClosing | undefined {
  if (!isRecord(value) || typeof value.title !== 'string') {
    return undefined;
  }
  return {
    title: value.title,
    text: typeof value.text === 'string' ? value.text : '',
    shapedBy: stringArray(value.shapedBy),
    changed: stringArray(value.changed),
    unresolved: stringArray(value.unresolved),
    unfulfilled: stringArray(value.unfulfilled),
  };
}

function parseTheme(value: unknown): LifeTheme | null {
  return LIFE_THEMES.includes(value as LifeTheme) ? value as LifeTheme : null;
}

function parseTrigger(value: unknown): PendingEncounter['triggerKind'] {
  return value === 'family' || value === 'era' || value === 'chance' || value === 'consequence' || value === 'thread-conflict'
    ? value
    : 'chance';
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

export function emptyCausalityFallback(id: string): CausalityRecord {
  return {
    id,
    kind: 'fragment',
    title: '未找到这段记录',
    happened: '这段经历已经不在当前档案里。',
    later: [],
    people: [],
    trigger: { kind: 'chance', note: '' },
    evoked: [],
    sources: [],
  };
}

function parseResult(value: unknown): PendingResult | undefined {
  if (!isRecord(value) || typeof value.instanceId !== 'string' || typeof value.fragmentId !== 'string') return undefined;
  return { instanceId: value.instanceId, fragmentId: value.fragmentId,
    title: typeof value.title === 'string' ? value.title : '这次回应之后',
    response: typeof value.response === 'string' ? value.response : '',
    outcome: typeof value.outcome === 'string' ? value.outcome : '',
    consequence: typeof value.consequence === 'string' ? value.consequence : '',
    changes: stringArray(value.changes), costPaid: Math.max(0, numberValue(value.costPaid, 0)),
    sceneKind: typeof value.sceneKind === 'string' ? value.sceneKind as PendingResult['sceneKind'] : 'hearth',
  };
}
