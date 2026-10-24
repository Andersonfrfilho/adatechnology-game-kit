# @adatechnology/game-props3d

## 0.2.0

### Minor Changes

- 50eee43: Novo `@adatechnology/game-animals-three` 0.1.0 (spec 001, T4.3b e T4.4b): porte literal dos construtores dos Bichos do Vale (`quad`, `bird`, `snake`) e da animação, com os visuais vivo, infectado e morto para as 13 espécies, as vistas de juntas e aberta, e o módulo de teste `createAnimalsTestModule` (`?area=animals`). O `game-props3d` ganha `createNodeSkin` e `collectReferencedNodes`: uma malha de GPU que representa uma árvore inteira de peças, para muitos bichos numa chamada de desenho.
- 32a00c6: `mergeByMaterial(THREE, root, space)`: joins the meshes of an object by material (one mesh per material, matrices baked into the given space). It moved here from `@adatechnology/game-weapons-three` so that the item models can use it too. `three` is an optional peer dependency.

## 0.1.0

### Minor Changes

- 3563fe0: Initial release (0.1.0): 57 procedural low-poly prop builders that only describe primitives through a host-provided api, ported to TypeScript with English naming and an `en` / `pt-BR` locale table.
