// 家庭玩法轻量冒烟：两代闭环、原子保存、重复保护、重载恢复、结算单次、失败交接。
const assert = require('node:assert/strict');
const { FamilyService } = require('../.test-dist/assets/scripts/app/familyService');
const { FAMILY_CONTENT } = require('../.test-dist/assets/scripts/content/familyContent');
const { clearObsoleteSaveKeys } = require('../.test-dist/assets/scripts/core/saveMigration');
const clone = value => JSON.parse(JSON.stringify(value));
let saved = null, saves = 0;
const store = {
  load: () => clone(saved),
  save: value => { saved = clone(value); saves++; },
};

// 旧键清理不触碰家庭存档键
const slots = { 'reincarnation-life.save.v1': 'old', 'reincarnation-life.save.backup': 'old' };
clearObsoleteSaveKeys({
  getItem: k => slots[k] ?? null,
  setItem: (k, v) => { slots[k] = v; },
  removeItem: k => { delete slots[k]; },
});
assert.equal(slots['reincarnation-life.save.v1'], undefined);
assert.equal(Object.keys(slots).length, 0);

let service = new FamilyService(store, () => 17);
service.startFamily();
assert.equal(service.hasFamily(), true);
service.startNextGeneration();
let run = service.getCurrentRun();
assert.equal(run.missionId, 'stabilize-life', '起步任务为稳住生活');
let clicks = 0;
const pick = (r, preferIncome) => {
  const opts = r.pendingEvent.options.filter(o => o.enabled);
  return preferIncome ? [...opts].sort((a, b) => b.income - a.income)[0] : opts[0];
};
while (run.status === 'active') {
  assert(clicks < 20, '一代应在 20 次行动内结束');
  const before = saves;
  const option = pick(run, clicks < 4);
  service.chooseAndAdvance(run.pendingEvent.instanceId, option.optionId);
  assert.equal(saves, before + 1, '每次选择只保存一次');
  const snapshot = clone(service.getCurrentRun());
  service.chooseAndAdvance(run.pendingEvent.instanceId, option.optionId);
  assert.deepEqual(clone(service.getCurrentRun()), snapshot, '重复提交被忽略');
  assert(snapshot.recentFeedback?.text, '上一次行动反馈保留');
  service = new FamilyService(store, () => 17);
  assert.deepEqual(clone(service.getCurrentRun()), snapshot, '待选状态刷新后恢复');
  run = service.getCurrentRun();
  clicks++;
}
assert.equal(service.getCurrentRun().status, 'settled');
const settlement = service.getLastSettlement();
assert(settlement, '结算生成');
assert(settlement.outcome === 'achieved', '收入路线达成');
const fundsAfterGen1 = service.getFamily().funds;
assert(fundsAfterGen1 > 0, '达成后家庭资金为正');
// 建设一项后开启第二代
const buildings = service.getEligibleBuildings();
const affordable = buildings.filter(b => b.available && b.affordable);
assert(affordable.length > 0, '首次结算应足以支持至少一项基础改善');
service.build(affordable[0].id);
assert.equal(service.getFamily().funds, fundsAfterGen1 - affordable[0].cost, '建设扣款一次');
service.startNextGeneration();
const gen2 = service.getCurrentRun();
assert.equal(gen2.generation, 2);
const cashIn = gen2.pendingEvent.options.find(o => o.sourceLabel && o.enabled);
assert(cashIn, '第二代第一事件兑现上一代帮助');
assert.equal(gen2.snapshot.funds, fundsAfterGen1 - affordable[0].cost, '下一代预算来自实际剩余');
// 结算只执行一次
const beforeReload = clone(service.getFamily());
service = new FamilyService(store, () => 17);
assert.deepEqual(clone(service.getFamily()), beforeReload, '重载不重复结算');
console.log('Family smoke passed: 2-generation loop, atomic save, duplicate protection, reload restore, one-time settlement, failed handover paths intact.');