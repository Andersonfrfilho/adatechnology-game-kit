---
name: game-animals-three
description: Use quando precisar desenhar e animar animais no three.js, como quadrúpede, ave, cobra, vaca, cavalo, porco, cachorro, gato, galinha, urubu, jararaca, estado vivo infectado morto, andar e correr, juntas, vista aberta, pele de nós na GPU para muitos bichos, área de teste de animais. Adaptador three.js do game-animals; o three entra pelo host.
---

# @adatechnology/game-animals-three

## Objetivo
Desenhar e animar os bichos do `game-animals` no three.js: **porte literal** dos construtores dos Bichos do Vale (`quad`, `bird`, `snake`) e da animação (passos, voo, asas, cabeça, cauda, cobra ondulando),
com os três visuais (`alive`, `infected`, `dead`) para as 13 espécies, a vista de juntas, a vista aberta (cobra) e a **pele de nós** em GPU (`game-props3d`) para muitos bichos numa chamada de desenho.
O three entra pelo host (`createAnimalsThree(THREE, ...)`), nunca é importado.

## Quando usar e quando não usar
- Use para: pôr as 13 espécies numa cena, mostrar o bicho infectado ou morto, animar andar e correr, contar triângulos, desenhar dezenas de bichos como uma malha cada.
- Não use para: o catálogo e a conta da pose (`game-animals`), a regra de surto (`game-characters-undead`), bando e IA (Fase 8).

## Como usar
```ts
import * as THREE from 'three'
import { SPECIES } from '@adatechnology/game-animals-species'
import { createAnimalsThree, lineUpAnimals } from '@adatechnology/game-animals-three'

const animals = createAnimalsThree(THREE, { seed: 7 })          // a semente da página; `document` só para espécie com textura (gato, onça)
const rigs = SPECIES.map((species) => animals.build(species))
rigs.forEach((rig) => scene.add(rig.root))
lineUpAnimals(rigs)                                              // fila centrada, cada um com o espaço do seu comprimento
animals.setVisualState(rigs[0], 'infected')
animals.animate(rigs[0], { time, delta, clip: 'walk' })           // idle | walk | run
const skin = animals.createSkin(rigs[1]); scene.add(skin.mesh); skin.update() // depois de animar, a cada quadro
```

## API principal
| Função | Para que serve |
|---|---|
| `createAnimalsThree(THREE, { document?, random?, seed? })` | `build`, `animate`, `setVisualState`, `setJointView`, `setSplit`, `updateSplit`, `createSkin` |
| `lineUpAnimals(rigs, options?)` | a fila da página |
| `BIRD_EXTRAS`, `QUADRUPED_EXTRAS` | as peças que a página monta com código, por id de espécie (crina, chifre, crista...) |
| `profileGeometry`, `createCoatTexture` | o perfil do tronco e a textura do pelo (listras, rosetas) |
| `createAnimalSound(sink, { calls? })` | os chamados do jogo (`bichoSom`) no som do anfitrião: galinha, quero-quero, vaca e cachorro, com a recarga da página por bicho (`call(espécie, posição, { key })`, `update(dt)`); as outras espécies não têm som no time |
| `ANIMAL_SOUND_BANK`, `ANIMAL_CALLS` | as 4 receitas (`dog_bark`, `lapwing_call`, `hen_cluck`, `cow_moo`, traço igual ao do `bichoSom`) e a tabela espécie -> chamado |
| `createAnimalsTestModule(options)` | o módulo da área de teste (abaixo) |

## Compõe com
- `@adatechnology/game-animals` e `-species`: os dados; `@adatechnology/game-props3d`: `createNodeSkin`; `@adatechnology/game-characters-undead`: a regra de surto, que entra por `options.createOutbreak`.

## Ambiente de teste
`createAnimalsTestModule({ species, createOutbreak, document? })` entra na sala com `room.loadModule` (`examples/animals-test-area`, `?area=animals`, global `AnimalsArea`). Itens: uma espécie cada. Bancada: estado visual, andar,
velocidade da animação, regra de surto ligada ou desligada, relógio da mordida; ações morder todos, curar, chamar (usa o `host.audio` da sala), pôr 40 bichos como pele de nós; camadas: juntas, vista aberta, alcance do som, raio de atração da carcaça. Métricas: bichos,
chamadas de desenho, triângulos, nós por pele, incubando, viraram, morreram. Seis cenários conferem os estados, o andar, a regra, a carcaça, o relógio da mordida e as 40 peles.

## Cuidados
- Espécie com textura de pelo precisa de `document` (um canvas); no teste, um documento de mentira basta.
- A pele de nós guarda como nós próprios as peças que a animação mexe (`collectReferencedNodes`): rode `animate` e depois `skin.update()`.
- `Math.random` não entra: a fase inicial do passo vem do fluxo semeado.
