import { ExperienceFragment } from '../core/model';

// Short, authored decision copy; full narratives remain in the journal.
const STORIES: Record<string, string> = {
  'first-box': '周师傅的木箱裂了，你和阿岑还要把东西送到家。先帮哪件事？',
  'offer-town': '周师傅想请你放学后帮忙修东西。留下学手艺，还是先接零活照顾家里？',
  'offer-harbor': '阿岑来信说，河港货栈正在招人。去外面试试，还是先留在家附近？',
  'offer-market': '林遥的小店缺人，愿意教你认货、记账。去邻镇看店，还是留在小城？',
  'practice-town': '今天空出半天，师傅和阿岑都在。你想把哪一项本领练扎实？',
  'practice-harbor': '货卸完了，师傅也随船到了河港。趁着空闲，想再学一点什么？',
  'practice-market': '今天散市早。师傅和阿岑坐在屋檐下，你有时间练一项本领。',
  prepare: '眼前的生活渐渐稳定。拿出一点时间，为往后的哪种可能作准备？',
  'turn-town': '师傅忙不过来，愿意介绍小城的修理活给你。接下机会，还是继续现在的生活？',
  'turn-harbor': '河港的新运输安排需要交接人，阿岑愿意介绍。去试一试，还是留下？',
  'turn-market': '林遥想找人共同看店、按约分账，不必一次买下铺面。要接过钥匙吗？',
  'payoff-town-0': '邻居送来一只裂开的木箱。以前需要人教的事，现在你有了自己的办法。',
  'payoff-town-1': '大雨过后，几户人家的木窗需要修整。师傅也在，你准备怎样帮忙？',
  'payoff-town-2': '旧屋的一扇门松了。这是熟悉的小问题，试试已经积下的本领。',
  'payoff-harbor-0': '开船前，一只货箱裂开了。小时候学过的办法，在河边也能用上。',
  'payoff-harbor-1': '两条船同时靠岸，码头挤满了货物。阿岑等你拿出一个办法。',
  'payoff-harbor-2': '物资到了最后一段交接。旧箱和清单都很熟悉，你准备怎样处理？',
  'payoff-market-0': '木柜的抽屉卡了，几笔找零也没核清。林遥问你先处理哪件事。',
  'payoff-market-1': '赶集日排起长队，林遥忙着取货。你已经会的本领，正好可以帮忙。',
  'payoff-market-2': '小店准备试用，熟客来看新柜台。哪里还需要你用熟悉的办法调整？',
  'project-town': '家里的旧屋需要整修，师傅愿意帮忙。你想承担哪一部分？',
  'project-harbor': '阿岑请你安排一趟社区物资。工具可以借用，你想主要负责什么？',
  'project-market': '林遥想让小店更方便邻里使用。你准备接手哪一部分改造？',
};

export function compactStory(id: string, fallback: string): string {
  if (STORIES[id]) return STORIES[id];
  if (id.startsWith('work-')) return '事情有了方向，工具和人手仍有缺口。练好本领、投入家底，还是缩小范围？';
  if (id.startsWith('finish-')) return '到了交付的时候。稳妥完成约定，还是用积累争取更好的收尾？';
  if (id.startsWith('harvest-')) return '岁月过去，做成的事仍留在生活里。现在想怎样使用属于自己的余地？';
  return fallback;
}

export function compactOutcome(f: ExperienceFragment): string {
  const id = f.templateId, c = f.choiceId;
  if (id === 'first-box') return c === 'repair' ? '木箱补好了，你第一次学会沿纹路找裂口。' : c === 'agreement' ? '分工说清了，大家没有白等。' : '清点完毕，东西一样也没落下。';
  if (id.startsWith('offer-')) return c === 'stay' ? '你留在家附近做短工，保留了其他可能。' : id.endsWith('town') ? '师傅给你腾出半张桌子，你开始做修理帮工。' : id.endsWith('harbor') ? '你来到河港，从货栈帮工做起。' : '你接过钥匙，在街市开始学着看店。';
  if (id.startsWith('practice-')) return c === 'repair' ? '这一次，木箱接缝是你自己合上的。' : c === 'agreement' ? '你们把做得到的分工和时间说清了。' : '收支和顺序理清了，做事不再临时翻找。';
  if (id === 'prepare') return c === 'learn' ? '工具修好了，手上的方法也更稳了。' : c === 'earn' ? '普通工作按约完成，你把余钱存了下来。' : '旧识回了消息，你知道了外面有哪些变化。';
  if (id.startsWith('turn-')) return c === 'stay' ? '你谢过机会，继续把现在的生活经营下去。' : id.endsWith('town') ? '你接下小城的修理活，开始为自己的交付负责。' : id.endsWith('harbor') ? '你接手河港的普通班次，旧本领也跟着来到这里。' : '分账和职责说清了，你开始与林遥共同看店。';
  if (id.startsWith('payoff-')) {
    if (c === 'help') return '你做好普通部分，合作者接手难处，报酬按约结清。';
    const place = id.split('-')[1];
    return place === 'town' ? '修整顺利完成，积下的办法帮你从容处理了旧难题。' : place === 'harbor' ? '货物顺利交接，过去学过的办法这次派上了用场。' : '柜台边的事情理顺了，你拿到了这次工作的回报。';
  }
  if (id.startsWith('project-')) return c === 'hands' ? '你接下修整实物的部分，开始试做。' : c === 'talk' ? '大家说定了分工，你负责合作与交接。' : '材料、费用和顺序写清了，你负责筹划。';
  if (id.startsWith('work-')) return c === 'practice' ? '练过最不熟悉的一步，你准备得更稳了。' : c === 'invest' ? '材料备齐了，共同练习找出了漏看的问题。' : '大家同意先做小一点，已完成的部分先结了款。';
  if (id.startsWith('finish-')) return c === 'master' ? '最后的难点处理好了，成果获得了合作者的认可。' : c === 'support' ? '你付清帮工费用，和合作者一起完成了收尾。' : '约定的部分交付了，你做成了一件自己的事。';
  if (id.startsWith('harvest-')) return c === 'teach' ? '你把亲手学过的办法，教给了后来的人。' : c === 'visit' ? '你照约见到了阿岑，一起聊起后来的人生。' : '你收好工具，给自己的日常留下了舒服和从容。';
  return f.howIResponded;
}
