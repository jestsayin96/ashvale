(function(){
'use strict';
/* ===================== world ===================== */
const N=52, TW=32, TH=16, HZ=10;
const GRASS=0,ROAD=1,PLAZA=2,WATER=3,DIRT=4,FIELD=5,ROCK=6;
const ty=new Uint8Array(N*N), hh=new Int8Array(N*N), occ=new Int16Array(N*N), tree=new Uint8Array(N*N);
const I=(x,y)=>y*N+x, inB=(x,y)=>x>=0&&y>=0&&x<N&&y<N;
const T=(x,y)=>inB(x,y)?ty[I(x,y)]:WATER;
const H=(x,y)=>inB(x,y)?hh[I(x,y)]:0;
let sd=991337; const rnd=()=>{sd=(sd*1664525+1013904223)|0;return((sd>>>8)&0xffffff)/0xffffff;};
const pick=a=>a[(rnd()*a.length)|0];
const ri=(a,b)=>a+((rnd()*(b-a+1))|0);
function fill(x0,y0,x1,y1,v){for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(inB(x,y))ty[I(x,y)]=v;}
function raise(x0,y0,x1,y1,v){for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(inB(x,y))hh[I(x,y)]=v;}

/* ===================== the town plan ===================== */
const BK={
 hall   :{n:'Ashvale Town Hall', w:4,d:3,ht:30, col:'#cbb189',roof:'#7a5f8f',trim:'#f1e3c4',civic:1},
 guild  :{n:'Adventurers\u2019 Guild', w:5,d:4,ht:32, col:'#b89a72',roof:'#9e4a3c',trim:'#edd9b4',civic:1},
 school :{n:'The Schoolhouse', w:4,d:3,ht:22, col:'#c3b9a0',roof:'#4f7fa6',trim:'#eae3d0',civic:1},
 bank   :{n:'Vault of Ashvale', w:3,d:3,ht:26, col:'#aeb3bd',roof:'#5c6373',trim:'#e8ecf2',civic:1},
 guard  :{n:'Guard Barracks', w:4,d:3,ht:24, col:'#9ba2ad',roof:'#49525f',trim:'#dde3ea',civic:1},
 altar  :{n:'Altar of JestSayin', w:3,d:3,ht:34, col:'#6f5fa0',roof:'#e3b64a',trim:'#d6c7ff',civic:1,shrine:1},
 smith  :{n:'Hearthbone Smithy', w:3,d:2,ht:20, col:'#a48d78',roof:'#7a4a33',trim:'#e0cdb4',shop:'arms'},
 fletch :{n:'The Grey Fletching', w:3,d:2,ht:19, col:'#a8a079',roof:'#5f7a3f',trim:'#e4dcbb',shop:'bows'},
 apoth  :{n:'Marrowroot Apothecary', w:3,d:2,ht:19, col:'#9fa891',roof:'#497a68',trim:'#dfe8d6',shop:'potions'},
 store  :{n:'Pell &amp; Daughters, Provisions', w:3,d:2,ht:19, col:'#b7a582',roof:'#8a6a3a',trim:'#ece0c4',shop:'goods'},
 tailor :{n:'The Dyer\u2019s Needle', w:3,d:2,ht:19, col:'#ab93a8',roof:'#7c3f6b',trim:'#ecd9e8',shop:'cloth'},
 tavern :{n:'The Bent Lantern', w:4,d:3,ht:22, col:'#b08f68',roof:'#6b4330',trim:'#e8d2b2'},
 rose   :{n:'The Rosehouse', w:3,d:3,ht:22, col:'#b58597',roof:'#8e3f58',trim:'#f0d2dc',adultsOnly:1},
 manor  :{n:'Manor', w:4,d:4,ht:30, col:'#d2c4a4',roof:'#5b4a86',trim:'#f6ecd4',noble:1},
 house  :{n:'House', w:2,d:2,ht:16, col:'#bda98a',roof:'#8a5a44',trim:'#e6d6bb',home:1},
 gate   :{n:'The East Gate', w:2,d:3,ht:26, col:'#95938f',roof:'#4a4844',trim:'#d6d4cf',civic:1}
};
const PLAN=[
 ['hall',   22, 9],  ['altar', 24,19],  ['guild', 32,13],
 ['bank',   16,13],  ['school',14, 7],  ['guard', 33,24],
 ['smith',  18,24],  ['fletch',22,24],  ['apoth', 26,24],
 ['store',  18,28],  ['tailor',22,28],
 ['tavern', 27,28],  ['rose',  32,29],
 ['manor',   9,16],  ['manor',  9,23],
 ['gate',   43,19]
];
/* twenty cottages in two residential rows plus a lane */
for(let i=0;i<10;i++) PLAN.push(['house', 13+ (i%5)*3, 33 + ((i/5)|0)*4]);
for(let i=0;i<10;i++) PLAN.push(['house', 29+ (i%5)*3, 33 + ((i/5)|0)*4]);

function buildTerrain(){
  ty.fill(GRASS);
  // river down the west, bridged by the high road
  for(let y=0;y<N;y++){ const w=2+((Math.sin(y*0.3)*1.4)|0);
    for(let x=2;x<=4+w;x++) if(inB(x,y)) ty[I(x,y)]=WATER; }
  // the ridge in the east, with the Keep's mouth at its foot
  for(let y=0;y<N;y++)for(let x=46;x<N;x++){
    ty[I(x,y)]=ROCK; hh[I(x,y)]=Math.min(9,2+(x-45)*2+((Math.sin(y*0.4)*1.5)|0));
  }
  // streets
  fill(10,18,45,20,ROAD);            // the high road, gate to bridge
  fill(21,6,23,31,ROAD);             // north-south spine
  fill(12,23,38,25,ROAD);            // market street
  fill(12,31,40,32,ROAD);            // cottage lane
  fill(16,27,30,29,ROAD);
  fill(5,18,10,20,ROAD);             // the bridge
  fill(19,16,28,22,PLAZA);           // the plaza around the altar
  // noble terrace sits a little higher
  raise(7,14,14,27,1);
  fill(7,14,12,28,GRASS);
  // farm strips north
  fill(26,3,38,8,FIELD);
  // scattered woodland
  for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){
    const i=I(x,y);
    if(ty[i]!==GRASS) continue;
    if(x>11&&x<42&&y>5&&y<38) { if(rnd()>0.97) tree[i]=1; }
    else if(rnd()>0.80) tree[i]=1;
  }
}
buildTerrain();

/* ---------- what is inside each kind of building ---------- */
const FURN={
 bed    :{w:.78,d:.95,h:5, c:'#7a5436',top:'#d8cbb4'},
 table  :{w:.82,d:.82,h:7, c:'#8a6440',top:'#a07a4e'},
 chair  :{w:.42,d:.42,h:6, c:'#6f4f32',top:'#82603e'},
 hearth :{w:.86,d:.6, h:9, c:'#6e665e',top:'#8a8178',fire:1},
 counter:{w:.95,d:.5, h:7, c:'#8b6a45',top:'#a98559'},
 shelf  :{w:.86,d:.42,h:13,c:'#6b5338',top:'#7d6342'},
 barrel :{w:.52,d:.52,h:7, c:'#7a5a38',top:'#9c7a4e'},
 crate  :{w:.6, d:.6, h:6, c:'#8a6e49',top:'#9e8158'},
 anvil  :{w:.5, d:.5, h:5, c:'#4a4a52',top:'#6a6a74'},
 desk   :{w:.78,d:.5, h:6, c:'#7d6342',top:'#937\u04304e'.replace('\u0430','a')},
 books  :{w:.82,d:.4, h:14,c:'#5c4b33',top:'#8f5f45'},
 stone  :{w:.9, d:.9, h:8, c:'#6f5fa0',top:'#9b86d4',glow:'#e3b64a'},
 bar    :{w:1.5,d:.5, h:8, c:'#7a4f30',top:'#9c6a3e'},
 bunk   :{w:.72,d:.92,h:9, c:'#5c5c66',top:'#8e95a4'},
 rack   :{w:.78,d:.34,h:13,c:'#52525c',top:'#9aa3b4'},
 vault  :{w:.86,d:.7, h:10,c:'#555b66',top:'#8e97a6',glow:'#e3b64a'},
 coins  :{w:.5, d:.5, h:3, c:'#b08a30',top:'#f0cd62',glow:'#e3b64a'},
 board  :{w:.86,d:.3, h:13,c:'#6b5338',top:'#d6c08a'},
 chest  :{w:.6, d:.46,h:5, c:'#6b4a2c',top:'#9b7340'},
 rug    :{w:1.0,d:1.0,h:0.6,c:'#8a3f4e',top:'#a85263'},
 pot    :{w:.44,d:.44,h:6, c:'#5f7a4a',top:'#7fa063'},
 cauldron:{w:.56,d:.56,h:6,c:'#44464e',top:'#2f7a68',glow:'#49b08e'},
 bolt   :{w:.5, d:.7, h:8, c:'#7c3f6b',top:'#c47fb0'}
};
const LAYOUT={
 house :[[0,0,'bed'],[1,0,'bed'],[0,1,'hearth'],[1,1,'table']],
 manor :[[0,0,'bed'],[1,0,'bed'],[2,0,'bed'],[3,0,'books'],
         [0,1,'rug'],[1,1,'table'],[2,1,'chair'],[3,1,'hearth'],
         [0,2,'chest'],[1,2,'chair'],[2,2,'rug'],[3,2,'books'],
         [0,3,'coins'],[1,3,'crate'],[2,3,'chest'],[3,3,'bed']],
 hall  :[[0,0,'desk'],[1,0,'desk'],[2,0,'books'],[3,0,'books'],
         [0,1,'rug'],[1,1,'table'],[2,1,'chair'],[3,1,'hearth'],
         [0,2,'chair'],[1,2,'chair'],[2,2,'chair'],[3,2,'chair']],
 guild :[[0,0,'board'],[1,0,'board'],[2,0,'rack'],[3,0,'rack'],[4,0,'books'],
         [0,1,'table'],[1,1,'chair'],[2,1,'table'],[3,1,'chair'],[4,1,'hearth'],
         [0,2,'bar'],[2,2,'crate'],[3,2,'barrel'],[4,2,'chest'],
         [0,3,'chair'],[1,3,'chair'],[2,3,'rug'],[3,3,'table'],[4,3,'chair']],
 school:[[0,0,'books'],[1,0,'board'],[2,0,'books'],[3,0,'desk'],
         [0,1,'desk'],[1,1,'desk'],[2,1,'desk'],[3,1,'desk'],
         [0,2,'chair'],[1,2,'chair'],[2,2,'chair'],[3,2,'chair']],
 bank  :[[0,0,'vault'],[1,0,'vault'],[2,0,'coins'],
         [0,1,'counter'],[1,1,'counter'],[2,1,'desk'],
         [0,2,'chest'],[1,2,'crate'],[2,2,'chest']],
 guard :[[0,0,'bunk'],[1,0,'bunk'],[2,0,'bunk'],[3,0,'rack'],
         [0,1,'rack'],[1,1,'table'],[2,1,'chair'],[3,1,'hearth'],
         [0,2,'crate'],[1,2,'barrel'],[2,2,'chair'],[3,2,'chest']],
 altar :[[0,0,'books'],[1,0,'stone'],[2,0,'books'],
         [0,1,'pot'],[1,1,'rug'],[2,1,'pot'],
         [0,2,'chair'],[1,2,'coins'],[2,2,'chair']],
 smith :[[0,0,'anvil'],[1,0,'hearth'],[2,0,'rack'],
         [0,1,'counter'],[1,1,'crate'],[2,1,'barrel']],
 fletch:[[0,0,'rack'],[1,0,'shelf'],[2,0,'rack'],
         [0,1,'counter'],[1,1,'table'],[2,1,'crate']],
 apoth :[[0,0,'shelf'],[1,0,'cauldron'],[2,0,'shelf'],
         [0,1,'counter'],[1,1,'pot'],[2,1,'crate']],
 store :[[0,0,'shelf'],[1,0,'shelf'],[2,0,'barrel'],
         [0,1,'counter'],[1,1,'crate'],[2,1,'crate']],
 tailor:[[0,0,'bolt'],[1,0,'shelf'],[2,0,'bolt'],
         [0,1,'counter'],[1,1,'table'],[2,1,'crate']],
 tavern:[[0,0,'bar'],[2,0,'barrel'],[3,0,'hearth'],
         [0,1,'table'],[1,1,'chair'],[2,1,'table'],[3,1,'chair'],
         [0,2,'chair'],[1,2,'table'],[2,2,'chair'],[3,2,'rug']],
 rose  :[[0,0,'bed'],[1,0,'rug'],[2,0,'bed'],
         [0,1,'chair'],[1,1,'table'],[2,1,'chair'],
         [0,2,'bolt'],[1,2,'hearth'],[2,2,'bolt']],
 gate  :[[0,0,'rack'],[1,0,'crate'],[0,1,'bunk'],[1,1,'barrel'],[0,2,'chair'],[1,2,'chest']]
};
const buildings=[];
function place(kind,x,y){
  const k=BK[kind], b={kind,x,y,w:k.w,d:k.d,id:buildings.length+1,staff:[],residents:[]};
  for(let dy=0;dy<k.d;dy++)for(let dx=0;dx<k.w;dx++){
    if(!inB(x+dx,y+dy)) continue;
    occ[I(x+dx,y+dy)]=b.id;
    if(ty[I(x+dx,y+dy)]===WATER||ty[I(x+dx,y+dy)]===ROCK) ty[I(x+dx,y+dy)]=DIRT;
    tree[I(x+dx,y+dy)]=0;
  }
  b.door=[x+Math.floor(k.w/2), y+k.d];           // the tile you stand on to go in
  b.furn=(LAYOUT[kind]||[]).filter(([ox,oy])=>ox<k.w&&oy<k.d)
    .map(([ox,oy,f])=>({x:ox,y:oy,f}));
  const want=Math.max(2, Math.round(k.w*k.d/2.6));
  const blocks=()=>new Set(b.furn.filter(f=>FURN[f.f].h>=5).map(f=>f.x+','+f.y));
  const freeTiles=()=>{ const t=blocks(), out=[];
    for(let oy=k.d-1;oy>=0;oy--)for(let ox=0;ox<k.w;ox++) if(!t.has(ox+','+oy)) out.push([ox,oy]);
    return out; };
  let guard=0;
  while(freeTiles().length<want && b.furn.length && guard++<40){
    // clear whatever sits closest to the doorway
    let worst=0,wd=-1;
    b.furn.forEach((f,i)=>{ const d=(k.d-1-f.y)*2+Math.abs(f.x-Math.floor(k.w/2));
      if(FURN[f.f].h<5) return;
      if(wd<0||d<wd){wd=d;worst=i;} });
    if(wd<0) break;
    b.furn.splice(worst,1);
  }
  b.slots=freeTiles().map(([ox,oy])=>[x+ox+0.5, y+oy+0.55]);
  if(!b.slots.length) b.slots.push([x+k.w/2, y+k.d/2]);
  buildings.push(b); return b;
}
PLAN.forEach(([k,x,y])=>place(k,x,y));
const byKind=k=>buildings.filter(b=>b.kind===k);
const theHall=byKind('hall')[0], theGuild=byKind('guild')[0], theSchool=byKind('school')[0],
      theBank=byKind('bank')[0], theAltar=byKind('altar')[0], theTavern=byKind('tavern')[0],
      theGate=byKind('gate')[0], theGuard=byKind('guard')[0], theRose=byKind('rose')[0];
const shops=buildings.filter(b=>BK[b.kind].shop);
const manors=byKind('manor'), cottages=byKind('house');

/* ===================== walking ===================== */
function walk(x,y){ if(!inB(x,y)) return false;
  const t=ty[I(x,y)]; if(t===WATER||t===ROCK) return false;
  return !occ[I(x,y)]; }
const fieldCache=new Map();
function fieldTo(tx,ty_){
  const key=tx+','+ty_; let f=fieldCache.get(key); if(f) return f;
  if(fieldCache.size>240) fieldCache.clear();
  f=new Int16Array(N*N).fill(-1);
  if(!walk(tx,ty_)){ fieldCache.set(key,f); return f; }
  const q=[I(tx,ty_)]; f[q[0]]=0;
  for(let qi=0;qi<q.length;qi++){
    const c=q[qi], cx=c%N, cy=(c/N)|0, d=f[c];
    for(let k=0;k<4;k++){
      const nx=cx+[1,-1,0,0][k], ny=cy+[0,0,1,-1][k];
      if(!inB(nx,ny)) continue; const ni=I(nx,ny);
      if(f[ni]!==-1||!walk(nx,ny)) continue;
      f[ni]=d+1; q.push(ni);
    }
  }
  fieldCache.set(key,f); return f;
}

/* ===================== people ===================== */
const MNAME=['Aldric','Bran','Corvin','Dermot','Edric','Faolan','Gareth','Hale','Ivor','Joss','Kelm',
 'Lucan','Merrick','Nolan','Osric','Perrin','Quillon','Roderic','Stefan','Torin','Ulric','Varen','Wystan'];
const FNAME=['Alys','Bryn','Cassia','Delia','Elowen','Fenna','Giselle','Hesper','Isolde','Jessa','Katrin',
 'Liora','Maeve','Nerys','Odila','Perrine','Rhoswen','Sabine','Thessaly','Ulla','Verity','Wren','Yvaine'];
const SURN=['Ashby','Brackwater','Candlewick','Dunmore','Everly','Fallowfield','Gravesend','Harrowgate',
 'Illsworth','Keld','Lanterne','Mossgrave','Nettlebed','Orrin','Pell','Quarrystone','Rookhollow','Stilwater',
 'Thornbury','Underhill','Vexley','Wardlow'];
const NOBLE=['Vauntmere','Highholt'];
const SCHOOLS=[['Flame','#e07a3c'],['Frost','#6fc2e8'],['Ward','#e3b64a'],['Mending','#7fd48a'],['Hex','#a86fd4']];
const TRADES=['labourer','carter','mason','baker','weaver','cooper','thatcher','herder','miller','tanner'];
const ADULT=15;
let pid=1;
const people=[];
function mkPerson(o){
  const p=Object.assign({
    id:pid++, x:0,y:0, tx:0,ty:0, path:null, moving:false, f:0,
    gift:null, gear:[], gold:0, hpMax:10, hp:10, lvl:1, xp:0, away:false, at:null,
    spouse:null, kids:[], parents:[], bubble:'', bubbleT:0, log:[]
  },o);
  people.push(p); return p;
}
function portraitOf(p){
  return {skin:p.skin,hair:p.hair,top:p.top};
}
const SKIN=['#c08457','#d7ab85','#9c6a44','#e0bb96','#8d5f3c','#b07b4e','#6f4a2e','#eac9a8'];
const HAIR=['#241a14','#4a3a24','#b9b4c6','#6e2a60','#2b2118','#8a5a2a','#1d1510','#c99a4a'];
const TOPC=['#3f63cf','#c75b4a','#3f8f6a','#b8742a','#7a5aa8','#3f8fb8','#c04f8e','#5d8f52','#6b7280'];

function gift(chance){
  if(rnd()>chance) return null;
  const s=pick(SCHOOLS);
  return {school:s[0], col:s[1], power:ri(1,3)};
}
function newFamily(surname, home, kind){
  const dadAge=ri(26,52), mumAge=ri(24,50);
  const dad=mkPerson({name:pick(MNAME), last:surname, sex:'m', age:dadAge,
    skin:pick(SKIN),hair:pick(HAIR),top:pick(TOPC), home, gift:gift(0.22), gold:ri(4,40)});
  const mum=mkPerson({name:pick(FNAME), last:surname, sex:'f', age:mumAge,
    skin:pick(SKIN),hair:pick(HAIR),top:pick(TOPC), home, gift:gift(0.22), gold:ri(4,40)});
  dad.spouse=mum; mum.spouse=dad;
  const nkids = kind==='noble' ? ri(2,3) : 1;
  const kids=[];
  for(let i=0;i<nkids;i++){
    const boy=rnd()<0.5;
    const k=mkPerson({name:boy?pick(MNAME):pick(FNAME), last:surname, sex:boy?'m':'f',
      age:ri(3,14), skin:pick(SKIN),hair:pick(HAIR),top:pick(TOPC), home,
      gift:gift(0.22), gold:ri(0,3), parents:[dad,mum]});
    kids.push(k); dad.kids.push(k); mum.kids.push(k);
  }
  home.residents.push(dad,mum,...kids);
  return {dad,mum,kids,surname};
}
const families=[];
/* two noble houses */
NOBLE.forEach((nm,i)=>{
  const f=newFamily(nm, manors[i], 'noble');
  [f.dad,f.mum,...f.kids].forEach(p=>{ p.noble=true; p.gold*=28; p.trade='of the house'; });
  f.dad.trade='Lord '+nm; f.mum.trade='Lady '+nm;
  f.noble=true; families.push(f);
});
/* twenty commoner families, one per cottage */
const surns=SURN.slice(); 
for(let i=0;i<20;i++){
  const sn=surns.length?surns.splice((rnd()*surns.length)|0,1)[0]:pick(SURN);
  families.push(newFamily(sn, cottages[i]));
}

/* ---- hand out the jobs ---- */
function assignWork(){
  // one family runs each of the five shops
  shops.forEach((sh,i)=>{
    const f=families[2+i];
    f.dad.work=sh; f.mum.work=sh;
    f.dad.trade='shopkeeper'; f.mum.trade='shopkeeper';
    sh.staff.push(f.dad,f.mum); sh.family=f;
    f.shop=sh;
  });
  // the rest: guild, guard, civic, trades. Adults only, and the Rosehouse is 18+.
  const rest=families.slice(7);
  rest.forEach((f,i)=>{
    const adults=[f.dad,f.mum];
    adults.forEach((p,j)=>{
      const roll=(i*2+j)%10;
      if(roll<3){ p.work=theGuild; p.trade='adventurer'; p.adventurer=true;
        p.hpMax=14+ri(0,8); p.hp=p.hpMax;
        p.gear=[pick(['longsword','arming sword','war axe']),
                rnd()<0.45?'shortbow':'kite shield'];
        if(p.gift) p.gear.push('oak staff'); }
      else if(roll===3){ p.work=theGuard; p.trade='town guard'; p.guard=true;
        p.hpMax=16; p.hp=16; p.gear=['guard\u2019s blade','spear','mail hauberk']; }
      else if(roll===4){ p.work=theHall; p.trade='clerk of the hall'; }
      else if(roll===5){ p.work=theBank; p.trade='teller'; }
      else if(roll===6){ p.work=theSchool; p.trade='schoolmaster'; }
      else if(roll===7){ p.work=theTavern; p.trade='taverner'; }
      else if(roll===8 && p.age>=18){ p.work=theRose; p.trade='of the Rosehouse'; }
      else { p.work=null; p.trade=pick(TRADES); }
    });
  });
  // the altar always has a keeper
  const keeper=people.find(p=>p.age>=ADULT&&!p.work&&p.gift);
  if(keeper){ keeper.work=theAltar; keeper.trade='keeper of the altar'; }
  // children go to school
  people.forEach(p=>{ if(p.age<ADULT){ p.work=theSchool; p.trade='pupil'; p.child=true; } });
  // make sure the guild has a decent roster
  let advs=people.filter(p=>p.adventurer);
  if(advs.length<10){
    people.filter(p=>p.age>=18&&!p.adventurer&&!p.noble&&p.trade&&TRADES.includes(p.trade))
      .slice(0,10-advs.length).forEach(p=>{
        p.adventurer=true; p.work=theGuild; p.trade='adventurer';
        p.hpMax=14+ri(0,6); p.hp=p.hpMax;
        p.gear=[pick(['longsword','arming sword']), rnd()<0.5?'shortbow':'kite shield'];
      });
  }
  people.forEach(p=>{ if(p.work) p.work.staff.indexOf(p)<0 && p.work.staff.push(p); });
}
assignWork();
people.forEach(p=>{ const d=p.home.door; p.x=d[0]+0.5; p.y=d[1]+0.5; p.tx=p.x; p.ty=p.y; });

/* ===================== Dragon's Keep ===================== */
const KEEP={ deepest:0, cleared:new Set(), runs:[], history:[], lost:0, gold:0 };
const MONSTER=[
 [1 ,'cave rats'],[3,'goblin scouts'],[6,'kobold diggers'],[10,'giant spiders'],
 [15,'bandit deserters'],[21,'ghouls'],[28,'ogres'],[36,'wraiths'],[45,'basilisks'],
 [55,'bone knights'],[66,'hellhounds'],[78,'a chimera'],[88,'the elder lich'],[97,'the dragon itself']
];
function monsterFor(f){ const b=bossFor(f); if(b) return b[1];
  let m=MONSTER[0][1]; for(const [d,n] of MONSTER) if(f>=d) m=n; return m; }
function partyPower(party){
  return party.reduce((a,p)=>a + p.lvl*2.6 + (p.gift?p.gift.power*2.2:0)
    + p.gear.length*1.1 + p.hp/p.hpMax*3 + (p.relicDmg||0)*2.4, 0);
}
function formParty(){
  const free=people.filter(p=>p.adventurer&&!p.away&&p.hp>p.hpMax*0.55&&p.age>=ADULT);
  if(free.length<3) return null;
  const size=Math.min(free.length, ri(3,4));
  const party=[];
  free.sort(()=>rnd()-0.5);
  for(let i=0;i<size;i++) party.push(free[i]);
  const target=Math.min(100, KEEP.deepest+1+ri(0,2));
  const run={party, floor:Math.max(1,target-ri(2,5)), target, t:0, loot:0, state:'delve',
    log:[], id:Date.now()+rnd()};
  party.forEach(p=>{ p.away=true; p.run=run; p.hp=Math.max(p.hp,p.hpMax*0.8); });
  KEEP.runs.push(run);
  if(!activeRun) loadRun(run);
  logMsg('<b>'+party.map(p=>p.name).join(', ')+'</b> set out for floor '+target+'.','');
  return run;
}
function endRun(run,ok){
  if(activeRun===run){ activeRun=null;
    const next=KEEP.runs.find(r=>r!==run);
    if(next) loadRun(next);            // follow the next party down; never yank the view
  }
  run.party.forEach(p=>{ p.away=false; p.run=null;
    const cut=Math.round(run.loot/Math.max(1,run.party.length));
    p.gold+=cut; });
  const cut=Math.round(run.loot*0.2);
  KEEP.gold+=cut; ECON.treasury+=cut; ECON.taxed+=cut;
  KEEP.history.unshift({floor:run.floor-1, loot:run.loot, ok,
    who:run.party.map(p=>p.name), day});
  if(KEEP.history.length>12) KEEP.history.pop();
  if(run.loot>0) logMsg('The party came back from floor '+(run.floor-1)+' with <b>'+run.loot+' gold</b>.','g');
  else logMsg('The party came back from the Keep empty-handed.','');
  KEEP.runs.splice(KEEP.runs.indexOf(run),1);
}
function bereave(v){
  if(v.spouse){ v.spouse.widowed=true; v.spouse.bubble='gone'; v.spouse.bubbleT=8; }
  const i=people.indexOf(v); if(i>=0) people.splice(i,1);
  if(v.home) v.home.residents=v.home.residents.filter(p=>p!==v);
  if(v.work) v.work.staff=v.work.staff.filter(p=>p!==v);
}

/* ===================== the day ===================== */
let day=1, hour=6, minute=0, speed=1;
function schedule(p){
  const h=hour;
  if(p.away) return null;
  if(h<6||h>=22) return p.home;
  if(h<8) return p.home;
  if(h<12) return p.work||p.home;
  if(h<13) return rnd()<0.4?theTavern:(p.work||p.home);
  if(h<17) return p.work||p.home;
  if(h<20){
    if(p.child) return rnd()<0.5?p.home:theSchool;
    const r=rnd();
    if(r<0.26) return theTavern;
    if(r<0.38) return theAltar;
    if(r<0.50) return pick(shops);
    if(r<0.56&&p.age>=18&&!p.spouse) return theRose;
    return p.home;
  }
  return p.home;
}
function logMsg(t,cls){
  LOGS.unshift('<div class="'+(cls||'')+'">'+t+'</div>');
  if(LOGS.length>9) LOGS.pop();
  document.getElementById('logList').innerHTML=LOGS.join('');
}
const LOGS=[];
logMsg('Ashvale wakes. '+people.length+' souls, and the Keep still open.','');

/* ===================== coin, trade and the vault ===================== */
const ECON={ treasury:0, taxed:0, traded:0, wages:0, deposits:0, day:0 };
const PRICE={arms:14,bows:11,potions:7,goods:4,cloth:6};
function shopOf(kind){ return shops.find(b=>BK[b.kind].shop===kind); }
function spendAt(p,sh){
  const kind=BK[sh.kind].shop, base=PRICE[kind]||5;
  let want=Math.max(1,Math.round(base*(0.4+rnd()*0.9)));
  if(p.noble) want=Math.round(want*2.4);
  if(p.gold<want) want=Math.floor(p.gold*0.5);
  if(want<1) return;
  p.gold-=want; sh.till=(sh.till||0)+want; ECON.traded+=want;
  if(kind==='arms'&&p.adventurer&&rnd()<0.05&&p.gear.length<5){
    p.gear.push(pick(['buckler','mail shirt','whetstone'])); p.bubble='new kit'; p.bubbleT=4; }
  if(kind==='potions'&&p.hp<p.hpMax*0.7){ p.hp=Math.min(p.hpMax,p.hp+4); }
}
function marketDay(){
  // shopkeepers take the till, the hall takes a tenth, the rest is wages
  let tax=0, paid=0;
  shops.forEach(sh=>{
    const till=sh.till||0; if(till<=0) return;
    const t=Math.round(till*0.10); tax+=t;
    const cut=Math.floor((till-t)/Math.max(1,sh.staff.length));
    sh.staff.forEach(p=>{ p.gold+=cut; paid+=cut; });
    sh.till=0;
  });
  // the hall pays its own people out of the vault
  const civic=people.filter(p=>p.work&&BK[p.work.kind].civic&&p.age>=ADULT);
  const wage=3;
  civic.forEach(p=>{ if(ECON.treasury>=wage){ ECON.treasury-=wage; p.gold+=wage; paid+=wage; } });
  ECON.treasury+=tax; ECON.taxed+=tax; ECON.wages+=paid;
  // anyone flush puts the surplus in the vault
  let dep=0;
  people.forEach(p=>{ if(p.gold>70){ const d=Math.round((p.gold-70)*0.5);
    p.gold-=d; p.savings=(p.savings||0)+d; dep+=d; } });
  ECON.deposits+=dep;
  if(tax||dep) logMsg('Market day: <b>'+tax+' gold</b> in tax, '+paid+' paid out, '+dep+
    ' banked.','g');
}

/* ===================== bosses and relics ===================== */
const BOSSES=[
 [10,'Grusk the Pitmaster','#c17a3f'],[20,'the Weeping Widow','#9a6fd0'],
 [30,'Bone-Choir Abbot','#cfc6dd'],[40,'Rustfang','#9aa6b8'],
 [50,'the Basilisk Queen','#6fae5a'],[60,'Forgefather Umbril','#e0863c'],
 [70,'the Ash Herald','#e2562a'],[80,'Nine-Eyed Solenne','#f0a0d0'],
 [90,'the Elder Lich','#8fd3f4'],[100,'the Dragon of the Keep','#e3b64a']
];
const bossFor=f=>BOSSES.find(b=>b[0]===f)||null;
const RELICS=[
 {n:'Pitmaster\u2019s Cleaver', dmg:1.6},
 {n:'Widow\u2019s Veil',         hp:8},
 {n:'Abbot\u2019s Censer',       gift:1},
 {n:'Rustfang\u2019s Jaw',       dmg:2.2},
 {n:'Queen\u2019s Scale Coat',   hp:12},
 {n:'Forgefather\u2019s Brand',  dmg:3.0},
 {n:'Herald\u2019s Ashen Horn',  gift:1, dmg:1.2},
 {n:'Solenne\u2019s Nine Eyes',  hp:14, dmg:1.4},
 {n:'The Lich\u2019s Phylactery',gift:2, hp:10},
 {n:'Heart of the Dragon',       dmg:5, hp:25, gift:2}
];
function grantRelic(p,floor){
  const idx=Math.max(0,Math.min(RELICS.length-1,Math.round(floor/10)-1));
  const r=RELICS[idx];
  p.relics=p.relics||[];
  if(p.relics.some(q=>q.n===r.n)) return null;
  p.relics.push(r);
  if(r.dmg) p.relicDmg=(p.relicDmg||0)+r.dmg;
  if(r.hp){ p.hpMax+=r.hp; p.hp+=r.hp; }
  if(r.gift){ if(p.gift) p.gift.power=Math.min(5,p.gift.power+r.gift);
    else { const sc=pick(SCHOOLS); p.gift={school:sc[0],col:sc[1],power:r.gift}; } }
  p.gear.push(r.n);
  return r;
}

/* ===================== the Keep: real floors ===================== */
const DN=44;
const DROCK=0,DFLOOR=1,DCORR=2,DDOWN=3,DUP=4,DPOOL=5,DRUBBLE=6;
const dty=new Uint8Array(DN*DN), dseen=new Uint8Array(DN*DN);
const dI=(x,y)=>y*DN+x;
const dIn=(x,y)=>x>=0&&y>=0&&x<DN&&y<DN;
const dAt=(x,y)=>dIn(x,y)?dty[dI(x,y)]:DROCK;
const dWalk=(x,y)=>{const t=dAt(x,y);return t!==DROCK&&t!==DPOOL;};
const THEMES=[
 {to:20, n:'the wet caves',    rock:['#8a6e52','#4a3929','#36291c'], floor:['#5e4a3a','#564334','#4d3c2e'],
  pool:'#2f6f8e', glow:'#5fa8d8', torch:'#f0a34a', mob:'#8a9b6a'},
 {to:40, n:'the crypts',       rock:['#8d8a9c','#45424e','#33313b'], floor:['#56525f','#4d4a57','#45424e'],
  pool:'#3d6b55', glow:'#5fc48e', torch:'#9ad7c0', mob:'#c7c2d6'},
 {to:60, n:'the iron halls',   rock:['#7d8a9c','#3a4350','#2b323c'], floor:['#49535f','#424b56','#3b434d'],
  pool:'#2f5f8e', glow:'#6fb6e8', torch:'#8fc4f0', mob:'#9aa6b8'},
 {to:80, n:'the magma deeps',  rock:['#7d5450','#38241f','#281917'], floor:['#4a322e','#432c29','#3b2724'],
  pool:'#e2562a', glow:'#ffa056', torch:'#ff8a3c', mob:'#e08a5a'},
 {to:100,n:"the dragon's floors",rock:['#6d5f82','#2b2533','#1f1a26'],floor:['#3b3449','#352f41','#2e2939'],
  pool:'#c79a2a', glow:'#f0d070', torch:'#f0cd62', mob:'#d8a85c'}
];
const themeFor=f=>THEMES.find(t=>f<=t.to)||THEMES[4];
let dfloor=1, drooms=[], dmobs=[], dchests=[], dtorches=[], dUpAt=[0,0], dDownAt=[0,0];
function dHash(x,y,s2){ let n=(x*374761393+y*668265263+s2*1274126177)|0;
  n=Math.imul(n^(n>>>13),1274126177); return ((n^(n>>>16))>>>0)/4294967296; }
function genFloor(f){
  dfloor=f; dty.fill(DROCK); dseen.fill(0); drooms=[]; dmobs=[]; dchests=[]; dtorches=[];
  let seed=f*7919+13;
  const r=()=>{ seed=(seed*1664525+1013904223)|0; return ((seed>>>8)&0xffffff)/0xffffff; };
  const rI=(a,b)=>a+((r()*(b-a+1))|0);
  const want=8+((f/14)|0)+rI(0,3);
  for(let t=0;t<320&&drooms.length<want;t++){
    const w=rI(4,8), d=rI(4,7), x=rI(2,DN-w-3), y=rI(2,DN-d-3);
    if(drooms.some(q=>x<q.x+q.w+2&&x+w+2>q.x&&y<q.y+q.d+2&&y+d+2>q.y)) continue;
    drooms.push({x,y,w,d,cx:x+(w>>1),cy:y+(d>>1)});
  }
  drooms.forEach(q=>{ for(let y=q.y;y<q.y+q.d;y++)for(let x=q.x;x<q.x+q.w;x++) dty[dI(x,y)]=DFLOOR; });
  for(let i=1;i<drooms.length;i++){
    const a=drooms[i-1], b2=drooms[i];
    let x=a.cx,y=a.cy;
    while(x!==b2.cx){ x+=x<b2.cx?1:-1; if(dty[dI(x,y)]===DROCK) dty[dI(x,y)]=DCORR; }
    while(y!==b2.cy){ y+=y<b2.cy?1:-1; if(dty[dI(x,y)]===DROCK) dty[dI(x,y)]=DCORR; }
  }
  for(let i=0;i<2;i++){
    const q=drooms[rI(0,drooms.length-1)];
    const px=q.x+rI(0,Math.max(0,q.w-2)), py=q.y+rI(0,Math.max(0,q.d-2));
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++) if(dIn(px+dx,py+dy)) dty[dI(px+dx,py+dy)]=DPOOL;
  }
  for(let y=0;y<DN;y++)for(let x=0;x<DN;x++)
    if(dty[dI(x,y)]===DFLOOR && dHash(x,y,f)>0.965) dty[dI(x,y)]=DRUBBLE;
  const first=drooms[0], last=drooms[drooms.length-1];
  dUpAt=[first.cx,first.cy]; dty[dI(first.cx,first.cy)]=DUP;
  dDownAt=[last.cx,last.cy]; dty[dI(last.cx,last.cy)]=DDOWN;
  drooms.forEach(q=>{ for(let k=0;k<2;k++)
    dtorches.push({x:q.x+rI(0,q.w-1)+0.5, y:q.y+0.12, p:r()*6}); });
  const th=themeFor(f);
  const bs=bossFor(f);
  if(bs){
    const q=drooms[drooms.length-1];
    const hpv=40+f*5.5;
    dmobs.push({x:q.cx+0.5,y:q.cy+1.5,hx:q.cx+0.5,hy:q.cy+1.5,hp:hpv,hpMax:hpv,
      dmg:2.2+f*0.24, awake:false, name:bs[1], col:bs[2], f:0, atk:0, boss:true});
  }
  const count=4+Math.round(f/7)+rI(0,3);
  for(let i=0;i<count;i++){
    const q=drooms[rI(1,Math.max(1,drooms.length-1))];
    const mx=q.x+rI(0,q.w-1), my=q.y+rI(0,q.d-1);
    if(!dWalk(mx,my)) continue;
    const hpv=6+f*1.3+rI(0,6);
    dmobs.push({x:mx+0.5,y:my+0.5,hx:mx+0.5,hy:my+0.5,hp:hpv,hpMax:hpv,
      dmg:0.75+f*0.145, awake:false, name:monsterFor(f), col:th.mob, f:0, atk:0});
  }
  for(let i=0;i<rI(2,4);i++){
    const q=drooms[rI(1,Math.max(1,drooms.length-1))];
    dchests.push({x:q.x+rI(0,q.w-1)+0.5, y:q.y+rI(0,q.d-1)+0.5,
      gold:Math.round(f*3.2+rI(6,32)), open:false});
  }
  repairFloor(rI);
}
/* every floor must be finishable: pools must not sever it, and nothing
   worth walking to may sit somewhere you cannot reach. */
function floodFrom(sx,sy){
  const seen=new Uint8Array(DN*DN);
  if(!dWalk(sx,sy)) return seen;
  const q=[dI(sx,sy)]; seen[q[0]]=1;
  for(let i=0;i<q.length;i++){
    const c=q[i], cx=c%DN, cy=(c/DN)|0;
    for(let k=0;k<4;k++){
      const nx=cx+[1,-1,0,0][k], ny=cy+[0,0,1,-1][k];
      if(!dIn(nx,ny)) continue; const ni=dI(nx,ny);
      if(seen[ni]||!dWalk(nx,ny)) continue;
      seen[ni]=1; q.push(ni);
    }
  }
  return seen;
}
function repairFloor(rI){
  let R=floodFrom(dUpAt[0],dUpAt[1]);
  if(!R[dI(dDownAt[0],dDownAt[1])]){
    // the pools cut the floor in half: drain them and try again
    for(let i=0;i<DN*DN;i++) if(dty[i]===DPOOL) dty[i]=DFLOOR;
    R=floodFrom(dUpAt[0],dUpAt[1]);
  }
  if(!R[dI(dDownAt[0],dDownAt[1])]){
    // still unreachable: put the stairs down in the furthest room we can walk to
    let best=null,bd=-1;
    for(const q of drooms){
      if(!R[dI(q.cx,q.cy)]) continue;
      const d=Math.abs(q.cx-dUpAt[0])+Math.abs(q.cy-dUpAt[1]);
      if(d>bd){bd=d;best=q;}
    }
    if(best){ dty[dI(dDownAt[0],dDownAt[1])]=DFLOOR;
      dDownAt=[best.cx,best.cy]; dty[dI(best.cx,best.cy)]=DDOWN; }
  }
  // chests and monsters must stand somewhere walkable and reachable
  const spots=[];
  for(const q of drooms) for(let y=q.y;y<q.y+q.d;y++) for(let x=q.x;x<q.x+q.w;x++)
    if(R[dI(x,y)] && dty[dI(x,y)]!==DUP && dty[dI(x,y)]!==DDOWN) spots.push([x,y]);
  const relocate=(o)=>{
    if(!spots.length) return false;
    const sp=spots[rI(0,spots.length-1)];
    o.x=sp[0]+0.5; o.y=sp[1]+0.5; return true;
  };
  for(let i=dchests.length-1;i>=0;i--){
    const c=dchests[i];
    if(!R[dI(c.x|0,c.y|0)] && !relocate(c)) dchests.splice(i,1);
  }
  for(let i=dmobs.length-1;i>=0;i--){
    const m=dmobs[i];
    if(!R[dI(m.x|0,m.y|0)] && !relocate(m)) { dmobs.splice(i,1); continue; }
    m.hx=m.x; m.hy=m.y;
  }
}
const dFieldCache=new Map();
function dField(tx,ty2){
  const key=dfloor+':'+tx+','+ty2; let f=dFieldCache.get(key); if(f) return f;
  if(dFieldCache.size>200) dFieldCache.clear();
  f=new Int16Array(DN*DN).fill(-1);
  if(!dWalk(tx,ty2)){ dFieldCache.set(key,f); return f; }
  const q=[dI(tx,ty2)]; f[q[0]]=0;
  for(let qi=0;qi<q.length;qi++){
    const c=q[qi], cx=c%DN, cy=(c/DN)|0, dd=f[c];
    for(let k=0;k<4;k++){
      const nx=cx+[1,-1,0,0][k], ny=cy+[0,0,1,-1][k];
      if(!dIn(nx,ny)) continue; const ni=dI(nx,ny);
      if(f[ni]!==-1||!dWalk(nx,ny)) continue;
      f[ni]=dd+1; q.push(ni);
    }
  }
  dFieldCache.set(key,f); return f;
}
function dReveal(x,y,r){
  for(let b=-r;b<=r;b++)for(let a=-r;a<=r;a++){
    if(a*a+b*b>r*r) continue;
    const nx=(x|0)+a, ny=(y|0)+b;
    if(dIn(nx,ny)) dseen[dI(nx,ny)]=1;
  }
}
let activeRun=null;
function loadRun(run){
  activeRun=run; genFloor(run.floor); dFieldCache.clear();
  run.party.forEach((p,i)=>{
    p.dx=dUpAt[0]+0.5+(i%2)*0.6-0.3; p.dy=dUpAt[1]+0.5+((i/2)|0)*0.6-0.3;
    p.dgoal=null; p.dtarget=null; p.atk=0; p.dfld=null;
  });
  dReveal(dUpAt[0],dUpAt[1],7);
  if(scene==='keep'){
    const v=vpt(dUpAt[0]+0.5,dUpAt[1]+0.5), f=flat(v[0],v[1],0);
    camX=f[0]; camY=f[1];
  }
  if(typeof paintRail==='function') paintRail();
}
function dDamage(p){ return 1.1 + p.lvl*0.55 + (p.gift?p.gift.power*0.7:0)
  + p.gear.length*0.3 + (p.relicDmg||0); }
function dSetGoal(p,x,y,what,tgt){
  p.dgoal={x:x|0,y:y|0,what}; p.dtarget=tgt||null; p.dfld=dField(x|0,y|0);
}
function stepFloor(run,dt){
  if(activeRun!==run) return;
  const party=run.party;
  if(!party.length){ endRun(run,false); return; }
  // wake monsters the party gets close to
  for(const m of dmobs){
    if(m.awake) continue;
    for(const p of party) if(Math.hypot(p.dx-m.x,p.dy-m.y)<7.5){ m.awake=true; break; }
  }
  const hpFrac=party.reduce((a,p)=>a+p.hp/p.hpMax,0)/party.length;
  if(hpFrac<0.34 && run.state!=='retreat'){
    run.state='retreat';
    logMsg('The party breaks off and makes for the stairs.','d');
  }
  // monsters
  for(let i=dmobs.length-1;i>=0;i--){
    const m=dmobs[i];
    if(m.hp<=0){ dmobs.splice(i,1); continue; }
    if(!m.awake) continue;
    let tgt=null,td=1e9;
    for(const p of party){ const d=Math.hypot(p.dx-m.x,p.dy-m.y); if(d<td){td=d;tgt=p;} }
    if(!tgt) continue;
    if(td>1.1){
      const dx=tgt.dx-m.x, dy=tgt.dy-m.y, mm=Math.hypot(dx,dy)||1, sp=2.0*dt;
      const nx=m.x+dx/mm*sp, ny=m.y+dy/mm*sp;
      if(dWalk(nx|0,m.y|0)) m.x=nx;
      if(dWalk(m.x|0,ny|0)) m.y=ny;
      m.f+=dt;
    } else {
      m.atk-=dt;
      if(m.atk<=0){ m.atk=1.1;
        tgt.hp-=m.dmg;
        if(tgt.hp<=0){
          tgt.hp=0; tgt.dead=true; tgt.away=false;
          party.splice(party.indexOf(tgt),1);
          KEEP.lost++;
          logMsg('<b>'+tgt.name+' '+tgt.last+'</b> was killed by '+m.name+' on floor '+run.floor+'.','d');
          bereave(tgt);
          if(!party.length){ endRun(run,false); return; }
        }
      }
    }
  }
  // the party
  for(const p of party){
    dReveal(p.dx,p.dy,6);
    // choose what to do
    let mob=null,md=1e9;
    for(const m of dmobs){ if(!m.awake) continue;
      const d=Math.hypot(p.dx-m.x,p.dy-m.y); if(d<md){md=d;mob=m;} }
    if(run.state==='retreat'){
      if(!p.dgoal||p.dgoal.what!=='up') dSetGoal(p,dUpAt[0],dUpAt[1],'up');
    } else if(mob && md<12){
      if(md<1.15){
        p.dgoal=null; p.atk-=dt;
        if(p.atk<=0){ p.atk=0.85; mob.hp-=dDamage(p);
          if(mob.hp<=0){
            if(mob.boss){
              logMsg('<b>'+mob.name+'</b> is dead. '+p.name+' struck the last blow.','g');
              run.party.forEach(q=>{ const r=grantRelic(q,run.floor);
                if(r) logMsg('<b>'+q.name+'</b> took the '+r.n+'.','m'); });
              run.loot+=Math.round(run.floor*9+40);
            } else logMsg('<b>'+p.name+'</b> cut down '+mob.name+' on floor '+run.floor+'.','');
          } }
      } else if(!p.dgoal||p.dgoal.what!=='fight'||p.dtarget!==mob
                ||Math.hypot(p.dgoal.x+0.5-mob.x,p.dgoal.y+0.5-mob.y)>1.6){
        dSetGoal(p,mob.x,mob.y,'fight',mob);
      }
    } else {
      const chest=dchests.filter(c=>!c.open)
        .sort((a,b2)=>Math.hypot(a.x-p.dx,a.y-p.dy)-Math.hypot(b2.x-p.dx,b2.y-p.dy))[0];
      if(chest && Math.hypot(chest.x-p.dx,chest.y-p.dy)<1.1){
        chest.open=true; run.loot+=chest.gold;
        p.bubble='+'+chest.gold+'g'; p.bubbleT=3;
        logMsg('<b>'+p.name+'</b> found '+chest.gold+' gold in a chest.','g');
        p.dgoal=null;
      } else if(chest && !dchests.every(c=>c.open)){
        if(!p.dgoal||p.dgoal.what!=='loot') dSetGoal(p,chest.x,chest.y,'loot',chest);
      } else {
        if(!p.dgoal||p.dgoal.what!=='down') dSetGoal(p,dDownAt[0],dDownAt[1],'down');
      }
    }
    // walk
    if(p.dgoal){
      const gx=p.dgoal.x+0.5, gy=p.dgoal.y+0.5;
      if(Math.hypot(gx-p.dx,gy-p.dy)>0.45){
        const cx=p.dx|0, cy=p.dy|0;
        let bx=cx,by=cy,bd=p.dfld?p.dfld[dI(cx,cy)]:-1;
        if(bd===undefined||bd<0){
          if(p.dgoal.what==='loot'&&p.dtarget) p.dtarget.open=true;   // write it off
          if(p.dgoal.what==='down'){ run.state='retreat'; }
          p.dgoal=null; p.dtarget=null;
        }
        else {
          for(let k=0;k<4;k++){
            const nx=cx+[1,-1,0,0][k], ny=cy+[0,0,1,-1][k];
            if(!dIn(nx,ny))continue; const v=p.dfld[dI(nx,ny)];
            if(v>=0&&v<bd){bd=v;bx=nx;by=ny;}
          }
          const tx2=bx+0.5, ty2=by+0.5, vx=tx2-p.dx, vy=ty2-p.dy, mm=Math.hypot(vx,vy)||1;
          p.dx+=vx/mm*2.3*dt; p.dy+=vy/mm*2.3*dt; p.dmov=true; p.f=(p.f||0)+dt;
        }
      } else { p.dmov=false; }
    } else p.dmov=false;
  }
  // descend or leave
  const atDown=party.every(p=>Math.hypot(p.dx-dDownAt[0]-0.5,p.dy-dDownAt[1]-0.5)<1.6);
  const clear=!dmobs.some(m=>m.awake);
  if(run.state!=='retreat' && atDown && clear){
    KEEP.cleared.add(run.floor);
    if(run.floor>KEEP.deepest){ KEEP.deepest=run.floor;
      logMsg('Floor <b>'+run.floor+'</b> cleared for the first time.','g'); }
    party.forEach(p=>{ p.xp+=4+run.floor*0.35;
      while(p.xp>=p.lvl*60){ p.xp-=p.lvl*60; p.lvl++; p.hpMax+=3; p.hp=p.hpMax;
        logMsg('<b>'+p.name+'</b> reached level '+p.lvl+'.','');
        if(!p.gift&&rnd()<0.10){ const sc=pick(SCHOOLS); p.gift={school:sc[0],col:sc[1],power:1};
          logMsg('<b>'+p.name+'</b> woke to the '+p.gift.school+' gift in the dark.','m'); } } });
    if(run.floor>=run.target || run.floor>=100){ run.state='retreat'; }
    else { run.floor++; loadRun(run); }
  }
  const atUp=party.every(p=>Math.hypot(p.dx-dUpAt[0]-0.5,p.dy-dUpAt[1]-0.5)<1.6);
  if(run.state==='retreat' && atUp) endRun(run,true);
}

/* ===================== camera & drawing ===================== */
const cv=document.getElementById('view'), g=cv.getContext('2d');
let camX=0,camY=0,zoom=1.1,CW=0,CH=0,dpr=1,rot=0,follow=null,selected=null,tnow=0;
let scene='town', GS=N;
let v3d=false, R3=null, cv3=null;
const camSave={town:null,keep:null};                                   // grid size of whatever scene is on screen
function vpt(X,Y){ switch(rot){ case 1:return[GS-Y,X]; case 2:return[GS-X,GS-Y]; case 3:return[Y,GS-X];
  default:return[X,Y]; } }
function vcell(x,y){ switch(rot){ case 1:return[GS-1-y,x]; case 2:return[GS-1-x,GS-1-y];
  case 3:return[y,GS-1-x]; default:return[x,y]; } }
function wcell(vx,vy){ switch(rot){ case 1:return[vy,GS-1-vx]; case 2:return[GS-1-vx,GS-1-vy];
  case 3:return[GS-1-vy,vx]; default:return[vx,vy]; } }
function flat(vx,vy,z){ return [(vx-vy)*(TW/2),(vx+vy)*(TH/2)-(z||0)*HZ]; }
function scr(X,Y,z){ const v=vpt(X,Y), p=flat(v[0],v[1],z);
  return [(p[0]-camX)*zoom+CW/2,(p[1]-camY)*zoom+CH/2]; }
function quadV(x0,y0,x1,y1,z){ const p=(X,Y)=>{ const q=flat(X,Y,z);
  return [(q[0]-camX)*zoom+CW/2,(q[1]-camY)*zoom+CH/2]; };
  return [p(x0,y0),p(x1,y0),p(x1,y1),p(x0,y1)]; }
function zAt(x,y){ return scene==='keep' ? (dAt(x,y)===DROCK?1:0) : H(x,y); }
function pickCell(sx,sy){
  const wx=(sx-CW/2)/zoom+camX, wy=(sy-CH/2)/zoom+camY;
  for(let z=10;z>=0;z--){
    const a=wx/(TW/2), b=(wy+z*HZ)/(TH/2);
    const vx=Math.floor((a+b)/2), vy=Math.floor((b-a)/2);
    if(vx<0||vy<0||vx>=GS||vy>=GS) continue;
    const w=wcell(vx,vy);
    if(zAt(w[0],w[1])===z) return w;
  }
  const a=wx/(TW/2), b=wy/(TH/2);
  const vx=Math.floor((a+b)/2), vy=Math.floor((b-a)/2);
  if(vx<0||vy<0||vx>=GS||vy>=GS) return null;
  return wcell(vx,vy);
}
function centre(){ const p=flat(N/2,N/2,0); camX=p[0]; camY=p[1]; }
function resize(){ const r=cv.getBoundingClientRect(); dpr=Math.min(2,window.devicePixelRatio||1);
  CW=Math.max(280,Math.floor(r.width)); CH=Math.max(200,Math.floor(r.height));
  cv.width=CW*dpr;cv.height=CH*dpr;cv.style.width=CW+'px';cv.style.height=CH+'px'; }
new ResizeObserver(resize).observe(cv); resize();
camX=flat(26,24,0)[0]; camY=flat(26,24,0)[1];

const TC={};
TC[GRASS]=['#5f8f4a','#52803f','#436a33']; TC[ROAD]=['#9a9183','#857d70','#6f6960'];
TC[PLAZA]=['#b0a692','#9b9280','#847c6d']; TC[WATER]=['#3a73b8','#2f63a0','#265184'];
TC[DIRT]=['#9c8565','#876f52','#6f5b42'];  TC[FIELD]=['#b19a52','#9c8745','#857339'];
TC[ROCK]=['#7d7a84','#6a6770','#57545c'];
function tint(c,f){ const n=parseInt(c.slice(1),16);
  return 'rgb('+Math.min(255,((n>>16)&255)*f|0)+','+Math.min(255,((n>>8)&255)*f|0)+','+
    Math.min(255,(n&255)*f|0)+')'; }
function poly(p,c){ g.beginPath();g.moveTo(p[0][0],p[0][1]);
  for(let i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]); g.closePath(); g.fillStyle=c; g.fill(); }
function drawCell(vx,vy){
  const w=wcell(vx,vy), x=w[0], y=w[1], i=I(x,y), t=ty[i], z=hh[i];
  const pal=TC[t]; let top=pal[0];
  if(t===WATER){ const q=Math.sin(tnow*1.2+x*0.8+y*0.6); top=q>0.4?'#4280c6':(q<-0.5?'#2f63a0':pal[0]); }
  else { const v=((x*7+y*13)%5); top=v===0?pal[1]:(v===3?tint(pal[0],1.06):pal[0]); }
  const P=quadV(vx,vy,vx+1,vy+1,z);
  const nR=wcell(vx+1,vy), nD=wcell(vx,vy+1);
  const dR=z-(inB(nR[0],nR[1])?hh[I(nR[0],nR[1])]:-1), dD=z-(inB(nD[0],nD[1])?hh[I(nD[0],nD[1])]:-1);
  if(dR>0) poly([P[1],P[2],[P[2][0],P[2][1]+dR*HZ*zoom],[P[1][0],P[1][1]+dR*HZ*zoom]],pal[1]);
  if(dD>0) poly([P[2],P[3],[P[3][0],P[3][1]+dD*HZ*zoom],[P[2][0],P[2][1]+dD*HZ*zoom]],pal[2]);
  poly(P,top);
  g.strokeStyle=t===WATER?'rgba(255,255,255,.03)':'rgba(0,0,0,.07)';g.lineWidth=1;g.stroke();
}
function drawTree(x,y){
  const z=hh[I(x,y)], [sx,sy]=scr(x+0.5,y+0.5,z), s=zoom, sw=Math.sin(tnow*1.1+x)*1.1*s;
  g.save();g.globalAlpha=.22;g.fillStyle='#000';g.beginPath();g.ellipse(sx,sy,7*s,3.2*s,0,0,7);g.fill();g.restore();
  g.fillStyle='#55401f';g.fillRect(sx-1.5*s,sy-11*s,3*s,11*s);
  g.fillStyle='#2b5e2e';g.beginPath();g.ellipse(sx+sw,sy-17*s,9*s,7.6*s,0,0,7);g.fill();
  g.fillStyle='#387a38';g.beginPath();g.ellipse(sx-1.5*s+sw,sy-20*s,7*s,6*s,0,0,7);g.fill();
  g.fillStyle='#4a9a46';g.beginPath();g.ellipse(sx-2.5*s+sw,sy-22*s,4*s,3.2*s,0,0,7);g.fill();
}
function drawBuilding(b){
  if(isOpen(b)) return drawInterior(b);
  const k=BK[b.kind], v=vcell(b.x,b.y);
  // footprint in view space depends on rotation, so take the rotated corners of the whole block
  const c0=vcell(b.x,b.y), c1=vcell(b.x+b.w-1,b.y+b.d-1);
  const x0=Math.min(c0[0],c1[0]), x1=Math.max(c0[0],c1[0])+1;
  const y0=Math.min(c0[1],c1[1]), y1=Math.max(c0[1],c1[1])+1;
  const z=hh[I(b.x,b.y)], pad=0.1, wh=k.ht*zoom;
  const P=quadV(x0+pad,y0+pad,x1-pad,y1-pad,z);
  const Pt=P.map(p=>[p[0],p[1]-wh]);
  g.save();g.globalAlpha=.25;
  poly([[P[0][0]+5,P[0][1]+3],[P[1][0]+7,P[1][1]+3],[P[2][0]+7,P[2][1]+5],[P[3][0]+5,P[3][1]+5]],'#000');
  g.restore();
  poly([P[3],P[2],Pt[2],Pt[3]], tint(k.col,0.70));
  poly([P[1],P[2],Pt[2],Pt[1]], k.col);
  g.fillStyle=k.trim; g.globalAlpha=.45;
  poly([[P[1][0],P[1][1]-wh+3],[P[2][0],P[2][1]-wh+3],Pt[2],Pt[1]],k.trim);
  g.globalAlpha=1;
  // door and windows on the facing wall
  const lit=(hour>=18||hour<6);
  const edge=(t1,t2,a,b2)=>[[a[0]+(b2[0]-a[0])*t1,a[1]+(b2[1]-a[1])*t1],
                            [a[0]+(b2[0]-a[0])*t2,a[1]+(b2[1]-a[1])*t2]];
  {
    const [p1,p2]=edge(0.40,0.60,P[1],P[2]), dh=wh*0.5;
    poly([[p1[0],p1[1]-2],[p2[0],p2[1]-2],[p2[0],p2[1]-dh],[p1[0],p1[1]-dh]],'#43301f');
    g.fillStyle='#e3b64a'; g.fillRect(p2[0]-3*zoom,p2[1]-dh*0.55,2.2*zoom,2.2*zoom);
  }
  [[0.08,0.26],[0.74,0.92]].forEach(([t1,t2])=>{
    const [p1,p2]=edge(t1,t2,P[1],P[2]);
    poly([[p1[0],p1[1]-wh*0.44],[p2[0],p2[1]-wh*0.44],[p2[0],p2[1]-wh*0.80],[p1[0],p1[1]-wh*0.80]],
      lit?'#f6d987':'#2b2a3a');
  });
  [[0.16,0.36],[0.62,0.82]].forEach(([t1,t2])=>{
    const [p1,p2]=edge(t1,t2,P[3],P[2]);
    g.globalAlpha=.85;
    poly([[p1[0],p1[1]-wh*0.44],[p2[0],p2[1]-wh*0.44],[p2[0],p2[1]-wh*0.80],[p1[0],p1[1]-wh*0.80]],
      lit?'#e9cd80':'#262534');
    g.globalAlpha=1;
  });
  // roof
  const rh=(k.shrine?6:14)*zoom;
  const apex=[(Pt[0][0]+Pt[2][0])/2,(Pt[0][1]+Pt[2][1])/2-rh];
  const ov=5*zoom;
  const Ae=[Pt[0][0],Pt[0][1]-ov*0.5],Be=[Pt[1][0]+ov,Pt[1][1]],
        Ce=[Pt[2][0],Pt[2][1]+ov*0.5],De=[Pt[3][0]-ov,Pt[3][1]];
  const tri=(p,q,c)=>{g.beginPath();g.moveTo(p[0],p[1]);g.lineTo(q[0],q[1]);
    g.lineTo(apex[0],apex[1]);g.closePath();g.fillStyle=c;g.fill();};
  tri(Ae,Be,tint(k.roof,0.76)); tri(De,Ae,tint(k.roof,0.76));
  tri(Be,Ce,k.roof); tri(Ce,De,tint(k.roof,0.84));
  // signatures
  if(k.shrine){
    const fl=0.6+Math.sin(tnow*2.4)*0.22;
    g.save(); g.globalAlpha=fl;
    g.fillStyle='#e3b64a';
    g.beginPath();
    g.moveTo(apex[0],apex[1]-20*zoom); g.lineTo(apex[0]+8*zoom,apex[1]-8*zoom);
    g.lineTo(apex[0],apex[1]+4*zoom);  g.lineTo(apex[0]-8*zoom,apex[1]-8*zoom);
    g.closePath(); g.fill();
    g.globalAlpha=fl*0.22; g.beginPath();g.arc(apex[0],apex[1]-8*zoom,26*zoom,0,7);g.fill();
    g.restore();
  }
  if(b.kind==='guild'){ g.fillStyle='#9e4a3c';
    g.fillRect(apex[0]-1*zoom,apex[1]-20*zoom,2*zoom,20*zoom);
    g.fillStyle='#e3b64a'; g.beginPath();
    g.moveTo(apex[0]+1*zoom,apex[1]-20*zoom);g.lineTo(apex[0]+14*zoom,apex[1]-16*zoom);
    g.lineTo(apex[0]+1*zoom,apex[1]-12*zoom);g.closePath();g.fill(); }
  if(b.kind==='guard'){ g.fillStyle='#49525f';
    g.fillRect(apex[0]-1*zoom,apex[1]-16*zoom,2*zoom,16*zoom);
    g.fillStyle='#8f9bb0'; g.fillRect(apex[0]+1*zoom,apex[1]-16*zoom,10*zoom,6*zoom); }
  if(b.kind==='bank'){ g.fillStyle='#e3b64a';
    g.beginPath();g.arc(apex[0],apex[1]-5*zoom,4*zoom,0,7);g.fill(); }
  if(b.kind==='tavern'||b.kind==='rose'){
    const fl=0.7+Math.sin(tnow*3+b.x)*0.2;
    g.fillStyle='rgba(243,200,110,'+fl.toFixed(2)+')';
    g.beginPath();g.arc(P[1][0]-4*zoom,P[1][1]-wh*0.9,3.2*zoom,0,7);g.fill();
  }
  // nameplate
  const [lx,ly]=scr(b.x+b.w/2,b.y+b.d/2,z);
  const inN=people.filter(p=>p.inside===b).length;
  plate(lx, ly-wh-rh-16*zoom,
    k.n.replace('&amp;','&')+(inN?'  \u00b7 '+inN:''),
    b.kind==='altar'?'#f0d98f':'#e8e0f0', 10.5);
  b.plate=[lx,ly-wh*0.5];
}
function drawPerson(p,indoors){
  if(p.away) return;
  if(p.inside && !indoors) return;
  const cx=p.x|0, cy=p.y|0, z=inB(cx,cy)?hh[I(cx,cy)]:0;
  const [sx,sy0]=scr(p.x,p.y,z);
  if(sx<-40||sx>CW+40||sy0<-60||sy0>CH+40){ p.scr=null; return; }
  const zm=zoom*(p.age<ADULT?0.66:1), bob=p.moving?Math.abs(Math.sin(p.f*8))*1.7*zm:0;
  const y=sy0-bob;
  let lit=true;
  if(overlay==='magic') lit=!!p.gift;
  else if(overlay==='adv') lit=!!p.adventurer;
  else if(overlay==='child') lit=p.age<ADULT;
  else if(overlay==='noble') lit=!!p.noble;
  else if(overlay==='work') lit=!!(p.at&&p.work&&p.at===p.work);
  if(overlay!=='none'&&!lit){ g.save(); g.globalAlpha=0.16; }
  if(overlay!=='none'&&lit){
    const col=({magic:'#8f6fe0',adv:'#c1483f',child:'#e3b64a',noble:'#d2c4a4',work:'#6fae5a'})[overlay];
    g.save(); g.globalAlpha=.3; g.fillStyle=col;
    g.beginPath();g.ellipse(sx,sy0,10*zm,5*zm,0,0,7);g.fill(); g.restore();
  }
  g.save();g.globalAlpha=.26;g.fillStyle='#000';
  g.beginPath();g.ellipse(sx,sy0,5.4*zm,2.7*zm,0,0,7);g.fill();g.restore();
  g.fillStyle='#2b2738'; g.fillRect(sx-3.4*zm,y-9*zm,2.8*zm,9*zm); g.fillRect(sx+0.7*zm,y-9*zm,2.8*zm,9*zm);
  g.fillStyle=p.top; rr(sx-4.4*zm,y-18*zm,8.8*zm,10*zm,2.6*zm); g.fill();
  if(p.noble){ g.fillStyle='#e3b64a'; g.fillRect(sx-4.4*zm,y-13*zm,8.8*zm,1.4*zm); }
  g.fillStyle=p.skin; g.fillRect(sx-5.8*zm,y-16.5*zm,1.8*zm,6.5*zm); g.fillRect(sx+4*zm,y-16.5*zm,1.8*zm,6.5*zm);
  g.fillStyle=p.skin; g.beginPath();g.arc(sx,y-22*zm,4.4*zm,0,7);g.fill();
  g.fillStyle=p.hair; g.beginPath();g.arc(sx,y-23.4*zm,4.4*zm,Math.PI,0);g.fill();
  g.fillStyle='#241f30'; g.fillRect(sx-2.1*zm,y-22.1*zm,1.2*zm,1.2*zm); g.fillRect(sx+0.9*zm,y-22.1*zm,1.2*zm,1.2*zm);
  if(p.adventurer){ g.strokeStyle='#d8c08a'; g.lineWidth=1.4*zm;
    g.beginPath();g.moveTo(sx+5.4*zm,y-17*zm);g.lineTo(sx+8.4*zm,y-8*zm);g.stroke(); }
  if(p.guard){ g.fillStyle='#8f9bb0'; g.fillRect(sx-8*zm,y-17*zm,2.4*zm,8*zm); }
  if(p.gift){ const fl=0.45+Math.sin(tnow*3+p.id)*0.3;
    g.fillStyle=p.gift.col; g.globalAlpha=fl;
    g.beginPath();g.arc(sx-6.4*zm,y-24*zm,2.1*zm,0,7);g.fill(); g.globalAlpha=1; }
  if(p===selected){
    const py=y-33*zm+Math.sin(tnow*2.2)*2*zm;
    g.save();g.fillStyle='#e3b64a';g.beginPath();
    g.moveTo(sx,py-7*zm);g.lineTo(sx+4.4*zm,py);g.lineTo(sx,py+7*zm);g.lineTo(sx-4.4*zm,py);
    g.closePath();g.fill();g.restore();
  }
  if(p.bubbleT>0||p===selected)
    plate(sx,y-29*zm-(p===selected?14*zm:0),
      p.bubbleT>0?p.bubble:(p.name+' '+p.last), p===selected?'#f6dfa6':'#e6e0ef',11);
  if(overlay!=='none'&&!lit) g.restore();
  p.scr=[sx,y];
}
function rr(x,y,w,h2,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h2,r);
  g.arcTo(x+w,y+h2,x,y+h2,r);g.arcTo(x,y+h2,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
function plate(x,y,text,col,sz){
  g.font='600 '+Math.round((sz||11)*Math.max(.82,zoom))+'px "Nunito Sans",system-ui,sans-serif';
  g.textAlign='center';g.textBaseline='middle';
  const w=g.measureText(text).width+14, h2=17*Math.max(.82,zoom);
  g.fillStyle='rgba(10,9,16,.84)'; rr(x-w/2,y-h2/2,w,h2,h2/2); g.fill();
  g.fillStyle=col; g.fillText(text,x,y+0.5);
}
/* ---------- drawing the Keep ---------- */
function drawDCell(vx,vy){
  const w=wcell(vx,vy), x=w[0], y=w[1];
  if(!dIn(x,y)) return;
  const i=dI(x,y), t=dty[i], th=themeFor(dfloor);
  if(!dseen[i]){
    const P=quadV(vx,vy,vx+1,vy+1,0);
    poly(P,'#0a0910'); return;
  }
  const solid=(t===DROCK);
  const z=solid?1:0;
  const P=quadV(vx,vy,vx+1,vy+1,z);
  if(solid){
    const n=((x*5+y*11)%3);
    const nR=wcell(vx+1,vy), nD=wcell(vx,vy+1);
    const openR=dIn(nR[0],nR[1])&&dAt(nR[0],nR[1])!==DROCK;
    const openD=dIn(nD[0],nD[1])&&dAt(nD[0],nD[1])!==DROCK;
    if(openR) poly([P[1],P[2],[P[2][0],P[2][1]+HZ*zoom],[P[1][0],P[1][1]+HZ*zoom]], th.rock[1]);
    if(openD) poly([P[2],P[3],[P[3][0],P[3][1]+HZ*zoom],[P[2][0],P[2][1]+HZ*zoom]], th.rock[2]);
    poly(P, n===0?th.rock[0]:n===1?tint(th.rock[0],1.06):tint(th.rock[0],0.9));
    g.strokeStyle='rgba(0,0,0,.42)';g.lineWidth=1;g.stroke();
    return;
  }
  let c;
  if(t===DPOOL){ const q=Math.sin(tnow*1.5+x+y); c=q>0?th.pool:tint(th.pool,0.82); }
  else if(t===DDOWN) c='#1a1620';
  else if(t===DUP) c='#2a2436';
  else { const n=((x*7+y*13)%3); c=n===0?th.floor[0]:n===1?th.floor[1]:th.floor[2];
    if(t===DCORR) c=tint(c,0.88); if(t===DRUBBLE) c=tint(c,0.78); }
  poly(P,c);
  g.strokeStyle='rgba(0,0,0,.16)';g.lineWidth=1;g.stroke();
  const cx=(P[0][0]+P[2][0])/2, cy=(P[0][1]+P[2][1])/2;
  if(t===DPOOL&&th.glow){ g.save();g.globalAlpha=.22;g.fillStyle=th.glow;
    g.beginPath();g.arc(cx,cy,15*zoom,0,7);g.fill();g.restore(); }
  if(t===DRUBBLE){ g.fillStyle=tint(th.rock[0],1.1);
    g.beginPath();g.ellipse(cx-3*zoom,cy-1*zoom,2.6*zoom,1.6*zoom,0,0,7);g.fill();
    g.beginPath();g.ellipse(cx+3*zoom,cy+1*zoom,2*zoom,1.3*zoom,0,0,7);g.fill(); }
  if(t===DDOWN||t===DUP){
    const down=(t===DDOWN);
    g.fillStyle=down?'#120f18':'#3a3350';
    for(let k=0;k<4;k++){
      const o=k*2.4*zoom;
      g.fillRect(cx-10*zoom+o, cy-6*zoom+o*0.5, 20*zoom-o*2, 2.4*zoom);
    }
    g.fillStyle=down?'#c1483f':'#6fae5a';
    g.font='700 '+Math.round(9*Math.max(.8,zoom))+'px "Nunito Sans",sans-serif';
    g.textAlign='center';g.textBaseline='middle';
    g.fillText(down?'\u25bc':'\u25b2', cx, cy-12*zoom);
  }
}
function drawTorch(t){
  const [sx,sy]=scr(t.x,t.y,1), th=themeFor(dfloor);
  const fl=0.62+Math.sin(tnow*6+t.p)*0.3;
  g.fillStyle='#3a2d22'; g.fillRect(sx-1*zoom,sy-10*zoom,2*zoom,8*zoom);
  g.save(); g.globalAlpha=fl; g.fillStyle=th.torch;
  g.beginPath();g.ellipse(sx,sy-13*zoom,2.6*zoom,4*zoom,0,0,7);g.fill();
  g.globalAlpha=fl*0.16; g.beginPath();g.arc(sx,sy-11*zoom,34*zoom,0,7);g.fill();
  g.restore();
}
function drawChest(c){
  if(!dIn(c.x|0,c.y|0)||!dseen[dI(c.x|0,c.y|0)]) return;
  const [sx,sy]=scr(c.x,c.y,0), z=zoom;
  g.save();g.globalAlpha=.3;g.fillStyle='#000';
  g.beginPath();g.ellipse(sx,sy,6*z,2.8*z,0,0,7);g.fill();g.restore();
  g.fillStyle=c.open?'#54412a':'#6b4a2c'; g.fillRect(sx-6*z,sy-8*z,12*z,8*z);
  g.fillStyle=c.open?'#6e5a3c':'#9b7340'; g.fillRect(sx-6*z,sy-11*z,12*z,3.4*z);
  g.fillStyle='#e3b64a'; g.fillRect(sx-1*z,sy-9*z,2*z,3*z);
  if(!c.open){ const fl=0.3+Math.sin(tnow*2.6+c.x)*0.2;
    g.save();g.globalAlpha=fl;g.fillStyle='#e3b64a';
    g.beginPath();g.arc(sx,sy-8*z,12*z,0,7);g.fill();g.restore(); }
}
function drawMob(m){
  if(!dIn(m.x|0,m.y|0)||!dseen[dI(m.x|0,m.y|0)]) return;
  const [sx,sy]=scr(m.x,m.y,0), z=zoom;
  const bob=m.awake?Math.abs(Math.sin(m.f*9))*2*z:Math.sin(tnow*1.4+m.x)*0.8*z;
  const y=sy-bob;
  g.save();g.globalAlpha=.3;g.fillStyle='#000';
  g.beginPath();g.ellipse(sx,sy,6.5*z,3*z,0,0,7);g.fill();g.restore();
  const bg=m.boss?1.9:1;
  if(m.boss){ const fl=0.25+Math.sin(tnow*2.4)*0.12;
    g.save();g.globalAlpha=fl;g.fillStyle=m.col;
    g.beginPath();g.arc(sx,y-10*z,34*z,0,7);g.fill();g.restore(); }
  g.fillStyle=m.col; rr(sx-5.4*z*bg,y-15*z*bg,10.8*z*bg,13*z*bg,3.4*z); g.fill();
  if(m.boss){ g.fillStyle=tint(m.col,0.65);
    g.beginPath();g.moveTo(sx-9*z,y-26*z);g.lineTo(sx-5*z,y-32*z);g.lineTo(sx-2*z,y-25*z);
    g.closePath();g.fill();
    g.beginPath();g.moveTo(sx+9*z,y-26*z);g.lineTo(sx+5*z,y-32*z);g.lineTo(sx+2*z,y-25*z);
    g.closePath();g.fill();
    plate(sx,y-42*z,m.name,'#f6cfa6',11); }
  g.fillStyle='#120f18';
  g.fillRect(sx-3.2*z,y-11.6*z,2.2*z,2.2*z); g.fillRect(sx+1*z,y-11.6*z,2.2*z,2.2*z);
  if(m.awake){ g.fillStyle='#ff6a5a';
    g.fillRect(sx-3.2*z,y-11.6*z,2.2*z,2.2*z); g.fillRect(sx+1*z,y-11.6*z,2.2*z,2.2*z); }
  g.fillStyle=tint(m.col,0.7);
  g.fillRect(sx-7*z,y-9*z,2*z,5*z); g.fillRect(sx+5*z,y-9*z,2*z,5*z);
  // health
  if(m.hp<m.hpMax){
    const w=16*z;
    g.fillStyle='rgba(8,6,14,.8)'; g.fillRect(sx-w/2,y-21*z,w,3.4*z);
    g.fillStyle='#c1483f'; g.fillRect(sx-w/2,y-21*z,w*(m.hp/m.hpMax),3.4*z);
  }
  m.scr=[sx,y];
}
function drawDelver(p){
  const [sx,sy0]=scr(p.dx,p.dy,0), z=zoom;
  const bob=p.dmov?Math.abs(Math.sin(p.f*8))*1.8*z:0, y=sy0-bob;
  g.save();g.globalAlpha=.32;g.fillStyle='#000';
  g.beginPath();g.ellipse(sx,sy0,5.6*z,2.8*z,0,0,7);g.fill();g.restore();
  g.save();g.globalAlpha=.1;g.fillStyle='#ffd089';
  g.beginPath();g.arc(sx,y-10*z,46*z,0,7);g.fill();g.restore();
  g.fillStyle='#2b2738'; g.fillRect(sx-3.4*z,y-9*z,2.8*z,9*z); g.fillRect(sx+0.7*z,y-9*z,2.8*z,9*z);
  g.fillStyle=p.top; rr(sx-4.4*z,y-18*z,8.8*z,10*z,2.6*z); g.fill();
  g.fillStyle=p.skin; g.fillRect(sx-5.8*z,y-16.5*z,1.8*z,6.5*z); g.fillRect(sx+4*z,y-16.5*z,1.8*z,6.5*z);
  g.fillStyle=p.skin; g.beginPath();g.arc(sx,y-22*z,4.4*z,0,7);g.fill();
  g.fillStyle=p.hair; g.beginPath();g.arc(sx,y-23.4*z,4.4*z,Math.PI,0);g.fill();
  g.fillStyle='#241f30'; g.fillRect(sx-2.1*z,y-22.1*z,1.2*z,1.2*z); g.fillRect(sx+0.9*z,y-22.1*z,1.2*z,1.2*z);
  const swing=p.atk>0?Math.sin((0.85-p.atk)*9)*6*z:0;
  g.strokeStyle='#dcc89a'; g.lineWidth=1.7*z;
  g.beginPath();g.moveTo(sx+5.4*z,y-17*z);g.lineTo(sx+9*z+swing,y-8*z-swing*0.4);g.stroke();
  if(p.gift){ const fl=0.5+Math.sin(tnow*3+p.id)*0.3;
    g.save();g.globalAlpha=fl;g.fillStyle=p.gift.col;
    g.beginPath();g.arc(sx-6.4*z,y-24*z,2.2*z,0,7);g.fill();g.restore(); }
  const w=18*z;
  g.fillStyle='rgba(8,6,14,.8)'; g.fillRect(sx-w/2,y-30*z,w,3.6*z);
  g.fillStyle=p.hp>p.hpMax*0.6?'#6fae5a':p.hp>p.hpMax*0.3?'#e3b64a':'#c1483f';
  g.fillRect(sx-w/2,y-30*z,w*Math.max(0,p.hp/p.hpMax),3.6*z);
  if(p.bubbleT>0) plate(sx,y-40*z,p.bubble,'#f6dfa6',11);
  else if(p===selected) plate(sx,y-40*z,p.name,'#f6dfa6',11);
  p.scr=[sx,y];
}
function renderKeep(){
  g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,CW,CH);
  g.fillStyle='#07060c'; g.fillRect(0,0,CW,CH);
  const party=activeRun?activeRun.party:[];
  const pb=new Map(), mb=new Map(), cb=new Map(), tb=new Map();
  const put=(m2,x,y,v)=>{const k=(x|0)+','+(y|0); if(!m2.has(k))m2.set(k,[]); m2.get(k).push(v);};
  party.forEach(p=>put(pb,p.dx,p.dy,p));
  dmobs.forEach(m=>put(mb,m.x,m.y,m));
  dchests.forEach(c=>put(cb,c.x,c.y,c));
  dtorches.forEach(t=>put(tb,t.x,t.y,t));
  const V=visibleRange();
  for(let sum=V.s0;sum<=V.s1;sum++){
    const lo=Math.max(Math.max(0,sum-GS+1),Math.ceil((sum+V.d0)/2));
    const hi2=Math.min(Math.min(GS-1,sum),Math.floor((sum+V.d1)/2));
    for(let vx=lo;vx<=hi2;vx++){
      const vy=sum-vx; if(vy<0||vy>=GS) continue;
      const w=wcell(vx,vy), x=w[0], y=w[1];
      drawDCell(vx,vy);
      if(!dIn(x,y)||!dseen[dI(x,y)]) continue;
      const k=x+','+y;
      (tb.get(k)||[]).forEach(drawTorch);
      (cb.get(k)||[]).forEach(drawChest);
      (mb.get(k)||[]).forEach(drawMob);
      (pb.get(k)||[]).forEach(drawDelver);
    }
  }
  // floor banner
  const th=themeFor(dfloor);
  g.font='700 13px "Cinzel",Georgia,serif'; g.textAlign='center'; g.textBaseline='middle';
  const label='Floor '+dfloor+'  \u00b7  '+th.n+'  \u00b7  '+dmobs.length+' still moving';
  const w2=g.measureText(label).width+28;
  g.fillStyle='rgba(10,8,16,.86)'; rr(CW/2-w2/2,14,w2,28,14); g.fill();
  g.strokeStyle='#4c4468'; g.lineWidth=1; g.stroke();
  g.fillStyle='#e8c88a'; g.fillText(label,CW/2,29);
  if(!activeRun){
    g.font='600 13px "Nunito Sans",sans-serif'; g.fillStyle='#8f86a6';
    g.fillText('No party is below. The guild forms one each morning.',CW/2,CH/2);
  }
}

function visibleRange(){
  let s0=1e9,s1=-1e9,d0=1e9,d1=-1e9;
  for(const [px,py] of [[0,0],[CW,0],[0,CH],[CW,CH]]){
    const wx=(px-CW/2)/zoom+camX, wy=(py-CH/2)/zoom+camY;
    const a=wx/(TW/2), b=wy/(TH/2), vx=(a+b)/2, vy=(b-a)/2;
    s0=Math.min(s0,vx+vy); s1=Math.max(s1,vx+vy);
    d0=Math.min(d0,vx-vy); d1=Math.max(d1,vx-vy);
  }
  s1+=(10*HZ+60)/(TH/2);
  return {s0:Math.max(0,Math.floor(s0)-2), s1:Math.min(2*GS-2,Math.ceil(s1)+2),
          d0:Math.floor(d0)-3, d1:Math.ceil(d1)+3};
}
let overlay='none';
const opened=new Set();
let xray=false;
const isOpen=b=>xray||opened.has(b.id);
function drawFurn(b,it){
  const F=FURN[it.f];
  const wx=b.x+it.x, wy=b.y+it.y, z=hh[I(b.x,b.y)];
  const c0=vcell(wx,wy);
  const pad=(1-Math.min(0.98,F.w*1.12))/2, pdd=(1-Math.min(0.98,F.d*1.12))/2;
  const P=quadV(c0[0]+pad,c0[1]+pdd,c0[0]+1-pad,c0[1]+1-pdd,z);
  const ht=F.h*1.7*zoom;
  const Pt=P.map(p=>[p[0],p[1]-ht]);
  g.save(); g.globalAlpha=.3; g.fillStyle='#2a1a0d';
  g.beginPath();g.ellipse((P[0][0]+P[2][0])/2,(P[0][1]+P[2][1])/2,
    Math.abs(P[1][0]-P[3][0])/2.1, Math.abs(P[2][1]-P[0][1])/2.1,0,0,7);g.fill(); g.restore();
  poly([P[3],P[2],Pt[2],Pt[3]], tint(F.c,0.70));
  poly([P[1],P[2],Pt[2],Pt[1]], F.c);
  poly(Pt, F.top);
  g.strokeStyle='rgba(32,18,8,.45)'; g.lineWidth=1;
  g.beginPath();g.moveTo(Pt[0][0],Pt[0][1]);
  for(let i=1;i<4;i++)g.lineTo(Pt[i][0],Pt[i][1]); g.closePath(); g.stroke();
  if(F.fire){
    const fl=0.6+Math.sin(tnow*7+wx)*0.3;
    g.save(); g.globalAlpha=fl; g.fillStyle='#f08a34';
    const c=[(Pt[0][0]+Pt[2][0])/2,(Pt[0][1]+Pt[2][1])/2];
    g.beginPath();g.ellipse(c[0],c[1]-3*zoom,4*zoom,5*zoom,0,0,7);g.fill();
    g.globalAlpha=fl*0.25; g.beginPath();g.arc(c[0],c[1],18*zoom,0,7);g.fill();
    g.restore();
  }
  if(F.glow){
    const fl=0.4+Math.sin(tnow*2.2+wx)*0.18;
    g.save(); g.globalAlpha=fl*0.5; g.fillStyle=F.glow;
    const c=[(Pt[0][0]+Pt[2][0])/2,(Pt[0][1]+Pt[2][1])/2];
    g.beginPath();g.arc(c[0],c[1]-2*zoom,13*zoom,0,7);g.fill(); g.restore();
  }
}
function drawInterior(b){
  const k=BK[b.kind], z=hh[I(b.x,b.y)];
  const c0=vcell(b.x,b.y), c1=vcell(b.x+b.w-1,b.y+b.d-1);
  const x0=Math.min(c0[0],c1[0]), x1=Math.max(c0[0],c1[0])+1;
  const y0=Math.min(c0[1],c1[1]), y1=Math.max(c0[1],c1[1])+1;
  // warm floorboards
  for(let vy=y0;vy<y1;vy++)for(let vx=x0;vx<x1;vx++){
    const P=quadV(vx,vy,vx+1,vy+1,z);
    const n=((vx*5+vy*9)%3);
    poly(P, n===0?'#a07749':n===1?'#946d42':'#8a6540');
    g.strokeStyle='rgba(60,30,10,.30)';g.lineWidth=1;g.stroke();
  }
  // lamplight over the room, so an open interior stays readable after dark
  {
    const c=quadV((x0+x1)/2-0.02,(y0+y1)/2-0.02,(x0+x1)/2+0.02,(y0+y1)/2+0.02,z);
    const cx2=c[0][0], cy2=c[0][1], rad=Math.max(x1-x0,y1-y0)*TW*0.62*zoom;
    const gr=g.createRadialGradient(cx2,cy2,0,cx2,cy2,rad);
    gr.addColorStop(0,'rgba(255,214,140,.34)'); gr.addColorStop(1,'rgba(255,214,140,0)');
    g.fillStyle=gr; g.beginPath();g.arc(cx2,cy2,rad,0,7);g.fill();
  }
  const wh=9*zoom;
  const P=quadV(x0,y0,x1,y1,z), Pt=P.map(p=>[p[0],p[1]-wh]);
  poly([P[0],P[1],Pt[1],Pt[0]], tint(k.col,0.80));
  poly([P[0],P[3],Pt[3],Pt[0]], tint(k.col,0.66));
  poly([P[3],P[2],Pt[2],Pt[3]], tint(k.col,0.74));
  poly([P[1],P[2],Pt[2],Pt[1]], tint(k.col,0.88));
  g.strokeStyle=k.trim; g.lineWidth=1.4;
  g.beginPath();g.moveTo(Pt[0][0],Pt[0][1]);
  for(let i=1;i<4;i++)g.lineTo(Pt[i][0],Pt[i][1]); g.closePath(); g.stroke();
  // furniture, back to front
  b.furn.slice().sort((p,q)=>{
    const a1=vcell(b.x+p.x,b.y+p.y), b1=vcell(b.x+q.x,b.y+q.y);
    return (a1[0]+a1[1])-(b1[0]+b1[1]);
  }).forEach(it=>drawFurn(b,it));
  // whoever is in here
  people.filter(p=>p.inside===b&&!p.away)
    .sort((p,q)=>(p.x+p.y)-(q.x+q.y)).forEach(p=>drawPerson(p,true));
  if(zoom>0.85){
    const [lx,ly]=scr(b.x+b.w/2,b.y+b.d/2,z);
    const n=people.filter(p=>p.inside===b).length;
    plate(lx, ly-wh-30*zoom, k.n.replace('&amp;','&')+(n?'  \u00b7 '+n:''), '#f3e4bd',10.5);
  }
}
function render(){
  if(scene==='keep') return renderKeep();
  g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,CW,CH);
  const pb=new Map();
  for(const p of people){ if(p.away)continue; const k=(p.x|0)+','+(p.y|0);
    if(!pb.has(k))pb.set(k,[]); pb.get(k).push(p); }
  const bAt=new Map(); buildings.forEach(b=>bAt.set(b.x+','+b.y,b));
  const V=visibleRange();
  for(let sum=V.s0;sum<=V.s1;sum++){
    const lo=Math.max(Math.max(0,sum-GS+1),Math.ceil((sum+V.d0)/2));
    const hi2=Math.min(Math.min(GS-1,sum),Math.floor((sum+V.d1)/2));
    for(let vx=lo;vx<=hi2;vx++){
      const vy=sum-vx; if(vy<0||vy>=GS) continue;
      const w=wcell(vx,vy), x=w[0], y=w[1];
      drawCell(vx,vy);
      if(tree[I(x,y)]) drawTree(x,y);
      const b=bAt.get(x+','+y); if(b) drawBuilding(b);
      const g2=pb.get(x+','+y); if(g2) for(const p of g2) drawPerson(p);
    }
  }
  // night
  const nn=Math.max(0, Math.cos(((hour*60+minute)/1440)*Math.PI*2)*0.5+0.5-0.40);
  if(nn>0){
    g.fillStyle='rgba(16,16,44,'+(nn*0.92).toFixed(3)+')'; g.fillRect(0,0,CW,CH);
    // punch the lamplight back through for rooms with the roof off
    g.save(); g.globalCompositeOperation='lighter';
    for(const b of buildings){
      if(!isOpen(b)) continue;
      const z=hh[I(b.x,b.y)], [cx2,cy2]=scr(b.x+b.w/2,b.y+b.d/2,z);
      if(cx2<-120||cx2>CW+120||cy2<-120||cy2>CH+120) continue;
      const rad=Math.max(b.w,b.d)*TW*0.70*zoom;
      const gr=g.createRadialGradient(cx2,cy2-6*zoom,0,cx2,cy2-6*zoom,rad);
      gr.addColorStop(0,'rgba(120,96,46,'+(nn*0.85).toFixed(2)+')');
      gr.addColorStop(1,'rgba(120,96,46,0)');
      g.fillStyle=gr; g.beginPath();g.arc(cx2,cy2-6*zoom,rad,0,7);g.fill();
    }
    g.restore();
  }
  // the Keep's mouth, glowing at the ridge
  {
    const [kx,ky]=scr(49.5,19.5,6);
    const fl=0.5+Math.sin(tnow*1.6)*0.2;
    g.save(); g.globalAlpha=fl;
    g.fillStyle='#c1483f'; g.beginPath();g.ellipse(kx,ky-6*zoom,12*zoom,16*zoom,0,0,7);g.fill();
    g.globalAlpha=fl*0.3; g.beginPath();g.arc(kx,ky-6*zoom,40*zoom,0,7);g.fill();
    g.restore();
    plate(kx,ky-34*zoom,'Dragon\u2019s Keep  \u2193'+KEEP.deepest,'#f0b2aa',11.5);
  }
}

/* ===================== the loop ===================== */
let last=performance.now(), lastRailTick=-1;
function tick(ts){
  const raw=Math.min(0.05,(ts-last)/1000); last=ts; const dt=raw*speed; tnow+=raw;
  if(dt>0){
    minute+=dt*22;
    while(minute>=60){ minute-=60; hour++;
      if(hour>=24){ hour=0; day++; newDay(); }
      people.forEach(p=>{ p.at=null; p.goal=null; });
    }
    // guild sends parties out in the morning
    if(hour>=7 && hour<=11 && KEEP.runs.length<4 && rnd()<dt*0.9) formParty();
    if(activeRun && KEEP.runs.includes(activeRun)) stepFloor(activeRun,dt);
    else if(KEEP.runs.length) loadRun(KEEP.runs[0]);
    KEEP.runs.slice().forEach(r=>{
      if(r===activeRun) return;
      r.t+=dt; if(r.t<3.4) return; r.t=0;
      const power=partyPower(r.party), danger=6+r.floor*2.15, roll=power+ri(0,14)-danger;
      if(roll<-7){ const v=pick(r.party); v.hp-=ri(4,11);
        if(v.hp<=0){ v.hp=0; v.away=false; r.party.splice(r.party.indexOf(v),1); KEEP.lost++;
          logMsg('<b>'+v.name+' '+v.last+'</b> fell on floor '+r.floor+'.','d'); bereave(v); }
        endRun(r,false); return; }
      if(roll<2){ endRun(r,false); return; }
      const bz=bossFor(r.floor);
      if(bz){
        const power=partyPower(r.party);
        if(power < 14+r.floor*2.1){ endRun(r,false);
          logMsg('<b>'+bz[1]+'</b> drove the party back off floor '+r.floor+'.','d'); return; }
        logMsg('<b>'+bz[1]+'</b> was killed on floor '+r.floor+'.','g');
        r.party.forEach(q=>{ const rl=grantRelic(q,r.floor);
          if(rl) logMsg('<b>'+q.name+'</b> took the '+rl.n+'.','m'); });
        r.loot+=Math.round(r.floor*9+40);
      }
      r.loot+=Math.round(r.floor*2.2+ri(0,14));
      KEEP.cleared.add(r.floor);
      if(r.floor>KEEP.deepest){ KEEP.deepest=r.floor;
        logMsg('Floor <b>'+r.floor+'</b> reached for the first time.','g'); }
      r.party.forEach(p=>{ p.xp+=4+r.floor*0.35;
        while(p.xp>=p.lvl*60){ p.xp-=p.lvl*60; p.lvl++; p.hpMax+=3; p.hp=p.hpMax; } });
      r.floor++;
      if(r.floor>r.target||r.floor>100) endRun(r,true);
    });
    for(const p of people){
      if(p.away) continue;
      if(p.bubbleT>0) p.bubbleT-=raw;
      if(p.hp<p.hpMax && rnd()<dt*0.03) p.hp=Math.min(p.hpMax,p.hp+1);
      if(!p.goal){
        const dest=schedule(p);
        if(dest){
          if(dest!==p.inside && p.inside){            // step back out to the doorway first
            const od=p.inside.door; p.x=od[0]+0.5; p.y=od[1]+0.5;
            p.inside=null; p.slot=null; p.at=null;
          }
          const d=dest.door;
          p.goal={x:d[0],y:d[1],b:dest}; p.fld=fieldTo(d[0],d[1]);
        }
      }
      if(p.goal){
        const gx=p.goal.x+0.5, gy=p.goal.y+0.5;
        const dist=Math.hypot(gx-p.x,gy-p.y);
        if(dist<0.5){
          p.moving=false;
          if(p.at!==p.goal.b){
            p.at=p.goal.b;
            if(BK[p.at.kind].shop && p.age>=ADULT && p.gold>1) spendAt(p,p.at);
            const b=p.at;
            const used=new Set(people.filter(q=>q!==p&&q.at===b&&q.slot!=null).map(q=>q.slot));
            let sl=0; while(sl<b.slots.length-1&&used.has(sl)) sl++;
            p.slot=sl; p.inside=b;
            p.x=b.slots[sl][0]; p.y=b.slots[sl][1];
          }
          if(rnd()<dt*0.3){ p.goal=null; }
        } else {
          const cx=p.x|0, cy=p.y|0;
          let bx=cx,by=cy,bd=p.fld?p.fld[I(cx,cy)]:-1;
          if(bd===undefined||bd<0){ p.goal=null; }
          else {
            for(let k=0;k<4;k++){
              const nx=cx+[1,-1,0,0][k], ny=cy+[0,0,1,-1][k];
              if(!inB(nx,ny))continue; const v=p.fld[I(nx,ny)];
              if(v>=0&&v<bd){bd=v;bx=nx;by=ny;}
            }
            const tx2=bx+0.5, ty2=by+0.5, vx=tx2-p.x, vy=ty2-p.y, m=Math.hypot(vx,vy)||1;
            const sp=(ty[I(cx,cy)]===ROAD?2.6:1.7)*(p.age<ADULT?1.1:1);
            p.x+=vx/m*sp*dt; p.y+=vy/m*sp*dt; p.moving=true; p.f=(p.f||0)+dt;
          }
        }
      }
    }
  }
  if(scene==='keep'&&!follow&&activeRun&&activeRun.party.length&&!userPanned){
    let ax=0,ay=0; activeRun.party.forEach(p=>{ax+=p.dx;ay+=p.dy;});
    ax/=activeRun.party.length; ay/=activeRun.party.length;
    const v=vpt(ax,ay), f=flat(v[0],v[1],0);
    camX+=(f[0]-camX)*Math.min(1,raw*1.6); camY+=(f[1]-camY)*Math.min(1,raw*1.6);
  }
  if(follow&&scene==='keep'&&follow.dx!==undefined){
    const v=vpt(follow.dx,follow.dy), f=flat(v[0],v[1],0);
    camX+=(f[0]-camX)*Math.min(1,raw*3); camY+=(f[1]-camY)*Math.min(1,raw*3);
  } else if(follow&&scene==='town'){ const v=vpt(follow.x,follow.y), f=flat(v[0],v[1],H(follow.x|0,follow.y|0));
    camX+=(f[0]-camX)*Math.min(1,raw*3); camY+=(f[1]-camY)*Math.min(1,raw*3); }
  if(v3d) render3D(); else render();
  if(((tnow*10)|0)%4===0){
    paintConsole();
    if(scene==='keep' && ((tnow*2)|0)!==lastRailTick){ lastRailTick=((tnow*2)|0); paintRail(); }
  }
  requestAnimationFrame(tick);
}
function newDay(){
  marketDay();
  people.forEach(p=>{
    if(rnd()<0.0016){ p.age++;
      if(p.age===ADULT){ p.child=false; p.work=null;
        if(rnd()<0.3){ p.adventurer=true; p.work=theGuild; p.trade='adventurer';
          p.hpMax=13; p.hp=13; p.gear=[pick(['arming sword','shortbow'])];
          logMsg('<b>'+p.name+' '+p.last+'</b> came of age and signed the guild roll.','');
        } else { p.trade=pick(TRADES);
          logMsg('<b>'+p.name+' '+p.last+'</b> came of age.',''); }
      }
    }
  });
  ECON.day=day;
}

/* ===================== UI ===================== */
const railEl=document.getElementById('rail');
const OVERLAYS=[['none','Nobody highlighted','#6f6a86'],['magic','The gifted','#8f6fe0'],
  ['adv','Guild adventurers','#c1483f'],['child','Children','#e3b64a'],
  ['noble','The two noble houses','#d2c4a4'],['work','At their work right now','#6fae5a']];
const railShut={};
function grp(id,cls,title,inner){
  const shut=railShut[id]?' shut':'';
  return '<div class="grp '+cls+shut+'" data-grp="'+id+'"><h4>'+title+
    '<span class="cv">\u25bc</span></h4><div class="body">'+inner+'</div></div>';
}
function paintRail(){
  const cam=
    '<div class="camrow">'+
      '<button class="cbtn" data-cam="l" title="Rotate left ([)">&#8630;</button>'+
      '<button class="cbtn" data-cam="r" title="Rotate right (])">&#8631;</button>'+
      '<button class="cbtn" data-cam="out">&minus;</button>'+
      '<button class="cbtn" data-cam="in">+</button></div>'+
    '<div class="camrow"><button class="cbtn wide" data-cam="c">Re-centre</button>'+
      ((scene==='town'||v3d)?'<button class="cbtn wide" data-cam="keep">East gate</button>':'')+'</div>'+
    (v3d
      ? '<div class="tiny">3D \u00b7 drag to orbit, shift-drag or right-drag to pan,'+
        ' scroll to zoom</div>'
      : '<div class="tiny">Facing '+['north','east','south','west'][rot]+
        ' \u00b7 drag to pan, scroll to zoom</div>');
  if(scene==='keep'){
    const th=themeFor(dfloor);
    const party=activeRun?activeRun.party:[];
    railEl.innerHTML=grp('cam','c','Camera',cam)+
      grp('delve','k','The delve',
        activeRun
        ? '<div class="tiny" style="margin:0 0 7px">Floor <b style="color:#e8c88a">'+dfloor+
          '</b> of 100 \u00b7 '+th.n+'<br>Pushing to floor '+activeRun.target+
          ' \u00b7 '+activeRun.loot+' gold so far<br>'+
          dmobs.filter(m=>m.awake).length+' roused, '+dmobs.length+' on the floor \u00b7 '+
          dchests.filter(c=>!c.open).length+' chests unopened</div>'+
          party.map(p=>'<button class="tool" data-who="'+p.id+'">'+
            '<span class="c" style="background:'+p.top+'"></span>'+p.name+
            '<span class="k">'+Math.ceil(p.hp)+'/'+p.hpMax+'</span></button>').join('')
        : '<div class="tiny">Nobody is below. Parties form between seven and eleven in the morning.</div>')+
      grp('other','','Other parties',
        KEEP.runs.filter(r=>r!==activeRun).length
        ? KEEP.runs.filter(r=>r!==activeRun).map((r,i)=>
            '<button class="tool" data-watch="'+KEEP.runs.indexOf(r)+'">'+
            '<span class="c" style="background:#c1483f"></span>Floor '+r.floor+
            '<span class="k">watch</span></button>').join('')
        : '<div class="tiny">No other party is in the Keep.</div>');
  } else {
    railEl.innerHTML=grp('cam','c','Camera',cam)+
      grp('ov','','Highlight',
        OVERLAYS.map(([k,n,c])=>'<button class="tool'+(overlay===k?' on':'')+'" data-ov="'+k+'">'+
          '<span class="c" style="background:'+c+'"></span>'+n+'</button>').join(''))+
      grp('roof','','Roofs',
        '<button class="tool'+(xray?' on':'')+'" id="xrayT">'+
          '<span class="c" style="background:#e3b64a"></span>Lift every roof</button>'+
        '<button class="tool" id="shutT"><span class="c" style="background:#6f6a86"></span>'+
          'Put them all back</button>'+
        '<div class="tiny">Or click any building to open just that one.</div>')+
      grp('places','k','Places',
        [['guild','Adventurers\u2019 Guild'],['hall','Town Hall'],['school','Schoolhouse'],
         ['bank','Vault'],['guard','Barracks'],['altar','Altar of JestSayin'],
         ['tavern','The Bent Lantern'],['rose','The Rosehouse']]
        .map(([k,n])=>'<button class="tool" data-go="'+k+'"><span class="c" style="background:'+
          BK[k].roof+'"></span>'+n+'</button>').join('')+
        '<div class="tiny">Five shops line the market street, one family to each.</div>');
  }
  railEl.querySelectorAll('[data-grp] h4').forEach(h=>h.onclick=()=>{
    const id=h.parentElement.dataset.grp; railShut[id]=!railShut[id]; paintRail(); });
  railEl.querySelectorAll('[data-cam]').forEach(b=>b.onclick=()=>{
    const a=b.dataset.cam;
    if(v3d&&R3){
      if(a==='l') R3.th-=Math.PI/6; else if(a==='r') R3.th+=Math.PI/6;
      else if(a==='in') R3.dist=Math.max(8,R3.dist/1.2);
      else if(a==='out') R3.dist=Math.min(120,R3.dist*1.2);
      else if(a==='c'){ R3.tx=26; R3.tz=23; R3.dist=40; R3.th=-2.25; R3.ph=0.78; }
      else if(a==='keep'){ R3.tx=46; R3.tz=21; R3.dist=24; R3.th=-2.6; R3.ph=0.5; }
      paintRail(); return;
    }
    if(a==='l') rot=(rot+3)%4; else if(a==='r') rot=(rot+1)%4;
    else if(a==='in') zoom=Math.min(2.6,zoom*1.2);
    else if(a==='out') zoom=Math.max(0.4,zoom/1.2);
    else if(a==='c'){ follow=null; userPanned=false;
      if(scene==='keep'&&activeRun&&activeRun.party.length){
        const p=activeRun.party[0], v=vpt(p.dx,p.dy), f=flat(v[0],v[1],0); camX=f[0];camY=f[1];
      } else { const f=scene==='keep'?flat(DN/2,DN/2,0):flat(26,24,0); camX=f[0];camY=f[1]; } }
    else if(a==='keep'){ follow=null; const v=vpt(47,19), f=flat(v[0],v[1],5); camX=f[0];camY=f[1]; }
    paintRail();
  });
  railEl.querySelectorAll('[data-ov]').forEach(b=>b.onclick=()=>{overlay=b.dataset.ov;paintRail();});
  railEl.querySelectorAll('[data-who]').forEach(b=>b.onclick=()=>{
    const p=people.find(q=>q.id===+b.dataset.who); if(p) showPerson(p); });
  railEl.querySelectorAll('[data-watch]').forEach(b=>b.onclick=()=>{
    const r=KEEP.runs[+b.dataset.watch]; if(r){ userPanned=false; loadRun(r); paintRail(); } });
  const xr=document.getElementById('xrayT');
  if(xr) xr.onclick=()=>{ xray=!xray; paintRail(); };
  const sh=document.getElementById('shutT');
  if(sh) sh.onclick=()=>{ xray=false; opened.clear(); paintRail(); };
  railEl.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{
    const t=byKind(b.dataset.go)[0]; if(!t)return;
    follow=null; const v=vpt(t.x+t.w/2,t.y+t.d/2), f=flat(v[0],v[1],0); camX=f[0];camY=f[1];
    opened.add(t.id); showBuilding(t);
  });
}
paintRail();

const pc=document.getElementById('portrait').getContext('2d');
const bp=document.getElementById('bigPortrait').getContext('2d');
function drawFace(ctx,p,S){
  ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,S,S);
  const gr=ctx.createLinearGradient(0,0,0,S); gr.addColorStop(0,'#2b2440');gr.addColorStop(1,'#15121f');
  ctx.fillStyle=gr; ctx.fillRect(0,0,S,S);
  const c=S/2;
  ctx.fillStyle=p.top; ctx.beginPath();ctx.arc(c,S*1.03,S*0.35,Math.PI,0);ctx.fill();
  ctx.fillStyle=p.skin; ctx.beginPath();ctx.arc(c,S*0.5,S*0.26,0,7);ctx.fill();
  ctx.fillStyle=p.hair; ctx.beginPath();ctx.arc(c,S*0.45,S*0.26,Math.PI,0);ctx.fill();
  ctx.fillStyle='#241f30';
  ctx.fillRect(c-S*0.11,S*0.48,S*0.055,S*0.055); ctx.fillRect(c+S*0.055,S*0.48,S*0.055,S*0.055);
  if(p.gift){ ctx.fillStyle=p.gift.col; ctx.beginPath();ctx.arc(S*0.84,S*0.16,S*0.07,0,7);ctx.fill(); }
  if(p.noble){ ctx.fillStyle='#e3b64a'; ctx.fillRect(c-S*0.16,S*0.19,S*0.32,S*0.045); }
}
function roleTags(p){
  const t=[];
  if(p.noble) t.push('<span class="tag gold">noble</span>');
  if(p.adventurer) t.push('<span class="tag war">guild adventurer</span>');
  if(p.guard) t.push('<span class="tag war">town guard</span>');
  if(p.gift) t.push('<span class="tag mag">'+p.gift.school+' \u00b7 rank '+p.gift.power+'</span>');
  if(p.age<ADULT) t.push('<span class="tag">child</span>');
  if(p.away) t.push('<span class="tag war">in the Keep</span>');
  return '<div class="tagline">'+t.join('')+'</div>';
}
function paintConsole(){
  document.getElementById('sPop').textContent=people.length;
  document.getElementById('sGold').textContent=Math.round(ECON.treasury).toLocaleString();
  document.getElementById('sMagic').textContent=people.filter(p=>p.gift).length;
  document.getElementById('sFloor').textContent=KEEP.deepest;
  document.getElementById('sClock').textContent='Day '+day+' \u00b7 '+
    String(hour).padStart(2,'0')+':'+String(Math.floor(minute)).padStart(2,'0');
  if(scene==='keep'&&!(selected&&people.includes(selected))){
    const nmK=document.getElementById('selName'), sbK=document.getElementById('selSub');
    nmK.textContent = activeRun ? 'Floor '+dfloor : "Dragon's Keep";
    sbK.textContent = activeRun
      ? themeFor(dfloor).n+' \u00b7 pushing to floor '+activeRun.target
      : 'Nobody is below.';
    document.getElementById('selThought') &&
      (document.getElementById('selThought').textContent='');
    document.getElementById('mid').innerHTML='<div class="sum">'+
      (activeRun
        ? '<b>'+activeRun.party.length+' in the party</b> \u00b7 '+
          dmobs.filter(m=>m.awake).length+' roused of '+dmobs.length+' \u00b7 '+
          dchests.filter(c=>!c.open).length+' chests still shut \u00b7 <b>'+
          activeRun.loot+' gold</b> carried<br>'+
          'Deepest the town has ever reached: floor <b>'+KEEP.deepest+
          '</b>. Lost down here so far: <b>'+KEEP.lost+'</b>.'
        : 'The guild sends parties down in the morning. Switch back to the Town and let the clock run.')+
      '</div>';
    document.getElementById('sheetBtn').hidden=true;
    document.getElementById('followBtn').hidden=true;
    pc.setTransform(1,0,0,1,0,0); pc.clearRect(0,0,120,120);
    pc.fillStyle='#120f18'; pc.fillRect(0,0,120,120);
    pc.fillStyle=themeFor(dfloor).torch; pc.globalAlpha=.4;
    pc.beginPath();pc.arc(60,60,30,0,7);pc.fill(); pc.globalAlpha=1;
    document.getElementById('sPop').textContent=people.length;
    document.getElementById('sGold').textContent=Math.round(ECON.treasury).toLocaleString();
    document.getElementById('sFloor').textContent=KEEP.deepest;
    document.getElementById('sClock').textContent='Day '+day+' \u00b7 '+
      String(hour).padStart(2,'0')+':'+String(Math.floor(minute)).padStart(2,'0');
    return;
  }
  const nm=document.getElementById('selName'), sb=document.getElementById('selSub'),
        mid=document.getElementById('mid'),
        sheet=document.getElementById('sheetBtn'), fb=document.getElementById('followBtn');
  if(selected && people.includes(selected)){
    const p=selected;
    nm.textContent=p.name+' '+p.last;
    sb.innerHTML=(p.age<ADULT?'child, ':'')+'age '+p.age+' \u00b7 <b>'+p.trade+'</b>'+
      (p.spouse?' \u00b7 married to '+p.spouse.name:'')+
      (p.kids.length?' \u00b7 '+p.kids.length+(p.kids.length>1?' children':' child'):'');
    mid.innerHTML='<div class="sum">'+
      (p.away?'Down in the Keep right now, on floor '+(p.run?p.run.floor:'?')+'. '
             :'At '+(p.at?BK[p.at.kind].n.replace('&amp;','&'):'the street')+'. ')+
      (p.gift?'Carries the <b>'+p.gift.school+'</b> gift. ':'No gift. ')+
      (p.gear.length?'Carries '+p.gear.join(', ')+'. ':'Unarmed. ')+
      '<b>'+p.gold+' gold</b> to their name.'+roleTags(p)+'</div>';
    drawFace(pc,p,120); sheet.hidden=false; fb.hidden=false;
  } else {
    selected=null;
    nm.textContent='Ashvale';
    sb.textContent='A town of twenty-odd families, and the hole in the ground that feeds it.';
    const kids=people.filter(p=>p.age<ADULT).length;
    const adv=people.filter(p=>p.adventurer).length;
    mid.innerHTML='<div class="sum"><b>'+people.length+' souls</b> \u00b7 '+
      (people.length-kids)+' grown, '+kids+' children \u00b7 '+
      people.filter(p=>p.gift).length+' gifted \u00b7 '+adv+' on the guild roll \u00b7 '+
      KEEP.lost+' lost to the Keep.<br>'+
      '<b>'+families.length+' families</b>, two of them noble. Five shops, each run by one family. '+
      (KEEP.runs.length?'<b>'+KEEP.runs.length+' part'+(KEEP.runs.length>1?'ies are':'y is')+
        ' down there now.</b>':'Nobody is in the Keep at the moment.')+'</div>';
    pc.setTransform(1,0,0,1,0,0); pc.clearRect(0,0,120,120);
    pc.fillStyle='#15121f'; pc.fillRect(0,0,120,120);
    pc.fillStyle='#e3b64a'; pc.globalAlpha=.35;
    pc.beginPath();pc.moveTo(60,22);pc.lineTo(84,60);pc.lineTo(60,98);pc.lineTo(36,60);
    pc.closePath();pc.fill(); pc.globalAlpha=1;
    sheet.hidden=true; fb.hidden=true;
  }
}
/* ---- panels ---- */
function openPanel(id){ document.getElementById(id).classList.add('open'); }
function closePanel(id){ document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closePanel(b.dataset.close));
function esc(t){ return String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function showPerson(p){
  selected=p; if(p.inside) opened.add(p.inside.id); paintConsole();
  document.getElementById('wName').textContent=p.name+' '+p.last;
  document.getElementById('wSub').textContent=(p.age<ADULT?'Child of Ashvale':p.trade)+
    ' \u00b7 age '+p.age+' \u00b7 '+(p.sex==='m'?'man':'woman');
  drawFace(bp,p,120);
  const kin=[];
  if(p.spouse) kin.push(['Married to', p.spouse.name+' '+p.spouse.last]);
  if(p.parents.length) kin.push(['Parents', p.parents.map(q=>q.name).join(' and ')]);
  if(p.kids.length) kin.push(['Children', p.kids.map(q=>q.name+' ('+q.age+')').join(', ')]);
  const sibs=p.parents.length?p.parents[0].kids.filter(q=>q!==p):[];
  if(sibs.length) kin.push(['Siblings', sibs.map(q=>q.name).join(', ')]);
  document.getElementById('wBody').innerHTML=
    '<div class="sec"><h4>The person</h4>'+roleTags(p)+
      '<div class="kv" style="margin-top:8px">'+
      '<span>Trade</span><b>'+esc(p.trade||'none')+'</b>'+
      '<span>Lives at</span><b>'+esc(BK[p.home.kind].n.replace('&amp;','&'))+
        ' ('+p.home.x+', '+p.home.y+')</b>'+
      '<span>Works at</span><b>'+(p.work?esc(BK[p.work.kind].n.replace('&amp;','&')):'no fixed place')+'</b>'+
      '<span>Purse</span><b>'+Math.round(p.gold)+' gold</b>'+
      (p.savings?'<span>In the vault</span><b>'+Math.round(p.savings)+' gold</b>':'')+
      '</div></div>'+
    ((p.relics&&p.relics.length)?'<div class="sec"><h4>Relics</h4>'+
      p.relics.map(r=>'<div class="sum" style="margin-bottom:4px">'+
        '<b style="color:#e3b64a">'+r.n+'</b> \u2014 '+
        [r.dmg?'+'+r.dmg+' damage':'',r.hp?'+'+r.hp+' health':'',r.gift?'+'+r.gift+' to the gift':'']
          .filter(Boolean).join(', ')+'</div>').join('')+'</div>':'')+
    '<div class="sec"><h4>Kin</h4>'+(kin.length?
      '<div class="kv">'+kin.map(([k,v])=>'<span>'+k+'</span><b>'+esc(v)+'</b>').join('')+'</div>'
      :'<div class="sum">No family recorded in the hall\u2019s ledger.</div>')+'</div>'+
    '<div class="sec"><h4>The gift</h4>'+(p.gift?
      '<div class="sum">Attuned to <b style="color:'+p.gift.col+'">'+p.gift.school+
      '</b> at rank '+p.gift.power+' of 3. The schoolmaster tests every child at seven; '+
      'about one in five has it.</div>'
      :'<div class="sum">Tested at seven and found unattuned, like four in five of Ashvale.</div>')+'</div>'+
    (p.adventurer||p.guard?
    '<div class="sec"><h4>Arms and condition</h4><div class="kv">'+
      '<span>Carries</span><b>'+(p.gear.join(', ')||'nothing')+'</b>'+
      '<span>Level</span><b>'+p.lvl+'</b>'+
      '</div><div class="sum" style="margin-top:6px">Health '+p.hp+' / '+p.hpMax+
      '<div class="bar"><i style="width:'+(p.hp/p.hpMax*100)+'%;background:'+
      (p.hp>p.hpMax*0.6?'#6fae5a':p.hp>p.hpMax*0.3?'#e3b64a':'#c1483f')+'"></i></div></div></div>':'')+
    '<div class="sec"><h4>Where they go</h4><div class="sum">'+
      'Sleeps at home until six. '+(p.child?'School from eight, home by evening.'
        :'Work from eight, with an hour at midday. Evenings are their own \u2014 the Bent Lantern, '+
         'the altar, the market, or the fire at home.')+'</div></div>';
  openPanel('who');
}
function showBuilding(b){
  const k=BK[b.kind];
  document.getElementById('wName').textContent=k.n.replace('&amp;','&');
  document.getElementById('wSub').textContent='A building of Ashvale \u00b7 ('+b.x+', '+b.y+')';
  bp.setTransform(1,0,0,1,0,0); bp.clearRect(0,0,120,120);
  bp.fillStyle='#15121f'; bp.fillRect(0,0,120,120);
  bp.fillStyle=k.roof; bp.fillRect(24,52,72,44);
  bp.fillStyle=k.col; bp.fillRect(30,66,60,30);
  const row=p=>'<div class="row"><span class="sw" style="background:'+p.top+'"></span>'+
    '<b>'+p.name+' '+p.last+'</b><em>'+(p.age<ADULT?'age '+p.age:p.trade)+'</em></div>';
  document.getElementById('wBody').innerHTML=
    '<div class="sec"><h4>What it is</h4><div class="sum">'+
      (k.shop?'One of the five shops on the market street, run by a single family.'
       :b.kind==='guild'?'Where parties are formed and contracts for the Keep are posted.'
       :b.kind==='altar'?'Raised to JestSayin. Townsfolk come by in the evening and leave a coin.'
       :b.kind==='rose'?'A house of rooms off the lantern district. Adults only; the town guard keeps it so.'
       :b.kind==='school'?'Every child attends until fifteen. The schoolmaster tests them for the gift at seven.'
       :b.kind==='bank'?'The vault. The town\u2019s share of every delve goes in here, '+
         'and anyone with more than seventy gold leaves the surplus on deposit.'
       :k.n.replace('&amp;','&'))+'</div></div>'+
    (()=>{ const now=people.filter(p=>p.inside===b);
      return now.length?'<div class="sec"><h4>Inside right now ('+now.length+')</h4>'+
        now.map(row).join('')+'</div>':''; })()+
    (BK[b.kind].shop?'<div class="sec"><h4>The till</h4><div class="kv">'+
      '<span>Takings today</span><b>'+Math.round(b.till||0)+' gold</b>'+
      '<span>Typical price</span><b>'+(PRICE[BK[b.kind].shop]||5)+' gold</b>'+
      '</div><div class="sum" style="margin-top:6px">Takings are split between the family '+
      'each market day, after a tenth goes to the hall.</div></div>':'')+
    (b.kind==='bank'?'<div class="sec"><h4>The books</h4><div class="kv">'+
      '<span>Treasury</span><b>'+Math.round(ECON.treasury)+' gold</b>'+
      '<span>On deposit</span><b>'+Math.round(people.reduce((a,p)=>a+(p.savings||0),0))+' gold</b>'+
      '<span>Tax taken</span><b>'+Math.round(ECON.taxed)+' gold</b>'+
      '<span>Wages paid</span><b>'+Math.round(ECON.wages)+' gold</b>'+
      '<span>Spent in shops</span><b>'+Math.round(ECON.traded)+' gold</b>'+
      '</div></div>':'')+
    (b.staff.length?'<div class="sec"><h4>Works here ('+b.staff.length+')</h4>'+
      b.staff.map(row).join('')+'</div>':'')+
    (b.residents.length?'<div class="sec"><h4>Lives here ('+b.residents.length+')</h4>'+
      b.residents.map(row).join('')+'</div>':'');
  openPanel('who');
  document.getElementById('wBody').querySelectorAll('.row').forEach((el,i)=>{
    const list=people.filter(p=>p.inside===b).concat(b.staff, b.residents);
    el.style.cursor='pointer'; el.onclick=()=>{ const p=list[i]; if(p) showPerson(p); };
  });
}
function showKeep(){
  const grid=[];
  for(let f=1;f<=100;f++){
    const active=KEEP.runs.some(r=>r.floor===f);
    const cls=active?'now':(f<=KEEP.deepest?(f%10===0?'deep':'done'):(f%10===0?'boss':''));
    grid.push('<div class="fl '+cls+'">'+f+'</div>');
  }
  document.getElementById('kSub').textContent='Deepest reached: floor '+KEEP.deepest+
    ' of 100 \u00b7 '+KEEP.lost+' never came back';
  document.getElementById('kBody').innerHTML=
    '<div class="sec"><h4>The descent</h4><div class="floorgrid">'+grid.join('')+'</div>'+
      '<div class="sum" style="margin-top:8px">Every tenth floor is held by something with a name. '+
      'Kill it and everyone in the party takes a relic.</div>'+
      '<div class="sec" style="margin-top:10px"><h4>The named</h4>'+
      BOSSES.map(([f2,n2])=>'<div class="row"><span class="sw" style="background:'+
        (KEEP.cleared.has(f2)?'#6fae5a':'#4c4468')+'"></span><b>'+n2+'</b><em>floor '+f2+
        (KEEP.cleared.has(f2)?' \u00b7 slain':'')+'</em></div>').join('')+'</div>'+
      '<div class="sum" style="margin-top:8px">Floor '+(KEEP.deepest+1)+' is held by <b>'+
      monsterFor(KEEP.deepest+1)+'</b>.</div></div>'+
    '<div class="sec"><h4>Parties below ('+KEEP.runs.length+')</h4>'+
      (KEEP.runs.length?KEEP.runs.map(r=>
        '<div class="party"><h5>'+r.party.map(p=>p.name).join(', ')+'</h5>'+
        '<div class="sum">On floor '+r.floor+' of a '+r.target+'-floor push \u00b7 '+
        r.loot+' gold so far</div>'+
        '<div class="prog"><i style="width:'+Math.min(100,(r.floor/r.target)*100)+'%"></i></div>'+
        '<button class="watchb" data-w="'+KEEP.runs.indexOf(r)+'">'+
        (r===activeRun?'Watching \u2014 go to the Keep':'Watch this party')+'</button></div>'
      ).join(''):'<div class="sum">Nobody is down there. The guild forms parties in the morning.</div>')+
    '</div>'+
    '<div class="sec"><h4>The roll</h4>'+
      people.filter(p=>p.adventurer).sort((a,b2)=>b2.lvl-a.lvl).map(p=>
        '<div class="row"><span class="sw" style="background:'+
        (p.away?'#c1483f':p.hp<p.hpMax*0.6?'#e3b64a':'#6fae5a')+'"></span>'+
        '<b>'+p.name+' '+p.last+'</b><em>lvl '+p.lvl+' \u00b7 '+p.hp+'/'+p.hpMax+
        (p.away?' \u00b7 below':'')+'</em></div>').join('')+'</div>'+
    '<div class="sec"><h4>Recent delves</h4>'+
      (KEEP.history.length?KEEP.history.map(hst=>
        '<div class="sum" style="margin-bottom:5px">Day '+hst.day+' \u2014 floor '+hst.floor+
        ', '+hst.loot+' gold \u00b7 '+hst.who.join(', ')+'</div>').join('')
        :'<div class="sum">No delves recorded yet.</div>')+'</div>';
  openPanel('keep');
  document.querySelectorAll('.watchb').forEach(b=>b.onclick=()=>{
    const r=KEEP.runs[+b.dataset.w]; if(!r) return;
    if(r!==activeRun) loadRun(r);
    closePanel('keep'); setScene('keep');
  });
}
document.getElementById('keepBtn').onclick=showKeep;
document.getElementById('scTown').onclick=()=>setScene('town');
document.getElementById('scKeep').onclick=()=>setScene('keep');
document.getElementById('logHead').onclick=()=>{
  const l=document.getElementById('log'); l.classList.toggle('shut');
  l.querySelector('span').textContent=l.classList.contains('shut')?'show':'hide'; };
document.getElementById('sheetBtn').onclick=()=>{ if(selected) showPerson(selected); };
document.getElementById('followBtn').onclick=()=>{ follow=follow?null:selected;
  document.getElementById('followBtn').classList.toggle('gold',!!follow); };
function setSpeed(v){ speed=v;
  document.querySelectorAll('[data-sp]').forEach(x=>x.classList.toggle('on',+x.dataset.sp===speed));
  document.getElementById('stage').classList.toggle('paused',speed===0); }
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>setSpeed(+b.dataset.sp));

/* ===================== the 3D view ===================== */
const HU=0.36;                                   // world height per terrain step
R3=null; cv3=null;
const C3={}; C3[GRASS]=0x5f8f4a; C3[ROAD]=0x9a9183; C3[PLAZA]=0xb0a692;
C3[WATER]=0x3a73b8; C3[DIRT]=0x9c8565; C3[FIELD]=0xb19a52; C3[ROCK]=0x7d7a84;
const hx=c=>typeof c==='string'?parseInt(c.replace('#',''),16):c;
const shd=(c,f)=>((Math.min(255,((c>>16)&255)*f)|0)<<16)|((Math.min(255,((c>>8)&255)*f)|0)<<8)|
  (Math.min(255,(c&255)*f)|0);
function terrainGeo(){
  const pos=[],col=[],idx=[]; let v=0;
  const vert=(x,y,z,c)=>{ pos.push(x,y,z);
    col.push(((c>>16)&255)/255,((c>>8)&255)/255,(c&255)/255); };
  const quad=(a,b,c2,d,cl)=>{ vert(a[0],a[1],a[2],cl); vert(b[0],b[1],b[2],cl);
    vert(c2[0],c2[1],c2[2],cl); vert(d[0],d[1],d[2],cl);
    idx.push(v,v+2,v+1,v,v+3,v+2); v+=4; };
  const lev=(x,y)=>{ if(!inB(x,y)) return -0.6;
    const i=I(x,y); return ty[i]===WATER? -0.34 : hh[i]*HU; };
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const i=I(x,y), t=ty[i], h0=lev(x,y);
    let c=C3[t]; const n=((x*7+y*13)^(x*3+y*11))%7;
    if(n===0) c=shd(c,0.965); else if(n===4) c=shd(c,1.035);
    quad([x,h0,y],[x+1,h0,y],[x+1,h0,y+1],[x,h0,y+1],c);
    const dE=h0-lev(x+1,y), dS=h0-lev(x,y+1);
    if(dE>0.004) quad([x+1,h0,y],[x+1,h0-dE,y],[x+1,h0-dE,y+1],[x+1,h0,y+1],shd(c,0.76));
    if(dS>0.004) quad([x,h0,y+1],[x+1,h0,y+1],[x+1,h0-dS,y+1],[x,h0-dS,y+1],shd(c,0.60));
  }
  const G=new THREE.BufferGeometry();
  G.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  G.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  G.setIndex(idx); G.computeVertexNormals(); return G;
}
function mkBuilding(b){
  const k=BK[b.kind], G=new THREE.Group(), base=H(b.x,b.y)*HU;
  const w=b.w-0.16, d=b.d-0.16, wh=k.ht*0.082;
  const walls=new THREE.Mesh(new THREE.BoxGeometry(w,wh,d),
    new THREE.MeshLambertMaterial({color:hx(k.col)}));
  walls.castShadow=walls.receiveShadow=true; G.add(walls);
  const rh=Math.max(w,d)*(k.shrine?0.85:0.40);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*0.73,rh,4),
    new THREE.MeshLambertMaterial({color:hx(k.roof)}));
  roof.rotation.y=Math.PI/4; roof.castShadow=true; G.add(roof);
  const sill=new THREE.Group(), glass=new THREE.MeshBasicMaterial({color:0xffd98a});
  [[-1,0],[1,0],[0,-1],[0,1]].forEach(a=>{
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w*0.2,wh*0.3),glass);
    m.position.set(b.x+b.w/2+a[0]*(w/2+0.015), base+wh*0.6, b.y+b.d/2+a[1]*(d/2+0.015));
    m.rotation.y=a[0]?a[0]*Math.PI/2:(a[1]>0?0:Math.PI); sill.add(m); });
  G.add(sill);
  const inner=new THREE.Group(); inner.visible=false;
  const fl=new THREE.Mesh(new THREE.BoxGeometry(w,0.08,d),
    new THREE.MeshLambertMaterial({color:0x9a6f42}));
  fl.position.set(b.x+b.w/2,base+0.05,b.y+b.d/2); fl.receiveShadow=true; inner.add(fl);
  (b.furn||[]).forEach(it=>{ const F=FURN[it.f], fh=F.h*0.05;
    const m=new THREE.Mesh(new THREE.BoxGeometry(F.w*0.9,fh,F.d*0.9),
      new THREE.MeshLambertMaterial({color:hx(F.c)}));
    m.position.set(b.x+it.x+0.5, base+0.09+fh/2, b.y+it.y+0.5);
    m.castShadow=true; inner.add(m);
    if(F.fire||F.glow){ const L=new THREE.PointLight(F.fire?0xff8a34:hx(F.glow),1.1,5.5);
      L.position.set(b.x+it.x+0.5, base+0.7, b.y+it.y+0.5); inner.add(L); } });
  G.add(inner);
  walls.position.set(b.x+b.w/2, base+wh/2, b.y+b.d/2);
  roof.position.set(b.x+b.w/2, base+wh+rh/2, b.y+b.d/2);
  G.userData={building:b,walls,roof,inner,sill,wh,base,rh};
  return G;
}
function mkFolk3(p3){
  const G=new THREE.Group(), s=p3.age<ADULT?0.7:1;
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.30*s,0.40*s,0.22*s),
    new THREE.MeshLambertMaterial({color:hx(p3.top)}));
  body.position.y=0.34*s; body.castShadow=true; G.add(body);
  const legs=new THREE.Mesh(new THREE.BoxGeometry(0.22*s,0.26*s,0.18*s),
    new THREE.MeshLambertMaterial({color:0x2b2738}));
  legs.position.y=0.13*s; G.add(legs);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.145*s,10,8),
    new THREE.MeshLambertMaterial({color:hx(p3.skin)}));
  head.position.y=0.655*s; head.castShadow=true; G.add(head);
  const hair=new THREE.Mesh(new THREE.SphereGeometry(0.152*s,10,6,0,Math.PI*2,0,Math.PI*0.62),
    new THREE.MeshLambertMaterial({color:hx(p3.hair)}));
  hair.position.y=0.662*s; G.add(hair);
  if(p3.gift){ const w=new THREE.Mesh(new THREE.SphereGeometry(0.075,8,6),
      new THREE.MeshBasicMaterial({color:hx(p3.gift.col)}));
    w.position.set(0.2,0.78*s,0); G.add(w); }
  G.userData={person:p3,body,s}; return G;
}
function rebuildFolk(S){
  if(typeof SKINS!=='undefined') SKINS.clear();
  while(S.pG.children.length) S.pG.remove(S.pG.children[0]);
  people.forEach(p3=>{ if(p3.dead) return; const m=mkFolk3(p3); p3.m3=m; S.pG.add(m); });
  S.folk=people.length;
}
function init3D(){
  if(R3) return R3;
  if(typeof THREE==='undefined'){ v3d=false; return null; }
  cv3=document.getElementById('view3d'); if(!cv3) return null;
  const renderer=new THREE.WebGLRenderer({canvas:cv3,antialias:true});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const S3=new THREE.Scene(); S3.fog=new THREE.Fog(0x1b1830,46,165);
  const cam=new THREE.PerspectiveCamera(44,1,0.4,520);
  S3.add(new THREE.AmbientLight(0xffffff,0.26));
  const hemi=new THREE.HemisphereLight(0xbcd8ff,0x47402f,0.5); S3.add(hemi);
  const sun=new THREE.DirectionalLight(0xffeccf,1.1);
  sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.bias=-0.0015;
  const sc=sun.shadow.camera; sc.left=-32; sc.right=32; sc.top=32; sc.bottom=-32;
  sc.near=1; sc.far=190; S3.add(sun); S3.add(sun.target);
  const ground=new THREE.Mesh(terrainGeo(),new THREE.MeshLambertMaterial({vertexColors:true}));
  ground.receiveShadow=true; S3.add(ground);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(N*2.4,N*2.4),
    new THREE.MeshLambertMaterial({color:0x3a73b8,transparent:true,opacity:0.8}));
  water.rotation.x=-Math.PI/2; water.position.set(N/2,-0.2,N/2); S3.add(water);
  let tn=0; for(let i=0;i<N*N;i++) if(tree[i]) tn++;
  if(tn){
    const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07,0.11,0.55,5),
      new THREE.MeshLambertMaterial({color:0x55401f}),tn);
    const leaves=new THREE.InstancedMesh(new THREE.ConeGeometry(0.44,1.05,7),
      new THREE.MeshLambertMaterial({color:0x357a38}),tn);
    trunks.castShadow=leaves.castShadow=true; leaves.receiveShadow=true;
    const M=new THREE.Matrix4(); let ti=0;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){ if(!tree[I(x,y)]) continue;
      const b=hh[I(x,y)]*HU;
      M.makeTranslation(x+0.5,b+0.27,y+0.5); trunks.setMatrixAt(ti,M);
      M.makeTranslation(x+0.5,b+1.0,y+0.5); leaves.setMatrixAt(ti,M); ti++; }
    S3.add(trunks); S3.add(leaves);
  }
  const bG=new THREE.Group(); S3.add(bG);
  buildings.forEach(b=>{ const m=mkBuilding(b); b.m3=m; bG.add(m); });
  const pG=new THREE.Group(); S3.add(pG);
  const keepGlow=new THREE.PointLight(0xc1483f,2,24);
  keepGlow.position.set(46,2.6,21); S3.add(keepGlow);
  R3={renderer,scene:S3,cam,sun,hemi,water,bG,pG,keepGlow,
      th:-2.25,ph:0.78,dist:40,tx:26,ty:0.6,tz:23,folk:0};
  rebuildFolk(R3); resize3D(); loadAssets(R3); return R3;
}
function resize3D(){ if(!R3||!cv3) return;
  const r=cv3.getBoundingClientRect();
  const w=Math.max(280,Math.floor(r.width)), h=Math.max(200,Math.floor(r.height));
  R3.renderer.setSize(w,h,false); R3.cam.aspect=w/h; R3.cam.updateProjectionMatrix(); }
function render3D(){
  const S=init3D(); if(!S){ render(); return; }
  if(S.folk!==people.length) rebuildFolk(S);
  const t=(hour*60+minute)/1440, ang=(t-0.25)*Math.PI*2;
  const el=Math.sin(ang), az=Math.cos(ang);
  const dayAmt=Math.max(0,Math.min(1,el*1.7+0.34));
  S.sun.position.set(26+az*72,Math.max(3,el*66),23-46);
  S.sun.target.position.set(26,0,23); S.sun.target.updateMatrixWorld();
  S.sun.intensity=0.16+dayAmt*1.05;
  S.sun.color.setHex(el<0.26?0xffb27a:0xffeccf);
  S.hemi.intensity=0.14+dayAmt*0.48;
  const sky=new THREE.Color(0x141226).lerp(new THREE.Color(0x8fc0e8),dayAmt);
  S.scene.background=sky; S.scene.fog.color=sky;
  S.water.material.opacity=0.68+0.14*dayAmt;
  const lamps=(hour>=18||hour<6);
  buildings.forEach(b=>{ const u=b.m3&&b.m3.userData; if(!u) return;
    const op=isOpen(b);
    u.roof.visible=!op; u.inner.visible=op; u.sill.visible=lamps&&!op;
    u.walls.scale.y=op?0.3:1;
    u.walls.position.y=u.base+(op?u.wh*0.15:u.wh/2); });
  people.forEach(p3=>{ const m=p3.m3; if(!m) return;
    if(p3.dead||p3.away||(p3.inside&&!isOpen(p3.inside))){ m.visible=false; return; }
    m.visible=true;
    m.position.set(p3.x,H(p3.x|0,p3.y|0)*HU,p3.y);
    const bob=p3.moving?Math.abs(Math.sin((p3.f||0)*9))*0.045:0;
    m.userData.body.position.y=(0.34+bob)*m.userData.s;
    m.rotation.y=p3===selected?tnow*1.6:0; });
  const d3t=Math.max(0,Math.min(0.1,tnow-(S.last||tnow))); S.last=tnow;
  updateSkins(S,d3t);
  S.keepGlow.intensity=1.5+Math.sin(tnow*1.8)*0.55;
  const cx=S.tx+Math.cos(S.th)*Math.cos(S.ph)*S.dist;
  const cy=S.ty+Math.sin(S.ph)*S.dist;
  const cz=S.tz+Math.sin(S.th)*Math.cos(S.ph)*S.dist;
  S.cam.position.set(cx,cy,cz); S.cam.lookAt(S.tx,S.ty,S.tz);
  S.renderer.render(S.scene,S.cam);
}
function pick3D(mx,my){
  const S=R3; if(!S) return null;
  const r=cv3.getBoundingClientRect();
  const ray=new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((mx/r.width)*2-1,-(my/r.height)*2+1),S.cam);
  const ph=ray.intersectObjects(S.pG.children,true);
  if(ph.length){ let o=ph[0].object; while(o&&!o.userData.person) o=o.parent;
    if(o) return {person:o.userData.person}; }
  const bh=ray.intersectObjects(S.bG.children,true);
  if(bh.length){ let o=bh[0].object; while(o&&!o.userData.building) o=o.parent;
    if(o) return {building:o.userData.building}; }
  return null;
}
function set3D(on){
  v3d=!!on;
  const c2=document.getElementById('view3d');
  if(c2) c2.style.display=v3d?'block':'none';
  cv.style.display=v3d?'none':'';
  const hintEl=document.getElementById('hint'); if(hintEl&&v3d) hintEl.remove();
  ['scTown','scKeep','sc3D'].forEach(id=>{ const e=document.getElementById(id);
    if(e) e.classList.toggle('on', id==='sc3D'?v3d:(!v3d&&scene===(id==='scTown'?'town':'keep'))); });
  if(v3d){ const S=init3D(); if(S){ resize3D(); } else { v3d=false; cv.style.display='';
    logMsg('The 3D view could not start: this browser has no WebGL.','bad'); } }
  paintRail(); paintConsole();
}
function wire3D(){
  const c2=document.getElementById('view3d'); if(!c2) return;
  new ResizeObserver(resize3D).observe(c2);
  let d3=null, m3=0;
  c2.addEventListener('contextmenu',e=>e.preventDefault());
  c2.addEventListener('pointerdown',e=>{ c2.setPointerCapture(e.pointerId);
    d3={x:e.clientX,y:e.clientY,th:R3?R3.th:0,ph:R3?R3.ph:0,
        tx:R3?R3.tx:0,tz:R3?R3.tz:0,pan:e.button===2||e.shiftKey}; m3=0; });
  c2.addEventListener('pointermove',e=>{ if(!d3||!R3) return;
    const dx=e.clientX-d3.x, dy=e.clientY-d3.y;
    m3=Math.max(m3,Math.hypot(dx,dy));
    if(d3.pan){ const s=R3.dist*0.0024;
      const fx=-Math.cos(R3.th), fz=-Math.sin(R3.th), rx=Math.sin(R3.th), rz=-Math.cos(R3.th);
      R3.tx=d3.tx-(dx*rx+dy*fx)*s; R3.tz=d3.tz-(dx*rz+dy*fz)*s; }
    else { R3.th=d3.th+dx*0.006;
      R3.ph=Math.max(0.12,Math.min(1.45,d3.ph+dy*0.005)); } });
  const up=e=>{ if(d3&&m3<5&&!d3.pan){ const r=c2.getBoundingClientRect();
      const h=pick3D(e.clientX-r.left,e.clientY-r.top);
      if(h&&h.person) showPerson(h.person);
      else if(h&&h.building){ if(opened.has(h.building.id)) opened.delete(h.building.id);
        else opened.add(h.building.id); showBuilding(h.building); }
      else { selected=null; paintConsole(); } }
    d3=null; };
  c2.addEventListener('pointerup',up);
  c2.addEventListener('pointercancel',()=>{d3=null;});
  c2.addEventListener('wheel',e=>{ e.preventDefault(); if(!R3) return;
    R3.dist=Math.max(8,Math.min(120,R3.dist*(e.deltaY<0?1/1.12:1.12))); },{passive:false});
}

/* ===================== optional assets =====================
   Everything here is additive. With no models/manifest.json the game stays exactly
   as it was: procedural boxes and cones, no errors, no console noise. The artifact
   bundle has no models/ to fetch, so it simply never leaves the procedural path. */
const ASSETS={ base:'models/', on:false, buildings:{}, chars:{}, shared:[], slots:{},
  named:null, roles:{}, cap:20, tried:false };
function roleOf(p){
  if(p.age<ADULT) return 'child';
  if(p.adventurer) return 'adventurer';
  if(p.guard) return 'guard';
  if(p.noble) return p.sex==='f'?'noblewoman':'nobleman';
  return p.sex==='f'?'woman':'man';
}
function charFor(p){
  const chain=[ASSETS.roles[roleOf(p)], roleOf(p),
    p.sex==='f'?'woman':'man', 'default'];
  for(const k of chain) if(k&&ASSETS.chars[k]) return ASSETS.chars[k];
  return null;
}
const CLIPWORDS={ idle:['idle','breathing','stand'], walk:['walk'],
  run:['run','jog'], attack:['slash','attack','punch','swing','shoot','stab'],
  die:['death','dying','die','fall'] };
/* Exporters disagree about bone names: three's Xbot carries 'mixamorigLeftHand',
   FBX2glTF keeps Mixamo's own 'mixamorig:LeftHand'. Same skeleton, same joint, no bind.
   So match on a normalised name and rewrite the clip's tracks onto whatever this rig
   actually calls them. Done once per clip per rig, then cached. */
const normBone=n=>n.replace(/[^A-Za-z0-9]/g,'').toLowerCase();
let RETARGET=new WeakMap();
function retarget(clip,root){
  let byRig=RETARGET.get(root);
  if(!byRig){ byRig=new Map(); RETARGET.set(root,byRig); }
  if(byRig.has(clip)) return byRig.get(clip);
  const names=new Map();
  root.traverse(o=>{ if(o.name) names.set(normBone(o.name),o.name); });
  // ROTATIONS ONLY. A position track describes the source skeleton's own limb lengths and
  // root units - three's Xbot carries a 100x armature scale - so copying one onto another
  // rig smears the mesh across the map. Rotation is the only thing that means the same
  // on both. That also gives in-place locomotion, which is what we want: the simulation
  // walks people along their paths, the clip only needs to move their legs.
  const tracks=[]; let hit=0;
  clip.tracks.forEach(t=>{
    const i=t.name.lastIndexOf('.');
    const node=i<0?t.name:t.name.slice(0,i), prop=i<0?'':t.name.slice(i);
    if(prop!=='.quaternion') return;
    const real=names.get(normBone(node));
    if(!real) return;                                // no such bone on this rig
    hit++;
    const c=t.clone(); c.name=real+prop; tracks.push(c);
  });
  const out = hit ? new THREE.AnimationClip(clip.name,clip.duration,tracks) : null;
  byRig.set(clip,out);
  return out;
}
function pickClip(list,slot,named){
  if(!list||!list.length) return null;
  if(named&&named[slot]){ const x=list.find(a=>a.name===named[slot]); if(x) return x; }
  for(const w of (CLIPWORDS[slot]||[slot])){
    const x=list.find(a=>a.name.toLowerCase().indexOf(w)>=0); if(x) return x; }
  return null;
}
function rigSpan(root){
  root.updateMatrixWorld(true);
  let lo=Infinity, hi=-Infinity, n=0; const v=new THREE.Vector3();
  root.traverse(o=>{ if(o.isBone){ v.setFromMatrixPosition(o.matrixWorld);
    if(v.y<lo) lo=v.y; if(v.y>hi) hi=v.y; n++; } });
  if(n<4||!isFinite(lo)||!isFinite(hi)||hi-lo<=0) return null;
  return {lo, hi, h:(hi-lo)*1.05};                 // bones stop short of the crown
}
function fitModel(root,wantW,wantD,originAtFeet){
  const box=new THREE.Box3().setFromObject(root), sz=new THREE.Vector3();
  box.getSize(sz);
  let s=1;
  if(wantW){ s=Math.min(wantW/(sz.x||1), wantD/(sz.z||1)); root.scale.setScalar(s); }
  const b2=new THREE.Box3().setFromObject(root), c=new THREE.Vector3();
  b2.getCenter(c);
  root.position.x-=c.x; root.position.z-=c.z;
  root.position.y-= originAtFeet ? b2.min.y : b2.min.y;
  root.traverse(o=>{ if(o.isMesh||o.isSkinnedMesh){ o.castShadow=true; o.receiveShadow=true; } });
  return s;
}
function loadAssets(S){
  if(ASSETS.tried||typeof THREE==='undefined'||!THREE.GLTFLoader) return;
  // no models to fetch from a file:// page, and the artifact bundle ships without them
  if(location.protocol==='file:'||window.__ASHVALE_NO_ASSETS) { ASSETS.tried=true; return; }
  ASSETS.tried=true;
  let man=null;
  fetch(ASSETS.base+'manifest.json',{cache:'no-cache'})
    .then(r=>r.ok?r.json():null)
    .then(m=>{
      if(!m) return;
      man=m; ASSETS.roles=m.roles||{}; ASSETS.named=m.clips||null;
      if(typeof m.cap==='number') ASSETS.cap=m.cap;
      const L=new THREE.GLTFLoader();
      const get=f=>new Promise(res=>L.load(ASSETS.base+f,g=>res(g),undefined,()=>res(null)));
      const jobs=[];
      Object.entries(m.buildings||{}).forEach(([kind,file])=>
        jobs.push(get(file).then(g=>{ if(g) swapBuilding(S,kind,g.scene); })));
      Object.entries(m.characters||{}).forEach(([role,file])=>
        jobs.push(get(file).then(g=>{
          if(!g) return;
          // Only a rig that actually carries Mixamo's bones may borrow the shared Mixamo
          // clips. Everything else is limited to the clips it shipped with.
          let mixamo=false;
          g.scene.traverse(o=>{ if(o.isBone&&normBone(o.name).indexOf('mixamorig')===0) mixamo=true; });
          ASSETS.chars[role]={scene:g.scene, clips:g.animations||[], mixamo};
        })));
      if(typeof m.animations==='string')
        jobs.push(get(m.animations).then(g=>{ if(g) ASSETS.shared=g.animations||[]; }));
      else if(m.animations) Object.entries(m.animations).forEach(([slot,file])=>
        jobs.push(get(file).then(g=>{
          if(g&&g.animations&&g.animations.length) ASSETS.slots[slot]=g.animations[0]; })));
      return Promise.all(jobs);
    })
    .then(()=>{
      if(!man) return;
      ASSETS.on = Object.keys(ASSETS.chars).length>0 || Object.keys(ASSETS.buildings).length>0;
      if(ASSETS.on) RETARGET=new WeakMap();
      if(ASSETS.on){ rebuildFolk(S);
        logMsg('Models loaded: the town is wearing its proper face.','good'); }
    })
    .catch(()=>{});                                  // no manifest, no models, no fuss
}
function swapBuilding(S,kind,proto){
  ASSETS.buildings[kind]=proto;
  buildings.filter(b=>b.kind===kind).forEach(b=>{
    const u=b.m3&&b.m3.userData; if(!u||u.model) return;
    const m=proto.clone(true);
    fitModel(m,b.w-0.1,b.d-0.1,true);
    m.position.x+=b.x+b.w/2; m.position.z+=b.y+b.d/2; m.position.y+=u.base;
    b.m3.add(m); u.model=m;
    u.walls.visible=false; u.roof.visible=false; u.sill.visible=false;
  });
}
/* --- animated characters, capped to the nearest few so the frame rate survives --- */
const SKINS=new Map();                                // person -> {grp,mixer,actions,cur}
let skinTick=0;
function makeSkin(p){
  const C=charFor(p); if(!C) return null;
  const inner=THREE.skeletonClone(C.scene);
  inner.traverse(o=>{ if(o.isMesh||o.isSkinnedMesh){ o.castShadow=true; o.receiveShadow=true;
    o.frustumCulled=false; } });
  const want=p.age<ADULT?1.2:1.7;
  const span=rigSpan(inner);
  let h=span?span.h:0, foot=span?span.lo:0;
  if(!h){ const b=new THREE.Box3().setFromObject(inner);
    const sz=b.getSize(new THREE.Vector3());
    if(isFinite(sz.y)&&sz.y>0){ h=sz.y; foot=b.min.y; } }
  let sc = h>0.0005 ? want/h : 1;
  sc = Math.max(0.02, Math.min(60, sc));           // never let a bad measure make a giant
  inner.scale.setScalar(sc);
  inner.position.y = -foot*sc;                     // stand them on the ground
  const grp=new THREE.Group(); grp.add(inner);
  return {grp, root:inner, own:C.clips, mixamo:!!C.mixamo,
          mixer:new THREE.AnimationMixer(inner), actions:{}, cur:null};
}
const ONESHOT={die:1, attack:1, cast:1, cast_big:1, hit:1, nod:1, talk:1};
function actionFor(sk,slot){
  if(slot in sk.actions) return sk.actions[slot];
  // A model's OWN clips win. They were authored for its rig, so they always bind; the
  // shared Mixamo set only fits models that carry Mixamo's skeleton, and forcing it onto
  // a foreign rig (three's Soldier, say) folds the character into a spread-eagled mess.
  const c = pickClip(sk.own,slot,ASSETS.named)
            || (sk.mixamo && (ASSETS.slots[slot] || pickClip(ASSETS.shared,slot,ASSETS.named)))
            || null;
  const r = c ? retarget(c,sk.root) : null;
  let a = r ? sk.mixer.clipAction(r) : null;
  if(a&&ONESHOT[slot]){ a.loop=THREE.LoopOnce; a.clampWhenFinished=true; }
  sk.actions[slot]=a;
  return a;
}
/* what somebody is visibly doing, in clip terms */
function clipFor(p){
  const f = p.sex==='f';
  if(p.dead) return 'die';
  if(p.moving) return f?'walk_f':'walk';
  const b=p.inside;
  if(b){
    const night = hour>=22||hour<6;
    if(night && b===p.home) return 'sleep';
    if(b.kind==='altar') return 'pray';
    if(b.kind==='rose'||b.kind==='tavern') return (p.id%3===0)?'drunk':'sit_talk';
    if(b.kind==='school') return 'sit';
    if(b.kind==='guard') return 'guard_idle';
    if(night) return 'sleep';
  }
  if(p.guard||p.adventurer) return 'guard_idle';
  return f?'idle_f':'idle';
}
function playClip(sk,slot){
  if(sk.cur===slot) return;
  const nxt=actionFor(sk,slot);
  if(!nxt) return;                                  // nothing for this slot; stay as we are
  const prev=sk.cur?sk.actions[sk.cur]:null;
  if(prev) prev.fadeOut(0.3);
  nxt.reset().fadeIn(0.3).play(); sk.cur=slot;
}
function updateSkins(S,dt){
  if(!ASSETS.on||!Object.keys(ASSETS.chars).length) return;
  skinTick-=dt;
  if(skinTick<=0){
    skinTick=0.4;
    const cam=S.cam.position;
    const near=people.filter(p=>p.m3&&p.m3.visible&&charFor(p))
      .map(p=>[p,(p.x-cam.x)*(p.x-cam.x)+(p.y-cam.z)*(p.y-cam.z)])
      .sort((a,b)=>a[1]-b[1]).slice(0,ASSETS.cap).map(a=>a[0]);
    const want=new Set(near);
    SKINS.forEach((sk,p)=>{ if(!want.has(p)){ S.pG.remove(sk.grp); SKINS.delete(p);
      if(p.m3) p.m3.visible=true; } });
    near.forEach(p=>{ if(SKINS.has(p)) return;
      const sk=makeSkin(p); if(!sk) return;
      S.pG.add(sk.grp); SKINS.set(p,sk); });
  }
  SKINS.forEach((sk,p)=>{
    const vis=p.m3&&p.m3.visible!==false&&!p.away&&!p.dead&&
      !(p.inside&&!isOpen(p.inside));
    sk.grp.visible=!!vis;
    if(p.m3) p.m3.visible=false;                     // the box stands in only when unskinned
    if(!vis) return;
    sk.grp.position.set(p.x,H(p.x|0,p.y|0)*HU,p.y);
    if(p.fx!==undefined){ const a=Math.atan2(p.x-p.fx,p.y-p.fy);
      if(Math.abs(p.x-p.fx)+Math.abs(p.y-p.fy)>0.004) sk.grp.rotation.y=a; }
    p.fx=p.x; p.fy=p.y;
    playClip(sk, clipFor(p));
    sk.mixer.update(dt);
  });
}

function setScene(sc){
  if(v3d) set3D(false);
  if(sc===scene) return;
  camSave[scene]={camX,camY,zoom};
  scene=sc; GS = sc==='keep' ? DN : N; follow=null; userPanned=false;
  const sv=camSave[sc];
  if(sv){ camX=sv.camX; camY=sv.camY; zoom=sv.zoom; }
  else if(sc==='keep'){ zoom=1.6; const f=flat(DN/2,DN/2,0); camX=f[0]; camY=f[1]; }
  else { zoom=1.1; const f=flat(26,24,0); camX=f[0]; camY=f[1]; }
  if(sc==='keep'&&activeRun&&activeRun.party.length){
    const p=activeRun.party[0], v=vpt(p.dx,p.dy), f=flat(v[0],v[1],0); camX=f[0]; camY=f[1];
  }
  const hintEl=document.getElementById('hint'); if(hintEl) hintEl.remove();
  const a=document.getElementById('scTown'), b2=document.getElementById('scKeep');
  if(a) a.classList.toggle('on',sc==='town');
  if(b2) b2.classList.toggle('on',sc==='keep');
  const c3b=document.getElementById('sc3D'); if(c3b) c3b.classList.remove('on');
  paintRail(); paintConsole();
}

/* ---- input ---- */
let drag=null, moved=0, userPanned=false;
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{ cv.setPointerCapture(e.pointerId);
  drag={x:e.clientX,y:e.clientY,cx:camX,cy:camY}; moved=0; });
cv.addEventListener('pointerup',()=>cv.classList.remove('grab'));
cv.addEventListener('pointermove',e=>{ if(!drag)return;
  const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
  moved=Math.max(moved,Math.hypot(dx,dy));
  if(moved>7){ follow=null; userPanned=true; cv.classList.add('grab');
    document.getElementById('followBtn').classList.remove('gold');
    camX=drag.cx-dx/zoom; camY=drag.cy-dy/zoom; } });
cv.addEventListener('pointerup',e=>{
  const was=moved>7; drag=null; if(was) return;
  const r=cv.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
  if(scene==='keep'){
    let h2=null,b2=1e9;
    const cands=(activeRun?activeRun.party:[]).concat(dmobs);
    for(const o of cands){ if(!o.scr)continue;
      const d=Math.hypot(o.scr[0]-mx,o.scr[1]-12*zoom-my);
      if(d<24*Math.max(0.7,zoom)&&d<b2){b2=d;h2=o;} }
    if(h2&&h2.last){ showPerson(h2); return; }
    selected=null; paintConsole(); return;
  }
  let hit=null,bd=1e9;
  for(const p of people){ if(!p.scr)continue;
    const d=Math.hypot(p.scr[0]-mx,p.scr[1]-12*zoom-my);
    if(d<24*Math.max(0.7,zoom)&&d<bd){bd=d;hit=p;} }
  if(hit){ showPerson(hit); return; }
  const c=pickCell(mx,my);
  if(c&&inB(c[0],c[1])&&occ[I(c[0],c[1])]){
    const b=buildings.find(b2=>b2.id===occ[I(c[0],c[1])]);
    if(b){ if(opened.has(b.id)) opened.delete(b.id); else opened.add(b.id);
      showBuilding(b); return; }
  }
  selected=null; paintConsole();
});
cv.addEventListener('wheel',e=>{ e.preventDefault();
  zoom=Math.max(0.4,Math.min(2.6,zoom*(e.deltaY<0?1.12:1/1.12))); },{passive:false});
addEventListener('keydown',e=>{
  if(e.key==='[') rot=(rot+3)%4; if(e.key===']') rot=(rot+1)%4;
  if(e.key==='Escape'){ closePanel('who'); closePanel('keep'); selected=null; paintConsole(); }
  if(e.key===' '){ e.preventDefault(); setSpeed(speed?0:1); }
  if(e.key==='1') setScene('town');
  if(e.key==='2') setScene('keep');
  if(e.key==='3'){ if(v3d) set3D(false); else { setScene('town'); set3D(true); } }
});
setTimeout(()=>{const h2=document.getElementById('hint');
  if(h2){h2.style.transition='opacity .6s';h2.style.opacity='0';setTimeout(()=>h2.remove(),700);}},16000);
wire3D();
(function(){ const b3=document.getElementById('sc3D');
  if(b3) b3.onclick=()=>{ if(v3d) set3D(false); else { setScene('town'); set3D(true); } }; })();
paintConsole(); requestAnimationFrame(tick);
})();
