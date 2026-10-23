// fonte: site/pages/zumbis-personagens/personagens.html
// texto visível: ZombiAdA Personagens ZombiAdA · documento de design · personagens Ficha do sobrevivente Como o jogador nasce, o que ele sabe fazer, do que ele precisa para não morrer, e quem são as pessoas que ainda estão vivas na cidade. Tudo aqui é proposta inicial, com números pensados para serem ajustados em playtest. Ver a arte 3D do elenco: profissões, NPCs e fases da infecção Criador Atributos Habilidades Profissões Traços Necessidades Infecção NPCs Vida própria Modelo de dados Teste a regra Criador de personagem Cada atributo começa em 3 e você tem 14 pontos. Profissão e traços negativos dão pontos extras; traços positivos custam. O painel da direita mostra o que muda no jogo, incluindo se um zumbi corredor te alcança. Nome Profissão antes do surto 14 pontos livres Traços Ana Beatriz Lopes Enfermeira(o) Escala 1 a 10 · máximo 8 na criação Atributos Seis atributos, todos com uso físico ou social claro. Eles quase não sobem depois da criação (no máximo +2 em toda a vida do personagem, por treino longo), então a escolha inicial pesa. Quem cresce de verdade são as habilidades. Atributo O que afeta Fórmulas iniciais Como treinar (+1 raro) Força Dano corpo a corpo, peso carregado, empurrar zumbis, arrombar portas, recuo de armas pesadas Carga = 8 + 2,5×FOR kg Dano CaC = +6% por ponto acima de 5 Carregar &gt;80% de carga por 30 dias, exercício Vigor Vida, fôlego, resistência a doença, fome e frio Vida = 70 + 6×VIG Fôlego = 40 + 6×VIG + 4×AGI Corrida e trabalho braçal diário Agilidade Velocidade de corrida, pular cercas, esquiva de agarrão, ruído dos passos Corrida = 5,2 + 0,12×AGI m/s Esquiva = 4% por ponto Parkour, fuga sob perseguição Percepção Raio para ouvir e ver zumbis, achar loot escondido, precisão à distância, ver armadilhas Raio = 12 + 2×PER m Dispersão −3% por ponto Vigia em telhado, caça Intelecto Velocidade de aprendizado, leitura de livros, crafting complexo, química e medicina XP = 70% + 6% por ponto Ler livros técnicos até o fim Presença Convencer, recrutar e liderar NPCs, preços em troca, controle do medo do grupo Recrutar = base NPC + 5% por ponto Preço −3% por ponto Liderar grupo por 15 dias sem morte Compostura (derivado) Não é atributo comprável. Mede quanto pânico você aguenta antes de tremer a mira e fazer barulho. Compostura = 20 + 3×VIG + 4×PRE, ajustada por traços. Pânico sobe com zumbis à vista (+2 por zumbi andante, +5 por corredor), com companheiro morto (+30) e com fome/sono; cai com tempo em lugar seguro, música, cigarro e conversa com NPC de confiança. Nível 0 a 10 · aprende fazendo Habilidades São 24 habilidades em cinco grupos. Sobem fazendo a ação, lendo livros e revistas que multiplicam XP, ou recebendo aula de um NPC que tem a habilidade 3 níveis acima. Nos níveis 3, 6 e 9 cada habilidade libera uma técnica específica. Fonte de XP Efeito Limite Fazer a ação XP base, maior quando há risco real (zumbi perto, ferido) Ações repetidas no mesmo minuto rendem cada vez menos Livro de habilidade (vol. 1 a 5) XP ×3 em uma faixa de 2 n

// ===== script 0 (19 KB)

const ATTRS=[
 {k:"for",n:"Força",d:"Dano corpo a corpo, peso carregado, arrombar portas"},
 {k:"vig",n:"Vigor",d:"Vida, fôlego, resistência a doença e fome"},
 {k:"agi",n:"Agilidade",d:"Velocidade, esquiva, passos silenciosos"},
 {k:"per",n:"Percepção",d:"Raio de detecção, achar loot, precisão"},
 {k:"int",n:"Intelecto",d:"Velocidade de aprendizado, crafting, medicina"},
 {k:"pre",n:"Presença",d:"Recrutar NPCs, negociar, acalmar o grupo"}];

const SKILLS=[
 {g:"Combate",items:[
  ["Pistolas e revólveres","Troca rápida de carregador","Tiro duplo controlado","Mira de reflexo sem desacelerar"],
  ["Fuzis e carabinas","Respiração presa (mira estável 3 s)","Tiro na cabeça a 150 m sem luneta","Recarga tática mantendo cano no alvo"],
  ["Espingardas","Recarga em movimento","Empurrão com a coronha","Tiro de dispersão controlada"],
  ["Armas contundentes","Golpe de atordoamento","Derrubar dois de uma vez","Golpe fatal no crânio caído"],
  ["Armas cortantes","Decapitar com facão","Esfaqueamento silencioso por trás","Combo de três golpes sem perder fôlego"],
  ["Arremesso","Garrafa para distrair horda","Molotov com arco maior","Faca de arremesso letal"]]},
 {g:"Sobrevivência",items:[
  ["Primeiros socorros","Sutura","Remover projétil","Amputação com chance de sobreviver +10%"],
  ["Culinária","Conservas que duram meses","Pratos que dão moral","Cozinhar sem fumaça visível"],
  ["Agricultura","Compostagem","Estufa no inverno","Colheita dupla"],
  ["Caça e armadilhas","Armadilha de laço","Ler rastros de animais e zumbis","Armadilha de estacas para hordas"],
  ["Busca","Achar compartimentos escondidos","Saber o que tem dentro sem abrir","Loot raro +15%"],
  ["Pesca","Linha de espera","Rede","Peixe grande"]]},
 {g:"Técnico",items:[
  ["Mecânica","Ligação direta","Trocar motor","Carro blindado artesanal"],
  ["Elétrica","Ligar gerador na casa","Rádio caseiro","Cerca elétrica"],
  ["Carpintaria","Tábuas nas janelas","Muro de madeira","Torre de vigia"],
  ["Metalurgia","Solda em chapa","Portão de aço","Blindagem de veículo"],
  ["Armeiro","Limpar e evitar pane","Recarregar munição (estojo, espoleta, pólvora)","Adaptar peças entre modelos"],
  ["Química","Pólvora negra","Antibiótico caseiro","Explosivo improvisado"]]},
 {g:"Físico",items:[
  ["Corrida","Arrancada curta sem gastar fôlego","Pular cerca sem parar","Corrida longa: fôlego −30%"],
  ["Furtividade","Agachado mais rápido","Passar por zumbi parado","Invisível no escuro a 3 m"],
  ["Escalada","Subir em muro","Telhados conectados","Descer de corda"],
  ["Condicionamento","Carga +10%","Dano recebido −10%","Ignora 1 nível de dor"]]},
 {g:"Social",items:[
  ["Liderança","Dar ordens simples ao grupo","Grupo não entra em pânico perto de você","Recrutar NPC hostil"],
  ["Negociação","Ver o preço real das coisas","Trocas a crédito","Convencer grupo rival a recuar"]]}];

const PROFS=[
 {id:"enf",n:"Enfermeira(o)",pts:-2,sk:{"Primeiros socorros":3,"Química":1},b:"Vê a gravidade exata de ferimentos e sabe se um ferimento infeccionou",kit:"Kit de primeiros socorros, luvas"},
 {id:"pm",n:"Policial militar",pts:-4,sk:{"Pistolas e revólveres":3,"Fuzis e carabinas":1,"Armas contundentes":1},b:"Pânico −25% em combate; abre viaturas e delegacias sem chave",kit:"Revólver .38 com 6 balas, cassetete"},
 {id:"bomb",n:"Bombeiro(a)",pts:-3,sk:{"Primeiros socorros":2,"Condicionamento":2,"Armas cortantes":1},b:"Imune a fumaça leve; arromba portas com machado 2× mais rápido",kit:"Machado de bombeiro"},
 {id:"mec",n:"Mecânico(a)",pts:-1,sk:{"Mecânica":3,"Metalurgia":1},b:"Sabe o estado de qualquer veículo só de olhar",kit:"Caixa de ferramentas"},
 {id:"ped",n:"Pedreiro / obras",pts:-1,sk:{"Carpintaria":2,"Metalurgia":1,"Condicionamento":1},b:"Barricadas com +30% de resistência",kit:"Martelo, pregos"},
 {id:"coz",n:"Cozinheiro(a)",pts:0,sk:{"Culinária":3,"Armas cortantes":1},b:"Comida estraga 40% mais devagar sob seu cuidado",kit:"Faca de chef"},
 {id:"cac",n:"Atirador esportivo",pts:-4,sk:{"Fuzis e carabinas":2,"Pistolas e revólveres":2,"Armeiro":1},b:"Reconhece calibre e munição compatível na hora; pane −30%",kit:"Pistola 9 mm sem munição"},
 {id:"agr",n:"Agricultor(a)",pts:0,sk:{"Agricultura":3,"Caça e armadilhas":1},b:"Planta sem livro; sabe a época de cada cultura",kit:"Sementes, enxada"},
 {id:"ele",n:"Eletricista",pts:-1,sk:{"Elétrica":3,"Escalada":1},b:"Liga gerador sem risco de choque",kit:"Alicate, fita isolante"},
 {id:"moto",n:"Motoboy",pts:0,sk:{"Corrida":1,"Mecânica":1,"Escalada":1},b:"Conhece as ruas: o mapa da cidade já começa revelado",kit:"Capacete (protege cabeça), moto sem gasolina"},
 {id:"prof",n:"Professor(a)",pts:2,sk:{"Liderança":1,"Química":1},b:"Ensina outros com XP ×2,5 em vez de ×2",kit:"Livro de química vol. 1"},
 {id:"des",n:"Desempregado(a)",pts:8,sk:{},b:"Nenhum, mas muito mais pontos livres",kit:"Nada"}];

const TRAITS=[
 {id:"atleta",n:"Atleta",c:-4,e:"Fôlego +25%, corrida +0,3 m/s",x:["sedent","asma"]},
 {id:"olhos",n:"Olhos de águia",c:-3,e:"Raio de detecção +25%",x:["miope"]},
 {id:"frio",n:"Sangue frio",c:-4,e:"Compostura +40%",x:["medroso"]},
 {id:"rapido",n:"Aprende rápido",c:-5,e:"XP +30% em tudo",x:["lento"]},
 {id:"silen",n:"Pés leves",c:-3,e:"Ruído dos passos −30%",x:["desaj"]},
 {id:"org",n:"Organizado",c:-3,e:"Carga +20%",x:[]},
 {id:"touro",n:"Corpo resistente",c:-4,e:"Vida +15, sangra 25% menos",x:["hemo"]},
 {id:"sono",n:"Sono leve",c:-2,e:"Acorda com ruído a 15 m",x:["pesado"]},
 {id:"fumante",n:"Fumante",c:3,e:"Estresse sobe sem cigarro; pode largar em 20 dias",x:[]},
 {id:"asma",n:"Asmático",c:4,e:"Fôlego −30%",x:["atleta"]},
 {id:"miope",n:"Míope",c:3,e:"Raio −30% até achar óculos",x:["olhos"]},
 {id:"desaj",n:"Desajeitado",c:3,e:"Ruído +30%, derruba coisas",x:["silen"]},
 {id:"medroso",n:"Medroso",c:4,e:"Compostura −40%",x:["frio"]},
 {id:"sedent",n:"Sedentário",c:3,e:"Fôlego −20%, corrida −0,3 m/s",x:["atleta"]},
 {id:"hemo",n:"Sangra fácil",c:5,e:"Sangramento ×2",x:["touro"]},
 {id:"lento",n:"Aprende devagar",c:4,e:"XP −30%",x:["rapido"]},
 {id:"pesado",n:"Sono pesado",c:2,e:"Não acorda com barulho",x:["sono"]},
 {id:"glutao",n:"Come muito",c:2,e:"Fome +30%",x:[]}];

const NPCS=[
 {n:"Dona Zilda Ramos",i:67,o:"Enfermeira aposentada",loc:"Igreja Matriz, centro",
  h:"Trabalhou 38 anos no hospital municipal. Quando o surto começou, abriu a igreja para feridos e ficou. Acredita que todo mundo merece ser cuidado, até o final. Cuida de quatro crianças órfãs que encontrou nas primeiras semanas.",
  p:{coragem:55,empatia:95,lealdade:80,ganancia:5,estabilidade:60},
  r:[["06:00","Reza e acende velas"],["07:00","Prepara mingau para as crianças"],["09:00","Atende feridos que chegam"],["14:00","Lava curativos e ferve água"],["18:00","Tranca a igreja"],["21:00","Desce ao porão sozinha"]],
  g:"Achar insulina para uma das crianças, que é diabética.",
  s:"O marido dela, Seu Arnaldo, foi mordido. Ela o mantém acorrentado no porão e leva comida todas as noites.",
  o2:"Trata ferimentos, ensina Primeiros Socorros até nível 7."},
 {n:"Tenente Marcos “Brasa” Valença",i:41,o:"Ex-policial militar",loc:"Delegacia do 4º DP",
  h:"Comandava a evacuação do bairro. Quando a linha caiu, juntou seis homens e tomou a delegacia, que tem armário de armas e muro alto. Mantém ordem na base com regras rígidas e cobra pedágio de quem passa na avenida.",
  p:{coragem:90,empatia:25,lealdade:65,ganancia:55,estabilidade:45},
  r:[["05:30","Treino físico com o grupo"],["07:00","Distribui turnos de vigia"],["10:00","Patrulha armada na avenida"],["15:00","Inventário do armamento"],["19:00","Reunião, julga quem quebrou regras"],["23:00","Bebe sozinho no telhado"]],
  g:"Transformar a delegacia na única autoridade da cidade.",
  s:"Na evacuação, mandou fechar o portão com civis do lado de fora para salvar os ônibus. Uma das sobreviventes, Jéssica, perdeu a mãe nesse portão.",
  o2:"Vende munição de .38 e 9 mm, ensina Pistolas. Pode virar inimigo."},
 {n:"Kauã Ferreira",i:19,o:"Motoboy de entregas",loc:"Nômade, dorme em telhados",
  h:"Conhece cada beco porque fazia entrega em todos. Sobrevive correndo e não confia em grupo nenhum. Procura a irmã mais nova, que estava na escola no dia do surto.",
  p:{coragem:70,empatia:60,lealdade:40,ganancia:30,estabilidade:50},
  r:[["06:00","Sai antes do sol para explorar"],["08:00","Saqueia lojas pequenas"],["12:00","Troca itens na igreja ou na oficina"],["16:00","Vai até uma escola diferente procurar a irmã"],["19:00","Sobe em um telhado para dormir"]],
  g:"Achar a irmã Lívia, que pode estar com o grupo do Dr. Sato.",
  s:"Ele carrega um rádio que capta a rádio da Jéssica e sabe que tem alguém pedindo socorro do lado norte do rio.",
  o2:"Revela rotas e esconderijos no mapa, ensina Corrida e Escalada."},
 {n:"Rosa Tavares",i:34,o:"Mecânica de oficina",loc:"Auto Center Tavares, saída da cidade",
  h:"Herdou a oficina do pai. Soldou chapas nas janelas na primeira semana e transformou o lugar em fortaleza. Faz trocas justas, mas não dá nada de graça. Quer consertar um ônibus para tirar todo mundo da cidade.",
  p:{coragem:75,empatia:50,lealdade:70,ganancia:45,estabilidade:80},
  r:[["07:00","Café preto e checa as armadilhas"],["08:00","Trabalha no ônibus"],["12:00","Abre a janela de troca"],["15:00","Vai buscar peças com quem estiver junto"],["20:00","Escuta rádio e anota informações"]],
  g:"Terminar o ônibus blindado e achar diesel suficiente.",
  s:"Ela já tem o diesel guardado, mas só vai revelar a quem tiver opinião +70, porque teme que o Tenente Brasa tome tudo.",
  o2:"Conserta veículos, blinda carros, ensina Mecânica e Metalurgia."},
 {n:"Otávio Lins",i:52,o:"Professor de química",loc:"Colégio Estadual, laboratório",
  h:"Ficou trancado no laboratório com três alunos. Dois morreram. Hoje fabrica pólvora, sabão e antisséptico, e troca isso por comida. Bebe álcool de laboratório para dormir.",
  p:{coragem:20,empatia:70,lealdade:55,ganancia:20,estabilidade:25},
  r:[["08:00","Acorda tarde, com dor de cabeça"],["09:00","Prepara reagentes"],["13:00","Escreve no diário dos alunos mortos"],["16:00","Produz pólvora ou sabão"],["22:00","Bebe e fala sozinho"]],
  g:"Proteger a aluna que sobrou, Bianca, e conseguir mais enxofre.",
  s:"Ele sabe fazer explosivos fortes o bastante para derrubar a ponte e isolar a cidade de uma horda, mas tem medo do que o Tenente faria com isso.",
  o2:"Ensina Química e recarga de munição, vende pólvora. Pode surtar se a moral cair."},
 {n:"Seu Benedito “Dito” Alves",i:71,o:"Agricultor e caçador",loc:"Sítio Boa Vista, zona rural",
  h:"Vive no mesmo sítio há 50 anos. Para ele, o fim do mundo mudou pouco: planta, caça e não gosta de gente da cidade. Tem uma espingarda calibre 12 e um cachorro, Trovão.",
  p:{coragem:80,empatia:40,lealdade:90,ganancia:10,estabilidade:90},
  r:[["04:30","Ordenha a vaca"],["06:00","Cuida da roça"],["11:00","Almoço no fogão a lenha"],["14:00","Verifica armadilhas na mata"],["18:00","Fecha a porteira e solta o Trovão"],["20:00","Dorme cedo"]],
  g:"Que deixem ele em paz e que alguém cuide do sítio quando ele morrer.",
  s:"Enterrou a família inteira no pomar. Se o jogador cuidar do túmulo, ele passa a considerar o jogador como neto e deixa o sítio de herança.",
  o2:"Ensina Agricultura e Caça, troca comida fresca. Base perfeita se ganhar a confiança."},
 {n:"Jéssica Monteiro",i:27,o:"Locutora de rádio comunitária",loc:"Torre da Rádio Vale FM",
  h:"Faz uma transmissão diária às 20h com notícias, avisos de hordas e músicas. Virou a voz da cidade. Perdeu a mãe no portão da evacuação e quer justiça.",
  p:{coragem:65,empatia:80,lealdade:60,ganancia:15,estabilidade:40},
  r:[["09:00","Escuta frequências e anota"],["11:00","Conserta equipamento com gerador"],["14:00","Recebe informantes"],["20:00","Transmissão ao vivo de 30 min"],["22:00","Escreve o roteiro de amanhã"]],
  g:"Expor o que o Tenente Brasa fez e organizar uma assembleia dos grupos.",
  s:"O gerador da rádio faz barulho e atrai zumbis. Ela sabe que uma horda grande está se juntando ao pé da torre e não contou a ninguém.",
  o2:"Avisos de horda no rádio, missões de comunicação. Ensina Elétrica."},
 {n:"Dr. Henrique Sato",i:45,o:"Médico infectologista",loc:"Hospital Regional, ala isolada",
  h:"Estudava doenças tropicais quando o surto começou. Acha que pode entender a infecção. Mantém zumbis presos para pesquisa e um pequeno grupo de jovens que ele protege em troca de ajuda.",
  p:{coragem:60,empatia:35,lealdade:30,ganancia:40,estabilidade:65},
  r:[["06:00","Anota o estado dos zumbis presos"],["08:00","Autópsia"],["12:00","Almoça sozinho lendo artigos"],["15:00","Manda o grupo buscar remédios"],["21:00","Grava diário em fita"]],
  g:"Observar uma pessoa mordida desde o início até a reanimação.",
  s:"Ele não procura uma cura (a regra do jogo é que não existe). Quer entender como os corredores surgem, e para isso aceita infectar alguém de propósito. A irmã do Kauã está no grupo dele.",
  o2:"Vende antibiótico e analgésico, revela informações sobre tipos de zumbi. Moralmente perigoso."}];

const S={a:{for:3,vig:3,agi:3,per:3,int:3,pre:3},prof:"enf",traits:new Set()};
const BASE_POOL=14,MAXC=8,MINC=1;
const $=s=>document.querySelector(s);

function prof(){return PROFS.find(p=>p.id===S.prof)}
function spent(){return Object.values(S.a).reduce((t,v)=>t+(v-3),0)}
function traitPts(){let t=0;S.traits.forEach(id=>{t+=TRAITS.find(x=>x.id===id).c});return t}
function pool(){return BASE_POOL+prof().pts+traitPts()-spent()}
const has=id=>S.traits.has(id);

function renderAttrs(){
  const el=$("#attrs");el.innerHTML="";
  ATTRS.forEach(a=>{
    const v=S.a[a.k];const row=document.createElement("div");row.className="attr";
    let pips="";for(let i=1;i<=10;i++)pips+=`<i class="${i<=v?"on":""}"></i>`;
    row.innerHTML=`<span class="name">${a.n}</span>
     <div class="stepper"><button type="button" aria-label="Diminuir ${a.n}" data-k="${a.k}" data-d="-1">−</button>
     <div class="pips" aria-hidden="true">${pips}</div><span class="val">${v}</span>
     <button type="button" aria-label="Aumentar ${a.n}" data-k="${a.k}" data-d="1">+</button></div>
     <span class="desc">${a.d}</span>`;
    el.appendChild(row);
  });
  el.querySelectorAll("button").forEach(b=>{
    const k=b.dataset.k,d=+b.dataset.d,v=S.a[k];
    b.disabled=d<0?v<=MINC:(v>=MAXC||pool()<=0);
    b.onclick=()=>{S.a[k]+=d;update()};
  });
}
function renderTraits(){
  const el=$("#traits");el.innerHTML="";
  TRAITS.forEach(t=>{
    const blocked=t.x.some(has)&&!has(t.id);
    const lab=document.createElement("label");
    lab.className="trait"+(has(t.id)?" sel":"")+(blocked?" dis":"");
    lab.innerHTML=`<input type="checkbox" id="tr-${t.id}" ${has(t.id)?"checked":""} ${blocked?"disabled":""}>
      <span><span class="tn">${t.n}</span><span class="te">${t.e}</span></span>
      <span class="tc" style="color:var(${t.c<0?"--ok":"--blood"})">${t.c>0?"+":""}${t.c}</span>`;
    lab.querySelector("input").onchange=e=>{e.target.checked?S.traits.add(t.id):S.traits.delete(t.id);update()};
    el.appendChild(lab);
  });
}
function derived(){
  const a=S.a;
  let vida=70+6*a.vig+(has("touro")?15:0);
  let folego=40+6*a.vig+4*a.agi;folego*=has("atleta")?1.25:1;folego*=has("asma")?.7:1;folego*=has("sedent")?.8:1;
  let carga=8+2.5*a.for;if(has("org"))carga*=1.2;
  let corrida=5.2+0.12*a.agi+(has("atleta")?.3:0)-(has("sedent")?.3:0);
  let raio=12+2*a.per;if(has("olhos"))raio*=1.25;if(has("miope"))raio*=.7;
  let ruido=100-a.agi*4;if(has("silen"))ruido*=.7;if(has("desaj"))ruido*=1.3;
  let xp=70+6*a.int;if(has("rapido"))xp*=1.3;if(has("lento"))xp*=.7;
  let comp=20+3*a.vig+4*a.pre;if(has("frio"))comp*=1.4;if(has("medroso"))comp*=.6;
  let dano=(a.for-5)*6;
  return {vida,folego,carga,corrida,raio,ruido,xp,comp,dano};
}
function update(){
  const p=prof();const P=pool();
  $("#pool").textContent=P;$("#pool").classList.toggle("bad",P<0);
  $("#poolsrc").textContent=`base 14 · profissão ${p.pts>=0?"+":""}${p.pts} · traços ${traitPts()>=0?"+":""}${traitPts()}`;
  renderAttrs();renderTraits();
  $("#sheetname").textContent=$("#nome").value||"Sem nome";
  $("#sheetprof").textContent=p.n;
  $("#startskills").innerHTML=Object.entries(p.sk).map(([k,v])=>`<span class="tag">${k} ${v}</span>`).join("")||`<span class="tag">Sem habilidades iniciais</span>`;
  $("#kit").textContent=`Bônus: ${p.b}. Leva: ${p.kit}.`;
  const d=derived();
  const rows=[
   ["Vida máxima",Math.round(d.vida),"",d.vida/150],
   ["Fôlego",Math.round(d.folego),"",d.folego/160],
   ["Carga máxima",d.carga.toFixed(1)+" kg","",d.carga/40],
   ["Velocidade de corrida",d.corrida.toFixed(2)+" m/s","Zumbi andante 1,4 m/s · corredor 6,0 m/s",d.corrida/7],
   ["Raio de detecção",Math.round(d.raio)+" m","Distância em que você ouve e vê zumbis",d.raio/45],
   ["Ruído dos passos",Math.round(d.ruido)+"%","Menor é melhor",d.ruido/130],
   ["Velocidade de aprendizado",Math.round(d.xp)+"%","",d.xp/170],
   ["Compostura",Math.round(d.comp),"Pânico que aguenta antes de tremer",d.comp/110],
   ["Dano corpo a corpo",(d.dano>=0?"+":"")+d.dano+"%","",(d.dano+24)/54]];
  $("#derived").innerHTML=rows.map(r=>`<div class="drow"><span class="dl">${r[0]}</span><span class="dv">${r[1]}</span>
     <div class="bar"><span style="width:${Math.max(3,Math.min(100,r[3]*100))}%"></span></div>${r[2]?`<span class="note">${r[2]}</span>`:""}</div>`).join("");
  const v=$("#verdict");
  const fuga=d.folego/12; // segundos de sprint aprox (12 de fôlego por segundo)
  if(P<0){v.className="verdict bad";v.textContent=`Faltam ${-P} pontos. Tire pontos de atributos ou escolha um traço negativo.`;}
  else if(d.corrida>=6.0){v.className="verdict ok";v.textContent=`Você é mais rápido que um corredor (${d.corrida.toFixed(2)} contra 6,0 m/s) e aguenta cerca de ${Math.round(fuga)} s de arrancada. Dá para fugir em linha reta.`;}
  else{v.className="verdict";v.textContent=`Um corredor te alcança (6,0 contra ${d.corrida.toFixed(2)} m/s). Você aguenta cerca de ${Math.round(fuga)} s de arrancada: use portas, cercas e escadas para quebrar a perseguição.`;}
}

$("#prof").innerHTML=PROFS.map(p=>`<option value="${p.id}">${p.n} (${p.pts>=0?"+":""}${p.pts})</option>`).join("");
$("#prof").value=S.prof;
$("#prof").onchange=e=>{S.prof=e.target.value;update()};
$("#nome").oninput=update;

// sample working state
S.a={for:4,vig:5,agi:6,per:5,int:5,pre:4};S.traits.add("olhos");S.traits.add("fumante");

$("#skillgroups").innerHTML=SKILLS.map(g=>`<div class="card"><h3>${g.g}</h3>
  <div class="tbl" style="border:0"><table style="min-width:0;font-size:.86rem"><thead><tr><th>Habilidade</th><th>Nv 3</th><th>Nv 6</th><th>Nv 9</th></tr></thead><tbody>
  ${g.items.map(s=>`<tr><td><b>${s[0]}</b></td><td>${s[1]}</td><td>${s[2]}</td><td>${s[3]}</td></tr>`).join("")}</tbody></table></div></div>`).join("");

$("#proftable").innerHTML=PROFS.map(p=>`<tr><td><b>${p.n}</b></td><td class="num">${p.pts>=0?"+":""}${p.pts}</td>
  <td>${Object.entries(p.sk).map(([k,v])=>`${k} ${v}`).join(", ")||"Nenhuma"}</td><td>${p.b}</td><td>${p.kit}</td></tr>`).join("");

const trow=t=>`<tr><td><b>${t.n}</b><br><span style="color:var(--muted);font-size:.85rem">${t.e}</span></td><td class="num" style="color:var(${t.c<0?"--ok":"--blood"})">${t.c>0?"+":""}${t.c}</td></tr>`;
$("#tpos").innerHTML=TRAITS.filter(t=>t.c<0).map(trow).join("");
$("#tneg").innerHTML=TRAITS.filter(t=>t.c>0).map(trow).join("");

const PL={coragem:"Coragem",empatia:"Empatia",lealdade:"Lealdade",ganancia:"Ganância",estabilidade:"Estabilidade"};
$("#npclist").innerHTML=NPCS.map(n=>`<article class="npc">
  <div class="side">
    <div class="who"><h3>${n.n}</h3><span class="meta">${n.i} anos · ${n.o}</span></div>
    <span class="tag amb">${n.loc}</span>
    <p>${n.h}</p>
    <p><b>Objetivo:</b> ${n.g}</p>
    <p style="color:var(--muted);font-size:.9rem"><b style="color:var(--fg)">O que oferece:</b> ${n.o2}</p>
    <div class="secret"><b>Segredo</b><p>${n.s}</p></div>
  </div>
  <div class="side">
    <span class="eyebrow">Personalidade</span>
    <div class="persona">${Object.entries(n.p).map(([k,v])=>`<span>${PL[k]}</span><div class="pb"><span style="width:${v}%"></span></div><span class="pv">${v}</span>`).join("")}</div>
    <span class="eyebrow" style="margin-top:6px">Rotina</span>
    <div class="routine">${n.r.map(r=>`<div><b>${r[0]}</b><span>${r[1]}</span></div>`).join("")}</div>
  </div></article>`).join("");

update();
