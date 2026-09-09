from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import random, math

S=2
W,H=1440,1100
im=Image.new('RGB',(W*S,H*S),'#ecece4')
d=ImageDraw.Draw(im)
ox=oy=0
ink='#293e36'; green='#375e4d'; muted='#8a9588'; paper='#faf8f0'; gold='#d8a353'; clay='#bd7957'
def box(b): return tuple(int((v+(ox if i%2==0 else oy))*S) for i,v in enumerate(b))
def rr(b,fill,r=12,outline=None,width=1): d.rounded_rectangle(box(b),int(r*S),fill,outline,width=int(width*S))
def rect(b,fill): d.rectangle(box(b),fill)
def el(b,fill,outline=None,width=1): d.ellipse(box(b),fill,outline,width=int(width*S))
def line(p,fill,width=2): d.line([(int((x+ox)*S),int((y+oy)*S)) for x,y in p],fill,int(width*S),joint='curve')
def poly(p,fill): d.polygon([(int((x+ox)*S),int((y+oy)*S)) for x,y in p],fill)
def txt(x,y,t,size=16,fill=ink,bold=False,anchor='la'):
    font=ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc' if bold else 'C:/Windows/Fonts/msyh.ttc',int(size*S))
    d.text(((x+ox)*S,(y+oy)*S),t,font=font,fill=fill,anchor=anchor)
def coin(x,y,r=8):
    el((x-r,y-r,x+r,y+r),gold); el((x-r+2,y-r+2,x+r-2,y+r-2),None,'#edc985'); rect((x-2,y-2,x+2,y+2),'#9e743d')
def arrow(x,y,color=green): line([(x-5,y-5),(x,y),(x-5,y+5)],color,2)
def check(x,y,color=paper): line([(x-4,y),(x-1,y+3),(x+5,y-4)],color,2)
def sparkle(x,y,color=gold):
    poly([(x,y-7),(x+2,y-2),(x+7,y),(x+2,y+2),(x,y+7),(x-2,y+2),(x-7,y),(x-2,y-2)],color)
def chair(x,y,k=1,color='#b5824e',ghost=False):
    c='#ccd0be' if ghost else color
    line([(x-12*k,y-20*k),(x-12*k,y+17*k)],c,4*k)
    line([(x+10*k,y-20*k),(x+10*k,y+17*k)],c,4*k)
    rr((x-14*k,y-21*k,x+12*k,y-11*k),c,2*k)
    poly([(x-14*k,y-2*k),(x+10*k,y-2*k),(x+18*k,y+3*k),(x-8*k,y+5*k)],'#e2ba7b' if not ghost else '#e0e3d7')
    line([(x-8*k,y+4*k),(x-8*k,y+23*k)],c,4*k);line([(x+17*k,y+3*k),(x+17*k,y+21*k)],c,4*k)
def hammer(x,y,k=1):
    line([(x-8*k,y+10*k),(x+7*k,y-8*k)],'#bc8752',6*k)
    poly([(x+1*k,y-13*k),(x+8*k,y-16*k),(x+18*k,y-8*k),(x+13*k,y-2*k)],'#52645a')
def book(x,y,k=1):
    poly([(x-17*k,y-13*k),(x,y-9*k),(x,y+15*k),(x-17*k,y+10*k)],'#e9d5a9')
    poly([(x,y-9*k),(x+17*k,y-13*k),(x+17*k,y+10*k),(x,y+15*k)],'#f9edce')
    line([(x,y-9*k),(x,y+15*k)],'#b39463',2)
    for q in [-4,2,8]:line([(x+4*k,y+q*k),(x+13*k,y+(q-3)*k)],'#c5b181',1)
def sack(x,y,k=1):
    el((x-13*k,y-14*k,x+13*k,y+15*k),'#d9bb81')
    poly([(x-6*k,y-15*k),(x-9*k,y-22*k),(x+8*k,y-22*k),(x+5*k,y-15*k)],'#cda66b')
    line([(x-7*k,y-13*k),(x+7*k,y-13*k)],'#9a7b50',2)
    line([(x,y-4*k),(x,y+9*k)],'#a68b58',1)
def person(x,y,k=1,old=False,coat=green):
    el((x-14*k,y+29*k,x+18*k,y+36*k),'#c1c3a7')
    line([(x-5*k,y+12*k),(x-6*k,y+30*k)],'#52544a',6*k);line([(x+6*k,y+12*k),(x+9*k,y+30*k)],'#52544a',6*k)
    rr((x-13*k,y-8*k,x+13*k,y+19*k),coat,7*k)
    poly([(x-5*k,y-7*k),(x+7*k,y-7*k),(x+10*k,y+19*k),(x-8*k,y+19*k)],'#dbbe92')
    el((x-10*k,y-29*k,x+10*k,y-7*k),'#e7bc8d')
    el((x-11*k,y-32*k,x+11*k,y-17*k),'#d5d4c1' if old else '#424c42')
    rect((x-9*k,y-20*k,x+9*k,y-10*k),'#e7bc8d')
    el((x-5*k,y-19*k,x-3*k,y-17*k),ink);el((x+4*k,y-19*k,x+6*k,y-17*k),ink)
    line([(x-12*k,y),(x-21*k,y+10*k)],'#e7bc8d',6*k)
    line([(x+12*k,y),(x+24*k,y-4*k)],'#e7bc8d',6*k)
def tree(x,y,k=1):
    line([(x,y),(x,y-55*k)],'#9a865e',8*k)
    for a,b,r,c in [(-17,-62,28,'#94ad79'),(14,-68,31,'#789c67'),(0,-85,27,'#a9bb83')]:el((x+(a-r)*k,y+(b-r)*k,x+(a+r)*k,y+(b+r)*k),c)
def house(x,y,k=1,work=False):
    # ground contact, plaster walls, tiled roof, window and material details
    el((x-92*k,y+36*k,x+100*k,y+72*k),'#c4c7a8')
    poly([(x-82*k,y-18*k),(x+25*k,y-15*k),(x+25*k,y+53*k),(x-82*k,y+38*k)],'#e8d7af')
    poly([(x+25*k,y-15*k),(x+83*k,y-40*k),(x+83*k,y+29*k),(x+25*k,y+53*k)],'#caba91')
    poly([(x-100*k,y-19*k),(x-40*k,y-75*k),(x+80*k,y-60*k),(x+25*k,y-6*k)],'#637265')
    poly([(x+25*k,y-6*k),(x+80*k,y-60*k),(x+99*k,y-37*k),(x+83*k,y-27*k)],'#465e51')
    for i in range(1,6):line([(x+(-100+i*20)*k,y+(-19+i*2.6)*k),(x+(-40+i*20)*k,y+(-75+i*2.6)*k)],'#7c8974',1*k)
    for i in range(1,4):line([(x+(-100+i*15)*k,y+(-19-i*14)*k),(x+(25+i*14)*k,y+(-6-i*13.5)*k)],'#536658',1*k)
    rr((x-36*k,y-9*k,x-8*k,y+44*k),'#807956',2)
    rect((x-30*k,y-4*k,x-15*k,y+39*k),'#596b56')
    rr((x-69*k,y-4*k,x-45*k,y+16*k),'#8a9574',2)
    line([(x-57*k,y-4*k),(x-57*k,y+16*k)],'#ead9b1',2);line([(x-69*k,y+6*k),(x-45*k,y+6*k)],'#ead9b1',2)
    if work:
        poly([(x+32*k,y-5*k),(x+70*k,y-21*k),(x+70*k,y+29*k),(x+32*k,y+44*k)],'#5e6b53')
        for i in range(3):line([(x+(40+i*10)*k,y+32*k),(x+(40+i*10)*k,y+(-6-i*4)*k)],'#bda77a',3)
    else:
        rr((x+44*k,y-5*k,x+65*k,y+13*k),'#7e896b',2)
def badge(x,y,kind,complete=True):
    el((x-22,y-22,x+22,y+22),paper,'#d7d7c2',1)
    if kind=='hammer':hammer(x,y,.8)
    if kind=='book':book(x,y,.8)
    if kind=='sack':sack(x,y+2,.7)
    if complete:el((x+10,y+10,x+24,y+24),green);check(x+17,y+17)
def phone(x,y):
    global ox,oy
    ox=x;oy=y
    rr((-7,-7,427,887),'#d6d9cb',37)
    rr((0,0,420,880),paper,30)
    rr((169,9,251,15),'#dbddcf',4)
def header(title,sub):
    txt(24,40,title,24,bold=True);txt(25,76,sub,12,muted)
    rr((305,39,395,77),'#eae9d8',19);coin(325,58,8);txt(345,58,'12',19,bold=True,anchor='lm')

# Presentation board
txt(90,45,'家业',34,bold=True)
txt(188,59,'场景化 UI 概念预览',17,'#6e7d6c')
txt(1350,62,'01 / 视觉方向',12,muted,anchor='ra')
line([(90,105),(1350,105)],'#d6dacd',1)
txt(253,130,'家园',18,bold=True);txt(323,134,'积累直接长在场景里',13,'#74816e')
txt(773,130,'当代任务',18,bold=True);txt(883,134,'看场景，点动作',13,'#74816e')

phone(250,180)
header('河岸沈家','第三代 · 春')
# portraits, continuity conveyed by objects and checkmarks
line([(64,123),(351,123)],'#d4d9c6',2)
for x,old,co in [(68,True,'#929c88'),(205,True,'#839c7d'),(348,False,green)]:
    el((x-22,101,x+22,145),'#e6e9d8' if old else '#dce7d5',green if not old else None)
    person(x,133,.46,old,co)
    if old:el((x+11,131,x+25,145),'#849b72');check(x+18,138)
txt(68,153,'第一代',10,muted,anchor='ma');txt(205,153,'第二代',10,muted,anchor='ma');txt(348,153,'这一代',10,green,True,anchor='ma')
# landscape area
rr((16,185,404,595),'#e7eddb',22)
poly([(17,308),(17,239),(65,219),(128,251),(195,208),(259,241),(324,215),(403,251),(403,328)],'#d0ddc2')
poly([(17,333),(92,288),(156,315),(245,266),(328,301),(403,276),(403,392),(17,392)],'#bdcfb0')
poly([(17,381),(100,347),(190,365),(286,335),(403,360),(403,565),(17,565)],'#d5dabb')
poly([(17,524),(89,518),(153,546),(226,568),(307,558),(403,521),(403,579),(376,593),(39,593),(17,579)],'#a7c9bf')
line([(24,550),(74,546),(127,563),(186,581)],'#d3e7d9',2)
poly([(75,418),(126,415),(249,480),(300,469),(317,493),(259,520),(175,483)],'#e9debe')
tree(353,358,.72);tree(46,430,.48)
house(144,334,1.03)
house(309,430,.73,True)
badge(160,268,'sack');badge(336,371,'hammer')
# household life props and garden
for a in range(3):
    line([(48,468+a*10),(93,456+a*10)],'#aea57b',5)
    for b in range(4):el((51+b*10,459+a*10-b*2,59+b*10,467+a*10-b*2),'#83a168')
line([(177,369),(243,349)],'#92976e',2)
for i in range(3):poly([(184+i*17,368-i*5),(196+i*17,364-i*5),(198+i*17,385-i*5),(185+i*17,389-i*5)],['#e7e0bd','#b1be91','#d6aa80'][i])
person(207,436,.9);person(105,409,.7,True,coat='#8b9875')
sack(272,476,.7);book(319,480,.65)
badge(319,479,'book')
rr((39,555,221,582),paper,14);check(54,568,green);txt(69,568,'家里的工具，传下来了',11,green,anchor='lm')
# upgrade actionable card
txt(25,615,'添置家业',17,bold=True)
rr((24,649,396,747),'#eeebdc',18)
el((37,666,100,729),'#dde4cf');hammer(69,698,1.35)
txt(115,665,'修缮工作间',18,bold=True);coin(124,709,7);txt(139,709,'4',15,green,anchor='lm')
arrow(171,710,'#a0a58c');chair(202,710,.38)
rr((290,679,376,721),green,12);txt(333,700,'修建',16,paper,True,'mm')
rr((24,771,396,833),green,18);txt(208,802,'开始这一代',19,paper,True,'mm');arrow(349,802,paper)
rr((165,855,255,859),'#cbd0c0',2)

phone(770,180)
# slim gameplay header
line([(32,55),(24,62),(32,69)],green,2)
txt(49,62,'家园',13,green,anchor='lm')
txt(211,61,'交付三把椅子',22,ink,True,'mm')
el((361,42,395,76),'#e3e7d8');person(378,65,.4)
# objective as physical items
rr((24,100,396,187),'#ececdd',18)
for x in [80,148]:chair(x,142,.9)
chair(216,142,.9,ghost=True)
txt(317,132,'2 / 3',25,green,True,'mm')
txt(317,161,'月底交付',11,muted,anchor='mm')
# event diorama
rr((16,203,404,588),'#e1e9d4',22)
poly([(17,248),(117,216),(243,253),(404,221),(404,402),(17,402)],'#c8d7b9')
tree(368,329,.8)
poly([(18,269),(161,246),(244,284),(244,432),(17,428)],'#e5d6b3')
poly([(17,268),(136,224),(274,269),(233,288),(119,253),(17,286)],'#697f67')
rr((49,308,101,380),'#96a183',3)
line([(75,309),(75,380)],'#e8d8b4',4);line([(50,342),(100,342)],'#e8d8b4',4)
rect((173,307,224,426),'#829474')
poly([(17,431),(168,402),(404,465),(404,578),(17,578)],'#d4cdb0')
for x,y in [(56,483),(313,540),(356,506)]:line([(x,y),(x+14,y-2)],'#b9b89a',2)
person(177,421,1.85,coat=green)
# workbench
poly([(113,452),(222,435),(272,455),(163,475)],'#c59a63')
poly([(163,475),(272,455),(272,468),(163,488)],'#a7784e')
line([(127,467),(127,524)],'#9f8054',9);line([(255,470),(255,529)],'#9f8054',9)
line([(176,485),(176,539)],'#9f8054',9)
hammer(229,450,.9);book(145,457,.55)
# active object, subtle halo
el((268,397,366,513),'#ecddab');chair(310,459,1.7)
sparkle(357,405);sparkle(274,419)
line([(292,444),(303,451),(298,460)],'#a26e45',3)
rr((267,370,364,398),paper,14);txt(316,383,'榫头松了',12,ink,anchor='mm')
# visible previous reward instead of paragraph
rr((32,218,156,255),paper,17);chair(53,237,.36);txt(82,236,'+1',18,green,True,'mm');check(132,237,green)
coin(42,558,8);txt(60,558,'6',18,ink,True,'lm')
hammer(315,558,.65);txt(340,558,'2',16,green,True,'lm')
# action cards, concrete visual options
txt(25,607,'怎么处理？',17,bold=True)
for x,label,kind in [(24,'自己修','hammer'),(152,'请师傅','mentor'),(280,'先练习','book')]:
    active=kind=='hammer'
    rr((x,645,x+116,800),green if active else '#eeebdd',18)
    el((x+27,663,x+89,725),'#587a60' if active else '#e0e3ce')
    if kind=='hammer':hammer(x+58,695,1.55)
    elif kind=='mentor':person(x+58,701,.78,True,coat='#87957a')
    else:book(x+58,695,1.4)
    txt(x+58,746,label,17,paper if active else ink,True,'mm')
    if kind=='hammer':chair(x+43,776,.32);txt(x+70,776,'+1',12,'#f4e6b8',anchor='mm')
    elif kind=='mentor':coin(x+39,776,6);txt(x+65,776,'−2',12,green,anchor='mm')
    else:hammer(x+40,776,.5);txt(x+69,776,'+1',12,green,anchor='mm')
txt(210,831,'点选行动，故事继续',11,muted,anchor='mm')
rr((165,855,255,859),'#cbd0c0',2)

ox=oy=0
txt(250,1080,'场景表达处境  ·  实物表达成长  ·  图标表达代价与收益',14,'#73806f')
out=Path(__file__).parent/'family-visual-ui-v1.png'
im.save(out)
print(out.resolve())
