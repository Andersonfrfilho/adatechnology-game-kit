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
| 4 | Núcleo rígido (tubo de concreto com elevadores e escada) | peças/presets em `game-floorplan-structure` | depois |
| 5 | Vento e balanço (carga lateral que cresce com a altura, amortecedor de massa) | motor | depois |
| 6 | Pele de vidro (fachada leve que estilhaça em painéis grandes) | peças em `game-floorplan-structure` | depois |
| 7 | Cobertura de prédio (manta, caimento, ralos, vazamento) | peças em `game-floorplan-structure` | depois |
| 8 | Andar técnico (máquinas, caixa d'água, amortecedor: tudo pesa) | peças em `game-floorplan-structure` | depois |
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
