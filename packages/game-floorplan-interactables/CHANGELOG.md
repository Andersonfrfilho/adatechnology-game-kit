# @adatechnology/game-floorplan-interactables

## 4.0.0

### Minor Changes

- 32547af: Móveis sem z-fighting e layout com o espaço real de cada coisa: sofá, geladeira e cuba (e mais 14 móveis do household) sem faces no mesmo plano; portas e gavetas com a faixa de abertura livre (`opening`); criado-mudo ao lado da cabeceira (`beside`), também na edícula; quadro de luz, tomadas e interruptores com a caixa real na parede; cano de gás por cima das portas; gabinete ao lado da pia na altura do tampo; vaso de planta com a copa até onde a parede deixa; cabo só em tomada do mesmo lado da parede.

  Plafon apagado em vidro branco leitoso, aceso emissivo. Conteúdo de gavetas, portas e prateleiras desenhado com o item real do catálogo (`createContainedItemModel`, `createContentsView`, `interactives.itemModel`), filho da parte que o leva desde o primeiro quadro, e cada item pegável com uma mão (`take` com `hands: 1`).

  Os goldens do Visor de casas 3D e do adaptador da equipe seguem iguais com `visorLayout` (planta) e `visor` (adaptador).

### Patch Changes

- Updated dependencies [32547af]
  - @adatechnology/game-floorplan@0.5.0
  - @adatechnology/game-floorplan-structure@4.0.0
  - @adatechnology/game-interactables@0.4.0

## 3.0.0

### Patch Changes

- 30a8199: Desenho das redes do bairro (spec 011, T2.8d). `game-urban/networks`: `distributionHardwareOf` (cruzeta e isoladores na faixa MT, trafo com buchas, grampo da BT, uma braçadeira por cabo de telecom, braço e luminária, olhal do estai, tudo lido das `slots`), `networkLampsOf` (o estado da lâmpada do #470 por nó `light`) e o `DistributionSpec` com `crossarm`, `insulators`, `bushings`, `lowVoltage`, `telecom` e `guy`. `game-urban-three`: `createUrbanThree(...).drawNetworks(networks, { isNight, lamps, surfaceAt, poles })` com mastros e ferragem instanciados, vãos fundidos por classe com catenária (`spans`: faixa de índices por vão), estai nos postes de esquina e fim de linha ancorado na calçada, LOD de longe em `LineSegments` (`setFocus`), luzes pelo `LightBudget` do host; cerca de 10 chamadas perto. `game-floorplan-three`: em `street: 'network'` a casa não desenha mais o ramal aéreo (é da rede). O poste `concrete_distribution` desenhado sozinho pelo registro continua o braço simples (golden da área de teste sem diff).

  Rua de verdade (revisão do dono): a MT corre por todo poste de rua do alimentador (cruzeta e 3 fases em todos), não só até o trafo. O ramal sai do poste em frente ao lote ou atravessa a rua em linha reta (no máximo `power.dropMaxSkew` = 30° da normal), nunca passa sobre outro lote, e cada poste leva no máximo `power.dropsPerPole` = 4 ramais; sem poste que sirva, o gerador acrescenta um na estação do lote. O `validateNetworks` ganha `frontages` (de `GeneratedNetworks.frontages`) e os códigos `drop_skewed`, `drop_off_frontage`, `drop_over_other_lot` e `pole_too_many_drops`; aviso novo `drop_off_practice`. O padrão de entrada em `street: 'network'` é um poste fino de concreto de 6 m (`NETWORK_POST`) com o ramal ancorado na face da rua, a caixa do medidor no pé (`meter.place: 'post'`) e o eletroduto descendo pela face: nenhum fio do topo do poste até outro ponto (o objeto `service_entrance` ganha a variante `network`).

- Updated dependencies [30a8199]
  - @adatechnology/game-interactables-household@0.7.0

## 2.0.0

### Patch Changes

- Updated dependencies [78ac539]
- Updated dependencies [f17aebb]
- Updated dependencies [65b522a]
  - @adatechnology/game-floorplan-structure@3.0.0
  - @adatechnology/game-floorplan@0.4.0
  - @adatechnology/game-interactables@0.3.0
  - @adatechnology/game-interactables-household@0.6.0

## 1.0.0

### Patch Changes

- 11308d7: Tipa o adaptador entre a planta e o kit de interativos: `Json` vira `unknown`, o plano que `plan` devolve (`AdapterPlan`, `PlanEntry`), as opções de `plan`, `createWorld`, `add` e `blockedOf` e os módulos do kit (`InteractablesKit`, `HouseholdKit`) têm tipos exportados, e o `src` fica sem `any`. Os pacotes do kit entram como `peerDependencies` opcionais, só pelos tipos.
- Updated dependencies [ebb9479]
  - @adatechnology/game-interactables-household@0.5.0

## 0.1.0

### Minor Changes

- 1cb7dc8: New package `@adatechnology/game-floorplan-interactables`: the team's `AdaptadorInterativos` ported (plan to objects of the interactables kit, wiring, gas, water, chairs, contents, doors fitted to the walls), every table a registry. `game-floorplan-three` uses it as the default of `interactives` (`adapter` still injects another, `adapterOptions` goes to `create`) and the bridge no longer misreads the plan (`floorY`, `panel`, `mats.floor`).
