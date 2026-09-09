import { ABILITIES, ABILITY_NAMES, ABILITY_SKILLS, Ability, GrowthChoice, GrowthEffect, GrowthScene, GrowthState, Place } from '../core/growthModel';

function choice(id: string, text: string, preview: string, outcome: string, effect: GrowthEffect, later = ''): GrowthChoice {
  return { id, text, preview, outcome, effect, later: later || '这次做过的事，留成了以后可以使用的经验。' };
}
const scene = (id: string, slots: number[], title: string, text: string, choices: GrowthChoice[], extra: Partial<GrowthScene> = {}): GrowthScene =>
  ({ id, slots, title, text, choices, kind: 'hearth', ...extra });

export const SPECIALTIES = [
  { id: 'inspect', name: '先检查再动手', ability: 'hands' as Ability, statement: '拆开之前，先看清哪里出了问题。', effect: '修补时先定位损坏；稳定增加收益，并积累动手经验。' },
  { id: 'patient', name: '把细处做扎实', ability: 'hands' as Ability, statement: '不急着多做一件，先把手里这件交得出去。', effect: '熟悉的修补能交付得更完整，获得更高报酬。' },
  { id: 'reuse', name: '先用好手里的材料', ability: 'hands' as Ability, statement: '先看看旧东西还有哪一部分能用，不急着换掉全部。', effect: '在普通修补中合理利用旧料，保留更多家底。' },
  { id: 'negotiate', name: '先把约定说清', ability: 'talk' as Ability, statement: '把范围和时间说在前面，彼此才知道怎样承担。', effect: '协商工作范围，稳定增加收益，并积累沟通经验。' },
  { id: 'listen', name: '先听完对方的话', ability: 'talk' as Ability, statement: '先弄清各自舍不得什么，再找到都能接受的办法。', effect: '在具体合作中找到共同安排，获得更高报酬。' },
  { id: 'boundary', name: '把能承担的部分说清', ability: 'talk' as Ability, statement: '只答应自己能负责的部分，交付时才不必彼此埋怨。', effect: '明确合作边界，减少额外负担，保留更多家底。' },
  { id: 'sequence', name: '先排轻重缓急', ability: 'plan' as Ability, statement: '先做最不能耽误的事，其他事情才有地方安放。', effect: '排好工序，稳定增加收益，并积累筹划经验。' },
  { id: 'reserve', name: '给意外留余地', ability: 'plan' as Ability, statement: '别把每一份钱和时间都排满，临时变化才接得住。', effect: '安排备用工序，减少损耗，获得更高报酬。' },
  { id: 'review', name: '做完再核对一遍', ability: 'plan' as Ability, statement: '交出去之前，照着最初的清单再看一次。', effect: '交接时核清数量与费用，保留更多家底。' },
];

const practice = [
  choice('repair', '跟着周师傅练习修补', '动手 +1，学会修补木器；这次不赚工钱。', '你拆开旧木箱，把榫口重新对齐。周师傅只在最后扶了一下，接缝是你自己合上的。', { gain: { hands: 1 }, learn: 'repair' }),
  choice('agreement', '和阿岑一起商量交付安排', '沟通 +1，学会商量约定；把这段空闲用在合作上。', '你们把谁来做、什么时候交一项项说清。阿岑划掉了做不到的部分，也认真答应了留下的部分。', { gain: { talk: 1 }, learn: 'agreement', relation: { id: 'friend', label: '阿岑' } }),
  choice('ledger', '把手头的收支和顺序记下来', '筹划 +1，学会记账排程；这次不接额外的活。', '你对着纸重新排了顺序，发现有两项开支可以错开。第二天做事时，你第一次不必临时翻找。', { gain: { plan: 1 }, learn: 'ledger' }),
];

export const GROWTH_SCENES: GrowthScene[] = [
  scene('first-box', [0], '裂开的一只木箱', '十二岁的暑假，周师傅把一只裂开的木箱放在门口。母亲托你和阿岑送些东西过去。箱子需要修，东西也要有人核对；你决定先帮上哪一件事？', [
    choice('repair', '扶着木板，跟师傅补好裂口', '动手 +1，学会修补木器。', '周师傅教你顺着纹路找裂口。你钉歪了一次，拔出来重来，终于把木板扶稳。东西没有漏出去。', { gain: { hands: 1 }, learn: 'repair' }, '你记得木板怎样受力，下一次不必从头猜。'),
    choice('agreement', '把送货时间和分工说清楚', '沟通 +1，学会商量约定。', '你问清师傅需要多久，又和阿岑商量先送哪一袋。谁也没有白等，母亲也知道了你们晚回来的缘由。', { gain: { talk: 1 }, learn: 'agreement' }, '把安排提前说清，第一次帮你们省下一场误会。'),
    choice('ledger', '清点东西，排好装箱顺序', '筹划 +1，学会记账排程。', '你把重物放在下面，易碎的另包起来，在纸上逐项画勾。箱子装好了，一样东西也没有落下。', { gain: { plan: 1 }, learn: 'ledger' }, '那张清单留下来，你知道事情可以按顺序做好。'),
  ], { kind: 'childhood' }),
  scene('offer-town', [1], '师傅桌上的一张便条', '周师傅最近接到几笔修补活，问你愿不愿意放学后来帮忙。家里暂时走不开，也可以只在空闲做些短工。这是一段可以试试的生活，还不必决定一辈子。', [
    choice('accept', '留在小城，试着做修理帮工', '进入修理生活，动手 +1，家底 +1。', '周师傅给你腾出半张桌子。你先负责拆旧钉和整理木料，领到了第一份工钱。', { place: 'town', identity: '修理帮工', gain: { hands: 1 }, money: 1 }),
    choice('stay', '先做短工，给家里留些余地', '家底 +2；暂不承诺固定工作。', '你接了搬运和整理的零活，把工钱带回家。周师傅说，想学的时候仍可以来问。', { identity: '小城短工', money: 2, gain: { plan: 1 } }),
  ], { opportunity: 'town', kind: 'craft' }),
  scene('offer-harbor', [1], '来自河港的消息', '阿岑跟家人搬到了河港，来信说货栈缺一个愿意仔细做事的帮工。他能介绍掌柜见一面，也说河边的日子得重新适应。母亲把信放回你手里，让你自己想想。', [
    choice('accept', '去河港，从整理货物做起', '迁居河港，筹划 +1，家底 +1。', '阿岑陪你见了掌柜林遥。你们清点完一船木箱，掌柜留下你试做普通帮工，先按日付钱。', { place: 'harbor', identity: '货栈帮工', gain: { plan: 1 }, money: 1, relation: { id: 'lin', label: '掌柜林遥' } }),
    choice('stay', '留下做短工，暂不搬家', '家底 +2；保留与阿岑的联系。', '你回信说现在还想留在家附近。阿岑寄来河港的地址，你把它夹在旧清单里，继续接身边的短工。', { identity: '小城短工', money: 2, gain: { talk: 1 } }),
  ], { opportunity: 'harbor', kind: 'journey' }),
  scene('offer-market', [1], '街市里的一把钥匙', '亲属林遥的小店需要人照看。他请母亲捎话，说愿意教你认货、记账；店就在邻镇，过去便要换一段生活。你手里的钥匙还没有接过来。', [
    choice('accept', '去街市帮店，慢慢学着认货', '进入街市，沟通 +1，家底 +1。', '林遥带你认了一遍货架。第一天你只负责招呼和找零，晚上关店时，他把约好的工钱交给你。', { place: 'market', identity: '店铺帮工', gain: { talk: 1 }, money: 1, relation: { id: 'lin', label: '店主林遥' } }),
    choice('stay', '先留在家附近接零活', '家底 +2；不承担看店的承诺。', '你谢过林遥，约好以后去看看。眼下你仍在小城做短工，工钱不多，却能安排自己的时间。', { identity: '小城短工', money: 2, gain: { hands: 1 } }),
  ], { opportunity: 'market', kind: 'commerce' }),
  scene('practice-town', [2], '属于自己的半天', '在小城的生活渐渐有了节奏。周师傅把旧工具借给你，阿岑也正好回来看家人。你想用这半天，把一件还不熟悉的事做扎实。', practice, { places: ['town'], kind: 'craft', continuation: true }),
  scene('practice-harbor', [2], '一船货之后', '河港的货已经卸完。周师傅随送木料的船来到这里，阿岑收起绳索，问你下半天想学些什么。货箱、交接单和未结清的账都还在桌上。', practice, { places: ['harbor'], kind: 'commerce', continuation: true }),
  scene('practice-market', [2], '关店前的空闲', '街市今天散得早。周师傅来送修好的柜门，阿岑顺路带来母亲的口信。你们在屋檐下坐了片刻，你想把手头的一项本领练好。', practice, { places: ['market'], kind: 'commerce', continuation: true }),
  scene('prepare', [4], '想给往后留什么', '这些年，你在{place}已经摸清了眼前工作的门道。下一段日子还没有定下来。桌上是积下的工钱、旧工具和几封来信，你可以主动为一种可能作准备。', [
    choice('learn', '把空闲留给练习，给旧工具做维护', '动手 +1；以后相关学习机会更容易出现。', '你修好了常用工具，又试做了几个接头。没有多赚一笔钱，但手上的方法更稳了。', { gain: { hands: 1 }, learn: 'repair', intention: 'learn' }),
    choice('earn', '接一笔普通活，把钱存下来', '家底 +3，筹划 +1；以后更留意收入机会。', '你按约完成了普通工作，扣清开支，把余钱单独收好。眼前没有惊喜，往后却多了可安排的家底。', { money: 3, gain: { plan: 1 }, intention: 'earn' }),
    choice('explore', '联系旧识，打听外面的日子', '沟通 +1；以后更容易遇见外地机会，去不去仍由你决定。', '你给阿岑和周师傅写信，又问了几位来往的人。没有人许诺一份好工作，但你知道了谁在哪里、哪些地方正在变化。', { gain: { talk: 1 }, intention: 'explore' }),
  ]),
  scene('turn-town', [5], '一个可以回头的机会', '周师傅来信，说小城还有几户人家等着修门窗，自己却忙不过来了。他愿意把普通活介绍给你。你在{place}已有自己的生活，接下这件事，就要重新安排往后。', [
    choice('accept', '接下介绍，去小城做修理活', '成为独立修理人；动手 +1，家底 +2。旧本领全部保留。', '你从几扇松动的门窗开始，复杂的部分仍请周师傅把关。客户付了普通修理的工钱，你也开始为自己的交付负责。', { place: 'town', identity: '独立修理人', gain: { hands: 1 }, learn: 'repair', money: 2 }),
    choice('stay', '谢过师傅，继续经营眼前生活', '保持当前工作，家底 +2，筹划 +1。', '你把自己的安排写回去。周师傅没有催促，只说工具用坏了可以来问。你接着做完手里的活，按约领了钱。', { money: 2, gain: { plan: 1 } }),
  ], { opportunity: 'town', kind: 'craft' }),
  scene('turn-harbor', [5], '新航线的招工告示', '阿岑送来消息：河港换了运输安排，货栈正在招熟悉交接的人。先从普通工作做起，之后才看能不能负责一条线。这次机会可能改变你的生活，也可能只是路过。', [
    choice('accept', '去河港，试着接手交接工作', '成为货栈经手人；筹划 +1，家底 +2。', '阿岑介绍你参加了交接。你按清单核完一批货，留下来负责普通班次。过去积下的办法，都跟着你到了河边。', { place: 'harbor', identity: '货栈经手人', gain: { plan: 1 }, learn: 'ledger', money: 2, relation: { id: 'friend', label: '阿岑' } }),
    choice('stay', '留下，把现在的事情做好', '保持当前工作，家底 +2，沟通 +1。', '你请阿岑替自己谢过介绍，重新和眼前的合作者确认了安排。外面的船照常开走，你也有要继续的事情。', { money: 2, gain: { talk: 1 } }),
  ], { opportunity: 'harbor', kind: 'journey' }),
  scene('turn-market', [5], '街角腾出的位置', '林遥打算缩短看店的时间，想找人一起照管街市的铺面。他愿意先按做事分账，场地不用一次买下。你也可以留在{place}，不必因为机会出现就答应。', [
    choice('accept', '去街市合营，从共同看店开始', '成为街市合营人；沟通 +1，家底 +2。', '你和林遥写清了看店、进货和分账的安排。第一笔结算扣清双方开支后，你拿到了自己的那一份。', { place: 'market', identity: '街市合营人', gain: { talk: 1 }, learn: 'agreement', money: 2, relation: { id: 'lin', label: '合作者林遥' } }),
    choice('stay', '不接铺面，继续眼下的安排', '保持当前工作，家底 +2，动手 +1。', '你没有接过钥匙，转而修整了手边的工具，完成一笔普通工作。林遥说，以后路过仍欢迎来坐坐。', { money: 2, gain: { hands: 1 } }),
  ], { opportunity: 'market', kind: 'commerce' }),
];

const PROJECTS: Record<Place, { title: string; text: string; object: string; modest: string; finish: string; kind: GrowthScene['kind'] }> = {
  town: { title: '让旧屋再住得下去', text: '母亲常住的旧屋需要整修，周师傅愿意一起看看。你不必一口气修完所有地方，可以选择自己真正承担得起的一部分。', object: '旧屋整修', modest: '先修好一间能安心住的屋子', finish: '傍晚的灯照在平整的门框上，母亲推门时不用再抬起门板。', kind: 'hearth' },
  harbor: { title: '一趟由你安排的货', text: '阿岑问你愿不愿意负责一趟社区的物资运输。货栈可以提供普通工具，困难的部分需要提前安排。你终于可以决定怎样把事情做成。', object: '物资运输', modest: '先承担一批近途物资', finish: '最后一箱物资平稳落地，等候的人照着清单领走了自己的东西。', kind: 'journey' },
  market: { title: '把小店留给日常', text: '林遥想把铺面整理成邻里能长期使用的小店，请你一起做一次改造。不必追求开得最大，但你希望留下一个真正好用的地方。', object: '小店改造', modest: '先整理好常用的一排柜台', finish: '货物各归其位，邻居进门就能找到常用的东西，柜台旁也留出了坐下的位置。', kind: 'commerce' },
};

const PAYOFFS: Record<Place, Array<{ title: string; text: string; methods: Record<Ability, string> }>> = {
  town: [
    { title: '又是一只裂开的木箱', text: '邻居抱来一只裂开的木箱。你想起十二岁那天的门口，如今修补、商量和安排，已经有了自己的办法。', methods: { hands: '你找准裂口，重新固定木板，邻居试着提了两次，里面的东西稳稳当当。', talk: '你和邻居说清修补范围，再把复杂的部分请周师傅处理，自己负责交付，对方按约付了协调与帮工的钱。', plan: '你列出材料和工序，把能够同时做的部分排在一起，和周师傅配合完成了交付，没有多买材料。' } },
    { title: '临时多出的几扇窗', text: '小城突然下了一场大雨，几户人家的木窗需要修整。周师傅也在帮忙。过去你只会等人安排，如今可以拿出自己的方法。', methods: { hands: '你逐扇检查松动的接缝，普通损坏当场就修好，只把最难的一扇留给师傅。', talk: '你先问清哪家最着急，再说定材料和交期。邻居们按商量好的顺序送来窗框，按约付了协调的钱。', plan: '你按损坏和位置列好顺序，让搬运与修补接得上。原本拥堵的半天变得有条不紊。' } },
    { title: '那扇门已经不难修', text: '你负责的旧屋里，一扇木门又有些松动。这次只是熟悉的小问题，原先积累的本领足够派上用场。', methods: { hands: '你顺着旧接缝补紧木榫，门重新合拢。这次不用买新的门板，剩下的费用结回你手里。', talk: '你问清住户什么时候方便，约好师傅帮忙的部分，自己完成交接，省掉了一趟白跑的费用。', plan: '你把已有的余料找出来，配合师傅按顺序处理，省下材料与搬运的开支。' } },
  ],
  harbor: [
    { title: '开船前的那只货箱', text: '一只装货的木箱裂开了，阿岑请你一起处理。小时候做过的事，竟在离家后的河边又用得上。', methods: { hands: '你找出能补的裂口，固定好箱底。货没有撒落，掌柜把省下的一部分损耗费算作你的报酬。', talk: '你和阿岑说清换箱与装船的顺序，又向掌柜确认交期。两边不再互相催促，合作按约完成。', plan: '你先装耐放的货，再腾出空箱装易碎物，照清单逐项核对，船按时离岸。' } },
    { title: '码头上拥挤的一天', text: '两条船赶在一起靠岸，货箱、交接人和清单挤在同一段码头。阿岑站在你身边，等你提出一个可执行的办法。', methods: { hands: '你把松动的木托修牢，让装卸的人不必反复停下换托盘。', talk: '你分别问清两边最急的货，再把先后次序说定，争执停下来，大家开始照约定做事。', plan: '你把卸货位置和交接清单对应起来，先清出通道，随后两条船都顺利完成了交接。' } },
    { title: '熟悉的箱底与清单', text: '你负责的那批物资到了最后一段交接。几只旧箱和一张容易看错的清单摆在眼前，这些已经难不倒有经验的你。', methods: { hands: '你把箱底补牢，避免最后一段搬运洒漏，节余按约结算给你。', talk: '你与收货的人逐项确认数量，先解释容易误会的部分，交接没有发生争执。', plan: '你按领取顺序重排箱子和清单，装卸一次完成，省下了额外搬运费用。' } },
  ],
  market: [
    { title: '柜台后的小麻烦', text: '街市的木柜抽屉卡住了，几笔找零也还没核清。林遥问你先处理哪一件事。早年学过的办法，在这里也能帮上忙。', methods: { hands: '你找出抽屉受潮的边角，修平后装回，省下了换柜子的开支。', talk: '你和顾客逐项核对原先说好的价钱，林遥找回漏记的一笔，把协调这件事的报酬结给你。', plan: '你分开未结和已结的账，一笔笔对清零钱，原本以为少掉的钱重新对上了。' } },
    { title: '赶集日的长队', text: '街市突然热闹起来，林遥忙着取货，柜台前排起长队。你已经积下的本领，让你不必只是在旁边着急。', methods: { hands: '你修牢摇晃的货架，增出一个稳定的取货面，让林遥可以放心搬货。', talk: '你问清顾客需要什么，把能够一起处理的事情先说定，来回确认少了，队伍慢慢向前。', plan: '你把热卖货放到近处，再分开付款和取货，原先堵住的柜台顺畅起来。' } },
    { title: '给熟客留好的地方', text: '小店改造到了可以试用的时候。林遥请几位熟客来看看，你眼前是熟悉的木柜、货物和交接安排。', methods: { hands: '你修平柜台的一处毛边，调整木隔板，旧柜子继续好用，省下的材料钱也留了下来。', talk: '你听熟客说完哪里不方便，与林遥说定一项调整，试用顺利结束。', plan: '你照常用顺序重新摆货，把核账的位置单独留出来，试用时没有人再来回找东西。' } },
  ],
};

export function payoffScene(g: GrowthState, slot: number): GrowthScene {
  const index = slot === 3 ? 0 : slot === 6 ? 1 : 2;
  const authored = PAYOFFS[g.place][index];
  const ranked = [...ABILITIES].sort((a, b) => g.abilities[b] - g.abilities[a]);
  const ability = ranked[0];
  const advanced = choice('practiced', `用已经练熟的${ABILITY_NAMES[ability]}办法处理`, `需要${ABILITY_NAMES[ability]} 2 · 稳定完成，家底 +3。`, authored.methods[ability], { money: 3 }, '以前需要人带着做的事，这次你已经可以从容安排。');
  advanced.ability = ability; advanced.level = 2; advanced.skill = ABILITY_SKILLS[ability];
  const options: GrowthChoice[] = [
    choice('help', '先承担自己能做的普通部分', '无额外开支，家底 +1；把复杂部分交给现场的合作者。', '你先做清点、整理和递送，没有独自承担还不会的部分。其他人接着处理，完成后你拿到了普通帮工的报酬。', { money: 1 }),
    advanced,
  ];
  for (const learned of g.specialties) {
    const def = SPECIALTIES.find(s => s.id === learned.id)!;
    const develops = ['inspect', 'negotiate', 'sequence'].includes(def.id);
    options.push({ ...choice(`specialty:${def.id}`, `照自己的方法：${def.name}`, develops ? `运用专长 · 家底 +3，${ABILITY_NAMES[def.ability]} +1。` : '运用专长 · 稳定完成，家底 +4。', authored.methods[def.ability], { money: develops ? 3 : 4, gain: develops ? { [def.ability]: 1 } : undefined }, `你照着“${def.name}”做了一次，旧经历在新的生活中有了实际用途。`), specialtyId: def.id, ability: def.ability });
  }
  return scene(`payoff-${g.place}-${index}`, [slot], authored.title, authored.text, options, { kind: PROJECTS[g.place].kind });
}

export function projectScene(g: GrowthState, slot: number): GrowthScene {
  const p = PROJECTS[g.place];
  if (slot === 7) return scene(`project-${g.place}`, [7], p.title, p.text, [
    choice('hands', '把修整实物的部分接过来', '设定动手目标；动手 +1，学会修补木器。', '你把需要修整的部位记下，从普通损坏开始试做，并把不能独自处理的地方留给有经验的人。', { gain: { hands: 1 }, learn: 'repair', goal: { id: g.place, title: p.object, approach: 'hands' } }),
    choice('talk', '把合作与交接的部分接过来', '设定沟通目标；沟通 +1，学会商量约定。', '你逐个问清大家愿意承担的部分，把范围和时间说定。没有人被替着答应，计划终于有了可依靠的约定。', { gain: { talk: 1 }, learn: 'agreement', goal: { id: g.place, title: p.object, approach: 'talk' } }),
    choice('plan', '把收支和工序的部分接过来', '设定筹划目标；筹划 +1，学会记账排程。', '你把材料、费用和顺序写在同一张纸上，划掉暂时做不到的部分，让事情可以一步步开始。', { gain: { plan: 1 }, learn: 'ledger', goal: { id: g.place, title: p.object, approach: 'plan' } }),
  ], { kind: p.kind, continuation: true });
  const approach = g.goal?.approach ?? 'plan';
  if (slot === 8) return scene(`work-${g.place}`, [8], '真正开始之前', `“${g.goal?.title ?? p.object}”已经有了一个方向。工具和人手仍有缺口。你可以先花时间补上自己的本领，也可以拿出家底，把安排做得宽裕一些。`, [
    choice('practice', '再练一遍最需要的工序', `${ABILITY_NAMES[approach]} +1，无额外开支；不扩大工程范围。`, '你把最不熟悉的部分先做了一小段，再照经验修正。进度没有一下子加快，手里却有了更可靠的方法。', { gain: { [approach]: 1 }, learn: ABILITY_SKILLS[approach] }),
    { ...choice('invest', '买齐材料，和合作者留出准备时间', `花费家底 2，${ABILITY_NAMES[approach]} +2；增加准备余地。`, '你买齐必要的材料，和现场的合作者约好半天一起试做。两次练习找出了原先漏看的问题，准备比以前充分。', { gain: { [approach]: 2 }, learn: ABILITY_SKILLS[approach] }), cost: 2 },
    choice('modest', '缩小当前目标，先完成一部分', '无额外开支，家底 +1；将目标改为可以稳妥完成的一段。', `你提出“${p.modest}”，合作者同意先照这个范围做。已经做好的部分先结算了一点报酬，后面的压力也小了。`, { money: 1, goal: { id: g.place, title: p.modest, approach } }),
  ], { kind: p.kind, continuation: true });
  if (slot === 10) return scene(`finish-${g.place}`, [10], '把手里的事情做成', `“${g.goal?.title ?? p.object}”到了交付的时候。眼前的成果已有形状，你可以稳妥交出约定的部分，也可以利用积累争取更完整的收尾。`, [
    choice('deliver', '交出已经做好的部分', '无额外开支，家底 +2；完成当前目标。', p.finish, { money: 2, finishGoal: true, achievement: `完成了${g.goal?.title ?? p.object}` }, '这不是别人替你安排的头衔，而是你实际做成的一件事。'),
    { ...choice('master', `凭熟练的${ABILITY_NAMES[approach]}，把最后一处做得更好`, `需要${ABILITY_NAMES[approach]} 4 · 家底 +5，留下更完整的成果。`, `${p.finish} 你用熟练的方法处理了最后一处难点，合作者当着大家的面，把这部分功劳留给了你。`, { money: 5, finishGoal: true, achievement: `以熟练的${ABILITY_NAMES[approach]}完成了${g.goal?.title ?? p.object}，获得合作者的认可` }), ability: approach, level: 4, skill: ABILITY_SKILLS[approach] },
    { ...choice('support', '请现场的合作者一起做好收尾', '花费家底 2，结算家底 +4；完成共同成果。', `${p.finish} 你支付了约好的帮工费用，也认真说清每个人做过的部分。这件成果留下了几个人的名字。`, { money: 4, finishGoal: true, achievement: `与合作者一起完成了${g.goal?.title ?? p.object}` }), cost: 2 },
  ], { kind: p.kind, continuation: true });
  return scene(`harvest-${g.place}`, [11], '日子里留下的东西', `${p.finish} 许多年后，你仍记得当时怎样一步步走到这里。如今步子慢了，生活也有了自己的样子。这一次，你想怎样使用留下的余地？`, [
    choice('teach', '把会的办法讲给愿意学的人', '保留家底；让真实掌握的本领帮助后来的人。', '你从自己做过的一件小事讲起，没有把整个人生说成一条必走的路。听的人试了一遍，你在旁边慢慢看着。', { achievement: '把亲手学过的办法教给了后来的人' }),
    choice('enjoy', '给自己的日常留一点舒服', '无额外开支；留出休息，享受已建立的生活。', '你收好工具，把常坐的位置整理得舒服些。日子不再每一刻都用来争取什么，已经做成的事就在身边。', { achievement: '给晚年的日常留下了自己的时间' }),
    { ...choice('visit', '带一点心意，去见仍联系的旧友', '花费家底 2；和阿岑重逢。', '你事先给阿岑写信，照约定出发。见面时你们先说近况，再说那些后来走向不同地方的年头。', { achievement: '晚年与一直保持联系的阿岑重逢' }), cost: 2 },
  ], { kind: 'dusk', continuation: true });
}

export function scenesFor(g: GrowthState, slot: number): GrowthScene[] {
  if ([3, 6, 9].includes(slot)) return [payoffScene(g, slot)];
  if ([7, 8, 10, 11].includes(slot)) return [projectScene(g, slot)];
  return GROWTH_SCENES.filter(s => s.slots.includes(slot) && (!s.places || s.places.includes(g.place)));
}

export function validateGrowthContent(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const s of GROWTH_SCENES) {
    if (ids.has(s.id)) errors.push(`重复成长事件 ${s.id}`);
    ids.add(s.id);
    if (!s.choices.length || !s.choices.some(c => !c.cost && !c.ability && !c.specialtyId)) errors.push(`${s.id} 缺少可继续的行动`);
    if (new Set(s.choices.map(c => c.id)).size !== s.choices.length) errors.push(`${s.id} 选项重复`);
    for (const c of s.choices) if (!c.outcome || !c.preview || !c.text) errors.push(`${s.id}/${c.id} 文案缺失`);
  }
  return errors;
}
