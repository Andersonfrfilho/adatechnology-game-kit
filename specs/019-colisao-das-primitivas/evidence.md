# 019 — Evidência

## 2026-11-27 — Fases 1 a 3 (sessão `fable`, ordem direta do dono)

### A1 — a peça colide pelas primitivas

`game-destruction-three/tests/drawn-solids.test.ts`:
- banco de quatro pernas redondas e assento, uma malha com `userData.solids`: fixo são 5 corpos de caixa (nenhum trimesh), um raio passa entre as pernas e um bloco
  solto sob o assento deita no chão; solto são 5 caixas, 0,0074 m³ contra 0,069 m³ da caixa em volta, e o bloco também passa por baixo;
- lista que não é sólido (uma meia-medida `'nine'`) não é usada: a malha volta a ser medida pelo desenho.

### A2 — guarda da sala (`examples/test-room/hollow-test.mjs`)

| Quando | Peças com ar numa caixa |
|---|---|
| main antes do #575 (83f70897d) | 10: fridge_compact, dresser, sink_kitchen, sink_bathroom, toilet, utility_sink, service_entrance, sofa, dog_house, lantern_lamp |
| #575 (remendo por vértices) | 5: sink_kitchen, sink_bathroom, toilet, service_entrance, lantern_lamp |
| spec 019 | **0**, com `KNOWN` vazio |

O `lantern_lamp` saiu por outro motivo: a peça dele é redonda no motor (`round`, cilindro), e a guarda lia a caixa de `halfExtents`, que o motor não usa. A
guarda agora pula peça redonda.

### A3 — guarda de catálogo

`game-interactables-three/tests/solids-catalogue.test.ts`: 223 casos (household e props3d, qualidades `high` e `game`, e as opções de `mergeParts`). Em cada
malha, todo vértice está em exatamente um sólido e dentro dele (folga de 1 mm). `conduit_run` não tem malha do mesh api (é um cabo).

### A4 — invariantes e goldens

- `destruction-pieces-never-rise`, `hollow-catalogue`: verdes.
- `game-floorplan-three/tests/exact-golden.test.ts`: os 171 casos passam **sem regravar** (os móveis das casas vêm do catálogo do floorplan, que não usa o mesh
  api; nada deles mudou).
- `game-interactables-three/tests/exact-golden.test.ts`: passa sem regravar. `solids` entrou nas chaves que o snapshot não lê
  (`tools/golden/src/exact-snapshot.ts`, junto de `kitOrigin`): é a lista do que os vértices já desenham; o golden passando sem regravar é a prova de que o
  desenho não mudou um byte.
- `broken-catalogue/laundry_tub` falha neste branch **e na main** (CI 46093206999 da main, `ec022d029`): não é desta spec.

### A5 — custo

`generate` sem `solids`: mesmas posições e índices e a mesma chave de cache (`tests/solids.test.ts`). Com `solids`, uma caixa por primitiva, lida da caixa do
molde (uma vez por molde, `WeakMap`).

### Falhas vistas e descartadas

Na rodada de todos os dependentes com a máquina carregada: `game-interactables-household/review` (wardrobe), `game-destruction-three/engine-ground-net` e
`jit-warmup` (contagem de heap), `game-test-room/interpolation-rates`. Cada um passa rodando sozinho.

## Dívida que fica (declarada na spec)

- 14 peças do `hollow-catalogue.test.ts` (catálogo de móveis do `game-floorplan-three`): o construtor delas não usa o mesh api.
- Cilindro, cone e esfera colidem pela caixa da própria primitiva, não pela forma redonda.
- Casas e veículos seguem medidos pelo desenho.
