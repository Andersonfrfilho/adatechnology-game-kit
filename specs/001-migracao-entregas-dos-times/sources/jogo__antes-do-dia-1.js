// fonte: site/pages/jogo/antes-do-dia-1.html
// texto visível: Antes do Dia 1 ZombiAdA · documento de design · surto gradual Vale Cinzento · v0.1 · 22/10/2026 Proposta de progressão do surto Antes do Dia 1 O jogo não começa no apocalipse. Começa numa terça-feira comum no Jardim Aurora, com padaria aberta, ônibus no horário e a Jéssica tocando música na Vale FM. Em seis dias de jogo, quatro pessoas mordidas num laboratório viram um caso estranho no hospital, depois boato, barreira sanitária, corrida ao mercado e, na noite do Dia 0, a ruptura. O Dia 1 continua exatamente como está hoje nos Vivos do Vale: quarentena no norte, os 47 pontos de virada e a fatia jogável no Dia 3. D−6 a D0 prólogo novo, antes do Dia 1 atual 6 fases da rotina ao apagão, com janela de dias e gatilho 4 → 37 mil zumbis, do laboratório ao Dia 30 (mesmo total do mapa) 3 SDKs Contágio, Multidão civil e Boletim, sem nada do ZombiAdA dentro Rotina D−6 a D−4 Primeiros casos D−4 a D−3 Alerta D−2 a D−1 Ruptura D0, a noite do surto Colapso D1 a D7 (canon atual) Apagão e depois D8 em diante (mapa) A regra que segura tudo Ninguém para o surto. Dá para chegar preparado. O surto é inevitável O jogador não cura, não contém e não impede a noite do Dia 0. As fases têm janela de dias: o surto pode chegar um pouco antes ou depois conforme o contágio, mas nunca fora da janela. Assim a história escrita do Dia 1 em diante continua valendo. O jogador muda o que está perto Quem ele avisou, o que comprou, onde estava, quem levou ao hospital. Cada ação no prólogo vira uma flag que os pontos de virada do Dia 1 em diante já sabem ler, no mesmo formato dos Vivos do Vale. Mesma regra de mordida Mordida é infecção 100%, morte em 48 h de jogo e reanimação em 2 a 4 min reais. É essa espera de 48 h que faz o surto ser gradual: cada geração de zumbis leva dois dias para nascer, e entre uma e outra a cidade ainda acha que é gripe. D0 é o “dia do surto” do canon Todo texto que já diz “no dia do surto” (rebelião na penitenciária, Lívia na escola, Diego no plantão, Lúcia fechando a BR) passa a acontecer no D0. O Dia 1 é a primeira manhã depois. Linha do tempo As seis fases Cada fase entra quando o número de zumbis passa do limiar e o dia já está dentro da janela, ou quando a janela acaba, o que vier primeiro. Os números são proposta para playtest. Um dia de jogo dura cerca de 1 h real (regra do mapa); na fatia, 20 min. F0 · Rotina D−6 22h a D−4 Gatilho Início do mundo. Às 22h do D−6 três técnicos e um segurança do Laboratório Aurora, sob a Mansão Valverde, são mordidos por uma cobaia. Ninguém fica sabendo. Cidade Tudo funciona: luz, água, ônibus, postos, comércio aberto das 8h às 20h, escola, feira de domingo no Jardim Aurora. Ruas cheias de gente com rotina própria. Zumbis Zero na rua. Quatro mordidos escondidos andando pela cidade com febre. O que o jogador vê Vida normal e os sobreviventes que ele vai conhecer, ainda inteiros: Kauã entregando pizza de moto, o Seu Arnaldo no dominó da praça, a Helena com o marido no portão. Pistas pequenas: uma viatura subindo a Estrada d

// ===== script 0 (10 KB)

// ===== Modelo do SDK Contágio (mesma lógica proposta para implementacao/sdk/contagio) =====
const PH=[
 {id:'rotina', n:'Rotina',          diaMin:-99,diaMax:-99,lim:0,   aw:0,   kill:.004,kf:.002, sh:0,     fl:0,    ex:0,     hosp:.008},
 {id:'casos',  n:'Primeiros casos', diaMin:-4, diaMax:-3, lim:2,   aw:.05, kill:.01, kf:.004, sh:.0001,fl:.0002,ex:.0004, hosp:.006},
 {id:'alerta', n:'Alerta',          diaMin:-2, diaMax:-1, lim:5,   aw:.3,  kill:.04, kf:.006, sh:.0012,fl:.002, ex:.0003, hosp:.006},
 {id:'ruptura',n:'Ruptura',         diaMin:0,  diaMax:.5, lim:600, aw:.7,  kill:.08, kf:.006, sh:.003, fl:.006, ex:0,     hosp:.01},
 {id:'colapso',n:'Colapso',         diaMin:1,  diaMax:1,  lim:1e9, aw:.9,  kill:.05, kf:.0015,sh:.002, fl:.004, ex:0,     hosp:0},
 {id:'apagao', n:'Apagão e depois', diaMin:8,  diaMax:8,  lim:1e9, aw:1,   kill:.01, kf:.0004,sh:.001, fl:.002, ex:0,     hosp:0}];
const REG=[
 {id:'centro',  n:'Centro',              c:'Santa Aurora',pop:7200,d:1.4,cop:6,city:1},
 {id:'hospital',n:'Hospital Regional',   c:'Santa Aurora',pop:700, d:2.2,cop:1,bm:1.3},
 {id:'jardim',  n:'Jardim Aurora',       c:'Santa Aurora',pop:3400,d:.8, cop:1,city:1},
 {id:'vilaesp', n:'Vila Esperança',      c:'Santa Aurora',pop:6000,d:1.2,cop:1.5,city:1},
 {id:'fabril',  n:'Distrito Fabril',     c:'Santa Aurora',pop:1900,d:.9, cop:.5,city:1},
 {id:'outros',  n:'Demais bairros',      c:'Santa Aurora',pop:4800,d:1,  cop:2,city:1},
 {id:'sitios',  n:'Sítios e Várzea',     c:'Santa Aurora',pop:1300,d:.4, cop:.2},
 {id:'penit',   n:'Penitenciária',       c:'norte',       pop:1400,d:2,  cop:2},
 {id:'base',    n:'Base 7º BIS',         c:'nordeste',    pop:800, d:1,  cop:6},
 {id:'tresp',   n:'Três Pontes',         c:'cidade',      pop:5600,d:1.1,cop:2,city:1,ex:1},
 {id:'porto',   n:'Porto Turvo',         c:'cidade',      pop:6400,d:1.1,cop:2,city:1,ex:1},
 {id:'campo',   n:'Campo Largo',         c:'cidade',      pop:2800,d:.6, cop:1,city:1},
 {id:'corvo',   n:'Vila do Corvo',       c:'serra',       pop:1000,d:.6, cop:.5,ex:1},
 {id:'vilas',   n:'Vilas e estradas',    c:'vale',        pop:2200,d:.4, cop:.5}];
const LK=[['centro','jardim',.3],['centro','vilaesp',.3],['centro','fabril',.2],['centro','outros',.3],['jardim','base',.4],['centro','base',.2],['vilaesp','sitios',.3],['fabril','tresp',.2],['centro','tresp',.3],['tresp','porto',.3],['tresp','campo',.3],['centro','corvo',.1],['outros','vilas',.2],['campo','vilas',.2],['porto','vilas',.1]]
 .map(([a,b,f])=>({a,b,f:f*.04})).concat([{a:'hospital',b:'centro',f:0,z:.01,from:2},{a:'penit',b:'vilas',f:0,z:.004},{a:'base',b:'jardim',f:0,z:.004}]);
const INC=48, START=-6*24, END=31*24;

function simulate(opt){
  const R=REG.map(r=>({...r,S:r.pop,H:0,E:new Float64Array(INC),I:0,X:0,F:0,D:0,aw:0,seen:0}));
  const ix={};R.forEach((r,i)=>ix[r.id]=i);
  const Es=r=>{let s=0;for(const v of r.E)s+=v;return s};
  const evs=[
    {h:-6*24+22, f:()=>{R[ix.centro].E[0]+=4}},
    {h:-2*24+10, f:()=>{R[ix.penit].E[20]+=3}},
    {h:-1*24+12, f:()=>{for(const k of['jardim','centro','outros']){const r=R[ix[k]],m=r.S*.08;r.S-=m;R[ix.base].S+=m;for(let q=0;q<INC;q++){const e=r.E[q]*.08;r.E[q]-=e;R[ix.base].E[q]+=e}}}},
    {h:opt.alaB?30:18, f:()=>{const H=R[ix.hospital],z=H.I*(opt.alaB?.3:.6);H.I-=z;R[ix.centro].I+=z}},
    {h:20, f:()=>{const p=R[ix.penit],m=p.S*.3;p.S-=m;R[ix.vilas].S+=m}},
  ];
  if(opt.aviso)evs.push({h:-2*24+9,f:()=>{const j=R[ix.jardim];j.aw=Math.max(j.aw,.8);j.guard=.25}});
  evs.forEach(e=>e.done=0);
  let ph=0; const out=[], phaseAt=[], fall={};
  for(let h=START;h<END;h++){
    const P=PH[ph], hod=((h%24)+24)%24, night=(hod<6||hod>=20);
    for(const e of evs) if(!e.done&&h>=e.h){e.done=1;e.f()}
    for(const r of R){
      const es=Es(r);
      r.seen+=r.I*.02;
      r.aw=Math.min(1,Math.max(r.aw,P.aw)+(1-Math.exp(-r.seen/(r.pop*.004)))*.03*(1-r.aw));
      const cur=1+(1-r.aw)*1.2, beta=opt.beta*r.d*cur*(night?.6:1)*(r.bm||1);
      const pres=r.S+es+r.I+1;
      const b=Math.min(r.S,beta*r.I*r.S/pres);
      const floor=r.pop*.015, hv=Math.max(0,r.H-floor);
      const bh=Math.min(hv,.03*r.X*hv/(r.H+r.X+1)+.004*r.I*hv/(pres+r.H));
      r.S-=b; r.H-=bh;
      const t=r.E[INC-1]; for(let k=INC-1;k>0;k--)r.E[k]=r.E[k-1]; r.E[0]=b+bh;
      const home=Math.min(.6,r.aw*.7); r.X+=t*home; r.I+=t*(1-home);
      const kill=Math.min(r.I,P.kill*r.cop+r.I*P.kf); r.I-=kill; r.D+=kill;
      const sh=r.S*P.sh*r.aw; r.S-=sh; r.H+=sh;
      const esc=r.X*.004; r.X-=esc; r.I+=esc;
    }
    for(const L of LK){ if(ph<(L.from||0))continue; const a=R[ix[L.a]],b=R[ix[L.b]];
      if(L.f){const press=a.I/(a.S+a.H+a.I+1); let f=Math.min(a.S*.05,a.S*L.f*(P.fl*a.aw+press*2)); f*=(b.guard||1); a.S-=f;b.S+=f;
        const sh=f/(a.S+f+1)*.5*(b.guard||1); for(let k=0;k<INC;k++){const m=a.E[k]*sh*L.f*20;a.E[k]-=m;b.E[k]+=m}}
      if(L.z){const z=a.I*L.z*(b.guard||1);a.I-=z;b.I+=z}}
    for(const r of R) if(r.ex){const o=r.S*P.ex*r.ex;r.S-=o;r.F+=o}
    const H=R[ix.hospital]; for(const r of R){ if(r===H||!r.city)continue; for(let k=2;k<INC;k++){const m=r.E[k]*P.hosp;r.E[k]-=m;H.E[k]+=m}}
    // fase seguinte
    const day=(h+1)/24, tot=R.reduce((a,r)=>a+r.I+r.X,0);
    while(ph+1<PH.length){const n=PH[ph+1]; if(day>=n.diaMax||(day>=n.diaMin&&tot>=n.lim))ph++; else break}
    for(const r of R) if(fall[r.id]===undefined&&(r.I+r.X)>r.pop*.15) fall[r.id]=h+1;
    out.push(R.map(r=>[r.S,r.H,Es(r),r.I,r.X,r.F,r.D,r.aw])); phaseAt.push(ph);
  }
  return {out,phaseAt,fall};
}

// ===== Desenho =====
const $=id=>document.getElementById(id);
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fmt=n=>n<1?'0':n<10?n.toFixed(0):Math.round(n).toLocaleString('pt-BR');
const dlab=h=>{const d=Math.floor(h/24),hh=((h%24)+24)%24;return (d<0?'D−'+(-d):'D'+d)+' '+String(hh).padStart(2,'0')+'h'};
const SER=[['Vivos livres','--s-vivo',0],['Abrigados','--s-abr',1],['Mordidos (48 h)','--s-mord',2],['Zumbis soltos','--s-zumbi',3],['Presos em casa','--s-preso',4]];
let opt={beta:.7,aviso:false,alaB:false}, res=null, cur=162;

function legend(){ $('legend').innerHTML=SER.map(s=>`<span><i style="background:var(${s[1]})"></i>${s[0]}</span>`).join('')+'<span>faixas de fundo = fases</span>'; }
function run(){ res=simulate(opt); draw(); readout(); }
function tot(t,k){let s=0;for(const r of res.out[t])s+=r[k];return s}

function draw(){
  const cv=$('cv'), W=cv.clientWidth||1020, Hh=Math.round(Math.max(260,Math.min(380,W*.42)));
  const dpr=window.devicePixelRatio||1; cv.width=W*dpr; cv.height=Hh*dpr; cv.style.height=Hh+'px';
  const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,Hh);
  const L=58,Rm=10,T=12,B=30, pw=W-L-Rm, phh=Hh-T-B, N=res.out.length;
  const X=t=>L+t/(N-1)*pw, LMAX=5, Y=v=>T+phh*(1-Math.log10(Math.max(1,v))/LMAX);
  const pc=['--f0','--f1','--f2','--f3','--f4','--f5'];
  // faixas de fase
  let s=0; for(let t=1;t<=N;t++){ if(t===N||res.phaseAt[t]!==res.phaseAt[s]){ g.globalAlpha=.13; g.fillStyle=css(pc[res.phaseAt[s]]); g.fillRect(X(s),T,X(t-1)-X(s),phh); g.globalAlpha=1; s=t; } }
  // grade
  g.strokeStyle=css('--grid'); g.fillStyle=css('--muted'); g.font='11px '+css('--mono'); g.lineWidth=1;
  ['1','10','100','1 mil','10 mil','100 mil'].forEach((lab,i)=>{const y=Y(10**i); g.beginPath(); g.moveTo(L,y); g.lineTo(W-Rm,y); g.stroke(); g.textAlign='right'; g.fillText(lab,L-6,y+4)});
  g.textAlign='center';
  for(let d=-6;d<=30;d++){ if(d<=1||d%5===0){ const x=X((d*24-START)); g.beginPath(); g.moveTo(x,T+phh); g.lineTo(x,T+phh+4); g.stroke(); g.fillText(d<0?'D−'+(-d):'D'+d,x,Hh-10);} }
  // séries
  for(const [n,c,k] of SER){ g.strokeStyle=css(c); g.lineWidth=k===3?2.6:1.8; g.beginPath();
    for(let t=0;t<N;t+=2){const y=Y(tot(t,k)); t?g.lineTo(X(t),y):g.moveTo(X(t),y)} g.stroke(); }
  // cursor
  const x=X(cur); g.strokeStyle=css('--ink'); g.lineWidth=1; g.setLineDash([4,3]); g.beginPath(); g.moveTo(x,T); g.lineTo(x,T+phh); g.stroke(); g.setLineDash([]);
  const z=tot(cur,3)+tot(cur,4); g.fillStyle=css('--s-zumbi'); g.beginPath(); g.arc(x,Y(tot(cur,3)),4,0,7); g.fill();
}

function stage(r,p){const z=r[3]+r[4], live=r[0]+r[1]+r[2];
  if(live<p*.1&&z>0) return ['tomado','--f5'];
  if(z>p*.15) return ['caído','--f4'];
  if(z>p*.005||r[7]>.5) return ['pânico','--f3'];
  if(z>=1||r[2]>=1) return ['casos','--f1'];
  return ['calmo','--f0'];}
function readout(){
  const t=cur, ph=PH[res.phaseAt[t]];
  $('dlabel').textContent=dlab(t+START);
  const items=[['Fase',ph.n,null],['Zumbis soltos',fmt(tot(t,3))],['Presos em casa',fmt(tot(t,4))],['Mordidos (vão virar)',fmt(tot(t,2))],['Vivos (livres + abrigados)',fmt(tot(t,0)+tot(t,1))],['Saíram do vale',fmt(tot(t,5))]];
  $('readout').innerHTML=items.map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('');
  $('regions').innerHTML=REG.map((g,i)=>{const r=res.out[t][i], p=g.pop, [st,sc]=stage(r,p);
    const seg=[[r[0],'--s-vivo'],[r[1],'--s-abr'],[r[2],'--s-mord'],[r[3],'--s-zumbi'],[r[4],'--s-preso']];
    const sum=seg.reduce((a,s)=>a+s[0],0)||1;
    return `<div class="reg"><header><b>${g.n}</b><span class="st" style="color:var(${sc})">${st}</span></header><div class="bar">${seg.map(s=>`<i style="width:${(s[0]/sum*100).toFixed(2)}%;background:var(${s[1]})"></i>`).join('')}</div><span class="note">${fmt(r[3]+r[4])} zumbis · ${fmt(r[0]+r[1])} vivos</span></div>`}).join('');
  const order=Object.entries(res.fall).sort((a,b)=>a[1]-b[1]).map(([id,h])=>`${REG.find(r=>r.id===id).n} ${dlab(h).split(' ')[0]}`);
  $('falls').textContent='Quando cada região cai (15% virou zumbi): '+order.join(' · ')+'.';
  draw();
}
document.querySelectorAll('.seg button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.seg button').forEach(x=>x.setAttribute('aria-pressed',x===b));opt.beta=+b.dataset.b;run()}));
$('o-aviso').addEventListener('change',e=>{opt.aviso=e.target.checked;run()});
$('o-alab').addEventListener('change',e=>{opt.alaB=e.target.checked;run()});
$('scrub').max=END-START-1; $('scrub').value=cur;
$('scrub').addEventListener('input',e=>{cur=+e.target.value;readout()});
window.addEventListener('resize',()=>draw());
if(window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>draw());
new MutationObserver(()=>draw()).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
legend(); run();
