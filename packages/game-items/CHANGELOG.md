# @adatechnology/game-items

## 0.4.0

### Minor Changes

- e82bdba: Golpes legíveis e o uso das ferramentas na mão.

  - `game-weapons-three`: um movimento pode girar em torno da mão que segura (`ToolMotion.pivot: 'grip'`), não do olho; a faca corta com a lâmina deitada atravessando a vista e estoca com a ponta para dentro, as duas visíveis em 1ª pessoa; no corpo a mão não larga a ferramenta no fim do golpe (alcance do braço). Taco, taco com pregos, cano, pé de cabra e marreta ganham pegada de duas mãos.
  - `game-weapons` e `game-characters-people`: família `bat_swing` (taco, taco com pregos, cano, pé de cabra, marreta) com a tacada própria: preparo atrás do ombro, giro na altura do peito e acompanhamento por cima do outro ombro (clipe `bat_swing`); machado, picareta e katana ficam com o giro baixo da pá.
  - `game-items` e `game-items-goods`: usos `toggle_flashlight`, `light_lighter`, `use_radio` e `turn_key` (lanterna, isqueiro, rádio e walkie-talkie, chaves), corpo `hand` e `reach`, e `aimHandUse` leva a chave até a fechadura mirada.
  - `game-characters-three`: o braço se estende à frente no uso `reach`.
  - `game-test-room`: F liga e desliga a lanterna (luz do orçamento de luzes saindo da lente), acende e apaga o isqueiro (chama que tremula), fala no rádio e gira a chave na fechadura da porta na mira (tranca e destranca) ou no ar; rótulos em pt-BR e en.

## 0.3.0

### Minor Changes

- a41cb89: Usar o item na mão e golpes por família.

  - `game-items`: usos na mão sem líquido (`HAND_USES`, `createHandUse`): comer com a mão em mordidas, tomar remédio, aplicar curativo, usar sabonete; `game-contracts` ganha `ModuleItemUse` (`TestableItem.use`).
  - `game-items-goods`: `goodsItemUse` diz o uso e o efeito de cada item pelo tipo e pelos efeitos do catálogo (higiene ganha `use_hygiene` e o efeito `wash`; álcool na ferida aplica, não bebe).
  - `game-weapons`: famílias de golpe (`MELEE_FAMILIES`): faca corta e estoca em sequência, facão/machadinha/martelo cortam de cima, taco/cano/pé de cabra/machado giram com as duas mãos; `game-weapons-three` dá o movimento de cada uma (`FAMILY_MOTIONS`) e `game-characters-people` os clipes do corpo `knife_slash` e `knife_stab`.
  - `game-characters-three`: o corpo leva à boca o que se come ou bebe (comer de lata incluído) e junta as duas mãos no sabonete e no curativo (`AvatarItemUsePose.body`).
  - `game-test-room`: F usa o item na mão com o rótulo do uso na legenda (pt-BR e en); a comida diminui a cada mordida e some no fim, o efeito vai para o aviso e o registro; o golpe das armas de família toca o clipe do corpo e o movimento da arma.

### Patch Changes

- Updated dependencies [a41cb89]
  - @adatechnology/game-contracts@0.44.0
  - @adatechnology/game-destruction@0.30.2
  - @adatechnology/game-interactables@0.6.9

## 0.2.25

### Patch Changes

- Updated dependencies [4afbea0]
  - @adatechnology/game-contracts@0.43.0
  - @adatechnology/game-destruction@0.30.1
  - @adatechnology/game-interactables@0.6.3

## 0.2.24

### Patch Changes

- Updated dependencies [9412886]
- Updated dependencies [919616f]
  - @adatechnology/game-contracts@0.42.0
  - @adatechnology/game-destruction@0.30.0
  - @adatechnology/game-interactables@0.6.2

## 0.2.23

### Patch Changes

- Updated dependencies [d7fa717]
  - @adatechnology/game-destruction@0.29.5
  - @adatechnology/game-contracts@0.41.0
  - @adatechnology/game-interactables@0.6.1

## 0.2.22

### Patch Changes

- Updated dependencies [dd746b4]
  - @adatechnology/game-interactables@0.6.0

## 0.2.21

### Patch Changes

- Updated dependencies [b3670e1]
  - @adatechnology/game-contracts@0.40.0
  - @adatechnology/game-destruction@0.29.4
  - @adatechnology/game-interactables@0.5.2

## 0.2.20

### Patch Changes

- Updated dependencies [2e803a4]
  - @adatechnology/game-contracts@0.39.0
  - @adatechnology/game-destruction@0.29.3
  - @adatechnology/game-interactables@0.5.1

## 0.2.19

### Patch Changes

- Updated dependencies [5682afd]
  - @adatechnology/game-contracts@0.38.0
  - @adatechnology/game-interactables@0.5.0
  - @adatechnology/game-destruction@0.29.2

## 0.2.18

### Patch Changes

- Updated dependencies [32547af]
  - @adatechnology/game-interactables@0.4.0

## 0.2.17

### Patch Changes

- Updated dependencies [81e70aa]
  - @adatechnology/game-contracts@0.37.0
  - @adatechnology/game-destruction@0.29.1
  - @adatechnology/game-interactables@0.3.1

## 0.2.16

### Patch Changes

- Updated dependencies [cd5113c]
- Updated dependencies [ff1a27b]
- Updated dependencies [f1c7229]
- Updated dependencies [e3a9ee8]
- Updated dependencies [78ac539]
- Updated dependencies [5e05bb2]
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
  - @adatechnology/game-interactables@0.3.0

## 0.2.15

### Patch Changes

- Updated dependencies [b0b031b]
  - @adatechnology/game-contracts@0.35.0
  - @adatechnology/game-interactables@0.2.27

## 0.2.14

### Patch Changes

- Updated dependencies [779f9f4]
  - @adatechnology/game-contracts@0.34.0
  - @adatechnology/game-interactables@0.2.26

## 0.2.13

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0
  - @adatechnology/game-interactables@0.2.25

## 0.2.12

### Patch Changes

- Updated dependencies [4e2d44b]
  - @adatechnology/game-contracts@0.32.0
  - @adatechnology/game-interactables@0.2.24

## 0.2.11

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0
  - @adatechnology/game-interactables@0.2.23

## 0.2.10

### Patch Changes

- Updated dependencies [c4b8218]
  - @adatechnology/game-contracts@0.30.0
  - @adatechnology/game-interactables@0.2.22

## 0.2.9

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0
  - @adatechnology/game-interactables@0.2.21

## 0.2.8

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-interactables@0.2.20

## 0.2.7

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-interactables@0.2.19

## 0.2.6

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0
  - @adatechnology/game-interactables@0.2.18

## 0.2.5

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-interactables@0.2.17

## 0.2.4

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-interactables@0.2.16

## 0.2.3

### Patch Changes

- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-interactables@0.2.15

## 0.2.2

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
  - @adatechnology/game-interactables@0.2.14

## 0.2.1

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0
  - @adatechnology/game-interactables@0.2.13

## 0.2.0

### Minor Changes

- 0c67a15: Cans open before they are eaten, and a holed or leaking can is no longer food.

  - `game-contracts`: `SealSpec` (what opens a closed container: `openWith` tools or `byHand`; `spoilsWhenBreached`), `sealOpener` and `sealBlock`, and `TestableItem.seal` (`ModuleItemSeal`, with `open` and `contents` to draw the item open and what is left in it). `ItemUseDef` keys take the `eat` action.
  - `game-items`: `ItemDef.seal`; `resolveUse` with `UseContext.seal` does not spend a sealed item that is still closed, holed through or leaking (`UseResult.blocked`).
  - `game-items-goods`: the `canned_food` kind opens with a can opener, a pocket knife or a knife; `canned_drink` and the sardines open by hand; both are spoiled by a hole or a leak. The kind's seal is on every item of the catalog.
  - `game-fluids`: the `eat` use (spoonfuls from an open tin); `drink(id, liters, { eaten })` takes the liquid packed with the food without the effects of drinking it.
  - `game-items-three`: `openItem` draws a model open (`data/opening.json`): the cut lid of a tin bent up with the food inside the rim, the peeled lid of the sardines, the mouth of a drink can; `setOpeningContents` empties it as it is eaten. The items area gives the tins `seal` and the `eat` use.
  - `game-test-room`: a use that empties a sealed item opens it first, by hand or with a tool of the seal within reach or in the loadout, and says what is missing; a holed or leaking item is refused for eating and drinking; eating logs what was eaten.

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
  - @adatechnology/game-interactables@0.2.12

## 0.1.11

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-interactables@0.2.11

## 0.1.10

### Patch Changes

- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-interactables@0.2.10

## 0.1.9

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-interactables@0.2.9

## 0.1.8

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-interactables@0.2.8

## 0.1.7

### Patch Changes

- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-interactables@0.2.7

## 0.1.6

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
  - @adatechnology/game-interactables@0.2.6

## 0.1.5

### Patch Changes

- Updated dependencies [f49e466]
  - @adatechnology/game-contracts@0.13.0
  - @adatechnology/game-interactables@0.2.5

## 0.1.4

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0
  - @adatechnology/game-interactables@0.2.4

## 0.1.3

### Patch Changes

- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0
  - @adatechnology/game-interactables@0.2.3

## 0.1.2

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0
  - @adatechnology/game-interactables@0.2.2

## 0.1.1

### Patch Changes

- Updated dependencies [cb85470]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0
  - @adatechnology/game-interactables@0.2.1

## 0.1.0

### Minor Changes

- 6314632: The finds of the floorplan come from the item catalog. `FloorplanOptions` takes `day` and `region` and the contents extension passes them (with `place`, `footprint` and `key`) in the query; `FindsProvider.findsFor` may return `null` ("not mine") and an empty array is now an answer, with `engine.findsAnswer` for packs that have their own default. `game-items`: `createFindsProvider` takes `placeAliases`, `poolPlaces` and `unknownContainers: 'pass'`. `game-items-goods`: `createGoodsFindsProvider(catalog)` for `engine.registerFindsProvider`, with the furniture categories of the floorplan packs bound to the house pools of the visor.
- 3bf868b: New package: the item catalog engine (skeleton). `ItemDef` (category, real size, weight, rarity, durability, shelf life, nutrition, protection, carry, weapon link, finds), `createItems({ packs, patch, remove, include, categories, places, containers, rules })` over the shared registry helpers, `ITEM_CATEGORIES` (14) and `DEFAULT_RULES` (rarity weights, freshness, storage, carry, protection, retail spawn). No content and no logic yet.
- e48ea53: `BodySlot` comes from `game-contracts` (adds `over`, a layer worn over the others) and `ItemDef.protection.ballistic` (`resistance`, `blunt`, `pass`, `consumable`) is the protection game-characters reads against projectiles.

### Patch Changes

- 8d2caad: `DEFAULT_RULES.rarity.fixedOnly` now lists `legendary` as well as `unique`: the team's page says neither is ever rolled ("Lendário e único nunca são sorteados"). The weights stay those of the team's table.
- Updated dependencies [76d15b6]
- Updated dependencies [cc182c7]
- Updated dependencies [9e58b50]
  - @adatechnology/game-contracts@0.8.0
  - @adatechnology/game-interactables@0.2.0
