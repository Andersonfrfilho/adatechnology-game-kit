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
| 5 | Vento e balanço (carga lateral que cresce com a altura, amortecedor de massa) | motor | depois |
| 6 | Pele de vidro (fachada leve que estilhaça em painéis grandes) | peças em `game-floorplan-structure` | **feito** (§9) |
| 7 | Cobertura de prédio (manta, caimento, ralos, vazamento) | peças em `game-floorplan-structure` | **feito** (§9) |
| 8 | Andar técnico (máquinas, caixa d'água, amortecedor: tudo pesa) | peças em `game-floorplan-structure` | **feito** (§9; o amortecedor fica com o vento) |
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

## 10. Lajes em painéis com vigas reais nas casas (§5 resolvido; 2026-10-25)

Dono (2026-10-25): aprovou (a) dividir as lajes das casas em painéis com vigas reais a cada 4 a 5 m (um painel por cômodo, vigas nos limites dos
cômodos e das paredes portantes, pilares onde uma casa em pórtico precisa) e (b) que os hashes `coarseParts`/`enclosureParts` da golden `vc3-structure`
possam mudar. O objetivo: ligar o vergalhão por padrão em toda casa e prédio de concreto do kit, e que a explosão e a perda de um pilar façam o que
fariam de verdade (a laje racha na face tracionada; o colapso progressivo só onde ele existe).

### 10.1 O que muda para quem joga

- Uma casa em repouso fica de pé com folga (laje, viga e pilar a no máximo `safetyOthers`/`safety`), com o aço dimensionado em cada peça.
- Perder um pilar interno de um sobrado em pórtico **racha** as lajes e vigas vizinhas (aviso `stress`, `crack`) mas não derruba tudo: a viga que
  perdeu o apoio vence o dobro do vão e o painel ao lado passa a se apoiar nas outras três bordas. Perder dois pilares vizinhos derruba o painel
  entre eles, e o andar de cima desce junto (colapso progressivo real, só onde as vigas não têm outro caminho).
- Uma explosão sobre a laje racha a face de baixo do **painel** atingido (o resto da laje fica), em vez de a laje inteira de 8 x 12 m dobrar.
- Os desenhos (`game-floorplan-three`) continuam os mesmos: as vigas ficam dentro das paredes e do forro, como numa obra; o piso de cada cômodo
  cai com o painel dele.

### 10.2 Regras de layout (`game-floorplan-structure/src/slab-panels`)

Só lajes de concreto de uma construção com vergalhão (`construction.frame.rebar`): `slab_N` (andares), `slab_top*` (cobertura plana), `slab_ceiling` (sob a
caixa d'água) e `slab_base` (piso de uma unidade num prédio). Lajes de madeira (vigas e tábuas), varandas em balanço, o piso da varanda coberta, a laje da
caixa d'água e o radier não mudam. O layout é uma etapa de `toDestructibleSpec` (como o corte das paredes em painéis, `wallDetail`): `buildStructure`
continua devolvendo as peças e os apoios da equipe, e as golden `pieces`/`supports` não mudam.

1. **Pegada**: cada laje leva a lista de retângulos que ela cobre (`StructurePart.footprint`: os cômodos do andar de cima, sem varanda nem vazio). Um
   painel com menos de metade da área dentro da pegada é descartado (o canto vazio de uma casa em L não ganha laje).
2. **Linhas de corte**: as paredes do andar de cima (que descem sobre a laje) e do de baixo (que a seguram) agrupadas em linhas (tolerância 0,2 m); a
   cobertura de uma linha é o comprimento coberto por paredes dentro do retângulo, com vãos de porta de até 1,3 m contados como parede.
3. **Corte recursivo** de um retângulo `R` (começa na laje): (a) se um lado passa de `maxSpan` (5 m), corta no eixo desse lado, na linha com cobertura
   mínima (0,6) que deixa os dois pedaços mais equilibrados, ou no meio se não há parede; (b) se os dois lados cabem, mas há uma linha de parede que
   cruza `R` quase toda (cobertura >= 0,6), corta nela (um painel por cômodo); (c) nunca deixa um pedaço com menos de `minPanel` (1,5 m).
4. **Painel**: cada folha do corte é uma laje com id `slab_N_p<k>` (a laje que não é cortada guarda o id e a caixa). Espessura `h = L/40` (L = o menor
   lado, que é o vão da laje armada em uma direção), no mínimo 10 cm nos pisos e 8 cm na cobertura (NBR 6118 13.2.4.1 pede 8 e 7 cm; os mínimos do
   dono são mais folgados), arredondada para cima em 1 cm. O painel de borda de uma cobertura mantém o beiral.
5. **Viga** em cada segmento de corte que confina um painel mantido: `slab_N_b<k>`, de concreto da construção, com o topo na face de baixo da laje.
   Altura `h = vão/12` (NBR 6118: vigas biapoiadas L/10, contínuas L/12; o vão é o maior trecho sem apoio da viga), no mínimo 25 cm, múltiplo de 5 cm;
   largura `max(parede, h/3)` (a viga fica dentro da parede de 15 cm quando h <= 45 cm: NBR 6118 13.2.2, mínimo 12 cm). O painel apoia nas vigas e nas
   peças que já o seguravam (cintas, pilares, paredes portantes) e a viga apoia em quem estiver debaixo dela e nas vigas em que ela termina.
6. **Pilares onde precisam**: o vão de uma viga (ou de uma cinta) é a maior distância sem apoio, medida como o motor mede (`spanOf`: duas vezes a maior
   distância de um ponto ao apoio mais próximo). Se passa de `maxSpan`, entra um pilar de 20 cm (NBR 6118 13.2.3: mínimo 19 cm) no meio do trecho
   mais longo, e se repete até caber. Num pórtico (`portico`, as paredes só fecham) não há parede portante, então os pilares aparecem em volta e por dentro
   a cada 5 m; numa casa de alvenaria portante a parede de baixo é o apoio contínuo e quase nenhum pilar entra. O pilar nasce no chão (ou na laje do andar
   de baixo, andar a andar) e a viga e a cinta de cima descansam nele.
7. **Cintas** (`plate_*` de concreto): ganham os mesmos pilares quando o vão passa de `maxSpan` (só acontece em pórtico, onde a parede de baixo não carrega).

### 10.3 Valores padrão e fontes

| Valor | Padrão | Fonte |
|---|---|---|
| Vão máximo do painel e da viga (`maxSpan`) | 5 m | prática de lajes maciças armadas em uma direção: 4 a 5 m (Bastos, *Lajes de concreto*, UNESP); pedido do dono |
| Painel mínimo (`minPanel`) | 1,5 m | prática (laje com largura menor que isso vira balanço da viga vizinha) |
| Espessura da laje | L/40, mín. 10 cm (piso), 8 cm (cobertura) | NBR 6118 14.7.2.1 (d ~ L/35 a L/40 em laje armada em uma direção); mínimos do dono |
| Altura da viga | vão/12, mín. 25 cm, em múltiplos de 5 cm | NBR 6118 e Bastos, *Vigas de concreto armado*: L/10 a L/12 |
| Largura da viga | max(parede, altura/3) | NBR 6118 13.2.2 (mín. 12 cm) |
| Lado do pilar acrescentado | 20 cm | NBR 6118 13.2.3 (mín. 19 cm) |
| Cobertura mínima de uma linha de corte | 0,6 | escolha de projeto (uma parede que cobre 60% do comprimento é um limite de cômodo) |
| Vão de porta contado como parede | 1,3 m | porta de 0,8 a 1,2 m com a ombreira |

Tudo em `SLAB_PANEL_DEFAULTS`, trocável por `toDestructibleSpec({ slabPanels: { maxSpan: 4 } })` (ou `slabPanels: false` para a laje inteira como a equipe
a descreve). O vergalhão é dimensionado por `sizeRebar` como já era (§2.3), agora peça por peça: painéis, vigas, cintas.

### 10.4 O que muda ao ligar o vergalhão por padrão

`toDestructibleSpec` passa a declarar o aço (`rebar: true`) e a dimensioná-lo (`sizeRebar`) em toda construção com `frame.rebar` (concreto armado); casas
de madeira e barracas não têm concreto com tração e não mudam. A spec das casas de alvenaria ganha `structure.rebar` nas lajes, vigas e cintas, mais
as peças novas (painéis, vigas, pilares). `rebar: false` e `slabPanels: false` devolvem a spec antiga (é o que a comparação com o Visor de casas 3D
usa; ver §6).
