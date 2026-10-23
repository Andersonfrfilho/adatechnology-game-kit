---
name: game-camera
description: Use quando precisar de câmera de jogo three.js - ombro, terceira pessoa ou primeira pessoa, com colisão de parede e viewmodel da arma. Termos - câmera, terceira pessoa, primeira pessoa, câmera de ombro, viewmodel, rig de câmera.
---

# @adatechnology/game-camera

## Objetivo
Rig de câmera com três modos (`shoulder`, `third`, `first`) e ajuda para a arma na primeira pessoa. O jogo informa onde está o alvo (posição,
yaw, pitch, mirando, agachado) e, se quiser, como colidir com o mundo; o rig posiciona a câmera. Não conhece nenhum jogo.

## Quando usar e quando não usar
- Use para seguir um personagem em ombro/terceira/primeira pessoa, com a haste da câmera encurtando junto à parede.
- Não use para câmera livre de debug (é `dev.flyCamera` do `game-devtools`) nem para o controle de mouse/teclado: o jogo calcula yaw e pitch.
- Não traz detecção de colisão própria: passe `collide` (e `ceiling`) do seu mundo.

## Como usar
```ts
import * as THREE from 'three'
import { create } from '@adatechnology/game-camera'

const rig = create(THREE, { storageKey: 'meu-jogo-camera', locale: 'pt-BR' })
rig.selector(document.querySelector('#menu')!) // <select> pronto (opcional)

// todo quadro
rig.update(
  camera,
  { x, y, z, yaw, pitch, aiming, crouching },
  dt,
  (ox, oy, oz, dx, dy, dz, max) => distanceToWallOrNull, // opcional
  (x, z, y) => ceilingHeight, // opcional
)
if (rig.isFirstPerson()) rig.viewmodel(weaponGroup, camera) // esconder o corpo do jogador é com o jogo

rig.cycle() // próximo modo
rig.flipSide() // troca o ombro
rig.setMode('third')
rig.onChange((mode) => console.log(mode))
```

## API principal
| Função / tipo | Para que serve |
|---|---|
| `create(THREE, options?)` | Cria o `CameraRig` (`THREE` só precisa de `Vector3` e `Quaternion`) |
| `rig.update(camera, target, dt, collide?, ceiling?)` | Posiciona a câmera neste quadro |
| `rig.setMode / cycle / flipSide / onChange` | Modo, ordem de ciclo, lado do ombro, assinatura |
| `rig.viewmodel(group, camera)` | Cola a arma (cano em +z) à câmera |
| `rig.selector(parent, label?)` | `<select>` localizado ligado ao rig |
| `rig.mode`, `side`, `config`, `isFirstPerson()` | Estado e configuração mesclada |
| `DEFAULTS` | Valores padrão (`shoulder`, `third`, `first`, `viewmodel`, `wallClearance`, `minDistance`) |
| `CameraOptions`, `CameraTarget`, `CollideFn`, `CeilingFn`, `CameraMode` | Tipos |
| `locales`, `resolveStrings` | Rótulos `en` e `pt-BR` |

Opções: `modes` (ordem; o primeiro é o inicial), `labels`, `shoulder`, `third`, `first`, `viewmodel`, `wallClearance`, `minDistance`,
`storageKey` (`null` desliga a persistência), `locale`. Objetos aninhados são mesclados um nível sobre o padrão.

## Compõe com
`game-devtools` (voo livre troca a câmera pela do dev), `game-weapons` (o grupo da arma passa a `viewmodel`), `game-test-room` (que tem a
própria câmera em primeira pessoa). O `collide` é função do host: ligue-a ao raycast do seu mundo.

## Ambiente de teste
`pnpm --filter @adatechnology/game-camera test` (vitest, pasta `tests/`). Para ver o rig, ligue-o a um jogo de exemplo e use `rig.selector`.

## Cuidados
- Convenção: yaw 0 olha para -z; pitch positivo olha para baixo; cano da arma em +z.
- `config.smoothing` existe, mas o rig **não o lê** hoje; o único amortecimento é a recuperação da haste depois de uma parede (encurta na hora,
  volta com easing).
- Com `storageKey` o modo fica no `localStorage`; falha de acesso é ignorada. Em teste, passe `storageKey: null`.
- Modo desconhecido em `setMode` é ignorado.
- `collide` devolve a distância ao obstáculo ou `null`; o rig lança três raios (centro e ±0,2 lateral).

## O que vem pela migração (spec 001)
Decisão V7: a câmera de ombro do jogo (amortecimento e FOV por zoom) é melhor que a do pacote e deve ser portada para o `game-camera`, o que
fará o `smoothing` valer. Ainda não está no código. Detalhes de nomes antigos (`CameraModosSDK`) em `packages/game-camera/MIGRATION.md`.
