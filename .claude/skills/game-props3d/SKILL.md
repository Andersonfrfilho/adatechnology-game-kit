---
name: game-props3d
description: Use quando precisar de props 3D procedurais low-poly sem asset (luz de teto, quadro, cortina, persiana, planta, sofá, cama, mesa, piscina, deque, árvore, sacos de areia, barricada, mancha de sangue, piso). 57 builders que só descrevem primitivas por uma api do jogo.
---

# @adatechnology/game-props3d

## Objetivo
Props procedurais low-poly: luzes de teto, decoração de parede, móveis modernos, itens de quintal, pisos e "estado da casa" (barricadas, sacos de areia, suprimentos, manchas). 57 builders, nenhum asset. Os builders **só descrevem primitivas** (`box`, `cylinder`, `leaf`, `plane`, `light`) por uma `api` passada pelo jogo; nada aqui depende de renderer nem exige `three`.

## Quando usar e quando não usar
- Use para decorar e mobiliar sem modelar, e como base de primitivas dos packs interativos.
- Não use para móvel que abre, liga ou guarda coisa (`game-interactables-household`), nem para a planta (`game-floorplan*`).

## Como usar
```ts
import { create, createRecorder, type PropsApi } from '@adatechnology/game-props3d'

const props = create(undefined, { document, locale: 'pt-BR' }) // 1o argumento é ignorado (só para parecer com os outros pacotes)

const api: PropsApi = {
  box: (M, material, x, y, z, w, h, d, color, ry, rx, rz) => { /* base da caixa em y */ },
  cylinder: (M, material, x, y, z, r, h, color, rx, rz, shape) => { /* 'cyl' | 'cyl6' | 'cone' | 'sphere' */ },
  leaf: (M, x, y, z, w, h, color, ry, rx) => { /* folha em losango, ponta para +y */ },
  plane: (M, material, x, y, z, w, h, color, ry, rx, rz, uv) => { /* normal +z; uv = célula do atlas */ },
  light: (M, x, y, z, color, range, kind) => { /* opcional */ },
}
props.builders.sofa_l({ w: 2.8, d: 1.7, h: 0.85, x: 4, z: -2, ry: Math.PI / 2, seed: 'sala', palette: { fabric_main: 0x6e7078 } }, api)

// sem renderer (teste ou prévia)
const { api: recApi, primitives } = createRecorder()
props.builders.sauna({ w: 2, d: 1.8, h: 2.1 }, recApi) // conferido: 35 primitivas
```
O item `M`: frente em `+z`, origem no centro da pegada no chão, metros; `M.x`, `M.z`, `M.ry` quem aplica é a sua `api`. Campos: `w/d/h`, `y`, `ceiling`, `color`, `palette`, `seed`, `variant`, `poly`, `on/light/lit`, `open`, `retracted`, `art`, `fruit`, `angle`, `drag`.

## API principal
| Função/tipo | Para que serve |
|---|---|
| `create(three?, { document, locale, emit })` | `{ builders, types, names, atlas, cover, materials }` |
| `props.builders.<tipo>(M, api)` | Desenha um prop pelas primitivas |
| `props.types` / `listTypes(locale)` | `{ id, name, interior, w, d, h, y, solid, group }` (nome em `en` ou `pt-BR`; `solid: false` = sem colisão) |
| `props.atlas('floor' \| 'picture' \| 'water')` | Atlas em canvas (um `CanvasTexture` e um material por atlas) |
| `props.cover(api, M, kind, opts)` / `{ poly }` | Pisos e coberturas por quadrados de atlas |
| `createRecorder()` | `{ api, primitives }` |
| `mergeByMaterial(THREE, root, space)` | Junta as malhas de um objeto three por material (uma malha por material), com a matriz assada no espaço dado; é o que o `game-weapons-three` e o `game-items-three` usam para cortar chamadas de desenho (veio do `game-weapons-three`; `three` é peer opcional) |
| `hex`, `mix`, `rng`, `seedOf`, `shade`, `FLOORS`, `locales`, `resolveStrings`, `DEFS`, `MATERIALS`, `TYPE_DEFS` | Utilitários e dados |

Grupos: ceiling (`ceiling_light`, `pendant`, `track_spot`, `chandelier`), wall (`wall_ac`, `picture_small/large`, `mirror`, `curtain`, `blinds`, `flat_tv`), plants, furniture (`tv_stand`, `sofa_l`, `double_bed_modern`, `home_office`, `closet`, `vanity`...), floor (`lawn`, `tile_floor`, `concrete`, `deck_floor`, `dirt`), yard (`pool`, `deck`, `sauna`, `fruit_tree`, `palm_tree`, `pergola`, `swing`, `garage_car`...), house_state (`window_boards`, `barricade`, `sandbags`, `barbed_wire`, `blood_stains`, `open_door`...). Materiais: `plain`, `metal`, `wood`, `glass`, `fabric`, `plant`, `water`, `emissive`, `atlas_picture`, `atlas_floor`.

## Compõe com
- Base de `game-interactables-household` (`PropsApi`, `PropItem`) e de `game-interactables-three` (a api de malhas implementa `PropsApi`).
- Os tipos `house_state` são os desenhos dos itens de estado do `game-floorplan-post-apocalyptic`; `lawn`, `deck_floor`, `pool` etc. casam com o piso e os overlays das plantas.

## Ambiente de teste
Sem exemplo próprio; `createRecorder` para testar sem renderer e `tests/` do pacote. O showroom de móveis (`examples/interactables-showroom`) mostra os tipos interativos.

## Cuidados
- Atlas precisam de `document` (opção ou global); sem canvas não há atlas.
- `box` e `cylinder` têm a **base** em `y` (cilindro inclinado, com `rx`/`rz` diferentes de 0, usa `y` como centro); `plane` é centrado e deitado com `rx = -PI/2`.
- `light` é opcional (no máximo uma luz real por cômodo); sem ela é chamado `emit('light', data)`.
- A `seed` padrão é um hash da posição.
- Ids antigos em português (`quadro_peq`, `split_interno`, `sacos_areia`) viraram inglês; tabela em `MIGRATION.md`.

## O que vem pela migração (spec 001)
- Os 57 tipos de móvel do time são exatamente estes 57; nada novo a portar para os builders.
- A9: itens ganham dimensões reais em metros no catálogo único; props e itens devem concordar nas medidas.
- Paleta e materiais de estrutura (concreto armado, tijolo) vêm de `game-destruction`, não daqui.
