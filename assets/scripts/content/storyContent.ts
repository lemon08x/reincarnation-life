import { EncounterChoiceConfig, EncounterTemplate, LifeTheme, PersonBinding, TemperamentConfig, UnderstandingSeed, WorldChange } from '../core/model';

export const TEMPERAMENTS: TemperamentConfig[] = [
  { id: 'quiet', name: '沉静', description: '你习惯先听完别人的话，再说自己的。', grantMarks: [{ id: 'clarity', intensity: 1 }] },
  { id: 'warm', name: '热络', description: '新搬来的邻居，你总是先去打招呼。', grantMarks: [{ id: 'presence', intensity: 1 }] },
  { id: 'sturdy', name: '耐折腾', description: '摔一跤，拍拍裤子，你还想再试一次。', grantMarks: [{ id: 'vitality', intensity: 1 }] },
  { id: 'thrifty', name: '会过日子', description: '用剩的纸，你会翻过来再写一遍。', grantMarks: [{ id: 'means', intensity: 1 }] },
];
export const UNDERSTANDING_SEEDS: UnderstandingSeed[] = [
  { id: 'trust-open', theme: 'trust', anyFragmentTags: ['open'], initial: '说清自己做过什么，让别人有机会自己判断。', revised: '真话可以慢一点说。我愿意先和对方商量，怎样一起承担。', question: '我想先听听对方怎么想，再决定哪些话由我来说。', revisedResponseTags: ['negotiate-trust'] },
  { id: 'trust-shelter', theme: 'trust', anyFragmentTags: ['shelter'], initial: '先护住眼前的人，有些解释可以留到以后。', revised: '替人遮住一次，不能替他过一辈子。我想试着陪他开口。', question: '这次的沉默帮到了谁，又让谁独自承担了代价？', revisedResponseTags: ['negotiate-trust'] },
  { id: 'belong-road', theme: 'belonging', anyFragmentTags: ['road'], initial: '我愿意走出去。想念一个地方，不必每次都留下。', revised: '我仍然想走，但可以和惦记的人约好下次联系的日子。', question: '下一次出发前，我想问清自己舍不得的究竟是谁。', revisedResponseTags: ['negotiate-belonging'] },
  { id: 'belong-root', theme: 'belonging', anyFragmentTags: ['root'], initial: '能在需要我的时候回来，是我愿意给出的承诺。', revised: '回来可以是一段时间。我也想把自己的打算说给家人听。', question: '如果这一次不回来，我们还能怎样照应彼此？', revisedResponseTags: ['negotiate-belonging'] },
  { id: 'worth-care', theme: 'worth', anyFragmentTags: ['care'], initial: '别人把事情交给我，我愿意尽力做完。', revised: '我可以答应一部分，也可以请人分担。这样才能做得长久。', question: '我答应之前，能不能先弄清自己还有多少余力？', revisedResponseTags: ['negotiate-worth'] },
  { id: 'worth-craft', theme: 'worth', anyFragmentTags: ['craft'], initial: '即使暂时没人叫好，我也想把手里的东西做好。', revised: '守住自己的时间，也可以给别人的需要留一个可商量的位置。', question: '如果没有人评价，我还愿意为哪件事花时间？', revisedResponseTags: ['negotiate-worth'] },
];
const PEOPLE: PersonBinding[] = [
  { role: 'guardian', relationId: 'parents', fallbackLabel: '母亲' },
  { role: 'peer', relationId: 'friend', fallbackLabel: '阿岑', createIfMissing: { kind: 'friend', label: '阿岑', closeness: 5 } },
  { role: 'elder', relationId: 'mentor', fallbackLabel: '周师傅', createIfMissing: { kind: 'mentor', label: '周师傅', closeness: 4 } },
  { role: 'partner', relationId: 'partner', fallbackLabel: '林遥', createIfMissing: { kind: 'friend', label: '林遥', closeness: 4 } },
];
const relation = (id: string, delta: number): WorldChange => ({ relations: [{ id, closenessDelta: delta }] });
const fact = (key: string, value: string): WorldChange => ({ setFacts: { [key]: value } });
function response(id: string, text: string, preview: string, result: string, later: string, tag: string, world: WorldChange, cost: 0 | 1 | 2 = 0): EncounterChoiceConfig {
  return { id, text, preview, fragmentTags: [tag], costKind: cost === 2 ? 'pursue-opportunity' : cost === 1 ? 'break-habit' : 'free',
    support: cost === 1 ? { anyFragmentTags: [tag], ifUnsupported: 'cost-break' } : undefined,
    supportReason: cost ? '腾出心力，把还没试过的安排说出口。对方仍可以拒绝。' : undefined,
    outcomes: [{ id: `${id}-result`, weight: 1, text: result, later, world: { ...world, addTags: [...(world.addTags ?? []), tag] } }] };
}
function scene(id: string, theme: LifeTheme, chapter: number, title: string, text: string, choices: EncounterChoiceConfig[], extra: Partial<EncounterTemplate> = {}): EncounterTemplate {
  const allText = text + choices.map(c => c.text + c.preview + c.outcomes.map(o => o.text + o.later).join('')).join('');
  const ages = [[8, 17], [22, 36], [44, 59], [66, 81]][chapter];
  return { id, theme, chapter, title, text, choices, minAge: ages[0], maxAge: ages[1], years: 5, weight: 1,
    sceneKind: chapter === 0 ? 'childhood' : chapter === 3 ? 'dusk' : theme === 'belonging' ? 'journey' : theme === 'worth' ? 'craft' : 'hearth',
    people: PEOPLE.filter(p => allText.includes(`{${p.role}}`)), triggerKind: 'chance', triggerNote: '', ...extra };
}

export const ENCOUNTERS: EncounterTemplate[] = [
  scene('trust_cup', 'trust', 0, '缺了一角的杯子', '放学后，你在厨房拿糖，把母亲常用的杯子碰到了地上。{guardian}赶着上晚班，看见缺口，只问了一句：“怎么弄的？”你的手里还攥着那颗糖。', [
    response('tell', '把经过说清，留下来收拾', '可能挨一顿训，也要承认糖是自己拿的。', '{guardian}训了你几句，又递来扫帚：“碎片别用手捡。”你们扫了两遍。她出门时，糖还放在桌上。', '事情没有再被追问。下次东西弄坏了，你知道可以从哪一句开始说。', 'open', relation('parents', 1)),
    response('hide', '说自己进来时就这样了', '先避开责备，把解释留在心里。', '{guardian}赶着出门，没有再问。你把糖放回罐里。晚上吃饭，她仍给你留了靠里的一角。', '日子照旧，杯子的缺口成为一件只有你知道的事。', 'shelter', fact('cup', 'hidden')),
  ]),
  scene('trust_book', 'trust', 0, '被雨打湿的书', '住同一条巷子的{peer}借走了你的书。还回来时，书页已经起皱。他低头说书包漏雨，求你别告诉大人；那本书是你攒了很久的钱买的。', [
    response('ask', '告诉他你很心疼，请他一起补好', '把损失说出来，可能让朋友难堪。', '{peer}的脸红了。他没有钱赔，你们在窗边一页页压平，等了两个下午。书没恢复原样，他以后借东西却都会先问。', '你们有了一次把不满说开、仍能继续来往的经历。', 'open', relation('friend', 1)),
    response('accept', '说没关系，把书收起来', '先让朋友好受些，自己承担损失。', '{peer}松了口气，第二天照常喊你出去玩。你把湿页夹在厚书下面，没再提起赔偿。', '朋友的轻松是真实的，你没有说出口的心疼也还在。', 'shelter', relation('friend', 2)),
  ]),
  scene('belong_bus', 'belonging', 0, '周末的车票', '学校组织去县城看展，刚好撞上家里的团圆饭。{guardian}已经买好你爱吃的菜，车票却只剩今天能订。饭桌和远处的新鲜事，第一次同时等你答复。', [
    response('go', '报名看展，晚些回来', '错过一顿饭，看看还没见过的世界。', '{guardian}给你留了一碗菜。你在展厅看得很慢，回家时饭已经凉了。你一边热饭，一边讲白天见到的东西。', '家里第一次为你的外出留了一份饭。', 'road', fact('firstTrip', 'taken')),
    response('stay', '把车票让给别人', '守住这次相聚，放下外出的机会。', '亲戚把你往身边拉，你听了一下午家里的旧事。晚上同学带回照片，你翻了很久，然后还了回去。', '留下有温度，你也确实错过了一些东西。', 'root', relation('parents', 2)),
  ]),
  scene('belong_move', 'belonging', 0, '巷口空下来的房间', '{peer}一家要搬到河对岸。你们过去每天一起上学，现在坐车才能见面。搬家那天，他把一串旧钥匙给你，说：“说不定还会回来。”', [
    response('visit', '约好下个月去找他', '新的路线要自己摸索，也要拿出一个周末。', '第一次去时你下错了站，{peer}在路口等了很久。回程，他陪你把站牌认了一遍。', '见面变得费事，但你们有了下一次的约定。', 'road', fact('friendship', 'visiting')),
    response('keep', '收好钥匙，让他有空回来', '把熟悉的地方留给他，等他方便的时候。', '{peer}最初每周回来，后来间隔长了。你没有催，把钥匙挂在书桌旁。', '交情开始依靠偶尔的回来维系。', 'root', fact('friendship', 'waiting')),
  ]),
  scene('worth_gift', 'worth', 0, '纸做的小船', '你花了一下午折船，想给上班回来的{guardian}看。她忙着接电话，只说“放那儿吧”。船头有一道没压好的折痕，你盯着它，听见她还在谈工作的事。', [
    response('help', '先替她收好晾着的衣服', '把想被看见的心情放一放，做眼前能帮的事。', '电话终于挂了。{guardian}摸了摸收好的衣服，说今天多亏你。她没有看到船，你也得到了一句真实的感谢。', '帮上忙成为一种容易让人注意到你的方式。', 'care', relation('parents', 1)),
    response('finish', '把船头重新折好，留给自己', '没有人立刻称赞，仍把这件小事做完。', '你拆开船头，纸已经有点软了。第三次终于折齐，你把小船放上窗台。后来{guardian}看见时，你已不急着问好不好看。', '小船留下了你自己也愿意认可的一下午。', 'craft', fact('ownWork', 'paper-boat')),
  ]),
  scene('worth_weekend', 'worth', 0, '被借走的周末', '邻居请你帮忙抄一本账。{guardian}已经替你应下，可你约了{peer}去河边画桥。邻居把账本送来了，还带了一袋点心。你要怎样说明自己的周末？', [
    response('help', '先抄完账，再向朋友解释', '兑现大人答应的事，失去这个周末。', '你抄到傍晚，邻居仔细道了谢。{peer}独自去了河边，画纸给你留了一张，却没有了那天的光。', '别人记住了你的可靠，朋友也知道你的约定可能被挤掉。', 'care', relation('friend', -1)),
    response('decline', '说明已经有约，请邻居另找人', '守住自己的安排，接受大人不太高兴。', '邻居抱着账本走了。{guardian}数落你不懂人情。河边的桥很好看，你也记着门口那一刻的尴尬。', '你第一次为自己的安排拒绝了别人。', 'craft', fact('time', 'protected')),
  ]),
  scene('trust_order', 'trust', 1, '少寄了一箱', '一次和{peer}合做的订单少寄了一箱，是他核单时漏掉的。客户要你说明原因，他私下说：“先说运输出了问题，补上就好。”这笔工钱是你们两个人的。', [
    response('tell', '说明漏单，自己先去补寄', '保住来龙去脉，可能承担扣款。', '客户取消了加急费。{peer}起初怪你多事，看到你也一起扣了钱，晚上留下帮你打包。问题解决了，你们没有立刻和好。', '以后的单据需要两人核对，合作多了一道共同承担的手续。', 'open', fact('order', 'shared-check')),
    response('cover', '先补寄，把责任留在内部谈', '保护同伴，承担解释不完整的风险。', '客户没有再问。{peer}把加班的钱转给你。你收下了，也把那张漏填的单据夹进抽屉。', '这笔账暂时只有你们两个人知道。', 'shelter', fact('order', 'covered')),
    response('together', '请他一起给客户打电话', '把承担方式交还给两个人商量。', '{peer}沉默了一阵，终于接过电话。客户仍扣了钱，却听到了两个人的解释。挂断后，他主动提出重新分工。', '今后不必由一个人补所有的缺口。', 'negotiate-trust', fact('order', 'together'), 1),
  ]),
  scene('trust_request', 'trust', 1, '不想让人看见的难处', '月底房租将到，一笔工钱却迟迟没结。教过你手艺的{elder}看出你心神不定，问是不是出了什么事。你知道他也不宽裕，开口可能把他拖进来。', [
    response('say', '说明情况，只请他介绍短工', '让人知道难处，报酬还得自己挣。', '{elder}替你问了旧客户。你接下几晚的活，赶上房租。再见面时，你们都知道这份帮忙究竟帮在哪里。', '你多了一条能自己挣钱的联系。', 'open', fact('workContact', 'mentor')),
    response('wait', '先说没事，自己去催款', '不增加人情债，继续独自承担压力。', '你等了半天，拿回一部分工钱。房东答应宽限，条件是下次提前说明。{elder}没有再追问。', '你解决了周转，也记住了那几天独自等待的滋味。', 'shelter', fact('rent', 'extended')),
    response('plan', '请他帮忙梳理，约定能帮的范围', '主动求助，不把整个难题交出去。', '你们列出一张清单。{elder}只陪你打了第一个电话，之后由你继续。钱没有立刻到账，事情终于有了先后次序。', '下一次遇到难处，可以请人帮一小段。', 'negotiate-trust', relation('mentor', 1), 1),
  ]),
  scene('belong_depart', 'belonging', 1, '要不要在外地留下', '外地的工作愿意长期留你，工资够租一间属于自己的屋子。{guardian}在电话里说家里都好，问今年能不能多回来几天。合同还差你的签名。', [
    response('sign', '签下合同，把外地当作生活的地方', '得到独立的日子，回家需要专门安排。', '你买了锅和两只碗。第一次做饭烧糊了，给家里打电话时两边都笑。笑完，你发现下一次见面还很远。', '你在外地有了固定住处，日常联系靠电话和来信。', 'road', fact('residence', 'city')),
    response('return', '谢过邀请，回熟悉的地方找工作', '离家人近一些，放下确定的收入。', '家里多添了一双筷子。新工作没有想象中好找，你开始重新问旧相识。', '你得到家人的照应，也面对较少的工作选择。', 'root', fact('residence', 'hometown')),
    response('negotiate', '先签短约，和家里定下见面时间', '把工作与家人的期待放上同一张日历。', '单位不肯保留全部待遇，却同意短约。你把少赚的钱算了一遍，给家里寄去标了日期的日历。', '外出有了期限，回来也成为可以准备的事。', 'negotiate-belonging', fact('residence', 'between'), 1),
  ]),
  scene('belong_address', 'belonging', 1, '新地址上的名字', '你租住的街上，邻居{partner}邀你办一场旧物交换。布告上要写组织者名字。你一直觉得这里只是暂住，箱子甚至还没拆完。', [
    response('join', '写上名字，拿出自己的旧书', '为眼前的街道花时间，接受新的牵挂。', '你认识了楼上的裁缝和卖早餐的人。散场时{partner}帮你搬书，你第一次觉得这条街上有人会等你。', '林遥成了会互相照应的邻居。', 'road', relation('partner', 2)),
    response('pass', '帮忙搬桌子，把名字留给常住的人', '出一份力，保留随时离开的余地。', '{partner}没有勉强，给你留了一杯茶。你看过一圈便回去收拾箱子。', '你与邻居保持友好，去留仍然自由。', 'root', relation('partner', 1)),
    response('invite', '也邀请故乡的朋友来摆一张桌', '主动让两边的生活见一面。', '{peer}带来旧玩具，和{partner}聊起修补的办法。并非人人合得来，但他终于知道你住的是怎样的地方。', '新住处与故乡之间，多了一位见过彼此的人。', 'negotiate-belonging', fact('twoHomes', 'connected'), 2),
  ]),
  scene('worth_shop', 'worth', 1, '关门以后的灯', '白天的活已做完，{elder}问能不能再接一单。你自己的修补作品摊在桌上，停了两周。多接一单能补贴生活，也会把它再往后推。', [
    response('accept', '接下来，先把收入稳住', '多一笔报酬，自己的作品继续等。', '你包好作品，做完那单已经很晚。领钱时心里踏实，拆开包布时却要找一会儿，才想起做到哪一步。', '你接到了更多活，个人作品进展变慢。', 'care', fact('work', 'orders')),
    response('protect', '今晚不接，把自己的作品做完', '放下报酬，给一直拖着的东西一个晚上。', '{elder}找了别人。你关门补齐边角。作品完成时没有观众，第二天的生活费也少了一笔。', '你完成了第一件能自己决定去向的作品。', 'craft', fact('work', 'own-piece')),
    response('share', '提出分工，只接自己能完成的一半', '把能力和余力一起说清楚。', '{elder}重新算了工钱，答应分给两个人。你赚得少些，也留出了时间。交货那天，两份活都完成了。', '店里开始按明确的工作量分配这类订单。', 'negotiate-worth', fact('work', 'shared'), 1),
  ]),
  scene('worth_credit', 'worth', 1, '没有署名的作品', '一件你参与修好的旧物放在展柜里，牌子只写了店名。有人夸手艺好，{elder}站在旁边招呼。你可以说出自己的名字，也可以让这一刻过去。', [
    response('team', '帮忙介绍，先让店里接到生意', '把功劳留给共同的招牌。', '那天接到几笔新活，大家一起吃饭。有人记住了店名，没有记住你。这顿饭也有自己的一份。', '共同的生计更稳，外人仍不太知道你做过什么。', 'care', relation('mentor', 1)),
    response('name', '介绍自己负责的部分', '争取署名，可能显得不够谦让。', '{elder}顿了一下，把话让给你。你指着接缝讲完，客人记下了名字。散场时你们谈了以后牌子怎么写。', '你开始拥有能独立展示的工作记录。', 'craft', fact('credit', 'named')),
    response('both', '提议写上每个人负责的部分', '争取一种让所有人被看见的办法。', '牌子旁添了一页说明。你写了自己的名字，也写了打磨和运送的人。有人觉得麻烦，有人拍照留念。', '店里留下了第一份共同署名的说明。', 'negotiate-worth', fact('credit', 'shared'), 1),
  ]),
  scene('trust_returned_order','trust',2,'旧客户又来了','这些年，你和{peer}各自接活，也合作过几次。老客户今天又来，要你们共同负责更大的工作。签字前，他问出了差错由谁联系客户。',[
    response('own','我来负责对外，把责任写清','有决定权，也首先面对追问。','你写下自己的号码，{peer}负责另一部分。后来确有返工，你出面解释，他照约定补齐。','你们留下明确的分工记录。','open',fact('partnership','defined')),
    response('separate','分开接单，各自负责','减少牵连，也放弃更大的合作。','合同拆成两份。你们仍能喝茶，赚的钱比合接少。没有人再替另一方签字。','合作缩小，关系获得安全距离。','shelter',fact('partnership','separate')),
    response('review','一起回看旧单，再定核对办法','把旧事说开，争取共同负责的可能。','你们对旧事的记忆并不一样。争了几句后，一起写下核对步骤。不快没有消失，却终于能谈起。','共同核对取代了彼此猜测。','negotiate-trust',fact('partnership','reviewed'),1),
  ],{variants:[{condition:{requiredFacts:{order:'covered'}},text:'老客户又邀请你和{peer}合作。你还留着当年被遮过去的漏单。他似乎已经忘了，谈报价时很轻松。签字前，你要决定旧办法还能不能继续。'},{condition:{requiredFacts:{order:'together'}},text:'老客户又找来。当年和{peer}一起解释漏单之后，你们一直保留双人核对。这次工作大得多，他先问：“还按那次说好的办法吗？”'}]}),
  scene('trust_tired','trust',2,'第一次承认累了','忙碌让你很久没睡好。{partner}来送东西，看见你把同一行数字抄错两次。她问要不要帮忙，你想起独自撑过的晚上，又不愿欠下说不清的人情。',[
    response('explain','请她帮一个小时，说清卡住的地方','接受有限的帮助，让人看见疲惫。','{partner}核完一页账就回去。剩下的仍由你做，最乱的部分却有了头绪。第二天你认真道谢。','帮助可以具体到一页账，也可以有结束的时候。','open',relation('partner',2)),
    response('pause','谢过她，今晚先停下来','自己调整节奏，接受交期延后。','你发出延期的消息，关灯回家。有人不满意，却没发生你担心的所有后果。你睡了一个完整的晚上。','工作延期一天，你拿回休息的时间。','shelter',fact('pace','rested')),
    response('routine','试着互相核账，每次算清时间','把援手变成双方都能退出的安排。','一天{partner}临时有事，你没有把缺席理解为拒绝，自己做完那一页。下周她照约定来了。','互助成为可调整的约定。','negotiate-trust',fact('mutualHelp','bounded'),2),
  ]),
  scene('belong_key','belonging',2,'家里的钥匙','{guardian}把备用钥匙交给你，说最近上下楼有些吃力。你的生活已有固定节奏，回来照料意味着重新安排工作。她没催，你却知道需要一个回答。',[
    response('come','搬回来住一段时间','及时照应家里，暂停部分工作。','你清出小时候的床，重新熟悉菜价。工作少接了几单，{guardian}起夜却不用独自找灯。','照料由你接下一段，工作机会随之减少。','root',fact('carePlan','home')),
    response('help','留在原处，承担请人照料的费用','守住现有生活，用收入补上距离。','你们一起找了帮手。费用每月都会来，电话也变勤。{guardian}有时仍说想你，夜里已有别人能搭手。','你承担稳定的支出，见面仍需安排。','road',fact('carePlan','paid-help')),
    response('calendar','列出需要，商量轮流照应','拆开问题，不独自包下全部。','起初大家都说忙，后来一项项排进日历。你负责几天，也要相信别人会接下其余的日子。','照料有了分工，你不再是唯一联系人。','negotiate-belonging',fact('carePlan','shared'),1),
  ]),
  scene('belong_second_road','belonging',2,'再一次离开','{peer}想和你去外地住几个月，记录正在消失的老街。年轻时你想过这样的旅行，如今每一段空出的时间都牵着别人的安排。地图已在桌上铺开。',[
    response('go','安排好手里的事，再去','付出交接成本，给自己一次远行。','你带上比年轻时更多的药和衣服。{peer}走得也慢了。你们常停下，发现不必赶到哪里才算出发。','你留下一本亲手记录的远行手记。','road',fact('journey','made')),
    response('stay','留下，请他把见闻寄回来','承担日常，让这次机会经过。','{peer}没再劝。照片寄到时你一张张写上日期。日常照旧，远方有了具体颜色。','你成为这趟路上持续收信的人。','root',fact('journey','letters')),
    response('short','只同行第一段，把期限说在前面','给自己的愿望争取有限的位置。','你们在第三座城分别。他继续走，你按约定回来。没走完全程仍有遗憾，但你知道了那条街的气味。','远行和回来都有清楚的日期。','negotiate-belonging',fact('journey','short'),1),
  ]),
  scene('worth_limit','worth',2,'又一份托付','几个人把同一周的事交给你：店里交货，家里跑手续，{peer}也想请你帮忙。过去总能想出办法，这次日历上真的没有空白了。',[
    response('take','先接最急的事，自己的作品往后放','照应别人，让个人计划延期。','你盖好作品，逐一处理期限。事情没全做完，你提前说明能做到哪里。那块布又落了一层灰。','大家得到部分帮助，你的作品还在等待。','care',fact('ownProject','delayed')),
    response('decline','只留已约好的工作，其余谢绝','守住已有承诺，也接受有人失望。','有人抱怨，有人另找办法。你按时交了自己的活。空出的晚上，手机没再一直响。','别人开始在托付前询问你的时间。','craft',fact('ownProject','protected')),
    response('divide','拆开每件事，请他们各认领一部分','主动协调，接受不同的做法。','分出去的活有些粗糙，你忍住没全部重来。大家各自收尾，你也做完自己的那一页。','你们有了一次不用由你包办的合作。','negotiate-worth',fact('ownProject','shared'),1),
  ]),
  scene('worth_price','worth',2,'有人愿意出价','你修补多年的旧物，有人愿高价买走。钱能让日子轻松许多，但对方想改掉你最在意的部分。{elder}说决定在你，他不会替你回答。',[
    response('sell','写清修改范围，接受报价','让作品进入别人的生活，放下部分控制。','你拆掉一处接缝，按商量好的样子改完。钱到账时松了口气，打包时仍舍不得。','作品离开，你得到继续生活的余裕。','care',fact('piece','sold')),
    response('keep','谢绝报价，留下原来的样子','保住在意的部分，继续承担生活成本。','买家很快离开。你把旧物放回架子，第二天照常接普通订单。它没因被留下就更值钱。','作品仍在身边，需要日常工作支撑。','craft',fact('piece','kept')),
    response('copy','争取做一个新版本，保留原作','多花时间，提出对方可以拒绝的方案。','买家答应等新版本。工作更多了，你却在复制时发现一些地方能做得更好。','原作留下，新版本带来收入和新的尝试。','negotiate-worth',fact('piece','new-version'),2),
  ]),
  scene('trust_letter','trust',3,'旧账本里的纸条','整理旧物时，你找到一张{peer}写的纸条。有些合作早已过去，你们却没有好好谈过。现在时间终于宽了，见面的机会也少了。',[
    response('speak','约他坐坐，说出自己的记忆','允许记忆不同，也可能再次委屈。','{peer}记得的顺序不同。你们没争出一个版本，却听见对方当时为什么那么做。茶凉了两次。','旧事仍有不同说法，不必再靠猜测保存。','open',fact('oldAccount','spoken')),
    response('keep','收好纸条，维持现在的来往','珍惜平静，接受有些解释不会得到。','后来见面，你们仍谈天气和近况。旧事没解决，你也没有因此取消见面。','你保留一个未解问题，同时保留这位朋友。','shelter',fact('oldAccount','unspoken')),
    response('compare','写下自己的版本，也请他留一份','给两种记忆留位置，不急着求一致。','他很久才寄来几页纸。你读到从没注意的细节，把两份记忆放进同一个信封。','以后翻开时，能同时看见两个人的处境。','negotiate-trust',fact('oldAccount','two-voices'),1),
  ]),
  scene('trust_young','trust',3,'一个年轻人的坦白','来帮忙的年轻人弄坏了东西，站在门口不敢进来。{peer}说先别吓着他。你看见那双攥紧的手，想起年少时等大人开口的样子。',[
    response('facts','先听经过，再一起算怎样补救','仍要承担损失，把责备留在事实之后。','年轻人说完，你们发现还能修，约好由他做最费时的部分。离开时他问清下次几点来。','过错留下一项可以完成的补救。','open',fact('lastTeaching','repair')),
    response('protect','先让他回去，自己承担损失','给人缓冲，留给自己善后的重量。','年轻人连声道谢。你和{peer}收拾到傍晚。第二天他又来问，你告诉他以后要注意哪里。','你给了他缓冲，自己完成大部分善后。','shelter',fact('lastTeaching','shelter')),
    response('together','讲自己的过错，请他提出补救办法','把经验交出去，让对方自己作答。','他听完故事，想出不够熟练的办法。你没接过工具，只在危险的地方提醒。','你的旧经历成为另一个人行动的依据。','negotiate-trust',fact('lastTeaching','passed-on'),1),
  ]),
  scene('belong_old_house','belonging',3,'再看一眼旧屋','旧屋准备交给别人。抽屉里有家人的字条，门框上有量身高的刻痕。{peer}陪你拿最后一箱东西，问钥匙要怎么处理。',[
    response('carry','带走字条，把房间交出去','接受地方改变，保存能随身带走的部分。','你关好窗，钥匙换了主人。字条放进现在住处的抽屉，和新的信件挨在一起。','故乡不再由你保管，记忆仍可翻看。','road',fact('oldHome','released')),
    response('keep','再留一段时间，慢慢整理','继续承担费用，让告别晚一些。','{peer}陪你擦桌子。你知道不能永远这样，仍愿多回来几次。屋里有了几顿简单的饭。','你为告别留出时间，也继续承担旧屋事务。','root',fact('oldHome','kept')),
    response('gather','请相关的人各取一件，再一起交屋','主动组织最后一次相聚。','有人来不了，托你带走旧碗。到场的人讲同一张桌子的不同往事。箱子少了，告别有了见证。','旧屋的东西和故事去了不同地方。','negotiate-belonging',fact('oldHome','shared'),2),
  ]),
  scene('belong_last_visit','belonging',3,'地图上还有一处','你和{peer}都走不快了。他寄来地图，圈出年轻时没去成的地方。桌上放着邻居{partner}送来的饭，还冒着热气。远行与身边的日常又等你选择。',[
    response('go','整理行李，去住几天','路途会累，可能只看得完一小部分。','你们大多坐在窗边。天气好时走到桥上，拍了一张没摆好姿势的照片。','这处地方终于有了你们自己的记忆。','road',fact('lastJourney','visited')),
    response('invite','请他来这里，把日子过慢些','放下远方，认真对待身边的人。','你们吃{partner}做的饭，沿熟悉小路散步。地图还在桌上，没有折进行李。','这一次，相见本身就是目的。','root',fact('lastJourney','together')),
    response('near','商量一个两人都到得了的地方','调整愿望大小，仍给相见一个位置。','你们选了中间的小城。谁也没完成原路线，却都能在傍晚前休息。离开时约好，累了就直说。','愿望小了一些，彼此的照应更具体。','negotiate-belonging',fact('lastJourney','adapted'),1),
  ]),
  scene('worth_tools','worth',3,'工具该交给谁','工具的握柄已磨出你的手形。有人请你接活，也有人想学。{partner}提醒你最近手疼得厉害。你把最常用的一把拿起来，又放下。',[
    response('teach','留下能教的部分，慢慢带一个人','继续被需要，把速度让给学习的人。','年轻人做得慢，你几次想接手，最后只指出关键的一处。手没从前累，嗓子却有些哑。','一些做事的方法开始由别人接着用。','care',fact('tools','taught')),
    response('keep','不再接单，只做自己还想做的','收入和邀约减少，时间重新归自己。','最初不习惯没人催。后来拿起一件小物，累了便停。它可以慢慢完成。','工作退出日程，手艺仍陪着你。','craft',fact('tools','personal')),
    response('open','每周只开放一个下午','让帮助别人和照顾自己都有边界。','{partner}替你把时间写在门上。有人不满意，你照旧休息。后来大家学会提前约好。','你仍能被找到，也有不必解释的休息日。','negotiate-worth',fact('tools','weekly'),1),
  ]),
  scene('worth_unfinished','worth',3,'还差最后一点','一件作品停在最后一步。做完也许还要很久，你却更愿和{partner}坐在院子里。有人问何时能看到成品，这个问题曾让你很着急。',[
    response('hand','写下做法，请愿意的人接着做','它会带上别人的手法，也可能完成。','接手的人改了两处。你起初不习惯，后来仍认出自己做过的部分。成品旁写着两个人的名字。','作品保存着几个人共同花过的时间。','care',fact('lastPiece','continued')),
    response('leave','保留现在的样子，不再承诺完成','接受未完成的东西也属于这一生。','你收好工具，和{partner}喝茶。有人问起，你讲做到这一步用了多久，不再报交期。','作品停下，你把时间留给正在发生的日常。','craft',fact('lastPiece','unfinished')),
    response('show','把过程摆出来，邀人来看','让人看见过程，也接受没有掌声。','来的人不多。一个孩子问了很久，你发现还记得每道痕迹的来处。散场后，它仍没完成。','你把过程留给愿意倾听的人。','negotiate-worth',fact('lastPiece','shown'),2),
  ]),
];

ENCOUNTERS.push(
  scene('cross_departure','trust',1,'两张不同的车票','{peer}邀你去外地接活，你却答应家里留下帮忙。出发前他发现你还没订票，{guardian}也以为安排早已定好。两边都在等你。',[
    response('explain','把实情说清，决定留下','朋友需要独自处理改期。','{peer}退了一张票，你补了手续费。家里的事办完，你们约定以后把话说早一点。','你承担了临时改变安排的成本。','open',fact('promise','home')),
    response('go','向家里道歉，按约出发','把家里的缺口留给别人。','{guardian}另找帮手。你按时上车，到达后先打了一通电话。她听完才放下心。','家人开始调整对你随时回来的期待。','road',fact('promise','road')),
    response('split','商量晚两天走，承担改期费用','给双方都能知道的边界。','朋友只肯等两天。你办完最急的事赶过去，剩下的请家里另找人。两边都少了些方便。','你们接受了一个不完美但明确的日期。','negotiate-belonging',fact('promise','negotiated'),1),
  ],{crossThemes:['trust','belonging']}),
  scene('cross_credit','trust',1,'替谁接下这句话','客户夸你独自完成工作，其实{peer}做了最费时的部分。接下夸奖可能带来订单，你看见朋友低头收工具。{elder}也在等你接话。',[
    response('share','介绍朋友做过的部分','把功劳说全，个人关注会少。','客户也记下{peer}的名字。新订单分给两个人，你少赚一些，他主动来谈合作。','认可成为可以继续的合作。','open',relation('friend',2)),
    response('later','先接生意，私下补给他报酬','保住机会，承担未公开说明的成本。','他收了钱，却问以后能不能提前写明分工。钱解决了一部分问题。','你们发现报酬和被看见并不相同。','care',fact('creditDebt','private')),
    response('record','争取让合同写上共同负责','把称赞变成双方能确认的安排。','客户嫌麻烦，仍补写了名字。你们花一下午逐项确认，比一句夸奖慢得多。','两人的工作都进入正式记录。','negotiate-trust',fact('creditDebt','recorded'),1),
  ],{crossThemes:['trust','worth']}),
  scene('cross_room','worth',1,'只能放下一张桌','你和{partner}想合租工作室，{guardian}却希望钱留作家里急用。积蓄只够做一件事。那张朝南的桌子还没有人认领。',[
    response('rent','租桌子，承担后续开销','给作品位置，缩小家庭支援余裕。','你把工具搬进去。后来家里临时缺钱，只能出一部分，你认真说明了自己的账。','个人工作有了固定空间。','craft',fact('room','studio')),
    response('save','暂时不租，把钱留在手边','保留照应能力，继续在狭小地方做事。','{partner}另找了人。你仍在家铺工具。那笔钱让一次急用没变成争吵。','家里保留缓冲，你的空间还需等待。','root',fact('room','reserve')),
    response('trial','争取轮流使用半张桌','给有限的钱和时间一个试用安排。','{partner}同意试一个月。每天得收好工具，却终于有了能专心做事的几个晚上。','作品有了固定时间，余款仍可急用。','negotiate-worth',fact('room','shared'),2),
  ],{crossThemes:['belonging','worth']}),
  scene('cross_return','trust',2,'该不该告诉家里','家里盼你回来，工作上却出了缺口。{peer}建议先说买不到票，处理完再解释。{guardian}已在问哪天去车站接你。',[
    response('truth','把工作上的难处告诉家里','家人会担心，也知道真实安排。','{guardian}问了细节，没能解决问题。后来她每天只发一句“吃了吗”，不再追问车票。','等待变成有理由的等待。','open',fact('returnReason','known')),
    response('delay','处理好再解释，先推迟回程','独自承担，减少眼前担忧。','你处理完才打电话。{guardian}说早知道就不用白等。她在意的不只是晚几天。','你得到处理问题的时间，留下迟到的解释。','shelter',fact('returnReason','late')),
    response('ask','说明难处，一起调整见面方式','允许家人参与决定。','你们约在中间的城市。事情仍要处理，那顿短饭让每个人知道下一步在等什么。','回家有了另一种路线。','negotiate-belonging',fact('returnReason','shared'),1),
  ],{crossThemes:['trust','belonging']}),
  scene('cross_replace','worth',2,'交出去会不会失去位置','你想分一部分活给{peer}，又担心客户以后只找他。{elder}问舍不得的是收入、手艺，还是别人总先叫你的名字。你一时答不出来。',[
    response('keep','保留重要的活，自己负责','守住位置，继续承担忙碌。','客户照旧找你。日程更紧，你知道踏实靠什么换来。{peer}去接了自己的生意。','你的角色暂时不变，休息仍需争取。','care',fact('role','central')),
    response('hand','正式介绍一部分客户给他','让出收入，腾出自己的时间。','最初客户仍问你，你再发一次联系方式。后来电话少了，你既轻松，也空落过。','朋友有了客户，你有了不被催促的日子。','craft',fact('role','shared')),
    response('terms','写清交接与求助的边界','把担心和责任一起说清。','你们谈了分成和困难时怎么办。一条没谈拢，留给下次，其余先试起来。','合作可以调整，分歧也有了名字。','negotiate-trust',fact('role','negotiated'),1),
  ],{crossThemes:['trust','worth']}),
  scene('cross_keep_room','belonging',2,'留给自己的房间','家里想把工作间改成客房。{partner}知道那里放了许多未完成的东西。大家等你点头，好像那些东西随时都能装箱。',[
    response('clear','腾出房间，把作品收起来','照应相聚，让个人工作让位。','客人住得舒服，你也高兴见到他们。夜里在箱子找工具，才发现收好以后很难再开始。','相聚有了地方，个人空间变小。','root',fact('personalRoom','guest')),
    response('keep','保留工作间，帮忙另找住处','守住空间，承担替代安排的麻烦。','你补了一部分住宿费。有人觉得见外，后来坐进工作间，才明白你为什么坚持。','亲人开始认识你在这里做的事。','craft',fact('personalRoom','kept')),
    response('share','约定借用时间，留下工作角','让借用有归还日期。','客人走后，你按约恢复工作间，没有再等一个不好意思开口的时机。','房间有了共同商量的使用方式。','negotiate-worth',fact('personalRoom','agreed'),1),
  ],{crossThemes:['belonging','worth']}),
);
for (const choice of ENCOUNTERS.find(e => e.id === 'trust_order')!.choices) {
  choice.outcomes[0].schedule = [{templateId:'trust_returned_order',afterYears:8,windowYears:37,note:'当年的订单留下了合作的办法，也留下没说完的话。老客户再次找来。'}];
}

// Asking is a concrete action inside each situation, with an opportunity left open or lost.
const QUESTIONS: Record<string, [string, string, string]> = {
  trust_order: ['先问阿岑为什么不愿说明漏单', '他怕以后接不到活，承认赔钱只是其中一部分。你听完才发现，两人担心的并不是同一件事。客户当天没等到明确解释，先暂停了发货。', '发货暂缓了，责任怎样说明还需要一次谈话。'],
  trust_request: ['先问周师傅能帮到哪一步', '他只能介绍人，不能垫钱。你把清单带回去，删掉借款这一项，准备自己再去问工钱。', '求助的范围清楚了，房租还要另想办法。'],
  belong_depart: ['先问家里，究竟哪些日子需要我在', '母亲说起几次没能一个人办成的手续。你第一次听见具体日期，决定先核对工作安排。单位催你尽快答复。', '你知道了家里的实际需要，合同仍未签下。'],
  belong_address: ['先问林遥，这次活动最缺什么', '她说缺一个收尾的人，并非缺一个签名。你答应当天搬完桌子再决定要不要长期参与。', '你承担了一次收尾，长期的来往尚未约定。'],
  worth_shop: ['先问这单真正的交货期限', '周师傅承认还有两天，只是想提前安心。你提出明早再答复，今晚先把自己的作品摊开。', '你争取到一晚考虑时间，还没有接下订单。'],
  worth_credit: ['散场后，先问署名是怎样定的', '周师傅说一直沿用旧牌子，没想过你会介意。他愿意再谈，你把想署名的原因写了下来。', '旧牌子暂未更换，署名成了可以明确讨论的事。'],
  trust_returned_order: ['先问对方，这次最担心哪一步', '阿岑怕你们各自以为对方会核单。客户也说出最晚能接受的时间。谈话花掉一下午，合同留到下一次签。', '风险说清了一部分，新的合作还没开始。'],
  trust_tired: ['先问林遥今天还要忙什么', '她还有一件急事，你没有请她留下。她说晚上可以再来，你决定先睡一会儿，到时再看。', '你没有硬撑着客气，也没有立即接下帮助。'],
  belong_key: ['先问母亲，一天里最难的是哪一段', '母亲说最怕洗澡时没人应声，其余的事还想自己做。你记下时间，约好先找几种办法一起看。', '需要照应的时段清楚了，长期安排还没有定。'],
  belong_second_road: ['先问阿岑，他最想和我走哪一段', '他圈的只是第一座城，说后面本来就想独自走。你把地图带回家，准备重新算能空出的日子。', '远行的愿望变得具体，出发日期仍未决定。'],
  worth_limit: ['让每个人说明最晚何时需要帮忙', '两件事其实能延后，一件必须当天做。你请他们先自行处理最急的部分，答应明天给出可用时间。', '你厘清了期限，还没有把全部托付揽过来。'],
  worth_price: ['先问买家为何要改掉那一部分', '原来旧物放不进他家门口的空位。你量下尺寸，提出回去想想；他没有承诺会等。', '修改的缘由清楚了，买卖仍有可能错过。'],
  trust_letter: ['先写信问阿岑，愿不愿意谈旧事', '他回信说还没准备好，愿先谈近况。你没有追问，把新信和旧纸条放在一起。', '旧事暂未谈开，你知道了对方此刻的界限。'],
  trust_young: ['先问年轻人最怕怎样的处理', '他怕被赶走，再也没机会补救。你让他说完，约好明天带一个补救办法来；今晚先把现场收好。', '补救还在等待，你给了他自己想办法的时间。'],
  belong_old_house: ['问问家人，各自还想留下什么', '有人惦记门框的刻痕，有人只要一张照片。你把回答记下来，今天先不交钥匙。', '告别的需要被逐一记下，交屋日期暂缓。'],
  belong_last_visit: ['先问阿岑，想去的是地方还是见面', '他笑着说两样都想，但更怕你太累。你们约定各自问清身体状况，再定行程。', '你们仍然期待相见，路线还没有决定。'],
  worth_tools: ['先问想学的人，愿意从什么学起', '他想学最朴素的修补，没打算立即接大活。你请他下次带来一件旧东西，今天先把工具擦好。', '传授有了一个可能的起点，还没有长期约定。'],
  worth_unfinished: ['问自己，最后还想完成哪一小部分', '你在纸上圈出一个接缝，其余暂时搁下。林遥陪你坐了一会儿，没有催你把整件事说成遗憾。', '你留下一个小目标，作品仍未完成。'],
  cross_departure: ['先问阿岑，真正需要我留下多久', '他需要你交接两天，并非一直守着。你去查改签费用，决定核对工作期限后再答复。', '朋友的需要有了范围，启程时间尚未确定。'],
  cross_credit: ['先问周师傅，为何没写我的名字', '他以为店名已经代表所有人。你说出自己的顾虑，约好下次把其他人也叫来讨论。', '你的贡献被当面承认，牌子暂未改变。'],
  cross_room: ['先问家里，想一起过怎样的日子', '家人说想多见面，并不一定要你放下全部工作。你写下几种安排，大家约好再谈。', '相聚的期待说清了，空间如何安排仍未定。'],
  cross_return: ['先问阿岑，希望我回去帮哪一件事', '他说最需要有人听他把近况说完。你们先通了一次长电话，没有在当天买车票。', '你给出了一次倾听，是否回去仍可再谈。'],
  cross_replace: ['先问阿岑，他想独自承担到哪一步', '他想自己试一次，也怕遇到难事没人可问。你说可以先听他列一张清单，客户今天暂不交接。', '朋友的愿望被听见，交接还没有开始。'],
  cross_keep_room: ['先问来客会住多久、需要什么', '原来只有几晚，还需要一张能写字的桌子。你记下日期，答应明天确认哪种安排可行。', '借住的范围清楚了，工作间暂时没有搬动。'],
};
for (const event of ENCOUNTERS) {
  const q = QUESTIONS[event.id];
  if (q) event.questionChoice = response('ask-first', q[0], '先弄清需要，再承诺；眼前的安排会暂缓。', q[1], q[2], `question-${event.theme}`, fact(`question:${event.id}`, 'open'));
}

function callback(from: string, to: string, note: string): void {
  const source = ENCOUNTERS.find(e => e.id === from)!;
  for (const choice of source.choices) for (const outcome of choice.outcomes) {
    outcome.schedule = [{ templateId: to, afterYears: 8, windowYears: 37, note }];
  }
}
callback('belong_depart', 'belong_key', '年轻时，你曾决定在哪里生活。多年过去，家人的需要让距离又一次变得具体。');
callback('worth_shop', 'worth_limit', '当年关门后的那盏灯，留下了你安排工作与自己的方式。如今又有人把事情交来。');
ENCOUNTERS.find(e => e.id === 'belong_key')!.variants = [
  { condition: { requiredFacts: { residence: 'city' } }, text: '你在外地的日子已很熟悉。母亲最近上下楼吃力，把备用钥匙寄给你，说不是催你回来。隔着电话，你知道照料需要一个具体安排，不能只靠想念。' },
  { condition: { requiredFacts: { residence: 'hometown' } }, text: '当年回到故乡后，你常去母亲那里吃饭。最近她上下楼吃力，把备用钥匙交给你。住得近让帮忙容易，也让大家默认你随时能来。你需要重新安排自己的工作。' },
];
ENCOUNTERS.find(e => e.id === 'worth_limit')!.variants = [
  { condition: { requiredFacts: { work: 'orders' } }, text: '当年接下关门后的订单，后来大家越发习惯找你。这周，店里交货、家里手续和阿岑的托付挤到一起。自己的作品又停在桌上，日历真的没有空白了。' },
  { condition: { requiredFacts: { work: 'own-piece' } }, text: '你曾为自己的作品谢绝过加单。如今店里交货、家里手续和阿岑的托付撞在同一周。守住过一次时间，不代表这次不会为难。你翻开日历，等自己给一个回答。' },
];
// Attempts can be refused. The point pays for initiating the proposal, not for buying a good ending.
const copyChoice = ENCOUNTERS.find(e => e.id === 'worth_price')!.choices.find(c => c.id === 'copy')!;
copyChoice.outcomes[0].weight = 2;
copyChoice.outcomes.push({ id: 'copy-refused', weight: 1,
  text: '买家只要原作，不愿等一个新版本。你再次确认后谢绝了报价。腾出的准备时间没有变成收入，原作仍在架子上。',
  later: '你尝试过协商，对方也作出了拒绝。接下来的生活仍靠普通订单。', world: { setFacts: { piece: 'offer-lost' }, addTags: ['proposal-refused'] } });
const inviteChoice = ENCOUNTERS.find(e => e.id === 'belong_address')!.choices.find(c => c.id === 'invite')!;
inviteChoice.outcomes[0].weight = 2;
inviteChoice.outcomes.push({ id: 'invite-missed', weight: 1, text: '阿岑没能请到假。你和林遥把空出的桌子借给邻居，散场后给他寄去一张照片。这次两边的人没能见面。',
  later: '你表达了邀请，相聚仍受各自生活的限制。', world: { setFacts: { twoHomes: 'invitation-open' }, addTags: ['proposal-refused'] } });
const MATURE: Record<string, [string,string]> = {
  'trust-open': ['如今我知道，说清经过也未必换来和解。我仍愿意开口，但会给不同的记忆留一个位置。','如果对方还不愿意谈，我能不能一边保留自己的记忆，一边继续来往？'],
  'trust-shelter': ['我曾靠沉默护住关系。后来才懂，能把负担分开说清，也是一种保护。','这一次，我是在给对方时间，还是替我们推迟了必须面对的事？'],
  'belong-road': ['出发不再只是离开。走过这些年，我想把相见也认真排进自己的生活。','如果再也去不了想去的地方，我最希望和谁一起度过眼前的日子？'],
  'belong-root': ['回来曾是我的承诺。如今我愿意把照应拆成具体的事，让彼此都还有自己的生活。','如果有一天我不能再照应别人，我们还能怎样确认彼此的牵挂？'],
  'worth-care': ['被需要陪我走了很久。现在我愿意把能做的说清，也把做不了的交给别人。','当别人不再把事情交给我，我还想怎样安排自己的时间？'],
  'worth-craft': ['我守住过自己的东西，也放下过一些。现在我想让它们与别人的生活相遇，同时保留可以商量的界限。','如果最后仍有没做完的东西，我能不能承认那些投入过的日子已经属于我？'],
};
for (const seed of UNDERSTANDING_SEEDS) {
  seed.matureRevised = MATURE[seed.id][0]; seed.matureQuestion = MATURE[seed.id][1];
}
