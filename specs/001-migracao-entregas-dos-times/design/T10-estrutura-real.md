# Fase 10 — Estrutura real de casas, prédios e arranha-céus (desenho, 2026-10-25)

Regra do dono (24/10): *"na construção de arranha-céus, prédios e casa focar bem nas estruturas, pois se houver uma explosão uma interação deve
ser bem parecida com o que acontece realmente"*. Todos os valores ficam na configuração. A lista de lacunas é
`spec001/estruturas-reais-lacunas.md`; este documento cobre a lista toda em resumo e os passos 1 e 2 dela (tração/vergalhão e alvenaria
portante) em detalhe. Os passos 1 e 2 estão implementados em `game-destruction` (motor) e `game-floorplan-structure` (opção de vergalhão). O passo 2 da ordem
(lacuna 3, solo e estacas) está no §8.

## 1. A lista de lacunas, em resumo

| # | Lacuna | Onde entra | Estado |
|---|---|---|---|
| 1 | Concreto que racha na tração; o vergalhão segura o puxão; viga sem vergalhão parte | motor (`game-destruction`, `structure.flexure`) | **feito** (§2) |
| 2 | Alvenaria portante limitada pela altura (o tijolo do térreo esmaga) | motor (`partCapacity`, `structure.masonry`) e `bearingWallThickness` | **feito** (§3) |
| 3 | Solo e fundação (capacidade do solo, recalque, tombamento; estacas profundas) | motor (`game-destruction`, `soil`) + radier/estacas em `game-floorplan-structure` | **feito** (§8) |
| 4 | Núcleo rígido (tubo de concreto com elevadores e escada) | peças/presets em `game-floorplan-structure` | **feito** (§9) |
| 5 | Vento e balanço (carga lateral que cresce com a altura, amortecedor de massa) | motor (`wind`) + amortecedor em `game-floorplan-structure` | feito (§10) |
| 6 | Pele de vidro (fachada leve que estilhaça em painéis grandes) | peças em `game-floorplan-structure` | **feito** (§9) |
| 7 | Cobertura de prédio (manta, caimento, ralos, vazamento) | peças em `game-floorplan-structure` | **feito** (§9) |
| 8 | Andar técnico (máquinas, caixa d'água, amortecedor: tudo pesa) | peças em `game-floorplan-structure` | **feito** (§9; o amortecedor está no §10) |
| 9 | Tipologia de arranha-céu, usada pela cidade | `game-floorplan-commercial`/`-residential`, `game-urban` | depois |

Itens 3 a 9 dependem de 1 e 2 (as peças novas precisam de flexão e de esmagamento reais para que a explosão faça o que faria).

## 2. Flexão: o concreto racha na tração, o aço segura (lacuna 1)

### 2.1 O que muda para quem joga

- Uma viga ou laje de concreto armado atingida por uma explosão **entorta**: a face oposta à explosão (a face tracionada) **racha** e a peça
  continua de pé, porque o vergalhão segura o puxão.
- A mesma viga **sem vergalhão parte em dois** (fratura `snap`, peças grandes), porque o concreto sozinho quase não resiste à tração.
- Explosão após explosão o aço escoa; passado o giro de ruína, a peça **dobra na rótula e cai inteira** (abre os apoios, `collapse`), presa pelas
  barras, em vez de virar entulho.
- Em repouso: uma viga ou laje com vão grande demais ou carga demais para o aço que tem passa da capacidade e falha (aviso `stress`, depois a queda);
  perder um pilar dobra o vão das vigas e lajes que se apoiavam nele, e elas falham se não tiverem aço para isso (o que é o colapso progressivo real).

### 2.2 Modelo

Para cada peça com papel `beam`, `slab`, `roof` ou `stair`, de material com `strength.tensileMPa` (concreto, tijolo), que declara o seu aço
(`structure.rebar`; ver §2.4 o alcance):

1. **Geometria de flexão** (`bendGeometry`): uma peça longa (viga) vence o vão ao longo do eixo longo e dobra em qualquer dos dois eixos da seção;
   uma placa (laje) vence o vão no plano e dobra na espessura. O eixo da gravidade é o eixo de flexão mais próximo da vertical.
2. **Vão a partir dos apoios** (`spanOf`): duas vezes a maior distância de um ponto da peça ao apoio mais próximo, medida no plano do vão como o
   maior afastamento por eixo (Chebyshev). Duas paredes a 4 m dão 4 m; quatro pilares nos cantos de um painel de 5 x 4 m dão 5 m (o lado
   longo); um balanço de 1,5 m dá 3 m (o mesmo momento, `w c²/2 = w (2c)²/8`). O vão é medido de novo quando os apoios mudam (pilar perdido).
3. **Carga que dobra**: o peso próprio e o que se apoia na peça **longe** dos apoios. Uma carga que fica sobre um apoio (a até uma altura útil
   dele, a biela direta do EN 1992-1-1 6.2.2(6)) desce reta para o apoio levando onde está, e só dobra o apoio se lá também estiver longe dos
   apoios dele (um pilar do andar de cima em cima do nó não dobra a laje nem a viga).
4. **Momento em repouso**: carga uniforme `w = carga * g / comprimento` (viga) ou por faixa de 1 m (laje), `M = w L²/8`.
5. **Seção**: momento de fissuração `Mr = α fct b h²/6` (NBR 6118 17.3.1, α = 1,5 para seção retangular); momento do aço com o diagrama
   retangular da NBR 6118 17.2.2 (`0,85 fck` em `0,8 x`): `T = As fy`, `x = T / (0,68 fck b)`, `M = T (d − 0,4 x)`. Passado `x = 0,45 d`
   (limite de ductilidade, NBR 6118 14.6.4.3) o aço a mais é tomado como armadura dupla (NBR 6118 17.2.4) e soma `T2 (d − d')`.
   `d = h − cobrimento − φ/2`. O aço vem de `structure.rebar.ratio` (`As = ρ b d`) ou da gaiola `reinforcement` (uma barra a cada
   `spacing` na laje; as barras da face na viga).
6. **Capacidade**: antes de fissurar a seção segura `max(Mr, Maço)`; depois de fissurada, só `Maço` (uma seção com pouco aço, abaixo da armadura
   mínima, cai de `Mr` para `Maço` ao fissurar). `PartState.flexure = M / capacidade`, e `stress` passa a ser o maior entre isso e a compressão
   (a compressão só vale para viga e laje com capacidade dada pelo projetista, `structure.capacity`; sem ela, a carga que o solver passa pela viga
   não é uma compressão que ela leve).
7. **Explosão** (sistema equivalente de um grau de liberdade, Biggs 1964):
   - massa de TNT `W = energia / 4,184 MJ/kg`;
   - impulso refletido por área em pontos da face que recebe a explosão ao longo do vão: incidente de Sadovsky `i = 200 W^(2/3)/R` (Pa·s),
     vezes o fator de reflexão `2 + 4/Z` (`Z = R/W^(1/3)`), que sobe perto da carga como as curvas de impulso refletido do UFC 3-340-02 (fig. 2-7);
     abaixo de `Z = 0,5` a distância é mantida em `Z = 0,5` (perto assim manda a brecha dos pontos de vida);
   - impulso total `I = ī cosθ b L`; energia cinética `(KL I)²/(2 KM m)` com `KL = 0,64`, `KM = 0,50` (viga biapoiada, carga uniforme, elástico);
   - essa energia vira deformação até um momento de pico `M = (L/8) √(2 E k / KL)`, `k = 384 EI/(5 L³)`, `E = Eci` do concreto, somado ao
     momento de repouso quando a explosão empurra no sentido do peso (de cima) e descontado quando empurra para cima;
   - pico acima de `Mr`: a face tracionada **racha** (`crack` na face oposta à explosão, `PartState.cracked`); sem aço, a peça **parte**
     (`fracture` com `style: 'snap'`); com aço, se o pico passa de `Maço` o aço escoa e a rótula gira `(U(M) − U(Maço)) / (2 Maço)` por explosão
     (somado em `PartRuntime.hinge`); no giro de ruína (10°) a peça **dobra e cai** (`detach` dos apoios, `collapse`).
8. **Falha em repouso**: a sobrecarga de flexão (`flexure > 1`) usa o mesmo dano por segundo da compressão (`overloadRate`); quando a peça cede,
   uma peça armada dobra e cai inteira (rótula), uma sem aço parte (`snap`).

### 2.3 Superfície de configuração

- `MaterialDef.strength` (novo, valores reais): `compressiveMPa`, `tensileMPa`, `elasticGPa`, `slender`. Concreto C25 e tijolo cerâmico vêm
  preenchidos; os outros materiais continuam só com o `compressive` ajustado para o jogo.
- `DestructionOptions.structure.flexure` (`FlexureOptions`): `enabled`, `roles`, `scope`, `crackFactor`, `rebarYieldMPa`, `cover`,
  `neutralAxisLimit`, `failRotationDeg`, `loadFactor`, `massFactor`, `tntJoules`, `impulse`, `reflection`, `reflectionNear`, `nearScaled`.
- `DestructionOptions.structure.masonry` (`MasonryOptions`): `minEccentricity`, `slendernessLimit`, `concreteFactor`.
- `PartSpec.structure.rebar` (novo no contrato, `TensionRebar`): `ratio`, `yieldMPa`, `cover`. `ratio: 0` é concreto simples, declarado.
- `sizeRebar(spec, options)` (e `sizeStructure`, que agora chama ele): dá a cada viga/laje armada a taxa de aço que a deixa em `safety` em repouso e,
  com `redundancy`, abaixo disso depois da perda de qualquer peça de `redundancyRoles`; só aumenta (até 4%, NBR 6118 17.3.5.2.4), nunca arma
  concreto simples.
- `buildFrame({ rebar })`: vigas 1%, lajes 0,5% por padrão; `false` deixa o pórtico em concreto simples.
- `toDestructibleSpec({ rebar })` em `game-floorplan-structure`: declara o aço das vigas e lajes de concreto (`REBAR_RATIOS`: viga 0,8%,
  laje 0,25%, escada 0,4%) e dimensiona com `sizeRebar`. **Desligado por padrão** (§5).

### 2.4 Alcance (`flexure.scope`) e por que o padrão é `rebar`

`scope: 'rebar'` (padrão): só entram as peças que declaram `structure.rebar`. `'reinforced'`: também as que só têm a gaiola `reinforcement`.
`'all'`: todas; sem aço nenhum, concreto simples. O padrão deixa as estruturas feitas antes deste modelo como estavam: nenhuma golden muda (§6).
Ligar `'reinforced'` hoje derruba as casas do `game-floorplan`: ver §5.

### 2.5 Eventos

`crack` (face tracionada) → `stress` (sobrecarga, a cada 0,5 s) → `fracture` com `style: 'snap'` (sem aço) ou `detach` dos apoios + `collapse`
(com aço, rótula). Nenhum tipo de evento novo; `PartState` ganha `flexure` e `cracked`, `PartRuntime` ganha `hinge` (salvos no `serialize`).

## 3. Alvenaria portante limitada pela altura (lacuna 2)

### 3.1 Modelo

- Capacidade de compressão com a resistência real (`partCapacity`, quando o material tem `strength`): `fk × seção`; parede ou pilar de alvenaria ou
  concreto simples (`slender`, padrão para material `masonry` sem aço) fica com `(1 − 2 e) (1 − (λ/40)³)` disso, `e = 0,05` (excentricidade
  mínima, NBR 16868-1 e EN 1996-1-1 6.1.2.2) e `λ = h/t` (fator de redução R da NBR 16868-1). Pilar armado: `0,85 fck Ac + As fy` (NBR 6118).
- A carga acumulada já vem do solver (cada andar desce para o de baixo); por isso o **térreo é o primeiro a passar de 1** e esmagar (`fracture`
  `crumble`), e o que está em cima cai sobre ele (`collapse`).
- `bearingWallThickness({ storeys, storeyHeight, floorLoad, material, loadFactor = 1,4, materialFactor = 2,0, minThickness = 0,14 })`: a
  espessura que um projetista dá a cada andar, de cima para baixo, com os coeficientes da NBR 8681 (γf 1,4) e da NBR 16868-1 (γm 2,0).

### 3.2 Conferência com o caso do vídeo (cerca de 2 m de parede para 16 andares)

Monadnock Building (Chicago, 1891): 16 andares em alvenaria portante de tijolo, 1,8 m (6 pés) de parede na base. Com andares de 3,75 m
(60 m / 16), piso de escritório pesado (5 kPa de laje de arcos cerâmicos e enchimento + 2,5 kPa de uso, NBR 6120, sobre 3,5 m de faixa por
parede = 26 kN/m), tijolo `fk = 2,35 MPa` e os coeficientes acima, `bearingWallThickness` dá **1,49 m na base**, afinando até 0,14 m no topo
(1,49 · 1,32 · 1,16 · 1,02 · 0,89 · 0,77 · 0,67 · 0,57 · 0,49 · 0,41 · 0,34 · 0,28 · 0,22 · 0,18 · 0,14 · 0,14). A ordem de grandeza confere
com os 1,8 m reais; a diferença é esperada: a alvenaria de 1891 (argamassa de cal, tijolo comum) era mais fraca que `fk = 2,35 MPa`, e o
código de Chicago da época (12 pol. no topo + 4 pol. por andar abaixo = 72 pol.) também cobria o vento, que este modelo ainda não tem (lacuna 5).
No motor: o mesmo prédio com 20 cm no térreo esmaga (`stress > 1` no térreo em repouso); com as paredes do dimensionamento fica a ~0,36 da
resistência real no térreo e não cai.

Casa: 2 andares (2,8 m, 11,5 kN/m de piso por parede) pedem só o mínimo de 14 cm; a casa de alvenaria do `game-floorplan` tem 15 cm e passa a
ser pórtico a partir de 3 andares, o que está dentro do real. Uma torre de paredes de 19 cm (uma vez de tijolo) aguenta 17 andares na ruptura real
(sem coeficientes) e esmaga no 18º: é o limite físico; o de projeto, com γf·γm = 2,8, fica em 6.

## 4. Valores padrão e fontes

| Valor | Padrão | Fonte |
|---|---|---|
| Concreto: fck | 25 MPa | classe C25, NBR 6118 / EN 1992-1-1 |
| Concreto: fctm | 2,56 MPa = 0,3 fck^(2/3) | NBR 6118 8.2.5; EN 1992-1-1 tab. 3.1 |
| Concreto: Eci | 28 GPa = 5600 √fck | NBR 6118 8.2.8 (agregado granito) |
| α do momento de fissuração | 1,5 | NBR 6118 17.3.1 (seção retangular) |
| Aço CA-50: fyk | 500 MPa | NBR 7480 |
| Cobrimento | 3 cm | NBR 6118 tab. 7.2 (classe II, vigas) |
| x/d limite | 0,45 | NBR 6118 14.6.4.3 |
| Diagrama de compressão | 0,85 fck em 0,8 x | NBR 6118 17.2.2 |
| Taxa máxima de aço | 4% | NBR 6118 17.3.5.2.4 |
| Giro de ruína (explosão) | 10° | PDC-TR 06-08, dano "hazardous" de vigas e lajes de CA |
| KL, KM | 0,64, 0,50 | Biggs, *Introduction to Structural Dynamics* (1964), viga biapoiada, carga uniforme |
| TNT equivalente | 4,184 MJ/kg | definição |
| Impulso incidente | 200 W^(2/3)/R Pa·s | Sadovsky (Henrych, *The Dynamics of Explosion*, 1979) |
| Reflexão | 2 + 4/Z | ajuste à tendência das curvas do UFC 3-340-02, fig. 2-7 (±30%) |
| Tijolo: fk | 2,35 MPa = 0,55 fb^0,7 fm^0,3 (fb 4, argamassa M5) | EN 1996-1-1 3.6.1.2 |
| Tijolo: ftk (flexão) | 0,1 MPa | EN 1996-1-1 tab. NA, fxk1 |
| Tijolo: E | 2,35 GPa = 1000 fk | EN 1996-1-1 3.7.2 |
| Excentricidade mínima | 0,05 t | NBR 16868-1; EN 1996-1-1 6.1.2.2 |
| Redução por esbeltez | 1 − (λ/40)³ | NBR 16868-1 |
| γf, γm (dimensionamento de parede) | 1,4, 2,0 | NBR 8681; NBR 16868-1 |
| Espessura mínima de parede portante | 14 cm | NBR 16868-1 |
| Gravidade | 9,81 m/s² | constante física |

## 5. Achado: as casas do `game-floorplan` não são uma estrutura real em flexão

Com o aço declarado e dimensionado (`toDestructibleSpec({ rebar: true })`), a casa térrea pede 3,7 a 4% de aço na laje do forro e o sobrado em
pórtico fica com a laje do 1º andar a **1,5 da capacidade em repouso mesmo com 4%**: ela é uma peça única de 8 x 12 m e 12 cm apoiada nas
cintas da borda (15 x 20 cm vencendo 12 m), carregando tudo o que está em cima. Uma laje real dessa planta teria vigas a cada 4 a 5 m
(um painel por cômodo). Por isso a opção fica desligada por padrão e o alcance do motor é `rebar`: ligar hoje faria a casa da área de casas
cair sozinha. Para ligar é preciso (a) dividir as lajes por painel com vigas reais no `game-floorplan-structure` e (b) aceitar que os hashes
`coarseParts`/`enclosureParts` das goldens `vc3-structure` mudem (a spec passa a ter `structure.rebar` e, com (a), mais peças). Pergunta ao dono.

## 6. Goldens

Nenhuma golden muda. As auto-goldens de `game-destruction` (`gate-rpg-collapse`, `house-scenarios`) usam só a gaiola `reinforcement`, fora do
alcance padrão; com `scope: 'reinforced'` elas mudariam assim (medido): no pórtico do RPG a laje dobra no apoio que sobra e cai com o telhado em vez
de o pilar e a sapata cederem primeiro; nas duas cenas de pilar da casa a laje fissura (`crack`, estágio 1) por passar de 0,8 da capacidade de
flexão depois de perder um pilar. Nenhuma golden de time (`vc3-*`) muda. Testes antigos que mudaram: as capacidades documentadas do pilar e da
parede (agora pela resistência real: 30 x 30 cm de C25 = 203 t, 1 m de parede de tijolo de 20 cm = 41 t) e os pórticos de teste que precisavam de
um projeto para perder um pilar (dimensionados com `redundancy`, ou com o aço declarado para isso).

## 7. Limites conhecidos (próximos passos)

- A carga é tomada como uniforme ao longo do vão (uma carga concentrada no meio dá o dobro do momento).
- Uma só taxa de aço por peça, nas duas faces (laje real tem a malha de baixo no vão e a de cima nos apoios); o desenho da gaiola continua no meio
  da espessura, o cálculo usa a altura útil real.
- Impacto (carro, objeto lançado) ainda não dobra vigas: o `Hit` precisa da massa do impactador (`Hit.mass` de `blunt`).
- Paredes ainda não dobram para fora do plano numa explosão (a parede de vedação empurrada para dentro): entra com a pele de vidro (lacuna 6).
- As energias dos explosivos de `game-weapons` são menores que as reais (granada 200 kJ = 48 g de TNT; uma M67 tem ~185 g de Composição B,
  ~0,24 kg de TNT): pergunta ao dono se corrige a tabela.

## 8. Solo e fundação (lacuna 3, passo 2 da ordem; 2026-10-25)

### 8.1 O que muda para quem joga

- Um prédio alto em sapatas sobre argila mole **afunda e tomba**: o solo cede, o prédio desce e se inclina para o lado mais estreito, e quando o
  centro de massa passa da borda da fundação ele vai ao chão inteiro (`settle` com `status: 'toppled'`, depois `collapse` de tudo).
- O mesmo prédio sobre **estacas de concreto que descem até a areia firme** fica de pé: assenta uns centímetros e não se mexe mais.
- Uma casa sobre radier em solo firme não sente nada (recalque de milímetros, nenhum evento).
- Tudo só para objetos com solo (`DestructibleSpec.soil`); sem ele a fundação continua fixa no mundo como antes.

### 8.2 Modelo

1. **Solo por camadas** (`SoilProfile`: camadas de cima para baixo, a última infinita; ou só o id de uma classe). Cada classe (`SoilDef`, registro
   `SOILS` em `soils.json`) tem a tensão admissível de sapata `qa` (NBR 6122), o N do SPT, o módulo `E` e o Poisson `ν`.
2. **Sapata, sapata corrida, radier**: cada peça `foundation` (que não seja `terrain`) vira uma grade de células (`soil.cells` por lado) que são molas
   elastoplásticas: rigidez `ks · área` com `ks = E / (B (1 − ν²) Iw)` (recalque elástico de sapata rígida, Bowles) e capacidade `FS · qa · área`
   (FS global 3, NBR 6122). `qa` é a menor e `E` a média das camadas até `influence` (2) larguras abaixo da base: a argila mole debaixo de uma crosta
   firme conta, como no silo de Transcona.
3. **Peças sobre o terreno** (a laje `terrain` que o `game-floorplan` usa como chão): cada parede ou pilar apoiado nela ganha uma sapata de pelo menos
   `footingWidth` (0,60 m, mínimo da NBR 6122) de largura.
4. **Estaca** (`structure.pile`: `length`, `diameter`, `count`, `method`): cada estaca é uma mola com a resistência última de Décourt-Quaresma
   (ponta `α C N A`, atrito `β 10 (N/3 + 1)` kPa por camada, N entre 3 e 50; C = 120 argila, 200 silte, 400 areia; α, β de Décourt 1996 para escavada,
   1 para cravada; rocha com valores próprios) e a rigidez do fuste encurtando sob metade da carga em série com a ponta como placa rígida.
   `pileLength` dá o menor comprimento (de 0,5 em 0,5 m) que carrega a carga com FS 2 (NBR 6122): é o "descer até o chão firme".
5. **O objeto é um corpo rígido sobre as molas**: recalque `s` e inclinações `a`, `b` da base. O equilíbrio (Newton, 3 incógnitas) inclui o
   **desaprumo** de 1/200 (EN 1992-1-1 5.2) no sentido desfavorável (o eixo em que a fundação é mais fraca) e o **P-delta** (o peso anda `h · a` quando
   o prédio inclina), de onde sai a instabilidade de tombamento da Torre de Pisa (Hambly 1985: cai quando `W h` passa a rigidez à rotação).
   O solo que cede guarda a deformação (recalque permanente por mola).
6. **Tempo**: ao ser posto no mundo o objeto já está no equilíbrio (o prédio "estava ali"). Em `update`, mudança elástica é imediata; solo que cede
   leva o objeto ao novo equilíbrio a `sinkRate` (0,05 m/s) e `tiltRate` (1,5°/s) — tempo de jogo, o real leva horas a dias; sem equilíbrio estável ele
   continua afundando e inclinando até o centro de massa passar da borda da fundação (ou 60°): tomba.
7. **Pose**: `ObjectState.position`/`rotation` passam a ser a pose do host (`setTransform`) com o recalque e a inclinação por cima
   (`ObjectState.soil.offset`, girando em torno do centro de rigidez na cota da base). Tiro, explosão e raio usam a pose real. `game-destruction-three`
   desenha as peças sob um nó `destruction-soil` com esse deslocamento, sem mexer no nó raiz do host.

### 8.3 Superfície de configuração

- Contrato: `DestructibleSpec.soil`, `SoilProfile`/`SoilLayer` (`surface`, `footingWidth`), `PartSpec.structure.pile` (`PileSpec`),
  `ObjectState.soil` (`SoilState`: `settlement`, `tilt`, `direction`, `bearing`, `edge`, `status`, `offset`), evento `settle`.
- Mundo: `soil` (`SoilOptions`): `soils` (registro), `site` (solo padrão de objetos com fundação), `safety` 3, `pileSafety` 2, `rigidity` 0,82,
  `influence` 2, `imperfection` 1/200, `cells` 4, `sinkRate`, `tiltRate`, `footingWidth` 0,6, `pileElasticGPa` 25.
- Funções: `pileCapacity`, `pileLength`, `pileStiffness`, `footingSoil`, `subgradeModulus`, `footingArea`, `solveFoundation`, `SOILS`, `SOIL_DEFAULTS`.
- `buildFrame({ footing, raft, piles, soil })`.
- `toDestructibleSpec({ soil, foundation, piles, soils })` em `game-floorplan-structure`: com solo, fundação `raft`/`basement`/`building` vira um radier
  de concreto (`RAFT_THICKNESS` 0,25 m) sob as peças apoiadas no chão; `piles` põe estacas sob ele (diâmetro 0,4 m, uma a cada `PILE_AREA` 9 m², pelo
  menos 4, comprimento por `pileLength`); as outras fundações mantêm o terreno com uma sapata sob cada parede e pilar. Sem `soil` nada muda.

### 8.4 Valores e fontes

| Classe | qa (kPa) | N SPT | E (MPa) | ν | Fonte de qa |
|---|---|---|---|---|---|
| `rock` / `rock_fractured` | 3000 / 1500 | 50 | 10000 / 2000 | 0,2 / 0,25 | NBR 6122:1996 tab. 4 (rocha sã / laminada); estaca: ponta 3 qa, atrito 500/300 kPa (típico de estaca embutida em rocha) |
| `gravel_dense` / `gravel_loose` | 600 / 300 | 40 / 8 | 132 / 26 | 0,3 | NBR 6122:1996 tab. 4 |
| `sand_very_dense` / `sand_dense` / `sand_medium` | 500 / 400 / 200 | 45 / 25 / 12 | 120 / 68 / 32 | 0,3 | NBR 6122:1996 tab. 4 |
| `sand_loose` | 50 | 3 | 8 | 0,3 | fora da tabela (a norma pede ensaio); valor típico |
| `silt_hard` / `silt_stiff` / `silt_medium` | 300 / 200 / 100 | 25 / 15 / 8 | 44 / 26 / 14 | 0,35 | NBR 6122:1996 tab. 4 |
| `clay_hard` / `clay_stiff` / `clay_medium` | 300 / 200 / 100 | 25 / 15 / 8 | 35 / 21 / 11 | 0,4 | NBR 6122:1996 tab. 4 |
| `clay_soft` / `clay_very_soft` | 30 / 15 | 3 / 1 | 4,2 / 1,4 | 0,4 | 5,14 cu / 3 (Skempton) com cu 18 / 9 kPa |

Módulos: Teixeira & Godoy (1996), `E = α K N` (areia 3 · 0,9; silte 5 · 0,35; argila 7 · 0,2; pedregulho 3 · 1,1 MPa). A NBR 6122:2019 tirou a
tabela de pressões básicas, mas os valores continuam a referência usual de anteprojeto. FS global 3 (sapata) e 2 (estaca): NBR 6122:2019.
Décourt & Quaresma (1978) e Décourt (1996) para as estacas. `Iw` 0,82: sapata quadrada rígida (Bowles, *Foundation Analysis and Design*).

### 8.5 Conferência

- Sapata de 2 x 2 m em areia média a 150 kPa: o motor dá 7,0 mm, igual a `q B (1 − ν²) Iw / E`.
- Estaca escavada de 0,6 m, 21 m (18 m de argila mole + 3 m de areia compacta): 2220 kN de resistência última (543 de atrito na argila, 264 na
  areia, 1414 de ponta), conferido à mão no teste; para 1,2 MN com FS 2 ela precisa de 23,5 m.
- Prédio de 20 andares, 8 x 16 m, 2500 t em 15 sapatas de 2,5 x 2,5 m sobre argila mole: 260 kPa contra 90 de ruptura (`bearing` 3,1); afunda e
  tomba pelo lado de 8 m com cerca de 9° (o centro de massa a 34 m de altura passa da borda a 5,25 m). Em estacas de 0,6 m até a areia: 2 cm de
  recalque, inclinação muito abaixo de 1/500 (Bjerrum), nada se mexe depois.
- Casa de 2 andares em radier sobre argila rija: menos de 1 cm de recalque, `bearing` < 0,1, as tensões da casa iguais às do terreno fixo.

### 8.6 Goldens

Nenhuma muda: o solo só existe para quem declara `soil` (ou `soil.site` no mundo), e nenhuma cena, golden de time (`vc3-*`) ou auto-golden declara.
`sizeStructure`/`sizeRebar` dimensionam sem o solo (o solo não muda as cargas da estrutura). Em `game-floorplan-three` nada mudou.

### 8.7 Limites (próximos passos)

- Sem adensamento no tempo (o recalque da argila mole em anos) nem lençol freático: só o elástico imediato e a ruptura.
- O recalque diferencial ainda não racha paredes (a distorção de 1/300 de Bjerrum daria `crack` nas alvenarias): fica para o núcleo/pele (lacunas 4 e 6).
- A estaca não resiste a arrancamento (a mola não puxa) e não há efeito de grupo; a sapata não ganha capacidade com a profundidade ou a largura.
- A estrutura sobre o solo é rígida (não se deforma com o recalque); o tombamento entrega tudo ao `collapse`, e o renderizador faz a queda.
- O pórtico de teste de 20 andares precisou de vigas de 70 cm, porque no `buildFrame` o pilar de cima nasce sobre a laje de baixo (não é contínuo).

## 9. Núcleo, pele de vidro, cobertura e andar técnico (lacunas 4, 6, 7, 8; passo 3 da ordem; 2026-10-25)

Tudo em `game-floorplan-structure/src/tower.ts`, como peças somadas a uma spec de pórtico (`addCore`, `addCurtainWall`, `addFlatRoof`,
`addMechanicalFloor`, com a geometria `TowerGeometry`) e o conjunto `buildTower`, dimensionado com `sizeStructure`. No motor entraram só três
opções genéricas de `buildFrame` e uma do contrato.

### 9.1 Motor

- **Pilar contínuo** (`buildFrame({ continuousColumns })`): o pilar de cada andar se apoia no de baixo (através da laje, como o pilar moldado no local)
  e não na laje. Antes o pilar nascia sobre a laje e a viga do 1º andar levava a torre inteira em flexão: o pórtico de 20 andares com vigas de 30 cm
  ficava a 1,69 da capacidade; contínuo fica a 0,65 com as mesmas vigas, e cada laje leva só o seu andar. Padrão desligado (as cenas e goldens que
  usam `buildFrame` ficam como estavam).
- **Gaiola dos pilares** (`columnCage`): pilar armado (capacidade `0,85 fck Ac + As fy`, juntas `rebar` monolíticas). **Laje de cobertura**
  (`roofThickness`): a cobertura plana com contrapiso e equipamento tem a espessura de um piso.
- **Saída do fluido** (`PartSpec.contains.outflow`, contrato): direção em que o líquido sai pelo furo; a água da manta escorre para baixo
  (`[0, -1, 0]`) em vez de voltar pelo furo. O `leak` e o esvaziamento (`liters`) são os de sempre.

### 9.2 Núcleo rígido (lacuna 4)

Tubo de concreto armado do alicerce (radier do núcleo `core_mat`, 1,2 m, ou o radier do prédio) à cobertura: quatro paredes de 35 cm por andar
(30 a 60 cm em núcleos de prédios altos; mínimo h/25), a parede entre a escada e os poços e as paredes entre poços (20 cm), cada uma apoiada na de baixo,
com gaiola de 12,5 mm a cada 15 cm (cerca de 0,5% da seção, acima do mínimo de 0,2% do EN 1992-1-1 9.6.2). A laje de cada andar se apoia no tubo.
Dentro: a escada em dois lances de meio andar com patamar (compartimento de 2,6 x 4,8 m; 1,6 m de subida em 2,4 m, cerca de 34°, NBR 9077) e os
poços de elevador (2,2 x 2,4 m) com a cabine parada no fundo. Layout: `coreSize` (5,95 x 5,5 m com 2 elevadores). Na explosão: a mesma carga de 5 kg de
TNT a 1 m tira um pilar de 60 cm (a pilha de pilares acima cai; as lajes ficam nas vigas e no núcleo) e só abre uma brecha (estágio 2) na parede do
núcleo, que fica com mais da metade dos pontos de vida e nada do núcleo ou das lajes desaba.

### 9.3 Pele de vidro (lacuna 6)

Um painel por vão (1,5 m) e por andar, de piso a piso, preso por `bolt` à borda da laje de cima, sem papel estrutural (não carrega nada). Vidro
`glass` (recozido/laminado; `tempered_glass` quebra em cubinhos) de 12 mm (duas lâminas de 6 mm de uma unidade insulada), 30 kg/m² de vidro + 10 kg/m²
de caixilho de alumínio. Quebra em pedaços de 0,6 m (`units`, intercamada de PVB como `plastic`) que saem com a velocidade da explosão: a chuva de
vidro é o `fracture` com esses fragmentos, desenhada pelo sistema de fragmentos que já existe. Um painel cuja laje cai vai junto. O andar técnico
não tem vidro (tem venezianas). Conferido: 1 kg de TNT a 3 m da fachada quebra mais de 6 painéis, todos em `shatter` com pedaços de até 0,6 m, e não
quebra pilar, viga, laje nem núcleo.

### 9.4 Cobertura plana (lacuna 7)

Sobre a laje de cobertura: contrapiso com caimento de 1% (mínimo da NBR 9575) até os ralos, com 2 cm no ralo (o peso sai da espessura média
`0,02 + 0,01 · percurso / 2`, percurso até o ponto mais distante de um ralo), manta de EPDM de 1,5 mm (`rubber`) e um ralo a cada 150 m² (pelo menos
2) na linha central. Contrapiso e manta pesam na laje (papel `partition`: carregados, não carregam). A manta guarda a água de chuva que está a caminho
dos ralos (5 mm por padrão, `setLiters` no jogo); um tiro que fura a manta dá `leak` de água para baixo e o nível cai pelo furo; sem furo a água fica.

### 9.5 Andar técnico (lacuna 8)

O último andar, sob a cobertura: uma máquina de tração por elevador sobre o poço (2500 kg com o quadro + 4500 kg pendurados: cabine 1500, contrapeso
2000, carga nominal 1000), o reservatório superior (`towerWater`: 16 pessoas por andar x 200 L/dia x 40% guardado em cima, NBR 5626, + 6000 L de
reserva de incêndio, NBR 13714; 20 m³ para 11 andares; de fibra/polietileno com 10 mm de parede, com a água em `contains`, vaza com tiro) e dois chillers
de 3500 kg. Tudo apoiado na laje do andar (papel `partition`), então entra na carga: a laje sob o andar técnico leva o seu andar mais os 44 t do
equipamento, e isso desce para o núcleo e os pilares. O amortecedor de massa fica para o vento (lacuna 5). O fator de impacto 2 da casa de máquinas
(EN 81-20) é para o projeto da laje e não entra no peso em repouso.

### 9.6 Torre padrão (`buildTower`)

16 x 24 m numa malha de 8 m (3 x 4 pilares de 60 cm armados com 20 mm, vigas de 60 cm), 12 andares de 3 m + laje de 20 cm, pilares contínuos, núcleo
no vão a +x do centro, pele de vidro, cobertura plana e andar técnico; cerca de 1100 peças, em repouso a 0,65 depois do dimensionamento e sem evento.
Cada sistema se desliga (`false`) ou se configura (`CORE_DEFAULTS`, `CURTAIN_DEFAULTS`, `FLAT_ROOF_DEFAULTS`, `MECHANICAL_DEFAULTS`, `TOWER_DEFAULTS`).

### 9.7 Goldens

Nenhuma muda: as opções novas de `buildFrame` são desligadas por padrão e `outflow` só vale quando declarado; nada de `game-floorplan-three` foi tocado.

### 9.8 Limites

- A laje continua uma peça por andar (sem abertura no núcleo, sem painéis): igual ao §5.
- A parede do núcleo não dobra para fora do plano nem trabalha como viga-parede contra o vento (lacuna 5); o núcleo segura carga vertical e explosão.
- Elevador sem cabo nem contrapeso como peças: o peso pendurado está na máquina; a cabine é uma peça parada no fundo do poço.
- A água da manta não corre até o ralo (estado só: nível e vazamento); a chuva entra pelo `setLiters`.
- Vidro da fachada como uma lâmina de 12 mm, sem a câmara de ar nem a intercamada como camada; caixilho só como massa.

## 10. Vento e balanço (lacuna 5, passo 4 da ordem; 2026-10-25)

### 10.1 O que muda para quem joga

- Com vento ligado (`wind` nas opções do mundo), um prédio alto leva uma força lateral que **cresce com a altura**: o vento é mais forte no alto e o prédio
  mostra mais área ao vento. O topo **balança** (`ObjectState.wind.sway`, evento `sway`), e o balanço cresce com a rajada.
- O **núcleo** de concreto é o que segura o vento: o mesmo prédio com o núcleo fica dentro do limite de deriva (H/500) e sem o núcleo passa dele; o
  pórtico sozinho é flexível. A coluna do lado de sotavento recebe carga a mais, a do lado de barlavento perde carga (e pode tracionar); se isso passa da
  capacidade, o `stress` e o colapso de sempre cuidam do resto. Perder o núcleo numa explosão muda o balanço na hora.
- O **amortecedor de massa sintonizado** (`addTunedMassDamper`, no andar técnico) pesa na laje como qualquer máquina e **reduz o balanço de pico** na
  frequência do prédio.
- Uma casa baixa mal sente: a força é de poucos kN e a deriva de décimos de milímetro.
- Desligado por padrão (§10.5). Sem `wind` nada muda.

### 10.2 Modelo

1. **Pressão** `q = ½ ρ Vk²` com `ρ = 1,226 kg/m³` (ar a 15 °C, nível do mar), isto é `q = 0,613 Vk²` N/m² (NBR 6123 4.2.b). A velocidade característica é
   `Vk = V0 · S1 · S2 · S3` (NBR 6123 4.1): `V0` a velocidade básica (rajada de 3 s, 10 m, terreno plano, 50 anos), `S1` topografia, `S3` estatístico.
2. **Perfil com a altura** `S2 = b · Fr · (z/10)^p` (NBR 6123 5.3, tabela 1), por categoria de rugosidade do terreno (I mar a V centro de cidade com prédios
   altos) e por classe da edificação pela maior dimensão (A até 20 m, B de 20 a 50 m, C acima de 50 m, escolhida sozinha: `class: 'auto'`). `z` é a altura
   acima do topo da fundação, no mínimo 5 m (e no máximo a altura gradiente `zg` da categoria). `Fr` é o fator de rajada da categoria II (1,00; 0,98; 0,95).
3. **Força por faixa**: o prédio é fatiado em faixas de `bandHeight` (3 m); a força numa faixa é `F = q(z) · Ca · L · Δ`, com `L` a largura que as peças
   mostram ao vento (perpendicular a ele, medida nas peças vivas e apoiadas, incluindo a pele de vidro) e `Ca` o coeficiente de arrasto (1,3: barlavento
   0,8 + sotavento 0,5, prisma de planta quase quadrada, ASCE 7 / EN 1991-1-4 tab. 7.1). A força, o cortante `V(z)` e o momento `M(z)` somam de cima para baixo.
4. **Sistema lateral** (peças com módulo de elasticidade, `strength.elasticGPa`):
   - **Paredes** (`role: 'wall'`: o núcleo, e também as paredes de alvenaria de uma casa) trabalham juntas como um cantiléver de **seção composta**, planos
     permanecem planos: `EI(z) = Σ Ei (Ii + Ai di²)` em torno do centroide ponderado por `Ei Ai`, com `Ii = a³ b / 12` de cada retângulo.
   - **Pórtico** (pilares e vigas): trabalha por **cisalhamento de andar** (racking), rigidez de andar de Muto `K = a · Σ 12 Ec Ic / h³` com
     `a = k / (2 + k)` e `k = 2 Σ(Eb Ib / L) / Σ(Ec Ic / h)` (vigas paralelas ao vento; Muto 1974; Naeim). Rigidez de cisalhamento contínua `GA = K · h`.
     Os pilares **não** entram na seção composta (sem ação de corda), a menos que `chord: true`: um pórtico de vigas rasas não funciona como tubo.
   - **Interação parede–pórtico** (Heidebrecht & Stafford Smith 1973): com `ψ = w'` a rotação, `-(EI ψ')' + GA ψ = V(z)`, `ψ(0) = 0` e momento zero no
     topo. Sai por elementos finitos de 1ª ordem (matriz tridiagonal, um elemento por faixa) e dá `w(z)` por integração. Sem paredes é só cisalhamento
     (`w' = V/GA`), sem pórtico é o cantiléver puro; o caso uniforme sem pórtico dá o `δ = w H⁴ / (8 EI)` (teste a mão).
   - Rigidez de serviço: `EI` e `GA` vezes `stiffnessFactor` 0,8 (seção fissurada, `(EI)sec = 0,8 Eci Ic` da NBR 6118 15.7.3 para pilares).
5. **Deriva**: `δ/H` do topo contra `driftLimit = 1/500`. Justificativa: a NBR 6118 13.3 (tab. 13.3) dá `H/1700` para o deslocamento lateral do edifício
   com a **combinação frequente** do vento, que tem `ψ1 = 0,3` (tab. 11.2); com o vento de projeto inteiro isso é `H/(1700 · 0,3) ≈ H/510`, que é o `H/500` da
   prática (decisão do dono). O limite entre andares fica fora (§10.7).
6. **Esforços nas peças**: o momento da parede, `Mw = EI ψ'`, vira esforço normal em cada peça da seção `ΔN = Mw Ei Ai di / EI` (compressão do lado de
   sotavento, tração do de barlavento); o resto, `Mf = M − Mw`, o pórtico leva como binário nos pilares (`ΔN` proporcional a `A d`). A carga de vento entra no
   `stress` do solver de sempre: `(carga · segurança + γ ΔN / g) / capacidade` com `γ = 1,4` (NBR 8681 tab. 3, ação variável). Se a carga permanente menos o
   vento fica negativa a peça **traciona**: a capacidade é a do aço vertical (`reinforcement`: `As fy`), senão `fct A` do concreto, senão zero.
   `PartState.wind` guarda o `ΔN` em newtons. A força cortante nas paredes (cisalhamento no plano) fica fora (§10.7).
7. **Estabilidade global**: `overturn = γ M(0) / (W · e)`, `W` o peso (peças vivas, apoiadas) e `e` a distância do centro de massa à borda de sotavento
   da fundação. Acima de 1 o prédio tomba sobre a própria fundação. Com `soil`, o momento entra no equilíbrio do corpo rígido sobre as molas como
   deslocamento do centro de massa `M/W` (já existe a rotação, o P-delta e o tombamento do §8): o vento em prédio sobre argila mole inclina e derruba.
8. **Modo fundamental** (Rayleigh): a deformada sob uma carga igual à massa de cada faixa, `u`, dá `ω² = Σ m u / Σ m u²`; o modo é `φ = u / u_topo`, a massa
   modal `M* = Σ m φ²` e a rigidez modal `K* = ω² M*`. (Prédio de concreto de 40 andares dá `T1` de 3 a 5 s; a regra `T1 ≈ 0,05 + 0,015 H` da NBR 6123 dá 2 s a
   130 m e serve só de ordem de grandeza.)
9. **Rajada no tempo**: a velocidade é `V(z,t) = V̄(z) (1 + I n(t))`, `V̄ = meanRatio · V0 S1 S3 b (z/10)^p` (a média de 10 min, a razão 0,69 do fator de
   rajada da NBR 6123 cap. 9), `I = 1/ln(zs/z0)` com `zs = 0,6 H` (EN 1991-1-4 4.4, `z0` por categoria) e `n(t)` uma soma de 400 senos de fase sorteada
   (semente fixa) com a amplitude do espectro de Davenport `f S(f)/u*² = 4 x²/(1 + x²)^(4/3)`, `x = 1200 f / V̄10`, normalizada para variância 1. A
   força modal é `F*(t) = Σ φi Fi,médio (1 + I n)²`, e `M* ẍ + C* ẋ + K* x = F*(t)` com `C* = 2 ζ ω M*` (`ζ = 0,016`: decremento logarítmico 0,10 do
   concreto armado, EN 1991-1-4 tab. F.2). `sway` é o `x` do topo e `peak` o máximo que decai com `peakDecay` (60 s).
10. **Amortecedor de massa sintonizado** (`PartSpec.damper`): massa `md` (a da peça) com razão `μ = md φd² / M*` (0,5 a 2% do modal, 1% por padrão
    em `addTunedMassDamper`), mola `kd` e amortecedor `cd`. Sintonia de Den Hartog (1956), `f_d / f_1 = 1/(1 + μ)` e `ζ_d = √(3 μ / (8 (1 + μ)³))` (para
    `μ = 1%`: 0,990 e 0,0603); `tuning: 'warburton'` usa a de carga aleatória (Warburton 1982, `√(1 − μ/2)/(1 + μ)`). Frequência e amortecimento da peça
    mandam se ela os der (amortecedor desafinado). A estrutura e o amortecedor são integrados juntos (RK4, subpassos menores que 1/20 do período).
    A conferência é o domínio da frequência: para força harmônica na ressonância a amplificação do ótimo é `√(1 + 2/μ)` (14,2 para 1%) contra `1/(2ζ)` (31) da
    estrutura sem ele; o teste compara o tempo integrado com a resposta em frequência calculada à parte (número complexo, mesma estrutura de 2 graus de liberdade).

### 10.3 Superfície de configuração

- Contrato (`game-contracts`): `PartSpec.damper` (`TunedMassDamper`: `frequency`, `damping`), `DestructibleSpec.wind` (`WindExposure`: o que é do lugar e da
  forma do prédio: `terrain`, `class`, `topography`, `statistical`, `drag`, `damping`; `false` tira o objeto do vento), `PartState.wind`, `ObjectState.wind`
  (`WindState`: `speed`, `pressure`, `shear`, `moment`, `deflection`, `drift`, `limit`, `overturn`, `frequency`, `lean`, `sway`, `peak`, `damper`, `status`), evento `sway`.
- Mundo: `DestructionOptions.wind` (`WindOptions`): `speed` 40, `direction` `[1, 0, 0]`, e os do `WindExposure` como padrão do mundo; `airDensity`, `minHeight`,
  `bandHeight`, `stiffnessFactor`, `beamFactor`, `flange`, `driftLimit`, `loadFactor`, `chord`, `meanRatio`, `roughness`, `gust` (`components`, `maxHz`, `scale`, `seed`), `peakDecay`,
  `tuning`, `terrains` (registro de categorias, para trocar ou acrescentar). `world.setWind({ speed, direction })` muda em jogo.
- Funções puras (`wind.ts`): `windPressure`, `heightFactor`, `windClass`, `WIND_TERRAIN`, `WIND_DEFAULTS`, `solveWallFrame`, `damperTuning`, `damperResponse`.
- `game-floorplan-structure`: `addTunedMassDamper(spec, g, options)` (massa por `ratio` do modal estimado ou `mass`; frequência e amortecimento opcionais),
  `buildTower({ damper, wind })`, `DAMPER_DEFAULTS`.

### 10.4 Valores e fontes

| Valor | Padrão | Fonte |
|---|---|---|
| `V0` | 40 m/s | isopletas da NBR 6123 (30 a 50 m/s; 40 em São Paulo); o jogo escolhe |
| `ρ` | 1,226 kg/m³ | ar a 15 °C, 101,3 kPa; `q = 0,613 V²` da NBR 6123 4.2 |
| categoria / classe | III / automática | NBR 6123 tab. 1 (III: subúrbios; classe pela maior dimensão) |
| `b`, `p` | tabela 1 (II: 1,00 e 0,085/0,09/0,10 para A/B/C; III: 0,94/0,94/0,93 e 0,10/0,105/0,115; IV: 0,86/0,85/0,84 e 0,12/0,125/0,135) | NBR 6123:1988 tab. 1 |
| `Fr` | 1,00 / 0,98 / 0,95 (A/B/C) | NBR 6123 tab. 1 |
| `S1`, `S3` | 1, 1 | terreno plano; grupo 2 (edificações residenciais e comerciais), NBR 6123 tab. 3 |
| `Ca` | 1,3 | 0,8 + 0,5 (ASCE 7, EN 1991-1-4 tab. 7.1 para h/d ~ 1); a NBR 6123 fig. 4 dá 1,1 a 1,5 |
| faixa | 3 m | um andar |
| `stiffnessFactor` / `beamFactor` | 0,8 / 0,4 | NBR 6118 15.7.3 (pilares e paredes / vigas) |
| `flange` | 0,1 do vão de cada lado | mesa da laje na viga em T, NBR 6118 14.6.2.2 |
| `driftLimit` | 1/500 | §10.2 item 5 |
| `loadFactor` | 1,4 | NBR 8681 tab. 3 (vento, ação variável) |
| `ζ` estrutural | 0,016 | EN 1991-1-4 tab. F.2 (concreto armado, δs = 0,10) |
| `meanRatio` | 0,69 | NBR 6123 cap. 9 (média de 10 min sobre a rajada de 3 s) |
| rugosidade `z0` I a V | 0,005; 0,05; 0,3; 1,0; 2,5 m | EN 1991-1-4 tab. 4.1 (0, II, III, IV) e Davenport-Wieringa (centro de cidade) |
| `μ` do amortecedor | 1% (0,5 a 2%) | prática (Taipei 101 e torres de Nova York: 0,3 a 1% do modal); Den Hartog 1956 para a sintonia |

### 10.5 Padrão desligado

`wind` ausente: nenhuma força, nenhum consumo do gerador de números, nenhum evento. É o mesmo critério do `flexure.scope` (§2.4: o padrão deixa o que
foi feito antes como estava) e do `soil` (só quem declara o solo o tem): as casas do `game-floorplan` e os prédios das entregas dos times foram
dimensionados sem vento e, ligado, pilares e paredes deles ganhariam carga que o projeto nunca previu (um prédio de 20 andares de `buildFrame` sem
núcleo chega a 0,96 no pilar sob 40 m/s, sem margem alguma). O vento é do mundo (clima), então liga-se uma vez no mundo; `DestructibleSpec.wind` só ajusta o lugar de cada prédio.
`buildTower` não liga nada sozinho: o amortecedor e o `wind` do prédio são `false`/ausentes por padrão, e a torre padrão continua igual.

### 10.6 Conferências

Torre de 40 andares (16 x 24 m, `columnSize` 1,0, laje 0,25 m, núcleo com 6 elevadores e paredes de 0,6 m), `V0 = 40 m/s`, categoria IV:

| Caso | Flecha no topo | Deriva | Frequência | Tombamento |
|---|---|---|---|---|
| com núcleo | 0,221 m | 1/589 (dentro de H/500) | 0,187 Hz (T = 5,3 s) | 0,24 |
| sem núcleo (`core: false`, dimensionada ao vento) | 0,772 m | 1/169 (passa) | 0,112 Hz | 0,317 |

Com núcleo: pressão no topo 1247 Pa, cortante na base 4,24 MN, momento 308 MN·m, inclinação do centro de massa (`lean`) 0,117 m. Amortecedor de
`μ = 0,85%`: o desvio-padrão do balanço cai para cerca de 0,73 do sem ele (torres reais: 30 a 40% de redução de pico); o tempo integrado concorda com a
resposta em frequência calculada à parte. Casa de 2 andares: flecha 0,02 mm, deriva 2,9e-6, tombamento 0,055 (praticamente imune). Pórtico de 20 andares
de `buildFrame` (dimensionado só ao peso): tensão máxima 0,96 sob 40 m/s. Fórmulas conferidas à mão nos testes (`q = 0,613 V²`, `S2`, faixas, Den Hartog,
parede em balanço e parede com pórtico em forma fechada).

**Goldens:** nenhum muda; o vento é desligado por padrão (§10.5), sem força, sem consumo do gerador e sem evento.

### 10.6a Detalhes do modelo que o código fixou

Viga em T com mesa da laje (`flange`), pilares do térreo engastados com penalidade na base ponderada pela parcela da parede, faixas acima do sistema
lateral rígidas (fator 1e3, movem-se com o topo), `sizeStructure({ wind })` soma o axial majorado do vento à capacidade e engrossa a barra da peça
tracionada (até 40 mm), `lean` desloca o centro de massa na fundação (`M/W`), de modo que o vento inclina prédios em solo mole.

### 10.7 Limites e perguntas

- Sem cortante no plano das paredes, sem torção (o vento age no centro de rigidez), sem P-delta de segunda ordem e sem deriva entre andares.
- Sem vibração transversal ao vento (desprendimento de vórtices) nem efeito de vizinhança; a rajada é totalmente correlacionada na altura (conservador).
- A lâmina de vidro e a laje não entram na rigidez lateral (conservador); a laje faz o papel de diafragma rígido por suposição.
- Idealização contínua: a deriva por andar tem erro da ordem de meia força de andar; vários amortecedores no mesmo prédio agem como um só (somados).
- O batente do amortecedor (curso máximo) não existe; o curso relativo é só informado (`damper.travel`).
- Perguntas ao dono: (1) `H/500` com o vento inteiro (equivale ao `H/1700` da NBR 6118 com `ψ1 = 0,3`) está certo, ou o jogo prefere outro limite? (2) A tabela 1 da
  NBR 6123 foi transcrita da memória da norma; precisa de conferência com o texto. (3) O padrão ligado de `V0 = 40` e categoria III serve ao jogo?
