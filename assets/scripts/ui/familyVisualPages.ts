import { Button, Node } from 'cc';
import { FamilyEventView, FamilyHomeView, FamilySettlementView, VisualReward } from '../app/presentation/familyUiModels';
import { BUILDING_LABELS } from '../app/presentation/familyVisualCopy';
import type { FamilyPageActions } from './familyPages';
import { UiKit } from './kit';
import { drawFamilyDiorama, drawIcon, FamilyIcon, V } from './familyVisuals';

function hit(n:Node,fn:()=>void):void { const b=n.addComponent(Button);b.transition=Button.Transition.NONE;n.on(Button.EventType.CLICK,fn); }
function chip(kit:UiKit,p:Node,icon:FamilyIcon,text:string,x:number,y:number,w=130):void {const n=kit.panel(p,x,y,w,54,V.soft,24,V.soft);drawIcon(kit,n,icon,-w/2+28,0,27);kit.label(n,text,17,0,w-54,42,25,V.ink,true,true);}
function reward(kit:UiKit,p:Node,r:VisualReward,x:number,y:number):void {drawIcon(kit,p,r.icon,x-26,y,25);kit.label(p,r.text,x+19,y,92,34,21,V.green,true);}
function heading(kit:UiKit,p:Node,title:string,sub:string,left:string,back:()=>void,right:string,more:()=>void):number {
  const top=640-kit.layout.top;
  kit.textAction(p,left,-262,top-48,back,134);kit.label(p,title,0,top-46,378,52,34,V.ink,true,true);
  kit.textAction(p,right,264,top-48,more,126);kit.label(p,sub,0,top-98,610,36,23,V.muted,true);
  return top;
}
function categoryIcon(category:string):FamilyIcon {return category==='education'?'book':category==='asset'?'hammer':category==='reputation'?'person':'home';}

export function renderFamilyHome(kit:UiKit,view:FamilyHomeView,actions:FamilyPageActions & {build:(id:string)=>void;continueRun:()=>void;startNext:()=>void;viewSettlement:()=>void}):void {
  const {hud}=kit.beginPage('family-home'); const bottom=-640+kit.layout.bottom;
  const top=heading(kit,hud,view.familyName,`第 ${view.generationCount+1} 代 · ${view.stage}`,'‹ 旧记录',actions.goLegacy,'家史',actions.showHistory);
  const generations=[Math.max(1,view.generationCount-1),Math.max(1,view.generationCount),view.generationCount+1].filter((n,i,a)=>a.indexOf(n)===i);
  generations.forEach((n,i)=>{const x=(i-(generations.length-1)/2)*146;kit.panel(hud,x,top-174,72,72,n===view.generationCount+1?V.soft:V.paper,36,V.soft);drawIcon(kit,hud,'person',x,top-174,40);kit.label(hud,`第${n}代`,x,top-226,110,30,21,V.muted,true);});
  const scene=drawFamilyDiorama(kit,hud,0,top-507,648,500,{home:true,security:view.houseLevel,asset:view.assetLevel,education:view.educationLevel,reputation:view.reputationLevel});
  chip(kit,scene,'coin',String(view.funds),-238,195,122);
  const owned=[{icon:'home' as const,level:view.houseLevel},{icon:'hammer' as const,level:view.assetLevel},{icon:'book' as const,level:view.educationLevel},{icon:'person' as const,level:view.reputationLevel}];
  owned.filter(o=>o.level>0).forEach((o,i)=>{const n=kit.panel(scene,-237+i*142,-190,112,56,V.paper,24,V.paper);drawIcon(kit,n,o.icon,-23,0,31);kit.label(n,String(o.level),25,0,40,34,24,V.green,true,true);hit(n,actions.showHistory);});
  kit.label(hud,view.runStatus==='active'?'本代进行中':'添置家业',-184,bottom+408,278,38,28,V.ink,false,true);
  kit.textAction(hud,'建设说明',239,bottom+407,()=>actions.expand('buildings','家庭建设',view.buildings.map(b=>`${b.name} · ${b.cost} 两\n${b.benefit}\n${b.unavailableReason??''}`).join('\n\n')),160);
  view.buildings.forEach((b,i)=>{
    const disabled=view.runStatus==='active'||!b.available||!b.affordable||b.builtThisIntermission;
    const n=kit.panel(hud,(i-1)*218,bottom+267,204,211,V.soft,22,V.soft);
    drawIcon(kit,n,b.id==='security:reserve'?'box':categoryIcon(b.category),0,47,60,disabled);
    kit.label(n,BUILDING_LABELS[b.id]??b.name,0,-15,192,52,25,disabled?V.muted:V.ink,true,true);
    if(disabled)kit.label(n,view.runStatus==='active'?'本代结束后':b.builtThisIntermission?'已安排建设':!b.available?'尚未解锁':'资金不足',0,-75,180,34,22,V.muted,true);
    else reward(kit,n,{icon:'coin',text:`−${b.cost}`},0,-74);
    const reason=view.runStatus==='active'?'请先完成本代任务。':b.builtThisIntermission?'本次已完成一项建设。':b.unavailableReason??`需要 ${b.cost} 两，现有 ${view.funds} 两。`;
    hit(n,()=>disabled?actions.expand(b.id,b.name,`${b.benefit}\n\n${reason}`):actions.build(b.id));
  });
  if(!view.buildings.length)kit.label(hud,'家业已齐备',0,bottom+260,500,60,28,V.green,true);
  kit.button(hud,view.primaryAction==='continue'?'继续这一代  ›':view.generationCount===0?'开始第一代  ›':'开始下一代  ›',0,bottom+69,648,100,V.green,view.primaryAction==='continue'?actions.continueRun:actions.startNext,true,V.paper,32);
}

export function renderFamilyEvent(kit:UiKit,view:FamilyEventView,actions:FamilyPageActions & {select:(id:string)=>void;backHome?:()=>void},page=0):void {
  const {hud}=kit.beginPage(`family-event:${view.instanceId}`); const bottom=-640+kit.layout.bottom;const v=view.visual;
  const title=v?.kind==='funds'?'备齐过冬开支':v?.kind==='orders'?'交付三批订单':'学成独立做工';
  const top=heading(kit,hud,title,`${view.memberName} · 第 ${view.generation} 代`,'‹ 家园',actions.backHome??actions.goLegacy,'角色',actions.showMember);
  const progress=kit.panel(hud,0,top-191,648,130,V.soft,24,V.soft);
  if(v?.kind==='funds'){
    const count=Math.min(10,v.target);for(let i=0;i<count;i++)drawIcon(kit,progress,'coin',-265+i*40,7,30,i>=v.amount);
  }else{
    (v?.slots??[]).forEach((s,i)=>{drawIcon(kit,progress,v?.kind==='orders'?'chair':i===0?'book':i===1?'hammer':'chair',-238+i*125,12,49,!s.done);kit.label(progress,s.label,-238+i*125,-41,119,30,19,V.muted,true);});
  }
  kit.label(progress,`${v?.amount??0} / ${v?.target??3}`,225,7,154,50,36,V.green,true,true);hit(progress,()=>actions.expand('goal',view.missionTitle,`${view.goalText}\n\n${view.progressLine}`));
  const scene=drawFamilyDiorama(kit,hud,0,top-500,648,450,{...v?.assets,mode:v?.kind,phase:v?.phase});
  const sceneTitle=kit.panel(scene,0,184,600,54,V.paper,24,V.paper);kit.label(sceneTitle,view.title,0,0,555,42,27,V.ink,true,true);hit(sceneTitle,()=>actions.expand('event',view.title,view.text));
  chip(kit,scene,'coin',String(view.budget),-230,-181,128);
  if(v){[['hammer',v.abilities.hands],['person',v.abilities.talk],['book',v.abilities.plan]].forEach((entry,i)=>chip(kit,scene,entry[0] as FamilyIcon,String(entry[1]),55+i*89,-181,80));}
  if(view.feedback){
    const n=kit.panel(scene,-155,114,280,54,V.paper,24,V.paper);drawIcon(kit,n,'check',-107,0,26);
    const change=view.feedback.changes.find(c=>/收入|花费|动手|筹划|沟通|交付|阶段/.test(c));
    kit.label(n,change??'上一步已完成',18,0,226,38,22,V.green,true);hit(n,()=>actions.expand('feedback','刚才的结果',`${view.feedback!.text}\n\n${view.feedback!.changes.join('\n')}`));
  }
  const help=()=>actions.expand('actions',view.title,`${view.text}\n\n${view.options.map(o=>`${o.shortLabel??o.text}：${o.text}\n${o.preview}\n${o.cost?`实际支出 ${o.cost} 两。`:''}${o.income?`实际收入 ${o.income} 两。`:''}${o.sourceLabel??''}${o.disabledReason??''}`).join('\n\n')}`);
  kit.label(hud,'怎么处理？',-211,bottom+410,210,40,28,V.ink,false,true);
  const pages=Math.ceil(view.options.length/6);
  if(pages>1)kit.textAction(hud,`更多方式 ${page+1}/${pages}`,74,bottom+410,()=>renderFamilyEvent(kit,view,actions,(page+1)%pages),220);
  kit.textAction(hud,'说明',267,bottom+410,help,112);
  const options=view.options.slice(page*6,page*6+6);const rows=options.length>3?2:1;const cardH=rows===1?286:159;
  options.forEach((o,i)=>{
    const cols=rows===1?options.length:3;const x=(i%3-(cols-1)/2)*218;const y=rows===1?bottom+222:bottom+307-Math.floor(i/3)*175;
    const n=kit.panel(hud,x,y,204,cardH,V.soft,22,V.soft);
    drawIcon(kit,n,o.icon??'clock',0,rows===1?64:38,rows===1?77:43,!o.enabled);
    kit.label(n,o.shortLabel??o.text,0,rows===1?-11:-9,192,52,26,o.enabled?V.ink:V.muted,true,true);
    if(o.enabled){
      const r=o.rewards??[];if(r.length)r.slice(0,rows===1?3:2).forEach((z,j)=>{
        if(rows===1)reward(kit,n,z,0,-63-j*29);
        else {const x=r.length>1?(j===0?-49:49):0;drawIcon(kit,n,z.icon,x-27,-57,21);kit.label(n,z.text,x+16,-57,65,31,19,V.green,true);}
      });
      else kit.label(n,'不花费',0,rows===1?-72:-55,170,30,21,V.muted,true);
    }else kit.label(n,'条件不足 ⓘ',0,rows===1?-75:-55,184,34,22,V.muted,true);
    hit(n,()=>o.enabled?actions.select(o.optionId):actions.expand(o.optionId,o.shortLabel??o.text,`${o.text}\n\n${o.disabledReason??o.preview}`));
  });
}

export function renderFamilySettlement(kit:UiKit,view:FamilySettlementView,actions:FamilyPageActions & {backHome:()=>void}):void {
  const {hud}=kit.beginPage(`family-settlement:${view.generation}`);const bottom=-640+kit.layout.bottom;
  const top=heading(kit,hud,'这一代留下的',`${view.memberName} · 第 ${view.generation} 代`,'‹ 家园',actions.backHome,'家史',actions.showHistory);
  drawFamilyDiorama(kit,hud,0,top-330,648,375,{mode:view.missionTitle.includes('生活')?'funds':'stages',phase:'settle'});
  const stamp=kit.panel(hud,0,top-174,282,61,V.paper,26,V.paper);drawIcon(kit,stamp,view.outcome==='achieved'?'check':'clock',-96,0,33);kit.label(stamp,view.outcomeName,28,0,210,46,30,V.green,true,true);
  chip(kit,hud,'coin',String(view.familyFundsAfter),0,top-562,180);kit.label(hud,'家庭资金',0,top-609,300,35,23,V.muted,true);
  const items=Array.from(new Set(view.itemsGained)).map(name=>({name,icon:(/工具|工作/.test(name)?'hammer':/册|学|笔记/.test(name)?'book':/记录|往来/.test(name)?'person':'home') as FamilyIcon}));
  const evidence=Array.from(new Set(view.evidenceAdded)).map(id=>({name:id==='crafted'?'手艺经历':id==='learned'?'学习经历':id==='delivered'?'交付经历':'储备经历',icon:(id==='crafted'?'hammer':id==='learned'?'book':id==='delivered'?'check':'box') as FamilyIcon}));
  const rewards=[...items,...evidence].slice(0,6);
  kit.label(hud,'传给下一代',-164,bottom+419,320,42,28,V.ink,false,true);
  kit.textAction(hud,'收支明细',244,bottom+419,()=>actions.expand('settlement','本代结果',`${view.goalResult}\n收入 ${view.netIncome} 两 · 支出 ${view.netSpent} 两\n返还 ${view.budgetReturned} 两\n\n${Array.from(new Set(view.leftForFamily)).join('\n')}\n\n${view.chapterSummary?.lines.join('\n')??''}`),166);
  rewards.forEach((r,i)=>{const n=kit.panel(hud,(i%3-1)*218,bottom+307-Math.floor(i/3)*126,204,112,V.soft,18,V.soft);drawIcon(kit,n,r.icon,-61,0,41);kit.label(n,r.name,27,0,134, 70,24,V.ink,true,true);});
  if(!rewards.length)kit.label(hud,'带着结余，继续生活',0,bottom+270,560,54,28,V.muted,true);
  kit.button(hud,'回到家园  ›',0,bottom+69,648,100,V.green,actions.backHome,true,V.paper,32);
}
