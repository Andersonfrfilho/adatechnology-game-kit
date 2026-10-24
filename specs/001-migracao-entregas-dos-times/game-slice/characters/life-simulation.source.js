function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const FEM=new Set(["zilda","mariana","rafa","jessica","rosa","bianca","livia","nicole","neide","helena","ivone","cida","renata","taina","lucia","paula","vitoria"]);
const REG={igreja:.008,deleg:.008,radio:.006,oficina:.005,colegio:.004,hospital:.008,vila:.004,aurora:.002,fabril:.005,armas:.008,oeste:.002,serra:.0015,base:.02,nomade:.006,bloqueio:.005,prf:.004,penit:.006,falcao:.007};
const EXPO={kauan:.8,biel:.6,gil:.5,lucas:.5,lince:.6,paula:.5,kevin:.5,douglas:.6,lucia:.5,profeta:.5,dito:.4,tadeu:.4,ferraz:.4,caio:.3,bigode:.4,brasa:.3,italo:.4,chico:.4,armando:.2,zilda:.1,nelson:.2,jessica:.2,renata:.1,criancas:.05,mariana:.05,livia:.2,taina:.1};
const NM={m:["João","Paulo","Marcos","André","Rafael","Thiago","Bruno","Luiz","Sérgio","Wagner","Cícero","Edson","Igor","Mateus","Renan","Hugo"],f:["Ana","Patrícia","Juliana","Camila","Sandra","Luana","Márcia","Fernanda","Aline","Rita","Jaqueline","Simone","Larissa","Bruna","Tereza","Vanessa"],s:["Silva","Santos","Oliveira","Souza","Pereira","Lima","Carvalho","Gomes","Ribeiro","Martins","Rocha","Almeida","Barbosa","Teixeira","Moraes","Cunha"],
 bm:["Davi","Miguel","Gael","Bento","Noah","Theo"],bf:["Esperança","Aurora","Cecília","Luna","Maria Luz","Alice"]};
const RELW={m:["irmão","primo","ex-aluno","vizinho","colega de trabalho","afilhado","filho"],f:["irmã","prima","ex-aluna","vizinha","colega de trabalho","afilhada","filha"]};
const HOSTB=F=>({deleg:!!F.brasaDomina,serra:true,penit:!!F.penitArmada,bloqueio:!!F.bloqueioHostil});
const CAP=104,ROOM=8;
const COUPLES=[["diego","nicole"],["zilda","arnaldo"]];
let GEN={};
const NICK={ferraz:"Ferraz",lince:"Lince",azevedo:"Major Azevedo",sato:"Dr. Sato",criancas:"as crianças da Zilda",armando:"Armando",jacare:"Jacaré",profeta:"Profeta"};
const short=n=>{const q=n.match(/“(.*?)”/);if(q)return q[1];return n.replace(/^(Dona|Seu|Dr\.|Tenente|Sargento|Soldado|Pastora|Cabo|Capitão|Major) /,"").split(" ")[0]};
function world(){const W={raid:{},food:{},def:{},aff:{},part:{},rival:{},adot:{},T:{},gen:{},n:0,last:{},st:{nasc:0,cheg:0,mort:0,casais:0,brigas:0,trai:0,carav:0,ataques:0,gravidez:0}};
 Object.entries(GROUPS).forEach(([k,g])=>{W.food[k]=g.food;W.def[k]=g.def});W.def.jogador=1;
 RELS.forEach(r=>{if(r[2]==="odio")W.rival[r[0]<r[1]?r[0]+"|"+r[1]:r[1]+"|"+r[0]]=1});
 COUPLES.forEach(([a,b])=>{W.part[a]=b;W.part[b]=a});W.used=new Set();return W}
function life(d,S,F,R,W,log){
 const P=id=>byId[id]||W.gen[id];
 const age=id=>{const i=P(id).i;return typeof i==="number"?i:8};
 const fem=id=>FEM.has(id)||(W.gen[id]&&W.gen[id].f);
 const nm=id=>NICK[id]||short(P(id).n);
 const o=id=>fem(id)?"a":"o";
 const pers=id=>P(id).p&&P(id).p.some(v=>v)?P(id).p:[50,50,50,50,50];
 const anchor=id=>EV.some(e=>e.who.includes(id)&&e.d>d&&e.d<=d+7)||!!(W.T[id]&&W.T[id].due)||(id==="taina"&&d<38)||!!(W.gen[id]&&W.gen[id].baby);
 const alive=id=>["ok","ferido","mudou","hostil"].includes(S[id].st);
 const ids=Object.keys(S).filter(id=>alive(id)&&age(id)>0);
 const set=(id,st,nt,b)=>{const c=S[id].st;if(["morto","partiu"].includes(c)||(c==="zumbi"&&st!=="morto"))return;S[id]={st,nt,b:b||S[id].b}};
 const say=(t,txt,ch,b)=>{log.push({d,t,txt,ch:ch||[],emg:1});if(b)W.last[b]=d};
 const kill=(id,nt,why)=>{set(id,"morto",nt);W.st.mort++;const p=W.part[id];if(p&&alive(p))return ` ${nm(p)} perde ${nm(id)}.`;return ""};
 const cnt=b=>Object.keys(S).filter(id=>alive(id)&&S[id].b===b).length;
 const pop=()=>Object.keys(S).filter(id=>alive(id)||S[id].st==="grupo").length;
 const key=(a,b)=>a<b?a+"|"+b:b+"|"+a;
 const aff=(a,b)=>{const k=key(a,b);if(W.aff[k]===undefined){const r=RELS.find(r=>(r[0]===a&&r[1]===b)||(r[0]===b&&r[1]===a));W.aff[k]=r?{fam:80,ali:60,odio:-60,seg:10,medo:-20}[r[2]]:10+((pers(a)[1]+pers(b)[1])/2-50)/5}return W.aff[k]};
 const addAff=(a,b,v)=>{const k=key(a,b);W.aff[k]=Math.max(-100,Math.min(100,aff(a,b)+v))};
 const pick=a=>a[Math.floor(R()*a.length)];
 const bestBase=()=>{const H=HOSTB(F);const c=Object.keys(GROUPS).filter(b=>b!=="nomade"&&b!=="base"&&!H[b]&&cnt(b)>0&&cnt(b)<ROOM);c.sort((a,b)=>W.food[b]*(.5+W.def[b])-W.food[a]*(.5+W.def[a]));return c.length?c[Math.floor(R()*Math.min(3,c.length))]:"nomade"};
 const newP=(o)=>{const id="g"+(++W.n);W.gen[id]=o;S[id]={st:"ok",nt:o.nt||"",b:o.g};GEN[id]=o;return id};

 if(F.casalRT&&!W.part.rosa&&!W.part.tadeu){W.part.rosa="tadeu";W.part.tadeu="rosa"}
 // 1. relógios: cura, reanimação, volta de sumido, parto
 Object.entries(W.T).forEach(([id,t])=>{
  if(t.heal===d&&S[id].st==="ferido")S[id].nt="curado";
  if(t.heal===d&&S[id].st==="ferido")S[id].st="ok";
  if(t.turn===d&&S[id].st==="mordido"){set(id,"zumbi",S[id].b==="nomade"?"zumbi nomeado na rua":"zumbi nomeado perto de "+(GROUPS[S[id].b]||{n:"onde morreu"}).n);say("Reanima",`${nm(id)} reanima e passa a vagar pela rotina antiga.`,[[id,"zumbi",S[id].nt]],S[id].b)}
  if(t.back===d&&S[id].st==="sumido"){if(R()<.6){set(id,"ok","voltou depois de sumir");say("Volta",`${nm(id)} aparece no portão, magro e sem as botas, depois de dias sumido.`,[[id,"ok","voltou"]])}else{const x=kill(id,"nunca voltou");say("Sem volta",`Acham as coisas de ${nm(id)} numa vala da estrada.${x}`,[[id,"morto","nunca voltou"]])}}
  if(t.due===d){t.due=0;if(!alive(id))return;const b=S[id].b;
   const med=["zilda","diego","paula","cida","sato","nicole"].some(m=>S[m]&&alive(m)&&S[m].b===b);
   const pm=med?.03:.15,pb=med?.05:.2;const dad=t.dad,sx=R()<.5?"f":"m";
   const bn=sx==="f"?pick(NM.bf):pick(NM.bm);
   const momDies=R()<pm&&!anchor(id),babyDies=R()<pb;
   let txt=`${nm(id)} dá à luz em ${(GROUPS[b]||{n:"campo aberto"}).n}${med?" com ajuda de quem sabe":", sem ninguém que saiba fazer parto"}.`;const ch=[];
   if(babyDies)txt+=" O bebê não respira. Enterram ao lado da base.";
   else{const bid=newP({n:bn+" "+P(id).n.split(" ").filter(x=>!/[“”]/.test(x)).slice(-1)[0],i:0,g:b,f:sx==="f",baby:1,mom:id,dad});W.st.nasc++;txt+=` Nasce ${bn}.`;ch.push([bid,"ok","recém-nascido",b])}
   if(momDies){txt+=kill(id,"no parto")+` ${nm(id)} não resiste ao parto.`;ch.push([id,"morto","no parto"])}
   say("Nascimento",txt,ch,b)}
 });
 ids.forEach(id=>{if(S[id].st==="ferido"&&!(W.T[id]&&W.T[id].heal>d)){W.T[id]=W.T[id]||{};W.T[id].heal=d+3+Math.floor(R()*8)}});

 // 2. risco diário
 ids.forEach(id=>{if(!alive(id)||anchor(id)||W.gen[id]&&W.gen[id].baby)return;const b=S[id].b;if(b==="jogador")return;
  const ex=W.gen[id]?(age(id)<12?.05:.35):(EXPO[id]??.3);
  const r=(REG[b]??.006)*ex*(1-(W.def[b]??0))*(W.food[b]<2?1.5:1)*(S[id].st==="ferido"?2:1)*(F.radioMuda?1.3:1);
  if(R()>=r)return;const x=R(),onde=(GROUPS[b]||{n:"a estrada"}).n;
  if(x<.5){set(id,"ferido","ferido fora da base");W.T[id]={...W.T[id],heal:d+3+Math.floor(R()*8)};say("Risco",`${nm(id)} volta ferid${o(id)} de uma saída perto de ${onde}.`,[[id,"ferido","ferido fora da base"]])}
  else if(x<.8){set(id,"mordido","mordido fora da base");W.T[id]={...W.T[id],turn:d+2};say("Risco",`${nm(id)} volta com uma mordida no antebraço e não conta a ninguém.`,[[id,"mordido","esconde a mordida"]],b)}
  else if(x<.95){const t=kill(id,"morto fora da base");say("Risco",`${nm(id)} não volta de uma saída perto de ${onde}.${t}`,[[id,"morto","não voltou"]],b)}
  else{set(id,"sumido","sumiu numa saída");W.T[id]={...W.T[id],back:d+2+Math.floor(R()*5)};say("Risco",`${nm(id)} some numa saída perto de ${onde}.`,[[id,"sumido","sumiu"]])}
 });

 // 3. laços dentro de cada base
 const by={};Object.keys(S).forEach(id=>{if(!alive(id)||age(id)<16)return;const b=S[id].b;if(!b||b==="jogador"||b==="nomade")return;(by[b]=by[b]||[]).push(id)});
 Object.entries(by).forEach(([b,m])=>{
  const quiet=W.last[b]>=d-2;
  for(let i=0;i<m.length;i++)for(let j=i+1;j<m.length;j++){const a=m[i],c=m[j],pa=pers(a),pc=pers(c);
   addAff(a,c,((pa[1]+pc[1])/2-50)/120+(W.food[b]<5?-(pa[3]+pc[3])/250:.1)+(R()-.5)*3);
   const v=aff(a,c),k=key(a,c);if(quiet||W.last[b]>=d)continue;
   if(!W.part[a]&&!W.part[c]&&age(a)>=18&&age(c)>=18&&Math.abs(age(a)-age(c))<=15&&v>=65&&R()<.03){W.part[a]=c;W.part[c]=a;W.aff[k]=90;W.st.casais++;
     say("Laço",`${nm(a)} e ${nm(c)} ${pick(["começam a dividir o turno de vigia, e depois o colchão","se beijam no telhado durante a rádio das 20h","assumem o namoro na frente da base inteira"])}.`,[],b);continue}
   if(W.part[a]===c&&W.food[b]>=8){const f=fem(a)&&!fem(c)?a:fem(c)&&!fem(a)?c:null;
     if(f&&age(f)<=42&&!(W.T[f]&&W.T[f].due)&&!EV.some(e=>(e.who.includes(a)||e.who.includes(c))&&e.d>d&&e.d<=d+20)&&R()<.02){W.T[f]={...W.T[f],due:d+45,dad:f===a?c:a};W.st.gravidez++;say("Gravidez",`${nm(a)} e ${nm(c)} vão ter um bebê. Nasce em uns 45 dias de jogo.`,[],b);continue}
     if(!f&&!W.adot[k]&&R()<.01){const orf=Object.keys(S).find(o=>alive(o)&&S[o].b===b&&(o==="criancas"||(W.gen[o]&&W.gen[o].baby&&!alive(W.gen[o].mom))));
       if(orf){W.adot[k]=1;say("Adoção",`${nm(a)} e ${nm(c)} adotam ${orf==="criancas"?"um dos três órfãos":nm(orf)}.`,[],b);continue}}}
   if(!W.rival[k]&&v<=-50){W.rival[k]=1;say("Rixa",`${nm(a)} e ${nm(c)} ${pick(["brigam pela última lata de sardinha","discutem aos gritos sobre quem dorme perto da porta","se acusam de roubar ração"])}. Viraram rivais.`,[],b);continue}
   if(W.rival[k]&&v<=-70&&Math.max(pa[0],pc[0])>=60&&R()<.2){W.st.brigas++;W.aff[k]=-40;const x=R(),lo=pa[0]<pc[0]?a:c,hi=lo===a?c:a;
     if(x<.6&&!anchor(lo)){set(lo,"ferido","briga com "+nm(hi));W.T[lo]={...W.T[lo],heal:d+3+Math.floor(R()*5)};say("Briga",`A rixa explode: ${nm(hi)} quebra o nariz de ${nm(lo)} no pátio.`,[[lo,"ferido","briga"]],b)}
     else if(x<.7&&!anchor(lo)){const t=kill(lo,"morto numa briga com "+nm(hi));say("Briga",`A rixa termina com faca: ${nm(lo)} morre e ${nm(hi)} carrega a morte para o resto da vida.${t}`,[[lo,"morto","briga"]],b)}
     else{const out=pa[2]<pc[2]?a:c,dest=bestBase();if(dest!==b&&!anchor(out)){set(out,"mudou","foi embora depois da briga",dest);say("Briga",`${nm(out)} junta as coisas e vai para ${GROUPS[dest].n} depois da briga com ${nm(out===a?c:a)}.`,[[out,"mudou",GROUPS[dest].n,dest]],b)}}}
  }
  // traição
  m.forEach(id=>{const p=pers(id);if(quiet||W.last[b]>=d||!alive(id)||anchor(id))return;
   if(p[2]<35&&p[3]>60&&W.food[b]<5&&R()<.03){const dest=F.brasaDomina&&L(S,"brasa")&&b!=="deleg"?"deleg":L(S,"profeta")&&b!=="serra"?"serra":"nomade";W.food[b]=Math.max(0,W.food[b]-4);W.st.trai++;
    set(id,byId[id]?"hostil":"mudou",`roubou ${GROUPS[b].n} e foi para ${GROUPS[dest].n}`,dest);m.forEach(o=>o!==id&&addAff(id,o,-40));
    say("Traição",`${nm(id)} some de madrugada com a comida da despensa e o rádio de ${GROUPS[b].n}. Dias depois é visto em ${GROUPS[dest].n}.`,[[id,S[id].st,"traiu a base",dest]],b)}});
 });

 // 4. comida, caravanas e ataques entre bases
 Object.keys(W.food).forEach(b=>{W.food[b]=Math.max(0,Math.min(60,W.food[b]+(b==="oeste"?.15:b==="penit"&&F.penitFeira?.05:-.11)))});
 const H=HOSTB(F);
 Object.entries(by).forEach(([b,m])=>{if(W.food[b]>=5||W.last[b]>=d-2)return;
  for(const x of m)for(const [c,mc] of Object.entries(by)){if(c===b||H[c]||W.food[c]<=12)continue;const y=mc.find(y=>aff(x,y)>=55);if(!y||R()>=.12)continue;
   W.food[b]+=5;W.food[c]-=5;addAff(x,y,10);W.st.carav++;let t=`Caravana: ${nm(y)} atravessa a cidade com comida de ${GROUPS[c].n} para ${GROUPS[b].n}, onde mora ${nm(x)}.`;const ch=[];
   if(R()<.08&&!anchor(y)){set(y,"ferido","ferido na caravana");W.T[y]={...W.T[y],heal:d+4};t+=` Na volta, ${nm(y)} é atacad${o(y)} na avenida e chega ferid${o(y)}.`;ch.push([y,"ferido","caravana"])}
   say("Entre bases",t,ch,b);return}
 });
 [["deleg",F.brasaDomina&&L(S,"brasa"),"Os homens do Brasa"],["serra",F.corvosOeste&&L(S,"profeta"),"Os Corvos"],["penit",F.penitArmada&&L(S,"jacare"),"Os presos do Jacaré"]].forEach(([src,on,who])=>{
  if(!on||R()>=.03||(W.raid[src]||0)>d-10)return;const alvo=Object.keys(by).filter(b=>b!==src&&!H[b]&&b!=="bloqueio"&&W.food[b]>=3).sort((a,b)=>W.def[a]-W.def[b]+(R()-.5)*.3)[0];if(!alvo||W.last[alvo]>=d-2)return;W.raid[src]=d;
  const v=pick(by[alvo]);W.st.ataques++;const loot=Math.min(5,W.food[alvo]);W.food[alvo]-=loot;W.food[src]=(W.food[src]||0)+loot;
  const hero=Object.entries(by).filter(([b])=>b!==alvo&&!H[b]).flatMap(([,mm])=>mm).find(h=>pers(h)[0]>=70&&by[alvo].some(o=>aff(h,o)>=60));
  let t=`${who} atacam ${GROUPS[alvo].n} de madrugada e levam ${Math.round(loot)} dias de comida.`;const ch=[];
  if(hero&&R()<.5){t+=` ${nm(hero)}, de ${GROUPS[S[hero].b].n}, ouve os tiros e chega a tempo: ${nm(v)} sai só ferid${o(v)}.`;set(v,"ferido","ferido no ataque");W.T[v]={...W.T[v],heal:d+5};addAff(hero,v,20);ch.push([v,"ferido","ataque"])}
  else if(R()<.25&&!anchor(v)){t+=kill(v,"morto no ataque de "+GROUPS[src].n)+` ${nm(v)} morre na porta.`;ch.push([v,"morto","ataque"])}
  else if(!anchor(v)){set(v,"ferido","ferido no ataque");W.T[v]={...W.T[v],heal:d+5};t+=` ${nm(v)} leva um tiro de raspão.`;ch.push([v,"ferido","ataque"])}
  say("Ataque",t,ch,alvo)});

 // 5. chegadas pela estrada, trilho e serra
 if(d%5===0){let n=R()<(d>60?.25:.5)?1+(R()<.3?1:0):0;while(n-->0&&pop()<CAP){
  const f=R()<.5;let nome;do{nome=pick(f?NM.f:NM.m)+" "+pick(NM.s)}while(W.used.has(nome.split(" ")[0])&&W.used.size<30);W.used.add(nome.split(" ")[0]);const origem=pick(["pela BR-Sul","pelo pátio de trens","pela trilha da serra"]);
  const bond=pick(NPCS.filter(x=>typeof x.i==="number"&&x.i>=16)).id,rel=pick(RELW[f?"f":"m"]);
  const st=S[bond].st,live=alive(bond)||st==="grupo";let b=live&&S[bond].b!=="jogador"&&S[bond].b!=="nomade"&&!H[S[bond].b]&&cnt(S[bond].b)<ROOM?S[bond].b:bestBase();
  const id=newP({n:nome,i:18+Math.floor(R()*42),g:b,f,p:[20+R()*70,20+R()*70,20+R()*70,10+R()*70,20+R()*70].map(Math.round),bond,rel});W.st.cheg++;
  let t=`${nome.split(" ")[0]}, ${rel} de ${nm(bond)}, chega ${origem}`+(origem==="pela BR-Sul"&&L(S,"lucia")&&S.lucia.b==="prf"?" e a Lúcia anota o nome no livro da PRF":"")+".";
  if(!live)t+=` Vinha procurando ${nm(bond)} e descobre que ${nm(bond)} ${{morto:"morreu",zumbi:"virou um dos mortos",partiu:"saiu do vale no ônibus",sumido:"sumiu",mordido:"foi mordido"}[st]||"não está mais aqui"}. Fica em ${GROUPS[b].n}.`;
  else{t+=st==="grupo"?` Pergunta por ${nm(bond)} e descobre que está com o jogador. Fica em ${GROUPS[b].n} esperando.`:b===S[bond].b?` Encontra ${nm(bond)} em ${GROUPS[b].n} e fica.`:` Descobre que ${nm(bond)} está em ${(GROUPS[S[bond].b]||{n:"lugar nenhum"}).n} e prefere ficar em ${GROUPS[b].n}.`;W.aff[key(id,bond)]=75}
  if(L(S,"jessica")||L(S,"nelson"))t+=" A rádio anuncia a chegada às 20h.";
  const ch=[[id,"ok","chegou "+origem,b]];
  if(R()<.2&&pop()<CAP){const pf=!f;let n2;do{n2=pick(pf?NM.f:NM.m)}while(W.used.has(n2)&&W.used.size<30);W.used.add(n2);const sob=nome.split(" ").slice(-1)[0];
   const id2=newP({n:n2+" "+sob,i:Math.max(18,W.gen[id].i+Math.floor(R()*9)-4),g:b,f:pf,p:[1,2,3,4,5].map(()=>Math.round(20+R()*70)),bond,rel:"par de "+nome.split(" ")[0]});W.st.cheg++;
   W.part[id]=id2;W.part[id2]=id;ch.push([id2,"ok","chegou "+origem,b]);const mae=pf?id2:id;
   if(R()<.35&&W.gen[mae].i<=42){W.T[mae]={due:d+10+Math.floor(R()*30),dad:mae===id?id2:id};W.st.gravidez++;t+=` Vem com ${n2}, e ${nm(mae)} está grávida.`}else t+=` Vem com ${n2}.`}
  say("Chegada",t,ch,null)}}
}

// os pontos com d:88 só valem se ninguém ouviu (estado ok sem rádio)
function apply(S,ch){(ch||[]).forEach(([id,st,nt,b])=>{if(!S[id])return;
  // mortos e zumbis não voltam; partiu é final
  const cur=S[id].st; if(["morto","partiu"].includes(cur))return; if(cur==="zumbi"&&st!=="morto")return;
  S[id]={st,nt,b:b||(st==="grupo"?"jogador":S[id].b)}})}
function simulate(day,A,O={}){
  const S=mk(),F={},log=[],R=O.vivo?rng(O.seed||1):null,W=R?world():null;GEN=W?W.gen:{};
  if(W&&O.fill){let i=0;const bs=Object.keys(GROUPS).filter(b=>!["nomade","base"].includes(b));
    while(Object.values(S).filter(s=>LIVE.includes(s.st)).length<O.fill){const b=bs[i++%bs.length];if(Object.values(S).filter(s=>LIVE.includes(s.st)&&s.b===b).length>=8)continue;
      const id="g"+(++W.n),f=R()<.5;W.gen[id]={n:(f?NM.f:NM.m)[W.n%16]+" "+NM.s[W.n%16],i:18+Math.floor(R()*40),g:b,f,p:[1,2,3,4,5].map(()=>Math.round(20+R()*70))};S[id]={st:"ok",nt:"",b}}}
  let k=0;const t0=performance.now();
  for(let d=1;d<=day;d++){
    while(k<EV.length&&EV[k].d===d){const e=EV[k++];const r=e.run(S,A,F);if(!r)continue;
      apply(S,r.ch);Object.assign(F,r.fl||{});log.push({d,t:e.t,txt:r.txt,alt:r.alt,ch:r.ch||[]})}
    if(R)life(d,S,F,R,W,log);
  }
  return {S,F,log,W,ms:performance.now()-t0};
}

/* ---------- render ---------- */
const $=s=>document.querySelector(s);
