---
name: game-destruction-three
description: Use quando precisar desenhar em three.js a destruição do game-destruction, como amassados, furos de bala, rachaduras, carbonização, brilho de calor, derretimento, fragmentos, peças soltas, fogo, fumaça e faíscas. Termos, renderizar dano, decalque, partículas, explosão visual, specFromObject3D.
---

# @adatechnology/game-destruction-three

## Objetivo
Renderizador three.js do `@adatechnology/game-destruction`. O núcleo decide e emite eventos; este pacote os desenha nas suas malhas: amassados nos
vértices, decalques de furo e rachadura, char e brilho de calor, derretimento e poças, fragmentos com física leve, peças soltas e partículas em pool.

## Quando usar e quando não usar
- Use quando o jogo tem three.js e objetos registrados em um `DestructionWorld`.
- Não use para a regra de dano (é o `game-destruction`), nem para outra engine (escreva um adaptador próprio sobre os eventos).
- Nada é alterado no lugar: geometria e material são clonados na primeira mudança visual; `restore` e `clear` devolvem os originais.

## Como usar
```ts
import * as THREE from 'three'
import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer, specFromObject3D } from '@adatechnology/game-destruction-three'

const scene = new THREE.Scene()
const world = createDestruction({ seed: 7 })
const renderer = createDestructionRenderer(THREE, {
  scene,
  world,
  quality: 'medium',
  onPiece: (piece) => grabbable.push(piece),
  onSound: (key, point, volume) => audio.play(key, point, volume),
})

scene.add(chairModel)
const { spec, parts } = specFromObject3D(THREE, chairModel, { name: 'chair', anchorBelow: 0.01 })
const id = world.add(spec, { position: [2, 0, -3] })
renderer.bind(id, chairModel, { parts })

world.shoot([0, 1.5, 0], [0, 0, -1], 2500, 9)

function frame(dt: number) {
  world.update(dt)
  renderer.update(dt) // sempre depois de world.update
}
```
Malha fundida (prédio assado): ligue cada peça por faixa de vértices, `{ mesh, range: [v0, v1] }` (fim exclusivo); faixa inválida lança em `bind`.

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createDestructionRenderer(THREE, options)` | cria o `DestructionRenderer` (`scene`, `world`, `quality`, `maxFragments`, `maxParticles`, `groundAt`, `autoSplit`, `onPiece`, `onSound`, `explosionLight`, `pointScale`) |
| `renderer.bind / unbind` | liga um objeto do mundo à raiz three.js (`parts`, `syncTransform`) |
| `renderer.makePiece / pieces / piece / impulse` | peça física arremessável e empurrões |
| `renderer.update(dt)` | integra fragmentos, peças e partículas |
| `renderer.emit(kind, point, normal, count, speed?)` | partículas diretas (clarão de boca, espuma, faíscas de ferramenta) |
| `renderer.explode(point, energy, radius)` | desenha uma explosão sem peça que explode (granada, foguete): clarão, fogo, fumaça, luz, som e empurrão nas peças |
| `renderer.restore / clear / stats / dispose` | restaurar um objeto, limpar tudo, contagens, soltar recursos |
| `specFromObject3D(THREE, root, options?)` | gera `{ spec, parts }`: uma peça por malha, material pelo nome, juntas inferidas |
| `heatColor(temperatureC)` | cor `0xRRGGBB` do brilho: 0 abaixo de ~450 °C, vermelho ~500, laranja ~800, branco de 1400 |

`specFromObject3D` lê `userData.destructionMaterial`, `destructionPart`, `destructionIgnore`, `destructionTags` e `hollow`.

## Compõe com
- `game-destruction` (dependência): fonte de todos os eventos.
- `game-fluids-three`: vazamento e poça são do fluido; o evento `leak` aqui só desenha o fio de gotas da peça.
- `game-weapons-three`: usa o mundo de destruição nos alvos da área de armas.
- Sons: não toca nada; entrega chaves (`impact_metal`, `shatter_glass`, `explode`...) em `onSound`, que o jogo liga ao `game-audio`.

## Ambiente de teste
`examples/test-room` carrega este renderizador na sala de testes (um HTML só, `node build.mjs`); a área de destruição abre com `?area=`. Não há
`examples/` próprio do pacote.

## Cuidados
- `three` é peer (`^0.160.0`) usado só por tipos: **você passa o seu `THREE`** em `createDestructionRenderer`.
- Chame `renderer.update` depois de `world.update`, uma vez por quadro.
- Em `low`, orçamentos de partículas e fragmentos caem à metade e dentes em malhas com mais de 20 mil vértices são pulados.
- Derretimento supõe malhas em pé (escala o Y da própria malha).
- A luz da explosão é criada na primeira explosão: há uma recompilação de shader única; use `explosionLight: false` para evitar.
- `pointScale` (padrão 700) deve acompanhar a altura do viewport, senão fumaça e fogo ficam com tamanho errado.
- Queda dura de peça (acima de 3 m/s) chama `world.hit` do tipo `blunt` com `source: 'fall'`.
- `world.explode` **não emite evento** (só uma peça com `explodes` emite `explode`): quem detona granada ou foguete chama `renderer.explode` junto, senão só aparecem os detritos e o fogo, o clarão e a fumaça ficam de fora.
- Global de navegador `GameDestructionThree` já inclui o núcleo; só falta carregar o three.js.

## O que vem pela migração (spec 001)
- A explosão atual desenha (T0.3: a sala de testes passou a chamar `renderer.explode`); a troca para a explosão do Laboratório (E1) segue na Fase 5.
- Efeitos passam a vir do `game-vfx-three` (E4), com teto de 6 explosões a cada 4 s por área e menos detalhe de longe.
- Juntar as duas versões da Sala de destruição, mantendo o que cada uma tem a mais (V8).
- Concreto armado e tijolo ganham aparência de dano aqui quando entrarem em `game-destruction`.
