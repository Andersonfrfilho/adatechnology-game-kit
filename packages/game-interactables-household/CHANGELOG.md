# @adatechnology/game-interactables-household

## 0.7.1

### Patch Changes

- 32547af: Móveis sem z-fighting e layout com o espaço real de cada coisa: sofá, geladeira e cuba (e mais 14 móveis do household) sem faces no mesmo plano; portas e gavetas com a faixa de abertura livre (`opening`); criado-mudo ao lado da cabeceira (`beside`), também na edícula; quadro de luz, tomadas e interruptores com a caixa real na parede; cano de gás por cima das portas; gabinete ao lado da pia na altura do tampo; vaso de planta com a copa até onde a parede deixa; cabo só em tomada do mesmo lado da parede.

  Plafon apagado em vidro branco leitoso, aceso emissivo. Conteúdo de gavetas, portas e prateleiras desenhado com o item real do catálogo (`createContainedItemModel`, `createContentsView`, `interactives.itemModel`), filho da parte que o leva desde o primeiro quadro, e cada item pegável com uma mão (`take` com `hands: 1`).

  Os goldens do Visor de casas 3D e do adaptador da equipe seguem iguais com `visorLayout` (planta) e `visor` (adaptador).

- Updated dependencies [32547af]
  - @adatechnology/game-interactables@0.4.0

## 0.7.0

### Minor Changes

- 30a8199: Desenho das redes do bairro (spec 011, T2.8d). `game-urban/networks`: `distributionHardwareOf` (cruzeta e isoladores na faixa MT, trafo com buchas, grampo da BT, uma braçadeira por cabo de telecom, braço e luminária, olhal do estai, tudo lido das `slots`), `networkLampsOf` (o estado da lâmpada do #470 por nó `light`) e o `DistributionSpec` com `crossarm`, `insulators`, `bushings`, `lowVoltage`, `telecom` e `guy`. `game-urban-three`: `createUrbanThree(...).drawNetworks(networks, { isNight, lamps, surfaceAt, poles })` com mastros e ferragem instanciados, vãos fundidos por classe com catenária (`spans`: faixa de índices por vão), estai nos postes de esquina e fim de linha ancorado na calçada, LOD de longe em `LineSegments` (`setFocus`), luzes pelo `LightBudget` do host; cerca de 10 chamadas perto. `game-floorplan-three`: em `street: 'network'` a casa não desenha mais o ramal aéreo (é da rede). O poste `concrete_distribution` desenhado sozinho pelo registro continua o braço simples (golden da área de teste sem diff).

  Rua de verdade (revisão do dono): a MT corre por todo poste de rua do alimentador (cruzeta e 3 fases em todos), não só até o trafo. O ramal sai do poste em frente ao lote ou atravessa a rua em linha reta (no máximo `power.dropMaxSkew` = 30° da normal), nunca passa sobre outro lote, e cada poste leva no máximo `power.dropsPerPole` = 4 ramais; sem poste que sirva, o gerador acrescenta um na estação do lote. O `validateNetworks` ganha `frontages` (de `GeneratedNetworks.frontages`) e os códigos `drop_skewed`, `drop_off_frontage`, `drop_over_other_lot` e `pole_too_many_drops`; aviso novo `drop_off_practice`. O padrão de entrada em `street: 'network'` é um poste fino de concreto de 6 m (`NETWORK_POST`) com o ramal ancorado na face da rua, a caixa do medidor no pé (`meter.place: 'post'`) e o eletroduto descendo pela face: nenhum fio do topo do poste até outro ponto (o objeto `service_entrance` ganha a variante `network`).

## 0.6.0

### Minor Changes

- 65b522a: O que é preso no mundo real é preso no mundo da destruição: a casa carrega como um grupo só, e nada cai ou escorrega na carga. Novo tipo de junta `slide` (corrediça de gaveta, 100 de resistência, sai com a mão ou com chave de fenda, 3 s) em `JointKind` e `JOINT_DEFAULTS`; as gavetas dos móveis do `game-interactables-household` passam de `clip` para `slide`. Na casa (`game-floorplan-three`), cada peça declara onde se prende (`holder`, ou `holdOn: 'floor' | 'wall'` com `holdJoint`): muro do lote e poste fincados no chão com a junta que `JOINT_BY_MATERIALS` dá contra concreto (tijolo e concreto: argamassa), soleira assentada no baldrame, portão e porta da caixa de correio na dobradiça do muro ao lado (`slide` no portão de correr), porta do box na parede do banheiro, portas e gavetas dos móveis no piso onde o móvel está (`hinge`/`slide`), eletroduto aparente grampeado na parede, botijão apoiado no piso (`resting`), cano fora da parede preso na laje em que entra; com o poste preso, a fiação pendura nele. Só cai quando essa junta quebra. Limitação conhecida: as portas e gavetas dos móveis da casa ficam presas ao piso sob o móvel (a laje do andar, ou o chão no térreo) até o corpo do móvel virar uma parte do mundo da destruição; hoje elas só caem quando a dobradiça/corrediça quebra ou o piso vai. Peça que diz onde se prende e não acha nada (`holdOn` sem piso, parede ou chão sob ela) vai para `house.structure.unheld`, e o teste de carga exige essa lista vazia em todo o catálogo. Peças interativas abertas são medidas fechadas. O que se finca no chão segura como a base enterrada: `embedmentStrength` (game-destruction) dá a resistência da junta pela base enterrada no solo (`soils.json`, pressão básica × segurança, camada a camada) sobre a base de referência de `EMBEDMENT_DEFAULTS`; `postEmbedment` é a regra do poste (10% da altura + 0,6 m). `Support.strength` (game-floorplan-structure) leva a resistência até a junta. Na casa, o poste declara a base pela regra, o muro do lote o baldrame (`GROUND_BEAM_DEPTH`) ao longo do comprimento, e uma peça desenhada abaixo do terreno conta o que está enterrado; pé no terreno ou abaixo dele (o terreno lido no canto mais baixo da pegada) está ancorado, nunca solto.

### Patch Changes

- Updated dependencies [0b25285]
- Updated dependencies [65b522a]
  - @adatechnology/game-items-goods@0.4.0
  - @adatechnology/game-interactables@0.3.0
  - @adatechnology/game-props3d@0.3.5

## 0.5.0

### Minor Changes

- ebb9479: Foley of the hand. `game-audio` ships `FOLEY_BANK`: doors (wooden, metal, locked rattle, slam), fridge, microwave, drawers, item pickup by material, throw, can and bottle opening, gulps, chewing and first aid, under the ids of the sound list so a recorded take under the same id replaces the synthesised one. Each recipe draws pitch, timing and level from ranges (no two plays alike) and uses `FOLEY_FALLOFF`, which falls off faster and loses its highs with distance. `LEAF_FOLEY_SETS` groups the leaf sounds by kind (`fridge`, `microwave`, `drawer`, `wood_door`, `metal_door`).

  `TestableItem.sounds` (`ItemSounds`) lets an item name its leaf sound set per part, its pickup class, its opening sound and the sound of each use. The household fridges and microwave declare theirs; a vehicle's leaves are left to the vehicle bank (`game-vehicles-three`).

  `createDestructionSound` registers the foley bank and plays a key without a rule that is the id of a registered sound. The test room plays a leaf's set (the item's, else a drawer for a slide, else a metal or wooden door by material; a heavy leaf slams), and now sounds when an item is picked up, thrown, opened (can tab or screw cap) and while it is drunk or eaten. The doors keys `leaf_latch`, `leaf_creak_*`, `leaf_shut_*` and `leaf_rattle` are no longer sent by the room's doors.

### Patch Changes

- @adatechnology/game-interactables@0.2.15
- @adatechnology/game-items-goods@0.3.3

## 0.4.0

### Minor Changes

- a1ce099: Pushing is no longer offered for everything: only a piece whose definition says `pushable` (a sofa, a wardrobe, a fridge, a grill) is leaned on. What goes in the hand is grabbed at once.

### Patch Changes

- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [b8d2a17]
  - @adatechnology/game-items-goods@0.3.0
  - @adatechnology/game-interactables@0.2.12

## 0.3.1

### Patch Changes

- @adatechnology/game-interactables@0.2.11
- @adatechnology/game-items-goods@0.2.5

## 0.3.0

### Minor Changes

- a066006: Every household type carries its real mass, empty, as `massKg` (the table the furniture test area kept for itself now lives in the pack), and the camp and rural types get real values: camping table 4.5 kg, camp stove 2, lantern 1, cooler 5, camping gas canister 0.4, camping chair 3, bunk bed 75, wood stove 120, outhouse 150, campfire 100 (they weighed 61, 65, 24, 55, 16, 6, 291, 591, 200 and 211 kg from the volume of their solid drawing).

### Patch Changes

- @adatechnology/game-items-goods@0.2.4
- @adatechnology/game-interactables@0.2.10

## 0.2.10

### Patch Changes

- @adatechnology/game-interactables@0.2.9
- @adatechnology/game-items-goods@0.2.3

## 0.2.9

### Patch Changes

- @adatechnology/game-interactables@0.2.8
- @adatechnology/game-items-goods@0.2.2

## 0.2.8

### Patch Changes

- @adatechnology/game-interactables@0.2.7
- @adatechnology/game-items-goods@0.2.1

## 0.2.7

### Patch Changes

- Updated dependencies [1af2cb3]
- Updated dependencies [c21c718]
- Updated dependencies [fcd0be6]
  - @adatechnology/game-items-goods@0.2.0
  - @adatechnology/game-props3d@0.3.1
  - @adatechnology/game-interactables@0.2.6

## 0.2.6

### Patch Changes

- Updated dependencies [e29f38d]
  - @adatechnology/game-props3d@0.3.0

## 0.2.5

### Patch Changes

- @adatechnology/game-interactables@0.2.5
- @adatechnology/game-items-goods@0.1.5

## 0.2.4

### Patch Changes

- @adatechnology/game-interactables@0.2.4
- @adatechnology/game-items-goods@0.1.4

## 0.2.3

### Patch Changes

- @adatechnology/game-interactables@0.2.3
- @adatechnology/game-items-goods@0.1.3

## 0.2.2

### Patch Changes

- @adatechnology/game-interactables@0.2.2
- @adatechnology/game-items-goods@0.1.2

## 0.2.1

### Patch Changes

- @adatechnology/game-interactables@0.2.1
- @adatechnology/game-items-goods@0.1.1

## 0.2.0

### Minor Changes

- 5c9f47a: The 92 household items now come from `@adatechnology/game-items-goods` (new dependency): `src/data/items.json` and the `item.*` locale keys are gone from the package; `hh.items` and `hh.strings` serve the same ids from the goods catalog, `HOUSEHOLD_ITEM_IDS` is new, and `loot.json` is unchanged (every id still exists).

  Breaking notes: `category` is now one of the 14 categories of `game-items` (`food`, `drink`, `medical`, `tools`...; `hygiene` became `medical`, `kitchen` `tools`...) and the old category is in `tags`. The team's values win where the delivery had them: 18 items changed weight (for example `rope` 0.4 to 1 kg, `juice_box` 1 to 0.2 kg) and 8 changed size (`rice` 10x20x6 to 17.1x25x7.1 cm, `water_bottle` 7x28x7 to 6.6x18.3x6.6 cm, `juice_box` 7x20x7 to 5.2x10x3.7 cm, `bandage`, `first_aid_kit`, `flashlight`, `batteries`, and `hammer`, now standing in the pose of the team's model at 15.9x33x4.7 cm). pt-BR names of the 38 merged items are the team's.

### Patch Changes

- Updated dependencies [6314632]
- Updated dependencies [50eee43]
- Updated dependencies [682554f]
- Updated dependencies [cc182c7]
- Updated dependencies [32a00c6]
  - @adatechnology/game-items-goods@0.1.0
  - @adatechnology/game-props3d@0.2.0
  - @adatechnology/game-interactables@0.2.0

## 0.1.0

### Minor Changes

- 8ab1f1e: Initial release (0.1.0): household content pack for `@adatechnology/game-interactables` with 37 modeled objects (storage with real depth and drawers, kitchen and bathroom fixtures, electrical items, seating, windows, yard objects), 90 items, loot tables, `en` / `pt-BR` strings and `br` / `us` region data.
- d99d915: Twelve new types for rural homes and camping: `bunk_bed`, `wood_stove`, `fireplace` (brick or stone), `outhouse`, `well` (bucket, crank and rope parts, a `hose` fixture on a 20 000 l tank), `cooler` (loot table `cooler`), `campfire`, `camp_stove`, `gas_canister`, `lantern_lamp`, `camp_chair` and `camp_table`. New `rural` and `camp` groups, `item.flueHeight` / `item.chimneyHeight`, region data `canister`, items `ice_pack` and `sandwich`, locale keys in `en` and `pt-BR`, destruction tags on every body and part.

  Adds `service_entrance` `variant: 'gato'`: an illegal tap with a bare drop wire and no pole, riser or meter box.

### Patch Changes

- Updated dependencies [5ad2b1a]
  - @adatechnology/game-interactables@0.1.0
