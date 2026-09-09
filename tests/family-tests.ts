import { FamilyService, FamilySaveStore } from '../assets/scripts/app/familyService';
import { presentFamilyEvent, presentFamilyHome, presentFamilySettlement } from '../assets/scripts/app/presentation/familyPresenters';
import { FAMILY_CONTENT } from '../assets/scripts/content/familyContent';
import { assertFamilyContent, computeOutcome, missionEligible, selectMission } from '../assets/scripts/core/missionEngine';
import { categoryLevel, computeMilestone, eligibleBuildings } from '../assets/scripts/core/familyEngine';
import { FamilySave, GenerationRun } from '../assets/scripts/core/familyModel';
import { parseFamilySave } from '../assets/scripts/core/familySave';
import { clearObsoleteSaveKeys } from '../assets/scripts/core/saveMigration';

const cases: Array<{ name: string; run: () => void }> = [];
const test = (name: string, run: () => void): void => { cases.push({ name, run }); };
function assert(v: unknown, message: string): asserts v { if (!v) throw new Error(message); }
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
// 比较前统一规范化：忽略 undefined 字段与对象键顺序差异（存档解析会重建键序）。
function canonical(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.map(canonical));
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, canonical(item)] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return JSON.stringify(entries);
  }
  return JSON.stringify(value);
}
const deepEq = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);

class Store implements FamilySaveStore {
  value: FamilySave | null = null;
  load(): FamilySave | null { return clone(this.value); }
  save(v: FamilySave): void { this.value = clone(v); }
}

function serviceWith(seed: number): { svc: FamilyService; store: Store } {
  const store = new Store();
  const svc = new FamilyService(store, () => seed);
  svc.startFamily();
  return { svc, store };
}

type Strategy = 'earn' | 'poor' | 'first';

function pickOption(run: GenerationRun, strategy: Strategy): string {
  const opts = run.pendingEvent!.options.filter(o => o.enabled);
  assert(opts.length > 0, '至少有一个可用选项');
  if (strategy === 'first') return opts[0].optionId;
  if (strategy === 'earn') return [...opts].sort((a, b) => b.income - a.income)[0].optionId;
  return [...opts].sort((a, b) => a.income - b.income)[0].optionId;
}

// 打完一整代；finalOptionId 提供时，最后一个事件强制选该选项（须已启用）。
function playGeneration(svc: FamilyService, strategy: Strategy, finalOptionId?: string): FamilyService {
  let guard = 0;
  while (svc.getCurrentRun()?.status === 'active') {
    assert(guard < 30, '一代应能在 30 次行动内结束');
    const run = svc.getCurrentRun()!;
    const pending = run.pendingEvent;
    assert(pending, 'active 一代必须有待选事件');
    if (pending.isFinal && finalOptionId) {
      const target = pending.options.find(o => o.optionId === finalOptionId && o.enabled);
      if (target) {
        svc.chooseAndAdvance(pending.instanceId, target.optionId);
      } else {
        svc.chooseAndAdvance(pending.instanceId, pickOption(run, strategy));
      }
    } else {
      svc.chooseAndAdvance(pending.instanceId, pickOption(run, strategy));
    }
    guard += 1;
  }
  assert(svc.getCurrentRun()?.status === 'settled', '一代应进入结算状态');
  return svc;
}

// 按选项 id 清单打完一整代（用于确定性代际剧本）。
function playScript(svc: FamilyService, optionIds: string[]): FamilyService {
  let index = 0;
  while (svc.getCurrentRun()?.status === 'active') {
    const run = svc.getCurrentRun()!;
    const pending = run.pendingEvent;
    assert(pending, '剧本中途不应无事件');
    const id = optionIds[index];
    assert(id, `剧本在第 ${index} 个事件处缺少选项`);
    const target = pending.options.find(o => o.optionId === id);
    assert(target && target.enabled, `选项 ${id} 应在第 ${index} 个事件可用（实际：${pending.options.map(o => o.optionId).join(',')}）`);
    svc.chooseAndAdvance(pending.instanceId, target.optionId);
    index += 1;
  }
  return svc;
}

function buildAtHome(svc: FamilyService, buildingId: string): boolean {
  const options = svc.getEligibleBuildings();
  const target = options.find(o => o.id === buildingId && o.available && o.affordable);
  if (target) {
    svc.build(target.id);
    return true;
  }
  return false;
}

test('family content validates; every event has a guaranteed free path', () => {
  assertFamilyContent(FAMILY_CONTENT);
  for (const mission of FAMILY_CONTENT.missions) {
    for (const e of mission.events) {
      assert(e.options.some(o => !o.effect.cost && !o.requires), `${mission.id}/${e.id} 缺少无条件免费选项`);
    }
  }
});

test('gen1 stabilize: earn achieves, poor fails, budget accounting exact and never negative', () => {
  const { svc } = serviceWith(11);
  svc.startNextGeneration();
  assert(svc.getCurrentRun()!.missionId === 'stabilize-life', '第一代应为稳住生活');
  playGeneration(svc, 'earn');
  const settlement = svc.getLastSettlement()!;
  assert(settlement.outcome === 'achieved', '收入路线应达成目标');
  const family = svc.getFamily()!;
  const expected = 4 - settlement.net.spent + settlement.net.income;
  assert(settlement.net.budgetReturned === expected, '返还预算应等于 拨出 - 花费 + 收入');
  assert(family.funds === expected, '家庭资金应恰好等于返还的剩余预算');
  assert(family.funds >= 0 && settlement.net.spent >= 0 && settlement.net.income >= 0, '所有账目非负');
  assert(family.generationCount === 1 && family.history.length === 1, '一代已结算并记录');
  assert(family.evidence.some(e => e.id === 'crafted'), '做过手艺应留下资质');
  assert(settlement.evidenceAdded.length >= 0, '结算资质列表可读');
  // 失败路线：保留实际剩余，不凭空消失。
  const { svc: poor } = serviceWith(12);
  poor.startNextGeneration();
  playGeneration(poor, 'poor');
  assert(poor.getLastSettlement()!.outcome === 'failed', '低收路线应未达成');
  assert(poor.getFamily()!.funds >= 0, '失败后仍保留实际剩余预算');
});

test('two generations: second generation first two events cash in previous generation help', () => {
  const { svc } = serviceWith(21);
  svc.startNextGeneration();
  playGeneration(svc, 'earn', 'buy-tools'); // 第一代用结余留下基础工具
  assert(svc.getFamily()!.accumulations.some(a => a.id === 'asset:basic-tools'), '一代应留下工具');
  assert(buildAtHome(svc, 'security:home'), '第一代后可修好旧屋');
  assert(categoryLevel(svc.getFamily()!, 'security') === 1, '生活保障应提升');
  svc.startNextGeneration();
  const run = svc.getCurrentRun()!;
  assert(run.missionId === 'independent-work', '已安稳的家庭第二代应为独立做工');
  assert(run.snapshot.securityLevel === 1 && run.snapshot.assetNames.includes('基础工具'), '开局快照应记录家庭条件');
  const event1 = run.pendingEvent!;
  const toolCashIn1 = event1.options.find(o => o.sourceLabel?.includes('基础工具'));
  assert(toolCashIn1?.enabled, '第二代第一个事件应兑现工具帮助');
  svc.chooseAndAdvance(event1.instanceId, toolCashIn1!.optionId);
  const event2 = svc.getCurrentRun()!.pendingEvent!;
  const securityCashIn2 = event2.options.find(o => o.sourceLabel?.includes('修好旧屋'));
  assert(securityCashIn2?.enabled, '第二代第二个事件应继续兑现生活保障帮助');
  assert(securityCashIn2!.cost === 0, '兑现帮助的选项不应额外收费');
});

test('mission selection follows family state; three-generation arc reaches shop orders', () => {
  const { svc } = serviceWith(31);
  svc.startNextGeneration();
  assert(svc.getCurrentRun()!.missionId === 'stabilize-life', '未安顿的家庭先稳住生活');
  // 第一代：稳住生活，用结余买下工具。
  playScript(svc, ['odd-job', 'save-money', 'take-urgent', 'rent-tools', 'night-work', 'buy-tools']);
  assert(svc.getFamily()!.evidence.some(e => e.id === 'crafted'), '一代应有手艺经历');
  assert(svc.getFamily()!.accumulations.some(a => a.id === 'asset:basic-tools'), '一代应留下工具');
  assert(buildAtHome(svc, 'security:home'), '一代后可修好旧屋');
  svc.startNextGeneration();
  assert(svc.getCurrentRun()!.missionId === 'independent-work', '安稳后进入独立做工');
  // 第二代：独立做工，留下可靠交付记录。
  playScript(svc, ['use-security', 'use-tools', 'take-batch', 'write-notes', 'redo', 'leave-record']);
  assert(svc.getFamily()!.accumulations.some(a => a.id === 'reputation:delivery'), '二代应留下交付记录');
  assert(buildAtHome(svc, 'asset:workshop'), '二代后可建立工作间');
  svc.startNextGeneration();
  assert(svc.getCurrentRun()!.missionId === 'shop-orders', '有工作间与声誉的家族应经营小铺');
  // 第三代：小铺试营，完成三批订单。
  playScript(svc, ['set-rules', 'use-workshop', 'take-extra', 'finish-neighbors', 'rush-extra', 'keep-merchant']);
  const family = svc.getFamily()!;
  assert(family.generationCount === 3, '三代完成');
  assert(family.accumulations.some(a => a.id === 'reputation:merchant'), '三代应建立商行往来');
  assert(computeMilestone(family) === 'enterprise', '拥有可持续家业的里程碑应达成');
});

test('settlement applies exactly once; reload restores pending state; double submission ignored', () => {
  const { svc, store } = serviceWith(41);
  svc.startNextGeneration();
  const run = svc.getCurrentRun()!;
  const before = clone(run);
  svc.chooseAndAdvance(run.pendingEvent!.instanceId, run.pendingEvent!.options[0].optionId);
  const after = svc.getCurrentRun()!;
  svc.chooseAndAdvance(run.pendingEvent!.instanceId, run.pendingEvent!.options[0].optionId);
  assert(deepEq(svc.getCurrentRun()!, after), '重复提交应被忽略');
  assert(after.eventIndex > before.eventIndex, '选择后应推进');
  // 重新载入：待选状态应完整恢复
  const reloaded = new FamilyService(store, () => 99);
  assert(deepEq(reloaded.getCurrentRun()!, after), '刷新后待选状态应完全一致');
  // 打完一代，结算只执行一次（资金不重复入账）
  playGeneration(reloaded, 'first');
  const fundsAfter = reloaded.getFamily()!.funds;
  const settled = reloaded.getCurrentRun()!;
  assert(settled.status === 'settled', '一代结束');
  reloaded.chooseAndAdvance('stale', 'x'); // 结算后操作应安全
  assert(reloaded.getFamily()!.funds === fundsAfter, '结算后资金不重复变化');
  const reloaded2 = new FamilyService(store, () => 7);
  assert(reloaded2.getFamily()!.funds === fundsAfter, '重载后不重复结算');
  assert(reloaded2.getLastSettlement()!.runId === settled.id, '最近结算可读');
});

test('buildings respect evidence gates and one construction per intermission', () => {
  const { svc } = serviceWith(51);
  svc.startNextGeneration();
  playScript(svc, ['odd-job', 'save-money', 'take-urgent', 'rent-tools', 'night-work', 'installment']);
  const family = svc.getFamily()!;
  assert(family.evidence.some(e => e.id === 'crafted'), '应有手艺经历');
  assert(!family.evidence.some(e => e.id === 'delivered'), '不应有交付经历');
  const gates = eligibleBuildings(family, FAMILY_CONTENT, null, 99);
  const reputation = gates.find(o => o.id === 'reputation:delivery');
  assert(reputation && !reputation.available, '无交付经历时声誉建设不可用');
  const education = gates.find(o => o.id === 'education:notes');
  assert(education && !education.available, '无学习经历时家学不可用');
  const home = gates.find(o => o.id === 'security:home');
  assert(home && home.available, '修好旧屋不需要经历门槛');
  // 一代之间只能建设一次
  const first = gates.find(o => o.available && o.affordable);
  if (first) {
    const before = svc.getFamily()!.funds;
    svc.build(first.id);
    assert(svc.getFamily()!.funds === before - first.cost, '建设资金只扣一次');
    const second = svc.getEligibleBuildings().find(o => o.available && o.affordable && o.id !== first.id);
    if (second) {
      assert(second.intermissionUsed, '本代已动工标记');
      let threw = false;
      try { svc.build(second.id); } catch { threw = true; }
      assert(threw, '一代之间只能完成一项建设');
    }
  }
});

test('independent work and shop orders both have achievable and failure paths', () => {
  // 独立做工：剧本达成
  const { svc } = serviceWith(61);
  svc.startNextGeneration();
  playGeneration(svc, 'earn', 'buy-tools');
  buildAtHome(svc, 'security:home');
  svc.startNextGeneration();
  assert(svc.getCurrentRun()!.missionId === 'independent-work', '第二代独立做工');
  playScript(svc, ['watch-first', 'master-steps', 'take-batch', 'borrow-shop', 'redo', 'graduate-work']);
  assert(svc.getLastSettlement()!.outcome === 'achieved', '学习路线应取得资格');
  // 独立做工：不推进阶段则未达成
  const { svc: svc2 } = serviceWith(62);
  svc2.startNextGeneration();
  playGeneration(svc2, 'earn', 'buy-tools');
  buildAtHome(svc2, 'security:home');
  svc2.startNextGeneration();
  playScript(svc2, ['watch-first', 'help-only', 'negotiate-deadline', 'borrow-shop', 'ask-mentor', 'not-ready']);
  assert(svc2.getLastSettlement()!.outcome === 'failed', '不完成合格作品则未达成');
  assert(!svc2.getLastSettlement()!.evidenceAdded.includes('delivered'), '未出师不应新写入成功交付资质');
});

test('family save roundtrip and legacy key cleanup', () => {
  const { svc, store } = serviceWith(71);
  svc.startNextGeneration();
  const saved = store.value!;
  const parsed = parseFamilySave(saved);
  assert(parsed !== null, '家庭存档应可解析');
  assert(parsed!.family !== null && parsed!.currentRun !== null, '家庭与当代应保留');
  const roundtrip = parseFamilySave(clone(saved));
  assert(deepEq(roundtrip, saved), '存档往返应一致');
  let removed = 0;
  clearObsoleteSaveKeys({
    getItem: (k) => (k === 'reincarnation-life.save.v1' || k === 'reincarnation-life.save.backup' ? 'old' : null),
    setItem: () => {},
    removeItem: (k) => { if (k.startsWith('reincarnation-life.save.')) removed += 1; },
  });
  assert(removed === 2, '只清理旧轮回键，家庭键不在其中');
});

test('chapter summary appears after three generations', () => {
  const { svc } = serviceWith(81);
  svc.startNextGeneration();
  playScript(svc, ['odd-job', 'save-money', 'take-urgent', 'rent-tools', 'night-work', 'buy-tools']);
  buildAtHome(svc, 'security:home');
  svc.startNextGeneration();
  playScript(svc, ['use-security', 'use-tools', 'take-batch', 'write-notes', 'redo', 'leave-record']);
  buildAtHome(svc, 'asset:workshop');
  svc.startNextGeneration();
  playScript(svc, ['set-rules', 'use-workshop', 'take-extra', 'finish-neighbors', 'rush-extra', 'keep-merchant']);
  const family = svc.getFamily()!;
  assert(family.generationCount === 3, '三代完成');
  const summary = svc.chapterSummary();
  assert(summary !== null, '三代后应有家庭阶段总结');
  assert(summary!.lines.length >= 2 && summary!.nextStep.length > 0, '总结应有内容');
  const settlementView = presentFamilySettlement(svc.saveSnapshot(), FAMILY_CONTENT);
  assert(settlementView.familyFundsAfter >= 0, '结算展示资金非负');
});

test('presenters produce readable pages for home, event and settlement', () => {
  const { svc } = serviceWith(91);
  const home = presentFamilyHome(svc.saveSnapshot(), FAMILY_CONTENT, svc.getEligibleBuildings());
  assert(home.familyName.length > 0, '家园可展示');
  assert(home.primaryAction === 'start', '未开局时主操作是开始');
  svc.startNextGeneration();
  const event = presentFamilyEvent(svc.saveSnapshot(), FAMILY_CONTENT);
  assert(event.goalText.length > 0 && event.options.length >= 2, '事件页展示目标与选项');
  assert(event.progressLine.length > 0, '事件页展示主要进度');
  playGeneration(svc, 'first');
  const settlement = presentFamilySettlement(svc.saveSnapshot(), FAMILY_CONTENT);
  assert(settlement.outcomeName.length > 0, '结算页可展示');
  const homeAfter = presentFamilyHome(svc.saveSnapshot(), FAMILY_CONTENT, svc.getEligibleBuildings());
  assert(homeAfter.primaryAction === 'start', '结算后主操作是开始下一代，而不是查看旧结算');
  assert(homeAfter.showMember, '结算后仍可查看本代详情');
});

test('mission selection is stable and respects eligibility rules', () => {
  const { svc } = serviceWith(101);
  const family = svc.getFamily()!;
  for (const mission of FAMILY_CONTENT.missions) {
    assert(typeof missionEligible(mission, family) === 'boolean', 'eligibility 可判定');
  }
  const picked = selectMission(family, FAMILY_CONTENT, 1234);
  assert(picked.mission.id === 'stabilize-life', '起步家庭只可选稳住生活');
  assert(computeOutcome !== undefined, '结算判定函数可引用');
});

test('repairing house before gen1 still starts a playable generation', () => {
  const { svc } = serviceWith(201);
  assert(buildAtHome(svc, 'security:home'), '初始资金应够修好旧屋');
  svc.startNextGeneration();
  const run = svc.getCurrentRun()!;
  assert(run.status === 'active' && run.pendingEvent, '修屋后仍能开局');
  assert(run.missionId === 'independent-work', '已安顿的家庭开局走独立做工');
});

test('paying the winter bill deducts funds; buying tools costs extra; failure cannot fake delivery', () => {
  const { svc } = serviceWith(31);
  svc.startNextGeneration();
  playScript(svc, ['odd-job', 'save-money', 'take-urgent', 'rent-tools', 'night-work', 'buy-tools']);
  const settlement = svc.getLastSettlement()!;
  assert(settlement.outcome === 'achieved', '补足并交清应达成');
  assert(settlement.itemsGained.some(n => n.includes('工具')), '买工具应留下工具');
  const expected = 4 - settlement.net.spent + settlement.net.income;
  assert(settlement.net.budgetReturned === expected, '返还预算应等于拨出 - 花费 + 收入');
  assert(settlement.net.spent >= 8 + 3, '应交足约定开支并支付购工具的钱');
  assert(svc.getFamily()!.funds === expected, '家庭资金应为扣款后的结余');
  assert(expected < 11, '不应把未扣的 11 两连同工具一起留下');

  const { svc: poor } = serviceWith(12);
  poor.startNextGeneration();
  playGeneration(poor, 'poor');
  const last = poor.getCurrentRun()!.pendingEvent;
  void last;
  assert(poor.getLastSettlement()!.outcome === 'failed', '低收路线应未达成');
  assert(!poor.getFamily()!.evidence.some(e => e.id === 'delivered'), '失败不能留下按时交付资质');
  const settleEvent = (() => {
    const { svc: look } = serviceWith(12);
    look.startNextGeneration();
    let guard = 0;
    while (look.getCurrentRun()?.status === 'active' && guard < 30) {
      const run = look.getCurrentRun()!;
      const pending = run.pendingEvent!;
      if (pending.isFinal) return pending;
      look.chooseAndAdvance(pending.instanceId, pickOption(run, 'poor'));
      guard += 1;
    }
    return look.getCurrentRun()?.pendingEvent;
  })();
  const payOff = settleEvent?.options.find(o => o.optionId === 'pay-off');
  assert(payOff && !payOff.enabled, '未补足约定开支时不能选择按约交足');
});

test('education 2 and reputation 2 open better actions, not just the same level-1 options', () => {
  const store = new Store();
  const svc = new FamilyService(store, () => 401);
  svc.startFamily();
  const family = svc.getFamily()!;
  family.accumulations.push(
    { id: 'security:home', category: 'security', level: 1, name: '修好旧屋', benefit: '', source: { generation: 1, text: '测试' } },
    { id: 'education:notes', category: 'education', level: 1, name: '家传手册', benefit: '', source: { generation: 1, text: '测试' } },
    { id: 'education:teaching', category: 'education', level: 2, name: '家学：经营方法', benefit: '', source: { generation: 1, text: '测试' } },
    { id: 'reputation:delivery', category: 'reputation', level: 1, name: '可靠交付记录', benefit: '', source: { generation: 1, text: '测试' } },
    { id: 'reputation:merchant', category: 'reputation', level: 2, name: '商行往来', benefit: '', source: { generation: 1, text: '测试' } },
  );
  store.save(svc.saveSnapshot());
  const loaded = new FamilyService(store, () => 401);
  loaded.startNextGeneration();
  const run = loaded.getCurrentRun()!;
  assert(run.missionId === 'independent-work' || run.missionId === 'shop-orders', '二级积累后应进入做工或经营');
  const titles: string[] = [];
  let guard = 0;
  while (loaded.getCurrentRun()?.status === 'active' && guard < 12) {
    const pending = loaded.getCurrentRun()!.pendingEvent!;
    titles.push(...pending.options.filter(o => o.enabled && (o.optionId === 'use-teaching' || o.optionId === 'use-merchant')).map(o => o.optionId));
    const free = pending.options.find(o => o.enabled && o.cost === 0);
    assert(free, '每个事件仍有可执行行动');
    loaded.chooseAndAdvance(pending.instanceId, free!.optionId);
    guard += 1;
  }
  assert(titles.includes('use-teaching') || titles.includes('use-merchant'), '二级家学或声誉应打开新的可用选项');
});

test('learning repair unlocks a better job than renting tools unskilled', () => {
  const { svc } = serviceWith(15);
  svc.startNextGeneration();
  const first = svc.getCurrentRun()!.pendingEvent!;
  svc.chooseAndAdvance(first.instanceId, 'odd-job');
  const prepare = svc.getCurrentRun()!.pendingEvent!;
  svc.chooseAndAdvance(prepare.instanceId, 'learn-repair');
  svc.chooseAndAdvance(svc.getCurrentRun()!.pendingEvent!.instanceId, 'partial');
  const apply = svc.getCurrentRun()!.pendingEvent!;
  const skilled = apply.options.find(o => o.optionId === 'skilled-repair');
  const rented = apply.options.find(o => o.optionId === 'rent-tools');
  assert(skilled?.enabled, '学会修补后应能自己接活');
  assert((skilled?.income ?? 0) > (rented?.income ?? 0), '学过的修理应比租工具手生更划算');
});

let failed = 0;
for (const c of cases) {
  try { c.run(); console.log(`ok  ${c.name}`); }
  catch (error) { failed += 1; console.error(`FAIL ${c.name}`, error); }
}
console.log(`Family: ${cases.length - failed}/${cases.length} passed`);
if (failed) throw new Error(`${failed} family tests failed`);