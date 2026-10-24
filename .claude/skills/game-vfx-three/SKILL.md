---
name: game-vfx-three
description: Use quando precisar desenhar explosões, fogo, fumaça, estilhaços, ondas de choque, marcas no chão e clarão de tela com three.js a partir do game-vfx. Traz os shaders do Laboratório de Explosões, luzes, chão deformável e um EffectSink para emprestar aos módulos.
---

# @adatechnology/game-vfx-three

## Objetivo
O renderizador three.js do `game-vfx`: bolas de fogo e fumaça com rampa de calor posterizada e dissolução por ruído, estilhaços riscados, halos aditivos,
casca e anel da onda de choque, detritos em brasa, luzes de explosão e de fogo, marcas (queimado, terra, pedras da borda, sangue) que acompanham o chão
e o clarão de tela. Implementa o `EffectSink` do `game-contracts`, para o jogo pedir um efeito por id.

## Quando usar e quando não usar
- Use para: mostrar o que o `VfxWorld` simula, emprestar `host.effects` aos módulos, tremer a câmera ao redor do render.
- Não use para a simulação (é o `game-vfx`) nem para líquidos (`game-fluids-three`).

## Como usar
```ts
import * as THREE from 'three'
import { createVfxRenderer, createGroundPatch } from '@adatechnology/game-vfx-three'

const vfx = createVfxRenderer(THREE, { scene, camera, overlay: container, vfx: { profile: 'high', seed: 1, ground } })
vfx.play({ effect: 'm67', point: [0, 0.1, 0] })        // handle ou null
vfx.update(dt)                                          // todo quadro: avança o mundo e redesenha
const restore = vfx.applyCamera(); gl.render(scene, camera); restore()
```

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createVfxRenderer(THREE, options)` | `VfxRenderer`: `world`, `play`, `stop`, `configure`, `catalog`, `update`, `applyCamera`, `stats`, `screen`, `dispose`; opções `scene`, `camera`, `vfx` (mundo ou opções), `quality`, `overlay`, `reducedMotion`, `createCanvas`, `lightDirection`, `lightScale` |
| `createGroundPatch(THREE, { field })` | malha do chão de 60 m que segue um `GroundField` (`sync()` redesenha quando mudou) |
| `createScreenOverlay(container)` | clarão e bordas de tela dentro do contêiner do host |
| `createMarkLayer`, `PUFF_*`, `SPARK_*`, `GLOW_*`, `SHELL_*`, `RING_*` | camada de marcas e os shaders |

## Compõe com
- `game-vfx` (a simulação), `game-contracts` (`EffectSink`), `game-test-room` (cria um renderizador e empresta o mundo e o sink; T5.1g), `game-destruction-three` e `game-fluids-three` (usarão o mesmo mundo).

## Ambiente de teste
`vfx-test-area` (T5.2e): módulo de bancada com a lista de explosões e a ficha. Em Node, passe `createCanvas` para as texturas das marcas.

## Cuidados
- Shaders são os do Laboratório (r128) com um ajuste só: `colorspace_fragment`. Não "melhore" o código GLSL: o golden confere a cena.
- Luzes: cores cruas do Laboratório e `lightScale` (π) porque as luzes do r160 são físicas.
- Um mundo compartilhado é avançado só por quem chama `update` do renderizador; os outros apenas leem.
- Marcas de chão são criadas no instante do evento (acompanham o chão daquele momento); não as reconstrua depois.

## O que vem pela migração
Goldens da cena (T5.1e), troca de `game-destruction-three`, `game-fluids-three`, `game-weapons-three` e da sala de testes para o mundo compartilhado (T5.1f e T5.1g), pontos de sprite da Oficina, módulo de bancada e `vfx-test-area` (T5.2).
