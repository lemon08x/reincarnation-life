import { Color, Graphics, Node } from 'cc';
import { UiKit } from './kit';

export type FamilyIcon = 'coin' | 'hammer' | 'book' | 'person' | 'chair' | 'box' | 'home' | 'check' | 'clock';
export const V = { paper: new Color('#faf8f0'), green: new Color('#375e4d'), soft: new Color('#ececdd'), ink: new Color('#293e36'), muted: new Color('#7d8877') };

// Small vector vocabulary shared by the scene, task progress and action cards.
class Paint {
  constructor(private g: Graphics) {}
  poly(points: number[][], color: string): void { this.g.fillColor = new Color(color); this.g.moveTo(points[0][0], -points[0][1]); points.slice(1).forEach(p => this.g.lineTo(p[0], -p[1])); this.g.close(); this.g.fill(); }
  rect(x: number, y: number, w: number, h: number, color: string, r = 0): void { this.g.fillColor = new Color(color); this.g.roundRect(x, -y-h, w, h, r); this.g.fill(); }
  circle(x: number,y: number,r: number,color: string): void { this.g.fillColor = new Color(color);this.g.circle(x,-y,r);this.g.fill(); }
  line(points: number[][], color: string, width = 2): void { this.g.strokeColor = new Color(color);this.g.lineWidth=width;this.g.moveTo(points[0][0],-points[0][1]);points.slice(1).forEach(p=>this.g.lineTo(p[0],-p[1]));this.g.stroke(); }
}
function person(p: Paint,x: number,y: number,s=1,old=false): void {
  p.circle(x,y+29*s,16*s,'#c2c8af');
  p.line([[x-5*s,y+10*s],[x-6*s,y+30*s]],'#545c49',6*s);p.line([[x+6*s,y+10*s],[x+9*s,y+30*s]],'#545c49',6*s);
  p.rect(x-13*s,y-10*s,26*s,29*s,old?'#879a78':'#375e4d',6*s);
  p.poly([[x-5*s,y-8*s],[x+6*s,y-8*s],[x+9*s,y+19*s],[x-8*s,y+19*s]],'#d9bb8c');
  p.circle(x,y-20*s,11*s,'#e5bc8e');p.circle(x,y-26*s,11*s,old?'#d0d1bc':'#424e41');p.rect(x-9*s,y-23*s,18*s,13*s,'#e5bc8e',4*s);
  p.circle(x-4*s,y-20*s,1.3*s,'#293e36');p.circle(x+5*s,y-20*s,1.3*s,'#293e36');
  p.line([[x-12*s,y],[x-23*s,y+10*s]],'#e5bc8e',6*s);p.line([[x+12*s,y],[x+24*s,y-6*s]],'#e5bc8e',6*s);
}
function chair(p: Paint,x: number,y: number,s=1,ghost=false): void {
  const c=ghost?'#cbd0bd':'#b5824e';
  p.line([[x-12*s,y-20*s],[x-12*s,y+18*s]],c,4*s);p.line([[x+10*s,y-20*s],[x+10*s,y+18*s]],c,4*s);
  p.rect(x-14*s,y-21*s,26*s,10*s,c,2*s);p.poly([[x-14*s,y-2*s],[x+10*s,y-2*s],[x+18*s,y+3*s],[x-8*s,y+5*s]],ghost?'#dee2d3':'#e2ba7b');
  p.line([[x-8*s,y+4*s],[x-8*s,y+24*s]],c,4*s);p.line([[x+17*s,y+3*s],[x+17*s,y+21*s]],c,4*s);
}
function house(p: Paint,x:number,y:number,s=1,improved=true):void {
  p.circle(x,y+35*s,79*s,'#c5cbad');
  p.poly([[x-82*s,y-18*s],[x+25*s,y-15*s],[x+25*s,y+53*s],[x-82*s,y+38*s]],improved?'#e8d7af':'#c9b99a');
  p.poly([[x+25*s,y-15*s],[x+83*s,y-40*s],[x+83*s,y+29*s],[x+25*s,y+53*s]],'#caba91');
  p.poly([[x-100*s,y-19*s],[x-40*s,y-75*s],[x+80*s,y-60*s],[x+25*s,y-6*s]],improved?'#637965':'#8c8870');
  p.poly([[x+25*s,y-6*s],[x+80*s,y-60*s],[x+99*s,y-37*s],[x+83*s,y-27*s]],'#49614f');
  for(let i=1;i<6;i++)p.line([[x+(-100+i*20)*s,y+(-19+i*2.6)*s],[x+(-40+i*20)*s,y+(-75+i*2.6)*s]],'#829078',s);
  p.rect(x-36*s,y-9*s,27*s,53*s,'#667452',2*s);p.rect(x-69*s,y-4*s,24*s,21*s,'#94a17a',2*s);
  p.line([[x-57*s,y-4*s],[x-57*s,y+17*s]],'#ead9b1',2*s);p.line([[x-69*s,y+6*s],[x-45*s,y+6*s]],'#ead9b1',2*s);
}
function tree(p:Paint,x:number,y:number,s=1):void {p.line([[x,y],[x,y-55*s]],'#9b8c65',7*s);p.circle(x-16*s,y-59*s,26*s,'#9bb480');p.circle(x+12*s,y-70*s,28*s,'#789b68');p.circle(x-1*s,y-87*s,24*s,'#aec28d');}
function symbol(p:Paint,kind:FamilyIcon,x:number,y:number,s=1,ghost=false):void {
  if(kind==='chair'){chair(p,x,y,s,ghost);return;}
  if(kind==='person'){person(p,x,y,s,true);return;}
  if(kind==='home'){house(p,x,y,s*.3);return;}
  if(kind==='hammer'){p.line([[x-10*s,y+13*s],[x+8*s,y-10*s]],'#b98953',7*s);p.poly([[x,y-15*s],[x+8*s,y-19*s],[x+20*s,y-9*s],[x+14*s,y-3*s]],'#546956');return;}
  if(kind==='coin'){p.circle(x,y,16*s,ghost?'#d2d6c3':'#d8a353');p.circle(x,y,12*s,ghost?'#e1e4d7':'#edc985');p.rect(x-3*s,y-3*s,6*s,6*s,'#a98249');return;}
  if(kind==='book'){p.poly([[x-18*s,y-14*s],[x,y-9*s],[x,y+16*s],[x-18*s,y+11*s]],'#d8bd88');p.poly([[x,y-9*s],[x+18*s,y-14*s],[x+18*s,y+11*s],[x,y+16*s]],'#f5e7c5');for(let j=0;j<3;j++)p.line([[x+4*s,y+(-4+j*6)*s],[x+14*s,y+(-7+j*6)*s]],'#c1ad7d',s);return;}
  if(kind==='box'){p.poly([[x-19*s,y-10*s],[x+6*s,y-18*s],[x+21*s,y-7*s],[x-5*s,y+2*s]],'#dabc84');p.poly([[x-19*s,y-10*s],[x-5*s,y+2*s],[x-5*s,y+23*s],[x-19*s,y+10*s]],'#b69361');p.poly([[x-5*s,y+2*s],[x+21*s,y-7*s],[x+21*s,y+14*s],[x-5*s,y+23*s]],'#c8a571');return;}
  if(kind==='check'){p.line([[x-12*s,y],[x-3*s,y+9*s],[x+15*s,y-12*s]],'#375e4d',5*s);return;}
  p.circle(x,y,18*s,'#d5ddc5');p.line([[x,y-11*s],[x,y],[x+9*s,y+4*s]],'#667b5a',3*s);
}
export function drawIcon(kit:UiKit,parent:Node,kind:FamilyIcon,x:number,y:number,size=48,ghost=false):Node {const n=kit.createNode(parent,`Icon:${kind}`,x,y,size,size);symbol(new Paint(n.addComponent(Graphics)),kind,0,0,size/48,ghost);return n;}
export interface FamilySceneState { home?:boolean; security?:number; asset?:number; education?:number; reputation?:number; mode?:string; phase?:string; }
export function drawFamilyDiorama(kit:UiKit,parent:Node,x:number,y:number,width:number,height:number,state:FamilySceneState):Node {
  const panel=kit.panel(parent,x,y,width,height,new Color('#e5ecd8'),26,new Color('#e5ecd8'));
  const n=kit.createNode(panel,'Diorama',-width/2,height/2,width,height);n.setScale(width/420,height/400,1);
  const p=new Paint(n.addComponent(Graphics));
  p.poly([[0,150],[0,95],[63,50],[134,87],[215,38],[287,88],[345,64],[420,102],[420,210]],'#ceddc0');
  p.poly([[0,165],[83,123],[176,160],[266,102],[420,139],[420,383],[0,383]],'#c0d0ad');
  p.poly([[0,248],[94,210],[229,237],[331,206],[420,240],[420,382],[0,382]],'#d6d9b8');
  if(state.home){
    p.poly([[0,347],[85,326],[213,372],[300,362],[420,329],[420,382],[0,382]],'#a6c7bd');p.line([[12,358],[75,348],[156,371]],'#d3e8db',2);
    tree(p,363,173,.8);tree(p,44,260,.55);house(p,147,158,1.05,!!state.security);
    p.poly([[119,222],[175,218],[278,283],[243,306]],'#e7d9b7');
    if((state.asset??0)>=2)house(p,318,267,.69);else if(state.asset){p.rect(277,255,70,13,'#bb975e',3);p.line([[285,265],[285,299]],'#9e7c50',5);symbol(p,'hammer',312,250,.8);}
    if(state.education)symbol(p,'book',286,321,1.3);
    if((state.security??0)>=2){symbol(p,'box',73,292,1.1);symbol(p,'box',104,299,.9);}
    if(state.reputation){p.line([[356,286],[356,330]],'#9b8255',4);p.rect(327,275,57,22,'#d6ad6d',3);p.line([[339,285],[370,285]],'#687c59',3);}
    person(p,193,285,1.05);person(p,113,252,.78,true);
    for(let j=0;j<3;j++)for(let i=0;i<4;i++)p.circle(42+i*12,295+j*12-i*3,5,'#88a773');
  }else{
    tree(p,369,146,.75);
    const money=state.mode==='funds', travel=state.phase==='opportunity';
    if(money){
      p.poly([[0,240],[105,205],[420,261],[420,381],[0,381]],'#b4cfc0');p.poly([[43,259],[275,208],[389,273],[158,334]],'#c4a978');
      for(let i=0;i<7;i++)p.line([[63+i*32,255-i*7],[169+i*30,322-i*7]],'#ac9266',2);
      symbol(p,'box',115,216,1.5);symbol(p,'box',296,247,1.6);person(p,205,235,1.8);
      if(!travel)house(p,114,134,.69,!!state.security);
      if(state.phase==='context'){symbol(p,'book',94,284,1.3);symbol(p,'coin',133,299,.6);}
      if(state.phase==='prepare'){person(p,93,228,1.35,true);symbol(p,'hammer',123,235,1);}
      if(state.phase==='apply'){p.rect(79,260,80,15,'#b99461',3);p.line([[86,274],[86,309]],'#9f8054',6);chair(p,310,247,1.3);symbol(p,'hammer',116,251,.9);}
      if(travel){p.poly([[230,330],[370,330],[344,358],[251,351]],'#90794f');p.line([[297,329],[297,271]],'#87774e',4);p.poly([[300,272],[300,322],[344,313]],'#eee3bd');}
      if(state.phase==='difficulty'){
        for(let i=0;i<4;i++)p.circle(71+i*24,82+(i%2)*9,24,'#a2b2a2');
        for(let i=0;i<8;i++)p.line([[63+i*20,113+(i%3)*7],[57+i*20,131+(i%3)*7]],'#8ba9a0',2);
        p.line([[82,124],[92,135],[86,145]],'#795e49',3);
      }
      if(state.phase==='settle'){symbol(p,'book',112,274,1.6);for(let i=0;i<3;i++)symbol(p,'coin',290+i*24,295,.65);}
    }else{
      house(p,126,130,1.4);p.poly([[0,260],[170,225],[420,288],[420,382],[0,382]],'#d4cdb0');person(p,180,236,1.9);
      p.poly([[107,272],[225,249],[278,273],[161,298]],'#c69d66');p.poly([[161,298],[278,273],[278,286],[161,312]],'#a57d51');
      p.line([[124,289],[124,350]],'#9f8054',9);p.line([[264,290],[264,354]],'#9f8054',9);symbol(p,'hammer',233,271,.8);
      p.circle(329,279,48,'#e9dba8');chair(p,323,275,1.7);
      if(state.phase==='difficulty')p.line([[305,262],[317,271],[309,280]],'#955f43',3);
      if(state.phase==='prepare'||state.phase==='context')symbol(p,'book',126,278,.75);
      if(state.phase==='prepare')person(p,76,249,1.3,true);
      if(state.phase==='opportunity')symbol(p,'box',340,341,1.1);
      if(state.phase==='settle')symbol(p,'check',322,211,1.15);
    }
  }
  return panel;
}
