---
name: game-interactables-three
description: Use quando precisar desenhar em three.js os objetos interativos do kit (mesclar primitivas em poucas malhas, mover porta e gaveta pela pose do mundo, fumaça, fogo, água, tela de TV, espelho, cabo, cortina que balança com sombra certa). Adaptador three para game-interactables e game-interactables-household.
---

# @adatechnology/game-interactables-three

## Objetivo
Adaptador three.js do `game-interactables` e dos packs que desenham por `HouseholdApi`. Junta as primitivas em uma geometria por material, põe cada parte móvel em grupo próprio, move as partes que o mundo anima e desenha efeitos, telas, espelhos e cabos. `three` é peer dependency importado **só como tipo**: o jogo passa o seu `THREE` (e o `Reflector`).

## Quando usar e quando não usar
- Use quando o jogo roda em three.js e quer ver os objetos do `game-interactables`.
- Não use sem three (o runtime e os packs funcionam sem renderer) nem para efeitos de destruição (`game-destruction-three`).

## Como usar
```ts
import * as THREE from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { createThreeAdapter } from '@adatechnology/game-interactables-three'

const gfx = createThreeAdapter(THREE, { document, Reflector, envMap })

const { api, finish } = gfx.createMeshApi({ quality: 'game' })
pack.build('wardrobe', {}, api) // hh.build(...) do household
const { group, parts } = finish(spec) // passe o spec devolvido pelo pack (une persianas e roupas, copia tags de destruição)
scene.add(group)

// todo quadro
world.update(dt)
gfx.syncObject(world, 'wardrobe-1', parts, { time: clock.elapsedTime })
effects.update(dt, world.emitters()) // effects = gfx.createEffects({ scene, camera, maxParticles: 800, document })
mirrors.update(camera, world.mirrors([x, y, z], 6)) // mirrors = gfx.createMirrors({ max: 1, resolution: 512 })
```
Toda função existe também sem o adaptador, com `THREE` primeiro: `createMeshApi(THREE, options)`, `applyPose(THREE, group, motion, t)`...

## API principal
| Função/tipo | Para que serve |
|---|---|
| `createThreeAdapter(THREE, { document, Reflector, envMap })` | Adaptador com tudo ligado ao seu THREE |
| `createMeshApi({ materials, quality, shadows, materialFor })` | `{ api, finish, materials }`; `quality` `'game'` (Lambert, menos segmentos) ou `'high'` (Standard). Grava no `createShapeRecorder` do props3d e assa com o `generate` do `game-shapes`; `tests/exact-golden.test.ts` guarda cada bit (regrave com `UPDATE_EXACT=1` só quando a mudança for de propósito) |
| `finish(spec?, { mergeParts, materialFor })` | `{ group, parts, lights }`; `parts[id]` é o grupo da parte |
| `mergeParts` | Une partes do mesmo `PartSpec.group` e panos `cloth` (persiana 38 malhas para 3, varal 31 para 2) |
| `applyPose`, `poseOf`, `rememberRest`, `syncObject` | Pose da parte e balanço dos volumes macios a partir do mundo |
| `attachSway`, `swayMaterial`, `patchSwayShader` | Balanço no vertex shader com material de profundidade e distância iguais (sombra acompanha) |
| `createEffects({ scene, camera, maxParticles, document })` | Fumaça, vapor, fogo, faíscas e água em pool, com semente |
| `createScreen({ w, h })` | Tela de TV em canvas: `setOn`, `setChannel`, `update` |
| `createMirrors({ max, resolution, keepInfo })` | Espelhos: o mais próximo ganha `Reflector`, o resto fica em env map |
| `createCord`, `catenary` | Cabo em tubo e curva pendurada |
| `MATERIAL_KEYS` | `plain`, `metal`, `wood`, `glass`, `fabric`, `plant`, `water`, `emissive`, `atlas_picture`, `atlas_floor` |

Nomes dos grupos: `part:<id>` com `userData.part = id` no grupo e nas malhas (serve para raycast).

## Compõe com
- Depende de `game-interactables` (mundo, pose) e `game-props3d` (`PropsApi`), `dependencies`; `three ^0.160` é peer.
- Desenha o que `game-interactables-household` constrói; com `finish(spec)` copia as tags de destruição (`userData.destructionMaterial`, `destructionPart`, `destructionPiece`, `destructionJoint`) para o `game-destruction-three`.
- Futuro `game-floorplan-three` fará a ponte das casas para estes móveis.

## Ambiente de teste
Testes em `tests/` (mesh, pose, merge, effects, mirrors, screen, sway, destruction, household). Visual: `examples/interactables-showroom` e `examples/interactables-test-area` (`node build.mjs` depois de `pnpm -r build`).

## Cuidados
- Atlas (`atlas_picture`, `atlas_floor`) são materiais **seus** (um `CanvasTexture` do atlas do `game-props3d`).
- `createEffects` exige `scene` e `camera` (pode ser função ou `null`, lente de 90 graus); chame `setViewHeight` ao redimensionar.
- `finish()` sem `spec` não une partes e não copia tags de destruição.
- Partes com espelho, com `ry` ou sozinhas não são mescladas.
- O `Reflector` renderiza a cena de novo e zera `renderer.info`; `keepInfo` (padrão `true`) soma os contadores de volta.
- Com `materialFor`, malhas de materiais diferentes nunca são mescladas.

## O que vem pela migração (spec 001)
- Fora o que vier de móveis e efeitos, nenhuma decisão do consolidado altera a API. G6 (three r128 para 0.160) já está atendido aqui (peer `^0.160`); o `RoundedBoxGeometry` entra como dependência dos `-three` que o usarem.
- Efeitos genéricos passam a viver em `game-vfx` / `game-vfx-three` (E4); fumaça, fogo e água daqui devem migrar para usá-los quando existirem.
