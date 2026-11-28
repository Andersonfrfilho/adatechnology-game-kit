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

## 2026-11-28 — A dívida (sessão `opus`, ordem do dono: "corrige o laundry_tub ... e tbm todas as dívida")

### `laundry_tub` (vermelho na main, CI 46093206999)

Causa: o 9222e952d pôs o tanque em `INSTALLED` (fixo). O `joinBodies` soldava ao corpo a torneira, que já tem âncora própria na parede (`metal_1`); com os
pés quebrados o mundo via uma âncora viva no mesmo grupo (`fixedInPlace`) e o tanque ficava parado a 0,5 m. A solda entre um grupo com âncora própria e o
corpo ancorado virou junta que rasga (`tears`): o móvel entra como um grupo só (`catalogue-one-group` verde) e, sem os pés, o tanque cai e deita no chão; a
torneira fica na parede. Uma primeira versão (não soldar) deixava 14 móveis com dois grupos ao entrar e foi descartada.

### As 14 peças do `hollow-catalogue.test.ts`

Não eram "construtor sem sólidos" (cada parte desse catálogo já é uma malha de uma primitiva): eram três defeitos do motor, cada um com a sua correção.

| Defeito | Peças | Correção |
|---|---|---|
| peça "redonda" vira um cilindro ou casco maciço (banco de pernas, mesa de pé central, abajur, chafariz) | stool, coffee_table_round, floor_lamp, outdoor_pot, pendant, hanging_plant, table_lamp, fountain, floor_plant, soaking_tub, ceiling_light | redonda só se o desenho preenche 90% da forma, por amostragem |
| cilindro grande segurado pela caixa em volta (quinas com até 16% do raio de ar) | fountain, water_tank, ceiling_light | cilindro reto colide como cilindro (`PartBox.round`, `StaticSolid.round`) |
| meio cilindro, cone, esfera segurados pela caixa | bbq_simple | casco convexo dos vértices (`PartBox.hull`) |
| mais de 64 malhas: uma caixa só | shelf_unit (65) | limite 96 |

A guarda achou também um defeito dela mesma: o raio do meio da grade cai sobre a aresta da tampa de um cilindro e o raycast do three erra; a grade foi
deslocada (`SKEW`).

| Guarda | Antes | Agora |
|---|---|---|
| `hollow-catalogue.test.ts` (CI) | 14 na lista de dívida | **lista removida**, 124/124 |
| `hollow-test.mjs` (sala, entrada medida pelo próprio motor) | 0 em 21 peças (redondas puladas) | **0 em 24 peças**, redondas incluídas |
| `broken-catalogue.test.ts` | `laundry_tub` vermelho | verde |

### Casas e veículos

- Veículos não passam pela medição do `game-destruction-three`: têm colisor próprio por cascos convexos (`game-vehicles`, `game-vehicles-three/src/colliders.ts`).
- Casas: parte fixa que não é uma caixa cheia vira os triângulos desenhados (exato); destroço solto é tijolo ou tábua (caixa). **Não há guarda de ar para
  as casas**: não está medido, só argumentado.

## Dívida que fica

- Guarda de ar para as casas (destroços de faixa de malha unida medidos por `fitOrientedBoxes`).
