# @adatechnology/game-interactables

## 0.5.2

### Patch Changes

- Updated dependencies [b3670e1]
  - @adatechnology/game-contracts@0.40.0

## 0.5.1

### Patch Changes

- Updated dependencies [2e803a4]
  - @adatechnology/game-contracts@0.39.0

## 0.5.0

### Minor Changes

- 5682afd: O item tirado de um móvel vai para a mão: `ModuleHost.takeInHand` (`HostTakenItem`) leva o item com as mãos que ele pede; o `take` de um item guardado diz qual é (`Interactable.itemType`); a área de casas entrega o item ao apertar E, e a sala fecha a mão nele com a regra de mãos e coldre (uma mão: a arma fica na outra). A sala passa a respeitar as mãos que a peça pede em vez de deduzi-las da massa.

### Patch Changes

- Updated dependencies [5682afd]
  - @adatechnology/game-contracts@0.38.0

## 0.4.0

### Minor Changes

- 32547af: Móveis sem z-fighting e layout com o espaço real de cada coisa: sofá, geladeira e cuba (e mais 14 móveis do household) sem faces no mesmo plano; portas e gavetas com a faixa de abertura livre (`opening`); criado-mudo ao lado da cabeceira (`beside`), também na edícula; quadro de luz, tomadas e interruptores com a caixa real na parede; cano de gás por cima das portas; gabinete ao lado da pia na altura do tampo; vaso de planta com a copa até onde a parede deixa; cabo só em tomada do mesmo lado da parede.

  Plafon apagado em vidro branco leitoso, aceso emissivo. Conteúdo de gavetas, portas e prateleiras desenhado com o item real do catálogo (`createContainedItemModel`, `createContentsView`, `interactives.itemModel`), filho da parte que o leva desde o primeiro quadro, e cada item pegável com uma mão (`take` com `hands: 1`).

  Os goldens do Visor de casas 3D e do adaptador da equipe seguem iguais com `visorLayout` (planta) e `visor` (adaptador).

## 0.3.1

### Patch Changes

- Updated dependencies [81e70aa]
  - @adatechnology/game-contracts@0.37.0

## 0.3.0

### Minor Changes

- 65b522a: O que é preso no mundo real é preso no mundo da destruição: a casa carrega como um grupo só, e nada cai ou escorrega na carga. Novo tipo de junta `slide` (corrediça de gaveta, 100 de resistência, sai com a mão ou com chave de fenda, 3 s) em `JointKind` e `JOINT_DEFAULTS`; as gavetas dos móveis do `game-interactables-household` passam de `clip` para `slide`. Na casa (`game-floorplan-three`), cada peça declara onde se prende (`holder`, ou `holdOn: 'floor' | 'wall'` com `holdJoint`): muro do lote e poste fincados no chão com a junta que `JOINT_BY_MATERIALS` dá contra concreto (tijolo e concreto: argamassa), soleira assentada no baldrame, portão e porta da caixa de correio na dobradiça do muro ao lado (`slide` no portão de correr), porta do box na parede do banheiro, portas e gavetas dos móveis no piso onde o móvel está (`hinge`/`slide`), eletroduto aparente grampeado na parede, botijão apoiado no piso (`resting`), cano fora da parede preso na laje em que entra; com o poste preso, a fiação pendura nele. Só cai quando essa junta quebra. Limitação conhecida: as portas e gavetas dos móveis da casa ficam presas ao piso sob o móvel (a laje do andar, ou o chão no térreo) até o corpo do móvel virar uma parte do mundo da destruição; hoje elas só caem quando a dobradiça/corrediça quebra ou o piso vai. Peça que diz onde se prende e não acha nada (`holdOn` sem piso, parede ou chão sob ela) vai para `house.structure.unheld`, e o teste de carga exige essa lista vazia em todo o catálogo. Peças interativas abertas são medidas fechadas. O que se finca no chão segura como a base enterrada: `embedmentStrength` (game-destruction) dá a resistência da junta pela base enterrada no solo (`soils.json`, pressão básica × segurança, camada a camada) sobre a base de referência de `EMBEDMENT_DEFAULTS`; `postEmbedment` é a regra do poste (10% da altura + 0,6 m). `Support.strength` (game-floorplan-structure) leva a resistência até a junta. Na casa, o poste declara a base pela regra, o muro do lote o baldrame (`GROUND_BEAM_DEPTH`) ao longo do comprimento, e uma peça desenhada abaixo do terreno conta o que está enterrado; pé no terreno ou abaixo dele (o terreno lido no canto mais baixo da pegada) está ancorado, nunca solto.

### Patch Changes

- Updated dependencies [cd5113c]
- Updated dependencies [ff1a27b]
- Updated dependencies [f1c7229]
- Updated dependencies [e3a9ee8]
- Updated dependencies [78ac539]
- Updated dependencies [5e05bb2]
- Updated dependencies [6fb91f5]
- Updated dependencies [c8b5c71]
- Updated dependencies [6356f68]
- Updated dependencies [65b522a]
- Updated dependencies [631d9d0]
- Updated dependencies [c394683]
- Updated dependencies [8d26913]
  - @adatechnology/game-contracts@0.36.0

## 0.2.27

### Patch Changes

- Updated dependencies [b0b031b]
  - @adatechnology/game-contracts@0.35.0

## 0.2.26

### Patch Changes

- Updated dependencies [779f9f4]
  - @adatechnology/game-contracts@0.34.0

## 0.2.25

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0

## 0.2.24

### Patch Changes

- Updated dependencies [4e2d44b]
  - @adatechnology/game-contracts@0.32.0

## 0.2.23

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0

## 0.2.22

### Patch Changes

- Updated dependencies [c4b8218]
  - @adatechnology/game-contracts@0.30.0

## 0.2.21

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0

## 0.2.20

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0

## 0.2.19

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0

## 0.2.18

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0

## 0.2.17

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0

## 0.2.16

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0

## 0.2.15

### Patch Changes

- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0

## 0.2.14

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [7b77aa7]
- Updated dependencies [d97cf9f]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
  - @adatechnology/game-contracts@0.22.0

## 0.2.13

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0

## 0.2.12

### Patch Changes

- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [53babb5]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0

## 0.2.11

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0

## 0.2.10

### Patch Changes

- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0

## 0.2.9

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0

## 0.2.8

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0

## 0.2.7

### Patch Changes

- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0

## 0.2.6

### Patch Changes

- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [1b1d611]
- Updated dependencies [d610199]
- Updated dependencies [9b27571]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [024d0e8]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0

## 0.2.5

### Patch Changes

- Updated dependencies [f49e466]
  - @adatechnology/game-contracts@0.13.0

## 0.2.4

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0

## 0.2.3

### Patch Changes

- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0

## 0.2.2

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0

## 0.2.1

### Patch Changes

- Updated dependencies [cb85470]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0

## 0.2.0

### Minor Changes

- cc182c7: Contracts: `Thumbnail` (`svg` or `render`, with `yaw`, `pitch`, `distance` and `wear`) and `TestableItem.thumbnail`; the registry helpers `mergeById`, `applyPatches`, `removeIds`, `deepMerge` and the `DeepPartial` type now live here so every catalog package merges packs the same way. Interactables: `ItemDef.thumbnail` and a dependency on the contracts. Weapons: imports the helpers from the contracts (public API unchanged).

### Patch Changes

- Updated dependencies [76d15b6]
- Updated dependencies [cc182c7]
- Updated dependencies [9e58b50]
  - @adatechnology/game-contracts@0.8.0

## 0.1.0

### Minor Changes

- 5ad2b1a: Initial release (0.1.0): renderer-agnostic runtime for interactive world objects (movable parts with swept-area fitting, containers and deterministic loot, power grid, fuel, logical water network, seats, soft volumes, emitters, mirrors, colliders, damage, save/load) with an `en` / `pt-BR` locale table.
