---
name: game-audio
description: Use quando precisar de som num jogo, como tiro, grito, gemido, explosão, chuva, motor, buzina, rádio, sirene, sons com distância e pan, limite de vozes, laços contínuos e mixagem com compressor e reverb. Receitas como dados com semente, plano puro e camada WebAudio. Termos, áudio, som, sfx, receita de som, planSound, createAudioEngine.
---

# @adatechnology/game-audio

## Objetivo
Som como dados. A receita (camadas de ruído com semente, osciladores, voz com formantes, filtros, LFO e envelope, com `sources` para cada número)
vira um `SoundPlan` com todos os números sorteados (`planSound`, puro, roda no Node), e a camada WebAudio constrói o plano. Curvas de distância
dos times, pan da Cena de Arte, oclusão opcional, limite de vozes, laços e as duas mixagens dos times. Não conhece nenhum jogo.

## Quando usar e quando não usar
- Use para tocar qualquer som sintetizado do kit e para escrever o banco de sons de um pacote (armas, destruição, personagens, bichos, clima).
- Não ponha aqui os sons de um assunto: cada pacote tem o seu banco (decisão S1). Aqui ficam só a máquina, as mixagens e a `library` temporária.

## Como usar
```ts
import { createRng, planSound } from '@adatechnology/game-audio'

const plano = planSound(receita, { random: createRng(7), distance: 12 }) // null se longe demais
```

## API principal
| Função / tipo | Para que serve |
|---|---|
| `SoundRecipe`, `Layer`, `LoopRecipe`, `SoundBank` | O formato dos dados (ver `src/recipe.ts`) |
| `planSound(receita, { random, volume, distance \| position, listener, params, occlusion })` | O plano resolvido; ordem de sorteio: `vars`, `duration`, cada camada na ordem dos campos, início do ruído por último |
| `DISTANCE_CURVES`, `falloffGain`, `isSilent`, `cutoffDivisor` | Curvas dos times (jogo 0.004/0.006/0.01/0.002, Cena 0.008, bichos 70 m) |
| `panFor`, `listenerDistance` | Pan da Cena (±0.85, mínimo 2 m), distância no chão ou 3D |
| `createVoiceManager({ groups, maxVoices })` | Limite de vozes: grupos (concorrência, recarga, distância, roubo) e teto global 32 |
| `createLoopState(receita)` | Laço do jogo: nós a partir de 0.002, suavização 0.15 / 0.08 |
| `createSoundRegistry(bancos)`, `resolveMix` | Catálogo com `register`, `patch`, `remove`; perfil de mixagem |
| `GAME_SFX_CLASSES`, `noiseClassRecipe`, `GAME_SFX_BANK` | As 12 classes de ruído do jogo (tabela `P`) e a receita `burst` de cada uma |
| `MIX_PROFILES`, `DEFAULT_MIX` | `game` (mestre 0.5) e `art_scene` (compressor, reverb; padrão do kit, Q1) |
| `VOICE_GROUPS` | `undead_voice`: 5 ao mesmo tempo, um a cada 0,25 s, só a menos de 40 m |
| `createAudioEngine({ seed, mix, banks, maxVoices, createContext })` | Motor WebAudio preguiçoso (sem `AudioContext` até o primeiro som; no Node tudo menos `plan` é no-op): `play`, `plan`, `loop`, `channel`, `setMix`, `setMaster`, `setBus`, `setListener`, `unlock`, `stats`, `level(bus)`, `dispose` |
| `createAudioSink(engine)` | `AudioSink` do contrato (`host.audio`) que carrega o motor em `.engine`: quem recebe o sink usa o motor do anfitrião |
| `createAudioTestModule(options?)` | `TestableModule` `audio_area`: toca qualquer som a uma distância e direção (ou da sonda na área), laços, tempestade de 20 vozes, mixagem e camadas (reverb, compressor, pan, abafamento), nível de cada barramento e o plano do som. `BENCH_BANK` tem os dois sons de prova do próprio módulo |
| `sceneNoise`, `sceneTone`, `sceneVoice`, `sceneMany`, `sceneRecipe` | As primitivas da Cena de Arte (`sNoise`, `sTone`, `voice`) como camadas de receita, na ordem de sorteio da página: quem porta um `sfx.*` da Cena monta a receita com elas (materiais, vozes, ferimentos) |
| `LIBRARY_BANK` | Casa temporária (Q12): laços `engine_saw`, `rotor_blades`, `crowd_rumble`; `horn`, `radio_static`, `siren` |

## Compõe com
`game-contracts` (`AudioSink`, `ModuleHost.audio`). Os bancos de som são de cada pacote: `game-weapons-three` (ordem `weapon`, `createWeaponAudio` é adaptador), `game-destruction-three` (`createDestructionSound`, sons dos materiais e laço de fogo); `game-characters-three` (`createCharacterSound`: vozes dos 13 tipos, ferimento, o que o jogador ouve) e `game-animals-three` (`createAnimalSound`: os 4 chamados); `game-weather` virá.

## Ambiente de teste
`examples/audio-test-area` carrega o módulo na sala (`AudioArea.loadInto(room)`, página `sala-som.html`) e tem teste no navegador (4 cenários, tocar, laço). `pnpm --filter @adatechnology/game-audio test` (vitest: plano, curvas, pan, limite de vozes com o golden das regras dos times, laços, banco).

## Cuidados
- A ordem dos campos da receita é a ordem do sorteio: trocar dois campos de lugar muda o som de uma semente.
- `order` escolhe a ordem de criação dos nós do realizador; cada uma é a de uma rotina do time, para o trace bater nó a nó.
- A ordem de construção `weapon` (camada de ruído filtrado ou oscilador, ganho próprio, direto no barramento) é a das armas; `to: 'from'` e `{ from }` sem `to` reproduzem a Cena (rampa de volta ao início, ou só `setValueAtTime`).
- `undead_voice` com `maxConcurrent: 5`: a Cena recusa com `AU.groans > 4`, então toca até cinco ao mesmo tempo.
