import {
  EventOutcomeConfig,
  FamilyConfig,
  LifeEventConfig,
  LifeMark,
  MarkChange,
  MarkDef,
  STAT_KEYS,
  StatDelta,
  Stats,
  TalentConfig,
} from './model';
import { getEventDomains } from './lifeWorld';

const MAX_INTENSITY = 3;

export function getMarkDef(id: string, catalog: MarkDef[]): MarkDef | undefined {
  return catalog.find((item) => item.id === id);
}

export function markIntensity(marks: LifeMark[], id: string): number {
  return marks.find((item) => item.id === id)?.intensity ?? 0;
}

export function markName(mark: LifeMark, catalog: MarkDef[]): string {
  const def = getMarkDef(mark.id, catalog);
  if (!def) {
    return mark.id;
  }
  return def.ranks[clamp(mark.intensity, 1, MAX_INTENSITY) - 1];
}

export function formatMarkList(marks: LifeMark[], catalog: MarkDef[]): string {
  if (marks.length === 0) {
    return '尚无留下的光环或行囊';
  }
  const auras = marks.filter((item) => getMarkDef(item.id, catalog)?.nature !== 'burden');
  const burdens = marks.filter((item) => getMarkDef(item.id, catalog)?.nature === 'burden');
  const parts = [...auras, ...burdens].map((item) => markName(item, catalog));
  return parts.slice(0, 6).join(' · ');
}

export function formatMarkPreview(changes: MarkChange[] | undefined, catalog: MarkDef[]): string {
  if (!changes || changes.length === 0) {
    return '';
  }
  return changes.map((change) => {
    const def = getMarkDef(change.id, catalog);
    const label = def?.ranks[1] ?? change.id;
    if (change.remove) {
      return `${label}消散`;
    }
    if ((change.intensityDelta ?? 0) < 0) {
      return `${label}淡了`;
    }
    const nature = def?.nature === 'burden' ? '负累' : def?.nature === 'possession' ? '行囊' : '光环';
    return `${nature}「${label}」`;
  }).filter(Boolean).slice(0, 3).join('　');
}

export function applyMarkChanges(
  marks: LifeMark[],
  changes: MarkChange[],
  catalog: MarkDef[],
): { marks: LifeMark[]; fragments: string[] } {
  let next = [...marks];
  const fragments: string[] = [];
  for (const change of changes) {
    const def = getMarkDef(change.id, catalog);
    if (!def) {
      continue;
    }
    const index = next.findIndex((item) => item.id === change.id);
    const current = index >= 0 ? next[index] : undefined;
    if (change.remove) {
      if (current) {
        fragments.push(`「${markName(current, catalog)}」消散了`);
        next = next.filter((item) => item.id !== change.id);
      }
      continue;
    }
    const intensity = clamp(
      change.intensity ?? ((current?.intensity ?? 0) + (change.intensityDelta ?? 1)),
      0,
      MAX_INTENSITY,
    );
    if (intensity <= 0) {
      if (current) {
        fragments.push(`「${markName(current, catalog)}」散去了`);
        next = next.filter((item) => item.id !== change.id);
      }
      continue;
    }
    const updated: LifeMark = { id: change.id, intensity };
    if (!current) {
      next = [...next, updated];
      fragments.push(`你带上了${natureWord(def.nature)}「${markName(updated, catalog)}」`);
    } else if (updated.intensity > current.intensity) {
      next[index] = updated;
      fragments.push(`「${markName(updated, catalog)}」更明显了`);
    } else if (updated.intensity < current.intensity) {
      next[index] = updated;
      fragments.push(`「${markName(updated, catalog)}」淡了一些`);
    }
  }
  return { marks: next, fragments: unique(fragments).slice(0, 4) };
}

export function inferMarkChanges(delta: StatDelta, allowMinor: boolean): MarkChange[] {
  const changes: MarkChange[] = [];
  pushSlotChange(changes, delta.health, allowMinor, 'vitality', 'wear');
  pushSlotChange(changes, delta.intellect, allowMinor, 'clarity', undefined);
  pushSlotChange(changes, delta.charm, allowMinor, 'presence', 'isolation');
  pushSlotChange(changes, delta.wealth, allowMinor, 'means', 'want');
  return changes;
}

export function createStartingMarks(
  family: FamilyConfig,
  talents: TalentConfig[],
  openingReserve: number,
  catalog: MarkDef[],
): { marks: LifeMark[]; fragments: string[] } {
  const grants: MarkChange[] = [
    ...(family.grantMarks ?? inferMarkChanges(family.effects, true)),
    ...talents.flatMap((talent) => talent.grantMarks ?? inferMarkChanges(talent.effects, true)),
  ];
  if (openingReserve > 0) {
    grants.push({ id: 'opening', intensity: clamp(openingReserve, 1, MAX_INTENSITY) });
  }
  return applyMarkChanges([], grants, catalog);
}

export function statsFromMarks(marks: LifeMark[]): Stats {
  const vitality = markIntensity(marks, 'vitality');
  const wear = markIntensity(marks, 'wear');
  const sturdy = markIntensity(marks, 'sturdy');
  const clarity = markIntensity(marks, 'clarity');
  const presence = markIntensity(marks, 'presence');
  const isolation = markIntensity(marks, 'isolation');
  const means = markIntensity(marks, 'means');
  const want = markIntensity(marks, 'want');
  const savings = markIntensity(marks, 'savings');
  const job = markIntensity(marks, 'job');
  const tools = markIntensity(marks, 'tools');
  const opening = markIntensity(marks, 'opening');
  const lucky = markIntensity(marks, 'lucky');
  return {
    health: clamp(12 + vitality * 4 + sturdy * 3 - wear * 4, 0, 30),
    intellect: clamp(6 + clarity * 5, 0, 30),
    charm: clamp(6 + presence * 5 - isolation * 3, 0, 30),
    wealth: clamp(6 + means * 4 + savings * 3 + job * 2 + tools * 2 + opening * 3 + lucky - want * 3, 0, 30),
  };
}

export function bodyCollapsed(marks: LifeMark[]): boolean {
  return markIntensity(marks, 'wear') >= 3
    && markIntensity(marks, 'vitality') <= 0
    && markIntensity(marks, 'sturdy') <= 0;
}

export function getMortalityChanceFromMarks(age: number, marks: LifeMark[], catalog: MarkDef[]): number {
  if (age >= 100) {
    return 1;
  }
  let baseChance = 0.0002;
  if (age >= 90) {
    baseChance = 0.22;
  } else if (age >= 80) {
    baseChance = 0.1;
  } else if (age >= 70) {
    baseChance = 0.04;
  } else if (age >= 60) {
    baseChance = 0.015;
  } else if (age >= 50) {
    baseChance = 0.005;
  } else if (age >= 30) {
    baseChance = 0.001;
  }
  const markShift = marks.reduce((sum, mark) => {
    const def = getMarkDef(mark.id, catalog);
    return sum + (def?.mortality ?? 0) * mark.intensity;
  }, 0);
  return Math.min(0.95, Math.max(0, baseChance + markShift));
}

export function markEventMultiplier(
  marks: LifeMark[],
  event: LifeEventConfig,
  catalog: MarkDef[],
): number {
  const domains = getEventDomains(event);
  if (domains.length === 0 || marks.length === 0) {
    return 1;
  }
  let bonus = 0;
  for (const mark of marks) {
    const def = getMarkDef(mark.id, catalog);
    const overlap = def?.boostDomains?.filter((domain) => domains.includes(domain)).length ?? 0;
    if (overlap > 0) {
      bonus += overlap * mark.intensity * 0.12;
    }
  }
  return 1 + bonus;
}

export function markOutcomeMultiplier(
  marks: LifeMark[],
  outcome: EventOutcomeConfig,
  catalog: MarkDef[],
): number {
  const net = STAT_KEYS.reduce((sum, key) => sum + (outcome.effects?.[key] ?? 0), 0);
  if (net === 0 || marks.length === 0) {
    return 1;
  }
  const kind = net > 0;
  const shift = marks.reduce((sum, mark) => {
    const def = getMarkDef(mark.id, catalog);
    if (!def) {
      return sum;
    }
    const bias = kind ? def.kindBias : def.harshBias;
    return sum + (bias ?? 0) * mark.intensity;
  }, 0);
  return Math.max(0.15, 1 + shift);
}

export function matchesRequiredMarks(
  marks: LifeMark[],
  required: Record<string, number> | undefined,
): boolean {
  if (!required) {
    return true;
  }
  return Object.entries(required).every(([id, minimum]) => markIntensity(marks, id) >= minimum);
}

export function mitigateBurdenChanges(
  changes: MarkChange[],
  catalog: MarkDef[],
): MarkChange[] {
  return changes.map((change) => {
    const def = getMarkDef(change.id, catalog);
    if (!def || def.nature !== 'burden' || (change.intensityDelta ?? 0) <= 0) {
      return change;
    }
    return { ...change, intensityDelta: (change.intensityDelta ?? 1) - 1 };
  });
}

export function agingMarkChanges(age: number): MarkChange[] {
  return age >= 50 && age % 5 === 0 ? [{ id: 'wear', intensityDelta: 1 }] : [];
}

function pushSlotChange(
  changes: MarkChange[],
  value: number | undefined,
  allowMinor: boolean,
  positiveId: string,
  negativeId: string | undefined,
): void {
  if (!value) {
    return;
  }
  const steps = Math.abs(value) >= 4 ? 2 : 1;
  const minor = Math.abs(value) === 1;
  if (minor && !allowMinor) {
    return;
  }
  if (value > 0) {
    changes.push({ id: positiveId, intensityDelta: steps });
    if (negativeId) {
      changes.push({ id: negativeId, intensityDelta: -steps });
    }
    return;
  }
  if (negativeId) {
    changes.push({ id: negativeId, intensityDelta: steps });
  }
  changes.push({ id: positiveId, intensityDelta: -steps });
}

function natureWord(nature: MarkDef['nature']): string {
  if (nature === 'possession') {
    return '行囊';
  }
  if (nature === 'burden') {
    return '负累';
  }
  return '光环';
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
