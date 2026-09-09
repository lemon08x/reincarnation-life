import { GameService, SaveStore } from '../assets/scripts/app/gameService';
import { presentEncounter, presentGrowthHud, presentJournal, presentRecall, presentResult } from '../assets/scripts/app/presentation/presenters';
import { GAME_CONTENT } from '../assets/scripts/content/gameContent';
import { payoffScene, scenesFor, validateGrowthContent } from '../assets/scripts/content/growthContent';
import { ABILITIES, GROWTH_AGES } from '../assets/scripts/core/growthModel';
import { growthOpportunityWeight } from '../assets/scripts/core/growthEngine';
import { startLife, submitResponse, submitRecall, continueAfterResult, completeArchive, getCausality, listCarryCandidates, causalityHasCycle } from '../assets/scripts/core/lifeEngine';
import { startLife as startLegacy } from '../assets/scripts/core/legacyLifeEngine';
import { createInitialProfile, GameSave, LifeRun } from '../assets/scripts/core/model';
import { parseGameSave } from '../assets/scripts/core/saveMigration';

const cases: Array<{ name: string; run: () => void }> = [];
const test = (name: string, run: () => void): void => { cases.push({ name, run }); };
function assert(v: unknown, message: string): asserts v { if (!v) throw new Error(message); }
function canonical(v: unknown): string { return JSON.stringify(v, (_key, x: unknown) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x); }
const eq = (a: unknown, b: unknown, message: string): void => assert(canonical(a) === canonical(b), message);
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
function rejects(action: () => void): void { let threw = false; try { action(); } catch { threw = true; } assert(threw, 'expected rejection'); }
const start = (seed: number): LifeRun => startLife(createInitialProfile(), seed, `growth-${seed}`, [], GAME_CONTENT);
function step(r: LifeRun, style = 0): LifeRun {
  if (r.pendingResult) return continueAfterResult(r, r.pendingResult.instanceId, GAME_CONTENT);
  if (r.pendingRecall) return submitRecall(r, r.pendingRecall.instanceId, r.pendingRecall.options[style % r.pendingRecall.options.length].stance, GAME_CONTENT);
  const p = r.pendingEncounter!;
  const options = p.options.filter(o => o.enabled);
  const option = style === 0 ? options[0] : style === 1 ? options[options.length - 1] : options[(r.seed + r.encounterCount) % options.length];
  return submitResponse(r, p.instanceId, option.choiceId, GAME_CONTENT);
}
function until(r: LifeRun, predicate: (r: LifeRun) => boolean, style = 0): LifeRun {
  for (let i = 0; i < 35; i++) { if (predicate(r)) return r; assert(r.status === 'active', 'life ended before target'); r = step(r, style); }
  throw new Error('progress guard');
}
const end = (r: LifeRun, style = 0): LifeRun => until(r, x => x.status !== 'active', style);
class Store implements SaveStore {
  value: GameSave | null = null;
  load(): GameSave | null { return clone(this.value); }
  save(v: GameSave): void { this.value = clone(v); }
}

test('growth content and all generated contexts provide an affordable fallback', () => {
  eq(validateGrowthContent(), [], 'content');
  const base = start(1).growth!;
  for (const place of ['town', 'harbor', 'market'] as const) for (let i = 0; i < 12; i++) {
    const g = { ...base, place, money: 0 };
    const candidates = scenesFor(g, i);
    assert(candidates.length > 0, `${place}/${i} needs content`);
    for (const s of candidates) assert(s.choices.some(c => !c.cost && !c.ability && !c.specialtyId), `${s.id} needs a fallback`);
  }
});

test('1500 complete lives: growth persists, three payoffs, two sourced specialties, no soft locks', () => {
  const places = new Set<string>(); const seen = new Set<string>(); const methods = new Set<string>();
  let turns = 0; let transfers = 0;
  for (let seed = 1; seed <= 500; seed++) for (let style = 0; style < 3; style++) {
    let r = start(seed); let results = 0; let offeredPayoffs = 0;
    for (let guard = 0; guard < 30 && r.status === 'active'; guard++) {
      const previous = clone(r.growth!);
      if (r.pendingEncounter) {
        const p = r.pendingEncounter; seen.add(p.templateId); places.add(r.growth!.place);
        eq(p.age, GROWTH_AGES[r.encounterCount], 'ages follow moments');
        assert(p.options.some(o => o.enabled && !o.cost), 'always free progress');
        assert(!/\{\w+\}/.test(p.text), 'bound text');
        if ([3, 6, 9].includes(r.encounterCount)) {
          const offered = p.options.filter(o => o.enabled && o.choiceId.startsWith('specialty:'));
          eq(offered.length, r.growth!.specialties.length, 'each learned specialty can be used'); offeredPayoffs++;
          for (const o of offered) for (const id of o.supportedByFragmentIds) assert(getCausality(r, createInitialProfile(), id), 'support resolves');
        }
        if (r.encounterCount === 5) turns++;
        presentEncounter(r, GAME_CONTENT, null);
      }
      if (r.pendingRecall) {
        assert(r.pendingRecall.options.length >= 2, 'at least two sourced methods'); presentRecall(r, null);
        for (const id of r.pendingRecall.fragmentIds) assert(r.fragments.some(f => f.id === id && f.runId === r.id), 'own evidence');
      }
      if (r.pendingResult) { results++; assert(presentResult(r).changes?.length || r.encounterCount === 12, 'growth visible'); }
      r = step(r, style);
      const g = r.growth!;
      for (const a of ABILITIES) assert(g.abilities[a] >= previous.abilities[a] && g.abilities[a] <= 6, 'persistent ability');
      for (const skill of previous.skills) assert(g.skills.includes(skill), 'skills survive changes');
      if (g.place !== previous.place) transfers++;
      eq(g.money, 2 + g.records.reduce((n, x) => n + x.money, 0), 'resource ledger exact');
      assert(g.money >= 0, 'no overspending');
      for (const s of g.specialties) methods.add(s.id);
    }
    eq(r.status, 'awaiting-archive', 'complete life'); eq(results, 12, 'visible results'); eq(offeredPayoffs, 3, 'payoff rhythm');
    eq(r.recallCount, 2, 'two recalls'); eq(r.growth!.specialties.length, 2, 'two specialties');
    assert(r.growth!.goal?.status === 'complete', 'goal fulfilled'); assert(r.growth!.achievements.length >= 2, 'actual harvest');
    assert(!causalityHasCycle(r, createInitialProfile()), 'acyclic sources');
  }
  eq(places.size, 3, 'all places'); eq(methods.size, 9, 'all specialties');
  assert(transfers > 300 && turns === 1500, 'opportunities and transitions reached');
  console.log(`  1500 lives; ${seen.size} scenes; ${methods.size} specialties; ${transfers} place changes`);
});

test('identical childhood does not decide career; preparations affect chances without locking routes', () => {
  const careers = new Set<string>(); const routes = new Set<string>();
  for (let seed = 1; seed <= 90; seed++) {
    let r = start(seed);
    r = submitResponse(r, r.pendingEncounter!.instanceId, 'repair', GAME_CONTENT);
    eq(r.growth!.abilities, { hands: 1, talk: 0, plan: 0 }, 'same childhood ability');
    r = continueAfterResult(r, r.pendingResult!.instanceId, GAME_CONTENT);
    r = submitResponse(r, r.pendingEncounter!.instanceId, 'accept', GAME_CONTENT);
    careers.add(r.growth!.identity); routes.add(r.growth!.place);
  }
  eq(careers.size, 3, 'same choice opens different lives'); eq(routes.size, 3, 'different locations');
  const g = start(1).growth!;
  const options = scenesFor(g, 5);
  assert(options.every(s => growthOpportunityWeight(s, { ...g, intention: 'explore' }) > 0), 'all routes retain weight');
  const harbor = options.find(s => s.opportunity === 'harbor')!;
  assert(growthOpportunityWeight(harbor, { ...g, intention: 'explore' }) > growthOpportunityWeight(harbor, g), 'preparation changes opportunity');
});

test('moving retains learning and enables a concrete use of an old skill in a new context', () => {
  const original = until(start(2), r => r.encounterCount === 5 && Boolean(r.pendingEncounter));
  let moved: LifeRun | undefined;
  for (let seed = 1; seed < 90 && !moved; seed++) {
    const r = until(start(seed), x => x.encounterCount === 5 && Boolean(x.pendingEncounter));
    const next = submitResponse(r, r.pendingEncounter!.instanceId, 'accept', GAME_CONTENT);
    if (next.growth!.place !== r.growth!.place) {
      eq(next.growth!.skills.filter(s => r.growth!.skills.includes(s)), r.growth!.skills, 'retains skills'); moved = next;
      for (const a of ABILITIES) assert(next.growth!.abilities[a] >= r.growth!.abilities[a], 'retains ability');
    }
  }
  assert(moved, 'found a real transition');
  const ready = until(moved, r => r.encounterCount === 6 && Boolean(r.pendingEncounter));
  const method = ready.pendingEncounter!.options.find(o => o.choiceId.startsWith('specialty:'))!;
  const done = submitResponse(ready, ready.pendingEncounter!.instanceId, method.choiceId, GAME_CONTENT);
  assert(done.growth!.money > ready.growth!.money, 'old learning pays off');
  assert(done.pendingResult!.changes.some(c => c.includes('专长派上用场')), 'explicit payoff');
  const frozen = payoffScene(original.growth!, 6).choices.find(c => c.id === 'practiced')!;
  eq(frozen.level, 2, 'old challenge does not scale with level');
});

test('every pending state reloads exactly; duplicate actions, spending and recall are safe', () => {
  const store = new Store(); let service = new GameService(store, () => 27); service.startNewLife();
  while (service.getCurrentRun()!.status === 'active') {
    const r = service.getCurrentRun()!;
    if (r.pendingEncounter) {
      const p = r.pendingEncounter; const o = p.options.filter(x => x.enabled).slice(-1)[0];
      eq(service.submitCurrentResponse('stale', o.choiceId), r, 'stale encounter ignored');
      const next = service.submitCurrentResponse(p.instanceId, o.choiceId);
      eq(service.submitCurrentResponse(p.instanceId, o.choiceId), next, 'repeat result does not grow twice');
      eq(submitResponse(next, p.instanceId, o.choiceId, GAME_CONTENT), next, 'engine idempotent');
    } else if (r.pendingResult) {
      eq(service.continueCurrentResult('stale'), r, 'stale result ignored');
      const next = service.continueCurrentResult(r.pendingResult.instanceId);
      eq(service.continueCurrentResult(r.pendingResult.instanceId), next, 'continue once');
    } else if (r.pendingRecall) {
      const p = r.pendingRecall; const next = service.submitCurrentRecall(p.instanceId, p.options[0].stance);
      eq(service.submitCurrentRecall(p.instanceId, p.options[0].stance), next, 'specialty only once');
    }
    const before = clone(service.getCurrentRun());
    service = new GameService(store, () => 99); eq(service.getCurrentRun(), before, 'roundtrip frozen phase');
  }
  service.archiveCurrentLife(); service.archiveCurrentLife(); eq(service.getProfile().archivedRunIds.length, 1, 'one archive');
});

test('no money and missing abilities cannot overspend, mutate state or stop the life', () => {
  let r = until(start(3), x => x.encounterCount === 8 && Boolean(x.pendingEncounter));
  r = { ...r, growth: { ...r.growth!, money: 0 } };
  const before = clone(r); rejects(() => submitResponse(r, r.pendingEncounter!.instanceId, 'invest', GAME_CONTENT)); eq(r, before, 'rejected expense unchanged');
  eq(end(r).status, 'awaiting-archive', 'zero money finishes');
  const a = until(start(4), x => x.encounterCount === 10 && Boolean(x.pendingEncounter));
  const weak = { ...a, growth: { ...a.growth!, abilities: { hands: 0, talk: 0, plan: 0 } } };
  rejects(() => submitResponse(weak, weak.pendingEncounter!.instanceId, 'master', GAME_CONTENT));
});

test('legacy active saves preserve their rules and new lives start without inherited growth', () => {
  const legacy = startLegacy(createInitialProfile(), 4, 'old-life', [], GAME_CONTENT);
  const store = new Store(); store.value = { version: 3, profile: createInitialProfile(), currentRun: legacy };
  const service = new GameService(store, () => 4); eq(service.getCurrentRun(), legacy, 'legacy pending unchanged');
  const response = service.submitCurrentResponse(legacy.pendingEncounter!.instanceId, legacy.pendingEncounter!.options[0].choiceId);
  assert(!response.growth && response.rulesVersion === 7, 'old rules continue');
  let profile = createInitialProfile();
  for (let i = 0; i < 3; i++) {
    const carried = listCarryCandidates(profile).slice(-2).map(u => u.id);
    const fresh = startLife(profile, 11 + i, `chain-${i}`, carried, GAME_CONTENT);
    eq(fresh.growth!.abilities, { hands: 0, talk: 0, plan: 0 }, 'fresh abilities'); eq(fresh.growth!.specialties, [], 'no inherited specialty');
    const finished = end(fresh, i); profile = completeArchive(profile, finished).profile;
    for (const u of profile.understandings) for (const id of u.sourceFragmentIds) assert(getCausality(finished, profile, id), 'all source chains remain');
  }
  eq(profile.fragments.length, 36, 'carried fragments not duplicated'); eq(profile.understandings.length, 6, 'own two specialties per life');
});

test('invalid growth saves fail without overwriting; UI presents real growth and resources', () => {
  const store = new Store(); const service = new GameService(store, () => 2); const r = service.startNewLife();
  const invalid = clone(store.value!); invalid.currentRun!.growth!.money = -1;
  eq(parseGameSave(invalid), null, 'negative balance rejected'); store.value = invalid;
  rejects(() => new GameService(store, () => 3)); eq(store.value, invalid, 'invalid original preserved');
  const view = presentEncounter(r, GAME_CONTENT, null); assert(view.growth && !view.canConfirm, 'growth HUD and explicit confirmation');
  const hud = presentGrowthHud(r)!; assert(hud.goal.length && hud.summary.includes('家底'), 'concrete goal and money');
  assert(presentJournal(createInitialProfile(), r).characterSummary?.includes('动手'), 'all abilities visible in character journal');
});

let failed = 0;
for (const c of cases) { try { c.run(); console.log(`ok  ${c.name}`); } catch (error) { failed++; console.error(`FAIL ${c.name}`, error); } }
console.log(`Growth: ${cases.length - failed}/${cases.length} passed`);
if (failed) throw new Error(`${failed} growth tests failed`);
