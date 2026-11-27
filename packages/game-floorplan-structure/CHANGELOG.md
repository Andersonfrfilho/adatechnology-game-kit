# @adatechnology/game-floorplan-structure

## 4.0.6

### Patch Changes

- Updated dependencies [4afbea0]
  - @adatechnology/game-contracts@0.43.0
  - @adatechnology/game-destruction@0.30.1

## 4.0.5

### Patch Changes

- Updated dependencies [9412886]
- Updated dependencies [919616f]
  - @adatechnology/game-contracts@0.42.0
  - @adatechnology/game-destruction@0.30.0

## 4.0.4

### Patch Changes

- Updated dependencies [d7fa717]
  - @adatechnology/game-destruction@0.29.5
  - @adatechnology/game-contracts@0.41.0

## 4.0.3

### Patch Changes

- Updated dependencies [b3670e1]
  - @adatechnology/game-contracts@0.40.0
  - @adatechnology/game-destruction@0.29.4

## 4.0.2

### Patch Changes

- Updated dependencies [2e803a4]
  - @adatechnology/game-contracts@0.39.0
  - @adatechnology/game-destruction@0.29.3

## 4.0.1

### Patch Changes

- Updated dependencies [5682afd]
  - @adatechnology/game-contracts@0.38.0
  - @adatechnology/game-destruction@0.29.2

## 4.0.0

### Minor Changes

- 32547af: Móveis sem z-fighting e layout com o espaço real de cada coisa: sofá, geladeira e cuba (e mais 14 móveis do household) sem faces no mesmo plano; portas e gavetas com a faixa de abertura livre (`opening`); criado-mudo ao lado da cabeceira (`beside`), também na edícula; quadro de luz, tomadas e interruptores com a caixa real na parede; cano de gás por cima das portas; gabinete ao lado da pia na altura do tampo; vaso de planta com a copa até onde a parede deixa; cabo só em tomada do mesmo lado da parede.

  Plafon apagado em vidro branco leitoso, aceso emissivo. Conteúdo de gavetas, portas e prateleiras desenhado com o item real do catálogo (`createContainedItemModel`, `createContentsView`, `interactives.itemModel`), filho da parte que o leva desde o primeiro quadro, e cada item pegável com uma mão (`take` com `hands: 1`).

  Os goldens do Visor de casas 3D e do adaptador da equipe seguem iguais com `visorLayout` (planta) e `visor` (adaptador).

### Patch Changes

- Updated dependencies [32547af]
  - @adatechnology/game-floorplan@0.5.0

## 3.1.1

### Patch Changes

- Updated dependencies [81e70aa]
  - @adatechnology/game-contracts@0.37.0
  - @adatechnology/game-destruction@0.29.1

## 3.1.0

### Minor Changes

- 30a8199: Desenho das redes do bairro (spec 011, T2.8d). `game-urban/networks`: `distributionHardwareOf` (cruzeta e isoladores na faixa MT, trafo com buchas, grampo da BT, uma braçadeira por cabo de telecom, braço e luminária, olhal do estai, tudo lido das `slots`), `networkLampsOf` (o estado da lâmpada do #470 por nó `light`) e o `DistributionSpec` com `crossarm`, `insulators`, `bushings`, `lowVoltage`, `telecom` e `guy`. `game-urban-three`: `createUrbanThree(...).drawNetworks(networks, { isNight, lamps, surfaceAt, poles })` com mastros e ferragem instanciados, vãos fundidos por classe com catenária (`spans`: faixa de índices por vão), estai nos postes de esquina e fim de linha ancorado na calçada, LOD de longe em `LineSegments` (`setFocus`), luzes pelo `LightBudget` do host; cerca de 10 chamadas perto. `game-floorplan-three`: em `street: 'network'` a casa não desenha mais o ramal aéreo (é da rede). O poste `concrete_distribution` desenhado sozinho pelo registro continua o braço simples (golden da área de teste sem diff).

  Rua de verdade (revisão do dono): a MT corre por todo poste de rua do alimentador (cruzeta e 3 fases em todos), não só até o trafo. O ramal sai do poste em frente ao lote ou atravessa a rua em linha reta (no máximo `power.dropMaxSkew` = 30° da normal), nunca passa sobre outro lote, e cada poste leva no máximo `power.dropsPerPole` = 4 ramais; sem poste que sirva, o gerador acrescenta um na estação do lote. O `validateNetworks` ganha `frontages` (de `GeneratedNetworks.frontages`) e os códigos `drop_skewed`, `drop_off_frontage`, `drop_over_other_lot` e `pole_too_many_drops`; aviso novo `drop_off_practice`. O padrão de entrada em `street: 'network'` é um poste fino de concreto de 6 m (`NETWORK_POST`) com o ramal ancorado na face da rua, a caixa do medidor no pé (`meter.place: 'post'`) e o eletroduto descendo pela face: nenhum fio do topo do poste até outro ponto (o objeto `service_entrance` ganha a variante `network`).

- 30a8199: Lado da casa das redes do bairro (spec 011, T2.8c): `engine.generate(id, { street: 'network' })` marca a entrada `serviceEntrance.street: 'network'` (ausente = `'own'`, todas as outras plantas iguais, goldens sem diff), põe o poste do padrão de 6 m no lote com o ramal ancorado a 5,7 m (sem quintal, o eletroduto sobe a fachada como pontalete até a mesma altura) e declara em `utilities.connections` os cinco pontos de ligação (energia com `installedKva`, telecom 0,6 m abaixo, saída da caixa de inspeção com `invert`, buzinote na divisa da frente, cavalete do hidrômetro). `connectionsInWorld` passa esses pontos para o mundo como `UtilityConnection`. No `-three`, uma casa em `'network'` nunca desenha os postes vizinhos nem a rede entre eles; com interativos o padrão é um objeto só (`service_entrance`). **Em `'network'`, `ElectricalInfo.pole` é o poste do padrão, não o da concessionária.**

## 3.0.1

### Patch Changes

- 33b7423: Instalações da casa como numa obra brasileira: nenhum cano no ar, nenhum cruzando porta ou janela.

  - Linha de gás em cobre (NBR 15526) embutida num rasgo da parede; onde há porta no caminho, desce ao contrapiso e passa sob a soleira. A mangueira do fogão (amarela, NBR 8613) entra com o fogão.
  - Esgoto (NBR 8160): pia, tanque e máquina saem do ponto na parede atrás da peça e descem nela; vaso e ralo descem direto pelo piso; no andar de cima, cruzam dentro da laje até a prumada; no térreo, terminam no contrapiso sobre o ramal enterrado.
  - Água fria (NBR 5626) e eletrodutos (NBR 5410) de sobrado descem pela parede de cada andar, trocando de prumada dentro da laje, sem atravessar cômodo de cima nem janela alta de pé-direito duplo; luz do térreo é alimentada pela laje sobre ela.
  - Água sob a pia entra com a pia; condutores pluviais entram com as calhas (nível 8); calçada de proteção e barrado cerâmico externo são o fim da obra (nível 8).
  - Fundação: baldrame impermeabilizado (betume) e cama de terra compactada só sob a casa, sem a faixa marrom em volta.

## 3.0.0

### Minor Changes

- 78ac539: Os fios do poste do lote soltam-se em trechos que não vão com o poste. Antes, cada trecho da fiação pendia do poste por uma junta que sempre une; ao cair, o poste levava os fios que a explosão não tinha soltado e virava um corpo de 1000 kg com 26 caixas e 23 m de largura, e a varredura contínua (CCD) do Jolt custava 60 a 70 ms por passo. Agora o poste leva só o fuste, a travessa e os isoladores (950 kg, 10 caixas) e cada trecho de fio cai como peça sua, com o próprio cobre.

  `game-contracts`, `game-destruction`: `JointSpec.tears` (padrão falso). A parte `a` pende de `b` só enquanto `b` está de pé (em um grupo ancorado); com `b` solto a junta larga, e o fio de um poste que cai desce sozinho. Uma junta que não rasga continua unindo as duas partes em um grupo. Quem se segura em duas pontas, uma delas de pé (o fio do ramal preso à parede da casa), fica pendurado nela.

  `game-destruction-three`: as peças que um `tears` separou (o fio e o poste de que pendia) não se tocam mais: sem isso o poste de 950 kg, ao tombar, batia nos fios de 12 kg que ele acabava de largar e os lançava (C1 de 34 e 105 kg·m, C2 acima do limite em 4 de 10 rodadas). `JointState.tears` (contrato), `PieceSystem.tether`, e o renderizador marca os pares ao soltar os grupos.

  `game-floorplan-structure`: `Support.tears` chega à junta da especificação destrutível.

  `game-floorplan-three`: os trechos da grade e do ramal pendem do poste mais próximo por uma junta que rasga (`tears`); o trecho que fica dentro de laje ou parede, ou ao lado de um, continua preso a ela. Com `segmentLimits.wiring: Infinity` a fiação segue como o time desenhou (uma peça só). Goldens regravados: `destruction/breach`, `destruction/spall`, `destruction/fracture` e o resultado do blast (21 objetos a mais, os trechos).

- 65b522a: O que é preso no mundo real é preso no mundo da destruição: a casa carrega como um grupo só, e nada cai ou escorrega na carga. Novo tipo de junta `slide` (corrediça de gaveta, 100 de resistência, sai com a mão ou com chave de fenda, 3 s) em `JointKind` e `JOINT_DEFAULTS`; as gavetas dos móveis do `game-interactables-household` passam de `clip` para `slide`. Na casa (`game-floorplan-three`), cada peça declara onde se prende (`holder`, ou `holdOn: 'floor' | 'wall'` com `holdJoint`): muro do lote e poste fincados no chão com a junta que `JOINT_BY_MATERIALS` dá contra concreto (tijolo e concreto: argamassa), soleira assentada no baldrame, portão e porta da caixa de correio na dobradiça do muro ao lado (`slide` no portão de correr), porta do box na parede do banheiro, portas e gavetas dos móveis no piso onde o móvel está (`hinge`/`slide`), eletroduto aparente grampeado na parede, botijão apoiado no piso (`resting`), cano fora da parede preso na laje em que entra; com o poste preso, a fiação pendura nele. Só cai quando essa junta quebra. Limitação conhecida: as portas e gavetas dos móveis da casa ficam presas ao piso sob o móvel (a laje do andar, ou o chão no térreo) até o corpo do móvel virar uma parte do mundo da destruição; hoje elas só caem quando a dobradiça/corrediça quebra ou o piso vai. Peça que diz onde se prende e não acha nada (`holdOn` sem piso, parede ou chão sob ela) vai para `house.structure.unheld`, e o teste de carga exige essa lista vazia em todo o catálogo. Peças interativas abertas são medidas fechadas. O que se finca no chão segura como a base enterrada: `embedmentStrength` (game-destruction) dá a resistência da junta pela base enterrada no solo (`soils.json`, pressão básica × segurança, camada a camada) sobre a base de referência de `EMBEDMENT_DEFAULTS`; `postEmbedment` é a regra do poste (10% da altura + 0,6 m). `Support.strength` (game-floorplan-structure) leva a resistência até a junta. Na casa, o poste declara a base pela regra, o muro do lote o baldrame (`GROUND_BEAM_DEPTH`) ao longo do comprimento, e uma peça desenhada abaixo do terreno conta o que está enterrado; pé no terreno ou abaixo dele (o terreno lido no canto mais baixo da pegada) está ancorado, nunca solto.

### Patch Changes

- Updated dependencies [cd5113c]
- Updated dependencies [ff1a27b]
- Updated dependencies [f1c7229]
- Updated dependencies [e3a9ee8]
- Updated dependencies [78ac539]
- Updated dependencies [5e05bb2]
- Updated dependencies [f17aebb]
- Updated dependencies [6fb91f5]
- Updated dependencies [c8b5c71]
- Updated dependencies [b37d94f]
- Updated dependencies [6356f68]
- Updated dependencies [65b522a]
- Updated dependencies [1fede95]
- Updated dependencies [6473d97]
- Updated dependencies [631d9d0]
- Updated dependencies [c394683]
- Updated dependencies [8d26913]
  - @adatechnology/game-contracts@0.36.0
  - @adatechnology/game-destruction@0.29.0
  - @adatechnology/game-floorplan@0.4.0

## 2.3.1

### Patch Changes

- Updated dependencies [1849ae6]
- Updated dependencies [d5850bb]
- Updated dependencies [fec8942]
  - @adatechnology/game-destruction@0.28.0

## 2.3.0

### Minor Changes

- b0b031b: O tiro na janela acerta o que está desenhado. `PartSpec.apertures`: vãos de uma peça (o vão da janela numa parede, a área do vidro num caixilho, o vão de uma grade com as barras); o raio que entra num vão segue, a não ser que bata numa barra. No detalhe `coarse` (o das casas), cada parede leva os vãos das suas janelas (`withWindowApertures`): antes, o tiro na janela batia no tijolo invisível da parede ou na caixa maciça do caixilho. O caixilho tem massa real (perfis de alumínio e peitoril: 18 kg numa janela de 1,4 m, antes 182 kg) e é aberto onde está o vidro; a grade virou peça de aço própria (`window_grille:*`), com as barras. O raio que passa pelo buraco aberto numa parede usa o mesmo referencial do objeto em todos os lugares.

  A área de casas abre direto numa casa pelo endereço (`?area=floorplan_area&template=mansion&seed=1&state=abandoned`, `floorplanAreaParams`), e planta registrada que nenhum grupo lista entra no grupo "Outros" da bancada.

  O pó e as fibras de uma peça desenhada pela casa (sem malha própria no renderizador) saem na cor padrão, em vez de um erro "failed to apply debris".

- b0b031b: `slabsOffSupport(spec, state?, { ledgers })`: as lajes e telhados que só se apoiam e ficaram com o centro fora do que ainda os carrega (laje apoiada numa borda só). Sem `state`, confere a construção como foi feita; com o estado do mundo, confere depois de um colapso. Saiu do teste residencial para o SDK, e o teste de todas as plantas (`game-floorplan-three/tests/all-plans.test.ts`) usa em cada planta, estado, seed e opção.

### Patch Changes

- Updated dependencies [b0b031b]
  - @adatechnology/game-contracts@0.35.0
  - @adatechnology/game-destruction@0.27.0

## 2.2.4

### Patch Changes

- Updated dependencies [dd8f202]
- Updated dependencies [9dc3676]
  - @adatechnology/game-destruction@0.26.0

## 2.2.3

### Patch Changes

- Updated dependencies [f99694c]
- Updated dependencies [29abbc1]
  - @adatechnology/game-destruction@0.25.0

## 2.2.2

### Patch Changes

- Updated dependencies [5984ae4]
- Updated dependencies [779f9f4]
  - @adatechnology/game-destruction@0.24.0
  - @adatechnology/game-contracts@0.34.0

## 2.2.1

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0
  - @adatechnology/game-destruction@0.23.2

## 2.2.0

### Minor Changes

- 5f12ff1: O telhado se divide em trechos entre as tesouras. Cada água do telhado de duas águas vira um trecho por vão entre tesouras (`roof_a_0`, `roof_a_1`…; as pontas levam o beiral), e cada trecho se apoia só nas tesouras das suas bordas. Uma explosão quebra só os trechos ao seu alcance e o resto do telhado fica no lugar. O desenho segue a física: com a destruição ligada, as telhas de cada trecho são desenhadas como peça própria, então o trecho quebrado some sozinho. Opção nova `roofBays` (padrão: quando o detalhe não é `coarse`); o detalhe `coarse` do Visor continua com uma peça por água. O dimensionamento mantém caibros e trechos de telhado abaixo da redundância quando um pilar ou parede portante cai, como o `sizeStructure` do `game-destruction`.

## 2.1.8

### Patch Changes

- 8585829: Foguete encostado num pilar corta o pilar ali, não some com ele inteiro. Antes, uma carga a menos de 35 cm de um pilar zerava os pontos de vida dele: o concreto fraturava em toda a altura, o pilar virava só a gaiola e a gaiola caía. Agora o pilar (peça longa armada) sempre guarda seu piso de pontos de vida e perde o concreto só onde a explosão alcança: uns 50 cm para um foguete de 200 kJ. A ferragem aparece ali. O concreto moldado (pilar, viga, parede de concreto) não desaba bloco a bloco sobre o vão, como a alvenaria: é uma peça só, presa pelos ferros.

  Os pilares e as vigas ganham estribos (`memberStirrups`, a cada 15 cm, NBR 6118 18.4.3), que aparecem junto com as barras onde o concreto saiu e na gaiola de uma peça descascada. A bitola das barras de pilar e viga passa de 8 para 10 mm (`MEMBER_CAGE.diameter`, mínimo da NBR 6118 18.4.2.1).

- Updated dependencies [71c2c92]
- Updated dependencies [b7e0d7c]
- Updated dependencies [cb9cc2e]
- Updated dependencies [76e5d44]
- Updated dependencies [8585829]
- Updated dependencies [4e2d44b]
  - @adatechnology/game-destruction@0.23.0
  - @adatechnology/game-contracts@0.32.0

## 2.1.7

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [99183cb]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0
  - @adatechnology/game-destruction@0.22.0

## 2.1.6

### Patch Changes

- Updated dependencies [67edc92]
  - @adatechnology/game-destruction@0.21.0

## 2.1.5

### Patch Changes

- Updated dependencies [c4b8218]
- Updated dependencies [a6a6a8f]
- Updated dependencies [49272b6]
  - @adatechnology/game-contracts@0.30.0
  - @adatechnology/game-destruction@0.20.0

## 2.1.4

### Patch Changes

- Updated dependencies [a3b0fd7]
- Updated dependencies [b1f747f]
  - @adatechnology/game-destruction@0.19.0
  - @adatechnology/game-contracts@0.29.0

## 2.1.3

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-destruction@0.18.2

## 2.1.2

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-destruction@0.18.1

## 2.1.1

### Patch Changes

- Updated dependencies [dbc0ef3]
- Updated dependencies [c8b0e40]
  - @adatechnology/game-destruction@0.18.0
  - @adatechnology/game-contracts@0.26.0

## 2.1.0

### Minor Changes

- f362db3: Structural validation and confined masonry. `validateStructure(structure, { doors, wallDetail })` and `validateSpec(spec)` return what a structure gets wrong as a real building, as typed violations with stable codes (`STRUCTURAL_VIOLATION`: load paths, NBR 6118 sections and steel, beam depth L/10, long beams on masonry, ground beam, pillars at ends, corners, junctions and every 4 m up to the bond beam, bond beam, lintel and sill beam, bonded bricks, plaster on both faces). Masonry houses on strip footings stand on reinforced concrete ground beams (`ground_beam_*`, `GROUND_BEAM_DEPTH`, anchored foundation in the spec; `groundBeams: false` leaves them out), every window gets a sill beam (`_sillbeam_`, `SILL_BEAM_DEPTH`) and lintels and sill beams bear on the jamb pillars, lintels are at least L/10 deep, wide doors get jamb pillars (`jamb_column_*`), short piers keep their jamb pillar, raised tank and balcony pillars are 0.2 m (`TANK_PILLAR_SIDE`; `visorSections: true` keeps the Visor's sections for the team's golden). The house renderer draws the pillars in the walls as structure, plastered a shade off the facade and 2.5 cm out of each face (`BuildOptions.pillars`, `'hidden'` as the Visor drew them).
- bf407ec: A reinforced member cast round its cage (a pillar or beam in concrete blocks) is cut through by a blast only at or near contact (`MEMBER_CUT_REACH`, half the breach reach); further off the blast takes the concrete it reaches out of it block by block and the cage holds it to what it rests on. The bare cage of a pillar keeps what its bars carry (`cageResidualCapacity`: perimeter bars by the steel's crushing strength, halved for buckling) instead of a flat 15%, so the end pillar of a wall stands on its cage under a light bond beam.
- 1a5d6fc: Masonry walls stand on concrete pillars along their length, as in confined masonry: besides the corner pillars, every exterior masonry wall gets a 0.2 x 0.2 m reinforced concrete pillar at its free ends and door jambs, beside each window, where another wall meets it and at most every `WALL_PILLAR_SPACING` (4 m), from the floor to the bond beam, which rests on them (`StructureOptions.wallPillars`, `false` for the corner pillars alone; the free-standing `wallPiece` has four). The house renderer draws them under the wall's plaster: a shot or a blow that takes out the plaster and bricks next to one shows its concrete (and its bars when the concrete goes), the bricks stop at its faces, and a brick wall that falls leaves the pillars and the bond beam standing.

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [5a66d40]
- Updated dependencies [61a4a79]
- Updated dependencies [1495684]
- Updated dependencies [02b8ea2]
- Updated dependencies [bf407ec]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-destruction@0.17.0

## 2.0.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-destruction@0.16.0

## 2.0.1

### Patch Changes

- 9314e78: Typed floorplan: `Json` is now `unknown`, and the plan records (`PlanDoor`, `PlanWall`, `PlanWindow`, `PlanGate`, `LotPath`, `Lot`, `Facade`), the resolved slots, the walkability grid (`WalkGrid`), the `placeOnFloor` options and the `generate` result (`FloorplanResult`) have their own types. Template-specific fields (`config`, `building`, extension outputs) are `unknown` and narrowed by the pack that writes them. Generated plans are unchanged.
- f5cc423: Tipa as instalações da casa (luz, gás, água, solar, edícula): `Json` vira `unknown`, cada instalação tem o seu tipo exportado e o `src` do pacote fica sem `any`. O `link` de um item aceita o id do fogão (botijão).
- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-destruction@0.15.0

## 2.0.0

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [7b77aa7]
- Updated dependencies [6489939]
- Updated dependencies [3a46bd0]
- Updated dependencies [d97cf9f]
- Updated dependencies [81bd9c0]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-destruction@0.14.0
  - @adatechnology/game-floorplan@0.3.0

## 1.3.3

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0
  - @adatechnology/game-destruction@0.13.2

## 1.3.2

### Patch Changes

- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [5a2f8e7]
- Updated dependencies [b58423f]
- Updated dependencies [53babb5]
- Updated dependencies [4eb330f]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0
  - @adatechnology/game-destruction@0.13.0

## 1.3.1

### Patch Changes

- Updated dependencies [73f3cf2]
- Updated dependencies [2a1bb17]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-destruction@0.12.0

## 1.3.0

### Minor Changes

- 2c9c963: Concrete answers each kind of blow its own way. `MaterialDef.hits` says, per damage type, what a blow takes out of a material: `unitJoules` (joules per kg of a unit to knock it out), `floor` (joules of each blow that only scar the surface) and `crater` (a crater in the bare surface, a `spall` with `layer` -1). Concrete: a 9 mm round only craters it with dust and chips; rifle rounds knock its blocks out (about three 5.56 or two 7.62x39 per block); a fist takes nothing. A reinforced part now loses blocks too: the bars inside each block that came out show (`expose` carries every bar that shows), the cross-section shot away at one place lowers what the part carries (down to its cage), and the bars of an overloaded part bow more at each `stress` until it gives way. The houses' concrete beams and pillars are made of 0.1 m blocks around their cage (`MEMBER_CAGE`), and the house renderer opens the gaps in a bond beam it draws inside the wall's plaster.

### Patch Changes

- Updated dependencies [f68acce]
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [e5ac121]
- Updated dependencies [31fc87d]
- Updated dependencies [eaedd22]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-destruction@0.11.0
  - @adatechnology/game-contracts@0.18.0

## 1.2.3

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-destruction@0.10.0

## 1.2.2

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-destruction@0.9.0

## 1.2.1

### Patch Changes

- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-destruction@0.8.2

## 1.2.0

### Minor Changes

- 5b69fc2: `wallPiece` and `wallPlan`: a free-standing wall built and drawn as the walls of the houses (the houses' structure without a roof, drawn by the house renderer). `buildStructure` takes `roof: false`. The test room's target wall is now one of them.

## 1.1.1

### Patch Changes

- Updated dependencies [692c098]
  - @adatechnology/game-destruction@0.8.1

## 1.1.0

### Minor Changes

- 024d0e8: Real structure (T10, steps 1 and 2). `game-contracts`: `PartSpec.structure.rebar` (`TensionRebar`: `ratio`, `yieldMPa`, `cover`), `PartState.flexure`
  and `PartState.cracked`. `game-destruction`: concrete (C25) and ceramic brick get `MaterialDef.strength` and capacities from the real strengths
  (NBR 6118, NBR 16868-1 slenderness, reinforced columns `0.85 fck Ac + As fy`), so an overloaded bearing wall crushes at the ground floor first;
  beams and slabs with `structure.rebar` bend (`structure.flexure`, scope `'rebar'` by default): the tension face cracks under a blast and the steel
  holds, a plain beam snaps, yielded steel past 10° hinges and the part falls in one piece; `sizeRebar`, `bearingWallThickness`, `buildFrame({ rebar })`;
  `rebar` joints of reinforced parts no longer wear under blows. Documented capacities change (a 30 x 30 cm concrete column now 203 t, a 20 cm brick
  wall 41 t per metre). `game-floorplan-structure`: `toDestructibleSpec({ rebar })` (off by default) declares and sizes the steel of concrete beams
  and slabs (`REBAR_RATIOS`).
- 20cc300: Skyscraper typology (T10 §11), built from the tower systems, soil, piles and wind of the earlier steps. `game-floorplan-structure`: `buildSkyscraper`,
  `skyscraperLayout`, `SKYSCRAPER_DEFAULTS` (storeys, height, bays, facade, plant floor every N, damper, wind, soil, piles, all options), `pilesFor` and
  `PILE_DEFAULTS` (piles sized by the load and the soil), `addPunchedFacade`, relay mechanical floors in `buildTower` (`mechanical.every`), and the room-level
  plan helpers `towerPlate`, `towerFloors`, `exteriorWindows`. `game-floorplan-commercial`: the `office_tower` template (`officeTowerTemplate`,
  `OFFICE_TOWER_DEFAULTS`, `buildOfficeTower`), the `office_open` library. `game-floorplan-residential`: the `residential_tower` template, the `living_tower`
  library and the zone `zt` (towers, 80 storeys, 320 m). Both packs now depend on `game-floorplan-structure` (peer). `game-urban`: opt-in `towers` option
  (`createUrban({ towers })`, off by default and then byte-identical): tall buildings of the block or avenue drawn as towers of the office and residential
  presets, with `minHeight`, `presets`, `mast` and a `provider`; the pack `TOWER_PATTERNS` adds the `financial_district` avenue. `game-destruction`:
  `verticalBarCount`, so a wall or column holds in tension every bar its spacing puts in (the drawn cage is capped; the capacity was not following it, and
  the walls of the core of a tall tower failed in tension). `game-floorplan`: the walkability grid tests only the walls near the room (same result, a tower
  floor no longer costs seconds).
- 89807ec: Houses and buildings of concrete are real structures in flexure (T10 §12). `game-floorplan-structure`: `toDestructibleSpec` cuts each concrete slab into panels of at most
  `maxSpan` (5 m) with real beams (`h = span / 10`, at least 25 cm), slabs of `L / 40` (at least 10 cm for a floor, 8 cm for a roof), 20 cm pillars where a beam or bond beam
  spans more than `maxSpan`, and lintels and bond beams as deep as their span (`slabPanels`, `SLAB_PANEL_DEFAULTS`, `resolveSlabPanels`, `applySlabPanels`, `slabPanelView`,
  `beamSpan`, `beamDepthFor`); `StructurePart` gets `footprint` and `slab`. The tension steel is now declared and sized by default (`rebar: true`; `rebar: false` or
  `slabPanels: false` give the spec the Visor de casas 3D describes), so the 28 typologies stand at rest and losing one pillar of a framed house no longer drops its slab.
  `game-floorplan-three`: a house bound to a destruction world is drawn by slab panel (floors, ceilings and flat roofs per panel), without a world it is drawn as before; the
  test area's `house_two_pillars` loses the two pillars at the ends of one side. `game-destruction`: a blunt blow on the terrain (an anchored part tagged `terrain`) no longer wears
  the joints of every wall standing on it.
- d24de8a: Soil and foundations (T10 §8). `game-contracts`: `DestructibleSpec.soil` (`SoilProfile`, `SoilLayer`), `PartSpec.structure.pile` (`PileSpec`),
  `ObjectState.soil` (`SoilState`) and the `settle` event. `game-destruction`: soil classes with the NBR 6122 basic pressures (`SOILS`), footings as
  elastic-plastic springs (subgrade modulus of a rigid footing, safety 3), piles by Décourt-Quaresma (`pileCapacity`, `pileLength`), and the object as a
  rigid body on them with the 1/200 out-of-plumb and P-delta: it settles, a heavy building on soft soil sinks, leans and tips over, on piles to firm
  ground it holds; `buildFrame({ footing, raft, piles, soil })`; option `soil` (`SOIL_DEFAULTS`). Off unless a spec has `soil`. `game-destruction-three`:
  draws the settlement and tilt under a `destruction-soil` node. `game-floorplan-structure`: `toDestructibleSpec({ soil, foundation, piles, soils })`
  puts the house on a raft (with piles) or on footings under each wall (`RAFT_THICKNESS`, `PILE_AREA`).
- cd2d333: Building systems of tall buildings (T10 §9). `game-contracts`: `PartSpec.contains.outflow` (the direction a fluid leaves a hole: roof water runs
  down). `game-destruction`: `buildFrame({ continuousColumns, columnCage, roofThickness })` (a 20-storey frame stands on continuous columns).
  `game-floorplan-structure`: `buildTower` and `addCore` (reinforced concrete shear-wall tube with stairs and elevator shafts, the strongest part in a
  blast), `addCurtainWall` (glass hung from the slab edges, shatters in large shards), `addFlatRoof` (screed sloped to the drains, EPDM membrane that
  leaks when punctured), `addMechanicalFloor` (elevator machines, water tank, chillers in the load), with `*_DEFAULTS`, `coreSize` and `towerWater`.
- e9a0932: Structure, step 4: wind and sway (gap 5). New world option `wind` (off by default, so nothing changes without it): NBR 6123 pressure that grows with
  height, drag, a wall-and-frame lateral system (walls as a cantilever, columns and T-beams as a shear frame), top deflection and drift against H/500,
  overturning, axial forces from the wind moment, a gusting sway with a tuned mass damper, `world.setWind`, `ObjectState.wind` and the `sway` event.
  `sizeStructure({ wind })` sizes for it; the wind moment tilts buildings on soft soil. `game-floorplan-structure`: `addTunedMassDamper`,
  `DAMPER_DEFAULTS` and `buildTower({ damper, wind })`. Every number is an option with a default and its source in the T10 spec section 10.
- 5af569f: Skyscrapers are limited to 60 storeys by default (owner, 2026-10-25), configurable. `game-floorplan-structure`: `SKYSCRAPER_MAX_STOREYS` (60), the
  default `range` is `[20, 60]` and `SkyscraperOptions.range` raises it. The office and residential tower presets follow it, and the zone `zt` is now 60
  storeys and 240 m. `game-urban`: `towers.maxStoreys` (default 60), per-preset `minStoreys`/`maxStoreys` and `towerPresetOf`.

  `skyscraperLayout` sizes the bays by the wind (`sizeForWind`, default on, above 180 m): a 60-storey tower passes H/500 (1/521) with 14.5 m bays; `false` keeps the raw layout.

### Patch Changes

- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [e4663e1]
- Updated dependencies [1b1d611]
- Updated dependencies [9f7dadf]
- Updated dependencies [d610199]
- Updated dependencies [fa6ea00]
- Updated dependencies [9b27571]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [024d0e8]
- Updated dependencies [20cc300]
- Updated dependencies [89807ec]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [d032102]
- Updated dependencies [0e27281]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-destruction@0.8.0
  - @adatechnology/game-floorplan@0.2.2

## 1.0.5

### Patch Changes

- Updated dependencies [f49e466]
  - @adatechnology/game-contracts@0.13.0
  - @adatechnology/game-destruction@0.7.2

## 1.0.4

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0
  - @adatechnology/game-destruction@0.7.1

## 1.0.3

### Patch Changes

- Updated dependencies [968d7df]
- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0
  - @adatechnology/game-destruction@0.7.0

## 1.0.2

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0
  - @adatechnology/game-destruction@0.6.1

## 1.0.1

### Patch Changes

- Updated dependencies [cb85470]
- Updated dependencies [aa2c014]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0
  - @adatechnology/game-destruction@0.6.0

## 1.0.0

### Minor Changes

- 6314632: The finds of the floorplan come from the item catalog. `FloorplanOptions` takes `day` and `region` and the contents extension passes them (with `place`, `footprint` and `key`) in the query; `FindsProvider.findsFor` may return `null` ("not mine") and an empty array is now an answer, with `engine.findsAnswer` for packs that have their own default. `game-items`: `createFindsProvider` takes `placeAliases`, `poolPlaces` and `unknownContainers: 'pass'`. `game-items-goods`: `createGoodsFindsProvider(catalog)` for `engine.registerFindsProvider`, with the furniture categories of the floorplan packs bound to the house pools of the visor.
- a2b392a: Installations of the plan (spec 001, T2.2e): `result.utilities` with gas (cylinder beside the stove, in an outside niche or under the counter, or piped with a meter), electricity (service entrance, panel, sockets, switches, circuits, conduits; grid, tap without a meter for a shack, off-grid), solar panels and plumbing; `result.outbuildings` (walls, door, windows,
  furniture and the path to them) and `result.contents` (what each container holds by state, answered by `engine.findsFor` and falling back to the tables of the Visor de casas 3D). The seven lists are equal to the team page in 900 recorded plans.
- 4839020: Wall detail and test walls (spec 001, T2.2d): `toDestructibleSpec` cuts each wall at its windows (piers, sill, reinforced concrete lintel bearing 0.2 m on the piers, wall above) with the
  `game-destruction` assembly of each piece (plaster that spalls, rebar, stages, breach) and keeps the mass of the wall; a door gap gets a lintel that carries the bond beam. `wallDetail: 'units'` lays bricks, blocks and
  concrete panels one by one; log walls are courses of logs. `buildWallSpecimen` builds the 2.4 x 2.1 m test wall of any assembly, whole or with a door or a window.
- 483844f: New package: the structure of every plan from `@adatechnology/game-floorplan` (spec 001, T2.2c). Construction systems (masonry, wood frame, log, improvised, canvas),
  `result.structure` with every part that carries load and what it rests on (foundation, floors, walls, bond beams and plates, pillars, porch posts, trusses or
  rafters, roof, stairs, water tank), `toDestructibleSpec` sized from the loads at rest so a house holds the loss of one pillar and falls with two, and the "Structure"
  layer of the 2D viewer. With `wallDetail: 'coarse'` the structure and the spec are equal to the Visor de casas 3D in 900 recorded plans.

### Patch Changes

- Updated dependencies [76d15b6]
- Updated dependencies [6314632]
- Updated dependencies [b018548]
- Updated dependencies [483844f]
- Updated dependencies [35fa212]
- Updated dependencies [cc182c7]
- Updated dependencies [9e58b50]
- Updated dependencies [95c4bdd]
- Updated dependencies [eeb9f4e]
  - @adatechnology/game-contracts@0.8.0
  - @adatechnology/game-destruction@0.5.0
  - @adatechnology/game-floorplan@0.2.0
