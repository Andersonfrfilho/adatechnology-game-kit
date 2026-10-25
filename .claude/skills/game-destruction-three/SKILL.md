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
  onSound: (key, point, volume) => audio.play(key, point, volume), // ou createDestructionSound(engine).onSound, que traduz as chaves para as receitas do game-audio
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
| `createDestructionRenderer(THREE, options)` | cria o `DestructionRenderer` (`scene`, `world`, `quality`, `maxFragments`, `maxParticles`, `groundAt`, `autoSplit`, `onPiece`, `onSound`, `vfx`, `camera`, `pointScale`) |
| `renderer.bind / unbind` | liga um objeto do mundo à raiz three.js (`parts`, `syncTransform`) |
| `renderer.makePiece / pieces / piece / impulse` | peça física arremessável e empurrões |
| `renderer.update(dt)` | integra fragmentos, peças e partículas |
| `renderer.emit(kind, point, normal, count, speed?)` | partículas diretas (clarão de boca, espuma, faíscas de ferramenta) |
| `renderer.explode(point, energy, radius, options?)` | desenha uma explosão sem peça que explode (granada, foguete): o efeito (`options.effect`, senão `generic` na escala do raio) do mundo de efeitos, som e empurrão nas peças; `visual: false` deixa só empurrão e som |
| `renderer.restore / clear / stats / rebarCount / dispose` | restaurar um objeto, limpar tudo, contagens (`rebarCount`: vergalhões à mostra), soltar recursos |
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
- Explosão e fogo de peça queimando vêm do mundo de efeitos (`game-vfx`): passe o `vfx` que o jogo compartilha (e passe o `update` dele uma vez por quadro, pelo `VfxRenderer`); sem `vfx` o renderizador cria o próprio mundo e a própria camada three e os atualiza em `update`. A luz da explosão é do mundo de efeitos (a opção `explosionLight` saiu).
- Detritos, faíscas, gotas e vazamentos ainda usam o pool de pontos do pacote (`particles.ts`): ele sai quando o `game-vfx` ganhar o pool de sprites compartilhado (T5.2a).
- `pointScale` (padrão 700) deve acompanhar a altura do viewport, senão fumaça e fogo ficam com tamanho errado.
- Queda dura de peça (acima de 3 m/s) chama `world.hit` do tipo `blunt` com `source: 'fall'`.
- `world.explode` **não emite evento** (só uma peça com `explodes` emite `explode`): quem detona granada ou foguete chama `renderer.explode` junto, senão só aparecem os detritos e o fogo, o clarão e a fumaça ficam de fora.
- Solo (`settle`): os filhos do nó raiz vão para um grupo `destruction-soil` com o recalque e a inclinação (`ObjectState.soil.offset`); o nó raiz fica com a pose do host. Não reposicione os filhos do nó raiz por fora depois disso.
- Global de navegador `GameDestructionThree` já inclui o núcleo; só falta carregar o three.js.

## O que vem pela migração (spec 001)
- A explosão do Laboratório (E1) e o fogo de peça já vêm do `game-vfx` (T5.1f), com teto de 6 explosões a cada 4 s por área e menos detalhe de longe. Falta trocar os detritos pelo pool de sprites e apagar `particles.ts`.
- Juntar as duas versões da Sala de destruição, mantendo o que cada uma tem a mais (V8).
- Concreto armado e tijolo (T2.3b): `spall` vira remendo da cor do núcleo, `stage` 2 solta os fragmentos do tamanho da peça (furos em `marks` vão junto), `expose` desenha o vergalhão em cilindros instanciados. **Falta para a T2.4c**: abrir a abertura na malha da parede (colapsar a faixa de vértices por peça do `bind`, cortar o buraco nas duas faces), fiadas de tijolo instanciadas no LOD0 e a normal exata do remendo de lasca (hoje o eixo fino da caixa do mundo).
