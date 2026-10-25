---
name: game-characters-three
description: Use quando precisar desenhar personagens no three.js, como corpo instanciado de multidão, horda de zumbis, LOD, assar corpo, variantes, membro arrancado voando, lote de corpos na GPU, pose na GPU. Adaptador three.js do game-characters; o three entra pelo host.
---

# @adatechnology/game-characters-three

## Objetivo
Desenhar os corpos do `game-characters` no three.js. O três é passado pelo host (`createX(THREE, ...)`), nunca importado, então serve em bundler e em `<script>`.
Caminho **instanciado** (porte literal do corpo do jogo): `buildInstancedBody` (16/10/5 segmentos), `BODY_CHUNK` (a pose dos 12 ossos na GPU, byte a byte do jogo), `createBodyMaterial`, `createBodyBatch`, `bakeBody`/`bakeVariants` (regra ZVAR), `createFlyingLimbs` (40 pedaços).
Caminho **rico** (de perto): `createBestBuilder` (Bestiário v17, 13 tipos), `createPersonBuilder` (sobreviventes com 62 acessórios, chapéus, rosto e mãos), `createRigAnimator` (andar, cascata, pose), `createWounds` (corte, osso quebrado que balança, membro que voa, estouro, decalque de entrada e saída), `findEyes` (olhos que apagam) e `createFluidsBridge` (o sangue vai para o `game-fluids`; com `film` os eventos `body` `wound`, `severed`, `destroyed` e `split` jogam gotas no filme que escorre, nas cores do `BloodLook` do corpo; `bloodLookOfAge(idade)` lê `ages.json`, e `old_blood` para as idades de pouco sangue; `body.blood` guarda o olhar de cada corpo).

## Quando usar e quando não usar
- Use para: horda de dezenas a milhares de corpos em poucas chamadas; membros arrancados; corpos assados por variante.
- Não use para regra de dano ou andar em números (é o `game-characters`).

## Como usar
```ts
import * as THREE from 'three'
import { buildInstancedBody, createBodyBatch, createFlyingLimbs, lodAt } from '@adatechnology/game-characters-three'

const time = { value: 0 }
const batch = createBodyBatch(THREE, buildInstancedBody(THREE, { segments: 10 }), { max: 700, time })
scene.add(batch.mesh)
batch.begin(); batch.push({ a: [x, z, yaw, fase], b: [altura, porte, passada, pose], c: [mascara, infeccao, bracos, pele], color, eye }); batch.end()
const limbs = createFlyingLimbs(THREE, { random, effects: { onSplat } })
limbs.launch({ x, z, kind: 'leg', color, blood: { color, dried, bleeds: true } })
```

## API principal
| Função | Para que serve |
|---|---|
| `buildInstancedBody(THREE, { segments, body? })` | geometria única do corpo; `body` (BodySpec) move as juntas |
| `createBodyChunk({ hipHeight? })` / `BODY_CHUNK` | o trecho de shader |
| `createBodyBatch(THREE, geometria, { max, time })` | lote instanciado: `begin`/`push`/`end` |
| `bakeBody(THREE, builders, spec, lod)` / `bakeVariants` | assa um corpo rico numa malha instanciável; variantes por tipo |
| `lodAt(distancia)` | 0, 1 ou 2 (18 m e 55 m) |
| `createFlyingLimbs(THREE, { random, effects })` | membros que voam, quicam e ficam; `onLaunch`/`onSplat` ligam o sangue |

## Som (`audio/*`)
`createCharacterSound(sink, { style?, voices?, body? })` (o `sink` é o `host.audio`; registra o banco no motor): `voice(tipo, 'idle' | 'alert' | 'special', posição)`, `body(evento, posição)` (ferimento = `flesh`/`flesh_head`, corte = `sever`, estouro e divisão = `gore`), `player('grab' | 'bite' | 'hurt')`, `update(dt)` (a sequência do Gritador: inspira, 1,5 s depois grita).
`CHARACTER_SOUND_BANK` tem as 16 receitas, todas com o traço igual ao do código do time (`tests/audio.test.ts` contra `tools/golden/fixtures/audio`): do jogo `scream_hoarse`, `groan`, `runner_groan`; da Cena `groan_walker`, `groan_runner`, `groan_brute`, `scream`, `inhale`, `leap`, `grab`, `bite`, `hurt`, `flesh`, `flesh_head`, `sever`, `gore`.
`UNDEAD_VOICES` (`voices.json`) diz quem fala o quê nos 13 tipos: `origin` `team` (a página tem som para o tipo: Lento, Corredor, Brutamonte, Gritador, Saltador), `rule` (a regra da Cena aplicada: Brutamonte, velocidade de perseguição acima de 3,4 é corredor, o resto é lento) ou `extra` (som da página mais perto do texto de voz do `types.json`: Farejador inspira, Devorador morde; escolha do kit). Os gemidos estão no grupo `undead_voice` do motor (cinco ao mesmo tempo, um a cada 0,25 s, a menos de 40 m). `createWounds({ sound })` toca o ferimento onde o segmento estava.

## Ambiente de teste
`createCharactersTestModule({ packs, undeadTypes, professions, createUndead, fluids?, film?, bloodOf?, sound? })` (`examples/characters-test-area`, `?area=characters`, global `CharactersArea`): os 13 tipos e as profissões como `DestructibleImpl` que a sala atinge, fileira de tiro com 5, multidão instanciada.
Antes de carregar, `registerBodyMaterial(room.world)` põe o material `flesh` no mundo. Bancada: decomposição, faixa de idade, modelo de penetração, regra de morte, detalhe, momento, pose, cascata, golpe, proteção; ações: disparar o golpe, curar, matar, morder (acelerado), pôr 100 ou 1000 na multidão; camadas: cápsulas, juntas, sangramento, só olhos, vetores de velocidade; 11 cenários.

## Corpo do jogador
- `createPlayerAvatar(THREE, options?)` é o corpo do jogador do jogo da equipe (humano do Bestiário, `presets/player-avatar.json`). `update(dt, { speed, crouch, down, armed, pitch, hip })` anda com a velocidade do chão, agacha, derruba (caído) e arma o braço de mira (`(pitch + 1) / 3`).
- `hand('R' | 'L')` devolve o soquete da mão (a arma vai na R, em -x). `play(clip, { onEvent })` sobrepõe um `PoseClip` (`channels: 'upper'` deixa as pernas para a passada) e dispara `impact` e `phase` uma vez; `stop()` volta.
- `toRoomAvatar(player)` adapta o corpo para `room.setAvatar`, e `createAvatarTestModule({ avatar, camera, state })` é a área `avatar_area` (`AVATAR_AREA_ID`) no `game-test-room`: 1ª/3ª pessoa, agachar, cair, armar e os clipes registrados.

## Notas
- O lado é decidido pelo sinal de x (osso 2/4/7/9 em x negativo), qualquer que seja o nome no spec.
- O `buildInstancedBody` com `GUIDE` é um desvio assumido (P1): as juntas seguem o spec, os tamanhos das peças seguem as distâncias entre juntas.
- Geometria: os construtores desenham com `shapeGeometries(host)` do `game-shapes-three` (os mesmos bytes do three); `tests/exact-golden.test.ts` guarda cada bit das pessoas, acessórios, corpos do Bestiário, bakes e corpo instanciado.
