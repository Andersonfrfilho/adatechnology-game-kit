# Inventário: zumbis, personagens, sobreviventes e animais

Levantado em 2026-10-23 para a spec 001. Cobre os times **Zumbis e personagens**, **Sobreviventes** e **Animais**, mais o que há de corpo, zumbi,
NPC e bicho nas galerias do Arsenal e do Vale Cinzento e nas três versões integradas do jogo. Só leitura: nenhum código foi alterado.

Convenções deste arquivo:

- `arquivo:linha` aponta para `specs/001-migracao-entregas-dos-times/sources/<arquivo>.js`. Abreviações: `bestiario` = `zumbis-personagens__bestiario`,
  `elenco` = `zumbis-personagens__elenco`, `personagens` = `zumbis-personagens__personagens`, `retratos` = `sobreviventes__retratos-do-vale`,
  `vivos` = `sobreviventes__os-vivos-do-vale`, `bichos` = `animais__bichos-do-vale`, `arsenal` = `armas-itens__galeria-3d-arsenal`,
  `mapa` = `mapa__galeria-vale-cinzento`, `livre` = `jogo__zombiada-modo-livre`, `aurora` = `jogo__zombiada-jardim-aurora`,
  `hordas` = `jogo__bancada-de-hordas`.
- Os identificadores do código dos times estão em português (`Lento`, `braco`, `cabeca`, `mordida`...). Regra do SDK: identificador em inglês,
  texto de jogador em `locale`. Cada tabela traz o nome inglês proposto onde a regra pede.
- "Mais completo" não é "melhor": o critério da comparação é o que serve ao pacote único, não o que tem mais linhas.

## Resumo executivo

1. Há **oito corpos diferentes** no material (bestiário, elenco, retratos, arsenal, mapa, bancada de hordas e as duas versões do jogo). Três são
   o mesmo corpo copiado (bestiário, elenco, retratos: tronco torneado, juntas esféricas, 1,80 m, ombros de 0,60 m). Os outros quatro têm proporção
   própria. O corpo do guia de estilo do Elenco/Retratos é a referência de proporção; o corpo do jogo (`buildBody` + `bodyAnim`) é a referência de execução.
2. A versão **integrada no jogo é a mais evoluída em tudo que é comportamento**: 13 tipos com habilidades (`zAbility`), dano por região unificado
   (`zDamage`), máscara de partes faltando, pirâmide de corpos, vagas de ataque, corpos de 15 min, animação de corpo na GPU com cascata e passada que
   casa com o chão. O Bestiário v17 que o jogo embute (`livre:70113`) **não é o mesmo arquivo** do `bestiario.js` desta pasta (v0.1): é uma evolução
   (LOD, olhos marcáveis, osso da mandíbula, boca aberta). Está dentro dos arquivos do jogo, então dá para extrair, mas o dono precisa confirmar qual é o canônico.
3. O melhor **desmembramento** está dividido: a regra de hierarquia (corte na junta acima, cai tudo que vem depois, osso quebrado pendura) é do Elenco;
   a dinâmica (sangramento por região com jorro, ferida de saída, pedaços de carne, estouro, partir o tronco, granada por raio) é do Arsenal; a versão
   barata para multidão (máscara de bits + membro voando) é do jogo. Um `game-characters` único precisa das três.
4. O SDK **não tem nada de personagem**. `game-infection` é o modelo macro por região (não o zumbi individual). O contrato `DestructibleImpl` já cita
   "a creature" e é o encaixe natural do dano por região; faltam materiais `flesh`/`bone`, juntas de carne e sangue por idade.
5. **Há contradições de números entre as fontes** (velocidades, cor dos olhos, penetração, categoria do zumbi nomeado, crianças que viram zumbi).
   Estão na seção 5 e bloqueiam a definição dos dados.

---

## 1. Entregas por fonte

### 1.1 Bestiário (`bestiario.js`, 990 linhas, documento v0.1 de 22/10/2026)

**Texto do documento** (linha 2): regras de ouro (tiro no crânio mata qualquer categoria; só capacete segura um tiro; mordida infecta 100%, arranhão 20%;
olhos dizem o tipo; velho sangra menos; bala atravessa; corpos ficam 15 min e escondem o Espreitador), tabela de idade da infecção, idade da pessoa
(jovem, adulto, idoso), dano e penetração, roupas, mordida, som, corpos, altura e porte, grupo, técnica de horda e "em aberto".

**Dados dos 13 tipos** (`Z`, linhas 6-46). Campos por tipo: `n`, `eye`, `pct` (peso no spawn), `role`, `hp`, `spd` ("vagando / perseguindo", texto com vírgula),
`dmg`, `bite`, `mult` ("tronco · braços · pernas"), `look`, `ai` (percepção em texto), `spawn`, `counter`, `voice`, `step`.

| Tipo (pt) | Nome inglês proposto | Peso | Vida | m/s vag. / pers. | Dano | Mordida | Dano × tronco·braços·pernas | Olho |
|---|---|---|---|---|---|---|---|---|
| Lento | walker | 48 | 100 | 0,6 / 1,4 | 10 | 15% | 1,0 · 0,8 · 0,8 | E3C341 |
| Corredor | runner | 14 | 70 | 1,2 / 5,5 | 8 | 25% | 1,0 · 1,2 · 1,3 | E5392B |
| Rastejante | crawler | 9 | 60 | 0,4 | 6 | 35% | 1,0 · 1,0 · — | A9D14A |
| Brutamonte | brute | 5 | 220 | 0,8 / 2,0 | 30 | 10% | 1,0 · 0,6 · 0,7 | EF8A2A |
| Farejador | sniffer | 5 | 80 | 1,0 / 3,5 | 9 | 20% | 1,0 · 1,1 · 1,1 | 4FC6D6 |
| Saltador | leaper | 4 | 75 | 1,0 / 4,5 | 14 | 30% | 1,0 · 1,1 · 1,4 | E04AA8 |
| Inchado | bloater | 3 | 120 | 0,5 / 1,0 | 12 | 15% | 1,5 · 1,0 · 1,0 | 5FE08A |
| Espreitador | stalker | 3 | 90 | 1,0 / 4,0 | 10 | 40% | 1,0 · 1,0 · 1,0 | 9B5CE0 (apagado) |
| Cego | blind | 3 | 110 | 0,8 / 3,0 | 12 | 35% | 1,0 · 0,9 · 0,9 | D9D4C8 (sem brilho) |
| Gritador | screamer | 2 | 50 | 1,0 / 3,0 | 4 | 5% | 1,2 · 1,2 · 1,2 | F2F2EA |
| Carbonizado | charred | 2 | 90 | 0,9 / 2,2 | 10 | 15% | 0,8 · 0,8 · 0,8 | FF6A1A |
| Afogado | drowned | 1 | 130 | 0,6 / 2,5 (3,0 na água) | 10 | 25% | 1,0 · 1,0 · 1,0 | 3D8BFF |
| Devorador | devourer | 1 | 120 | 0,9 / 3,0 | 16 | 30% | 1,0 · 1,0 · 1,0 | B0103A |

Habilidades em texto (campo `ai`/`role`): Lento agarra e morde, segue o som dos outros; Corredor pula obstáculo baixo e investe; Brutamonte dano ×3 em porta,
golpe em arco com aviso de 0,8 s, cabeça baixa (−40% de área de headshot); Rastejante esconde-se no mato e sob carros; Gritador arqueia 1,5 s, chama
todos a 150 m e dá +20% de velocidade por 30 s, repete a cada 20 s; Inchado estoura numa nuvem de 4 m (cega 5 s, dobra o rastro de cheiro, tosse);
Espreitador finge de morto, acorda a menos de 3 m ou de costas, bote de 4 m/s por 3 s; Farejador olfato 60 m, segue rastro de sangue, puxa até 8
Lentos; Saltador salta 6 m na horizontal e 3 m para cima, derruba 1,5 s, recarga 5 s; Cego só caça por som (tiros a 80 m, passos a 6 m, agachado 2 m);
Afogado agarra e afoga em 3 s; Carbonizado imune a fogo, queima 3 de dano por segundo por 4 s, água tira 30% da vida; Devorador come corpos (+20 vida,
+5% tamanho, até 3 vezes).

**Idade da infecção** (modificador sobre qualquer tipo; texto da linha 2):

| | Fresco (0-3 d) | Recente (4-30 d) | Antigo (1-6 m) | Decrépito (6+ m) |
|---|---|---|---|---|
| Sangue/rastro | 100% | 70% | 35% | 10% |
| Velocidade | +10% | base | −10% | −25% |
| Vida | 100% | 100% | 85% | 65% |
| Dano nos membros | ×0,8 | ×1,0 | ×1,3 | ×1,8 |
| Percepção | base | base | audição −10% | visão −40%, olfato −30% |
| Pele | pálida, veias azuladas | cinza-esverdeada | verde-oliva | couro seco, ossos à mostra |

No código: `SKIN` (4 tons por idade), `BLOOD` (4 cores), `CLOTH` (8) em `bestiario:76-78`. Mistura de idades acompanha os dias do mundo
(1ª semana 80% frescos; dia 60 cerca de metade antigos). Quem é transformado nasce sempre Fresco.

**Corpo e construtor**

- `TORSO_P`/`TORSO_F` (`bestiario:90-91`): perfil de 9 pontos do tronco (Lathe de 24 lados suavizado por spline), masculino e feminino; escala 1,12 × 0,64.
- `BASE` (97) e `TYPES` (98-112): pose base e **13 posturas** como deltas (`s`, `bulk`, `lean`, `armL/R`, `elbL/R`, `legL/R`, `kneeL/R`, `headX/Z`, `drop`,
  `neck`, `armOut`, `headFwd`) e marcas (`bloat`, `noLegs`, `mouth`, `nose`, `blind`, `wet`, `char`, `gore`, `dim`).
- `OUTFITS` (113-121): 7 roupas (policial, militar, bombeiro, motociclista, operário, médico, caçador) com cor, colete, listras, chapéu (`cap`, `helmet`, `fire`,
  `moto`, `hardhat`) e máscara.
- `build(spec)` (123-283). Campos do `spec`: `type`, `decay` (idade 0-3), `life` (0 jovem, 1 adulto, 2 idoso), `cut`, `pose`, `h`, `bulk`, `seed`, `fem`,
  `tone`, `skin`, `hair`, `outfit`, `uniform`, `clothIdx`, `human`, `eyesOff`, `eyeDim`, `eye`, `lying`, `wounds`, `bandage`, `opacity`, `phase`.
  Dentro: pelve e pernas com joelho (`legs[]` = grupo coxa, grupo joelho), tronco com pivô no quadril (`upper`), pescoço, cabeça (`headG`), braços com cotovelo,
  olhos com brilho (sprite aditivo), **aparência sorteada** (`VR`: manga, 6 estilos de cabelo, `hx hy jaw nose`, barba, óculos, boné, mochila, rasgado, avental),
  tipos especiais (Inchado com barriga e pústulas luminosas `bestiario:184-195`, Carbonizado com brasas `197-199`, Afogado molhado, Devorador com sangue).
- **Estados de corte** (`cut`): `head`, `jaw`, `blown` (cabeça estourada), `gut` (tripas), `flaps` (carne pendurada), `dangleR/L` (antebraço pendurado que balança),
  `shoulderR/L` (braço arrancado), `armR/L`, `legs`. São **visuais estáticos** para as cenas (toco `stump`, osso, `drip` de gotejo), não um modelo de dano.
- Sangue no corpo: `splat`, `flat`, `run` (filete que termina em bulbo), `drip` com âncoras `userData.drip` (152-164).

**Animação**

- `GAIT` (286-300), um por tipo: `f` (frequência), `a` (amplitude da perna), `k` (joelho), `arm`, `bob`, `sway`, `drag` (arrasta uma perna) e comportamentos especiais:
  `crawl` (Rastejante), `idle` (Gritador arqueia), `stalk` (Espreitador), `sniff` (Farejador gira a cabeça), `leap` (Saltador no ar), `listen` (Cego), `eat` (Devorador).
- `animate`/`animate0` (301-320), `CASC` (322: quadril 16, coluna 11, ombro 9, cotovelo 7, perna 14, joelho 11, cabeça 6) e `cascade` (323): cada junta chega
  na pose com atraso, do quadril para a cabeça. `setPose` (332) e `lerpPose` (340) para poses nomeadas.

**Efeitos (pertencem ao pacote de VFX, citados porque o corpo depende deles)**: `Particles` (355, puffs que dissolvem por ruído), `blast` (382), `BLOB` (389),
`FluidMat` (393, poça que seca pela borda), `mark`/`poolMark` (404/410), `WET` (421: blood, old, bile, tempos de secagem 20/12/30 s na demo), `Fluids` (422-469,
instanciado, MAXM 900 marcas, MAXD 160 gotas, brasas do Carbonizado).

**Multidão**: `Crowd` (472-531): grade de 0,6 m, separação, empurrão, **escalar quem está na frente** (`climb`), tropeçar e rolar (`tumble`), paredes com altura,
nenhum membro dentro de parede.

**Cenas de referência** (`SCENES`, 621-990): roupas (622), dano por região (626), penetração (643: 9 mm atravessa 2, −50%; 5.56 atravessa 3, −35%; .308 atravessa 4,
−25%), espreitador (652), gritador (660), inchado (670), explosão na horda (693: granada M67 em 18 zumbis, raios letal/ferimento), tiro por idade (755),
farejador (768), da mordida ao zumbi (775: 48 h, febre, delírio, reanima em 2-4 min como Fresco), corpos em 15 min (785), níveis de detalhe (796),
horda de 100 (810), perseguição (819), pirâmide no muro (845), maré na barricada (897), agarrão e mordida (911: 3 s para se soltar), variedade (945),
altura e porte (950: 1,62 a 1,98 m), vagas de ataque (956: 6 vagas, Brutamonte ocupa 2), alerta em cadeia (966).

### 1.2 Elenco (`elenco.js`, 605 linhas)

**Dados**

- `PROFS` (14-39): **12 profissões** do jogador, cada uma com cor de pele base, cabelo, chapéu, roupa, `ex` (acessórios), item de mão, partes de roupa em texto e kit:
  enfermeira(o), policial militar, bombeiro(a), mecânico(a), pedreiro/obras, cozinheiro(a), atirador esportivo, agricultor(a), eletricista, motoboy, professor(a), desempregado(a).
- `NPCS` (40-65): **8 sobreviventes com história** (Dona Zilda, Tenente Brasa, Kauã, Rosa, Otávio, Seu Dito com o cão Trovão, Jéssica, Dr. Sato), com `h` (altura relativa),
  `bulk`, `hunch`, cor de assinatura, nota de arte, partes e kit.
- `STAGES` (67-72): 5 fases da infecção do vivo (saudável; mal-estar 2-12 h; febre alta 12-30 h; delírio 30-48 h; reanimado "corredor"): `skin`, `hunch`, `arms`.
  `applyStage` (374) pinta a pele em direção a `ZSKIN` (6F7A5C), liga olheiras, acende olho vermelho (FF3A2A), sangue na boca.
- Texto do guia de estilo (linha 2): silhueta primeiro (reconhecer a 30 m no escuro), uma cor de assinatura por personagem, esqueleto único para jogador, NPC e zumbi,
  roupa longa presa à coxa, proporção (altura base 1,80 m, cabeça cerca de 1/6, ombros 0,60 m homem e 0,55 m mulher).

**Construtor** `build(sp, idx)` (160-355), o mais detalhado dos corpos:

- Geometria: `torsoGeo(fem)` (139), `mlimb` (membro com perfil de raio por Lathe, 135), pelve e glúteos, coxa/canela com joelho, panturrilha, tênis e sola, saia presa à coxa,
  trapézio e peitoral, pescoço, cabeça com pálpebras, maçãs, sobrancelha, nariz, boca, **mão com 4 dedos de 2 falanges e polegar** (253-256), `mount` na mão para item.
- Cabelo: `short`, `bun`, `long`, `buzz`, `bald`, `afro`. Rosto: óculos (`glasses`, `glasses_y`), bigode (`mustache`, `mustache_w`), barba grisalha, barba por fazer,
  máscara, óculos de solda, brincos, cigarro. Chapéus: `cap`, `capback`, `beret`, `hardhat`, `fire`, `straw`, `moto`, `bandana`.
- `ex` (acessórios, 261-299): estetoscópio, máscara no queixo, colete, bolsas, cinto, coldre, rádio, listras refletivas, manchas de graxa/enxofre, pano, avental, botões,
  abafador/fone, rolo de fio, baú de entregas, mochila, capacete na mochila, capuz, bolso, colete de tricô, gola, bolsa carteiro, blusa, crucifixo, braçadeira, mangas amarradas,
  jaleco, luvas, sangue, camiseta aparecendo, suspensório. Arma nas costas (`shotgun`, 301). Itens de mão (305-323): machado, facão, chave inglesa, martelo, enxada, cassetete,
  faca, pistola, alicate, maleta médica, caixa de ferramentas, livro, garrafa, prancheta, microfone.
- `splat` (149) e `blobR`/`blobGeo` (144/147): mancha irregular de sangue na roupa (borda difusa, mais escura no centro, filete).
- Cão Trovão (341-352): corpo em cilindros, cabeça, focinho, orelhas cone, 4 patas, cauda com animação.

**Movimento**: `MOVES` (358-364): `idle`, `walk` (freq 5,6, amp 0,42), `run` (9,2, 0,72), `crouch`, `aim`, `turn`, com mistura contínua; passada com troca de peso, sway do quadril,
coluna que atrasa, cabeça que estabiliza, braço-ombro-cotovelo-pulso-dedos em cascata (576-585). Variantes de zumbi (estágio 4: perna esquerda `.45`, passada 0,62×, braços para a frente).

**Dano por região (o modelo mais explícito do Elenco)**

- Segmentos presos a juntas (`segs`, 336-339): `head` 40, `torso` 120, `pelvis` 90, `uArm` 60, `fArm` 45, `hand` 25, `thigh` 80, `shin` 55 (cada um com `r` do corte).
  Cada malha é marcada com `userData.seg` (331-334).
- Regra: o corte acontece na junta acima do ponto atingido e cai tudo que vem depois (`BELOW`, 447; `FALLS`, 448 com a frase de cada caso).
- `sever` (449): pedaço voa (`fly`, 427, com `w` angular), toco com anel de ferida, carne, gordura, osso e fiapos (`makeCut` 433, `makeStump` 443), `burst` de gotas, poça
  (`addPool` 410) que cresce em lóbulos e seca; `breakBone` (458): membro **quebrado fica pendurado e balança como pêndulo** (`pends`, 593; molas -26, atrito -1,8), `ringWound`
  (445); perna quebrada manca (`limp`), coxa arrancada faz rastejar (586-591), cabeça arrancada ou tiro na cabeça mata (595).
- `WEAPONS` (461): faca 22/corte .7, facão 55/1, machado 85/1, pistola 9 mm 30/.15, espingarda 12 95/.75, fuzil 7,62 65/.45. `hit` (463): dano 85-115% do nominal; HP zerado corta se
  `cut ≥ .5` ou dano ≥ 90% do máximo, senão quebra. Tronco a zero: "ferimento fatal no tronco (humano); zumbi só cai com tiro na cabeça". Quadril a zero: rasteja.
- Ferramentas de depuração: `paintParts` (476, cor por segmento), `heal` (479), `renderDmg` (481), `updateFx` (495: gotejo, poças, secagem em `DRY_S`=30 s).

### 1.3 Personagens (`personagens.js`, 256 linhas, documento)

Dados de ficha, sem 3D: `ATTRS` (6: Força, Vigor, Agilidade, Percepção, Intelecto, Presença; 3 inicial, 14 pontos, máx. 8, mín. 1), `SKILLS` (5 grupos, 24 habilidades com marcos nos níveis 3, 6 e 9),
`PROFS` (12 com pontos, habilidades iniciais, bônus e kit), `TRAITS` (18, 8 positivos e 10 negativos, com exclusões), `NPCS` (8, com personalidade em 5 eixos, 5-6 horários, objetivo, segredo,
o que oferece), `derived()` (178: vida 70+6·VIG, fôlego 40+6·VIG+4·AGI, carga 8+2,5·FOR, corrida 5,2+0,12·AGI, raio 12+2·PER, ruído 100−4·AGI, XP 70+6·INT, compostura 20+3·VIG+4·PRE,
dano corpo a corpo (FOR−5)·6%), `pool()` e a tela do criador. O texto também fixa a "regra do corredor" (jogador com corrida ≥ 6,0 m/s é mais rápido que o Corredor).

### 1.4 Retratos do Vale (`retratos.js`, 726 linhas)

- `build(sp, idx)` (64-308): **o mesmo corpo do Elenco**, com acréscimos: cabelo `pony`, rosto `mirror` e `labgoggles` e `beard` simples, chapéu `helmet` (com `tape`, `photo`, `nvg`), e uns 35 acessórios novos
  (terço, relógio, corrente, unicórnio, apito, caneta, foto, bottons, gravador, miçangas, crachá, estetoscópio rosa, cartucheira, lenço, pena, patuá, fuzil na frente e com fita e com supressor,
  espingarda de dois canos, barriga de grávida, refletivo, placa, chaveiro, rádio de satélite, binóculo, torniquete, cuia, cartão, mapa dobrado, faixa de moto) e itens de mão novos (pá, estilingue,
  bíblia, sinalizador, rádio de mão, pump). Sem corte, sem dano, sem dedos diferentes: é para retrato.
- `MOVES` (309) igual ao do Elenco; `pose(c, zombie, walkAmount, t)` (320-338): andar de vivo e andar de zumbi (freq 3,4; perna esquerda curta; braços levantados; cabeça tombada);
  `zombify(c, cat)` (339): pele, olho por categoria (`EYE`: lento E3C341, corredor E5392B, brutamonte EF8A2A), sangue na boca, olheiras.
- `PEOPLE` (344-437): **44 entradas** (31 sobreviventes nomeados + crianças `criancas` com 3 e `kids` junto da Helena e do Dito; Arnaldo e Azevedo já zumbis). Campos: `id`, `n`, `a` (idade e ofício), `g` (grupo/base),
  `it` (**item marcado**), `b` (corpo: `fem`, `skin`, `h`, `bulk`, `hunch`, `hair`, `face`, `hat`, `top`, `pants`, `shoes`, `ex`, `hand`, `lhand`), `kid`, `wide`, `already`, `zcat` (categoria do zumbi nomeado:
  `corredor` para Nicole, Kauã, Biel; `brutamonte` para Armando, Ferraz, Azevedo). Crianças: `h` 0,52-0,70, `bulk` 0,68-0,76.
- `GC` (342): 18 cores de grupo. `BASES` (482-631): **17 maquetes** de base (igreja, delegacia, rádio, oficina, colégio, hospital, igreja da vila, sobrado, depósito, loja de armas, sítios, serra, torre do 7º BIS,
  bloqueio, PRF, penitenciária, esconderijo da Falcão), cada uma com personagens, horda (`horde` 468, `zed` 463) e cenário próprio (`win`, `lamp`, `tree`, `pine`, `car`, `roofGable`, `fence`, `wall`, `crosses`).
  A cenografia das maquetes é de construção/props e **não** pertence a `game-characters`.
- Regras visuais (linha 2): humano adulto 1,80 m, criança 0,55-0,72; zumbi pele `#6f7a5c`; item marcado sempre visível, saturado, na metade de cima ou na mão; farda camuflada em xadrez de 2 tons;
  mancha em tecido com borda difusa e semente por pessoa; sangue fresco `#8A0A0A`, seco `#3B1D14` após 10 min; **crianças nunca viram zumbi nomeado**.

### 1.5 Os Vivos do Vale (`vivos.js`, 899 linhas, documento + simulador)

Tudo é dado e regra de simulação (nenhum 3D):

- `GROUPS` (6-25): **18 grupos/bases** com nome, região, cor, `def` (0-1, reduz o risco diário), `food` (dias) e descrição.
- `RISK` (26): risco diário por região (0,0015 a 0,02).
- `NPCS` (28-312): **44 pessoas** (`id`, `n`, `i` idade, `o` ofício, `g`, `h` história, `p` [coragem, empatia, lealdade, ganância, estabilidade], `r` rotina por horário, `obj`, `seg` segredo, `it`, `of` o que oferece,
  `orig`). Inclui os 8 do Personagens com os mesmos textos. `EXTRA` (313): bebê Vitória (nasce). `RELS` (316): cerca de 60 laços tipados (`fam`, `ali`, `odio`, `seg`, `medo`). `JOIN` (336): 9 entradas para o grupo
  do jogador. `STATES` (348): 9 estados de destino (vivo, ferido, mordido, zumbi nomeado, morto, sumido, no grupo, hostil, mudou de lado...). `ACTS` (351): 13 pontos de virada. `EV` (372-497): 47 eventos datados.
- **Fardados**: `FACT` (499-529): 7 forças (Exército 7º BIS, PM, Polícia Civil, PRF, Polícia Penal, Forças Especiais, unidades táticas) com onde, quem, genéricos, o que fazem, como tratam o jogador, fases;
  `RANKS` (530) e `RANKRULE` (537: patente decide quem manda quando o líder cai; opinião abaixo de −20 permite desobedecer); `LOOT` (539-591): 51 itens de fardado (farda camuflada −15% de detecção, coletes por nível,
  rádio, chaves, documentos...); `GENT` (593-603): 9 genéricos (soldado, zumbi fardado, PM de patrulha, PM do Choque zumbi, escolta tática zumbi, PRF, policial penal, preso, operador das forças especiais) com equipamento e comportamento.
- **Vida sorteada** (605-757): `REG`, `EXPO`, `NM` (nomes), `RELW`, `HOSTB`, `CAP`=104, `ROOM`=8, `COUPLES`, `world()` (619), `life(d,S,F,R,W,log)` (623-739: nascimentos, chegadas, laços, brigas, traições,
  caravanas, ataques, gravidez), `apply` (740), `simulate(day, A, O)` (744), com PRNG semeado (`rng`, 606).
- Texto (linha 2): 31 sobreviventes nomeados, 12 grupos (mais 6 depois), 40 genéricos por servidor, 9 estados, "o mundo segue sem o jogador". Números são proposta para playtest.

### 1.6 Bichos do Vale (`bichos.js`, 521 linhas)

- `SPECIES` (9-75): **13 espécies** com `id`, `nome`, `sub`, `sci`, `grupo` (Doméstico, Fazenda, Selvagem, Ambiente), `fase` (MVP, Fase 2, Fase 3), `inf` (`vira`, `morre`, `imune`), `onde`, `papel`, `cuidado`, `rende`, `som`.
  MVP: cão, galinha, vaca, capivara, urubu, quero-quero. Fase 2: gato, cavalo, porco, javali, rato. Fase 3: onça, jararaca.
- Regra de infecção (linha 2): vira zumbi mamífero que morde e come carne (cão, gato, porco, javali, rato 2 min, onça 1 h; 10-30 min os demais); morre da mordida e vira isca (vaca, cavalo, capivara; carcaça chama zumbis a 200 m por 1 dia e
  urubus em 10 min); imune (galinha, urubu, quero-quero, jararaca). Carne de infectado nunca transforma, mal passada intoxica (−30% vigor por 6 h).
- Alcances de som: latido 60 m, cacarejo 30 m, quero-quero 40 m, mugido 80 m, relincho 50 m, javali 40 m.
- `ZONES` (76-90): habitats por espécie (círculos x, y, raio, nome do lugar) sobre o mapa da Santa Aurora; `TER` (484): rios e terreno do mapa SVG; `GCOL` (91).
- **Corpos**: `Animal(sp)` (147, com `M`, `ball`, `limb`, `joint`, `pivot`), `profileGeo` (140, corpo por perfil de raio), `quad` (162-234), `bird` (235), `snake` (280, 34 segmentos), `SPEC` (299-342: um bloco por espécie com
  `L`, `R`, `span`, `prof`, cores, `leg{fu fl hu hl}`, `neck`, `head`, `ears`, `tail`, `walkHz`, `runHz`, `gallop`, `extra`), `ORDER` (345).
- **Estados**: `setInfected` (362: tinge, olho leitoso, decoração de infectado, `dead` deita com poça), `setJoint` (373, juntas acesas), `setSplit` (374, afasta cada parte da junta).
- **Animação**: `GAIT` (378: walk, trot, gallop), `animQuad` (379), `animBird` (404), `animSnake` (421). Quadrúpede: pata em 3 segmentos (quadril, joelho/jarrete, pé), mancar do infectado (perna 1 a 0,35), cabeça baixa,
  mandíbula, cauda do cão que abana (9 Hz vivo, 2,2 Hz infectado).

### 1.7 Zumbi da Galeria do Arsenal (`arsenal.js:855-1015`)

Uma terceira implementação, em caixas, feita para **testar armas**:

- Tabelas: `BLEED` (856: sangria por parte, head 40, neck 46, thigh 19...), `MULT` (857: head 3, jaw 2, neck 2, tronco e quadril 1, membros 0,6-0,7), `HPS` (858: head 40, jaw 12, neck 25, torso 150, pelvis 90, upperArm 45, forearm 30, hand 12, thigh 55,
  shin 40, foot 15), `NAMES` (859), `ZW` (860: pistola 9×19 35, fuzil 7,62×39 55, escopeta 12 ga 12 com 9 bagos, .50 BMG 180, granada 300).
- `buildZombie` (866-887): hierarquia de grupos `zseg(parent, tipo, lado, x, y, z)` (pelvis → thigh → shin → foot; torso → neck → head → jaw; torso → upperArm → forearm → hand), 11 tipos de segmento, feridas de pano (`clothWound`, 863).
- Dano (`damage`, 979-992): dano × `MULT`; cabeça com dano ≥ 30 estoura o crânio e mata; mandíbula arrancada; pescoço a zero arranca a cabeça e mata; tronco/quadril com dano ≥ 150 ou HP zero **parte ao meio** (`splitTorso`, 978);
  membro a zero arranca (`sever`, 967) ou estoura (`explodeSeg`, 970, 14 pedaços, quando `big` ou excesso); coxa/canela perdida faz **rastejar** (`legLost`, 977), pé perdido faz **mancar** (`Z.limp`, estado "Mancando"); vida acumulada
  (`Z.life`) mata por dano; `kill`/`zFall` (975-976) com queda animada.
- Sangue: `addBleeder` (888: sangramento por parte com taxa, duração e jorro pulsante), `bloodBurst` (936), `bloodPool` (903, poça em leque de 28 raios que cresce e escurece, cor por idade `paintFan`), `splat` (911, respingo alongado
  pela direção), `stepPools` (921), `woundDecal` (927), `exitWound` (930, ferida de saída em estrela por raycast), `gouge` (953, pedaços de carne e osso que quicam e respingam).
- `zWalk` (945, passada com manca) e `zCrawl` (952). `grenadeAt` (1004: dano 300 com queda linear até 1,6 m, cabeça com dano > 40 estoura).

### 1.8 Figuras da Galeria do Vale Cinzento (`mapa.js:87-146`)

Uma quarta implementação, **de cenário** (centenas de figuras): `figGeo` (95-101, tronco Lathe de 12 lados e membros de 8, escalas 1,12 × 0,66), `figure(x, z, ry, p, o)` (102-130) com `o.t` = `w` (lento), `r` (corredor), `b` (brutamonte,
escala 1,25), `c` (criança, 0,66); `o.human`, `o.dead`, `o.still`, `o.walk` (anda de verdade com `wlen`), `o.aim`, `o.vest`, `o.hat`, `o.cloth/pants/skin`, `o.chained`. `GAIT` (136): `w` f1,5 v1,4; `r` f5,2 v5,5; `b` f1,1 v1,1; `c` f2 v1,6; `h` f2,2 v1,5.
`gait` (137-143) ata a animação ao relógio da cena. `dog` (132, em caixas). `zombie` (144), `human` (145), `horde(n, x0, x1, z0, z1, face, o)` (146: 65% lentos, 28% corredores, 7% brutamontes). Paletas `CLOTH`, `PANTS`, `ZSKIN`, `HSKIN`, `EYE` (w F2E86A, r FF3A2A, b FF8C1A).

### 1.9 Versões integradas no jogo

**Bancada de Hordas** (`hordas.js`, é a página de teste de desempenho do jogo):

- `CATS` (53075-53086): 13 tipos só com `[nome, peso, vel. perseguição, cor do olho]`. `class Horde` (53088-53300): dados em arrays tipados (6000), `block`/`isBlocked`, `spawn` (altura gaussiana 0,9-1,1, porte por faixa, Brutamonte ×1,42 e ×1,3),
  `startFlow`/`stepFlow` (flow field fatiado por orçamento de ms), `buildHash`, `update` (faixas de relevância `BANDS` R0 35 m a 20 Hz, R1 120 m a 5 Hz, R2 400 m a 1 Hz, R3 a 0,2 Hz, com histerese 10 m; separação 0,62 m; 6 vagas de ataque), `shoot` (penetração por pontos, Brutamonte conta 2).
- `buildZombie(seg)` (53395-53420): corpo de cápsulas em 3 LODs (`LODS`: 16/8/4 segmentos, ~2.500/800/250 triângulos), 7 ossos, `animChunk` (shader de vertex com cascata `lag`), `patch`, `zMeshes` instanciados (iA, iB, iEye).
  Mapa vivo (chuva, pássaros, 20 sobreviventes como cápsulas com o mesmo corpo, horda migrando).

**Jogo (Jardim Aurora e Modo Livre).** `aurora` é a fatia anterior; `livre` acrescenta retrato dos sobreviventes e bichos. `CATS` é idêntico nos dois (`livre:66294`, `aurora:53061`).

| Peça | `livre` | `aurora` | O que faz |
|---|---|---|---|
| `CATS`, `IDADES`, `ROUPAS`, `SEG`, `CALIBRES`, `ARMAS`, `FICHA`/`DERIV`, `INFEC`, `FERIDA` | 66294-66360 | 53061-53110 | dados de regra do jogo (13 tipos com `mult` [cabeça, tronco, braços, pernas], percepção, `escala`, `porte`; 4 idades com `p` 0,80/0,15/0,04/0,01; 4 roupas com colete e capacete; segmentos cabeça 40, braço 60, perna 80) |
| `buildBody(seg)` + `J` + `tagGeo`/`mergeBody` | 69659-69866 | 55014 | corpo do jogo: Lathe torso, 12 ossos (0 tronco/quadril, 1 cabeça, 2/3 braço, 4/5 coxa, 6 olhos, 7/8 antebraço, 9/10 canela, 11 mandíbula), 6 materiais por vértice (pele, camisa, calça, olho, cabelo, sapato) |
| `bodyChunk`/`bodyAnim` + `bodyMaterial` | 69726-69831 | 55047-55153 | animação de corpo na GPU: cascata (`lag` por osso), **8 poses** (0 anda, 1 rasteja, 2 caído, 3 ataca, 4 grita, 5 agachado, 6 salta, 7 come), braços de zumbi (levanta ao perceber), humano armado com mira, **partes faltando por máscara de bits** (`miss`), pele por infecção, olho emissivo |
| `walkCad`/`walkGait`, `BodyBatch`, `BODY_LOD` | 69833-69867 | 55154-55186 | passada que casa com o chão (cadência 0,5+0,3·v, amplitude pelo comprimento da perna), lote instanciado, 3 LODs (16/10/5) |
| `buildRetrato` | 69872-70109 | não existe | corpo detalhado dos sobreviventes (porte do construtor dos Retratos) para ser assado no mesmo esqueleto |
| `BEST` (Bestiário v17) | 70113-70341 | 55191-55421 | o `build` do Bestiário com `setLOD`, ossos marcados (`userData.bone` 11 = mandíbula), olhos marcados (`userData.eye`), boca aberta, mancha nas costas, retorno `{build, TYPES, setLOD, topM}` |
| `bakeBody(spec, lod)` | 70345-70399 | 55422 | assa qualquer rig (Bestiário ou retrato) numa malha só: osso, pivô e cor por vértice; sangue sobe 6 mm pela normal |
| `BICHOS` | 70472-70853 | não existe | cópia dos construtores e animação da página dos Bichos sem o cenário (`quad`, `bird`, `snake`, `SPEC`, `animQuad/Bird/Snake`, `setInfected`) |
| `bichoPele`, `bichoNovo`, `bichosPovoar`, `bichosUpdate`, `bichoSom` | 70854-71039 | não existe | **pele de GPU**: a árvore de ~50 malhas do bicho vira uma malha só com `uB[nos]` matrizes por quadro; povoamento (Caramelo companheiro, 2 gatos, galinhas, 2 quero-queros, fazenda com vaca/cavalo/porcos/vaca morta, 3 capivaras, 3 urubus); medo, alarme, latido, mugido, som sintetizado |
| `Z` (estruturas de arrays), `zSpawn`, `zRemove` | 71043-71109 | 55545-55662 | 6000 zumbis em arrays tipados; campos de `cat`, `age`, `roupa`, `h`, `b`, `hp`, `segH/segA/segL`, `miss`, `capacete`, `st`, `band`, `y`, `andar`, `burn`, `npc`, `named`... |
| `hordeUpdate` (flow field, relevância, percepção, ruído, vagas de ataque), `groan`, `screamAt`, `zAttack` | 71161-71334 | 55663- | simulação de horda |
| `zDamage`, `zKill`, `inchadoBurst`, `corpseAdd`, `corpsesUpdate` | 71337-71402 | 55829- | dano por região unificado (região 0 cabeça, 1 tronco, 2/3 braço E/D, 4/5 perna E/D), capacete absorve tiro de pistola, colete reduz, membro a zero arranca ou quebra, perna a zero rasteja, perna a 50% manca; corpos 15 min (`CORPOS_MAX` 400, `CORPO_VIDA` 900) |
| `hordeRender`, `ZVAR`, `populate`, `populationUpdate` | 71424-71506 | 55916- | variantes assadas por tipo, LOD por distância (`LOD_D` 18 e 55 m), população com reposição pela borda |
| `zSpecialSpawn`, `zAbility`, `zChaseSpeed`, `zFrame`, pirâmide, piscina, rastro de sangue | 71507-71729 | 56073- | habilidades dos 13 tipos (estados 5 no ar, 6 dormente, 7 inchando, 8 golpe em arco, 9 comendo, 10 degrau da pirâmide, 12 indo ao som), pirâmide de corpos (`PILE_STEP` 0,48, `PILE_TOP` 3,7), piscina do Afogado, `TRAIL` do Farejador |
| `fxLimb`, `fxBlood`, `decalAdd`, `fxCloud` | 72284, 72245, 72174, 72271 | 56416 | membro arrancado voa (cápsula instanciada, 40 máx.), sangue por idade, decal que seca, nuvem do Inchado |
| `NPC` (quarteirão), `npcUpdate`, `npcMove`, `npcZombies`, `zChaseNpc`, `npcMorre`, `npcVira`, `npcRender`, `VS`, `DIARIO`, rádio das 20 h | 74248-74510 | 58375-58605 | 4 NPCs do quarteirão (Helena, Davi, Seu Cícero, Sandra) com rotina `[hora, lugar]`, fala, item marcado, vínculo; morte, mordida e reanimação como Lento; rádio da Jéssica; relógio do vale que roda `simulate()` à meia-noite |
| `GROUPS`, `NPCS`, `RELS`, `EV`, `FACT`, `LOOT`, `GENT`, `life`, `simulate` | 73490-74247 | (cópia) | o código de `vivos.js` embutido, sem a interface |

---

## 2. Versões diferentes do mesmo assunto

Critério de "melhor": serve a um `game-characters` único, reutilizável por jogos futuros, sem perder comportamento já entregue.

### 2.1 Corpo (esqueleto, proporção, geometria)

| Assunto | Versão (onde) | O que tem | Melhor | Por quê | Ação |
|---|---|---|---|---|---|
| Proporção base | Elenco `build` (`elenco:160`) e Retratos `build` (`retratos:64`) | 1,80 m; ombros ±0,305 (0,61 m) homem e ±0,285 mulher; tronco Lathe 24 lados, escala 1,12×0,64; cabeça 0,165; coxa 0,42 + canela 0,38; 4 dedos e polegar | **Elenco (guia de estilo)** | é o que o texto do guia declara (ombro 0,60/0,55) e já é a base de bestiário e retratos | Usar como **`BodySpec` padrão** (medidas viram dados) |
| | Bestiário `build` (`bestiario:123`) e `BEST` v17 (`livre:70113`) | mesmo corpo do Elenco, sem dedos, com variação sorteada, 13 posturas, idade, cortes, LOD (`setLOD`) | **`BEST` v17** | superset do bestiário com LOD e ossos marcados que o `bakeBody` precisa | Portar o v17; o v0.1 fica só como fonte de texto |
| | Jogo `buildBody` (`livre:69693`) | ombros ±0,24 (0,48 m), cabeça 0,13, torso 0,86-1,53, 12 ossos; feito para 6000 instâncias | **para execução em massa** | animação na GPU, 3 LODs, máscara de partes | Manter como **caminho instanciado**, mas **corrigir a proporção** para o guia (hoje 20% mais estreito) |
| | Arsenal `buildZombie` (`arsenal:866`) | caixas, 11 segmentos hierárquicos (coxa → canela → pé etc.), ombros ±0,27 | **só a árvore de segmentos** | geometria de caixa é descartável; a hierarquia de 11 partes é o que o dano usa | Portar a **lista de segmentos** (ids e hierarquia), não a malha |
| | Mapa `figure` (`mapa:102`) | Lathe 12 lados, membros de 8, ombros ±0,215; escala sorteada 0,92-1,08; marca sangue | nenhuma | proporção própria e estreita; serve a cenário | **Substituir** por instâncias do corpo único (LOD2) |
| | Bancada `buildZombie` (`hordas:53395`) | cápsulas, 7 ossos, sem cotovelo nem joelho, 3 LODs com contagem de triângulos | LODs e orçamento de triângulos | a ideia de meta (2.500/800/250) vale, o modelo não | Usar os números como **meta de golden**; descartar o modelo |
| Dedos e mãos | Elenco (`elenco:253`) | 4 dedos com 2 falanges, polegar, `mount` | **Elenco** | único com mão articulada, usada para segurar item | Portar como parte opcional do LOD0 |
| Torso feminino | `TORSO_F` (Elenco, Bestiário, `BEST`) | perfil próprio | igual em todos | dado idêntico | Dado em `BodySpec` |
| Rosto, cabelo, chapéus, acessórios | Retratos (`retratos:114-299`) | **superset do Elenco**: `pony`, `mirror`, `labgoggles`, `helmet`, ~35 acessórios a mais | **Retratos** | contém tudo do Elenco e mais | Portar o do Retratos; **remover** o do Elenco |
| Cão | Elenco (`elenco:341`), Retratos (`retratos:94-105`), Mapa `dog` (`mapa:132`), `cao` do Bichos (`bichos:299`, `quad`) | cilindros; cilindros; caixas; quadrúpede completo com 3 segmentos de pata, mandíbula, orelhas, cauda, infecção | **Bichos `cao`** | único com esqueleto de animal e estados | **Substituir** os três cães por `game-animals` `dog` com cor por parâmetro (Trovão, Caramelo, cão de rua) |

### 2.2 Postura e andar

| Assunto | Versão (onde) | O que tem | Melhor | Por quê | Ação |
|---|---|---|---|---|---|
| Postura por tipo | Bestiário `TYPES`/`BASE` (`bestiario:97-112`) | 13 posturas como deltas de junta | **Bestiário (= `BEST.TYPES`)** | dado puro, completo | Vira **dado de conteúdo** (`poses` por tipo) |
| | Mapa (`mapa:108-127`) | `lean` e braços sorteados, 3 tipos | nenhuma | sorteio sem identidade | Descartar |
| Andar por tipo | Bestiário `GAIT`/`animate0` (`bestiario:286-320`) | amplitude, joelho, balanço, arrasto de perna, comportamentos especiais (salto, escuta, sniff, come, rasteja, grito) | **Bestiário**, como **catálogo de clipes** | é o único com clipes de identidade (leap, listen, eat) | Portar como `GaitProfile` (dado) + clipes especiais (`AnimationClipSpec` do `game-contracts`) |
| | Jogo `bodyAnim` (`livre:69727`) | cascata por osso, 8 poses, passada pelo chão (`walkGait`), tudo no shader | **Jogo, como motor de execução** | roda em milhares, passada sem patinar | Portar para `game-characters-three` (instanciado) |
| | Bancada `animChunk` (`hordas:53430`) | 7 ossos, cascata simples | nenhuma | o jogo superou | Descartar |
| | Mapa `gait`/`GAIT` (`mapa:136-143`) | f, l, a, r, **v em m/s** por tipo, anda de verdade | referência de velocidade só | velocidades conflitam com as do Bestiário (ver 5.1) | Descartar o código, registrar a discrepância |
| Cascata de juntas | Bestiário `CASC` (`bestiario:322`) | atrasos por junta 6-16 | **Bestiário** (valores) | números explícitos; o jogo usa `lag` 0,2/0,35/0,55 por osso | Unificar: `cascade` com tabela única por junta |
| Andar do humano | Elenco `MOVES` (`elenco:358`) e Retratos (`retratos:309`) | `idle`, `walk`, `run`, `crouch`, `aim`, `turn` com mistura contínua | **Elenco** | único com agachar, mirar e virar; o jogo só tem 8 poses de zumbi + humano armado | Portar `MOVES` como estados do corpo humano |
| Andar do zumbi nomeado | Retratos `pose(zombie)` (`retratos:320`) e Elenco estágio 4 (`elenco:572-585`) | perna esquerda curta, braços para a frente, cabeça tombada | **Elenco (estágio 4)** | mais completo (mão, dedos) | Redundante com o andar de Lento: usar o do tipo |

### 2.3 Dano, corte e desmembramento

| Assunto | Versão (onde) | O que tem | Melhor | Por quê | Ação |
|---|---|---|---|---|---|
| Vida por segmento | Elenco `segs` (`elenco:336-339`): cab 40, tronco 120, quadril 90, braço 60, antebraço 45, mão 25, coxa 80, canela 55 | 8 tipos | **Elenco** como lista de partes; números a reconciliar | tem antebraço, mão e canela separados | Dado `partHp` (ver 5.5) |
| | Arsenal `HPS` (`arsenal:858`): cab 40, mand 12, pescoço 25, tronco 150, quadril 90, braço 45, antebraço 30, mão 12, coxa 55, canela 40, pé 15 | 11 tipos | **Arsenal**, **como lista de partes** | único com mandíbula, pescoço e pé | Lista de 11 partes é a canônica |
| | Jogo `SEG` (`livre:66328`): cabeça 40, braço 60, perna 80 | 3 valores | jogo, **como regra** | granularidade mínima para multidão | Vira o nível "baixo" do mesmo modelo (3 grupos) |
| Multiplicador por região | Arsenal `MULT` (head 3, jaw 2, neck 2, tronco 1, membros 0,6-0,7) | por parte | Arsenal para o **humano/teste** | tem pescoço e mandíbula | Dado |
| | Bestiário (`Z.mult`) e jogo `CATS.mult` | por **tipo**, em 4 grupos [cabeça, tronco, braços, pernas], × `IDADES.membro` × `ROUPAS.membro` | **Jogo** | é o único que combina tipo, idade e roupa | Manter a composição; as duas tabelas coexistem (por parte × por tipo) |
| Corte | Elenco `sever` (`elenco:449`) | corte na junta acima, `BELOW` leva o resto, toco com anel/carne/gordura/osso, pedaço voa, poça | **Elenco** (regra) | regra de hierarquia correta e documentada | Portar a regra e o toco |
| | Arsenal `sever` (`arsenal:967`) | toco `stumpAt`, jorro pulsante, pedaço voa, `bloodBurst`; `explodeSeg` 14 pedaços; `splitTorso`; `gouge`; `exitWound` | **Arsenal** (dinâmica) | único com estouro, tronco partido, ferida de saída, pedaços de carne | Portar tudo, ligado ao `Hit` do contrato |
| | Jogo `miss` + `fxLimb` (`livre:71337`, `72284`) | máscara de bits por parte, parte some no shader, cápsula voando | **Jogo** para multidão | custo fixo | Manter como **caminho instanciado**; o caminho rico (Elenco/Arsenal) fica para o zumbi de perto |
| Osso quebrado | Elenco `breakBone` e `pends` (`elenco:458`, `593`) | membro quebrado pendura e balança como pêndulo; perna quebrada manca | **Elenco** | único; o jogo só tem `limp` | Portar |
| | Bestiário `cut.dangleR/L` | antebraço pendurado estático | Elenco | o do Elenco anima | Descartar (cena estática) |
| Cabeça e morte | Elenco: cabeça a zero corta se `cut ≥ .7` ou dano ≥ 90, senão "quebrado" e abate | | **Jogo** (`zDamage` região 0) | tem capacete, calibre, distância (`cranio`), 12 ga a menos de 5 m arranca a cabeça | Usar o do jogo |
| | Arsenal: dano ≥ 30 estoura | | jogo | idem | idem |
| Tronco e quadril | Arsenal `splitTorso` (partir ao meio) e Elenco ("fatal no tronco, mas zumbi só cai com tiro na cabeça") | | **Elenco/Bestiário** para zumbi (regra de ouro: só o crânio mata); **Arsenal** só com dano ≥ 150 | a regra do jogo prevalece; partir ao meio é exceção de arma pesada | Parametrizar por tipo de criatura |
| Perna | Arsenal (`legLost` → rasteja, pé → manca), Elenco (50% manca, 0 rasteja), jogo (≤50% `limp`, 0 `crawl`) | | **Jogo** | já implementa o que o Bestiário descreve | Usar o do jogo |
| Penetração de bala | Bestiário (cena `penetracao`): 9 mm 2 corpos −50%; 5.56 3 corpos −35%; .308 4 corpos −25% | tabela | **jogo** (`CALIBRES.pen` + custo membro 0,5 / tronco 1 / cabeça 0,7, cada corpo −25%) | está no código e casa com `game-weapons` | Ver 5.4 (conflito) |

### 2.4 Sangue, fluidos e corpos no chão

| Assunto | Versão (onde) | O que tem | Melhor | Por quê | Ação |
|---|---|---|---|---|---|
| Poça e gota | Bestiário `Fluids`/`FluidMat`/`WET` (`bestiario:393-469`) | instanciado, borda seca primeiro, 3 fluidos (blood, old, bile), gotejo por âncora em 3 fases | **Bestiário** para execução | custo fixo, tempos de secagem | Vai para VFX/fluidos (`game-fluids-three`) |
| | Elenco `addPool`/`land`/`poolShape` (`elenco:410-417`, `495-507`) | poça em fatia radial que cresce e seca em `DRY_S` | nenhuma | o Bestiário e o jogo superam | Descartar |
| | Arsenal `bloodPool`/`splat`/`paintFan` (`arsenal:903-925`) | cor por idade do sangue, respingo alongado | **Arsenal** (cor/idade e respingo oblíquo) | modelo físico de respingo | Referência para `game-fluids` |
| | Jogo `decalAdd`/`fxBlood` (`livre:72174`, `72245`) | decal instanciado com `seco` e `dryT`, sangue por **idade** (`IDADES`) | **Jogo** (como entrada) | liga idade da infecção a sangue | Interface entre characters e fluids |
| | SDK `game-fluids` (`blood` em `liquids.json`) | líquido `blood` único, `dryTime` 1200 s, `stainColor` 0x4A0A06 | **motor final** | já é o pacote de fluidos | Acrescentar variantes por idade (`blood_fresh`, `blood_old`, `blood_aged`, `bile`) e secagem de 10 min do Bestiário |
| Corpo no chão | Bestiário (cena `corpos`) e jogo `CP` (`livre:71388`) | 15 min, loot fica, escurece e dissolve; teto de 400 | **Jogo** | implementado | Portar (`CORPOS_MAX`, `CORPO_VIDA`) |
| Idade → sangue | Bestiário tabela e `IDADES` do jogo | 100/70/35/10% | iguais | | Dado |

### 2.5 Tipos de zumbi, idade e roupa

| Assunto | Versão (onde) | O que tem | Melhor | Por quê | Ação |
|---|---|---|---|---|---|
| 13 tipos (dados) | Bestiário `Z` (`bestiario:6`), jogo `CATS` (`livre:66294`), Bancada `CATS` (`hordas:53075`), Mapa `GAIT` | os do Bestiário e do jogo coincidem; Bancada tem 4 velocidades e 4 cores de olho diferentes; Mapa só tem 3 tipos | **Jogo `CATS`** | tem percepção, `escala`, `porte`, `noite`, `corpos`; é o que roda | Base do conteúdo; **resolver as divergências** da seção 5 antes de gravar |
| Habilidades | Bestiário (texto `ai`) e jogo `zAbility` (`livre:71592`) | texto; código com estados 5-12 | **Jogo** | executa as 13 | Porte da lógica fica em horda/IA (ver 4.5); o engine de personagens só guarda o código de estado |
| Idade da infecção | Bestiário (tabela, 4 idades), jogo `IDADES` | pele, velocidade, vida, membro, sangue; sem percepção no jogo | **Bestiário (tabela) + jogo (código)** | o jogo omite a percepção das idades antigas | Dado, acrescentando `perception` |
| Roupas | Bestiário `OUTFITS` (7: policial, militar, bombeiro, motociclista, operário, médico, caçador), jogo `ROUPAS` (4 com colete e capacete), Elenco `PROFS` (12), Retratos `ex` | | **Elenco `PROFS` para visual**, **jogo `ROUPAS` para regra** | Elenco tem as 12 profissões; o jogo tem colete e capacete com número | Visual em conteúdo; regra de proteção em `ClothingProtection` genérico |
| Aparência sorteada | Bestiário `build` (`VR`), jogo (`Z.col`, `Z.skin`, `Z.h`, `Z.b`, `ZVAR`) | sorteio de corpo, pele, cabelo, barba, óculos... | **Bestiário/BEST** (visual) + jogo (instância) | `BEST` é o gerador; o jogo assa por variante | Gerador `seed → appearance` no engine; variantes assadas no `-three` |
| Pele do zumbi | `SKIN` por idade (Bestiário), `ZSKIN` 6F7A5C (Elenco, jogo), 7D8B6A (Retratos `ZSKIN` não usado), lista de 4 (Mapa) | | **Bestiário `SKIN` por idade** | 4 tons por idade; o jogo perdeu isso (um tom só, mistura por `infecção`) | Dado de conteúdo, por idade |
| Zumbi nomeado | Elenco estágio 4 ("reanimado: corredor"), Retratos `zcat`, Bestiário ("sempre nasce Fresco"), jogo `npcVira` (sempre Lento, idade 0) | | **sem vencedor** | quatro regras | Dúvida 5.3 |
| Infecção do vivo | Elenco `STAGES` (horas: 2-12, 12-30, 30-48, reanima 2-4 min), jogo `INFEC` (febre 30, delírio 70, morte 120, reanima 8, relógio acelerado), `game-infection` (`incubationHours` 48, macro) | | **Elenco (horas) + jogo (aceleração)** | `game-infection` já guarda o macro; falta o individual | `ConditionTimeline` (ver 4.1) ligado a `infect()`/`materialize()` |

### 2.6 Multidão e simulação

| Assunto | Versão (onde) | O que tem | Melhor | Por quê | Ação |
|---|---|---|---|---|---|
| Colisão e empilhar | Bestiário `Crowd` (`bestiario:472`) | separação 0,62, escalar, tropeçar, paredes | referência | simulação de demonstração | Absorvido pelo jogo |
| Horda em escala | Bancada `Horde` (`hordas:53088`) | flow field, relevância R0-R3, 6 vagas, tiro com penetração, benchmark | **como benchmark** | simples, medida | Meta de desempenho (2.000 a 30 FPS) |
| | Jogo `hordeUpdate` + `zAbility` + pirâmide (`livre:71161`, `71592`) | tudo da Bancada + habilidades dos 13 tipos + pirâmide + piscina + corpos + percepção + ruído | **Jogo** | superset | Pacote de horda (T0.2), **não** `game-characters` |

### 2.7 NPCs e sobreviventes

| Assunto | Versão (onde) | O que tem | Melhor | Por quê | Ação |
|---|---|---|---|---|---|
| História, rotina, segredo | Personagens `NPCS` (8), Vivos `NPCS` (44, textos dos 8 idênticos), jogo `NPCS` (cópia de Vivos) | | **Vivos** | superset, com laços e eventos | Conteúdo |
| Visual | Elenco `NPCS` (8), Retratos `PEOPLE` (44) | | **Retratos** | superset, com `zcat`, criança, item marcado | Conteúdo |
| Rotina em execução | jogo `NPC` (4 pessoas, `rotina [hora, lugar]`, `npcUpdate`) | | **jogo** (comportamento) | roda no mundo | Motor genérico de rotina em conteúdo/IA |
| Cícero e Sandra | só no jogo (`livre:74271`) | NPCs do quarteirão que **não existem** em `vivos.js` nem em `retratos.js` | **sem equivalente** | conteúdo novo do jogo | Dúvida 5.9 |
| Fardados | Vivos (`FACT`, `RANKS`, `LOOT`, `GENT`), Retratos (camuflado xadrez, colete, placa), Arsenal | | **Vivos** (regras) + **Retratos** (visual) | | Conteúdo |
| Simulador do destino | Vivos `life`/`simulate`, jogo (cópia) | | **iguais** | | Conteúdo de jogo |

### 2.8 Animais

| Assunto | Versão (onde) | O que tem | Melhor | Por quê | Ação |
|---|---|---|---|---|---|
| Corpos, animação, infecção | Bichos `quad`/`bird`/`snake`/`SPEC`/`anim*` (`bichos:147-440`) | 13 espécies | **Bichos (original)** | é a fonte | Base do `game-animals-three` |
| | Jogo `BICHOS` (`livre:70472`) | **cópia** dos construtores e animação | igual | cópia literal | Descartar (consumir do pacote) |
| Pele de GPU | Jogo `bichoPele` (`livre:70862`) | árvore de ~50 malhas → 1 malha com matrizes de nós | **Jogo** | nada igual na página | Portar para `-three` |
| Comportamento | Jogo `bichosUpdate` (`livre:70974`) | medo, alarme, companheiro, urubus, som | **Jogo** | a página não tem comportamento | Conteúdo/IA de animais |
| Espécies no jogo | | 9 de 13 (sem javali, onça, jararaca, rato) | | | Dúvida 5.10 |
| Infecção de bicho | Bichos (`setInfected`) | visual de infectado e morto | **só visual** | nenhuma regra de zumbi de bicho no jogo | Dúvida 5.10 |

### 2.9 Qual base usar para um `game-characters` único

1. **Dados e proporção**: corpo do **Elenco/Retratos** (guia de estilo, 1,80 m, ombro 0,60 m).
2. **Construtor visual com LOD e ossos marcados**: **`BEST` v17** do jogo (`livre:70113`), mais os acessórios do **Retratos** (superset do Elenco).
3. **Execução em multidão**: **`buildBody` + `bodyAnim` + `BodyBatch` + `bakeBody`** do jogo, corrigindo a proporção para o guia.
4. **Árvore de segmentos e regras de corte**: lista de 11 partes do **Arsenal**, regra de hierarquia e osso quebrado do **Elenco**, dinâmica de sangria, estouro e ferida de saída do **Arsenal**, máscara de bits do **jogo** para o caminho barato.
5. **Dano**: `zDamage` do **jogo** (região, calibre, capacete, colete, idade, roupa).
6. **Andar**: clipes de identidade do **Bestiário**, passada pelo chão do **jogo**, estados humanos do **Elenco**.

---

## 3. O que o SDK já tem de relacionado

Não existe pacote de personagem, zumbi, animal, NPC ou ficha.

| Pacote | O que serve | O que falta para os personagens |
|---|---|---|
| `game-contracts` | `DestructibleImpl` (`impact.ts:12`, o comentário já cita "a creature"), `Hit` (`ballistic`, `blunt`, `slash`, `explosive`, `fire`, `heat`; `energy`, `caliber`, `direction`, `radius`), `PartSpec`, `JointSpec`, `DestructionEvent` (`damage`, `hole`, `detach`, `leak`, `drip`, `explode`, `destroyed`...), `TestableModule`/`TestableItem` (com `impl`, `spec`, `animations`, `fluid`, `weapon`, `movable`), `AnimationClipSpec`, `ModuleHost` (`tool`, `on`, `onFrame`, `log`) | `FluidKind` já inclui `blood`. Faltam: região do corpo no `Hit`, evento de membro arrancado com a parte e o lado, estados `limp`/`crawl` no `ObjectState` |
| `game-destruction` | mundo de destruição com `materials.json` (aço, madeira, vidro, tecido, couro, `flesh_fruit`...), juntas com `JointKind` (`screw`, `bolt`, `nail`, `weld`, `glue`, `hinge`, `clip`, `tie`, `mortar`, `fused`, `stem`, `rebar`, `resting`), `fracture.ts`, `world.ts` | **Não há `flesh`, `bone`, `sinew`, `cartilage`**; não há junta orgânica. O `slash` multiplica pelo comprimento da peça (corte em peça longa), o que dá resultado errado em membro. O corte de um membro hoje não é "cai tudo que vem depois" (isso é `collapse` por suporte), é `detach` por junta |
| `game-destruction-three` | fragmentos, partículas, `renderer`, `heat`, `ground` | peça com toco, osso e fiapos |
| `game-fluids` / `-three` | `liquids.json` com `blood` (cor 0x7A0A0C, viscosidade 4, `dryTime` 1200 s, `stainColor` 0x4A0A06), manchas (`stains.ts`), correntes, partículas, `LiquidDef` | sangue por **idade** (fresco, recente, antigo, decrépito), bile, secagem de 10 min, poça que cresce em lóbulos, respingo oblíquo, gotejo por âncora |
| `game-infection` | modelo **macro** por região (livre, abrigado, incubando, ativo, contido, partiu, removido), 48 h de incubação, `infect`, `remove`, `warn`, **`materialize`/`giveBack`** (tira N infectados do modelo como `{state, seed}`), `save`/`load` | o **zumbi individual**: corpo, idade, tipo e a linha do tempo da pessoa mordida (febre, delírio, reanimação). `materialize` devolve `seed` e `state`; ninguém transforma isso em corpo |
| `game-camera` | ombro, terceira e primeira pessoa, `viewmodel` | corpo do jogador visível na terceira pessoa e no ombro (o Elenco tem `aim`, `crouch`) |
| `game-weapons` / `-three` | `calibers.json` (inclui 5.56×45), `Shot`, `shotToHit`, áreas com alvos de chapa, compensado e concreto, `createWeaponsTestModule` | **alvo vivo** (boneco com regiões) e penetração em corpos |
| `game-test-room` | sala genérica, `loadModule`, `openArea`, narração, cenários | nenhum personagem (o jogador é uma abstração) |
| `game-props3d`, `game-interactables-household` | `recorder`, builders de peça, `garments.ts` (roupas como objeto) | corpo vestido |
| `game-vegetation-species`, `game-floorplan-residential`, `game-vehicles-fleet` | **padrão de pacote de conteúdo** (JSON, `locales/en` e `pt-BR`, tabelas por contexto) | usar como molde |
| `examples/weapons-test-area` | molde de `examples/<lib>-test-area` (`entry.js` com `loadInto(room)`) | |

---

## 4. Destino por módulo

Regra do `CLAUDE.md`: motor genérico no pacote base, three.js em `-three`, conteúdo do ZombiAdA em pacote de conteúdo, teste em `examples/<lib>-test-area`.

### 4.1 `game-characters` (motor genérico, sem three.js)

**Genérico (entra):**

- `BodySpec`: medidas dos segmentos (altura base 1,80 m, perfil do tronco `TORSO_P`/`TORSO_F`, comprimentos de braço, antebraço, coxa e canela, raios, cabeça) como dados; `BodyVariant` (altura 0,9-1,1, porte magro/médio/pesado, fem/masc, criança 0,52-0,76).
- `JointRig` (nomes: `hip`, `spine`, `neck`, `head`, `shoulderL/R`, `elbowL/R`, `wrist`, `hipL/R`, `kneeL/R`, `jaw`) com o mapeamento de ossos 0-11 do jogo; `Segment` com `hp`, `region`, `bleedRate`, `damageMultiplier`, `parent` (hierarquia de 11 partes do Arsenal).
- `PosePreset` e `GaitProfile` (`frequency`, `amplitude`, `kneeBend`, `armSwing`, `bob`, `sway`, `drag`, `lean`), `cascade` com tabela única de atrasos, `walkGait(speed, height)` (a conta do jogo: cadência 0,5+0,3·v), estados humanos (`idle`, `walk`, `run`, `crouch`, `aim`, `turn`), poses de combate (`attack`, `scream`, `crouched`, `leap`, `eat`, `crawl`, `fallen`).
- **Modelo de dano por região** como `DestructibleImpl` de "criatura": região (0 cabeça, 1 tronco, 2/3 braços, 4/5 pernas), `damageMultiplier`, capacete e colete como `ClothingProtection`, estados `intact | injured | broken | severed`, `limp` a 50% da perna, `crawl` quando falta perna, abate por cabeça, máscara de partes faltando (`missingParts` com os bits de `livre:71337`), regra "corte na junta acima, cai o que vem depois", osso quebrado que pendura (parâmetros do pêndulo do Elenco).
- `BleedModel` por região (taxa, duração, jorro) com saída para `game-fluids` (os números `BLEED` do Arsenal); `IdadeModifier` genérico (`ConditionModifier`: vida, velocidade, dano de membro, sangue, percepção) para "idade da infecção".
- `ConditionTimeline`: fases da pessoa infectada com horas e efeitos (o `STAGES` do Elenco e o `INFEC` do jogo) ligadas a `game-infection` (`infect`, `materialize`).
- `Appearance` (seed → traços): gerador semeado (`rng` mulberry32 já é igual em todas as fontes).
- **Ficha** (`CharacterSheet`: atributos com ponto-buy, habilidades por marco, traços com exclusão, profissão, `derived()` como tabela de fórmulas em dados): a regra de `personagens.js:178`. Decisão do dono: dentro de `game-characters` ou pacote `game-progression` (dúvida 5.11).
- Contrato do módulo de teste (`TestableModule`) vem de `game-contracts`: **não** entra no motor.

**Não entra (é do ZombiAdA):** os 13 tipos e seus números, idades e cores, profissões, NPCs, facções, nomes de lugar, `INFEC` do jogo, `FICHA` 5-5-5-5-5-5.

**Ajustes pedidos a outros pacotes:** `game-contracts` (região no `Hit`; evento de parte arrancada), `game-destruction` (materiais `flesh` e `bone`, junta orgânica, corte de membro sem o multiplicador de comprimento), `game-fluids` (variantes de sangue).

### 4.2 `game-characters-three`

- Construtores do corpo: tronco Lathe suavizado por spline (`torsoGeo`), membros com perfil de raio (`mlimb`), juntas esféricas, mão articulada opcional, cabeça, rosto, cabelo (6+1 estilos), chapéus, **registro de acessórios por id** (os ~45 do Elenco + ~35 do Retratos como funções `(parent, ctx) => void`), item de mão e `mount` (os itens de mão **duplicam** `game-weapons-three` e o futuro `game-items-three`: portar só os que não existem lá).
- Caminho rico (zumbi de perto, retrato): `build(spec)` com `cut`, `drip`, `splat`, `run`, toco, `makeCut`, `fly`, pêndulo, ferida de saída, pedaços de carne, `explodeSeg`, `splitTorso`.
- Caminho instanciado: `buildBody`, `bodyChunk`/`bodyAnim` (poses 0-7), `bodyMaterial`, `BodyBatch`, `bakeBody` (LOD 1/0,5/0,28), `ZVAR` por tipo, `BODY_LOD` 16/10/5.
- Animador do rig (`animate`, `cascade`, `setPose`, `lerpPose`), ponte para `game-fluids-three` (gotejo e poça), brilho dos olhos (sprite aditivo e emissivo), marca de pele por idade.
- **Pele de GPU** para o animal (de `bichoPele`) é útil aqui também para qualquer rig em árvore: decidir se mora em `game-characters-three` ou em `game-animals-three` (dúvida 5.12).

### 4.3 Conteúdo (JSON, `en` + `pt-BR`, no molde de `game-vegetation-species`)

Sugestão de dois pacotes, por reuso:

- **`game-characters-undead`** (os 13 tipos): `id`, vida, velocidades, dano, mordida, `damageMultiplier` [cabeça, tronco, braços, pernas], percepção, cor do olho, `postures` (de `TYPES`), `gait` (de `GAIT`), `size` (`escala`, `porte`), `spawnWeight`, `nightShare`, habilidade (id de comportamento), 4 idades, 4 roupas com proteção, 7 roupas de visual (`OUTFITS`), `skin` por idade. **É reaproveitável por um jogo de zumbi futuro**, mas os números são do Bestiário do ZombiAdA: o dono decide se vale como pacote separado ou se fica no do jogo (dúvida 5.8).
- **`game-characters-valley`** (só ZombiAdA): 12 profissões visuais, 44 pessoas (visual + ficha de história), 18 grupos/bases, facções fardadas (`FACT`, `RANKS`, `LOOT`, `GENT`), 17 bases do Retratos (**só o texto e as posições dos personagens**; a cenografia vai para construção/props), rotinas e laços, `EV`/`ACTS`/`JOIN`, simulador do destino (`life`, `simulate`) como lógica de jogo que **não** é do motor.

### 4.4 `game-animals` (+ `-three`, + conteúdo)

- **`game-animals`** (motor, sem three): `AnimalBodySpec` (`quadruped | bird | snake`, `L`, `R`, `span`, perfil de raio, cores, `leg{fu fl hu hl}`, `neck`, `head`, `ears`, `tail`, `walkHz`, `runHz`, `gallop`), `GaitTable` (walk, trot, gallop com fases por pata), `InfectionRule` (`turns | dies | immune`), tempos de transformação, `noise` (alcance de som), `function` (alarme, comida, ameaça, companhia), estados `infected`/`dead`.
- **`game-animals-three`**: `profileGeo`, `quad`, `bird`, `snake`, `animQuad/Bird/Snake`, `setInfected`, `setJoint`, `setSplit`, texturas (`spotsTex`, `stripeTex`), `bichoPele` (instanciável).
- **`game-animals-species`** (conteúdo, no molde de `-vegetation-species`): `SPECIES` (13) e `SPEC` (13), textos `en` e `pt-BR`. As `ZONES` e `TER` (habitat por lugar do mapa da Santa Aurora) são **do mapa do ZombiAdA**: ficam com o jogo, não no pacote.
- O comportamento do jogo (`bichosUpdate`: medo, alarme, companheiro, urubus sobre os mortos, som) é lógica de jogo; o contrato de ruído (`emitNoise`) deve falar com o pacote de horda.

### 4.5 Fora de `game-characters`, mas que a migração precisa nomear

- **Horda e IA dos zumbis** (`hordeUpdate`, `zAbility`, flow field, relevância, vagas, pirâmide, piscina, rastro, percepção e ruído): já previsto como pacote de horda em T0.2. `game-characters` fornece o corpo, o dano e os códigos de estado (0 vagando ... 12 indo ao som); a horda decide o que fazer.
- **Fluidos e VFX** (`Particles`, `blast`, `Fluids`, `FluidMat`, `fxBlood`, `decalAdd`): Fase 6.
- **Cenografia das maquetes** do Retratos e dos cenários do Arsenal/Mapa: construção e props.
- **Itens de mão** e **armas**: `game-weapons-three` e `game-items`.

### 4.6 `examples/characters-test-area` e `examples/animals-test-area`

Cada um carrega um `TestableModule` na sala genérica (`room.loadModule`, `room.openArea`), como `weapons-test-area`:

- **`characters-test-area`**: `items` = um boneco por tipo (13), humano por profissão (12), retratos (44) com item marcado, criança, zumbi nomeado, `impl` do dano por região (cada item é `DestructibleImpl`), `fluid` = sangue, `animations` = clipes de identidade (leap, listen, eat, scream, sniff). `scenarios`: tiro por região e por calibre, corte na junta (cada membro), osso quebrado, perna → manca → rasteja, cabeça → morre, granada por raio, penetração em fila, idade 0-3, roupa com colete e capacete, mordida → febre → delírio → reanimação (com `game-infection`), 100 zumbis (benchmark). `area()` com os 13 em linha e um alvo vivo; `attach(host)` escuta `shot` do `ModuleHost`.
- **`animals-test-area`**: `items` = 13 espécies, `scenarios`: andar, trotar, galopar, infectar (vira, morre, imune), `setJoint`, `setSplit`, alarme (alcance de som), 40 bichos materializados (teto do brief).

### 4.7 Tabela de "genérico ou ZombiAdA?"

| Peça | Genérico (SDK base) | Só ZombiAdA |
|---|---|---|
| Esqueleto, juntas, proporção, `BodySpec` | sim | |
| Gerador de aparência com seed | sim | |
| Cascata, passada pelo chão, estados humanos, poses de combate | sim | |
| Modelo de dano por região, corte na junta, osso quebrado, máscara de partes | sim | |
| Sangria por região, estouro, partir tronco, ferida de saída | sim | |
| Acessórios genéricos (chapéu, colete, cinto, mochila, máscara, óculos, luvas) | sim | |
| Linha do tempo de infecção do indivíduo | sim (dados) | números 2-12 h, 12-30 h, 30-48 h |
| 13 tipos, 4 idades, 4 roupas | modelo sim | **números e nomes** (talvez reaproveitável) |
| Ficha (atributos, habilidades, traços) | modelo sim | listas e fórmulas do jogo |
| 12 profissões, 44 pessoas, 18 grupos, facções, rotinas, simulador do destino | | sim |
| Acessórios de pessoa (terço, cuia, pena de corvo, patuá, unicórnio) | | sim |
| Espécies e esqueleto de animal | sim | |
| 13 espécies com `onde`, `papel`, `ZONES`, `TER` | | sim |
| Horda, IA de habilidades | pacote de horda (genérico) | ajuste dos 13 tipos |

---

## 5. Dúvidas para o dono

Todas bloqueiam dado ou nome. Cada uma traz o que cada fonte diz.

1. **Velocidade dos zumbis.** Bestiário e jogo: Cego 0,8 / 3,0; Carbonizado 0,9 / 2,2; Afogado 0,6 / 2,5 (3,0 na água); Devorador 0,9 / 3,0; Brutamonte 0,8 / 2,0. Bancada: Cego 1,6; Carbonizado 1,6; Afogado 1,2; Devorador 2,4. Mapa: Brutamonte 1,1; Lento 1,4; Corredor 5,5; criança 1,6. Personagens: "corredor 6,0 m/s". **Proposta:** valem Bestiário e jogo; Bancada e Mapa são aproximação.
2. **Cor dos olhos.** Saltador E04AA8 (Bestiário/jogo) contra D94FD9 (Bancada); Cego D9D4C8 contra BBBBBB; Afogado 3D8BFF contra 6FA8D8; Devorador B0103A (Bestiário) contra B0122A (jogo/Bancada). Mapa: lento F2E86A, corredor FF3A2A, brutamonte FF8C1A, diferentes dos de todo mundo. **Proposta:** jogo. Pode ser só arredondamento: confirmar.
3. **Zumbi nomeado.** Elenco: o reanimado é "corredor", olhos vermelhos. Bestiário: "quem é transformado sempre nasce Fresco". Retratos: categoria por pessoa (`zcat`: corredor para Nicole, Kauã, Biel; brutamonte para Armando, Ferraz, Azevedo; os demais lento). Jogo (`npcVira`): sempre Lento, idade 0. Qual a regra?
4. **Crianças que viram zumbi.** Retratos: "crianças nunca viram zumbi nomeado, morrem fora da tela, o jogador encontra o túmulo". O jogo trata criança em `npcVira` com o mesmo `zSpawn` (escala 0,65), ou seja, a criança pode virar zumbi no jogo (`livre:74414-74419`, o ternário `n.crianca ? CAT.lento : CAT.lento` mostra que a intenção de separar ficou pela metade). Confirmar a regra e corrigir o jogo ou o documento.
5. **Penetração e vida por parte.** Bestiário: 9 mm atravessa 2 (−50%), 5.56 atravessa 3 (−35%), .308 atravessa 4 (−25%). Jogo: custo por membro 0,5, tronco 1, cabeça 0,7, cada corpo tira 25% do dano restante; `pen` 1,2 (9×19), 0,5 (12 ga), 3,0 (7,62×39), 4,0 (.308). `game-weapons` tem 5.56 mas o jogo não tem arma nesse calibre. Vida por segmento: Elenco (tronco 120, braço 60, coxa 80...), Arsenal (tronco 150, braço 45, coxa 55...), jogo (cabeça 40, braço 60, perna 80). **Qual é a tabela canônica?** (Proposta: lista de partes do Arsenal, números do jogo.)
6. **Bestiário v0.1 contra v17.** O jogo diz copiar "Bestiário v17 (implementacao/zumbi-arte/bestiario-zombiada.html)" e os dados "Bestiário v12"; a página em `sources/` é "v0.1, 22/10/2026". Existe um HTML mais novo fora desta pasta? Se existir, quero ele no lugar do trecho embutido no jogo.
7. **Proporção do corpo do jogo.** O `buildBody` do jogo tem ombros de 0,48 m e cabeça de raio 0,13; o guia do Elenco diz 0,60 m e cabeça de 1/6 da altura. Qual vale? (Proposta: o guia; o jogo fica mais largo.)
8. **Pacote dos 13 tipos.** `game-characters-undead` reaproveitável por outros jogos, ou tudo dentro de um pacote do ZombiAdA? E nomes dos pacotes de conteúdo (`-undead`, `-valley`, `-species`).
9. **NPCs que só existem no jogo.** Seu Cícero Tavares (irmão da Rosa) e Sandra Monteiro (prima da Jéssica) estão no quarteirão do `livre` e não em `vivos.js` nem em `retratos.js` (nem em `aurora`, que tem outra lista). Entram no conteúdo? Têm visual (cor 0x6a5a3a e 0x8a3a5a no jogo)?
10. **Animais.** O jogo usa 9 das 13 espécies (sem javali, onça, jararaca, rato) e **nenhuma regra de zumbi de bicho** (só há o visual na página). Portar as 13 com o visual de infectado e de morto, mas sem a regra de jogo? E as `ZONES` ficam com o jogo?
11. **Ficha de personagem.** Atributos, habilidades, traços e `derived()` do `personagens.js` entram dentro de `game-characters`, em pacote próprio, ou só como dado do jogo? O jogo hoje usa só `FICHA` 5-5-5-5-5-5 e `DERIV`.
12. **Pele de GPU de animal (`bichoPele`).** Vale também para os corpos humanos em árvore. Mora em `game-characters-three` e `game-animals-three` importa, ou o contrário?
13. **Item de mão e acessório.** O Elenco/Retratos têm machado, facão, chave inglesa, pistola... como caixas, que duplicam armas e itens. Portar só o que não existe em `game-weapons-three` e `game-items`?
14. **Mão articulada (dedos) no LOD0.** Só o Elenco/Retratos têm; aumenta o custo. Mantém só no retrato e na prévia?
15. **Aleatoriedade e goldens.** Elenco usa um `R=rng(77)` global compartilhado (o resultado depende da ordem de construção) e quase todo `splat`/`blob` usa `Math.random`. Para golden (T0.3) precisa de semente por chamada: aceito mudar a origem do sorteio, mesmo que a mancha de sangue não seja idêntica pixel a pixel?
16. **Afogado com peso 0.** No jogo o Afogado não é sorteado (`peso: 0`, só nasce na água); o Bestiário dá 1%. Confirmar.
17. **Nomes de identificadores.** Proposta de inglês na seção 1.1 e 4.1 (`walker`, `runner`, `brute`, `crawler`, `screamer`, `bloater`, `stalker`, `sniffer`, `leaper`, `blind`, `drowned`, `charred`, `devourer`; idades `fresh`, `recent`, `old`, `decrepit`). Aprovar ou trocar.
