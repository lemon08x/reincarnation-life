import { FamilyEventDef, FamilyOptionDef, MissionDefinition } from '../core/familyModel';
import { ScenarioKind } from '../core/model';

type Scene = ScenarioKind;
type Options = FamilyOptionDef[];

const option = (
  id: string,
  text: string,
  preview: string,
  effect: FamilyOptionDef['effect'],
  extra: Partial<FamilyOptionDef> = {},
): FamilyOptionDef => ({ id, text, preview, effect, ...extra });

const event = (
  id: string,
  phase: FamilyEventDef['phase'],
  title: string,
  text: string,
  scene: Scene,
  options: Options,
  extra: Partial<FamilyEventDef> = {},
): FamilyEventDef => ({ id, phase, title, text, scene, options, ...extra });

// ---------------- 任务一：稳住生活 ----------------

export const MISSION_STABILIZE_LIFE: MissionDefinition = {
  id: 'stabilize-life',
  title: '稳住生活',
  goalText: '入冬前补足约定开支，让这一冬能安稳过去。',
  progressKind: 'funds',
  progressLabel: '补足约定开支',
  target: 8,
  events: [
    event('s-context', 'context', '家中的缺口', '河镇的冬天来得早。家里还欠着药铺一笔旧账，屋顶的瓦片也要赶在入冬前换。母亲把账本摊在桌上：入冬前至少要补足八两，不然这个冬天难捱。你决定从哪件事开始？', 'hearth', [
      option('odd-job', '去河岸货栈做临工', '收入 2 两 · 从最稳当的活做起', {
        income: 2,
        outcome: '你在货栈搬了三天的货，掌柜按日结清了工钱。银子收进怀里，账本上的缺口小了一点。',
      }),
      option('negotiate', '先找药铺商量还款安排', '沟通 +1 · 约定开支降为 6 两', {
        abilities: { talk: 1 },
        progress: { targetDelta: -2 },
        outcome: '你照实说了家里的难处，药铺掌柜把旧账的期限往后推了两个月。约定开支从八两变成了六两。',
      }),
      option('sort-out', '清点家里的旧物与开销', '筹划 +1 · 收入 1 两', {
        abilities: { plan: 1 },
        income: 1,
        outcome: '你翻出几件不用的旧物托邻居转卖，又把每月的开销重新排了一遍，省下了一两。',
      }),
      option('use-tools', '用家里的工具接修理活', '收入 3 两 · 比临工更划算', {
        income: 3,
        outcome: '家里的工具派上了用场。你修好几扇松动的门窗，主家按约付了钱，租借费一分没花。',
      }, { requires: { assetIds: ['asset:basic-tools'] }, cashIn: ['asset:basic-tools'] }),
      option('use-notes', '先照家传笔记理账', '筹划 +1 · 收入 1 两', {
        abilities: { plan: 1 },
        income: 1,
        outcome: '你照着笔记里的法子重新排了开支，错开两笔撞在一起的花销，多省出一两。',
      }, { requires: { educationMin: 1 }, cashIn: ['education:notes', 'education:teaching'] }),
      option('use-reputation', '凭家里的交付记录接商行零活', '收入 3 两 · 商行信得过', {
        income: 3,
        outcome: '商行记着家里的交付记录，把一批零活直接交给你，工钱比货栈临工厚。',
      }, { requires: { reputationMin: 1 }, cashIn: ['reputation:delivery', 'reputation:merchant'] }),
      option('use-teaching', '按家学把冬前开支重新排开', '筹划 +1 · 约定开支降为 6 两', {
        abilities: { plan: 1 },
        progress: { targetDelta: -2 },
        outcome: '家学里记着错开支的法子。你把药账、屋瓦和口粮错开两旬，约定开支从八两变成了六两。',
      }, { requires: { educationMin: 2 }, cashIn: ['education:teaching'] }),
    ]),
    event('s-prepare', 'prepare', '白天做工，夜里想辙', '你在货栈和码头之间来回做工。邻居周师傅在巷口修东西，说缺一个搭手的人；货栈那边也问你要不要接常工。', 'craft', [
      option('learn-repair', '跟周师傅学修木器', '花费 1 两 · 动手 +1 · 学会修补', {
        cost: 1,
        abilities: { hands: 1 },
        evidence: ['learned', 'crafted'],
        outcome: '你白天做工，傍晚跟着周师傅拆旧木板、修门框。第一周结束时，你能独立补好一条裂缝了。',
      }),
      option('save-money', '把工钱都攒下来', '收入 2 两 · 先把缺口补上', {
        income: 2,
        outcome: '你把两笔临工的钱并在一起收好，又多接了一趟夜工。账本上的数目往前挪了一截。',
      }),
      option('use-tools', '用家里的工具练手艺', '无花费 · 动手 +1', {
        abilities: { hands: 1 },
        outcome: '家里的工具趁手，你收工后自己练到半夜，手艺一点点上手，也没有花学徒钱。',
      }, { requires: { assetIds: ['asset:basic-tools'] }, cashIn: ['asset:basic-tools'] }),
      option('use-notes', '照家传笔记安排做工与休息', '筹划 +1 · 不耽误进账', {
        abilities: { plan: 1 },
        outcome: '你按笔记里的法子把做工和休息错开，白天不误工，夜里也能顾上家里的事。',
      }, { requires: { educationMin: 1 }, cashIn: ['education:notes', 'education:teaching'] }),
      option('use-reputation', '凭交付记录被商行请去做工', '收入 2 两 · 商行直接点名', {
        income: 2,
        outcome: '商行记着家里的交付记录，直接请你去帮忙，工钱比码头临工实在。',
      }, { requires: { reputationMin: 1 }, cashIn: ['reputation:delivery', 'reputation:merchant'] }),
    ]),
    event('s-opportunity', 'opportunity', '商行的一趟急货', '阿岑捎来消息：河港的商行要赶在汛期前运一批货，缺熟悉河岸的人，工钱是平时的两倍，但要连续做满十天。', 'journey', [
      option('take-urgent', '接下这趟急活', '收入 3 两 · 要放下货栈的常工', {
        income: 3,
        flags: ['took-urgent'],
        outcome: '你随船走了十天，夜里就睡在货舱边。船到岸时，商行按约付了双倍的工钱。货栈那边的常工，已经让给别人了。',
      }),
      option('partial', '只做到岸卸货那几天', '收入 1 两 · 保住眼前的常工', {
        income: 1,
        flags: ['kept-steady'],
        outcome: '你只参与了到岸卸货的部分，工钱少一些，但货栈的常工没有丢。',
      }),
      option('use-reputation', '凭交付记录谈下整趟包工', '收入 4 两 · 商行直接交办', {
        income: 4,
        flags: ['took-urgent'],
        outcome: '商行信得过家里的交付记录，把这趟货整批包给你，连押运的差事也一并谈了。货栈的常工只能先放下。',
      }, { requires: { reputationMin: 1 }, cashIn: ['reputation:delivery', 'reputation:merchant'] }),
      option('use-merchant', '凭商行往来把急货和常工都排开', '收入 4 两 · 常工仍在', {
        income: 4,
        flags: ['kept-steady'],
        outcome: '商行还记着长期往来，同意你把急货拆成两段。工钱仍厚，货栈的常工也没有丢。',
      }, { requires: { reputationMin: 2 }, cashIn: ['reputation:merchant'] }),
    ], { alts: [{ title: '镇上的冬前集市', text: '冬前集市缺人看摊、运货。工钱比货栈厚，但要占去连续几天，货栈那边的常工就顾不上了。' }] }),
    event('s-apply', 'apply', '用上积下的办法', '周师傅把几户人家修门窗的活介绍给你。这些活比临工赚得多，但需要手艺和安排。', 'craft', [
      option('repair-home', '接修理活，用家里的工具', '收入 2 两 · 省下租借费', {
        income: 2,
        outcome: '你用家里的工具补好了几扇松动的窗。主家按约付了钱，工具一件不少地收回家。',
      }, { requires: { assetIds: ['asset:basic-tools'] }, cashIn: ['asset:basic-tools'] }),
      option('rent-tools', '租工具接修理活', '花费 1 两 · 收入 2 两 · 手生，租金照付', {
        cost: 1,
        income: 2,
        evidence: ['crafted'],
        outcome: '你租了一套工具，对着活计摸索着做完，扣去租金后还剩下两两。',
      }),
      option('skilled-repair', '凭学过的手艺自己接活', '收入 3 两 · 不必租工具 · 需要动手 1', {
        income: 3,
        evidence: ['crafted'],
        outcome: '你已经会修，自己上手把活做完，省下了租金，主家也多给了一点工钱。',
      }, { requires: { ability: { ability: 'hands', level: 1 } }, unmetText: '需要先学会修补，才能不租工具自己接活。' }),
      option('steady-carry', '只做熟悉的搬运', '收入 1 两 · 稳稳当当', {
        income: 1,
        outcome: '你推掉了修理的邀约，继续做搬运。收入不多，但每天都有进账。',
      }),
    ]),
    event('s-difficulty', 'difficulty', '入冬前的一场雨', '连下三天暴雨，码头停了工，约定补足的数目还差一截。屋顶的瓦也在漏水，修瓦又是一笔开销。', 'hearth', [
      option('night-work', '冒雨多接夜工', '收入 2 两', {
        income: 2,
        outcome: '你披着蓑衣接了几天夜工，工钱照结，人也累得够呛。账本上的缺口又小了一截。',
      }),
      option('ask-advance', '找商行商量预支工钱', '收入 3 两 · 需要沟通 1', {
        income: 3,
        outcome: '你把自己做工的底细说清楚，商行掌柜同意先预付一部分，记在账上从工钱里扣。',
      }, { requires: { ability: { ability: 'talk', level: 1 } }, unmetText: '需要先通过商量建立起沟通的信任。' }),
      option('repair-roof', '先修屋瓦，免得雨夜难捱', '花费 1 两 · 收入 1 两', {
        cost: 1,
        income: 1,
        evidence: ['crafted'],
        outcome: '你咬牙先修了屋瓦。雨停了，屋子没有再漏，也顺手帮邻居补了一处，挣回一点工钱。',
      }),
      option('use-regular', '靠留下的常工撑过停工的几天', '收入 1 两 · 需要先保住常工', {
        income: 1,
        outcome: '货栈的常工还在。停工那几天你仍能做些室内的活，进账不多，但没有断。',
      }, { requires: { flags: ['kept-steady'] }, unmetText: '接了急活之后，货栈的常工已经让了出去。' }),
    ], { alts: [{ title: '货栈突然减工', text: '入冬前货栈客少，白日的活一下子少了。约定补足的数目还差一截，家里等着这笔钱。' }] }),
    event('s-settle', 'settle', '入冬前的交付', '约定的日子到了。母亲把账本摊开，你把自己补足的数目一笔笔对上去。冬前的这笔开支，现在怎样收场？', 'hearth', [
      option('pay-off', '按约交足，把账目记清', '从本代预算扣除约定开支', {
        payTarget: true,
        evidence: ['delivered'],
        outcome: '你把约定开支如数补足，药铺和家里都松了口气。账本合上的时候，你知道这件事做成了。',
      }, { requires: { flags: ['enough-funds'] }, unmetText: '还没补足约定开支，不能写成已经交清。' }),
      option('pay-and-reserve', '交足之余，把结余留作储备', '扣除约定开支，再花 5 两备下过冬储备', {
        payTarget: true,
        cost: 5,
        evidence: ['delivered', 'reserved'],
        grantAsset: { id: 'security:reserve', category: 'security', level: 2, name: '过冬储备', benefit: '危机事件可动用储备抵补，避免损失。' },
        outcome: '你交足了开支，又拿出五两单独收好，留作过冬的储备。家里从此多了一层底气。',
      }, { requires: { flags: ['enough-funds'] }, unmetText: '需要先补足约定开支，才有结余可留。' }),
      option('buy-tools', '交足开支，并用结余买工具', '扣除约定开支，再花 3 两买下工具', {
        payTarget: true,
        cost: 3,
        evidence: ['delivered'],
        grantAsset: { id: 'asset:basic-tools', category: 'asset', level: 1, name: '基础工具', benefit: '可接修理活，省下租借费；独立做工任务更快入门。' },
        outcome: '你交足了开支，又把三两结余换成一套趁手的工具。工具放在家里，往后能用的地方还很多。',
      }, { requires: { flags: ['enough-funds'] }, unmetText: '需要先补足约定开支，才有结余可留。' }),
      option('installment', '与药铺说定分期，余款开春再还', '先不交足，把现有的数目说清楚', {
        outcome: '你和药铺说定余款开春再还。眼前的数目没有交清，这个冬天还得再商量。',
      }),
    ]),
  ],
  outcomeRules: { fundsTarget: 8, partialRatio: 0.7 },
  familyEligibility: { maxSecurity: 1 },
  ageSpan: [18, 40],
  settlementCopy: {
    achieved: '你赶在入冬前补足了约定开支，这一冬可以安稳过去。',
    partial: '你补足了大部分约定开支，余款与药铺说定来年开春再还，日子紧，但没有断。',
    failed: '入冬前没能凑足约定开支，家里靠商量和赊欠撑过了冬天，也记下了这笔教训。',
  },
};

// ---------------- 任务二：取得独立做工资格 ----------------

export const MISSION_INDEPENDENT_WORK: MissionDefinition = {
  id: 'independent-work',
  title: '取得独立做工资格',
  goalText: '完成学徒学习，交出一件合格作品，取得独立做工的资格。',
  progressKind: 'stages',
  progressLabel: '独立做工资格',
  stages: ['学徒', '备齐', '合格作品'],
  events: [
    event('i-context', 'context', '师傅的门', '家里的生活已经安稳下来。周师傅问你想不想真正学一门手艺：先当学徒，学会修补木器，交出一件合格作品，就能独立接活。你答应了，第二天一早站在师傅的门前。', 'craft', [
      option('apprentice', '正式拜师，从头学起', '花费 2 两 · 动手 +1', {
        cost: 2,
        abilities: { hands: 1 },
        evidence: ['learned'],
        outcome: '你把拜师礼放到师傅的桌上。从认识木料开始，每天收工后练两个时辰，磨刀、开榫、合缝。',
      }),
      option('watch-first', '先跟着看，不急着拜师', '筹划 +1 · 收入 1 两', {
        abilities: { plan: 1 },
        income: 1,
        outcome: '你跟在师傅身边看了一个月，帮着打下手，把工具和木料的门道记在心里，也照旧接了些零活。',
      }),
      option('use-tools', '用家里的工具先认熟木料', '无花费 · 动手 +1', {
        abilities: { hands: 1 },
        evidence: ['crafted'],
        outcome: '家里有趁手的工具，你在拜师前就先认熟了木料和刀法，上手比别人快一截。',
      }, { requires: { assetIds: ['asset:basic-tools'] }, cashIn: ['asset:basic-tools'] }),
      option('use-notes', '照家传笔记的图样入门', '筹划 +1 · 更快看懂结构', {
        abilities: { plan: 1 },
        outcome: '家里的笔记里画着木料与榫卯的图样。你先看懂结构，再上手，省下了不少摸索的时间。',
      }, { requires: { educationMin: 1 }, cashIn: ['education:notes', 'education:teaching'] }),
      option('use-reputation', '凭家里的名声，师傅免了拜师礼', '无花费 · 动手 +1', {
        abilities: { hands: 1 },
        evidence: ['learned'],
        outcome: '师傅听说是这家出来的孩子，摆手免了拜师礼。你把这份情记在心里，学得格外用力。',
      }, { requires: { reputationMin: 1 }, cashIn: ['reputation:delivery', 'reputation:merchant'] }),
      option('use-security', '家里已安顿，可以专心学艺', '收入 2 两 · 家里有余力供你', {
        income: 2,
        outcome: '家里安稳，吃用和学费都接得上。你得以把整段日子用在学艺上，不必为生计分心。',
      }, { requires: { securityMin: 1 }, cashIn: ['security:home', 'security:reserve'] }),
    ]),
    event('i-prepare', 'prepare', '学徒的日子', '学徒的日子从磨刨刀开始。师傅说，手艺是磨出来的，急不得；但你也不甘心只做打下手的活。', 'craft', [
      option('master-steps', '把每道工序都练熟', '花费 1 两 · 达到「备齐」阶段', {
        cost: 1,
        progress: { stage: '备齐' },
        outcome: '你照着师傅的工序一遍遍练：划线、下料、开榫、合缝。练到手上有了准头，师傅说可以备料了。',
      }),
      option('help-only', '继续做帮手，不冒进', '收入 1 两 · 学徒阶段多留一段', {
        income: 1,
        outcome: '你不急着备料，继续做帮手挣些零钱。师傅没催，只说火候到了自然知道。',
      }),
      option('use-tools', '用家里的工具练手', '无花费 · 达到「备齐」阶段', {
        progress: { stage: '备齐' },
        outcome: '家里的工具趁手，你在收工后自己练到半夜，提前把备料这一步做扎实了，也没花租借费。',
      }, { requires: { assetIds: ['asset:basic-tools'] }, cashIn: ['asset:basic-tools'] }),
      option('use-notes', '照家传笔记排练习计划', '无花费 · 达到「备齐」阶段', {
        progress: { stage: '备齐' },
        outcome: '笔记里的工序表帮你看清了练习的顺序。你照着排了几周，把该练的都练到了。',
      }, { requires: { educationMin: 1 }, cashIn: ['education:notes', 'education:teaching'] }),
      option('use-reputation', '商行送来练习用的木料', '无花费 · 收入 1 两 · 达到「备齐」阶段', {
        income: 1,
        progress: { stage: '备齐' },
        outcome: '商行照顾家里的名声，送来一批练习用的边角料。你省下了买料的钱，也练够了手。',
      }, { requires: { reputationMin: 1 }, cashIn: ['reputation:delivery', 'reputation:merchant'] }),
      option('use-security', '家里安稳，买料不愁', '无花费 · 达到「备齐」阶段', {
        progress: { stage: '备齐' },
        outcome: '家里储备宽裕，你买齐了练习用的料，不必为开销分心，只管把手艺练扎实。',
      }, { requires: { securityMin: 1 }, cashIn: ['security:home', 'security:reserve'] }),
      option('use-teaching', '按编订的家学安排学徒进度', '无花费 · 筹划 +1 · 达到「备齐」', {
        abilities: { plan: 1 },
        progress: { stage: '备齐' },
        outcome: '家学把工序和进度写得清楚。你照着排了几周，该练的都练到了，也没另花钱。',
      }, { requires: { educationMin: 2 }, cashIn: ['education:teaching'] }),
    ]),
    event('i-opportunity', 'opportunity', '商行的一批椅凳', '商行要做一批椅凳，师傅接下了一半，让你试着独立完成一部分。这是练习，也是机会。', 'commerce', [
      option('take-batch', '接下一批椅凳独立完成', '收入 3 两 · 积累实做经历', {
        income: 3,
        evidence: ['crafted'],
        outcome: '你独立做了四只凳腿，尺寸和师傅的样板分毫不差。商行的人看了，没有挑出毛病。',
      }),
      option('negotiate-deadline', '和商行说定交期与范围', '沟通 +1 · 收入 1 两', {
        abilities: { talk: 1 },
        income: 1,
        outcome: '你当面把能做和不能做的部分说清楚，商行的人反倒放心，按说定的范围把活交给了你。',
      }),
      option('use-reputation', '凭家里的交付记录接整批', '收入 3 两 · 商行直接交办', {
        income: 3,
        evidence: ['crafted'],
        outcome: '商行记着家里的交付记录，把整批椅凳都交给了你。师傅只在一旁看着，没有插手。',
      }, { requires: { reputationMin: 1 }, cashIn: ['reputation:delivery', 'reputation:merchant'] }),
      option('use-merchant', '凭商行往来接下整批并预支工钱', '收入 4 两 · 实做经历', {
        income: 4,
        evidence: ['crafted'],
        outcome: '商行按长期往来预付了一部分工钱，把整批椅凳都交给你。师傅只在一旁看着。',
      }, { requires: { reputationMin: 2 }, cashIn: ['reputation:merchant'] }),
    ], { alts: [{ title: '邻里托做一套柜', text: '巷口几户人家托你做一套小柜。这是练习，也是把名字传出去的机会。' }] }),
    event('i-apply', 'apply', '把练习搬回家', '家里的条件能帮你不少：工作间、工具、笔记。你把练习搬回家里做，师傅偶尔过来看看。', 'craft', [
      option('use-workshop', '用家里的工作间备料', '无花费 · 收入 1 两', {
        income: 1,
        outcome: '工作间里工具齐全，你夜里也能安心练习，还顺手接了一笔小修，挣回一点零钱。',
      }, { requires: { assetIds: ['asset:workshop'] }, cashIn: ['asset:workshop'] }),
      option('borrow-shop', '借用师傅的工坊', '花费 1 两 · 收入 1 两', {
        cost: 1,
        income: 1,
        outcome: '你借用师傅的工坊练习，工坊里样样齐全，就是每月要付一点借用费。',
      }),
      option('write-notes', '把学过的工序整理成笔记', '筹划 +1 · 给自己留一份方法', {
        abilities: { plan: 1 },
        evidence: ['learned'],
        outcome: '你把学过的工序一条条写下来，连做坏过的榫头也记了原因。这本笔记越写越厚。',
      }),
    ]),
    event('i-difficulty', 'difficulty', '交付前的坎', '交作品的日子快到了。你发现自己对榫头的把握还不够稳，做坏了两只凳腿。师傅没有责备，只问你想怎么补。', 'craft', [
      option('redo', '拆掉重做，直到合格', '花费 1 两 · 动手 +1 · 达到「合格作品」', {
        cost: 1,
        abilities: { hands: 1 },
        progress: { stage: '合格作品' },
        evidence: ['crafted'],
        outcome: '你把做坏的部分拆掉重来，这一次手上稳了许多。两只凳腿重新做好，和样板对得分毫不差。',
      }),
      option('ask-mentor', '请师傅再指点几天', '无花费 · 把火候磨够再说', {
        outcome: '你没有急着交，请师傅又指点了几日。手上的功夫还差一点，但你已经知道该往哪里用劲。',
      }),
      option('use-notes', '翻出家学笔记对照做坏的地方', '无花费 · 达到「合格作品」', {
        progress: { stage: '合格作品' },
        evidence: ['crafted'],
        outcome: '笔记里正好记着榫头的做法。你对照着找出错处，重新做了一遍，这次稳稳当当。',
      }, { requires: { educationMin: 1 }, cashIn: ['education:notes', 'education:teaching'] }),
      option('use-teaching', '按家学把做错的工序一条条拆开', '无花费 · 达到「合格作品」', {
        progress: { stage: '合格作品' },
        evidence: ['crafted'],
        outcome: '家学把榫头的对错写得明白。你按条目拆开重做，这一次尺寸稳住了。',
      }, { requires: { educationMin: 2 }, cashIn: ['education:teaching'] }),
    ], { alts: [{ title: '交期提前了两天', text: '商行把交期提前了两天。你发现榫头还不够稳，做坏了两只凳腿。师傅没有责备，只问你想怎么补。' }] }),
    event('i-settle', 'settle', '交上合格的作品', '你把重新做好的椅凳搬到师傅面前。师傅一只只检查，开口问你准备怎样收场。', 'craft', [
      option('graduate', '请师傅检验，正式出师', '需要先交出合格作品', {
        evidence: ['delivered', 'crafted'],
        outcome: '师傅把每只椅凳都检查了一遍，然后把你叫到跟前：往后可以自己接活了。',
      }, { requires: { flags: ['work-accepted'] }, unmetText: '合格作品还没交上，还不能算出师。' }),
      option('graduate-work', '出师后先帮师傅做完这批活', '收入 2 两 · 需要先交出合格作品', {
        income: 2,
        evidence: ['delivered', 'crafted'],
        outcome: '你说先帮师傅把商行的活做完。师傅按工钱分了你一份，这也是你出师后的第一笔收入。',
      }, { requires: { flags: ['work-accepted'] }, unmetText: '合格作品还没交上，还不能算出师。' }),
      option('write-manual', '把学到的手艺整理成册', '留下家传手册 · 需要达到「合格作品」', {
        evidence: ['learned'],
        grantAsset: { id: 'education:notes', category: 'education', level: 1, name: '家传手册', benefit: '学习入口：次代可免费学基础方法，更快入门。' },
        outcome: '你把拜师以来学的东西整理成一本册子：工序、图样、做坏过的教训。这本册子留在了家里。',
      }, { requires: { flags: ['work-accepted'] }, unmetText: '需要先完成合格作品，整理成的册子才立得住。' }),
      option('leave-record', '把交付记录留在家里的名册上', '留下可靠交付记录 · 需要达到「合格作品」', {
        evidence: ['delivered'],
        grantAsset: { id: 'reputation:delivery', category: 'reputation', level: 1, name: '可靠交付记录', benefit: '引荐资格：商行机会门槛降低，合作任务更稳。' },
        outcome: '你把这批椅凳的交付过程记进家里的名册：谁家、什么活、什么时候交的。名册上的记录，就是往后的凭据。',
      }, { requires: { flags: ['work-accepted'] }, unmetText: '需要先完成合格作品，留下的记录才立得住。' }),
      option('not-ready', '作品未成，先记下学到的，改日再交', '未出师，把学到的留下', {
        evidence: ['learned'],
        outcome: '师傅看了看未完成的活计，说火候未到不必硬撑。你把这几个月学的记下，改日再来。',
      }),
    ]),
  ],
  outcomeRules: { stageAchieved: '合格作品', stagePartial: '备齐' },
  familyEligibility: { minSecurity: 1 },
  ageSpan: [20, 45],
  settlementCopy: {
    achieved: '你交出了合格的作品，正式取得独立做工的资格。',
    partial: '你学到了不少，但合格作品还差临门一脚，来年仍要继续磨。',
    failed: '学徒的路没有走完，你带着学到的一部分本事离开了师傅的门。',
  },
};

// ---------------- 任务三：让小铺稳定接单 ----------------

export const MISSION_SHOP_ORDERS: MissionDefinition = {
  id: 'shop-orders',
  title: '让小铺稳定接单',
  goalText: '完成试营阶段的三批订单，让铺子立得住。',
  progressKind: 'orders',
  progressLabel: '试营订单',
  orders: [
    { id: 'order-1', label: '商行椅凳' },
    { id: 'order-2', label: '邻里小修' },
    { id: 'order-3', label: '商行补货' },
  ],
  events: [
    event('o-context', 'context', '家里的铺子', '家里有了工作间，也有了商行的往来。你决定把铺子开起来：先试营三个月，完成三批订单，账目能维持，铺子才算立得住。', 'commerce', [
      option('set-rules', '先定下铺子的规矩', '筹划 +1 · 接单定价记账先立起来', {
        abilities: { plan: 1 },
        outcome: '你把接单、定价和记账的规矩一条条写下来，贴在铺子门口。规矩立住了，人心才稳。',
      }),
      option('find-orders', '先跑商行拉订单', '沟通 +1 · 订单要先谈下来', {
        abilities: { talk: 1 },
        outcome: '你挨家去商行和邻里问了一圈，把铺子的手艺和交期说清楚，也听回了大家的顾虑。',
      }),
      option('use-reputation', '靠商行的往来直接开张', '收入 1 两 · 开张就有生意', {
        income: 1,
        outcome: '商行还记着家里的往来，开张第一天就送来了第一批零活，铺子总算开了张。',
      }, { requires: { reputationMin: 1 }, cashIn: ['reputation:delivery', 'reputation:merchant'] }),
    ]),
    event('o-prepare', 'prepare', '第一批订单', '商行把第一批订单交了下来：一批椅凳，月底前交付。你对着清单盘算用料和工期。', 'commerce', [
      option('prepare-and-make', '接下椅凳订单，先备料', '花费 1 两 · 收入 2 两 · 交付「商行椅凳」', {
        cost: 1,
        income: 2,
        progress: { orderId: 'order-1' },
        evidence: ['delivered'],
        outcome: '你按清单备齐木料，日夜赶工，月底前把椅凳交付了。商行按约付了钱，账上添了一笔。',
      }),
      option('use-workshop', '用家里的工作间开工', '无花费 · 收入 2 两 · 交付「商行椅凳」', {
        income: 2,
        progress: { orderId: 'order-1' },
        evidence: ['delivered'],
        outcome: '工作间里工具齐全，你省下了租工坊的钱，椅凳如期交付，成本比别家低了一截。',
      }, { requires: { assetIds: ['asset:workshop'] }, cashIn: ['asset:workshop'] }),
      option('small-first', '先只接邻里的小修，摸清行情', '收入 1 两 · 不冒进', {
        income: 1,
        outcome: '你先把邻里的小修接下来，把行市和用料摸清。正式的订单在后面，口碑先要慢慢做。',
      }),
    ]),
    event('o-opportunity', 'opportunity', '商行补货的单子', '商行又递来一张补货的单子，说要得急，工钱给得也高。接不接，会影响铺子的名声。', 'journey', [
      option('take-extra', '接下补货，加班赶工', '收入 3 两 · 交付「商行补货」', {
        income: 3,
        progress: { orderId: 'order-3' },
        evidence: ['delivered'],
        outcome: '你接下补货，把工期排得满满当当。三天后货按时送到，商行当场结清了工钱。',
      }),
      option('decline-gracefully', '婉拒补货，把现有订单做稳', '沟通 +1 · 收入 1 两', {
        abilities: { talk: 1 },
        income: 1,
        outcome: '你和商行说清眼下的工期，婉拒了补货。对方没有不快，反而说你做事有分寸。',
      }),
      option('use-reputation', '凭交付记录说定分批交', '收入 2 两 · 交付「商行补货」', {
        income: 2,
        progress: { orderId: 'order-3' },
        evidence: ['delivered'],
        outcome: '商行信得过家里的记录，同意分批交付。你一边赶工一边送货，两边都没有耽误。',
      }, { requires: { reputationMin: 1 }, cashIn: ['reputation:delivery', 'reputation:merchant'] }),
      option('use-merchant', '凭长期往来直接拿到加急整单', '收入 4 两 · 交付「商行补货」', {
        income: 4,
        progress: { orderId: 'order-3' },
        evidence: ['delivered'],
        outcome: '商行按长期往来把加急整单交给你，工钱给得也厚。你按说定的日子交了货。',
      }, { requires: { reputationMin: 2 }, cashIn: ['reputation:merchant'] }),
    ], { alts: [{ title: '学堂来订一批桌椅', text: '镇上学堂要赶一批桌椅，说要得急，工钱给得也高。接不接，会影响铺子的名声。' }] }),
    event('o-apply', 'apply', '邻里的小修', '邻居陆续送来要修的桌椅门窗。这些活不大，却最见铺子的口碑。', 'craft', [
      option('finish-neighbors', '挨家做完，按约交付', '收入 2 两 · 交付「邻里小修」', {
        income: 2,
        progress: { orderId: 'order-2' },
        evidence: ['delivered'],
        outcome: '你挨家把活做完，说好什么时候交就什么时候交。邻居们把钱放在桌上，也把铺子记在了心里。',
      }),
      option('batch-workshop', '用工作间批量处理', '无花费 · 收入 2 两 · 交付「邻里小修」', {
        income: 2,
        progress: { orderId: 'order-2' },
        evidence: ['delivered'],
        outcome: '工作间把工序排开，你一天修好几件，还按约把每一件的工钱都记进了账。',
      }, { requires: { assetIds: ['asset:workshop'] }, cashIn: ['asset:workshop'] }),
    ]),
    event('o-difficulty', 'difficulty', '赶工与账目', '三批订单撞在一起，账目也乱了：商行的补货要提前交，邻里的小修催得急，账本上有一笔对不上。', 'commerce', [
      option('rush-extra', '先赶商行的补货', '收入 2 两 · 交付「商行补货」', {
        income: 2,
        progress: { orderId: 'order-3' },
        evidence: ['delivered'],
        outcome: '你把补货排在前面，加班赶了出来。商行收货时没有一句挑剔，说下次还找你。',
      }),
      option('balance-books', '先把账目理平', '筹划 +1 · 账目必须立得住', {
        abilities: { plan: 1 },
        outcome: '你关起门来把账一笔笔对清，找出那笔对不上的数目，原来是记串了行。账目理平，心里才踏实。',
      }),
      option('ask-help', '请熟悉的商行匀一匀工期', '收入 2 两 · 交付「商行补货」 · 需要沟通 1', {
        income: 2,
        progress: { orderId: 'order-3' },
        evidence: ['delivered'],
        outcome: '你当面把工期和难处说清，商行同意把补货的期限往后挪了两天。两边都按说好的做了。',
      }, { requires: { ability: { ability: 'talk', level: 1 } }, unmetText: '需要先通过沟通建立起信任。' }),
      option('use-reserve', '动用家里的储备垫付料款', '无花费 · 交付「商行补货」', {
        progress: { orderId: 'order-3' },
        evidence: ['delivered'],
        outcome: '料款一时周转不开，你从家里的储备里垫上，补货如期交付，没有耽误商行。',
      }, { requires: { securityMin: 2 }, cashIn: ['security:reserve'] }),
      option('use-teaching', '按家学把撞期的单子重新排开', '筹划 +1 · 交付「商行补货」', {
        abilities: { plan: 1 },
        progress: { orderId: 'order-3' },
        evidence: ['delivered'],
        outcome: '家学里的排期法子帮你把三批活错开。补货按新的次序交了，账目也没有再乱。',
      }, { requires: { educationMin: 2 }, cashIn: ['education:teaching'] }),
    ], { alts: [{ title: '账目对不上的那一夜', text: '三批订单撞在一起。账本上有一笔对不上，邻里的小修也催得急。铺子的口碑就看这一夜怎么收。' }] }),
    event('o-settle', 'settle', '试营结算', '试营三个月到期。你把订单、账目和收支摊在桌上，铺子的下一步由这次结算决定。', 'commerce', [
      option('settle-shop', '理平账目，正式接下铺子', '需要先交付全部三批订单', {
        evidence: ['delivered'],
        outcome: '你把账目理平，三批订单都有凭有据。铺子从这一天起，不再只是试营。',
      }, { requires: { flags: ['all-orders-done'] }, unmetText: '三批订单还没交齐，铺子还不能算立住。' }),
      option('keep-merchant', '理平账目，谈下长期往来', '留下商行往来 · 需要交付全部订单', {
        evidence: ['delivered'],
        grantAsset: { id: 'reputation:merchant', category: 'reputation', level: 2, name: '商行往来', benefit: '合作资格：经营任务信任门槛降低，订单来源更稳。' },
        outcome: '你带着完整的账目和交付记录去商行，谈下了长期往来的约定。铺子的订单从此有了着落。',
      }, { requires: { flags: ['all-orders-done'] }, unmetText: '需要先交付全部三批订单，才有资格谈长期往来。' }),
      option('write-method', '把经营方法整理成册', '编订家学 · 需要已有家传笔记', {
        evidence: ['learned'],
        grantAsset: { id: 'education:teaching', category: 'education', level: 2, name: '家学：经营方法', benefit: '家学入门：次代学习花费降低，可按家学排工期与用料。' },
        outcome: '你把试营三个月里学到的经营方法整理成册：怎么接单、怎么记账、怎么和商行往来。这本册子也留在了家里。',
      }, { requires: { assetIds: ['education:notes'] }, unmetText: '需要家里已有家传笔记，整理出的经营方法才能立住。' }),
      option('close-trial', '试营期先收束，铺子以后再说', '订单未齐，先把账留下', {
        outcome: '账目摊开，订单没有做满。你把铺子暂时收了，手艺和未了的单子都记在账上。',
      }),
    ]),
  ],
  outcomeRules: { ordersAchieved: 3, ordersPartial: 2 },
  familyEligibility: { requireAssets: ['asset:workshop'], minReputation: 1 },
  ageSpan: [22, 48],
  settlementCopy: {
    achieved: '铺子完成了试营，三批订单全部交付，正式立住了。',
    partial: '铺子接下了两批订单，离稳定接单还差一口气，试营期需要再延长。',
    failed: '试营的订单没能做满，铺子暂时关张，但手艺和账目都留了下来。',
  },
};