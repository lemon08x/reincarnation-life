import { ABILITIES, GrowthState, SKILL_NAMES } from './growthModel';
import { SPECIALTIES } from '../content/growthContent';

type RecordValue = Record<string, unknown>;
const record = (v: unknown): v is RecordValue => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): boolean => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const place = (v: unknown): boolean => v === 'town' || v === 'harbor' || v === 'market';
const ability = (v: unknown): boolean => ABILITIES.includes(v as typeof ABILITIES[number]);
const gains = (v: unknown): boolean => record(v) && Object.entries(v).every(([k, n]) => ability(k) && integer(n, 0, 6));

// Growth saves are rejected, not silently reset, if their gameplay state is incomplete.
export function parseGrowth(value: unknown): GrowthState | null {
  if (!record(value) || !record(value.abilities) || !ABILITIES.every(a => integer((value.abilities as RecordValue)[a], 0, 6))
    || !integer(value.money) || !strings(value.skills) || !value.skills.every(s => Boolean(SKILL_NAMES[s]))
    || !place(value.place) || typeof value.identity !== 'string'
    || !['learn', 'earn', 'explore'].includes(value.intention as string) || !strings(value.achievements)
    || !Array.isArray(value.specialties) || value.specialties.length > 2 || !Array.isArray(value.records) || !Array.isArray(value.transitions)) return null;
  if (value.goal !== undefined && (!record(value.goal) || typeof value.goal.id !== 'string' || typeof value.goal.title !== 'string'
    || !ability(value.goal.approach) || !['active', 'complete'].includes(value.goal.status as string)
    || (value.goal.result !== undefined && typeof value.goal.result !== 'string'))) return null;
  for (const s of value.specialties) {
    if (!record(s) || !SPECIALTIES.some(d => d.id === s.id && d.ability === s.ability) || typeof s.name !== 'string'
      || typeof s.understandingId !== 'string' || !strings(s.sourceFragmentIds) || !s.sourceFragmentIds.length) return null;
  }
  if (new Set(value.specialties.map(s => (s as RecordValue).id)).size !== value.specialties.length) return null;
  for (const r of value.records) {
    if (!record(r) || typeof r.fragmentId !== 'string' || !gains(r.abilities) || !strings(r.learned)
      || !r.learned.every(s => Boolean(SKILL_NAMES[s])) || !integer(r.money, -Number.MAX_SAFE_INTEGER)
      || typeof r.note !== 'string' || (r.usedAbility !== undefined && !ability(r.usedAbility))
      || (r.usedSpecialtyId !== undefined && !SPECIALTIES.some(s => s.id === r.usedSpecialtyId))) return null;
  }
  for (const t of value.transitions) if (!record(t) || typeof t.fragmentId !== 'string' || !place(t.from) || !place(t.to) || typeof t.identity !== 'string') return null;
  return value as unknown as GrowthState;
}
