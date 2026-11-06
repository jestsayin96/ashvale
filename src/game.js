(function(){
'use strict';
/* ===================== world ===================== */
/* The world is bigger than the town. TOWN is the 52x52 the town was authored in; OFF
   places it at the centre of N so there is land in every direction to walk into. Every
   call site of I(x,y) and inB(x,y) is untouched by this — that was the whole point of
   choosing a larger fixed grid over a coordinate-keyed chunk map (see ROADMAP c36). */
/* Four kingdoms on the corners of a 260-tile square centred on the map, each the
   52x52 that Ashvale's PLAN is authored at. 130 tiles between a kingdom and the
   dungeons out near the edges is about two days' walk at the 65 tiles/day measured
   in c37. N=364 holds that with 26 tiles of margin, and 13 still divides it so a
   CSZ chunk never straddles a region border. See ROADMAP c41 for the arithmetic. */
const TOWN=52, KSQ=260, N=364, TW=32, TH=16, HZ=10;
const KINGDOM=[
  {k:0, x0:(N-KSQ)/2-TOWN/2|0,       y0:(N-KSQ)/2-TOWN/2|0      },
  {k:1, x0:(N+KSQ)/2-TOWN/2|0,       y0:(N-KSQ)/2-TOWN/2|0      },
  {k:2, x0:(N-KSQ)/2-TOWN/2|0,       y0:(N+KSQ)/2-TOWN/2|0      },
  {k:3, x0:(N+KSQ)/2-TOWN/2|0,       y0:(N+KSQ)/2-TOWN/2|0      }
];
/* Ashvale is kingdom 0. Everything authored in town coordinates goes through
   tx0/ty0, which is what made c36's move cheap and makes this one cheap too. */
const OFF=KINGDOM[0].x0;
const tx0=x=>x+OFF, ty0=y=>y+OFF;        // town coords -> world coords
const GRASS=0,ROAD=1,PLAZA=2,WATER=3,DIRT=4,FIELD=5,ROCK=6;
const ty=new Uint8Array(N*N), hh=new Int8Array(N*N), occ=new Int16Array(N*N), tree=new Uint8Array(N*N);
/* Which cells exist. Everything outside is unmade: not water, not rock, just nowhere.
   Kept as a flat byte array so it indexes exactly like the others. */
const GEN=new Uint8Array(N*N);
let genX0=N, genY0=N, genX1=-1, genY1=-1;          // the made world's bounding box
function markGen(x0,y0,x1,y1){
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) if(inB(x,y)) GEN[I(x,y)]=1;
  if(x0<genX0) genX0=Math.max(0,x0); if(y0<genY0) genY0=Math.max(0,y0);
  if(x1>genX1) genX1=Math.min(N-1,x1); if(y1>genY1) genY1=Math.min(N-1,y1);
}
const genBounds=()=>({x0:Math.max(0,genX0), y0:Math.max(0,genY0),
                      x1:Math.min(N-1,genX1), y1:Math.min(N-1,genY1)});
const isMade=(x,y)=>inB(x,y)&&!!GEN[I(x,y)];
const I=(x,y)=>y*N+x, inB=(x,y)=>x>=0&&y>=0&&x<N&&y<N;
const T=(x,y)=>inB(x,y)?ty[I(x,y)]:WATER;
const H=(x,y)=>inB(x,y)?hh[I(x,y)]:0;
let sd=991337; const rnd=()=>{sd=(sd*1664525+1013904223)|0;return((sd>>>8)&0xffffff)/0xffffff;};
const pick=a=>a[(rnd()*a.length)|0];
const ri=(a,b)=>a+((rnd()*(b-a+1))|0);
/* These two are only ever called from buildTerrain, which authors in TOWN coordinates,
   so they apply the offset themselves. */
function fill(x0,y0,x1,y1,v){for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  const wx=tx0(x),wy=ty0(y); if(inB(wx,wy))ty[I(wx,wy)]=v;}}
function raise(x0,y0,x1,y1,v){for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  const wx=tx0(x),wy=ty0(y); if(inB(wx,wy))hh[I(wx,wy)]=v;}}

/* ===================== the town plan ===================== */
const BK={
 hall   :{n:'Ashvale Town Hall', w:4,d:3,ht:30, col:'#cbb189',roof:'#7a5f8f',trim:'#f1e3c4',civic:1},
 guild  :{n:'Adventurers\u2019 Guild', w:5,d:4,ht:32, col:'#b89a72',roof:'#9e4a3c',trim:'#edd9b4',civic:1},
 school :{n:'The Schoolhouse', w:4,d:3,ht:22, col:'#c3b9a0',roof:'#4f7fa6',trim:'#eae3d0',civic:1},
 bank   :{n:'Vault of Ashvale', w:3,d:3,ht:26, col:'#aeb3bd',roof:'#5c6373',trim:'#e8ecf2',civic:1},
 guard  :{n:'Guard Barracks', w:4,d:3,ht:24, col:'#9ba2ad',roof:'#49525f',trim:'#dde3ea',civic:1},
 altar  :{n:'Altar of the Pale Hour', w:3,d:3,ht:34, col:'#6f5fa0',roof:'#e3b64a',trim:'#d6c7ff',civic:1,shrine:1},
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
  ty.fill(ROCK); hh.fill(0);              // beyond the town is unmade ground for now
  const T=(x,y)=>I(tx0(x),ty0(y));
  markGen(OFF,OFF,OFF+TOWN-1,OFF+TOWN-1);
  for(let y=0;y<TOWN;y++)for(let x=0;x<TOWN;x++) ty[T(x,y)]=GRASS;
  // river down the west, bridged by the high road
  for(let y=0;y<TOWN;y++){ const w=2+((Math.sin(y*0.3)*1.4)|0);
    for(let x=2;x<=4+w;x++) if(x<TOWN) ty[T(x,y)]=WATER; }
  // the ridge in the east, with the Keep's mouth at its foot
  for(let y=0;y<TOWN;y++)for(let x=46;x<TOWN;x++){
    ty[T(x,y)]=ROCK; hh[T(x,y)]=Math.min(9,2+(x-45)*2+((Math.sin(y*0.4)*1.5)|0));
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
  for(let y=1;y<TOWN-1;y++)for(let x=1;x<TOWN-1;x++){
    const i=T(x,y);
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
PLAN.forEach(([k,x,y])=>place(k,tx0(x),ty0(y)));
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
/* Four kingdoms means four towns' worth of destinations against one cache of
   whole-grid fields. Count what it actually does before deciding how to pay for it. */
const FSTAT={hit:0, build:0, wipe:0, cells:0, ms:0};
/* How far a flow field reaches, in steps. Uncapped, a field floods every walkable
   cell connected to its target, so its cost is the size of the landmass: measured
   at 2,246 cells in today's mostly-unwalkable world and 23,526 in a scratch build
   where the whole grid was walkable. A bounded four-kingdom map is the second case,
   and a larger grid makes it worse in proportion. Capped, the cost is bounded by
   the cap instead - about 2*FMAX^2 cells - and stops depending on how big the world
   is. 130 covers a 52-wide kingdom corner to corner with room for its approaches;
   anything further is a journey, and journeys want waypoints, not one giant flood. */
const FMAX=130;
function fieldTo(tx,ty_){
  const key=tx+','+ty_; let f=fieldCache.get(key); if(f){ FSTAT.hit++; return f; }
  if(fieldCache.size>240){ fieldCache.clear(); FSTAT.wipe++; }
  const t0=performance.now();
  FSTAT.build++;
  f=new Int16Array(N*N).fill(-1);
  if(!walk(tx,ty_)){ FSTAT.ms+=performance.now()-t0; fieldCache.set(key,f); return f; }
  const q=[I(tx,ty_)]; f[q[0]]=0;
  for(let qi=0;qi<q.length;qi++){
    const c=q[qi], cx=c%N, cy=(c/N)|0, d=f[c];
    if(d>=FMAX) continue;
    for(let k=0;k<4;k++){
      const nx=cx+[1,-1,0,0][k], ny=cy+[0,0,1,-1][k];
      if(!inB(nx,ny)) continue; const ni=I(nx,ny);
      if(f[ni]!==-1||!walk(nx,ny)) continue;
      f[ni]=d+1; q.push(ni);
    }
  }
  FSTAT.cells+=q.length; FSTAT.ms+=performance.now()-t0;
  fieldCache.set(key,f); return f;
}

/* ===================== the world beyond the town =====================
   The authored town is one patch of a much larger grid. Everything else is
   unmade until somebody walks near it, and then it is generated a chunk at a
   time. CSZ divides both TOWN (52) and N (156), so the town occupies chunks
   4..7 on each axis exactly and no chunk ever straddles its border. */
const CSZ=13, CN=(N/CSZ)|0;
const CHGEN=new Uint8Array(CN*CN);
const CIX=(cx,cy)=>cy*CN+cx;
let chunksMade=0, worldDirty=false;
const chunkDirty=new Set();          // chunks whose ground mesh is out of date
/* Hash noise, not the sequential rnd(): a cell must generate the same whatever
   order the chunks happen to be made in, or a reload would redraw the world. */
function h2(x,y){ let n=(x*374761393+y*668265263)|0;
  n=Math.imul(n^(n>>>13),1274126177); return ((n^(n>>>16))>>>0)/4294967296; }
function vnoise(x,y,s){
  const fx=x/s, fy=y/s, x0=Math.floor(fx), y0=Math.floor(fy);
  const ax=fx-x0, ay=fy-y0, sx=ax*ax*(3-2*ax), sy=ay*ay*(3-2*ay);
  const a=h2(x0,y0), b=h2(x0+1,y0), c=h2(x0,y0+1), d=h2(x0+1,y0+1);
  return (a+(b-a)*sx)*(1-sy)+(c+(d-c)*sx)*sy;
}
/* One chunk of wild country, written so it meets the town's edge without a seam:
   the ridge formula and the river formula are the ones buildTerrain authored
   with, carried on past the town's border instead of stopping at it. */
function genChunk(cx,cy){
  const bx=cx*CSZ, by=cy*CSZ;
  for(let yy=0;yy<CSZ;yy++)for(let xx=0;xx<CSZ;xx++){
    const x=bx+xx, y=by+yy; if(!inB(x,y)) continue;
    const i=I(x,y); if(GEN[i]) continue;          // never re-author made ground
    const u=x-OFF, v=y-OFF;
    const out=Math.max(0,-u,u-(TOWN-1),-v,v-(TOWN-1));   // tiles beyond the town
    const fade=Math.min(1,out/7);                        // ease away from its flat edge
    if(u>=46){                                           // the eastern ridge runs on
      ty[i]=ROCK;
      hh[i]=Math.max(0,Math.min(9,2+(u-45)*2+((Math.sin(v*0.4)*1.5)|0)));
      continue;
    }
    const w=2+((Math.sin(v*0.3)*1.4)|0);
    const drift=(vnoise(400,y,17)-0.5)*Math.min(9,out*0.55);   // wanders once clear of town
    if(u>=2+drift && u<=4+w+drift){ ty[i]=WATER; hh[i]=0; continue; }
    const hN=vnoise(x,y,13);
    hh[i]=Math.max(0,Math.min(4,Math.round((hN-0.42)*5.2*fade)));
    if(vnoise(x+900,y,10)>0.78 && fade>0.5) ty[i]=ROCK;
    else if(hN<0.13 && fade>0.6){ ty[i]=WATER; hh[i]=0; }
    else { ty[i]=GRASS;
      if(vnoise(x,y+700,6)>0.55 && h2(x,y)>0.34) tree[i]=1; }
  }
}
function ensureChunk(cx,cy){
  if(cx<0||cy<0||cx>=CN||cy>=CN) return false;
  if(CHGEN[CIX(cx,cy)]) return false;
  CHGEN[CIX(cx,cy)]=1; chunksMade++;
  genChunk(cx,cy);
  markGen(cx*CSZ,cy*CSZ,cx*CSZ+CSZ-1,cy*CSZ+CSZ-1);
  /* The new chunk, and the four it now touches: their edge cells used to drop
     their side faces into the void and no longer should. */
  chunkDirty.add(CIX(cx,cy));
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
    const nx=cx+dx, ny=cy+dy;
    if(nx>=0&&ny>=0&&nx<CN&&ny<CN&&CHGEN[CIX(nx,ny)]) chunkDirty.add(CIX(nx,ny)); });
  /* Flow fields were solved against a world that stopped here, so every cached
     one now disagrees with the ground. Throw them away rather than route people
     around land that has since appeared. */
  fieldCache.clear();
  worldDirty=true;
  return true;
}
/* Called by anyone who moves. Generating around the walker rather than at the
   edge means the land is already there by the time they can path onto it. */
const SIGHT=7;
function exploreFrom(x,y){
  const out=Math.max(0,OFF-x,x-(OFF+TOWN-1),OFF-y,y-(OFF+TOWN-1));
  if(out>ERR.far) ERR.far=out;      // furthest anyone has got beyond the town
  let n=0;
  for(let cy=((y-SIGHT)/CSZ)|0; cy<=((y+SIGHT)/CSZ)|0; cy++)
    for(let cx=((x-SIGHT)/CSZ)|0; cx<=((x+SIGHT)/CSZ)|0; cx++)
      if(ensureChunk(cx,cy)) n++;
  return n;
}
/* The town was authored at boot, so its chunks already exist. */
for(let cy=(OFF/CSZ)|0; cy<((OFF+TOWN)/CSZ)|0; cy++)
  for(let cx=(OFF/CSZ)|0; cx<((OFF+TOWN)/CSZ)|0; cx++){ CHGEN[CIX(cx,cy)]=1; chunksMade++; }

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
/* What lives at each depth, and what it looks like. MKIND still decides how a thing
   behaves; this decides which body it wears, so a rogue-shaped spider is still a spider
   that closes fast. The dragon on floor 100 is finally a dragon. */
const MOBART=[
  [1,'rat'],[7,'bat'],[13,'spider'],[21,'slime'],[31,'snake_angry'],
  [46,'wasp'],[61,'frog'],[76,'skelly'],[100,'dragon']
];
function artFor(f){ let a='rat'; for(const [d,k] of MOBART) if(f>=d) a=k; return a; }

const MONSTER=[
 [1 ,'cave rats'],[3,'goblin scouts'],[6,'kobold diggers'],[10,'giant spiders'],
 [15,'bandit deserters'],[21,'ghouls'],[28,'ogres'],[36,'wraiths'],[45,'basilisks'],
 [55,'bone knights'],[66,'hellhounds'],[78,'a chimera'],[88,'the elder lich'],[97,'the dragon itself']
];
/* Not every thing down there fights the same way. A brute walks in and swings slowly,
   a rogue closes faster than you can turn, and a mage will not come to you at all. */
const MKIND={
  // nerve: the share of health below which it breaks and runs. 0 means it never does.
  minion:{ model:'default', sp:2.0, reach:1.1,  cd:1.10, hpM:1.00, dmgM:1.00, sz:1.35,
           nerve:0.28 },
  rogue :{ model:'rogue',   sp:3.5, reach:1.0,  cd:0.70, hpM:0.62, dmgM:0.80, sz:1.28,
           nerve:0.38 },                      // quick to close, quick to bolt
  mage  :{ model:'mage',    sp:1.5, reach:5.4,  cd:1.90, hpM:0.55, dmgM:1.45, sz:1.33,
           keepAway:3.4, bolt:'#9a7ae8', nerve:0.45 },
  brute :{ model:'boss',    sp:1.5, reach:1.3,  cd:1.80, hpM:1.95, dmgM:1.85, sz:1.62,
           nerve:0 }                          // a brute does not break
};
/* The mix by depth band, matching the dressing in BANDPROPS. The caves are mostly
   rabble; the crypts raise mages; the iron halls field brutes. */
const BANDMOBS=[
  ['minion','minion','minion','rogue'],
  ['minion','minion','rogue','mage','mage'],
  ['minion','rogue','brute','mage'],
  ['rogue','brute','brute','mage'],
  ['brute','mage','rogue','brute','mage']
];
function bandMobs(f){ const i=THEMES.findIndex(t=>f<=t.to); return BANDMOBS[i<0?4:i]; }

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
  /* The first name out of the hat is chance. Everyone after is chosen for the company:
     the guild adds whoever the party would most want beside them, and a strong enough
     grudge keeps a pair out of the same run entirely. */
  party.push(free.shift());
  while(party.length<size && free.length){
    let best=null, bs=-1e9;
    for(const c of free){
      let sc=rnd()*0.25;                       // a little chance, so it is not the same four
      let veto=false;
      for(const m of party){
        const b=(bondGet(c,m)+bondGet(m,c))/2;
        if(b<-0.55) veto=true;
        sc+=b*1.6;
      }
      if(veto) continue;
      if(sc>bs){ bs=sc; best=c; }
    }
    if(!best) break;                           // everyone left is somebody's grudge
    party.push(best); free.splice(free.indexOf(best),1);
  }
  if(party.length<3) return null;
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
  bondDelve(run.party, ok, !!run.lostAny);
  run.party.forEach(p=>{ p.away=false; p.run=null;
    const cut=Math.round(run.loot/Math.max(1,run.party.length));
    p.gold+=cut;
    // a run that buried someone is remembered for that, not for the climb out
    if(ok&&run.floor>1&&!run.lostAny)
      remember(p,'boss','Came back up from floor '+(run.floor-1)+'.'); });
  const cut=Math.round(run.loot*0.2);
  KEEP.gold+=cut; ECON.treasury+=cut; ECON.taxed+=cut;
  KEEP.history.unshift({floor:run.floor-1, loot:run.loot, ok,
    who:run.party.map(p=>p.name), day});
  if(KEEP.history.length>12) KEEP.history.pop();
  if(run.loot>0) logMsg('The party came back from floor '+(run.floor-1)+' with <b>'+run.loot+' gold</b>.','g');
  else logMsg('The party came back from the Keep empty-handed.','');
  KEEP.runs.splice(KEEP.runs.indexOf(run),1);
}
/* The chronicle scrolls away in seconds. The annals keep what a town would actually
   remember: who was born, who married whom, who died and where. */
const ANNALS=[], DEAD=[];
function annal(kind,text){
  ANNALS.unshift({k:kind, t:text, d:day, s:seasonI, y:yearN});
  if(ANNALS.length>160) ANNALS.pop();
}
function bereave(v,how){
  DEAD.unshift({ n:v.name, l:v.last, a:v.age, y:yearN, s:seasonI, d:day,
                 how:how||'died', tr:v.trade||'' });
  if(DEAD.length>120) DEAD.pop();
  annal('death', '<b>'+v.name+' '+v.last+'</b> '+(how||'died')+', aged '+v.age+'.');
  [v.spouse, ...(v.kids||[]), ...(v.parents||[])].forEach(k=>{
    if(k&&!k.dead) remember(k,'death','Lost <b>'+v.name+'</b> \u2014 '+(how||'died')+'.'); });
  snd('death',0.7);

  v.dead=true;
  if(v.spouse){ v.spouse.widowed=true; v.spouse.bubble='gone'; v.spouse.bubbleT=8;
    v.spouse.spouse=null; v.spouse=null; }
  // the children keep the parent in their list; the house loses a resident
  if(v.run&&v.run.party){ const j=v.run.party.indexOf(v); if(j>=0) v.run.party.splice(j,1); }
  const i=people.indexOf(v); if(i>=0) people.splice(i,1);
  if(v.home) v.home.residents=v.home.residents.filter(p=>p!==v);
  if(v.work) v.work.staff=v.work.staff.filter(p=>p!==v);
}

/* ===================== the day ===================== */
let day=1, hour=6, minute=0, speed=1;
/* People used to re-decide where to be every time their goal cleared, which with a
   jittered evening choice meant they stepped into a building and straight back out,
   over and over. Sampling showed `p.inside` was null in ten samples out of ten — nobody
   was ever actually anywhere, so every need that keys off being somewhere never moved.
   A decision now sticks until the hour it was made for has passed. */
function schedule(p){
  const h=hour;
  if(p.away) return null;
  if(p.plan && p.plan.b && h===p.plan.h && !foe) return p.plan.b;
  // Something is through the gate: the guard and any adventurer in town go to meet it,
  // whatever the hour says. Everyone else gets off the street.
  if(foe){
    if(p.guard||p.adventurer) return theGate;
    if(p.age>=ADULT||p.child) return p.home;
  }
  const keep=b=>{ p.plan={b,h}; return b; };
  if(h<6||h>=22){ p.why='asleep'; return keep(p.home); }
  if(h<8){ p.why='not up yet'; return keep(p.home); }
  if(h<12){ p.why=p.work?'at work':'nothing to do'; return keep(p.work||p.home); }
  if(h<13){ const t=needsOf(p).cheer>0.5&&p.gold>6;
    p.why=t?'out for dinner':'back at work'; return keep(t?theTavern:(p.work||p.home)); }
  if(h<17){ p.why=p.work?'at work':'nothing to do'; return keep(p.work||p.home); }
  if(h<20){
    if(p.child){ p.why='let out of school'; return keep(rnd()<0.5?p.home:theSchool); }
    return keep(chooseEvening(p));
  }
  p.why='turning in'; return keep(p.home);
}
/* ===================== a reason to leave town =====================
   Between eight and five an adult with no trade sat at home with `why` reading
   "nothing to do". Someone with no work and no coin has every reason to go out
   after what the country gives: firewood, game, roots. This is the first errand
   in the game that does not end at a door, and it is what makes the map grow —
   the land ahead of a walker is generated because they are walking into it, not
   because anything decided to enlarge the world.

   The destination is drawn from the made world, preferring ground outside the
   town. At first that is only a wooded corner of the town's own edge; walking
   there makes the next ring of country, and the trip after that can go into it.
   The frontier therefore creeps outward at the pace people actually travel. */
const ERR={started:0,done:0,gaveup:0,nospot:0,rolled:0,far:0};
function wildSpot(p){
  const b=genBounds(), here=I(p.x|0,p.y|0), seen=new Set(), cand=[];
  /* How far they can get and still be back before dark. The clock advances 22
     game-minutes per dt-unit and a walker covers about 1.7 tiles in one, so an
     hour of daylight is worth roughly 4.6 tiles out and back. Eight of the
     first fourteen trips were abandoned at dusk because a forager setting out
     at four picked somewhere a whole day away. */
  const budget=Math.max(5,(20-hour)*4.6*0.8);
  const outOf=(x,y)=>Math.max(0,OFF-x,x-(OFF+TOWN-1),OFF-y,y-(OFF+TOWN-1));
  for(let k=0;k<140;k++){
    const x=b.x0+((rnd()*(b.x1-b.x0+1))|0), y=b.y0+((rnd()*(b.y1-b.y0+1))|0);
    const key=x+','+y; if(seen.has(key)) continue; seen.add(key);
    if(!isMade(x,y)||!walk(x,y)) continue;
    const out=outOf(x,y);
    if(out===0 && !tree[I(x,y)]) continue;      // in town, only a wooded corner will do
    if(Math.hypot(x-p.x,y-p.y)>budget) continue;
    cand.push([out,x,y]);
  }
  cand.sort((a,b2)=>b2[0]-a[0]);
  /* Walkable is not the same as reachable. The strip west of the river is good
     grass that no path from the town can cross, and two foragers in a row set
     out for it, stood still with no flow value under them, and gave up at dusk.
     Build the field for the candidate and check it actually comes back here. */
  for(let i=0;i<Math.min(4,cand.length);i++){
    const f=fieldTo(cand[i][1],cand[i][2]);
    if(f[here]>=0) return {x:cand[i][1],y:cand[i][2]};
  }
  return null;
}
function errand(p){
  if(p.away||p.child||p.age<ADULT) return null;
  if(foe){ p.errandTo=null; return null; }
  if(p.errandTo){
    p.errandT=(p.errandT||0)+1;
    if(hour<7||hour>=20||p.errandT>60){ p.errandTo=null; ERR.gaveup++; return null; }
    return p.errandTo;
  }
  if(p.work||p.adventurer||p.guard) return null;
  if(hour<8||hour>=17) return null;
  if(p.errandDay===day) return null;                 // one trip a day is plenty
  if(needsOf(p).rest>0.72) return null;              // too tired for a day in the country
  ERR.rolled++;
  if(rnd()>0.18) return null;
  const s=wildSpot(p); if(!s){ ERR.nospot++; return null; }
  ERR.started++; p.errandTo=s; p.errandT=0; p.why='out in the country';
  return s;
}
/* ===================== the street =====================
   c44 measured the real failure behind "I don't see any sims": 68 of 69 people
   indoors at EVERY hour. `schedule()` returns `p.work||p.home`, and when that is
   where they already are the goal resolves in place and nobody ever steps out.
   Transit was the only time anyone was visible, and transits almost never happened.

   An outing is the opposite of c37's forage: minutes rather than a day, close by
   rather than across the country, and often rather than once. It reuses the same
   machinery - a goal with `b:null` is a destination in the open - and adds the one
   thing that was missing, a reason to STAY there once arrived. Without a dwell a
   person touches the spot and the schedule pulls them straight back indoors. */
const OUTSPOT=[];
function outSpots(){
  if(OUTSPOT.length) return OUTSPOT;
  for(let y=0;y<TOWN;y++)for(let x=0;x<TOWN;x++){
    const wx=tx0(x), wy=ty0(y), i=I(wx,wy);
    if(occ[i]) continue;
    const t=ty[i];
    // the plaza is worth twice a lane: it is where a town gathers
    if(t===PLAZA) OUTSPOT.push([wx,wy,2]);
    else if(t===ROAD) OUTSPOT.push([wx,wy,1]);
  }
  return OUTSPOT;
}
function nearSpot(p){
  const sp=outSpots(); if(!sp.length) return null;
  let best=null, bd=1e9;
  for(let k=0;k<30;k++){
    const c=sp[(rnd()*sp.length)|0];
    if(occ[I(c[0],c[1])]) continue;
    const d=Math.hypot(c[0]-p.x,c[1]-p.y)/c[2];
    if(d<bd&&d<9){ bd=d; best=c; }     // a walker covers 4.6 tiles a game-hour
  }
  return best?{x:best[0],y:best[1]}:null;
}
const STREET={started:0,ended:0,rolled:0,nospot:0};
function outing(p){
  if(p.away||p.errandTo) return null;
  if(foe){ p.out=null; return null; }
  if(p.out){
    if(p.outT>0 && hour>=6 && hour<22) return p.out;
    p.out=null; STREET.ended++; return null;         // time to go back in
  }
  const h=hour;
  if(h<7||h>=20) return null;
  /* Tuned against the census, not guessed. The first numbers emptied the town the
     other way - six of sixty-nine indoors at four in the afternoon - because at
     4.6 tiles a game-hour the walk dominates: an eighteen-tile spot is a three-hour
     round trip, so a single outing kept someone out most of the afternoon. */
  let chance;
  if(p.child)        chance = (h>=15&&h<19) ? 0.13 : 0.035;  // out after school
  else if(!p.work)   chance = (h>=8 &&h<19) ? 0.10 : 0.03;   // nothing to do indoors
  else               chance = (h===12||h===13||(h>=17&&h<19)) ? 0.085 : 0.025;
  if(needsOf(p).rest>0.80) chance*=0.3;              // too tired to loiter
  STREET.rolled++;
  if(rnd()>chance) return null;
  const s=nearSpot(p); if(!s){ STREET.nospot++; return null; }
  p.out=s; p.outT=ri(1,4);                            // twenty minutes to an hour and a half
  p.why = p.child ? 'playing out' : (p.work ? 'taking the air' : 'out in the street');
  STREET.started++;
  return s;
}

function foraged(p){
  ERR.done++; p.errandTo=null; p.errandDay=day;
  const g=ri(1,4); p.gold+=g;
  const n=needsOf(p);
  n.cheer=clamp01(n.cheer-0.18); n.rest=clamp01(n.rest+0.10);
  n.company=clamp01(n.company+0.06); n.spirit=clamp01(n.spirit-0.05);
  if(rnd()<0.25) logMsg('<b>'+p.name+'</b> came in from the country with '+g+' gold.','');
}

/* ===================== what a person wants =====================
   The evening used to be a dice roll: at six o'clock a villager drew a number and went
   to the tavern for no reason, and tomorrow it meant nothing that they had. Now each
   person carries four needs that rise and fall with what they actually do, and the
   evening goes to whichever place answers the loudest one. The same dice are still in
   there as a tiebreak, but they no longer decide.

   need.company  loneliness - rises alone, falls among people
   need.rest     tiredness  - rises all day, falls at home
   need.spirit   meaning    - drains slowly, restored at the altar
   need.cheer    appetite for a night out - rises when they have coin to spend     */
const NEEDKEYS=['company','rest','spirit','cheer'];
function needsOf(p){
  if(!p.need) p.need={company:rnd()*0.3, rest:rnd()*0.3, spirit:rnd()*0.3, cheer:rnd()*0.3};
  return p.need;
}
/* Occupancy, counted once a frame. needsTick runs per person, so asking "how many are
   in here with me" inside it would be an O(n^2) scan every frame. */
let OCCN=new Map(), occnAt=-1;
function occupancy(){
  if(occnAt===tnow) return OCCN;
  occnAt=tnow; OCCN=new Map();
  for(const q of people){ if(q.away||!q.inside) continue;
    OCCN.set(q.inside.id,(OCCN.get(q.inside.id)||0)+1); }
  return OCCN;
}
/* Rates are per dt-unit, and the sim advances 22 game-minutes per dt-unit, so a day is
   1440/22 = 65.5 of them whatever the speed setting. Every number below is chosen
   against that: a need should take most of a day to build and an evening to answer.
   The first draft had company RISING even in a crowded tavern, because it asked how
   many people LIVED in the building rather than how many were standing in it, so every
   need pinned at 100% within a day and nobody could prefer anything to anything. */
function needsTick(p,dt){
  const n=needsOf(p), h=hour;
  const here=p.inside?(occupancy().get(p.inside.id)||1):1;
  n.company=clamp01(n.company + dt*(here>1 ? -0.110 : 0.0055));
  const abed=(h>=22||h<6)&&p.inside===p.home;
  n.rest   =clamp01(n.rest    + dt*(abed ? -0.14 : (p.inside===p.home ? -0.012 : 0.0075)));
  n.spirit =clamp01(n.spirit  + dt*(p.inside===theAltar ? -0.22 : 0.0035));
  // you only fancy a night out if you can pay for one
  n.cheer  =clamp01(n.cheer   + dt*(p.gold>10 ? 0.006 : -0.04));
}
const clamp01=v=>v<0?0:v>1?1:v;

/* The evening choice. Each place is scored by the need it answers; the best one wins,
   with a small random nudge so two identical neighbours do not march in lockstep. */
/* Scores are RELATIVE, not absolute. A person whose needs have all climbed to the ceiling
   has no preference between them, and an absolute score would quietly let whichever need
   happened to be listed first win every time. Subtracting the mean means only the gap
   between needs decides, and when there is no gap the jitter honestly admits it. */
function chooseEvening(p){
  const n=needsOf(p), opts=[];
  const base=(n.company+n.rest+n.spirit+n.cheer)/4;
  const rel=k=>n[k]-base;
  const jit=()=>(rnd()-0.5)*0.10;
  opts.push([theTavern, rel('company')*0.9 + rel('cheer')*0.8 + jit()]);
  opts.push([theAltar,  rel('spirit')*1.3 + jit()]);
  opts.push([p.home,    rel('rest')*1.2 + (p.kids.length?0.10:0) + jit()]);
  if(p.gold>8) opts.push([pick(shops), rel('cheer')*0.55 + jit()]);
  if(p.age>=18 && !p.spouse && p.gold>12)
    opts.push([theRose, rel('company')*0.55 + rel('cheer')*0.5 + jit()]);
  // somebody they care about being out is a reason of its own
  if(p.spouse && p.spouse.inside && !p.spouse.away)
    opts.push([p.spouse.inside, rel('company')*1.0 + 0.12 + jit()]);
  let best=opts[0];
  for(const o of opts) if(o[1]>best[1]) best=o;
  p.why=whyOf(p,best[0]);
  return best[0]||p.home;
}
function whyOf(p,b){
  const n=needsOf(p);
  if(b===theAltar) return 'looking for meaning';
  if(b===theTavern) return n.company>n.cheer?'lonely':'fancies a drink';
  if(b===p.work)    return 'at work';
  if(b===theRose)   return 'lonely';
  if(b===p.home)    return n.rest>0.5?'worn out':'home with the family';
  if(p.spouse&&b===p.spouse.inside) return 'went to find '+p.spouse.name;
  return 'out spending';
}

/* ===================== what a person remembers =====================
   Every person has carried an empty `log: []` since the first commit. This is what
   finally writes to it. Kept short - a dozen entries - because it is a memory, not a
   ledger, and the oldest things fade. */
function remember(p,kind,text){
  if(!p||!p.log) return;
  p.log.unshift({d:day, y:yearN, s:seasonI, k:kind, t:text});
  if(p.log.length>12) p.log.pop();
}
const NEEDLABEL={company:'company', rest:'rest', spirit:'meaning', cheer:'a night out'};
const NEEDCOL={company:'#6fae5a', rest:'#8f9bb0', spirit:'#8f6fe0', cheer:'#e3b64a'};
function needBars(p){
  const n=needsOf(p);
  return '<div class="needs">'+NEEDKEYS.map(k=>
    '<div class="nrow"><span>'+NEEDLABEL[k]+'</span>'+
    '<span class="nbar"><i style="width:'+Math.round(n[k]*100)+'%;background:'+
      NEEDCOL[k]+'"></i></span></div>').join('')+'</div>';
}
function recallOf(p){
  if(!p.log||!p.log.length) return '';
  return p.log.slice(0,6).map(e=>
    '<div class="mem '+e.k+'"><em>'+SEASONNAME(e.s)+' y'+e.y+'</em>'+e.t+'</div>').join('');
}

/* ===================== who they trust =====================
   Families existed; friendship and grudge did not. A delver would walk into the Keep
   beside the man who left him on floor twelve and think nothing of it. Bonds are a
   number per pair, roughly -1 to 1, that warms with time spent together and with
   surviving a delve, and sours when somebody does not come back. */
const BONDCAP=14;                       // a person keeps track of this many others
function bondsOf(p){ if(!p.bond) p.bond={}; return p.bond; }
function bondGet(a,b){ return (a&&b&&a.bond&&a.bond[b.id])||0; }
function bondAdd(a,b,v){
  if(!a||!b||a===b) return;
  const A=bondsOf(a); A[b.id]=Math.max(-1,Math.min(1,(A[b.id]||0)+v));
  // forget the faintest acquaintance rather than growing without limit
  const ks=Object.keys(A);
  if(ks.length>BONDCAP){
    let weak=ks[0];
    for(const k of ks) if(Math.abs(A[k])<Math.abs(A[weak])) weak=k;
    delete A[weak];
  }
}
function bondBoth(a,b,v){ bondAdd(a,b,v); bondAdd(b,a,v); }
const byId=id=>people.find(q=>q.id===id)||null;

/* Time in the same room, counted once a game-hour so this is not an O(n^2) per frame. */
let bondH=-1;
function bondTick(){
  if(hour===bondH) return; bondH=hour;
  const rooms=new Map();
  for(const p of people){ if(p.away||!p.inside) continue;
    if(!rooms.has(p.inside.id)) rooms.set(p.inside.id,[]);
    rooms.get(p.inside.id).push(p); }
  rooms.forEach(list=>{
    if(list.length<2||list.length>8) return;      // a crowd is not company
    for(let i=0;i<list.length;i++) for(let j=i+1;j<list.length;j++)
      bondBoth(list[i],list[j],0.012);
  });
}
/* A delve is worth more than a hundred evenings in the tavern — unless somebody did not
   come back. The first version handed out the full camaraderie bonus regardless, which
   cancelled the loss penalty to the decimal: a tracked pair went 0.04 -> -0.14 -> 0.00
   across a death, so a party could lose a member and feel exactly the same about each
   other afterwards. A run that buried someone warms almost nothing. */
function bondDelve(party,ok,lost){
  const v = lost ? 0.015 : (ok?0.10:0.04);
  for(let i=0;i<party.length;i++) for(let j=i+1;j<party.length;j++)
    bondBoth(party[i],party[j], v);
}
/* Somebody did not come back. The survivors wear it, and each other. */
function bondLoss(party,lost){
  party.forEach(q=>{
    if(q===lost) return;
    bondAdd(q,lost,0.05);                          // you remember the dead kindly
    party.forEach(r=>{ if(r!==q&&r!==lost) bondAdd(q,r,-0.14); });
    remember(q,'death','Came back without <b>'+lost.name+'</b>.');
  });
}
function kinOf(p){
  const A=bondsOf(p), out=[];
  for(const k in A){ const q=byId(+k); if(q) out.push([q,A[k]]); }
  out.sort((x,y)=>y[1]-x[1]);
  return out;
}
function bondList(p){
  const l=kinOf(p).filter(e=>Math.abs(e[1])>0.12);
  if(!l.length) return '<div class="sum">Nobody they would call a friend yet.</div>';
  const row=e=>'<button class="kinrow" data-who="'+e[0].id+'">'+
    '<span class="sw" style="background:'+e[0].top+'"></span><b>'+esc(e[0].name)+'</b>'+
    '<em class="'+(e[1]>0?'warm':'cold')+'">'+
      (e[1]>0.45?'close':e[1]>0.12?'friendly':e[1]<-0.45?'will not forgive':'cool')+
    '</em></button>';
  return l.slice(0,3).map(row).join('')+
    (l.length>3?l.slice(-2).filter(e=>e[1]<-0.12).map(row).join(''):'');
}

function logMsg(t,cls){
  LOGS.unshift('<div class="'+(cls||'')+'">'+t+'</div>');
  if(LOGS.length>9) LOGS.pop();
  document.getElementById('logList').innerHTML=LOGS.join('');
}
const LOGS=[];
/* the opening line is written at boot, once we know whether a town was picked up */

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
  if(v3d&&scene==='town'){ const b=H(sh.x,sh.y)*HU+1.1;
    fxWord(sh.x+sh.w/2, sh.y+sh.d/2, '+'+want, '#f0cd62', b);
    fxBurst(sh.x+sh.w/2, sh.y+sh.d/2, '#f0cd62', 5, 0.7, 1.1, b); }
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
  // the fields pay in kind; how much depends entirely on the time of year
  const hands=people.filter(p=>p.age>=ADULT&&!p.adventurer&&!p.noble).length;
  const yield_=Math.round(hands*1.6*season().harvest);
  ECON.treasury+=yield_; tax+=0;
  ECON.treasury+=tax; ECON.taxed+=tax; ECON.wages+=paid;
  // anyone flush puts the surplus in the vault
  let dep=0;
  people.forEach(p=>{ if(p.gold>70){ const d=Math.round((p.gold-70)*0.5);
    p.gold-=d; p.savings=(p.savings||0)+d; dep+=d; } });
  ECON.deposits+=dep;
  if(tax||dep) logMsg('Market day: <b>'+tax+' gold</b> in tax, '+paid+' paid out, '+dep+
    ' banked, '+yield_+' from the fields.','g');
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
 {to:20, tex:'rock', n:'the wet caves',    rock:['#8a6e52','#4a3929','#36291c'], floor:['#5e4a3a','#564334','#4d3c2e'],
  pool:'#2f6f8e', glow:'#5fa8d8', torch:'#f0a34a', mob:'#8a9b6a'},
 {to:40, tex:'paving', n:'the crypts',       rock:['#8d8a9c','#45424e','#33313b'], floor:['#56525f','#4d4a57','#45424e'],
  pool:'#3d6b55', glow:'#5fc48e', torch:'#9ad7c0', mob:'#c7c2d6'},
 {to:60, tex:'rock', n:'the iron halls',   rock:['#7d8a9c','#3a4350','#2b323c'], floor:['#49535f','#424b56','#3b434d'],
  pool:'#2f5f8e', glow:'#6fb6e8', torch:'#8fc4f0', mob:'#9aa6b8'},
 {to:80, tex:'lava', n:'the magma deeps',  rock:['#7d5450','#38241f','#281917'], floor:['#4a322e','#432c29','#3b2724'],
  pool:'#e2562a', glow:'#ffa056', torch:'#ff8a3c', mob:'#e08a5a'},
 {to:100,tex:'rock', n:"the dragon's floors",rock:['#6d5f82','#2b2533','#1f1a26'],floor:['#3b3449','#352f41','#2e2939'],
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
      dmg:2.2+f*0.24, awake:false, name:bs[1], col:bs[2], f:0, atk:0, boss:true,
      kind:'brute', art:(f>=100?'dragon':artFor(f))});
  }
  const count=4+Math.round(f/7)+rI(0,3);
  for(let i=0;i<count;i++){
    const q=drooms[rI(1,Math.max(1,drooms.length-1))];
    const mx=q.x+rI(0,q.w-1), my=q.y+rI(0,q.d-1);
    if(!dWalk(mx,my)) continue;
    const kind=bandMobs(f)[rI(0,bandMobs(f).length-1)], K=MKIND[kind];
    const hpv=Math.round((6+f*1.3+rI(0,6))*K.hpM);
    dmobs.push({x:mx+0.5,y:my+0.5,hx:mx+0.5,hy:my+0.5,hp:hpv,hpMax:hpv,
      dmg:(0.75+f*0.145)*K.dmgM, awake:false, name:monsterFor(f), col:th.mob,
      f:0, atk:0, kind, art:artFor(f)});
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
  activeRun=run; genFloor(run.floor); dFieldCache.clear(); snd('descend',0.55); scoreUpdate();
  run.party.forEach((p,i)=>{
    p.dx=dUpAt[0]+0.5+(i%2)*0.6-0.3; p.dy=dUpAt[1]+0.5+((i/2)|0)*0.6-0.3;
    p.dgoal=null; p.dtarget=null; p.atk=0; p.dfld=null;
  });
  dReveal(dUpAt[0],dUpAt[1],7);
  {
    // snap whichever view you are in, so arriving on a floor never starts off-screen
    const v=vpt(dUpAt[0]+0.5,dUpAt[1]+0.5), f=flat(v[0],v[1],0);
    if(scene==='keep'){ camX=f[0]; camY=f[1]; }
    camSave.keep={camX:f[0], camY:f[1], zoom:(camSave.keep&&camSave.keep.zoom)||1.6};
    userPanned=false;
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
  /* Morale, the delvers' half of it. The old check was the party MEAN, which hides the
     one who is dying: three at full health and one at five per cent averages 0.76 and
     nobody turns back, so that one dies. Now the worst-off member can call it too. */
  const hpFrac=party.reduce((a,p)=>a+p.hp/p.hpMax,0)/party.length;
  let worst=party[0], wf=1;
  for(const p of party){ const f=p.hp/p.hpMax; if(f<wf){ wf=f; worst=p; } }
  if(run.state!=='retreat'){
    if(hpFrac<0.34){
      run.state='retreat';
      logMsg('The party is spent and makes for the stairs.','d');
    } else if(wf<0.18 && party.length>1){
      run.state='retreat';
      logMsg('<b>'+worst.name+'</b> is badly hurt. The party breaks off.','d');
    }
  }
  // and a delver who is failing stops trading blows and falls back, even mid-fight
  for(const p of party){
    const f=p.hp/p.hpMax;
    if(!p.shy && f<0.26){ p.shy=true; p.bubble='hurt'; p.bubbleT=4; }
    else if(p.shy && f>0.55) p.shy=false;        // patched up enough to stand in again
  }
  // monsters
  for(let i=dmobs.length-1;i>=0;i--){
    const m=dmobs[i];
    if(m.hp<=0){ dmobs.splice(i,1); continue; }
    if(!m.awake) continue;
    let tgt=null,td=1e9;
    for(const p of party){ const d=Math.hypot(p.dx-m.x,p.dy-m.y); if(d<td){td=d;tgt=p;} }
    if(!tgt) continue;
    const K=MKIND[m.kind]||MKIND.minion;
    /* Morale. Nothing down here used to break - a rat fought to the last point of
       health exactly like an ogre. Now a hurt thing runs, and if it gets clear it
       catches its breath and comes back. A boss and a brute never break. */
    if(!m.boss && K.nerve>0){
      if(!m.flee && m.hp/m.hpMax < K.nerve){
        m.flee=true;
        fxWord(m.x, m.y, 'flees', '#cfc3a0');
        if(rnd()<0.5) snd('hit',0.35);
      } else if(m.flee && td>14){
        // it got clear and kept going. Letting it recover instead would stall the
        // floor: a routed thing still counts as roused, and the delve never ends.
        dmobs.splice(i,1); continue;
      }
    }
    if(m.flee){
      const dx=m.x-tgt.dx, dy=m.y-tgt.dy, mm=Math.hypot(dx,dy)||1, sp=K.sp*1.35*dt;
      const nx=m.x+dx/mm*sp, ny=m.y+dy/mm*sp;
      if(dWalk(nx|0,m.y|0)) m.x=nx;
      if(dWalk(m.x|0,ny|0)) m.y=ny;
      m.f+=dt*1.6;
      continue;                                   // a routed thing does not fight
    }
    // a mage will not close; it backs off if you get inside its circle
    const away = K.keepAway && td < K.keepAway;
    if(td>K.reach || away){
      const sgn=away?-1:1;
      const dx=(tgt.dx-m.x)*sgn, dy=(tgt.dy-m.y)*sgn, mm=Math.hypot(dx,dy)||1,
            sp=K.sp*dt;
      const nx=m.x+dx/mm*sp, ny=m.y+dy/mm*sp;
      if(dWalk(nx|0,m.y|0)) m.x=nx;
      if(dWalk(m.x|0,ny|0)) m.y=ny;
      m.f+=dt;
    }
    {
      // a mage backing away can still cast, which is the whole point of it
      m.atk-=dt;
      if(m.atk<=0 && td<=K.reach){ m.atk=K.cd;
        tgt.hp-=m.dmg;
        if(K.bolt){                               // you can see where the spell came from
          const steps=5;
          for(let b=1;b<=steps;b++) fxBurst(m.x+(tgt.dx-m.x)*b/steps,
            m.y+(tgt.dy-m.y)*b/steps, K.bolt, 2, 0.5, 0.7);
        }
        fxNum(tgt.dx,tgt.dy,m.dmg,K.bolt||'#ff7a6a');
        snd(K.bolt?'spell':'hit', m.boss?1.2:0.8);
        fxBurst(tgt.dx,tgt.dy,K.bolt||'#ff9a7a',5,1.7);
        const ks=KSKINS.get(tgt); if(ks) fxFlash(ks);
        if(tgt.hp<=0){
          fxBurst(tgt.dx,tgt.dy,'#c9d6ff',22,2.5,2.6);
          fxWord(tgt.dx,tgt.dy,tgt.name+' falls','#ff8a7a');
          snd('die',1);
          tgt.hp=0; tgt.dead=true; tgt.away=false;
          party.splice(party.indexOf(tgt),1);
          KEEP.lost++;
          logMsg('<b>'+tgt.name+' '+tgt.last+'</b> was killed by '+m.name+' on floor '+run.floor+'.','d');
          run.lostAny=true; bondLoss(party.concat([tgt]), tgt);
          bereave(tgt,'was killed by '+m.name+' on floor '+run.floor);
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
      const S=pstyle(p);
      if(S.cast){ p.mana=Math.min(4,(p.mana===undefined?4:p.mana)+S.regen*dt); }
      // hurt and not yet cornered: get behind the others rather than trade another blow
      if(p.shy && md>1.4 && !S.ranged){
        if(!p.dgoal||p.dgoal.what!=='up') dSetGoal(p,dUpAt[0],dUpAt[1],'up');
        continue;
      }
      if(md<S.reach){
        // a ranged fighter holds where it stands; the others close
        p.dgoal=null;
        p.atk-=dt;
        const dry = S.cast && p.mana<S.cost;         // the gift is spent for the moment
        if(p.atk<=0){ p.atk=dry?0.9:S.cd;
          let mult=S.dmg;
          if(S.smother && md<S.smother) mult*=S.smotherM;   // too close to draw
          if(dry) mult*=0.35;
          else if(S.cast) p.mana-=S.cost;
          const hit=dDamage(p)*mult; mob.hp-=hit;
          const crit=p.gift&&!dry&&rnd()<0.22;
          if(S.shaft){                                  // you can see the shot cross the room
            const steps=4;
            for(let b=1;b<=steps;b++) fxBurst(p.dx+(mob.x-p.dx)*b/steps,
              p.dy+(mob.y-p.dy)*b/steps, S.shaft, 1, 0.35, 0.5);
          }
          if(p.gift){ const ks2=KSKINS.get(p); if(ks2) ks2.casting=0.7;
            fxBurst(mob.x,mob.y,p.gift.col||'#c9a6ff',10,2.2,2.4);
            fxBurst(p.dx,p.dy,p.gift.col||'#c9a6ff',6,1.0,1.8); }
          fxNum(mob.x,mob.y,hit,crit?(p.gift.col||'#c9a6ff'):'#ffe9b0',crit);
          fxBurst(mob.x,mob.y, crit?(p.gift.col||'#c9a6ff'):'#ffc98a', crit?12:5, crit?2.4:1.6);
          const ms=MSKINS.get(mob); if(ms) fxFlash(ms);
          if(mob.hp<=0){
            fxBurst(mob.x,mob.y, mob.boss?'#ffb45a':'#9ab08a', mob.boss?40:16,
              mob.boss?3.4:2.1, mob.boss?3.2:2.0);
            if(mob.boss) fxWord(mob.x,mob.y,mob.name+' is slain','#ffcf7a');
            if(mob.boss){
              logMsg('<b>'+mob.name+'</b> is dead. '+p.name+' struck the last blow.','g');
              run.party.forEach(q=>{ const r=grantRelic(q,run.floor);
                if(r){ logMsg('<b>'+q.name+'</b> took the '+r.n+'.','m');
                  remember(q,'relic','Took the <b>'+r.n+'</b> from '+mob.name+'.');
                  annal('relic','<b>'+q.name+'</b> took the '+r.n+'.'); } });
              run.party.forEach(q=>remember(q,'boss','Stood over <b>'+mob.name+
                '</b> on floor '+run.floor+'.'));
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
        fxLoot(chest.x,chest.y,chest.gold);
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
  const clear=!dmobs.some(m=>m.awake&&!m.flee);   // a routed thing holds nothing
  if(run.state!=='retreat' && atDown && clear){
    KEEP.cleared.add(run.floor); snd('cleared',0.8);
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
function centre(){ const p=flat(tx0(26),ty0(24),0); camX=p[0]; camY=p[1]; }
function resize(){
  const r=cv.getBoundingClientRect(); dpr=Math.min(2,window.devicePixelRatio||1);
  // a display:none canvas measures 0x0. Clamping that to the minimum left the 2D views
  // stranded at 280x200 in the corner of the stage after any trip through the 3D view.
  if(r.width<8||r.height<8){ if(CW&&CH) return; }
  CW=Math.max(280,Math.floor(r.width)); CH=Math.max(200,Math.floor(r.height));
  cv.width=CW*dpr;cv.height=CH*dpr;cv.style.width=CW+'px';cv.style.height=CH+'px'; }
new ResizeObserver(resize).observe(cv); resize();
camX=flat(tx0(26),ty0(24),0)[0]; camY=flat(tx0(26),ty0(24),0)[1];

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
  const w=wcell(vx,vy), x=w[0], y=w[1], i=I(x,y);
  if(!GEN[i]) return;                       // unmade ground is nowhere, not a grey tile
  const t=ty[i], z=hh[i];
  const pal=TC[t]; let top=pal[0];
  if(t===WATER){ const q=Math.sin(tnow*1.2+x*0.8+y*0.6); top=q>0.4?'#4280c6':(q<-0.5?'#2f63a0':pal[0]); }
  else { const v=((x*7+y*13)%5); top=v===0?pal[1]:(v===3?tint(pal[0],1.06):pal[0]); }
  const P=quadV(vx,vy,vx+1,vy+1,z);
  const nR=wcell(vx+1,vy), nD=wcell(vx,vy+1);
  const lv=c=>isMade(c[0],c[1])?hh[I(c[0],c[1])]:-1;
  const dR=z-lv(nR), dD=z-lv(nD);
  if(dR>0) poly([P[1],P[2],[P[2][0],P[2][1]+dR*HZ*zoom],[P[1][0],P[1][1]+dR*HZ*zoom]],pal[1]);
  if(dD>0) poly([P[2],P[3],[P[3][0],P[3][1]+dD*HZ*zoom],[P[2][0],P[2][1]+dD*HZ*zoom]],pal[2]);
  poly(P,top);
  g.strokeStyle=t===WATER?'rgba(255,255,255,.03)':'rgba(0,0,0,.07)';g.lineWidth=1;g.stroke();
}
/* What came up the stairs, standing in the lane outside the east gate. */
function drawFoe(){
  if(!foe) return;
  const z=H(foe.x|0,foe.y|0), [sx,sy]=scr(foe.x,foe.y,z), zm=zoom;
  const pulse=0.25+Math.sin(tnow*2.6)*0.12;
  g.save(); g.globalAlpha=pulse; g.fillStyle='#c1483f';
  g.beginPath(); g.arc(sx,sy-12*zm,30*zm,0,7); g.fill(); g.restore();
  g.save(); g.globalAlpha=.32; g.fillStyle='#000';
  g.beginPath(); g.ellipse(sx,sy,9*zm,4*zm,0,0,7); g.fill(); g.restore();
  g.fillStyle='#7a3c33'; rr(sx-8*zm, sy-26*zm, 16*zm, 23*zm, 4*zm); g.fill();
  g.fillStyle='#e0c07a'; g.fillRect(sx-4*zm, sy-20*zm, 2.6*zm, 2.6*zm);
  g.fillRect(sx+1.6*zm, sy-20*zm, 2.6*zm, 2.6*zm);
  // a health bar, because the whole point is whether the guard is winning
  const w=26*zm, f=Math.max(0,foe.hp/foe.hpMax);
  g.fillStyle='rgba(10,8,14,.8)'; g.fillRect(sx-w/2, sy-34*zm, w, 4*zm);
  g.fillStyle=f>0.5?'#c1483f':'#e3b64a'; g.fillRect(sx-w/2, sy-34*zm, w*f, 4*zm);
  plate(sx, sy-44*zm, foe.name, '#f0b2aa', 11);
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
  if(labelShows(b)){
    const inN=people.filter(p=>p.inside===b).length;
    plate(lx, ly-wh-rh-16*zoom,
      labelFor(b)+(inN?'  \u00b7 '+inN:''),
      b.kind==='altar'?'#f0d98f':(BK[b.kind].home?'#cfc3b0':'#e8e0f0'), 10.5);
  }
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
/* Twenty plates reading "House" told you nothing. A house carries the name of the
   family under its roof instead, and only when you are close enough to care; the hall,
   the guild and the shops are worth naming at any distance. */
function houseName(b){
  if(!b.residents||!b.residents.length) return 'Empty';
  const c={}; let best='', n=0;
  for(const p of b.residents){ const k=p.last||''; if(!k) continue;
    c[k]=(c[k]||0)+1; if(c[k]>n){ n=c[k]; best=k; } }
  if(!best) return 'Empty';
  return BK[b.kind].noble ? 'House '+best : 'the '+best+'s';
}
function labelFor(b){
  const k=BK[b.kind];
  if(k.home||k.noble) return houseName(b);
  return k.n.replace('&amp;','&');
}
// a dwelling is only named up close; a place of business always is
const labelShows=b=>!(BK[b.kind].home) || zoom>1.45 || opened.has(b.id) ||
  (selected&&selected.home===b);

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
  const K=MKIND[m.kind]||MKIND.minion;
  const bg=m.boss?1.9:(K.sz/1.35);
  // a mage carries its own light, so you can tell at a glance what is shooting at you
  if(K.bolt&&m.awake){ const fl=0.20+Math.sin(tnow*3.1+m.x)*0.10;
    g.save();g.globalAlpha=fl;g.fillStyle=K.bolt;
    g.beginPath();g.arc(sx,y-8*z,16*z,0,7);g.fill();g.restore(); }
  if(m.boss){ const fl=0.25+Math.sin(tnow*2.4)*0.12;
    g.save();g.globalAlpha=fl;g.fillStyle=m.col;
    g.beginPath();g.arc(sx,y-10*z,34*z,0,7);g.fill();g.restore(); }
  g.fillStyle=m.flee?tint(m.col,0.55):(K.bolt?tint(m.col,0.82):m.col);
  rr(sx-5.4*z*bg,y-15*z*bg,10.8*z*bg,13*z*bg,3.4*z); g.fill();
  if(m.flee){ g.fillStyle='#cfc3a0'; g.font='700 '+(9*z).toFixed(1)+'px "Nunito Sans",sans-serif';
    g.textAlign='center'; g.fillText('!',sx,y-19*z*bg); }
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
  const routed=dmobs.filter(m=>m.flee).length;
  const label='Floor '+dfloor+'  \u00b7  '+th.n+'  \u00b7  '+dmobs.length+' still moving'+
    (routed?'  \u00b7  '+routed+' routed':'');
  const w2=g.measureText(label).width+28;
  g.fillStyle='rgba(10,8,16,.86)'; rr(CW/2-w2/2,14,w2,28,14); g.fill();
  g.strokeStyle='#4c4468'; g.lineWidth=1; g.stroke();
  g.fillStyle='#e8c88a'; g.fillText(label,CW/2,29);
  if(!activeRun){
    g.font='600 13px "Nunito Sans",sans-serif'; g.fillStyle='#8f86a6';
    g.fillText('No party is below. The guild forms one each morning.',CW/2,CH/2);
  }
  fxDraw(null,false);                       // the flat Keep gets the numbers too
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
/* Rebuilt every 3D frame from where the camera is looking. A watcher should be able
   to see that the town is alive without pressing anything: at 09:25 nearly everyone
   is indoors, and with solid models that is an empty street and a few specks. */
const autoOpen=new Set();
const isOpen=b=>xray||opened.has(b.id)||autoOpen.has(b.id);
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
  if(zoom>0.85&&labelShows(b)){
    const [lx,ly]=scr(b.x+b.w/2,b.y+b.d/2,z);
    const n=people.filter(p=>p.inside===b).length;
    plate(lx, ly-wh-30*zoom, labelFor(b)+(n?'  \u00b7 '+n:''), '#f3e4bd',10.5);
  }
}
function render(){
  autoOpen.clear();            // the flat view lifts roofs its own way
  if(scene!=='keep'&&fxg) fxg.clearRect(0,0,fxW,fxH);
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
      if(GEN[I(x,y)] && tree[I(x,y)]) drawTree(x,y);
      const b=bAt.get(x+','+y); if(b) drawBuilding(b);
      const g2=pb.get(x+','+y); if(g2) for(const p of g2) drawPerson(p);
      if(foe && (foe.x|0)===x && (foe.y|0)===y) drawFoe();
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
    const [kx,ky]=scr(tx0(49.5),ty0(19.5),6);
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
/* How long a game-day takes at 1x, in real seconds. It used to be 65 - a whole day
   in just over a minute, which is not a speed setting, it is a bug wearing one.

   The fix is one constant and it needs no retuning, which is the only reason it is
   safe. Every rate in this game is written per dt-unit and a dt-unit is 22 game-
   minutes by definition. Scaling dt uniformly changes how much real time a
   dt-unit takes and nothing else: needs still rise and fall the same amount across
   a game-day, a walker still covers the same 65 tiles of daylight, the errand
   budget still means what it says. Slowing the clock alone would have been the
   wrong fix - people would have kept walking at the same real-world speed and
   crossed four times as much ground in a day. */
const DAYSEC=240, MPS=1440/DAYSEC, DTSCALE=MPS/22;
function tick(ts){
  const raw=Math.min(0.05,(ts-last)/1000); last=ts;
  const dt=raw*speed*DTSCALE; tnow+=raw;
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
      const power=partyPower(r.party),
            danger=6+r.floor*2.15+dstir*1.6,
            roll=power+ri(0,14)-danger;
      if(roll<-7){ const v=pick(r.party); v.hp-=ri(4,11);
        if(v.hp<=0){ v.hp=0; v.away=false; r.party.splice(r.party.indexOf(v),1); KEEP.lost++;
          logMsg('<b>'+v.name+' '+v.last+'</b> fell on floor '+r.floor+'.','d');
          r.lostAny=true; bondLoss(r.party.concat([v]), v);
          bereave(v,'fell on floor '+r.floor); }
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
      needsTick(p,dt);
      if(p.outT>0) p.outT-=dt;          // how long they linger in the street
      if(p.bubbleT>0) p.bubbleT-=raw;
      if(p.hp<p.hpMax && rnd()<dt*0.03) p.hp=Math.min(p.hpMax,p.hp+1);
      if(!p.goal){
        const fo=errand(p);
        const out=fo||outing(p);
        if(out){
          if(p.inside){ const od=p.inside.door; p.x=od[0]+0.5; p.y=od[1]+0.5;
            p.inside=null; p.slot=null; }
          p.at=null;
          p.goal={x:out.x,y:out.y,b:null,forage:!!fo}; p.fld=fieldTo(out.x,out.y);
        }
        const dest=p.goal?null:schedule(p);
        if(dest){
          if(dest!==p.inside && p.inside){            // step back out to the doorway first
            const od=p.inside.door; p.x=od[0]+0.5; p.y=od[1]+0.5;
            p.inside=null; p.slot=null; p.at=null;
          } else if(dest!==p.at){ p.at=null; }         // keep the two in step
          const d=dest.door;
          p.goal={x:d[0],y:d[1],b:dest}; p.fld=fieldTo(d[0],d[1]);
        }
      }
      if(p.goal){
        const gx=p.goal.x+0.5, gy=p.goal.y+0.5;
        const dist=Math.hypot(gx-p.x,gy-p.y);
        if(dist<0.5){
          p.moving=false;
          /* `p.at` and `p.inside` used to fall out of step: stepping back out only
             cleared `p.at` when `p.inside` happened to be set, so once they diverged
             this branch never fired again and the person stood in the street all day
             with `inside` null. Nobody noticed until needs started keying off it —
             a tracked villager read `inside NONE` for eighteen consecutive hours.
             Arriving now always puts you inside, whatever `p.at` already said. */
          if(!p.goal.b){
            /* A place in the open. Nothing to go inside, nothing to stand in a
               slot for — just arriving, and what they came out for. */
            if(p.inside){ p.inside=null; p.slot=null; }
            p.at=null;
            if(p.goal.forage && !p.goal.got){ p.goal.got=1; foraged(p); }
          } else if(p.at!==p.goal.b || p.inside!==p.goal.b){
            p.at=p.goal.b;
            if(BK[p.at.kind].shop && p.age>=ADULT && p.gold>1) spendAt(p,p.at);
            const b=p.at;
            const used=new Set(people.filter(q=>q!==p&&q.inside===b&&q.slot!=null).map(q=>q.slot));
            let sl=0; while(sl<b.slots.length-1&&used.has(sl)) sl++;
            p.slot=sl; p.inside=b;
            p.x=b.slots[sl][0]; p.y=b.slots[sl][1];
          }
          if(rnd()<dt*0.3){ p.goal=null; }
        } else {
          const cx=p.x|0, cy=p.y|0;
          let bx=cx,by=cy,bd=p.fld?p.fld[I(cx,cy)]:-1;
          if(bd===undefined||bd<0){
            /* No flow value where they stand, so there is no direction to take and the
               goal gets dropped — then re-planned next frame to the same dead end. A
               tracked villager sat on one tile for a whole day this way, "moving:false,
               fld:yes", while the schedule cycled behind them. Nothing noticed because
               nothing depended on anyone actually arriving; market-day tax had quietly
               gone to zero. Step them to the nearest tile the field does cover. */
            let fx=-1, fy=-1, fb=1e9;
            for(let r=1;r<=3&&fx<0;r++)
              for(let oy=-r;oy<=r;oy++) for(let ox=-r;ox<=r;ox++){
                const nx=cx+ox, ny=cy+oy; if(!inB(nx,ny)) continue;
                const v=p.fld?p.fld[I(nx,ny)]:-1;
                if(v>=0&&v<fb){ fb=v; fx=nx; fy=ny; }
              }
            if(fx>=0){ p.x=fx+0.5; p.y=fy+0.5; }
            else p.goal=null;
          }
          else {
            for(let k=0;k<4;k++){
              const nx=cx+[1,-1,0,0][k], ny=cy+[0,0,1,-1][k];
              if(!inB(nx,ny))continue; const v=p.fld[I(nx,ny)];
              if(v>=0&&v<bd){bd=v;bx=nx;by=ny;}
            }
            const tx2=bx+0.5, ty2=by+0.5, vx=tx2-p.x, vy=ty2-p.y, m=Math.hypot(vx,vy)||1;
            const sp=(ty[I(cx,cy)]===ROAD?2.6:1.7)*(p.age<ADULT?1.1:1);
            /* Never step past the tile being walked to. With a large dt a step can
               be longer than the gap, and a walker then oscillates around their door
               forever without ever satisfying the arrival test - at a probe speed of
               70x it left seven people indoors out of sixty-nine, because nobody
               could land anywhere. Snapping to the target when the step would
               overshoot costs nothing and makes the sim behave the same at any
               speed, which is what makes it measurable. */
            const step=sp*dt;
            if(step>=m){ p.x=tx2; p.y=ty2; }
            else { p.x+=vx/m*step; p.y+=vy/m*step; }
            p.moving=true; p.f=(p.f||0)+dt;
            exploreFrom(p.x|0,p.y|0);   // the map grows where people go, and nowhere else
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
  bondTick();
  foeStep(dt);
  fxStep(raw);
  if(v3d) (scene==='keep'?renderKeep3D():render3D()); else render();
  if(((tnow*10)|0)%4===0){
    paintConsole();
    if(scene==='keep' && ((tnow*2)|0)!==lastRailTick){ lastRailTick=((tnow*2)|0); paintRail(); }
  }
  requestAnimationFrame(tick);
}
function newDay(){
  marketDay();
  storyDay();
  ECON.day=day;
  saveGame('day');
}

/* ===================== seasons, events and generations =====================
   The town had an economy and a population but nothing ever happened to it. This is
   the storyteller: a turning year, occasional trouble, and families that carry on. */
const SEASONS=[
  {n:'spring', grass:'#5f8f4a', field:'#8fae4e', leaf:0x4b8c3a, warm:0.06, harvest:0.8},
  {n:'summer', grass:'#6aa352', field:'#c2b055', leaf:0x357a38, warm:0.14, harvest:1.0},
  {n:'autumn', grass:'#7d8f44', field:'#c08f3c', leaf:0xa9682a, warm:0.00, harvest:1.7},
  {n:'winter', grass:'#8d9a94', field:'#9aa3a0', leaf:0x6b5f4a, warm:-0.14, harvest:0.3}
];
const SEASONLEN=7;                        // days; a year is four of these
let seasonI=0, yearN=1, weather='fair';
const season=()=>SEASONS[seasonI];

/* Things that happen TO Ashvale. Each returns a line for the chronicle. */
const EVENTS=[
  {n:'good harvest', when:s=>s==='autumn', w:5, go(){
    const g=ri(40,90); ECON.treasury+=g;
    return ['The harvest came in heavy. <b>'+g+' gold</b> to the vault.','g']; }},
  {n:'hard frost', when:s=>s==='winter', w:5, go(){
    const g=Math.min(ECON.treasury, ri(25,60)); ECON.treasury-=g;
    weather='bitter';
    return ['A hard frost. The hall spent <b>'+g+' gold</b> on firewood and grain.','d']; }},
  {n:'travelling fair', when:()=>true, w:3, go(){
    let spent=0; people.forEach(p=>{ if(p.age>=ADULT&&p.gold>6&&rnd()<0.5){
      const c=ri(2,7); p.gold-=c; spent+=c; } });
    ECON.treasury+=Math.round(spent*0.2);
    return ['A travelling fair came through. The town spent <b>'+spent+' gold</b> on it.','']; }},
  {n:'fever', when:s=>s!=='summer', w:2, go(){
    const ill=people.filter(p=>rnd()<0.18);
    ill.forEach(p=>{ p.hp=Math.max(1,p.hp-ri(1,4)); p.bubble='unwell'; p.bubbleT=20; });
    return ['A fever went through the lanes. <b>'+ill.length+'</b> took to their beds.','d']; }},
  {n:'bandits', when:()=>true, w:2, go(){
    const g=Math.min(ECON.treasury, ri(30,80)); ECON.treasury-=g;
    const guards=people.filter(p=>p.guard);
    guards.forEach(p=>{ p.hp=Math.max(1,p.hp-ri(1,5)); });
    return ['Bandits took the east road and <b>'+g+' gold</b> with them. The guard gave chase.','d']; }},
  {n:'a good year for the guild', when:()=>true, w:2, go(){
    const g=ri(30,70); ECON.treasury+=g;
    return ['The guild paid its dues in full: <b>'+g+' gold</b>.','g']; }},
  {n:'a breach', when:()=>true, w:3, go(){
    if(foe||rnd()>breachOdds()) return ['The watch reported nothing from the gate.',''];
    openBreach();
    return ['The east gate is open and something is through it.','d']; }},
  {n:'the Keep stirs', when:()=>true, w:1, go(){
    dstir=(dstir||0)+1;
    return ['Something turned over down in the Keep. The ground felt it.','m']; }}
];
/* ===================== the Keep bites back =====================
   The hole in the ground was pure profit: parties went down, gold came up, and pushing to
   floor forty cost the town nothing. Now the depth has a price. What the guild rouses
   down there sometimes follows it home, and the guard - who until now only stood in the
   barracks - has to meet it at the east gate. */
let foe=null;
function breachOdds(){
  // shallow delving is safe; the deeper the town has pushed, the more it has woken
  return Math.min(0.42, Math.max(0, (KEEP.deepest-8)*0.012) + dstir*0.06);
}
function openBreach(){
  const f=Math.max(6, Math.min(100, KEEP.deepest));
  const hp=26+f*3.4;
  foe={ name:monsterFor(f), art:artFor(f), kind:'brute',
        hp, hpMax:hp, dmg:1.1+f*0.17, floor:f, t:0, took:0,
        x:theGate.x+theGate.w/2, y:theGate.y+theGate.d+0.6 };
  dstir=Math.max(0,dstir-1);                  // it came up; that much pressure is spent
  logMsg('<b>'+foe.name+'</b> came up the stairs and out the east gate.','d');
  annal('breach','<b>'+foe.name+'</b> broke out of the Keep.');
  snd('boss',1.2);
  fxWord(foe.x, foe.y, foe.name, '#ff8a5a', H(foe.x|0,foe.y|0)*HU);
}
/* The guard meets it, and any adventurer who happens to be in town joins in. Resolved
   as a trade of blows every couple of seconds, the way an off-screen delve is. */
function foeStep(dt){
  if(!foe) return;
  foe.t+=dt; if(foe.t<2.0) return; foe.t=0;
  const def=people.filter(p=>(p.guard||p.adventurer)&&!p.away&&p.hp>1&&p.age>=ADULT);
  if(!def.length){
    // nobody to stand in its way
    const g=Math.min(ECON.treasury, ri(8,22)); ECON.treasury-=g; foe.took+=g;
    const v=pick(people.filter(p=>!p.away));
    if(v){ v.hp=Math.max(1,v.hp-ri(1,3)); v.bubble='run'; v.bubbleT=6; }
    if(foe.took>90){ logMsg('<b>'+foe.name+'</b> had its fill and went back down.','d'); foe=null; }
    return;
  }
  const power=def.reduce((a,p)=>a+1.4+p.lvl*0.8+(p.gift?p.gift.power:0)+(p.guard?1.1:0),0);
  foe.hp-=power*0.55;
  fxBurst(foe.x,foe.y,'#ffc98a',6,1.8,2.0,H(foe.x|0,foe.y|0)*HU);
  // it answers
  const v=pick(def);
  v.hp-=foe.dmg*(0.6+rnd()*0.8);
  if(v.hp<=0){
    logMsg('<b>'+v.name+' '+v.last+'</b> was killed at the gate by '+foe.name+'.','d');
    bereave(v,'was killed at the east gate by '+foe.name);
    snd('die',1);
  } else { v.bubble='fight'; v.bubbleT=4; }
  if(foe.hp<=0){
    const bounty=Math.round(foe.floor*6+30); ECON.treasury+=bounty;
    logMsg('<b>'+foe.name+'</b> was put down at the gate. <b>'+bounty+' gold</b> in bounty.','g');
    annal('breach','<b>'+foe.name+'</b> was put down at the east gate.');
    fxWord(foe.x,foe.y,foe.name+' is dead','#ffcf7a',H(foe.x|0,foe.y|0)*HU);
    snd('cleared',0.9);
    foe=null;
  }
}

const hex6=n=>'#'+(n>>>0).toString(16).padStart(6,'0');
/* the ground, the crops and the canopy all turn with the year */
function applySeason(){
  const s=season();
  const g=parseInt(s.grass.slice(1),16), f=parseInt(s.field.slice(1),16);
  TC[GRASS]=[s.grass, hex6(shd(g,0.88)), hex6(shd(g,0.74))];
  TC[FIELD]=[s.field, hex6(shd(f,0.88)), hex6(shd(f,0.74))];
  C3[GRASS]=g; C3[FIELD]=f;
  if(R3){
    recolourGround(R3);
    if(R3.leaves) R3.leaves.material.color.setHex(s.leaf);
  }
}
let dstir=0, lastEvent=-9;
function storyDay(){
  // the turning year
  if(day>1 && (day-1)%SEASONLEN===0){
    seasonI=(seasonI+1)%4; weather='fair';
    if(dstir>0) dstir--;              // whatever woke down there settles again
    if(seasonI===0){ yearN++; birthdays();
      logMsg('<b>Spring of year '+yearN+'.</b> Ashvale begins again.','g'); }
    else logMsg('<b>'+season().n.replace(/^./,c=>c.toUpperCase())+'</b> came to Ashvale.','');
    applySeason(); snd('season',0.6); scoreUpdate();
  }
  // something happens, but not every day
  if(day-lastEvent>=4 && rnd()<0.34){
    const pool=EVENTS.filter(e=>e.when(season().n));
    let total=pool.reduce((n,e)=>n+e.w,0), r=rnd()*total, hit=pool[0];
    for(const e of pool){ r-=e.w; if(r<=0){ hit=e; break; } }
    const out=hit.go(); lastEvent=day;
    logMsg(out[0], out[1]);
  }
  marriages();
  births();
}
/* one birthday a year for everyone: coming of age, and growing old */
function birthdays(){
  let came=0;
  people.slice().forEach(p=>{
    p.age++;
    if(p.age===ADULT){
      p.child=false; p.work=null; came++;
      if(rnd()<0.3){ p.adventurer=true; p.work=theGuild; p.trade='adventurer';
        p.hpMax=13; p.hp=13; p.gear=[pick(['arming sword','shortbow'])];
      } else p.trade=pick(TRADES);
      annal('age','<b>'+p.name+' '+p.last+'</b> came of age'+
        (p.adventurer?' and signed the guild roll':' as a '+p.trade)+'.');
      remember(p,'age','Came of age'+(p.adventurer?' and signed the guild roll':
        ' and took up '+p.trade)+'.');
    }
    // the old go quietly, and more often the older they are
    if(p.age>62 && rnd() < (p.age-62)*0.035){
      logMsg('<b>'+p.name+' '+p.last+'</b> died at '+p.age+'.','d');
      bereave(p,'died of old age');
    }
  });
  if(came) logMsg('<b>'+came+'</b> came of age this spring.','');
}
/* two unrelated adults, both unwed, both of the town */
function marriages(){
  if(rnd()>0.22) return;
  const single=people.filter(p=>p.age>=18&&p.age<60&&!p.spouse&&!p.away&&!p.dead);
  const men=single.filter(p=>p.sex==='m'), women=single.filter(p=>p.sex==='f');
  if(!men.length||!women.length) return;
  const a=pick(men), b=pick(women);
  if(a.last===b.last) return;                      // not within a house
  if(a.parents.includes(b)||b.parents.includes(a)) return;
  a.spouse=b; b.spouse=a;
  a.bubble='wed'; a.bubbleT=30; b.bubble='wed'; b.bubbleT=30;
  // she joins his household unless his is full
  const home=(a.home&&a.home.residents.length<=b.home.residents.length)?a.home:b.home;
  [a,b].forEach(p=>{
    if(p.home===home) return;
    if(p.home) p.home.residents=p.home.residents.filter(q=>q!==p);
    p.home=home; home.residents.push(p);
  });
  logMsg('<b>'+a.name+' '+a.last+'</b> and <b>'+b.name+' '+b.last+
    '</b> were married at the altar.','g');
  annal('wed','<b>'+a.name+' '+a.last+'</b> married <b>'+b.name+' '+b.last+'</b>.');
  remember(a,'wed','Married <b>'+b.name+'</b> at the altar.');
  remember(b,'wed','Married <b>'+a.name+'</b> at the altar.');
  snd('wed',0.7);
}
function births(){
  if(rnd()>0.16) return;
  const mothers=people.filter(p=>p.sex==='f'&&p.spouse&&p.age>=18&&p.age<42
    &&!p.away&&!p.dead&&p.kids.length<4);
  if(!mothers.length) return;
  if(people.length>150) return;                    // the town has its limits
  const mum=pick(mothers), dad=mum.spouse;
  const boy=rnd()<0.5;
  const kid=mkPerson({ name:boy?pick(MNAME):pick(FNAME), last:dad.last,
    sex:boy?'m':'f', age:0, child:true,
    skin:pick([mum.skin,dad.skin]), hair:pick([mum.hair,dad.hair]), top:pick(TOPC),
    home:mum.home, gift:gift(mum.gift||dad.gift?0.45:0.18), gold:0,
    parents:[dad,mum] });
  mum.kids.push(kid); dad.kids.push(kid);
  if(mum.home) mum.home.residents.push(kid);
  kid.x=mum.x; kid.y=mum.y; kid.tx=kid.x; kid.ty=kid.y;
  logMsg('<b>'+kid.name+' '+kid.last+'</b> was born to '+mum.name+' and '+dad.name+'.','g');
  annal('born','<b>'+kid.name+' '+kid.last+'</b> born to '+mum.name+' and '+dad.name+'.');
  remember(mum,'born','<b>'+kid.name+'</b> was born.');
  remember(dad,'born','<b>'+kid.name+'</b> was born.');
  snd('born',0.6);
}

/* ===================== saving the town =====================
   The map, the buildings and their layouts all come from a fixed seed, so none of that
   needs storing - only what has happened since. Everything here is best-effort: storage
   throws in a private window, comes back empty when site data is cleared, and is per
   viewer per browser. A failed save is logged once and never blocks the sim. */
const SAVEKEY='ashvale.save.v1', SAVEVER=1;
let saveWarned=false, lastSave=0;

function store(){                           // may throw, may not exist at all
  try{ const s=window.localStorage; s.getItem(SAVEKEY); return s; }catch(e){ return null; }
}
const bid=b=>b?b.id:0;
const pid_=p=>p?p.id:0;

function snapshot(){
  return {
    v:SAVEVER, sd, day, hour, minute, seasonI, yearN, weather, dstir, lastEvent, pid,
    econ:Object.assign({},ECON),
    keep:{ deepest:KEEP.deepest, lost:KEEP.lost, gold:KEEP.gold,
           cleared:[...KEEP.cleared], history:KEEP.history.slice(0,12) },
    tills:buildings.map(b=>b.till||0),
    foe:foe?Object.assign({},foe):null,
    annals:ANNALS.slice(0,120), dead:DEAD.slice(0,80),
    logs:LOGS.slice(0,9),
    people:people.map(p=>({
      i:p.id, n:p.name, l:p.last, s:p.sex, a:p.age,
      sk:p.skin, hr:p.hair, tp:p.top,
      g:p.gold, sv:p.savings||0, hm:p.hpMax, h:p.hp, lv:p.lvl, xp:p.xp,
      tr:p.trade||'', gi:p.gift||null, ge:p.gear||[],
      rl:p.relics||null, rd:p.relicDmg||0, bo:p.bond||null, lg:(p.log||[]).slice(0,8),
      f:(p.child?1:0)|(p.adventurer?2:0)|(p.noble?4:0)|(p.guard?8:0)|(p.widowed?16:0),
      x:Math.round(p.x*100)/100, y:Math.round(p.y*100)/100,
      ho:bid(p.home), wk:bid(p.work), sp:pid_(p.spouse),
      kd:(p.kids||[]).map(pid_), pa:(p.parents||[]).map(pid_)
    }))
  };
}

function saveGame(why){
  const s=store(); if(!s) return false;
  try{
    s.setItem(SAVEKEY, JSON.stringify(snapshot()));
    lastSave=day; return true;
  }catch(e){
    if(!saveWarned){ saveWarned=true;
      logMsg('This browser will not keep a saved town (storage is blocked or full). '+
             'The sim runs normally, it just will not survive a reload.','d'); }
    return false;
  }
}

function loadGame(){
  const s=store(); if(!s) return false;
  let d; try{ const raw=s.getItem(SAVEKEY); if(!raw) return false; d=JSON.parse(raw); }
  catch(e){ return false; }
  if(!d||d.v!==SAVEVER||!Array.isArray(d.people)||!d.people.length) return false;
  try{
    sd=d.sd|0; day=d.day|0||1; hour=d.hour|0; minute=+d.minute||0;
    seasonI=Math.max(0,Math.min(3,d.seasonI|0)); yearN=d.yearN|0||1;
    weather=d.weather||'fair'; dstir=d.dstir|0; lastEvent=d.lastEvent|0; pid=d.pid|0||1;
    Object.assign(ECON, d.econ||{});
    KEEP.deepest=d.keep.deepest|0; KEEP.lost=d.keep.lost|0; KEEP.gold=d.keep.gold|0;
    KEEP.cleared=new Set(d.keep.cleared||[]); KEEP.history=d.keep.history||[];
    KEEP.runs.length=0; activeRun=null;
    buildings.forEach((b,i)=>{ b.till=(d.tills&&d.tills[i])||0;
      b.staff.length=0; b.residents.length=0; });
    people.length=0;
    const byId=new Map();
    d.people.forEach(r=>{
      const p={ id:r.i, name:r.n, last:r.l, sex:r.s, age:r.a|0,
        skin:r.sk, hair:r.hr, top:r.tp,
        gold:r.g|0, savings:r.sv|0, hpMax:r.hm|0||10, hp:r.h|0||1, lvl:r.lv|0||1, xp:r.xp|0,
        trade:r.tr, gift:r.gi, gear:r.ge||[], relics:r.rl||null, relicDmg:r.rd||0,
        bond:r.bo||null, log:r.lg||[],
        child:!!(r.f&1), adventurer:!!(r.f&2), noble:!!(r.f&4),
        guard:!!(r.f&8), widowed:!!(r.f&16),
        x:r.x, y:r.y, tx:r.x, ty:r.y, path:null, moving:false, fld:null, f:0,
        goal:null, at:null, inside:null, away:false, run:null,
        spouse:null, kids:[], parents:[], bubble:'', bubbleT:0,
        home:null, work:null, _ho:r.ho, _wk:r.wk, _sp:r.sp, _kd:r.kd||[], _pa:r.pa||[] };
      people.push(p); byId.set(p.id,p);
    });
    const bById=new Map(buildings.map(b=>[b.id,b]));
    people.forEach(p=>{
      p.home=bById.get(p._ho)||null; p.work=bById.get(p._wk)||null;
      p.spouse=byId.get(p._sp)||null;
      p.kids=p._kd.map(i=>byId.get(i)).filter(Boolean);
      p.parents=p._pa.map(i=>byId.get(i)).filter(Boolean);
      if(p.home) p.home.residents.push(p);
      if(p.work) p.work.staff.push(p);
      delete p._ho; delete p._wk; delete p._sp; delete p._kd; delete p._pa;
    });
    // a spouse who did not survive the round trip leaves a widow, not a dangling link
    people.forEach(p=>{ if(p.spouse&&p.spouse.spouse!==p){ p.spouse=null; p.widowed=true; } });
    LOGS.length=0; (d.logs||[]).forEach(l=>LOGS.push(l));
    foe=d.foe||null;
    ANNALS.length=0; (d.annals||[]).forEach(a=>ANNALS.push(a));
    DEAD.length=0; (d.dead||[]).forEach(a=>DEAD.push(a));
    applySeason();
    return true;
  }catch(e){ return false; }
}

function wipeSave(){
  const s=store(); if(!s) return;
  try{ s.removeItem(SAVEKEY); }catch(e){}
}
const hasSave=()=>{ const s=store(); if(!s) return false;
  try{ return !!s.getItem(SAVEKEY); }catch(e){ return false; } };

/* ===================== sound =====================
   The voices come from vendor/music.bundle.js - a snapshot of the owner's music-studio,
   plain Web Audio with no dependencies. Nothing here runs until the person asks for it:
   no AudioContext exists until they press the speaker, which is also the user gesture a
   browser requires before it will let anything make a noise. */
let actx=null, abus=null, sndOn=false, sndFail='';
const SNDKEY='ashvale.sound';
const SFXMAP={                       // game event -> the studio's catalogue
  hit      :['impact',     {intensity:0.55, pitch:0.5,  duration:0.22}],
  spell    :['shimmer',    {intensity:0.5,  pitch:0.68, duration:0.5 }],
  die      :['kill_sting', {intensity:0.7,  pitch:0.42, duration:0.9 }],
  chest    :['blip',       {intensity:0.5,  pitch:0.72, duration:0.16}],
  coin     :['combo_tick', {intensity:0.45, pitch:0.8,  duration:0.1 }],
  descend  :['riser',      {intensity:0.45, pitch:0.4,  duration:1.1 }],
  boss     :['sub_drop',   {intensity:0.8,  pitch:0.3,  duration:1.4 }],
  cleared  :['victory_fanfare',{intensity:0.6, pitch:0.6, duration:1.6}],
  wed      :['shimmer',    {intensity:0.42, pitch:0.85, duration:0.7 }],
  born     :['blip',       {intensity:0.4,  pitch:0.9,  duration:0.22}],
  death    :['death_fall', {intensity:0.5,  pitch:0.4,  duration:1.0 }],
  season   :['whoosh_up',  {intensity:0.35, pitch:0.55, duration:0.8 }]
};
let sndSeed=1, lastSnd=Object.create(null);

/* The score. The studio generates a whole project from a mood and a seed, so Ashvale
   picks the mood from where you are and how the year is going, and hands it over. */
let meng=null, mcur='';
function scoreWant(){
  if(scene==='keep'){
    const band=THEMES.findIndex(t=>dfloor<=t.to);
    return band>=2 ? 'hype' : 'lowkey';       // the deeps get loud, the caves stay quiet
  }
  const s=season().n;
  return (s==='spring'||s==='summer') ? 'playful' : 'lowkey';
}
function scoreUpdate(){
  if(!meng||!sndOn) return;
  const want=scoreWant(); if(want===mcur) return;
  mcur=want;
  try{
    meng.project=MUSIC.applyMood(MUSIC.newProject(), want, (seasonI+1)*7919+(scene==='keep'?31:0));
    meng.setMasterGain(-19);                  // the score sits well under the effects
    if(!meng.playing) meng.toggle();
  }catch(e){ /* a score that will not build must not take the sim with it */ }
}
function sndStart(){
  if(actx) return true;
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC||typeof MUSIC==='undefined'||!MUSIC.playSfx){ sndFail='no audio in this browser'; return false; }
    // One context for everything: the engine builds it synchronously, and the effects
    // ride on it, so "exactly one AudioContext" stays true.
    if(MUSIC.AudioEngine){
      meng=new MUSIC.AudioEngine();
      meng.startAudio();
      actx=meng.context;
    }
    if(!actx) actx=new AC();
    abus=actx.createGain(); abus.gain.value=0.5; abus.connect(actx.destination);
    return true;
  }catch(e){ sndFail='the browser refused an audio context'; actx=null; meng=null; return false; }
}
function snd(kind,gain){
  if(!sndOn||!actx||actx.state!=='running') return;
  const e=SFXMAP[kind]; if(!e) return;
  // a busy floor can ask for twenty hits in a frame; one every 70ms is plenty
  const now=actx.currentTime;
  if(lastSnd[kind]&&now-lastSnd[kind]<0.07) return;
  lastSnd[kind]=now;
  try{
    const g=actx.createGain(); g.gain.value=Math.max(0,Math.min(1.4,gain||1)); g.connect(abus);
    MUSIC.playSfx(actx, g, now+0.001, e[0], Object.assign({seed:(sndSeed=(sndSeed*48271)%2147483647)}, e[1]));
  }catch(err){ /* one bad effect must never stop the sim */ }
}
function sndSet(on){
  sndOn=!!on;
  if(sndOn){
    if(!sndStart()){ sndOn=false; logMsg('Sound could not start: '+sndFail+'.','d'); }
    else if(actx.state==='suspended') actx.resume().catch(()=>{});
    if(sndOn){ mcur=''; scoreUpdate(); }
  } else {
    try{ if(meng&&meng.playing) meng.stop(); }catch(e){}
    mcur='';
    if(actx && actx.state==='running') actx.suspend().catch(()=>{});
  }
  try{ localStorage.setItem(SNDKEY, sndOn?'1':'0'); }catch(e){}
  const b=document.getElementById('sndBtn');
  if(b){ b.classList.toggle('on',sndOn); b.textContent=sndOn?'♪ Sound':'♪ Muted';
         b.title=sndOn?'Mute':'Turn sound on'; }
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
          dmobs.filter(m=>m.awake&&!m.flee).length+' roused, '+dmobs.length+
          ' on the floor \u00b7 '+
          dchests.filter(c=>!c.open).length+' chests unopened'+
          (dmobs.some(m=>m.flee)
            ? '<br><b style="color:#cfc3a0">'+dmobs.filter(m=>m.flee).length+
              ' broke and ran</b>' : '')+
          (activeRun.state==='retreat'
            ? '<br><b style="color:#e59a93">Making for the stairs</b>' : '')+'</div>'+
          party.map(p=>{
            const st=styleOf(p)||'sword', S=PSTYLE[st]||PSTYLE.sword;
            const frac=Math.max(0,Math.min(1,p.hp/p.hpMax));
            const col=frac>0.6?'#6fae5a':frac>0.3?'#e3b64a':'#c1483f';
            // a caster who has run dry fights at a third strength; that has to be visible
            const charges=S.cast
              ? '<span class="mana'+(p.mana<S.cost?' dry':'')+'">'+
                '\u25cf'.repeat(Math.max(0,Math.floor(p.mana===undefined?4:p.mana)))+
                '\u25cb'.repeat(Math.max(0,4-Math.floor(p.mana===undefined?4:p.mana)))+'</span>'
              : '';
            const relics=(p.relics&&p.relics.length)
              ? '<span class="rel" title="'+esc(p.relics.map(r=>r.n).join(', '))+'">\u2726'+
                (p.relics.length>1?p.relics.length:'')+'</span>' : '';
            const hurt=p.shy?'<span class="shy" title="hanging back">\u2190</span>':'';
            return '<button class="delver'+(p.shy?' hurt':'')+'" data-who="'+p.id+'">'+
              '<span class="nm"><span class="c" style="background:'+p.top+'"></span>'+
                esc(p.name)+relics+hurt+'</span>'+
              '<span class="st '+st+'">'+st+'</span>'+charges+
              '<span class="hpn">'+Math.ceil(p.hp)+'/'+p.hpMax+'</span>'+
              '<span class="hpb"><i style="width:'+(frac*100).toFixed(0)+'%;background:'+col+'"></i></span>'+
            '</button>';
          }).join('')
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
        '<div class="places">'+
        [['guild','Guild'],['hall','Town Hall'],['school','School'],
         ['bank','Vault'],['guard','Barracks'],['altar','Altar'],
         ['tavern','Tavern'],['rose','Roses']]
        .map(([k,n])=>'<button class="tool" data-go="'+k+'"><span class="c" style="background:'+
          BK[k].roof+'"></span>'+n+'</button>').join('')+'</div>'+
        '<div class="tiny">Five shops line the market street, one family to each.</div>');
  }
  railEl.querySelectorAll('[data-grp] h4').forEach(h=>h.onclick=()=>{
    const id=h.parentElement.dataset.grp; railShut[id]=!railShut[id]; paintRail(); });
  railEl.querySelectorAll('[data-cam]').forEach(b=>b.onclick=()=>{
    const a=b.dataset.cam;
    const V=v3d&&(scene==='keep'?K3:R3);
    if(V){
      if(a==='l') V.th-=Math.PI/6; else if(a==='r') V.th+=Math.PI/6;
      else if(a==='in') V.dist=Math.max(5,V.dist/1.2);
      else if(a==='out') V.dist=Math.min(120,V.dist*1.2);
      else if(a==='c'){ userPanned=false;
        if(scene==='keep'){ V.dist=12; V.th=-2.3; V.ph=1.30; }
        else { V.tx=tx0(26); V.tz=ty0(23); V.dist=40; V.th=-2.25; V.ph=0.78; } }
      else if(a==='keep'&&scene!=='keep'){ V.tx=tx0(46); V.tz=ty0(21); V.dist=24; V.th=-2.6; V.ph=0.5; }
      paintRail(); return;
    }
    if(a==='l') rot=(rot+3)%4; else if(a==='r') rot=(rot+1)%4;
    else if(a==='in') zoom=Math.min(2.6,zoom*1.2);
    else if(a==='out') zoom=Math.max(0.4,zoom/1.2);
    else if(a==='c'){ follow=null; userPanned=false;
      if(scene==='keep'&&activeRun&&activeRun.party.length){
        const p=activeRun.party[0], v=vpt(p.dx,p.dy), f=flat(v[0],v[1],0); camX=f[0];camY=f[1];
      } else { const f=scene==='keep'?flat(DN/2,DN/2,0):flat(tx0(26),ty0(24),0); camX=f[0];camY=f[1]; } }
    else if(a==='keep'){ follow=null; const v=vpt(tx0(47),ty0(19)), f=flat(v[0],v[1],5); camX=f[0];camY=f[1]; }
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
  document.getElementById('sClock').textContent='Day '+day+' \u00b7 '+season().n+' y'+yearN+' \u00b7 '+
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
    document.getElementById('sClock').textContent='Day '+day+' \u00b7 '+season().n+' y'+yearN+' \u00b7 '+
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
    '<div class="sec"><h4>Who they trust</h4>'+bondList(p)+'</div>'+
    '<div class="sec"><h4>What they want</h4>'+needBars(p)+
      (p.why?'<div class="sum" style="margin-top:7px">Right now: <b>'+esc(p.why)+
        '</b></div>':'')+'</div>'+
    (p.log&&p.log.length
      ? '<div class="sec"><h4>What they remember</h4>'+recallOf(p)+'</div>'
      : '<div class="sec"><h4>What they remember</h4><div class="sum">'+
        'Nothing yet worth keeping.</div></div>')+
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
  document.getElementById('wName').textContent=labelFor(b);
  document.getElementById('wSub').textContent=
    (k.home||k.noble ? k.n.replace('&amp;','&')+' \u00b7 '+b.residents.length+' under this roof'
                     : 'A building of Ashvale')+
    ' \u00b7 ('+b.x+', '+b.y+')';
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
       :b.kind==='altar'?'Raised to the Pale Hour, a saint nobody can name. Townsfolk come by in the evening and leave a coin.'
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
/* ===================== the houses =====================
   The sim has been marrying people off and burying them for two cycles with nowhere to
   read any of it. This is that record: every household under its roof, and the annals. */
const SEASONNAME=i=>SEASONS[i]?SEASONS[i].n:'spring';
const whenOf=e=>SEASONNAME(e.s)+' of year '+e.y;

function houseOf(p){ return p.home; }
function showHouses(){
  const byHome=new Map();
  people.forEach(p=>{ const h=houseOf(p); if(!h) return;
    if(!byHome.has(h)) byHome.set(h,[]); byHome.get(h).push(p); });

  // a household reads best as its grown-ups first, then the children by age
  const rank=p=>(p.age<ADULT?2:0)-(p.noble?1:0);
  const households=[...byHome.entries()].map(([h,ps])=>{
    ps.sort((a,b)=>rank(a)-rank(b)||b.age-a.age);
    return {h, ps, name:ps[0]?ps[0].last:'—'};
  }).sort((a,b)=> (BK[b.h.kind].noble?1:0)-(BK[a.h.kind].noble?1:0)
                || a.name.localeCompare(b.name));

  const lineOf=p=>{
    const bits=[];
    if(p.age<ADULT) bits.push('age '+p.age);
    else bits.push(p.trade||'no trade');
    if(p.spouse) bits.push('married to '+esc(p.spouse.name));
    else if(p.widowed) bits.push('widowed');
    if(p.gift) bits.push(p.gift.school.toLowerCase());
    if(p.away) bits.push('below');
    return '<button class="kinrow" data-who="'+p.id+'">'+
      '<span class="sw" style="background:'+p.top+'"></span>'+
      '<b>'+esc(p.name)+'</b><em>'+bits.join(' · ')+'</em></button>';
  };

  const live='<div class="sec"><h4>'+households.length+' households</h4>'+
    households.map(g=>'<div class="house">'+
      '<h5>'+esc(g.name)+(BK[g.h.kind].noble?' <span class="nob">of the manor</span>':'')+
        '<span class="at">'+esc(BK[g.h.kind].n.replace('&amp;','&'))+'</span></h5>'+
      g.ps.map(lineOf).join('')+'</div>').join('')+'</div>';

  const dead=DEAD.length
    ? '<div class="sec"><h4>Gone before · '+DEAD.length+'</h4>'+
      DEAD.slice(0,40).map(d=>'<div class="gone"><b>'+esc(d.n+' '+d.l)+'</b>'+
        '<em>'+esc(d.how)+', aged '+d.a+' · '+whenOf(d)+'</em></div>').join('')+
      (DEAD.length>40?'<div class="tiny">and '+(DEAD.length-40)+' more.</div>':'')+'</div>'
    : '<div class="sec"><h4>Gone before</h4><div class="sum">Nobody has been buried yet.</div></div>';

  const ann=ANNALS.length
    ? '<div class="sec"><h4>The annals</h4>'+
      ANNALS.slice(0,50).map(e=>'<div class="ann '+e.k+'"><em>'+whenOf(e)+'</em>'+e.t+'</div>').join('')+
      '</div>'
    : '<div class="sec"><h4>The annals</h4><div class="sum">Nothing has happened yet worth '+
      'writing down. Weddings, births and deaths are recorded here as they come.</div></div>';

  document.getElementById('hSub').textContent =
    people.length+' living · '+DEAD.length+' buried · '+
    SEASONNAME(seasonI)+' of year '+yearN;
  document.getElementById('hBody').innerHTML = ann + live + dead;
  document.getElementById('hBody').querySelectorAll('[data-who]').forEach(b=>{
    b.onclick=()=>{ const q=people.find(x=>x.id===+b.dataset.who);
      if(q){ closePanel('houses'); showPerson(q); openPanel('who'); } };
  });
  openPanel('houses');
}

document.getElementById('keepBtn').onclick=showKeep;
const hb=document.getElementById('housesBtn'); if(hb) hb.onclick=showHouses;
(function(){ const sb=document.getElementById('sndBtn'); if(!sb) return;
  sb.onclick=()=>sndSet(!sndOn);
  // Off by default. Only a person who turned it on before gets it back, and even then
  // the context is not created until this click, because browsers require a gesture.
  let was=false; try{ was=localStorage.getItem(SNDKEY)==='1'; }catch(e){}
  sb.textContent=was?'\u266a Sound off \u00b7 click':'\u266a Muted';
  sb.title=was?'You had sound on last time - click to start it':'Turn sound on';
})();
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
const R3TEX={};
const C3={}; C3[GRASS]=0x5f8f4a; C3[ROAD]=0x9a9183; C3[PLAZA]=0xb0a692;
C3[WATER]=0x3a73b8; C3[DIRT]=0x9c8565; C3[FIELD]=0xb19a52; C3[ROCK]=0x7d7a84;
const hx=c=>typeof c==='string'?parseInt(c.replace('#',''),16):c;
const shd=(c,f)=>((Math.min(255,((c>>16)&255)*f)|0)<<16)|((Math.min(255,((c>>8)&255)*f)|0)<<8)|
  (Math.min(255,(c&255)*f)|0);
/* ===================== the ground, a chunk at a time =====================
   One geometry over the whole made world was fine while the world was the town.
   Now that it grows wherever somebody walks, a single mesh meant rebuilding every
   acre ever made each time one new chunk appeared, and again on every season
   change. The ground is now one mesh per chunk under a group.

   A season turns colours, not shapes, so the two are split: chunkGeo builds the
   buffers, chunkRecolour rewrites the colour attribute in place. Both drive the
   same walk, because two loops that each decide how many quads a cell needs are
   two chances to disagree, and the first disagreement would paint every colour
   after it onto the wrong vertex. */
const s2l=c=>c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);
function chunkWalk(cx,cy,quad){
  const lev=(x,y)=>{ if(!isMade(x,y)) return -0.6;
    const i=I(x,y); return ty[i]===WATER? -0.34 : hh[i]*HU; };
  const x0=cx*CSZ, y0=cy*CSZ;
  for(let y=y0;y<y0+CSZ;y++)for(let x=x0;x<x0+CSZ;x++){
    if(!inB(x,y)||!GEN[I(x,y)]) continue;
    const i=I(x,y), t=ty[i], h0=lev(x,y);
    let c=C3[t]; const n=((x*7+y*13)^(x*3+y*11))%7;
    if(n===0) c=shd(c,0.965); else if(n===4) c=shd(c,1.035);
    quad([x,h0,y],[x+1,h0,y],[x+1,h0,y+1],[x,h0,y+1],c);
    const dE=h0-lev(x+1,y), dS=h0-lev(x,y+1);
    if(dE>0.004) quad([x+1,h0,y],[x+1,h0-dE,y],[x+1,h0-dE,y+1],[x+1,h0,y+1],shd(c,0.76));
    if(dS>0.004) quad([x,h0,y+1],[x+1,h0,y+1],[x+1,h0-dS,y+1],[x,h0-dS,y+1],shd(c,0.60));
  }
}
let geoBuilds=0, geoRecolours=0;
function chunkGeo(cx,cy){
  const pos=[],col=[],idx=[],uv=[]; let v=0;
  // UVs come from world position, so one tiling texture runs across the whole map
  // and a quad's grain lines up with its neighbour's, chunk border or not.
  chunkWalk(cx,cy,(a,b,c2,d,cl)=>{
    const r=s2l(((cl>>16)&255)/255), g2=s2l(((cl>>8)&255)/255), b2=s2l((cl&255)/255);
    for(const q of [a,b,c2,d]){ pos.push(q[0],q[1],q[2]); col.push(r,g2,b2);
      uv.push(q[0]*0.5,q[2]*0.5); }
    idx.push(v,v+2,v+1,v,v+3,v+2); v+=4;
  });
  if(!v) return null;
  const G=new THREE.BufferGeometry();
  G.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  G.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  G.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  G.setIndex(idx); G.computeVertexNormals(); return G;
}
function chunkRecolour(cx,cy,G){
  const a=G.getAttribute('color'); let i=0;
  chunkWalk(cx,cy,(p1,p2,p3,p4,cl)=>{
    const r=s2l(((cl>>16)&255)/255), g2=s2l(((cl>>8)&255)/255), b2=s2l((cl&255)/255);
    for(let k=0;k<4;k++) a.setXYZ(i++,r,g2,b2);
  });
  a.needsUpdate=true; geoRecolours++;
}
/* Build or rebuild only the chunks that need it. A chunk's edge quads are drawn
   against its neighbours' heights, so land appearing next door changes the old
   chunk's lip too - which is why ensureChunk dirties the four neighbours and not
   just the new chunk. Five chunks, not the whole world. */
function syncGround(S){
  if(!S.gGroup) return;
  for(const key of chunkDirty){
    const cx=key%CN, cy=(key/CN)|0;
    const old=S.chunks.get(key);
    if(old){ S.gGroup.remove(old); old.geometry.dispose(); S.chunks.delete(key); }
    const G=chunkGeo(cx,cy); if(!G) continue;
    geoBuilds++;
    const m=new THREE.Mesh(G,R3TEX.groundMat);
    m.receiveShadow=true; S.gGroup.add(m); S.chunks.set(key,m);
  }
  chunkDirty.clear();
}
function recolourGround(S){
  if(!S||!S.chunks) return;
  for(const [key,m] of S.chunks) chunkRecolour(key%CN,(key/CN)|0,m.geometry);
}
function mkBuilding(b){
  const k=BK[b.kind], G=new THREE.Group(), base=H(b.x,b.y)*HU;
  const w=b.w-0.16, d=b.d-0.16, wh=k.ht*0.082;
  const walls=new THREE.Mesh(new THREE.BoxGeometry(w,wh,d),
    new THREE.MeshStandardMaterial({color:hx(k.col),roughness:0.93,metalness:0}));
  walls.castShadow=walls.receiveShadow=true; G.add(walls);
  const rh=Math.max(w,d)*(k.shrine?0.85:0.40);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*0.73,rh,4),
    new THREE.MeshStandardMaterial({color:hx(k.roof),roughness:0.74,metalness:0}));
  roof.rotation.y=Math.PI/4; roof.castShadow=true; G.add(roof);
  const sill=new THREE.Group(), glass=new THREE.MeshBasicMaterial({color:0xffd98a});
  [[-1,0],[1,0],[0,-1],[0,1]].forEach(a=>{
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w*0.2,wh*0.3),glass);
    m.position.set(b.x+b.w/2+a[0]*(w/2+0.015), base+wh*0.6, b.y+b.d/2+a[1]*(d/2+0.015));
    m.rotation.y=a[0]?a[0]*Math.PI/2:(a[1]>0?0:Math.PI); sill.add(m); });
  G.add(sill);
  const inner=new THREE.Group(); inner.visible=false;
  const fl=new THREE.Mesh(new THREE.BoxGeometry(w,0.08,d),
    new THREE.MeshStandardMaterial({color:0x9a6f42,roughness:0.9,metalness:0}));
  fl.position.set(b.x+b.w/2,base+0.05,b.y+b.d/2); fl.receiveShadow=true; inner.add(fl);
  (b.furn||[]).forEach(it=>{ const F=FURN[it.f], fh=F.h*0.05;
    const proto=ASSETS.furn[it.f];
    if(proto){
      const m2=proto.clone(true);
      const bb=new THREE.Box3().setFromObject(m2), sz=bb.getSize(new THREE.Vector3());
      const big=Math.max(sz.x,sz.z)||1;
      const sc=Math.min(0.95/big, 1.1/(sz.y||1));
      m2.scale.setScalar(sc);
      m2.position.set(b.x+it.x+0.5, base+0.09-bb.min.y*sc, b.y+it.y+0.5);
      m2.rotation.y=((it.x*7+it.y*13)%4)*Math.PI/2;
      m2.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
      inner.add(m2);
    } else {
    const m=new THREE.Mesh(new THREE.BoxGeometry(F.w*0.9,fh,F.d*0.9),
      new THREE.MeshStandardMaterial({color:hx(F.c),roughness:0.85,metalness:0}));
    m.position.set(b.x+it.x+0.5, base+0.09+fh/2, b.y+it.y+0.5);
    m.castShadow=true; inner.add(m); }
    if(F.fire||F.glow){ const L=new THREE.PointLight(F.fire?0xff8a34:hx(F.glow),1.1,5.5);
      L.position.set(b.x+it.x+0.5, base+0.7, b.y+it.y+0.5); inner.add(L); } });
  G.add(inner);
  walls.position.set(b.x+b.w/2, base+wh/2, b.y+b.d/2);
  roof.position.set(b.x+b.w/2, base+wh+rh/2, b.y+b.d/2);
  G.userData={building:b,walls,roof,inner,sill,wh,base,rh};
  return G;
}
/* A person is about 0.8 units tall against buildings of three or four. The scale
   is right; the problem is that at the distance a watcher sits, 0.8 units is a few
   pixels. So each person stands on a small disc that grows with camera distance -
   the figure keeps its true size, and what reads from far away is the mark beneath
   it. One geometry and one material per colour, shared across the whole town. */
const DISCG=new THREE.CircleGeometry(0.30,14);
const DISCM={};
function discMat(col,op){
  const k=col+'|'+op;
  if(!DISCM[k]) DISCM[k]=new THREE.MeshBasicMaterial({color:col,transparent:true,
    opacity:op,depthWrite:false});
  return DISCM[k];
}
const FOLKS=1.25;                       // a little larger, still shorter than a door
function mkFolk3(p3){
  const G=new THREE.Group(), s=(p3.age<ADULT?0.7:1)*FOLKS;

  const body=new THREE.Mesh(new THREE.BoxGeometry(0.30*s,0.40*s,0.22*s),
    new THREE.MeshStandardMaterial({color:hx(p3.top),roughness:0.9,metalness:0}));
  body.position.y=0.34*s; body.castShadow=true; G.add(body);
  const legs=new THREE.Mesh(new THREE.BoxGeometry(0.22*s,0.26*s,0.18*s),
    new THREE.MeshStandardMaterial({color:0x2b2738,roughness:0.9,metalness:0}));
  legs.position.y=0.13*s; G.add(legs);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.145*s,10,8),
    new THREE.MeshStandardMaterial({color:hx(p3.skin),roughness:0.72,metalness:0}));
  head.position.y=0.655*s; head.castShadow=true; G.add(head);
  const hair=new THREE.Mesh(new THREE.SphereGeometry(0.152*s,10,6,0,Math.PI*2,0,Math.PI*0.62),
    new THREE.MeshStandardMaterial({color:hx(p3.hair),roughness:0.8,metalness:0}));
  hair.position.y=0.662*s; G.add(hair);
  if(p3.gift){ const w=new THREE.Mesh(new THREE.SphereGeometry(0.075,8,6),
      new THREE.MeshBasicMaterial({color:hx(p3.gift.col)}));
    w.position.set(0.2,0.78*s,0); G.add(w); }
  G.userData={person:p3,body,s}; return G;
}
function rebuildFolk(S){
  if(typeof SKINS!=='undefined') SKINS.clear();
  while(S.pG.children.length) S.pG.remove(S.pG.children[0]);
  if(!S.dG){ S.dG=new THREE.Group(); S.scene.add(S.dG); }
  while(S.dG.children.length) S.dG.remove(S.dG.children[0]);
  people.forEach(p3=>{ if(p3.dead) return;
    const m=mkFolk3(p3); p3.m3=m; S.pG.add(m);
    /* The mark lives in its own layer, not on the figure: `updateSkins` hides a
       person's whole procedural group the moment it gives them a real model, and
       that is everyone near the camera. A disc parented to it was never drawn. */
    const d=new THREE.Mesh(DISCG,discMat(0x14111f,0.34));
    d.rotation.x=-Math.PI/2; p3.d3=d; S.dG.add(d);
  });
  S.folk=people.length;
}
/* Swap the procedural cones for real trees, and scatter a few props, once the
   models have arrived. Clones share geometry and material, so this is cheap. */
/* The town's models, and the country's. Two bugs lived here.

   `ty.fill(ROCK)` at boot makes every cell outside the authored town ROCK, and
   the boulder pass walked the whole grid looking for ROCK - so 2,785 boulders
   stood scattered across land that does not exist, up to 53 tiles beyond the
   made world. Nothing showed it while the void rendered near-black; the moment
   c39 made the sky bright they were a field of grey blocks hanging over nothing.
   Everything placed here is now gated on `isMade`.

   And this ran once, removing the procedural tree instances as it went, so any
   country generated afterwards had no trees of either kind. It is re-entrant
   now: `dressedAt` marks a cell done, and regrow3D dresses whatever is new. */
function dressPut(S,proto,x,y,want,rot){
  if(!proto) return;
  const m=proto.clone(true);
  fitModel(m,0,0,true);
  const b=new THREE.Box3().setFromObject(m), sz=b.getSize(new THREE.Vector3());
  const big=Math.max(sz.x,sz.y,sz.z)||1, sc=want/big;
  m.scale.setScalar(sc);
  m.position.set(x, H(x|0,y|0)*HU - b.min.y*sc, y);
  m.rotation.y=rot||0;
  m.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  S.grove.add(m);
}
function dressCell(S,x,y,kinds){
  const i=I(x,y);
  if(!GEN[i]||S.dressedAt[i]) return 0;
  S.dressedAt[i]=1;
  if(tree[i]){
    const proto=kinds[(x*3+y*7)%kinds.length];
    const m=proto.clone(true);
    fitModel(m,0,0,true);
    const b=new THREE.Box3().setFromObject(m), sz=b.getSize(new THREE.Vector3());
    const want=2.6+((x*5+y*11)%7)*0.22;
    const sc=sz.y>0.01?want/sz.y:1;
    m.scale.setScalar(sc);
    m.position.set(x+0.5, H(x,y)*HU - b.min.y*sc, y+0.5);
    m.rotation.y=((x*13+y*29)%360)*Math.PI/180;
    m.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
    S.grove.add(m);
    return 1;
  }
  if(ty[i]===ROCK){
    const h=((x*17+y*29)%100)/100;
    if(h>0.86) dressPut(S,ASSETS.props.rock, x+0.5, y+0.5, 1.5+h, h*6.3);
  }
  return 0;
}
const dressKinds=()=>[ASSETS.props.tree,ASSETS.props.tree2,ASSETS.props.tree3].filter(Boolean);
/* Land appeared after the models were in. Only made, undressed cells are touched. */
function dressNew(S){
  if(!S.dressed) return 0;
  const kinds=dressKinds(); if(!kinds.length) return 0;
  const b=genBounds(); let n=0;
  for(let y=b.y0;y<=b.y1;y++)for(let x=b.x0;x<=b.x1;x++) n+=dressCell(S,x,y,kinds);
  return n;
}
function dressTown(S){
  if(S.dressed||!ASSETS.props.tree) return;
  S.dressed=true;
  S.dressedAt=new Uint8Array(N*N);
  if(S.trunks){ S.scene.remove(S.trunks); S.scene.remove(S.leaves); }
  const kinds=dressKinds();
  const grove=new THREE.Group(); S.scene.add(grove); S.grove=grove;
  let i=0;
  const b=genBounds();
  for(let y=b.y0;y<=b.y1;y++)for(let x=b.x0;x<=b.x1;x++) i+=dressCell(S,x,y,kinds);
  // a well on the plaza, a mill out by the fields
  let plaza=null;
  for(let y=b.y0;y<=b.y1&&!plaza;y++)for(let x=b.x0;x<=b.x1;x++)
    if(isMade(x,y)&&ty[I(x,y)]===PLAZA&&!occ[I(x,y)]){ plaza=[x,y]; break; }
  if(plaza) dressPut(S,ASSETS.props.well, plaza[0]+0.5, plaza[1]+0.5, 1.6, 0.4);
  let field=null;
  for(let y=b.y1;y>=b.y0&&!field;y--)for(let x=b.x0;x<=b.x1;x++)
    if(isMade(x,y)&&ty[I(x,y)]===FIELD&&!occ[I(x,y)]){ field=[x,y]; break; }
  if(field) dressPut(S,ASSETS.props.mill, field[0]+0.5, field[1]+0.5, 4.2, 2.2);
  return i;
}
function init3D(){
  if(R3) return R3;
  if(typeof THREE==='undefined'){ v3d=false; return null; }
  cv3=document.getElementById('view3d'); if(!cv3) return null;
  /* Every hex in this file was picked by eye, which means it is sRGB. Until now
     three was handing those numbers to the shader as if they were linear light and
     writing the result straight out, which is why the roofs read as poster paint and
     the ground as washed-out olive. Turn colour management on, output sRGB, and put
     a filmic curve on the end so highlights roll off instead of clipping. */
  THREE.ColorManagement.enabled=true;
  const renderer=new THREE.WebGLRenderer({canvas:cv3,antialias:true});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=0.85;
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const S3=new THREE.Scene(); S3.fog=new THREE.Fog(0x1b1830,46,165);
  const cam=new THREE.PerspectiveCamera(44,1,0.4,520);
  S3.add(new THREE.AmbientLight(0xffffff,0.06));
  const hemi=new THREE.HemisphereLight(0xbcd8ff,0x47402f,0.30); S3.add(hemi);
  const sun=new THREE.DirectionalLight(0xffeccf,2.4);   // render3D resets this every frame; see LIT
  sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.bias=-0.0015;
  const sc=sun.shadow.camera; sc.left=-32; sc.right=32; sc.top=32; sc.bottom=-32;
  sc.near=1; sc.far=190; S3.add(sun); S3.add(sun.target);
  const groundMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.97,metalness:0});
  R3TEX.groundMat=groundMat;
  const gGroup=new THREE.Group(); S3.add(gGroup);
  /* A unit plane fitted to the made world each time it grows. Sized to the whole
     grid it turned every unmade acre into open sea, which read as an island and
     disagreed with the flat view, where unmade ground is simply nowhere. */
  const water=new THREE.Mesh(new THREE.PlaneGeometry(1,1),
    new THREE.MeshStandardMaterial({color:0x3a73b8,transparent:true,opacity:0.8,roughness:0.38,metalness:0.0,depthWrite:false}));
  water.rotation.x=-Math.PI/2; S3.add(water);
  const R3TMP=mkTrees(S3);
  const bG=new THREE.Group(); S3.add(bG);
  buildings.forEach(b=>{ const m=mkBuilding(b); b.m3=m; bG.add(m); });
  const pG=new THREE.Group(); S3.add(pG);
  const keepGlow=new THREE.PointLight(0xc1483f,2,24);
  keepGlow.position.set(tx0(46),2.6,ty0(21)); S3.add(keepGlow);
  R3={renderer,scene:S3,cam,sun,hemi,water,bG,pG,keepGlow,
      gGroup, chunks:new Map(),
      trunks:R3TMP.trunks, leaves:R3TMP.leaves,
      th:-2.25,ph:0.78,dist:40,tx:tx0(26),ty:0.6,tz:ty0(23),folk:0};
  /* The town's sixteen chunks were made at module load, not through ensureChunk,
     so nothing dirtied them. Seed every chunk that exists. */
  for(let k=0;k<CN*CN;k++) if(CHGEN[k]) chunkDirty.add(k);
  syncGround(R3); fitWater(R3); rebuildFolk(R3); resize3D(); loadAssets(R3);
  if(ASSETS.props.tree) dressTown(R3);
  return R3;
}
/* The tree instances are a fixed-size buffer, so a world that grew needs them
   rebuilt rather than appended to. Counts only made ground. */
function mkTrees(S3,leafCol){
  let tn=0; for(let i=0;i<N*N;i++) if(tree[i]&&GEN[i]) tn++;
  if(!tn) return {};
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07,0.11,0.55,5),
    new THREE.MeshStandardMaterial({color:0x55401f,roughness:0.95,metalness:0}),tn);
  const leaves=new THREE.InstancedMesh(new THREE.ConeGeometry(0.44,1.05,7),
    new THREE.MeshStandardMaterial({color:leafCol||0x357a38,roughness:0.88,metalness:0}),tn);
  trunks.castShadow=leaves.castShadow=true; leaves.receiveShadow=true;
  const M=new THREE.Matrix4(); let ti=0;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){ const i=I(x,y);
    if(!tree[i]||!GEN[i]) continue;
    const b=hh[i]*HU;
    M.makeTranslation(x+0.5,b+0.27,y+0.5); trunks.setMatrixAt(ti,M);
    M.makeTranslation(x+0.5,b+1.0,y+0.5); leaves.setMatrixAt(ti,M); ti++; }
  S3.add(trunks); S3.add(leaves);
  return {trunks,leaves};
}
/* Land appeared while the scene was already up. */
function fitWater(S){
  if(!S.water) return;
  const b=genBounds();
  S.water.scale.set((b.x1-b.x0+1)+4, (b.y1-b.y0+1)+4, 1);
  /* The terrain's own water cells sit at -0.34. At -0.2 the sheet was close
     enough to fight them for depth, which flat shading hid and a specular
     highlight did not: the river broke into white shards. */
  S.water.position.set((b.x0+b.x1+1)/2, -0.14, (b.y0+b.y1+1)/2);
}
function regrow3D(S){
  syncGround(S);
  fitWater(S);
  dressNew(S);              // trees and boulders for the country that just appeared
  const leafCol=S.leaves?S.leaves.material.color.getHex():undefined;
  [S.trunks,S.leaves].forEach(m=>{ if(m){ S.scene.remove(m);
    m.geometry.dispose(); m.material.dispose(); } });
  const t=mkTrees(S.scene,leafCol); S.trunks=t.trunks; S.leaves=t.leaves;
}
function resize3D(){ if(!cv3) return;
  const r=cv3.getBoundingClientRect();
  const w=Math.max(280,Math.floor(r.width)), h=Math.max(200,Math.floor(r.height));
  const ren=(R3&&R3.renderer)||(K3&&K3.renderer); if(ren) ren.setSize(w,h,false);
  [R3,K3].forEach(S=>{ if(S&&S.cam){ S.cam.aspect=w/h; S.cam.updateProjectionMatrix(); } }); }
/* The day cycle rewrites the sun and the hemisphere every frame from the clock,
   so the intensities handed to the constructors never survive a tick. These are the
   knobs that actually reach a pixel. */
/* Chosen by comparing five looks in one browser run, judged on the pictures.
   A strong key and a quiet fill: the old balance was a weak sun against a loud
   hemisphere, which under a filmic curve reads as milk. */
const LIT={sun:1.9, hemi:0.55};
function render3D(){
  const S=init3D(); if(!S){ render(); return; }
  if(worldDirty){ worldDirty=false; regrow3D(S); }
  if(S.folk!==people.length) rebuildFolk(S);
  const t=(hour*60+minute)/1440, ang=(t-0.25)*Math.PI*2;
  const el=Math.sin(ang), az=Math.cos(ang);
  const dayAmt=Math.max(0,Math.min(1,el*1.7+0.34));
  S.sun.position.set(tx0(26)+az*72,Math.max(3,el*66),ty0(23)-46);
  S.sun.target.position.set(tx0(26),0,ty0(23)); S.sun.target.updateMatrixWorld();
  S.sun.intensity=(0.16+dayAmt*1.05)*LIT.sun;
  S.sun.color.setHex(el<0.26?0xffb27a:0xffeccf);
  S.hemi.intensity=(0.14+dayAmt*0.48)*LIT.hemi;
  const sw=season().warm;
  S.sun.intensity*=1+sw*0.9;
  S.hemi.color.setHex(sw<-0.05?0xd8e6f4:(sw>0.1?0xbcd8ff:0xc8dcf0));
  const sky=new THREE.Color(0x141226).lerp(new THREE.Color(0x8fc0e8),dayAmt);
  S.scene.background=sky; S.scene.fog.color=sky;
  S.scene.fog.near=weather==='bitter'?22:46; S.scene.fog.far=weather==='bitter'?92:165;
  S.water.material.opacity=0.68+0.14*dayAmt;
  /* Lift the roofs of whatever the camera is right on top of, and nothing more.
     A wider radius was tried and measured well - 71% of the town visible instead of
     1% - and looked far worse: a building that opens hides its model and shows a
     roofless stub, so the whole town became flat slabs and lost its silhouette.
     The numbers went up and the thing got worse, which is what happens when the
     only instrument is a counter.

     So this is the close-in look-inside gesture only. Making the town read as alive
     at the distance you actually watch from is not a rendering problem: 96% of the
     population is indoors at every hour of the day. That is the sim's to fix. */
  autoOpen.clear();
  const aR=S.dist<24 ? 10 : 0;
  if(aR>1){ const r2=aR*aR;
    for(const b of buildings){
      const dx=b.x+b.w/2-S.tx, dz=b.y+b.d/2-S.tz;
      if(dx*dx+dz*dz<r2) autoOpen.add(b.id);
    } }
  /* Worked out once a frame rather than once a person. */
  const ovKey = overlay!=='none' ? overlay : null;
  const ovCol = ({magic:0x8f6fe0,adv:0xc1483f,child:0xe3b64a,noble:0xd2c4a4,work:0x6fae5a})[overlay]||0xffffff;
  const ovTest = !ovKey ? null : (overlay==='magic' ? (q=>!!q.gift)
    : overlay==='adv'   ? (q=>!!q.adventurer)
    : overlay==='child' ? (q=>q.age<ADULT)
    : overlay==='noble' ? (q=>!!q.noble)
    : overlay==='work'  ? (q=>!!(q.at&&q.work&&q.at===q.work))
    : (()=>false));
  // the mark grows as the camera pulls back, so a person stays findable
  const discS=Math.max(1,Math.min(4.2,0.55+S.dist*0.045));
  const lamps=(hour>=18||hour<6);
  buildings.forEach(b=>{ const u=b.m3&&b.m3.userData; if(!u) return;
    const op=isOpen(b);
    if(u.model){
      // a real model stands in for the whole building; opening it puts the model away
      // and shows the furniture, the same gesture as lifting a procedural roof
      u.model.visible=!op;
      u.roof.visible=false; u.walls.visible=op; u.sill.visible=false;
      u.inner.visible=op;
      u.walls.scale.y=op?0.3:1;
      u.walls.position.y=u.base+(op?u.wh*0.15:u.wh/2);
      return;
    }
    u.roof.visible=!op; u.inner.visible=op; u.sill.visible=lamps&&!op;
    u.walls.scale.y=op?0.3:1;
    u.walls.position.y=u.base+(op?u.wh*0.15:u.wh/2); });
  people.forEach(p3=>{ const m=p3.m3; if(!m) return;
    if(p3.dead||p3.away||(p3.inside&&!isOpen(p3.inside))){ m.visible=false; return; }
    m.visible=true;
    m.position.set(p3.x,H(p3.x|0,p3.y|0)*HU,p3.y);
    const bob=p3.moving?Math.abs(Math.sin((p3.f||0)*9))*0.045:0;
    m.userData.body.position.y=(0.34+bob)*m.userData.s;
    m.rotation.y=p3===selected?tnow*1.6:0;
    /* The rail's highlight filters only ever worked in the flat view. Here the disc
       carries them: whoever matches is marked in the filter's own colour, everyone
       else loses their mark, so the answer to "which of these is a child" is legible
       from across the town. */
  });
  /* The marks, once per person and independent of whether they are a box or a
     model. The rail's highlight filters only ever worked in the flat view; here
     the disc carries them, so "which of these is a child" is answerable from
     across the town. */
  for(const q of people){
    const d=q.d3; if(!d) continue;
    const shown=!q.dead&&!q.away&&!(q.inside&&!isOpen(q.inside));
    if(!shown){ d.visible=false; continue; }
    if(ovKey&&!ovTest(q)){ d.visible=false; continue; }
    d.visible=true;
    d.position.set(q.x,H(q.x|0,q.y|0)*HU+0.03,q.y);
    /* A filtered mark has to carry across a downscaled stream feed, so it is
       bold and larger. The unfiltered one is a faint shadow that says "someone is
       here" without turning the town into a field of dots. */
    d.scale.setScalar(ovKey?discS*1.45:discS);
    d.material = ovKey ? discMat(ovCol,0.82)
      : (q===selected ? discMat(0xe3b64a,0.9) : discMat(0x14111f,0.34));
  }
  const d3t=Math.max(0,Math.min(0.1,tnow-(S.last||tnow))); S.last=tnow;
  updateSkins(S,d3t);
  if(theAltar && tnow-(S.altarT||0)>0.55){ S.altarT=tnow;      // motes over the shrine
    fxBurst(theAltar.x+theAltar.w/2, theAltar.y+theAltar.d/2, '#d6c7ff', 2, 0.35, 0.9,
      H(theAltar.x,theAltar.y)*HU+1.4); }
  S.keepGlow.intensity=1.5+Math.sin(tnow*1.8)*0.55;
  const cx=S.tx+Math.cos(S.th)*Math.cos(S.ph)*S.dist;
  const cy=S.ty+Math.sin(S.ph)*S.dist;
  const cz=S.tz+Math.sin(S.th)*Math.cos(S.ph)*S.dist;
  S.cam.position.set(cx,cy,cz); S.cam.lookAt(S.tx,S.ty,S.tz);
  S.renderer.render(S.scene,S.cam);
  fxDraw(S.cam,false);
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
  if(!v3d) resize();                      // measure now, not on the observer's next tick
  const hintEl=document.getElementById('hint'); if(hintEl&&v3d) hintEl.remove();
  ['scTown','scKeep','sc3D'].forEach(id=>{ const e=document.getElementById(id);
    if(e) e.classList.toggle('on', id==='sc3D'?v3d:scene===(id==='scTown'?'town':'keep')); });
  if(v3d){ const S=(scene==='keep'?initKeep3D():init3D()); if(S){ resize3D(); }
    else { v3d=false; cv.style.display='';
    logMsg('The 3D view could not start: this browser has no WebGL.','bad'); } }
  paintRail(); paintConsole();
}
const cur3D=()=>v3d?(scene==='keep'?K3:R3):null;
function wire3D(){
  const c2=document.getElementById('view3d'); if(!c2) return;
  new ResizeObserver(resize3D).observe(c2);
  let d3=null, m3=0;
  c2.addEventListener('contextmenu',e=>e.preventDefault());
  c2.addEventListener('pointerdown',e=>{ c2.setPointerCapture(e.pointerId);
    const V=cur3D();
    d3={x:e.clientX,y:e.clientY,th:V?V.th:0,ph:V?V.ph:0,
        tx:V?V.tx:0,tz:V?V.tz:0,pan:e.button===2||e.shiftKey}; m3=0; });
  c2.addEventListener('pointermove',e=>{ const V=cur3D(); if(!d3||!V) return;
    const dx=e.clientX-d3.x, dy=e.clientY-d3.y;
    m3=Math.max(m3,Math.hypot(dx,dy));
    if(d3.pan){ const s=V.dist*0.0024; userPanned=true;
      const fx=-Math.cos(V.th), fz=-Math.sin(V.th), rx=Math.sin(V.th), rz=-Math.cos(V.th);
      V.tx=d3.tx-(dx*rx+dy*fx)*s; V.tz=d3.tz-(dx*rz+dy*fz)*s; }
    else { V.th=d3.th+dx*0.006;
      const lo=scene==='keep'?0.80:0.12;
      V.ph=Math.max(lo,Math.min(1.48,d3.ph+dy*0.005)); } });
  const up=e=>{ if(d3&&m3<5&&!d3.pan&&scene!=='keep'){ const r=c2.getBoundingClientRect();
      const h=pick3D(e.clientX-r.left,e.clientY-r.top);
      if(h&&h.person) showPerson(h.person);
      else if(h&&h.building){ if(opened.has(h.building.id)) opened.delete(h.building.id);
        else opened.add(h.building.id); showBuilding(h.building); }
      else { selected=null; paintConsole(); } }
    d3=null; };
  c2.addEventListener('pointerup',up);
  c2.addEventListener('pointercancel',()=>{d3=null;});
  c2.addEventListener('wheel',e=>{ e.preventDefault(); const V=cur3D(); if(!V) return;
    V.dist=Math.max(5,Math.min(120,V.dist*(e.deltaY<0?1/1.12:1.12))); },{passive:false});
}

/* ===================== optional assets =====================
   Everything here is additive. With no models/manifest.json the game stays exactly
   as it was: procedural boxes and cones, no errors, no console noise. The artifact
   bundle has no models/ to fetch, so it simply never leaves the procedural path. */
const ASSETS={ base:'models/', on:false, buildings:{}, chars:{}, mobs:{}, props:{},
  weapons:{}, dung:{}, furn:{},
  shared:[], slots:{},
  named:null, roles:{}, cap:20, tried:false };
/* Every adventurer fights a particular way, and it decides both what they look like
   and which clips they move with. Stable per person, so nobody changes mid-delve. */
const STYLES=['sword','bow','axe'];
function styleOf(p){
  if(!p.adventurer) return '';
  if(p.gift) return 'staff';
  return STYLES[(p.id*7+3)%STYLES.length];
}
const STYLEPFX={bow:'bow', sword:'sword', axe:'axe', staff:'staff'};
/* The party had one way of fighting between them. styleOf() was already choosing a
   model and a set of clips; now it chooses how they fight, the way MKIND does for mobs. */
const PSTYLE={
  sword:{ reach:1.15, cd:0.85, dmg:1.00 },
  axe  :{ reach:1.25, cd:1.55, dmg:1.95 },                 // one heavy swing, slowly
  bow  :{ reach:6.5,  cd:1.00, dmg:0.85, ranged:true, shaft:'#e8d9a8',
          smother:1.8, smotherM:0.35 },                    // useless with a mob on top of you
  staff:{ reach:5.0,  cd:1.30, dmg:1.35, ranged:true, cast:true, cost:1, regen:0.22 }
};
const pstyle=p=>PSTYLE[styleOf(p)]||PSTYLE.sword;

function roleOf(p){
  if(p.age<ADULT) return 'child';
  if(p.adventurer) return styleOf(p)||'adventurer';
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
const CLIPWORDS={ idle:['idle','breathing','stand'], walk:['walk','flying','fly','slither','hop'],
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
      // Photographic ground. The texture multiplies with the vertex colour that already
      // carries the season, so a tiling surface appears without losing the turning year.
      if(m.textures){
        const TL=new THREE.TextureLoader();
        Object.entries(m.textures).forEach(([key,file])=>{
          jobs.push(new Promise(res=>TL.load(ASSETS.base+file, t=>{
            t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4;
            t.encoding=THREE.sRGBEncoding;     // albedo, not data
            R3TEX[key]=t;
            // the town's ground material is already on screen; the rest are read when a
            // Keep floor is built, so they only need to be in the cache
            if(key==='ground'&&R3TEX.groundMat){
              R3TEX.groundMat.map=t; R3TEX.groundMat.needsUpdate=true; }
            res(null);
          }, undefined, ()=>res(null))));
        });
      }
      Object.entries(m.buildings||{}).forEach(([kind,file])=>
        jobs.push(get(file).then(g=>{ if(g) swapBuilding(S,kind,g.scene); })));
      Object.entries(m.weapons||{}).forEach(([kind,file])=>
        jobs.push(get(file).then(g=>{ if(g) ASSETS.weapons[kind]=g.scene; })));
      Object.entries(m.furniture||{}).forEach(([kind,file])=>
        jobs.push(get(file).then(g=>{ if(g) ASSETS.furn[kind]=g.scene; })));
      Object.entries(m.dungeon||{}).forEach(([kind,file])=>
        jobs.push(get(file).then(g=>{ if(g) ASSETS.dung[kind]=g.scene; })));
      Object.entries(m.props||{}).forEach(([kind,file])=>
        jobs.push(get(file).then(g=>{ if(g) ASSETS.props[kind]=g.scene; })));
      Object.entries(m.mobs||{}).forEach(([kind,file])=>
        jobs.push(get(file).then(g=>{
          if(!g) return;
          let mx=false;
          g.scene.traverse(o=>{ if(o.isBone&&normBone(o.name).indexOf('mixamorig')===0) mx=true; });
          ASSETS.mobs[kind]={scene:g.scene, clips:g.animations||[], mixamo:mx};
        })));
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
      ASSETS.on = Object.keys(ASSETS.chars).length>0 || Object.keys(ASSETS.buildings).length>0
                  || Object.keys(ASSETS.mobs).length>0 || Object.keys(ASSETS.props).length>0;
      if(ASSETS.props.tree&&R3) dressTown(R3);
      if(Object.keys(ASSETS.furn).length&&R3){       // refit interiors with real furniture
        while(R3.bG.children.length) R3.bG.remove(R3.bG.children[0]);
        buildings.forEach(b=>{ const m2=mkBuilding(b); b.m3=m2; R3.bG.add(m2); });
        Object.entries(ASSETS.buildings).forEach(([k,proto])=>swapBuilding(R3,k,proto));
      }
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
    o.frustumCulled=false;
    o.material=o.material.clone();   // so a flash is this body's alone
  } });
  const want=p.age<ADULT?1.05:1.45;
  // Both measures fail, in opposite directions. A skinned mesh's Box3 is computed in bind
  // space and can read far too SMALL (three's Xbot says 0.018 for a 1.78 rig). The skeleton
  // is honest about the bones but stops at the skull, so a big-headed stylised character
  // like KayKit's reads short and gets blown up. Take whichever is larger.
  const span=rigSpan(inner);
  let h=0, foot=0;
  const bb=new THREE.Box3().setFromObject(inner), bs=bb.getSize(new THREE.Vector3());
  const boxH=(isFinite(bs.y)&&bs.y>0.05)?bs.y:0;
  const boneH=span?span.h:0;
  if(boxH>=boneH){ h=boxH; foot=bb.min.y; } else { h=boneH; foot=span.lo; }
  let sc = h>0.0005 ? want/h : 1;
  sc = Math.max(0.02, Math.min(60, sc));           // never let a bad measure make a giant
  inner.scale.setScalar(sc);
  inner.position.y = -foot*sc;                     // stand them on the ground
  const grp=new THREE.Group(); grp.add(inner);
  // Mixamo ships the motion but not the prop, so a swordsman mimes an empty swing.
  // Parent a real weapon to the hand bone instead.
  const st=styleOf(p), wp=st&&ASSETS.weapons[st];
  if(wp){
    let hand=null;
    const HANDS=['handslotr','mixamorigrighthand','handr'];
    for(const want of HANDS){
      inner.traverse(o=>{ if(!hand&&o.isBone&&normBone(o.name)===want) hand=o; });
      if(hand) break;
    }
    if(hand){
      const w=wp.clone(true);
      w.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
      hand.add(w);                       // the slot bone is authored for exactly this
    }
  }
  return {grp, root:inner, own:C.clips, mixamo:!!C.mixamo,
          pfx:STYLEPFX[styleOf(p)]||'',
          mixer:new THREE.AnimationMixer(inner), actions:{}, cur:null};
}
const ONESHOT={die:1, attack:1, cast:1, cast_big:1, hit:1, nod:1, talk:1, gs_cast:1};
function actionFor(sk,slot){
  if(slot in sk.actions) return sk.actions[slot];
  // A model's OWN clips win. They were authored for its rig, so they always bind; the
  // shared Mixamo set only fits models that carry Mixamo's skeleton, and forcing it onto
  // a foreign rig (three's Soldier, say) folds the character into a spread-eagled mess.
  const c = (sk.pfx && pickClip(sk.own, sk.pfx+'_'+slot, ASSETS.named))
            || pickClip(sk.own,slot,ASSETS.named)
            || (sk.pfx && ASSETS.slots[sk.pfx+'_'+slot])
            || ASSETS.slots[slot]
            || pickClip(ASSETS.shared,slot,ASSETS.named)
            || null;
  const r = c ? retarget(c,sk.root) : null;
  let a = r ? sk.mixer.clipAction(r) : null;
  if(a&&ONESHOT[slot]){ a.loop=THREE.LoopOnce; a.clampWhenFinished=true; }
  sk.actions[slot]=a;
  return a;
}
/* what somebody is visibly doing, in clip terms */
function makeMobSkin(mo){
  const K=MKIND[mo.kind]||MKIND.minion;
  const C=(mo.art&&ASSETS.mobs[mo.art])
        || ASSETS.mobs[mo.boss?'boss':K.model]
        || ASSETS.mobs.default; if(!C) return null;
  // a boss grows with the depth it guards: the Pitmaster is big, the Dragon fills the room
  const inner=THREE.skeletonClone(C.scene);
  inner.traverse(o=>{ if(o.isMesh||o.isSkinnedMesh){ o.castShadow=true; o.frustumCulled=false;
    o.material=o.material.clone();   // so a flash is this body's alone
  } });
  const BEAST={rat:0.75, bat:0.8, spider:1.0, slime:0.85, snake_angry:1.1,
               wasp:0.9, frog:0.95, dragon:2.4};
  const base=(mo.art&&BEAST[mo.art]!==undefined)?BEAST[mo.art]:K.sz;
  const want = mo.boss ? base*1.5 + Math.min(1.6, dfloor*0.018) : base;
  const span=rigSpan(inner);
  const bb=new THREE.Box3().setFromObject(inner), bs=bb.getSize(new THREE.Vector3());
  const boxH=(isFinite(bs.y)&&bs.y>0.05)?bs.y:0, boneH=span?span.h:0;
  let h, foot;
  if(boxH>=boneH){ h=boxH; foot=bb.min.y; } else { h=boneH||1.7; foot=span?span.lo:0; }
  let sc=Math.max(0.02,Math.min(60, want/h));
  inner.scale.setScalar(sc); inner.position.y=-foot*sc;
  const grp=new THREE.Group(); grp.add(inner);
  return {grp, root:inner, own:C.clips, mixamo:!!C.mixamo,
          mixer:new THREE.AnimationMixer(inner), actions:{}, cur:null};
}
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
/* If a rig has nothing for a slot, walk down to something it does have, rather than
   leaving the character frozen in its bind pose. */
const FALLBACK={ guard_idle:'idle', sit:'idle', sit_talk:'sit', drunk:'idle', pray:'idle',
  sleep:'idle', run:'walk', walk_f:'walk', idle_f:'idle', run_f:'run', attack:'idle',
  block:'idle', hit:'idle', die:'idle', cast:'idle', cast_big:'cast', farm:'idle',
  haul:'walk', carry_idle:'idle', talk:'idle', nod:'idle' };
function playClip(sk,slot){
  if(sk.cur===slot) return;
  let want=slot, nxt=null, guard=0;
  while(want&&!(nxt=actionFor(sk,want))&&guard++<6) want=FALLBACK[want];
  if(!nxt) return;                                  // nothing at all; stay as we are
  slot=want;
  if(sk.cur===slot) return;
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
    fxApplyFlash(sk,dt);
    sk.mixer.update(dt);
  });
}

/* ===================== the effects layer =====================
   World-space events - damage taken, a death, a chest forced - are pushed onto FX and
   drawn on a 2D canvas above whichever view is running. That way one implementation
   serves the flat Keep and the 3D one, and none of it needs an asset. */
const FX=[];
let fxc=null, fxg=null;
function fxNum(x,y,n,col,big,base){
  FX.push({k:'n', w:base===undefined?'keep':'town', x, y, b:base||0, z:1.0, t:0, life:big?1.5:1.05, vy:big?1.5:1.15,
    txt:(n<1?'1':String(Math.round(n))), col:col||'#ffe9b0', big:!!big});
}
function fxWord(x,y,txt,col,base){
  FX.push({k:'n', w:base===undefined?'keep':'town', x, y, b:base||0, z:1.3, t:0, life:1.8, vy:0.9, txt,
    col:col||'#e8c88a', big:true});
}
function fxBurst(x,y,col,n,spread,up,base){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, s=spread*(0.35+Math.random());
    FX.push({k:'p', w:base===undefined?'keep':'town', x, y, b:base||0,
      z:0.5+Math.random()*0.5, t:0,
      life:0.4+Math.random()*0.45,
      vx:Math.cos(a)*s, vy:Math.sin(a)*s, vz:(up||1.6)*(0.4+Math.random()),
      col, r:1.4+Math.random()*2.2});
  }
}
function fxStep(dt){
  for(let i=FX.length-1;i>=0;i--){
    const f=FX[i]; f.t+=dt;
    if(f.t>=f.life){ FX.splice(i,1); continue; }
    if(f.k==='p'){ f.x+=f.vx*dt; f.y+=f.vy*dt; f.z+=f.vz*dt; f.vz-=5.4*dt; }
    else f.z+=f.vy*dt;
  }
}
function fxResize(){
  if(!fxc) fxc=document.getElementById('fx');
  if(!fxc) return null;
  const r=fxc.getBoundingClientRect();
  const w=Math.max(2,Math.floor(r.width)), h=Math.max(2,Math.floor(r.height));
  if(fxc.width!==w*dpr||fxc.height!==h*dpr){
    fxc.width=w*dpr; fxc.height=h*dpr; fxc.style.width=w+'px'; fxc.style.height=h+'px'; }
  if(!fxg) fxg=fxc.getContext('2d');
  fxg.setTransform(dpr,0,0,dpr,0,0);
  return [w,h];
}
/* project a dungeon coordinate to the screen, whichever view is on */
function fxProject(f,cam){
  if(cam){ const v=new THREE.Vector3(f.x, (f.b||0)+f.z*0.75, f.y).project(cam);
    if(v.z>1) return null;
    return [(v.x*0.5+0.5)*fxW, (-v.y*0.5+0.5)*fxH, 1]; }
  const p=scr(f.x,f.y,f.z*0.6);
  return [p[0],p[1],zoom];
}
let fxW=0, fxH=0;
function fxDraw(cam,vignette){
  const sz=fxResize(); if(!sz) return;
  fxW=sz[0]; fxH=sz[1];
  fxg.clearRect(0,0,fxW,fxH);
  if(vignette){
    const g2=fxg.createRadialGradient(fxW*0.5,fxH*0.46,Math.min(fxW,fxH)*0.30,
      fxW*0.5,fxH*0.5,Math.max(fxW,fxH)*0.76);
    g2.addColorStop(0,'rgba(0,0,0,0)'); g2.addColorStop(1,'rgba(0,0,0,0.55)');
    fxg.fillStyle=g2; fxg.fillRect(0,0,fxW,fxH);
  }
  if(!FX.length) return;
  fxg.save();
  fxg.textAlign='center'; fxg.textBaseline='middle';
  const here=scene==='keep'?'keep':'town';
  for(const f of FX){
    if(f.w!==here) continue;             // a chest forced underground is not town news
    const pr=fxProject(f,cam); if(!pr) continue;
    const k=f.t/f.life, fade=k<0.1?k/0.1:(1-k)/1;
    if(f.k==='p'){
      fxg.globalAlpha=Math.max(0,Math.min(1,fade));
      fxg.fillStyle=f.col;
      fxg.beginPath(); fxg.arc(pr[0],pr[1],f.r*Math.max(0.5,pr[2]*0.9),0,6.3); fxg.fill();
    } else {
      fxg.globalAlpha=Math.max(0,Math.min(1,fade));
      // the family MUST be quoted: an unquoted two-word family makes the whole font
      // string invalid, and the canvas silently keeps its 10px default
      const s=(f.big?26:20)*Math.max(0.6,Math.min(1.7,pr[2]));
      fxg.font='700 '+s.toFixed(0)+'px '+(f.big?'"Cinzel",Georgia,serif'
                                               :'"Nunito Sans",system-ui,sans-serif');
      fxg.lineWidth=Math.max(2,s*0.22); fxg.strokeStyle='rgba(8,6,14,0.85)';
      fxg.strokeText(f.txt,pr[0],pr[1]); fxg.fillStyle=f.col;
      fxg.fillText(f.txt,pr[0],pr[1]);
    }
  }
  fxg.restore();
}
/* a struck body goes white for a moment */
function fxFlash(sk){ if(sk) sk.flash=0.22; }
function fxLoot(x,y,gold){ snd('chest',0.7); fxBurst(x,y,'#f0cd62',14,1.8,2.2);
  fxWord(x,y,'+'+gold+' gold','#f0cd62'); }
function fxApplyFlash(sk,dt){
  if(sk.flash===undefined) return;
  if(sk.flash<=0){ if(sk.flash!==0){ sk.flash=0; fxSetEmissive(sk,0); } return; }
  sk.flash-=dt;
  fxSetEmissive(sk, Math.max(0,sk.flash)/0.22);
}
function fxSetEmissive(sk,amt){
  sk.root.traverse(o=>{ if((o.isMesh||o.isSkinnedMesh)&&o.material&&o.material.emissive){
    o.material.emissive.setRGB(amt*0.9, amt*0.85, amt*0.8); } });
}

/* ===================== the Keep, in three dimensions ===================== */
const KSKINS=new Map();
const MSKINS=new Map();
const WALLH=1.95;      // low enough to see over from a steep angle
let K3=null, k3floor=-1;
function dungeonGeo(th){
  const fp=[],fc=[],fi=[]; let fv=0;
  const wp=[],wc=[],wi=[]; let wv=0;
  const hx2=c=>parseInt(c.slice(1),16);
  const sh=(c,f)=>((Math.min(255,((c>>16)&255)*f)|0)<<16)|((Math.min(255,((c>>8)&255)*f)|0)<<8)|
    (Math.min(255,(c&255)*f)|0);
  const fu=[],wu=[];
  // UVs from world position again, so a wall's grain continues into the next wall and a
  // floor tile does not restart its pattern at every quad. A wall is vertical, so it
  // takes x+z horizontally and y up; a floor takes the ground plane.
  const put=(P,C,U,x,y,z,c,up)=>{ P.push(x,y,z);
    C.push(((c>>16)&255)/255,((c>>8)&255)/255,(c&255)/255);
    if(up) U.push(x*0.5, z*0.5); else U.push((x+z)*0.5, y*0.5); };
  const quad=(P,C,I,vRef,a,b,c2,d,cl,U,up)=>{ const v=vRef.v;
    put(P,C,U,a[0],a[1],a[2],cl,up); put(P,C,U,b[0],b[1],b[2],cl,up);
    put(P,C,U,c2[0],c2[1],c2[2],cl,up); put(P,C,U,d[0],d[1],d[2],cl,up);
    I.push(v,v+2,v+1, v,v+3,v+2); vRef.v+=4; };
  const F={v:0}, W={v:0};
  const floorPal=th.floor.map(hx2), rockPal=th.rock.map(hx2), poolC=hx2(th.pool);
  for(let y=0;y<DN;y++)for(let x=0;x<DN;x++){
    const t=dty[dI(x,y)];
    if(t===DROCK){
      // a wall block, but only the faces that look onto somewhere you can stand
      const c=rockPal[(x*5+y*3)%rockPal.length];
      const side=(nx,ny,a,b,c2,d)=>{ if(dAt(nx,ny)===DROCK) return;
        quad(wp,wc,wi,W,a,b,c2,d,sh(c,0.88),wu,false); };
      side(x+1,y,[x+1,WALLH,y],[x+1,0,y],[x+1,0,y+1],[x+1,WALLH,y+1]);
      side(x-1,y,[x,WALLH,y+1],[x,0,y+1],[x,0,y],[x,WALLH,y]);
      side(x,y+1,[x,WALLH,y+1],[x,0,y+1],[x+1,0,y+1],[x+1,WALLH,y+1]);
      side(x,y-1,[x+1,WALLH,y],[x+1,0,y],[x,0,y],[x,WALLH,y]);
      quad(wp,wc,wi,W,[x,WALLH,y],[x,WALLH,y+1],[x+1,WALLH,y+1],[x+1,WALLH,y],sh(c,1.1),wu,true);
      continue;
    }
    let c, h=0;
    if(t===DPOOL){ c=poolC; h=-0.14; }
    else if(t===DRUBBLE){ c=sh(floorPal[0],0.82); }
    else if(t===DDOWN){ c=0x2a2030; }
    else if(t===DUP){ c=0x33303c; }
    else c=floorPal[(x*7+y*11)%floorPal.length];
    quad(fp,fc,fi,F,[x,h,y],[x,h,y+1],[x+1,h,y+1],[x+1,h,y],c,fu,true);
  }
  const mk=(P,C,I,U)=>{ const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));
    g.setIndex(I); g.computeVertexNormals(); return g; };
  return {floor:mk(fp,fc,fi,fu), wall:mk(wp,wc,wi,wu)};
}
/* What a floor is littered with depends on how deep it is. The wet caves have rubble
   and old crates; the crypts have coffins and bones; the dragon's floors have shrines. */
const BANDPROPS=[
  {big:[['cpillar',1.9]], small:[['barrel',0.85],['crates',0.95],['rubble',0.9],['bone',0.5]]},
  {big:[['crypt',2.2],['coffin',1.4]], small:[['grave',0.9],['grave2',0.9],['gravestone',0.8],
     ['marker',0.7],['skull',0.4],['ribcage',0.8],['bone',0.5]]},
  {big:[['cpillar',2.0],['lantern',1.1]], small:[['crates',0.95],['barrel',0.85],['rubble',0.9]]},
  {big:[['cpillar',1.9]], small:[['rubble',1.0],['bone',0.5],['skull',0.4],['ribcage',0.8]]},
  {big:[['shrine',1.5],['crypt',2.2]], small:[['skull',0.45],['bone',0.5],['gravestone',0.8],
     ['ribcage',0.8]]}
];
function bandProps(f){
  const i=THEMES.findIndex(t=>f<=t.to);
  return BANDPROPS[i<0?4:i];
}
function dungProp(kind,x,y,want,rot,yOff){
  const proto=ASSETS.dung[kind]; if(!proto) return null;
  const m=proto.clone(true);
  const b=new THREE.Box3().setFromObject(m), sz=b.getSize(new THREE.Vector3());
  const big=Math.max(sz.x,sz.y,sz.z)||1;
  const sc=want/big;
  m.scale.setScalar(sc);
  m.position.set(x, (yOff||0) - b.min.y*sc, y);
  m.rotation.y=rot||0;
  m.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  return m;
}
function buildKeep3D(){
  const th=themeFor(dfloor);
  const S=K3;
  // clearing the world orphans the party's meshes, so drop the cache that remembers them
  KSKINS.clear(); MSKINS.clear();
  while(S.world.children.length) S.world.remove(S.world.children[0]);
  S.torches.length=0; S.lights.length=0;
  const geo=dungeonGeo(th);
  // floors and walls are wound opposite ways here, and a dungeon has no outside worth
  // culling for, so render both faces and let the shader flip the normal
  const bandTex=th.tex?R3TEX[th.tex]:null;
  const fl=new THREE.Mesh(geo.floor,
    new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide,
      map:bandTex||null}));
  fl.receiveShadow=true; S.world.add(fl);
  // Walls dissolve where they would stand between the camera and the party, so you keep
  // the sense of being underground without losing sight of the delve.
  const wm=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide,
    transparent:true, map:bandTex||null});
  wm.onBeforeCompile=sh=>{
    sh.uniforms.uFade=S.uFade;
    sh.vertexShader='varying vec3 vWP;\n'+sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vWP=(modelMatrix*vec4(position,1.0)).xyz;');
    sh.fragmentShader='uniform vec3 uFade;\nvarying vec3 vWP;\n'+sh.fragmentShader.replace(
      '#include <dithering_fragment>',
      '#include <dithering_fragment>\n  float fd=distance(vWP.xz,uFade.xy);\n'+
      '  gl_FragColor.a *= smoothstep(uFade.z*0.45, uFade.z, fd);');
  };
  const wl=new THREE.Mesh(geo.wall,wm);
  wl.castShadow=true; wl.receiveShadow=true; S.world.add(wl);
  // torches: a bracket, a flame, and the light it throws
  const flameG=new THREE.SphereGeometry(0.11,7,6);
  const flameM=new THREE.MeshBasicMaterial({color:hx(th.torch)});
  dtorches.forEach(t=>{
    const stand=dungProp('torch',t.x,t.y+0.08,1.1,0,0);
    if(stand) S.world.add(stand);
    const f=new THREE.Mesh(flameG,flameM);
    f.position.set(t.x, 1.75, t.y+0.08); S.world.add(f);
    const L=new THREE.PointLight(hx(th.torch), 1.9, 14, 1.4);
    L.position.set(t.x, 1.8, t.y+0.1); S.world.add(L);
    S.torches.push(f); S.lights.push({L, p:t.p});
  });
  // the way down, lit from below
  const dl=new THREE.PointLight(hx(th.glow), 1.7, 7);
  dl.position.set(dDownAt[0]+0.5, 0.5, dDownAt[1]+0.5); S.world.add(dl);
  const dm=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,0.1,12),
    new THREE.MeshBasicMaterial({color:hx(th.glow)}));
  dm.position.set(dDownAt[0]+0.5, 0.02, dDownAt[1]+0.5); S.world.add(dm);
  S.scene.fog.color.setHex(hx(th.rock[2]));
  S.scene.background=new THREE.Color(hx(th.rock[2]));
  if(ASSETS.dung.cpillar||ASSETS.dung.pillar){
    const dress=new THREE.Group(); S.world.add(dress);
    const st=dungProp('stairs',dDownAt[0]+0.5,dDownAt[1]+0.5,1.3,0,0);
    if(st) dress.add(st);
    for(let y=0;y<DN;y++)for(let x=0;x<DN;x++){
      const t=dty[dI(x,y)];
      const h=dHash(x,y,dfloor*31+7);
      const bp=bandProps(dfloor);
      if(t===DRUBBLE && h>0.35){
        const pick2=bp.small[(h*997|0)%bp.small.length];
        const p2=dungProp(pick2[0],x+0.5,y+0.5,pick2[1],h*6.3,0); if(p2) dress.add(p2);
      } else if(t===DFLOOR && h>0.978){
        const set = h>0.993 ? bp.big : bp.small;
        const pick2 = set[(h*1409|0)%set.length];
        const p2=dungProp(pick2[0],x+0.5,y+0.5,pick2[1],h*6.3,0);
        if(p2) dress.add(p2);
      }
    }
  }
  S.chests=new THREE.Group(); S.world.add(S.chests);
  S.mobs=new THREE.Group();   S.world.add(S.mobs);
  k3floor=dfloor; S.chestSig=null;
  const c=keepPartyCentre();                      // arrive looking at them, do not drift in
  S.tx=c[0]; S.tz=c[1]; userPanned=false;
}
function initKeep3D(){
  if(K3) return K3;
  if(typeof THREE==='undefined') return null;
  cv3=cv3||document.getElementById('view3d'); if(!cv3) return null;
  const renderer=(R3&&R3.renderer)||new THREE.WebGLRenderer({canvas:cv3,antialias:true});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();
  scene.fog=new THREE.Fog(0x16121c, 9, 40);          // you see as far as the torches reach
  const cam=new THREE.PerspectiveCamera(50,1,0.2,120);
  scene.add(new THREE.AmbientLight(0xffffff,0.30));
  scene.add(new THREE.HemisphereLight(0x7a6d8c,0x2a2230,0.42));
  const world=new THREE.Group(); scene.add(world);
  const lamp=new THREE.PointLight(0xffd9a0, 1.5, 14, 1.45);   // the party's own lantern
  scene.add(lamp);
  K3={renderer,scene,cam,world,lamp,torches:[],lights:[],chests:null,mobs:null,
      uFade:new THREE.Uniform(new THREE.Vector3(0,0,0.001)),
      // Was dist 12 and ph 1.30: the camera sat almost on top of the party and you
      // could not read the floor. Further back and a little flatter shows the room.
      th:-2.3, ph:1.14, dist:21, tx:DN/2, ty:0.6, tz:DN/2, folk:0};
  buildKeep3D();
  return K3;
}
function keepPartyCentre(){
  const r=activeRun;
  if(r&&r.party.length){ let ax=0,ay=0;
    r.party.forEach(p=>{ax+=p.dx;ay+=p.dy;});
    return [ax/r.party.length, ay/r.party.length]; }
  return [dUpAt[0]+0.5, dUpAt[1]+0.5];
}
function renderKeep3D(){
  const S=initKeep3D(); if(!S){ renderKeep(); return; }
  if(k3floor!==dfloor) buildKeep3D();
  const th=themeFor(dfloor);
  const dt=Math.max(0,Math.min(0.1,tnow-(S.last||tnow))); S.last=tnow;
  // torchlight never sits still
  S.lights.forEach((t,i)=>{ const f=Math.sin(tnow*7+t.p)*0.5+Math.sin(tnow*11.3+t.p*2)*0.3;
    t.L.intensity=1.8+f*0.5;
    const m=S.torches[i]; if(m) m.scale.setScalar(0.85+f*0.2); });
  const c=keepPartyCentre();
  S.lamp.position.set(c[0], 1.4, c[1]);
  S.lamp.intensity=2.0+Math.sin(tnow*3.1)*0.16;
  // chests: built once per floor, and again only when one is forced open
  const sig=dfloor+':'+dchests.reduce((n,c)=>n+(c.open?1:0),0);
  if(S.chestSig!==sig){
    S.chestSig=sig;
    while(S.chests.children.length) S.chests.remove(S.chests.children[0]);
    dchests.forEach(ch=>{
      if(ASSETS.dung.chest){
        const m2=dungProp(ch.open?'chest':'chest_gold', ch.x, ch.y, 0.62,
          dHash(ch.x|0,ch.y|0,dfloor)*6.3, 0);
        if(m2) S.chests.add(m2);
        if(!ch.open){ const c2=dungProp('coins',ch.x+0.38,ch.y+0.2,0.3,0,0);
          if(c2) S.chests.add(c2); }
      } else {
        const m=new THREE.Mesh(new THREE.BoxGeometry(0.44,0.3,0.34),
          new THREE.MeshLambertMaterial({color:ch.open?0x4a3a2a:0x7a5a30}));
        m.position.set(ch.x,0.15,ch.y); m.castShadow=true; S.chests.add(m);
      }
      if(!ch.open){                                   // a beam, so you can find them
        const bm=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.22,2.6,8,1,true),
          new THREE.MeshBasicMaterial({color:hx(th.glow),transparent:true,opacity:0.18,
            side:THREE.DoubleSide,depthWrite:false}));
        bm.position.set(ch.x,1.3,ch.y); S.chests.add(bm);
      }
    });
  }
  // monsters
  if(ASSETS.mobs.default){ updateMobSkins(S,dt); }
  else {
  while(S.mobs.children.length) S.mobs.remove(S.mobs.children[0]);
  dmobs.forEach(mo=>{
    const s=mo.boss?1.7:1;
    const g=new THREE.Group();
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.22*s,0.42*s,4,8),
      new THREE.MeshLambertMaterial({color:hx(mo.col)}));
    body.position.y=0.45*s; body.castShadow=true; g.add(body);
    const eye=new THREE.Mesh(new THREE.SphereGeometry(0.05*s,6,5),
      new THREE.MeshBasicMaterial({color:mo.awake?0xff5a3c:0x804030}));
    eye.position.set(0.1*s,0.72*s,0.17*s); g.add(eye);
    const bob=mo.awake?Math.abs(Math.sin(tnow*6+mo.x))*0.07:Math.sin(tnow*1.4+mo.y)*0.025;
    g.position.set(mo.x,bob,mo.y);
    if(mo.boss){ const aura=new THREE.PointLight(0xff6a3c,1.1,5);
      aura.position.set(mo.x,1,mo.y); S.mobs.add(aura); }
    S.mobs.add(g);
  });
  }
  // the party, as the same skinned people who walk the town
  updateKeepSkins(S,dt);
  // camera follows them unless the player has taken hold of it
  if(!userPanned){
    const gap=Math.hypot(c[0]-S.tx, c[1]-S.tz);
    const k = gap>6 ? 1 : Math.min(1, dt*5);      // never let them walk off the screen
    S.tx+=(c[0]-S.tx)*k; S.tz+=(c[1]-S.tz)*k; }
  const cx=S.tx+Math.cos(S.th)*Math.cos(S.ph)*S.dist;
  const cy=S.ty+Math.sin(S.ph)*S.dist;
  const cz=S.tz+Math.sin(S.th)*Math.cos(S.ph)*S.dist;
  S.cam.position.set(cx,cy,cz); S.cam.lookAt(S.tx,S.ty,S.tz);
  const ox=cx-S.tx, oz=cz-S.tz, om=Math.hypot(ox,oz)||1;   // the hole sits in front of them
  S.uFade.value.set(S.tx+ox/om*2.6, S.tz+oz/om*2.6, 5.0);
  S.renderer.render(S.scene,S.cam);
  fxDraw(S.cam,true);
}
function updateMobSkins(S,dt){
  const live=new Set(dmobs);
  for(const mo of dmobs){                      // name a boss the moment it wakes
    if(mo.boss && mo.awake && !mo.named){ mo.named=1;
      fxWord(mo.x, mo.y, mo.name, mo.col||'#ffcf7a');
      snd('boss',1.1);
      fxBurst(mo.x, mo.y, mo.col||'#ffcf7a', 26, 2.6, 2.4); }
  }
  MSKINS.forEach((sk,mo)=>{ if(!live.has(mo)){ S.mobs.remove(sk.grp); MSKINS.delete(mo); } });
  dmobs.forEach(mo=>{
    let sk=MSKINS.get(mo);
    if(!sk){ sk=makeMobSkin(mo); if(!sk) return; S.mobs.add(sk.grp); MSKINS.set(mo,sk);
      if(mo.boss){
        const col=hx(mo.col||'#ff6a3c');
        const aura=new THREE.PointLight(col,2.2,9);
        aura.position.set(mo.x,1.3,mo.y); sk.aura=aura; S.mobs.add(aura);
        const ring=new THREE.Mesh(new THREE.RingGeometry(0.9,1.5,28),
          new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.16,
            side:THREE.DoubleSide,depthWrite:false}));
        ring.rotation.x=-Math.PI/2; ring.position.set(mo.x,0.03,mo.y);
        sk.ring=ring; S.mobs.add(ring);
      } }
    sk.grp.position.set(mo.x,0,mo.y);
    if(sk.aura){ sk.aura.position.set(mo.x,1.3,mo.y);
      sk.aura.intensity=2.0+Math.sin(tnow*2.3)*0.7; }
    if(sk.ring){ sk.ring.position.set(mo.x,0.03,mo.y);
      const k=1+Math.sin(tnow*1.6)*0.06; sk.ring.scale.set(k,k,1); }
    if(mo.mfx!==undefined && Math.abs(mo.x-mo.mfx)+Math.abs(mo.y-mo.mfy)>0.004)
      sk.grp.rotation.y=Math.atan2(mo.x-mo.mfx, mo.y-mo.mfy);
    const moving=(Math.abs(mo.x-(mo.mfx||mo.x))+Math.abs(mo.y-(mo.mfy||mo.y)))>0.0015;
    mo.mfx=mo.x; mo.mfy=mo.y;
    playClip(sk, mo.hp<=0 ? 'die'
               : (mo.flee ? 'walk'
               : (mo.atk>0 ? 'attack' : (moving ? 'walk' : 'idle'))));
    fxApplyFlash(sk,dt);
    sk.mixer.update(dt);
  });
}
function updateKeepSkins(S,dt){
  const party=activeRun?activeRun.party:[];
  const want=new Set(party);
  KSKINS.forEach((sk,p)=>{ if(!want.has(p)){ S.world.remove(sk.grp); KSKINS.delete(p); } });
  party.forEach(p=>{
    let sk=KSKINS.get(p);
    if(!sk){ sk=makeSkin(p); if(!sk) return; S.world.add(sk.grp); KSKINS.set(p,sk); }
    sk.grp.visible=true;
    sk.grp.position.set(p.dx,0,p.dy);
    if(p.kfx!==undefined && Math.abs(p.dx-p.kfx)+Math.abs(p.dy-p.kfy)>0.004)
      sk.grp.rotation.y=Math.atan2(p.dx-p.kfx,p.dy-p.kfy);
    p.kfx=p.dx; p.kfy=p.dy;
    const moving=(p.kmv=(Math.abs(p.dx-(p.kpx||p.dx))+Math.abs(p.dy-(p.kpy||p.dy)))>0.0015);
    p.kpx=p.dx; p.kpy=p.dy;
    if(sk.casting>0) sk.casting-=dt;
    playClip(sk, p.hp<=0 ? 'die'
      : (sk.casting>0 ? 'cast' : (p.atk>0 ? 'attack' : (moving ? 'run' : 'guard_idle'))));
    fxApplyFlash(sk,dt);
    sk.mixer.update(dt);
  });
}

function setScene(sc){
  if(sc===scene) return;
  camSave[scene]={camX,camY,zoom};
  scene=sc; GS = sc==='keep' ? DN : N; follow=null; userPanned=false;
  scoreUpdate();
  if(!v3d) resize();
  const sv=camSave[sc];
  if(sv){ camX=sv.camX; camY=sv.camY; zoom=sv.zoom; }
  else if(sc==='keep'){ zoom=1.6; const f=flat(DN/2,DN/2,0); camX=f[0]; camY=f[1]; }
  else { zoom=1.1; const f=flat(tx0(26),ty0(24),0); camX=f[0]; camY=f[1]; }
  if(sc==='keep'&&activeRun&&activeRun.party.length){
    const p=activeRun.party[0], v=vpt(p.dx,p.dy), f=flat(v[0],v[1],0); camX=f[0]; camY=f[1];
  }
  const hintEl=document.getElementById('hint'); if(hintEl) hintEl.remove();
  const a=document.getElementById('scTown'), b2=document.getElementById('scKeep');
  if(a) a.classList.toggle('on',sc==='town');
  if(b2) b2.classList.toggle('on',sc==='keep');
  const c3b=document.getElementById('sc3D'); if(c3b) c3b.classList.toggle('on',v3d);
  if(v3d) userPanned=false;
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
  if(e.key==='3') set3D(!v3d);
});
setTimeout(()=>{const h2=document.getElementById('hint');
  if(h2){h2.style.transition='opacity .6s';h2.style.opacity='0';setTimeout(()=>h2.remove(),700);}},16000);
wire3D();
(function(){ const b3=document.getElementById('sc3D');
  if(b3) b3.onclick=()=>set3D(!v3d); })();
/* Pick the town back up if this browser has one. Everything in loadGame is guarded;
   a corrupt or stale save simply starts a fresh town rather than breaking the page. */
if(loadGame()){
  logMsg('Picked up where you left off \u00b7 day '+day+', '+season().n+' of year '+yearN+
         ' \u00b7 '+people.length+' souls.','g');
} else {
  logMsg('Ashvale wakes. '+people.length+' souls, and the Keep still open.','');
}
(function(){
  const nb=document.getElementById('newTown'); if(!nb) return;
  let armed=0;
  nb.onclick=()=>{
    if(!armed){ armed=1; nb.textContent='Sure? This erases it'; nb.classList.add('on');
      setTimeout(()=>{ if(armed){ armed=0; nb.textContent='New town'; nb.classList.remove('on'); } },4000);
      return; }
    wipeSave(); location.reload();
  };
})();
addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') saveGame('hide'); });
addEventListener('pagehide',()=>saveGame('hide'));

paintConsole();
/* 3D is the view this is built around now; the flat view stays as the map you can
   drop back to, and is also where a browser with no WebGL lands. */
try{ set3D(true); }catch(e){ v3d=false; cv.style.display=''; }
/* A read-only window for the harness. Every cycle has to measure the mechanism
   rather than eyeball the result, and a scratch build to do that is a scratch
   build that can be forgotten to revert. Nothing in the game reads any of it. */
window.__ash={
  world(){ let made=0; for(let i=0;i<N*N;i++) if(GEN[i]) made++;
    return {N,cells:N*N,made,chunks:chunksMade,bounds:genBounds(),
      town:{x0:OFF,y0:OFF,x1:OFF+TOWN-1,y1:OFF+TOWN-1},
      kingdoms:KINGDOM.map(k=>({k:k.k,x0:k.x0,y0:k.y0,x1:k.x0+TOWN-1,y1:k.y0+TOWN-1}))}; },
  out(){ return people.filter(p=>!p.away&&p.errandTo).length; },
  /* What the generator actually lays down, counted inside the town and beyond it
     separately. Guessing at a screenshot four times is what this replaces. */
  /* What is drawn beyond the made world. Three guesses at a screenshot is three
     too many: walk the graph, take each object's world-space centre, and name
     whatever sits outside the bounding box of ground that exists. */
  strays(){ const S=R3; if(!S) return null;
    const b=genBounds(), out={}, box=new THREE.Box3(), c=new THREE.Vector3();
    let inside=0;
    S.scene.traverse(o=>{
      if(!(o.isMesh||o.isInstancedMesh)) return;
      box.setFromObject(o); if(box.isEmpty()) return;
      box.getCenter(c);
      if(c.x>=b.x0-1&&c.x<=b.x1+2&&c.z>=b.y0-1&&c.z<=b.y1+2){ inside++; return; }
      let tag=o.name||'', q=o.parent, hop=0;
      while(q&&hop<4){ if(q.name){ tag=q.name+'/'+tag; break; } q=q.parent; hop++; }
      const k=(tag||'(unnamed)')+' '+o.type+' '+(o.material&&o.material.type||'-')+
        (o.isInstancedMesh?' x'+o.count:'');
      if(!out[k]) out[k]={n:0, far:0, at:null, vis:0, geo:null};
      out[k].n++;
      if(!out[k].at){ out[k].at=[Math.round(c.x),Math.round(c.y),Math.round(c.z)];
        out[k].geo=o.geometry&&o.geometry.type; }
      let shown=o.visible, q2=o.parent;
      while(shown&&q2){ if(!q2.visible) shown=false; q2=q2.parent; }
      if(shown) out[k].vis++;
      out[k].far=Math.max(out[k].far, Math.round(Math.max(
        b.x0-c.x, c.x-b.x1, b.y0-c.z, c.z-b.y1)));
    });
    return {bounds:b, inside, outside:out}; },
  hist(){ const nm=['grass','road','plaza','water','dirt','field','rock'];
    const inn={}, out={};
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){ const i=I(x,y); if(!GEN[i]) continue;
      const u=x-OFF, v=y-OFF;
      const b=(u<0||v<0||u>=TOWN||v>=TOWN)?out:inn;
      const k=nm[ty[i]]||('t'+ty[i]); b[k]=(b[k]||0)+1; }
    return {town:inn, wild:out}; },
  errands(){ return Object.assign({},ERR); },
  street(){ return Object.assign({out:people.filter(q=>!q.away&&q.out).length},STREET); },
  speed(){ return speed; },
  /* Probes need more game-time than the speed buttons offer, now that 8x is a
     130-second day under software rendering. Test plumbing only; nothing in the
     game calls it and the UI still offers 0/1/3/8. */
  fast(n){ setSpeed(n); return speed; },
  /* How many of the town's people a viewer can actually see. Effective visibility,
     walking the parent chain - `o.visible` on a person's own mesh says nothing
     about whether the group holding it is shown. */
  /* The building with the most people in it right now, so a probe can point the
     camera somewhere there is life instead of at an empty plaza. */
  busiest(){ let best=null, n=0;
    const occ2=new Map();
    for(const p of people){ if(p.dead||p.away||!p.inside) continue;
      const c=(occ2.get(p.inside.id)||0)+1; occ2.set(p.inside.id,c);
      if(c>n){ n=c; best=p.inside; } }
    return best?{x:best.x+best.w/2-OFF, y:best.y+best.d/2-OFF, n, kind:best.kind}:null; },
  folkSeen(){ const S=R3; if(!S) return null;
    let alive=0, indoors=0, shown=0;
    for(const p of people){
      if(p.dead) continue; alive++;
      if(p.inside) indoors++;
      const m=p.m3; if(!m||p.away) continue;
      let v=m.visible, q=m.parent;
      while(v&&q){ if(!q.visible) v=false; q=q.parent; }
      if(v) shown++;
    }
    return {alive, indoors, outdoors:alive-indoors, shown, hour,
      dist:Math.round(S.dist), opened:opened.size, auto:autoOpen.size, xray}; },
  /* `tnow` is simulated seconds, the sum of every frame's clamped delta. Wall time
     is the wrong denominator here: `raw` is capped at 50 ms a frame, so under
     software rendering at ~1.3 fps the sim advances 65 ms per real second and a
     probe measuring wall time measures the renderer, not the clock. */
  clock(){ return {day, hour, minute, mins:(day-1)*1440+hour*60+minute, speed,
    daysec:DAYSEC, mps:MPS, sim:tnow}; },
  fields(){ return Object.assign({size:fieldCache.size, bytes:fieldCache.size*N*N*2},FSTAT); },
  season(){ seasonI=(seasonI+1)%4; applySeason(); return seasonI; },
  /* The same rule as chunkWalk, but one pass over the whole grid with no chunks
     in it. If the per-chunk meshes agree with this they cover every made cell
     exactly once - which is the thing splitting the mesh could have broken. */
  /* chunkRecolour replays chunkWalk and writes colours in sequence. If that walk
     ever drifted from the one that laid the vertices down, every colour after the
     drift would land on the wrong vertex and the counts would still agree. Rebuild
     each chunk from scratch and compare, using the real builder as the reference. */
  colourDrift(){ const S=R3; if(!S||!S.chunks) return -1;
    let bad=0;
    for(const [k,m] of S.chunks){
      const G=chunkGeo(k%CN,(k/CN)|0); if(!G) continue;
      const a=m.geometry.getAttribute('color').array, b=G.getAttribute('color').array;
      if(a.length!==b.length){ bad+=Math.abs(a.length-b.length); G.dispose(); continue; }
      for(let i=0;i<a.length;i++) if(Math.abs(a[i]-b[i])>1e-6) bad++;
      G.dispose();
    }
    return bad; },
  /* The live scene, not a grep. A grep over the source cannot see what the KayKit
     models bring with them, and those arrive as MeshStandardMaterial from the glTF
     loader whatever this file says. */
  materials(){ const S=R3; if(!S) return null;
    const seen=new Set(), by={}; let meshes=0;
    S.scene.traverse(o=>{ if(!(o.isMesh||o.isInstancedMesh)) return; meshes++;
      const ms=Array.isArray(o.material)?o.material:[o.material];
      for(const m of ms){ if(!m||seen.has(m.uuid)) continue; seen.add(m.uuid);
        by[m.type]=(by[m.type]||0)+1; } });
    return {meshes, unique:seen.size, byType:by,
      tone:S.renderer.toneMapping, exposure:S.renderer.toneMappingExposure,
      enc:S.renderer.outputEncoding}; },
  noon(h){ hour=(h===undefined?12:h); minute=0; return hour; },
  /* Live knobs so a tuning pass can compare several looks in one browser run
     instead of one edit-build-screenshot round trip each. */
  tune(o){ const S=R3; if(!S) return null;
    if(o.water!==undefined) S.water.visible=o.water;
    if(o.tone!==undefined) S.renderer.toneMapping=o.tone;
    if(o.exposure!==undefined) S.renderer.toneMappingExposure=o.exposure;
    if(o.sun!==undefined) LIT.sun=o.sun;
    if(o.hemi!==undefined) LIT.hemi=o.hemi;
    if(o.amb!==undefined) S.scene.traverse(q=>{ if(q.isAmbientLight) q.intensity=o.amb; });
    S.scene.traverse(q=>{ if(q.isMesh||q.isInstancedMesh){
      const ms=Array.isArray(q.material)?q.material:[q.material];
      for(const m of ms) if(m) m.needsUpdate=true; } });
    return {tone:S.renderer.toneMapping, exposure:S.renderer.toneMappingExposure,
            sunK:LIT.sun, hemiK:LIT.hemi}; },
  /* Read back AFTER a frame. Reading an intensity in the same tick you set it told
     me a light had changed when the next frame was about to overwrite it. */
  lit(){ const S=R3; return S?{sun:S.sun.intensity, hemi:S.hemi.intensity,
    amb:(()=>{let v=null; S.scene.traverse(q=>{if(q.isAmbientLight)v=q.intensity;}); return v;})()
    }:null; },
  look(x,y,d){ const S=R3; if(!S) return null;
    S.tx=tx0(x); S.tz=ty0(y); S.dist=d; S.ph=0.62; userPanned=true; return [S.tx,S.tz,S.dist]; },
  faceVerts(){ let q=0;
    const lev=(x,y)=>{ if(!isMade(x,y)) return -0.6;
      const i=I(x,y); return ty[i]===WATER?-0.34:hh[i]*HU; };
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      if(!GEN[I(x,y)]) continue;
      const h0=lev(x,y); q++;
      if(h0-lev(x+1,y)>0.004) q++;
      if(h0-lev(x,y+1)>0.004) q++; }
    return q*4; },
  mesh(){ const S=R3; if(!S||!S.chunks) return null;
    let verts=0; const per={};
    for(const [k,m] of S.chunks){ const n=m.geometry.getAttribute('position').count;
      verts+=n; per[k]=n; }
    return {meshes:S.chunks.size, verts, builds:geoBuilds, recolours:geoRecolours, per}; },
  trips(){ return people.filter(p=>!p.away&&p.errandTo).map(p=>({
    at:[p.x|0,p.y|0], to:[p.errandTo.x,p.errandTo.y],
    aim:Math.max(0,OFF-p.errandTo.x,p.errandTo.x-(OFF+TOWN-1),OFF-p.errandTo.y,p.errandTo.y-(OFF+TOWN-1)),
    t:p.errandT|0, fld:p.fld?p.fld[I(p.x|0,p.y|0)]:'none', goal:!!p.goal })); },
  outside(){ let n=0; for(const p of people){ if(p.away) continue;
    const u=(p.x|0)-OFF, v=(p.y|0)-OFF;
    if(u<0||v<0||u>=TOWN||v>=TOWN) n++; } return n; }
};
requestAnimationFrame(tick);
})();
