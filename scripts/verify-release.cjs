const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(process.argv[2] || 'build/web-mobile');
const registry = new Map();
const context = vm.createContext({ console, System: { register(name, deps, declare) {
  if (Array.isArray(name)) { deps(() => {}, {}).execute(); return; }
  registry.set(name, { deps, declare, exports: {} });
} } });
for (const dir of ['src/chunks', 'assets/main']) for (const file of fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.js'))) {
  vm.runInContext(fs.readFileSync(path.join(root,dir,file),'utf8'),context,{filename:file});
}
const cc = { cclegacy: { _RF: { push() {}, pop() {} } } };
function load(name) {
  if (name === 'cc') return cc;
  const module = registry.get(name);
  assert(module, `Missing compiled module ${name}`);
  if (module.loaded) return module.exports;
  module.loaded = true;
  const factory = module.declare((key,value) => { if (typeof key === 'string') module.exports[key] = value; else Object.assign(module.exports,key); return value; }, {id:name});
  module.deps.forEach((dep,i) => factory.setters[i](load(dep.startsWith('.') ? new URL(dep,name).href : dep)));
  factory.execute();
  return module.exports;
}
const get = name => load(`chunks:///_virtual/${name}.ts`);
const engine = get('lifeEngine'), { GAME_CONTENT } = get('gameContent'), model = get('model');
const { parseGameSave } = get('saveMigration');
const { GameService } = get('gameService');
const { presentCarry, presentEncounter, presentResult } = get('presenters');
get('contentValidation').assertValidGameContent(GAME_CONTENT);
assert.equal(engine.listCarryCandidates(model.createInitialProfile()).length, 0, 'release Map iterator must produce an empty array');
assert.equal(presentCarry([],[]).cards.length,0);
for (let seed=1;seed<=100;seed++) {
  let saved = null;
  const store = { load: () => saved, save: v => { saved = JSON.parse(JSON.stringify(v)); } };
  let service = new GameService(store, () => seed);
  service.startNewLife([]);
  let results = 0;
  for (let i=0; i<30 && service.getCurrentRun().status==='active'; i++) {
    const r=service.getCurrentRun();
    assert(r.tags.every(t=>typeof t==='string'),'compiled tags must be strings, never Set objects');
    if(r.pendingEncounter) {
      const p=r.pendingEncounter;
      presentEncounter(r,GAME_CONTENT,null);
      const options=p.options.filter(o=>o.enabled);
      service.submitCurrentResponse(p.instanceId,options[seed%options.length].choiceId);
    } else if(r.pendingResult) {
      results++; assert(presentResult(r).outcome.length>0);
      service.continueCurrentResult(r.pendingResult.instanceId);
    } else if(r.pendingRecall) service.submitCurrentRecall(r.pendingRecall.instanceId,r.pendingRecall.options[seed%r.pendingRecall.options.length].stance);
    const before = JSON.parse(JSON.stringify(service.getCurrentRun()));
    assert(parseGameSave(saved)?.currentRun,'release save parses');
    service=new GameService(store,()=>seed);
    assert.deepEqual(JSON.parse(JSON.stringify(service.getCurrentRun())),before,'release roundtrip preserves the pending phase');
  }
  const r=service.getCurrentRun();
  assert(r.growth && r.rulesVersion === 8, 'release must run the new growth rules');
  assert.equal(r.growth.specialties.length,2);
  assert(r.growth.achievements.length >= 2);
  assert(r.growth.money >= 0);
  assert.equal(r.status,'awaiting-archive'); assert.equal(r.age,81); assert.equal(results,12); assert.equal(r.recallCount,2);
  service.archiveCurrentLife(); service.archiveCurrentLife();
  assert.equal(service.getProfile().fragments.length,12);
  const candidates=engine.listCarryCandidates(service.getProfile());
  assert(candidates.every(u=>typeof u.statement==='string'));
  presentCarry(candidates,[]);
  service.startNewLife(candidates.slice(0,1).map(u=>u.id));
  assert.equal(service.getCurrentRun().growth.specialties.length,0,'past life must not grant specialties');
}
console.log('Release verified: 100 compiled lives, result/save/archive/carry flow, iterable compatibility.');
