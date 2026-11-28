# @adatechnology/game-shapes

## 0.5.0

### Minor Changes

- 1435810: A colisão vem das primitivas que o construtor desenha (spec 019). `generate({ solids: true })` lista em cada lote os sólidos de que ele foi assado
  (`ShapeBatch.solids`: a caixa de cada primitiva, girada como foi desenhada); o mesh api do `game-interactables-three` grava a lista em
  `mesh.userData.solids`; e o `game-destruction-three` segura a malha por ela, fixa e solta, sem ler vértice. Uma peça desenhada em volta do ar (casinha,
  banco de pernas, pia) deixa de colidir como a caixa em volta de tudo. Malha sem a lista (casa, veículo) segue pelo caminho de antes.

### Patch Changes

- Updated dependencies [a41cb89]
  - @adatechnology/game-contracts@0.44.0

## 0.4.7

### Patch Changes

- Updated dependencies [4afbea0]
  - @adatechnology/game-contracts@0.43.0

## 0.4.6

### Patch Changes

- Updated dependencies [9412886]
  - @adatechnology/game-contracts@0.42.0

## 0.4.5

### Patch Changes

- Updated dependencies [d7fa717]
  - @adatechnology/game-contracts@0.41.0

## 0.4.4

### Patch Changes

- Updated dependencies [b3670e1]
  - @adatechnology/game-contracts@0.40.0

## 0.4.3

### Patch Changes

- Updated dependencies [2e803a4]
  - @adatechnology/game-contracts@0.39.0

## 0.4.2

### Patch Changes

- Updated dependencies [5682afd]
  - @adatechnology/game-contracts@0.38.0

## 0.4.1

### Patch Changes

- Updated dependencies [81e70aa]
  - @adatechnology/game-contracts@0.37.0

## 0.4.0

### Minor Changes

- 18bd23f: As formas passam pelo coordenador de workers (spec 009, T11): `shapesGenerateKind` (`shapes.generate`, faixa `build`, entrada `./worker-kinds`) e `createShapePool({ workers })`; o `size`/`spawn` antigo continua como legado. O preset inclui a categoria em `KIT_WORKER_KINDS`.
- e987bbe: `fitOrientedBoxes(points, triangles?)` passa a aceitar também os triângulos da peça. Assim, uma peça desenhada por anéis de vértices, como poste, cano ou fio, é segurada pelo corpo inteiro, e não por placas nas pontas. O mesmo vale para um cano em L, que segue a curva e não vira uma placa de ar atravessando a dobra.

  O poste de concreto do lote colide como fuste de 7,5 m, com cruzeta e isoladores. Deitado, ele dorme em cerca de 2 s com o Jolt.

  Sem os triângulos, o resultado da função continua o mesmo de antes.

### Patch Changes

- c8b5c71: Spec 008 (fases 1–3 até a T3.8): motor físico Jolt Physics como opção do kit, desligado por padrão.

  - Pacotes novos: `game-physics` (contrato do motor, fila de despertar, medidor de custo) e `game-physics-jolt` (adaptador do Jolt). O Jolt é escolhido por `physics`; sem ele, o solver próprio segue como hoje.
  - Entulho de explosão opcional (`blastDebris`): as peças despertam em lotes, com o mínimo e o máximo ajustados pelo custo medido na máquina.
  - Colisores fiéis ao desenho:
    - a caixa só vale quando as faces estão cobertas;
    - se as faces não estão cobertas, a peça colide pelos triângulos (batentes e molduras não são mais placas maciças).
  - Portas e janelas sem peças nascendo umas dentro das outras.
  - Fiação e canos se soltam em trechos (`segmentLimits`), cortados em lajes e paredes.
  - O chão é montado ao longo do caminho de peças rápidas.
  - Os estilhaços de granada sorteiam por alvo: um objeto novo na cena não muda mais onde eles caem.
  - A mão empurra a porta que se afasta, em vez de seguir a folha (spec 004).

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

## 0.3.0

### Minor Changes

- 6b829c7: z-fighting guard: `coincidentFaces` (game-shapes) finds triangles on the same plane, facing the same way, that overlap; `coincidentFacesOf(root)` (game-shapes-three) runs it on any three.js object in world space (instances, only what is drawn, the nearest LOD level, decals with polygonOffset skipped) and names the two meshes of each hit.

## 0.2.13

### Patch Changes

- Updated dependencies [b0b031b]
  - @adatechnology/game-contracts@0.35.0

## 0.2.12

### Patch Changes

- Updated dependencies [779f9f4]
  - @adatechnology/game-contracts@0.34.0

## 0.2.11

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0

## 0.2.10

### Patch Changes

- Updated dependencies [4e2d44b]
  - @adatechnology/game-contracts@0.32.0

## 0.2.9

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0

## 0.2.8

### Patch Changes

- Updated dependencies [c4b8218]
  - @adatechnology/game-contracts@0.30.0

## 0.2.7

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0

## 0.2.6

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0

## 0.2.5

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0

## 0.2.4

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0

## 0.2.3

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0

## 0.2.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0

## 0.2.1

### Patch Changes

- 106c0f5: No `any` in the public types: `ShapeGenerator<TParams>`, `Composer<TParams>` and `PoleShapeBuilder<TSpec>` take the params type of the entry (a registry still holds entries with different params), and `Devtools.db` is a typed `MarksDatabase`.
- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0

## 0.2.0

### Minor Changes

- 24b4981: Shape generators by instance (spec 005, D5): `createShapes({ packs, patch, remove })` returns a set (`register`, `unregister`, `get`, `list`, `record`, `generate`) of its own; its `generate` looks custom nodes up only in the set (new `GenerateOptions.isolatedGenerators`). `defaultShapeGenerators()` is the set behind `registerGenerator`, `unregisterGenerator`, `getGenerator` and `listGenerators`, which stay exported and `@deprecated` with the same results. The package now depends on `@adatechnology/game-contracts` for the catalog helpers; the IIFE bundles it. The worker and the shape cache still read the global registry.

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

## 0.1.0

### Minor Changes

- ea8b287: New package: the kit's single 3D generator. A JSON shape (primitives, extrusions, lathes, box-minus-holes, transforms, groups, named parts, materials by id, LOD rules, instancing hints) becomes typed-array buffers per material, pure and deterministic by seed, transferable and cacheable by key. The generators are line-by-line ports of three.js r160 and the output is bit-identical to three's. `createShapeCache` (LRU by key and bytes), `createShapePool` (workers through any `postMessage`/`onmessage` object, in-flight sharing, transferred arrays, in-thread fallback) and `installShapeWorker` (`@adatechnology/game-shapes/worker`).
