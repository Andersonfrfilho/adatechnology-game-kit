---
name: game-fluids-three
description: Use quando precisar desenhar em three.js os líquidos do game-fluids, como líquido dentro do copo ou garrafa, jato com gota na ponta, poça que cresce, superfície molhada que reflete e seca, vapor e respingos. Termos, renderizar líquido, mancha, poça, molhado, bindContainer.
---

# @adatechnology/game-fluids-three

## Objetivo
Renderizador three.js do `@adatechnology/game-fluids`. Só **lê o estado** da simulação, então desenha exatamente o que o mundo determinístico diz
(um cliente de LAN com o mesmo estado vê os mesmos líquidos). Desenha: líquido dentro de cada recipiente (formato interno cortado pelo plano da
superfície, sempre horizontal), jatos com gota na ponta, manchas em leque a partir das 16 amostras da frente de fluxo, brilho de molhado que recua
ao secar, vapor e gotas de respingo.

## Quando usar e quando não usar
- Use quando o jogo tem three.js e um `FluidWorld`.
- Não use para a simulação (é o `game-fluids`). O renderizador nunca altera o mundo; apenas escuta eventos `splash`.
- Material padrão, sem transmissão, poucas chamadas de desenho, orçamento fixo por qualidade.

## Como usar
```ts
import * as THREE from 'three'
import { createFluids } from '@adatechnology/game-fluids'
import { createFluidRenderer } from '@adatechnology/game-fluids-three'

const fluids = createFluids({ seed: 7 })
fluids.addSurface({ id: 'floor', point: [0, 0, 0], normal: [0, 1, 0], halfSize: [10, 10], porosity: 0.05 })
fluids.addContainer(
  { capacity: 0.25, liquid: 'coffee', liters: 0.25, temperature: 90, shape: { kind: 'cylinder', radius: 0.04, height: 0.1 }, opening: 0.04 },
  { id: 'cup' },
)

const view = createFluidRenderer(THREE, { scene, fluids, quality: 'medium', envMap })
view.bindContainer('cup', cupObject, { innerOffset: [0, 0.005, 0] }) // fundo interno, no espaço do objeto

// a cada quadro
const inner = cupObject.localToWorld(new THREE.Vector3(0, 0.005, 0))
const rotation = cupObject.getWorldQuaternion(new THREE.Quaternion())
fluids.setTransform('cup', [inner.x, inner.y, inner.z], [rotation.x, rotation.y, rotation.z, rotation.w])
fluids.update(dt)
view.update(dt) // sempre depois de fluids.update
```
Quando o objeto do recipiente é destruído: `view.unbindContainer(id)` e `fluids.removeContainer(id)`; as manchas no chão ficam e secam sozinhas.

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createFluidRenderer(THREE, options)` | `FluidRenderer`; opções `scene`, `fluids`, `quality` (`low`, `medium`, `high`), `envMap`, `pointScale` (padrão 600) |
| `view.bindContainer(id, object3D, { innerOffset? })` | desenha o líquido do recipiente dentro do objeto, mais o vapor |
| `view.unbindContainer(id)` | remove esse líquido |
| `view.update(dt)` | avança os visuais |
| `view.clear()` | remove manchas, jatos e partículas (as ligações ficam) |
| `view.dispose()` | tira tudo da cena e libera geometrias e materiais |
| `view.stats()` | `{ quality, containers, streams, stains, particles, triangles, budget }` |
| `smoothOutline(front, subdiv)` | Catmull-Rom periódica usada na borda da mancha |
| Tipos | `FluidRenderer`, `FluidRendererOptions`, `FluidRendererStats`, `BindOptions`, `FluidQuality`, `ThreeLib` |

Orçamentos (baixo, médio, alto): manchas 24 / 48 / 96, jatos 12 / 24 / 48, partículas 96 / 256 / 512. Com mais manchas no mundo que o orçamento, as mais novas são desenhadas.

## Filme que escorre (`film/*`)
- `createFilmManager(THREE, { scene, camera, random, fluids?, gpu?, surfaceAt?, groundAt?, budgetMs?, range?, maxGrids? })`: desenha o filme de `game-fluids` (sangue, sangue antigo, bile, óleo, combustível) com o shader do Padrão de Fluidos, **transparente sobre a superfície do jogo**. Guarda no máximo 6 grades de 2 x 2 m (160 x 160 células), só a 30 m do jogador, simula dentro de um orçamento em ms por quadro e sobe só o retângulo sujo (`gpu` = o `WebGLRenderer`, `copyTextureToTexture`). A grade longe, parada (20 s) ou espremida vira decalque (`fluids.splash` com `tint`) e é liberada.
- `launch({ fluid, point, velocity?, radius?, tint? })` (cria a grade sob a gota), `drip({ fluid, point, every })`, `setWeather({ rain })` (gancho da Fase 6), `update(dt)`, `stats()`, `clear(bake?)`.
- `createFilmBridge({ fluids, manager, random })`: o `leak` de líquido com filme joga gotas do furo até o fim do jato; `splat({ fluid, point, direction, tint })` é o que o `body` dos personagens chama (T5.3e: `createFluidsBridge({ film })` do `game-characters-three` repassa o `wound`, o corte, o estouro e a divisão com as cores da idade da infecção; a sala empresta a ponte em `room.film`).

## Compõe com
- `game-fluids` (dependência): fonte do estado; o global de navegador `GameFluidsThree` embute só os poucos helpers usados, então carregue também `GameFluids` para criar o mundo.
- `game-destruction-three`: o recipiente pode ser uma peça destruível; o líquido sai pelos furos via `puncture`.
- `game-weather-three` (futuro): superfícies molhadas e chuva sobre as poças.

## Ambiente de teste
Sem `examples/` próprio. `examples/test-room` embute este renderizador (`node build.mjs` gera um HTML único). Testes do pacote em `packages/game-fluids-three/tests`.

## Cuidados
- `three` é peer (`^0.160.0`); **passe o seu `THREE`**. Só alguns membros são usados (`Mesh`, `InstancedMesh`, `Points`, `ShaderMaterial`, `MeshStandardMaterial`...), veja o tipo `ThreeLib`.
- `innerOffset` é o fundo interno do recipiente no espaço do objeto; o `fluids.setTransform` precisa receber **esse ponto em coordenadas de mundo** e a rotação do objeto. Escala não uniforme não é suportada.
- Chame `view.update(dt)` depois de `fluids.update(dt)`.
- Para as superfícies molhadas refletirem, passe `envMap` ou defina `scene.environment`.
- Manchas ficam um fio acima da superfície (`polygonOffset`, orientadas pela normal); mancha seca é um retalho fosco fraco.
- `pointScale` ≈ metade da altura do canvas em pixels; ajuste se o viewport for muito diferente.
- Tudo é adicionado num único grupo `fluid_renderer` na cena.

## O que vem pela migração (spec 001)
- Aparência do filme que escorre, do respingo por ângulo, da bile e do sangue antigo que entram no `game-fluids` (E2).
- Feito (T5.3c): o filme roda na CPU só perto do jogador e sobe só o retângulo sujo; a GPU (ping-pong) fica para depois, atrás de `FilmSimulator`.
- Efeitos compartilhados passam a usar o `game-vfx-three` (E4); chuva do `game-weather` espalha sangue e impede secar (E6).
