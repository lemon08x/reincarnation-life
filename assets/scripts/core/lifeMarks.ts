import {
  FamilyConfig,
  LifeMark,
  MarkChange,
  MarkDef,
  TemperamentConfig,
} from './model';

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

export function createStartingMarks(
  family: FamilyConfig,
  temperament: TemperamentConfig,
  catalog: MarkDef[],
): { marks: LifeMark[]; fragments: string[] } {
  const grants: MarkChange[] = [
    ...(family.grantMarks ?? []),
    ...(temperament.grantMarks ?? []),
  ];
  return applyMarkChanges([], grants, catalog);
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
