// One short playable-flow smoke check. Full simulation suites remain opt-in.
const assert = require('node:assert/strict');
const { GameService } = require('../.test-dist/assets/scripts/app/gameService');
const legacy = require('../.test-dist/assets/scripts/core/legacyLifeEngine');
const { GAME_CONTENT } = require('../.test-dist/assets/scripts/content/gameContent');
const { createInitialProfile } = require('../.test-dist/assets/scripts/core/model');
const clone = value => JSON.parse(JSON.stringify(value));
let saved = null, saves = 0;
const store = { load: () => clone(saved), save: value => { saved = clone(value); saves++; } };
let service = new GameService(store, () => 17);
service.startNewLife();
let clicks = 0;
while (service.getCurrentRun().status === 'active') {
  assert(clicks < 15, 'one action per event or recall');
  const run = service.getCurrentRun(), before = saves;
  let repeat;
  if (run.pendingEncounter) {
    const p = run.pendingEncounter, o = p.options.filter(x => x.enabled).at(-1);
    service.chooseAndAdvance(p.instanceId, o.choiceId);
    repeat = () => service.chooseAndAdvance(p.instanceId, o.choiceId);
  } else {
    const p = run.pendingRecall;
    assert(p, 'no separate result page');
    service.chooseRecallAndAdvance(p.instanceId, p.options[0].stance);
    repeat = () => service.chooseRecallAndAdvance(p.instanceId, p.options[0].stance);
  }
  assert.equal(saves, before + 1, 'one save for the entire transition');
  const snapshot = clone(service.getCurrentRun());
  repeat();
  assert.deepEqual(clone(service.getCurrentRun()), snapshot, 'double submission ignored');
  assert(snapshot.recentFeedback?.text, 'last outcome remains readable');
  assert.notEqual(snapshot.turnState, 'showing-result');
  assert(snapshot.growth.money >= 0);
  service = new GameService(store, () => 17);
  assert.deepEqual(clone(service.getCurrentRun()), snapshot, 'feedback and pending state survive reload');
  clicks++;
}
assert.equal(clicks, 14);
assert.equal(service.getCurrentRun().status, 'settled');
assert.equal(service.getProfile().archivedRunIds.length, 1, 'automatically archived once');
service.resumeCurrentLife();
assert.equal(service.getProfile().archivedRunIds.length, 1);
service.startNewLife();
assert.equal(service.getCurrentRun().encounterCount, 0, 'next life starts directly');

const old = legacy.startLife(createInitialProfile(), 3, 'legacy-smoke', [], GAME_CONTENT);
const oldResult = legacy.submitResponse(old, old.pendingEncounter.instanceId, old.pendingEncounter.options[0].choiceId, GAME_CONTENT);
saved = { version: 3, profile: createInitialProfile(), currentRun: oldResult };
service = new GameService(store, () => 3);
const resumed = service.resumeCurrentLife();
assert.equal(resumed.encounterCount, oldResult.encounterCount, 'old result not settled twice');
assert.equal(resumed.lifePoints, oldResult.lifePoints);
assert.equal(resumed.recentFeedback.sourceId, oldResult.pendingResult.fragmentId);
assert.equal(resumed.turnState, 'awaiting-response');
console.log('Play smoke passed: 14 clicks, atomic save, duplicate protection, reload, archive, restart, legacy result.');
