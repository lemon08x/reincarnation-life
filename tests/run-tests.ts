import { GameService, SaveStore } from '../assets/scripts/app/gameService';
import { presentCarry, presentEncounter, presentRecall, presentResult, presentJournal, routePlayPage } from '../assets/scripts/app/presentation/presenters';
import { measureBlocks, textHeight } from '../assets/scripts/app/presentation/journalLayout';
import { GAME_CONTENT } from '../assets/scripts/content/gameContent';
import { validateGameContent } from '../assets/scripts/core/contentValidation';
import { causalityHasCycle, completeArchive, continueAfterResult, getCausality, listCarryCandidates, startLife, submitRecall, submitResponse, upgradeActiveRun } from '../assets/scripts/core/legacyLifeEngine';
import { createInitialProfile, GameSave, LifeRun, MOMENT_AGES, RecallStance, SAVE_VERSION } from '../assets/scripts/core/model';
import { parseGameSave, clearObsoleteSaveKeys } from '../assets/scripts/core/saveMigration';
const tests: Array<{name: string; run: () => void}> = [];
const test = (name: string, run: () => void): void => { tests.push({name, run}); };
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
function canonical(v: unknown): string { return JSON.stringify(v, (_key, x: unknown) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a],[b]) => a.localeCompare(b))) : x); }
const eq = (a: unknown, b: unknown, m: string): void => assert(canonical(a) === canonical(b), `${m}: values differ`);
function throws(fn: () => void): void { let did = false; try { fn(); } catch { did = true; } assert(did, 'expected rejection'); }
const start = (seed: number): LifeRun => startLife(createInitialProfile(), seed, `test-${seed}`, [], GAME_CONTENT);
function step(run: LifeRun, style = 0, stance?: RecallStance): LifeRun {
  if (run.pendingResult) return continueAfterResult(run, run.pendingResult.instanceId, GAME_CONTENT);
  if (run.pendingRecall) return submitRecall(run, run.pendingRecall.instanceId, stance ?? (['hold', 'revise', 'question'] as RecallStance[])[style % 3], GAME_CONTENT);
  const pending = run.pendingEncounter;
  assert(pending, 'active life must have a readable state');
  const enabled = pending.options.filter(o => o.enabled);
  const option = style % 4 === 0 ? enabled[0] : style % 4 === 1 ? enabled[1] : style % 4 === 2 ? enabled.slice().sort((a,b) => b.cost - a.cost)[0] : enabled[enabled.length - 1];
  return submitResponse(run, pending.instanceId, option.choiceId, GAME_CONTENT);
}
function until(run: LifeRun, target: (r: LifeRun) => boolean, style = 0, stance?: RecallStance): LifeRun {
  for (let i = 0; i < 40; i++) { if (target(run) || run.status !== 'active') return run; run = step(run, style, stance); }
  throw new Error('progress guard exceeded');
}
const end = (r: LifeRun, style = 0): LifeRun => until(r, s => s.status !== 'active', style);
const recall = (r: LifeRun): LifeRun => until(r, s => Boolean(s.pendingRecall));
const at = (r: LifeRun, id: string): LifeRun => until(r, s => s.pendingEncounter?.templateId === id);
const roundtrip = (r: LifeRun): LifeRun => parseGameSave({version:SAVE_VERSION, profile:createInitialProfile(), currentRun: clone(r)})!.currentRun!;
class MemoryStore implements SaveStore {
  value: GameSave | null = null;
  load(): GameSave | null { return clone(this.value); }
  save(v: GameSave): void { this.value = clone(v); }
}

test('content: chapters, three theme pairs, valid sources and full authored choices', () => {
  eq(validateGameContent(GAME_CONTENT), [], 'content validation');
  eq(GAME_CONTENT.encounters.length, 30, 'scene count');
  for (const t of GAME_CONTENT.encounters) {
    if (t.chapter > 0) assert(t.questionChoice, `${t.id} lacks a situated question`);
    const text = JSON.stringify(t);
    const roles = Array.from(text.matchAll(/\{(\w+)\}/g)).map(m => m[1]);
    for (const role of roles) assert(t.people.some(p => p.role === role), `${t.id} missing role ${role}`);
    for (const c of [...t.choices, ...(t.questionChoice ? [t.questionChoice] : [])]) {
      assert(c.text !== c.preview, 'preview must explain tradeoff');
      assert(c.outcomes.every(o => o.text.length >= 20 && o.later.length >= 8), `${t.id}/${c.id} incomplete result`);
    }
  }
});

test('1000 seeds × 3 strategies: exactly 12 visible results, 2 recalls, age 81 and all scenes reachable', () => {
  const reached = new Set<string>();
  const pairs = new Set<string>();
  let refused = 0;
  for (let seed = 1; seed <= 1000; seed++) for (let style = 0; style < 3; style++) {
    let r = start(seed);
    pairs.add([r.lineA, r.lineB].sort().join('/'));
    let results = 0;
    const evidence: number[][] = [];
    for (let guard = 0; guard < 30 && r.status === 'active'; guard++) {
      assert([r.pendingEncounter,r.pendingResult,r.pendingRecall].filter(Boolean).length === 1, 'exactly one pending phase');
      if (r.pendingEncounter) {
        const p = r.pendingEncounter;
        reached.add(p.templateId);
        eq(p.age, MOMENT_AGES[r.encounterCount], 'age sequence');
        assert(p.options.filter(o => o.cost === 0 && o.enabled).length >= 2, 'two free options');
        assert(!/\{\w+\}/.test(JSON.stringify(p)), 'no unresolved placeholders');
      }
      if (r.pendingResult) {
        results++;
        eq(routePlayPage(r), 'result', 'result must be routed');
        assert(!r.pendingEncounter, 'no hidden advancement');
        const result = presentResult(r);
        assert(result.outcome.length > 20 && result.consequence.length >= 8, 'actual outcome and consequence shown');
      }
      if (r.pendingRecall) evidence.push(r.pendingRecall.fragmentIds.map(id => r.fragments.find(f => f.id === id)!.age));
      r = step(r, style === 2 ? 3 : style, (['hold','revise','question'] as RecallStance[])[style]);
      assert(r.lifePoints >= 0 && r.lifePoints <= 4, 'point bounds');
    }
    eq(r.status, 'awaiting-archive', `seed ${seed}/${style} complete`);
    eq(results, 12, 'twelve explicit result pages'); eq(r.age,81,'late-life ending'); eq(r.recallCount,2,'two recalls');
    eq(new Set(r.usedTemplateIds).size,12,'no duplicate scenes');
    for (let chapter = 0; chapter < 4; chapter++) eq(r.usedTemplateIds.filter(id => GAME_CONTENT.encounters.find(t => t.id === id)!.chapter === chapter).length,3,'three moments in each chapter');
    assert(evidence[0].length === 2 && evidence[1].length === 2, 'two real evidence fragments per recall');
    assert(Math.max(...evidence[1]) > Math.max(...evidence[0]), 'second recall must use new evidence');
    assert(!causalityHasCycle(r,createInitialProfile()),'acyclic history');
    for (const f of r.fragments) for (const id of [...f.triggerSourceIds,...f.recalledFragmentIds]) assert(getCausality(r,createInitialProfile(),id), 'all sources resolve');
    refused += r.fragments.filter(f => f.outcomeId.includes('refused') || f.outcomeId.includes('missed')).length;
  }
  eq(reached.size,30,'every scene reachable'); eq(pairs.size,3,'all theme pairs');
  console.log(`  sampled 3000 lives; ${reached.size} scenes, ${pairs.size} theme pairs, ${refused} refused/missed proposals`);
});

test('same external event: earlier action alters support, actual callback text and its source', () => {
  let pair: [LifeRun,LifeRun] | undefined;
  for (let seed=1; seed<200 && !pair; seed++) {
    const r=at(start(seed),'trust_order'); if (!r.pendingEncounter || r.pendingEncounter.templateId !== 'trust_order') continue;
    const p=r.pendingEncounter;
    const covered=at(submitResponse(clone(r),p.instanceId,'cover',GAME_CONTENT),'trust_returned_order');
    const together=at(submitResponse(clone(r),p.instanceId,'together',GAME_CONTENT),'trust_returned_order');
    if(covered.pendingEncounter?.templateId==='trust_returned_order' && together.pendingEncounter?.templateId==='trust_returned_order') pair=[covered,together];
  }
  assert(pair,'same callback must be reachable for both decisions');
  const [a,b]=pair;
  assert(a.pendingEncounter!.text !== b.pendingEncounter!.text,'old fact changes the actual scene');
  eq(a.pendingEncounter!.options.find(o=>o.choiceId==='review')!.cost,1,'new behavior needs effort');
  eq(b.pendingEncounter!.options.find(o=>o.choiceId==='review')!.cost,0,'practiced behavior is free');
  for(const r of pair) {
    eq(r.pendingEncounter!.triggerKind,'consequence','explicit causal trigger');
    const source=r.pendingEncounter!.triggerSourceIds[0];
    eq(r.fragments.find(f=>f.id===source)!.templateId,'trust_order','correct source');
    const next=step(r); assert(next.fragments.find(f=>f.id===source)!.laterWhat.length>=2,'old fragment gains actual later evidence');
  }
});

test('hold / revise / question have different future affordances; holding a revision retains it', () => {
  const base=recall(start(12)); const theme=GAME_CONTENT.understandingSeeds.find(s=>s.id===base.pendingRecall!.seedId)!.theme;
  const runs=(['hold','revise','question'] as RecallStance[]).map(stance=>{
    const r=submitRecall(clone(base),base.pendingRecall!.instanceId,stance,GAME_CONTENT);
    return until(r,s=>s.pendingEncounter?.theme===theme);
  });
  const [held,revised,questioned]=runs;
  assert(!held.pendingEncounter!.options.some(o=>o.choiceId==='ask-first'),'hold does not grant question');
  assert(questioned.pendingEncounter!.options.some(o=>o.choiceId==='ask-first'&&o.cost===0),'question grants a free situated inquiry');
  const discounted=revised.pendingEncounter!.options.find(o=>o.supportedByFragmentIds.length);
  assert(discounted && discounted.cost===0,'revision grants sourced support');
  const before=clone(base.fragments);
  eq(revised.fragments.slice(0,before.length),before,'recall does not rewrite facts or past interpretations');
  const second=until(revised,r=>Boolean(r.pendingRecall),0,'revise');
  const after=submitRecall(second,second.pendingRecall!.instanceId,'hold',GAME_CONTENT);
  eq(after.understandings.slice(-1)[0].effectiveStance,'revise','holding retains the practiced interpretation');
  eq(roundtrip(after).understandings,after.understandings,'effective interpretation survives reload');
});

test('results, questions and point costs persist without reroll or double submission', () => {
  const store=new MemoryStore(); store.value = { version: SAVE_VERSION, profile: createInitialProfile(), currentRun: start(12) }; let service=new GameService(store,()=>12);
  for(let i=0;i<30 && service.getCurrentRun()!.status==='active';i++) {
    const r=service.getCurrentRun()!;
    if(r.pendingEncounter) {
      const p=r.pendingEncounter; const o=p.options.filter(o=>o.enabled).slice(-1)[0];
      eq(service.submitCurrentResponse('stale',o.choiceId),r,'stale UI cannot consume current card');
      const next=service.submitCurrentResponse(p.instanceId,o.choiceId);
      eq(next.lifePoints,r.lifePoints-o.cost,'exact cost once');
      eq(submitResponse(next,p.instanceId,o.choiceId,GAME_CONTENT),next,'core duplicate is idempotent');
    } else if(r.pendingResult) {
      eq(continueAfterResult(r,'stale',GAME_CONTENT),r,'stale continue ignored');
      service.continueCurrentResult(r.pendingResult.instanceId);
    } else if(r.pendingRecall) service.submitCurrentRecall(r.pendingRecall.instanceId,'question');
    const before=clone(service.getCurrentRun()); service=new GameService(store,()=>99);
    eq(service.getCurrentRun(),before,'every pending page survives restart exactly');
  }
  eq(service.getCurrentRun()!.status,'awaiting-archive','service reaches ending');
  service.archiveCurrentLife(); service.archiveCurrentLife(); eq(service.getProfile().archivedRunIds.length,1,'archive retry is safe');
  service.startNewLife(); throws(()=>service.startNewLife());
});

test('zero points: two free choices remain and an unaffordable response changes nothing', () => {
  const r=until(start(99),s=>Boolean(s.pendingEncounter && s.encounterCount>=3));
  r.lifePoints=0;
  r.pendingEncounter!.options=r.pendingEncounter!.options.map(o=>({...o,enabled:o.cost===0}));
  const before=clone(r);
  const paid=r.pendingEncounter!.options.find(o=>o.cost>0); assert(paid,'paid alternative exists');
  throws(()=>submitResponse(r,r.pendingEncounter!.instanceId,paid.choiceId,GAME_CONTENT)); eq(r,before,'rejection leaves world untouched');
  eq(end(r).status,'awaiting-archive','zero points never blocks a life');
});

test('cross-life carry, full archive and source browsing remain distinct', () => {
  eq(listCarryCandidates(createInitialProfile()),[],'empty Map must be an empty array');
  let profile=createInitialProfile();
  for(let i=0;i<3;i++) {
    const carry=listCarryCandidates(profile).slice(-2).map(u=>u.id);
    const r=end(startLife(profile,56+i,`chain-${i}`,carry,GAME_CONTENT),i);
    assert(r.tags.every(t=>typeof t==='string'),'iterables produce strings');
    const archived=completeArchive(profile,r); profile=archived.profile;
    eq(completeArchive(profile,archived.run).profile,profile,'archive retry unchanged');
    for(const u of profile.understandings) for(const id of u.sourceFragmentIds) assert(getCausality(r,profile,id),'carry chain sources resolve');
  }
  eq(new Set(profile.fragments.map(f=>f.id)).size,36,'no duplicated carried fragments');
  const journal=presentJournal(profile,null); eq(journal.groups.length,3,'all lives browsable');
  eq(journal.groups.reduce((n,g)=>n+g.entries.length,0),42,'all 36 facts and 6 understandings visible');
  const cards=presentCarry(listCarryCandidates(profile),[]); assert(cards.cards.every(c=>c.statement.full.length>10),'full carry statements');
});

test('older v3 active lives keep recorded facts and regenerate obsolete pending cards', () => {
  const old=until(start(5),r=>r.encounterCount===4 && Boolean(r.pendingEncounter));
  old.rulesVersion=6; old.pendingEncounter!.templateId='obsolete-scene';
  old.usedTemplateIds=old.usedTemplateIds.map(id=>`old-${id}`);
  old.fragments=old.fragments.map(f=>({...f,templateId:`old-${f.templateId}`}));
  const preserved=clone(old.fragments);
  const upgraded=upgradeActiveRun(roundtrip(old),GAME_CONTENT);
  eq(upgraded.fragments,preserved,'old history retained');
  assert(upgraded.pendingEncounter?.templateId!=='obsolete-scene','obsolete card regenerated');
  eq(end(upgraded).status,'awaiting-archive','old life can finish');
  const storage={ slots: {'reincarnation-life.save.v1':'old', 'other':'keep'} as Record<string,string>, getItem(k:string){return this.slots[k]??null;},removeItem(k:string){delete this.slots[k];},setItem(k:string,v:string){this.slots[k]=v;} };
  clearObsoleteSaveKeys(storage); eq(storage.slots.other,'keep','unrelated data preserved');
});

test('presentation keeps full evidence and measured cards stay within their bounds', () => {
  const r=recall(start(6)); const v=presentRecall(r,null);
  for(let i=0;i<v.evidence.length;i++) assert(v.evidence[i].full.includes(r.fragments.find(f=>f.id===r.pendingRecall!.fragmentIds[i])!.whatHappened),'full evidence shown');
  const e=presentEncounter(start(1),GAME_CONTENT,null); eq(e.event.full,start(1).pendingEncounter!.text,'whole scene retained');
  const blocks=measureBlocks([{body:e.event.full},{body:'很长的选择'.repeat(50),detail:'说明\n另一行',action:()=>{}}]);
  for(let i=1;i<blocks.items.length;i++) assert(blocks.items[i].top>=blocks.items[i-1].top+blocks.items[i-1].height,'cards do not overlap');
  assert(blocks.items[1].height>=88,'touch target minimum');
  assert(textHeight('一\n二\n三',592,30,44)>=132,'line breaks reserve vertical space');
});
let failures=0;
for(const t of tests) { try { t.run(); console.log(`ok  ${t.name}`); } catch(e) { failures++; console.error(`FAIL ${t.name}`,e); } }
console.log(`${tests.length-failures}/${tests.length} passed`);
if(failures) throw new Error(`${failures} tests failed`);
