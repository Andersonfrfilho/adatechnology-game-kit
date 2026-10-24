---
name: game-player
description: Use quando precisar do corpo do jogador num jogo, como fôlego, corrida, agachar, vida a partir da ficha (força, vigor, agilidade, percepção, intelecto, presença), feridas que sangram, curativo, ser agarrado e se soltar com empurrões ou faca, ser derrubado, pular muro baixo, ruído dos passos, pânico, empurrão e golpe corpo a corpo, e infecção individual opcional. Puro e determinístico por semente, sem three.js nem som. Termos, jogador, player, fôlego, stamina, ferida, agarrão, createPlayer.
---

# @adatechnology/game-player

## Objetivo
O corpo do jogador, porte literal do jogo do time (`jogo.js` G 68427-68640: `player`, `playerUpdate`, `frontZombies`, `shove`, `knife`, com `FICHA`, `DERIV`,
`INFEC`, `FERIDA`). Todo número está em `src/data/defaults.json` com a linha de origem. Emite eventos (`noise`, `sound`, `message`, `hurt`, `died`...) e
quem desenha, toca e mostra é o jogo.

## Quando usar e quando não usar
- Use para o jogador de qualquer jogo em primeira ou terceira pessoa: vitais, ferida, agarrão, derrubada, ruído de passos para a IA ouvir.
- Não use para desenhar o corpo (`game-characters-three`), para a câmera (`game-camera`) nem para a multidão (`game-crowd`, que implementa `PlayerCrowd`).
- Mundo normal primeiro: a infecção individual vem **desligada**; `infection: true` liga a regra do jogo.

## Como usar
```ts
import { createPlayer, playerTextOf } from '@adatechnology/game-player'

const player = createPlayer({ seed: 7, attributes: { agility: 7 }, infection: false, world: { solidAt, cellKind, inWater, crowd } })
player.on('noise', (n) => crowd.emitNoise(n.x, n.z, n.radius))
player.on('sound', (s) => host.audio?.play(s)) // 'step' | 'flesh'
player.on('message', (m) => hud(playerTextOf(m.id, 'pt-BR'), m.seconds))
player.update(dt, { forward, right, run, aim, yaw, bandage, pressed: { crouch, push, knife, vault, throw: t } })
```

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createPlayer({ random, seed, attributes, derived, wounds, infection, numbers, fist, position, world })` | O corpo: `update`, `hurt`, `bite`, `grab`, `release`, `knock`, `infect`, `die`, `stage`, `timeLeft`, `spreadFactor`, `front`, `on`, `save`, `load`, `setWorld` |
| `PLAYER_DEFAULTS` | Os números do jogo com `sources` (ficha, derivados, feridas, infecção, números do `playerUpdate`, soco) |
| `deriveVitals(atributos, fórmulas)` | `DERIV` como dado: vida 100, fôlego 90, corrida 5,8 m/s, ruído 0,8, compostura 55 na ficha 5 |
| `drawWound(tabela, random)` | Sorteio da ferida na ordem do jogo (arranhão 60%, laceração 30%, mordida 10%) |
| `PlayerCrowd`, `PlayerWorld` | O que o jogador pede da multidão e do mundo (callbacks) |
| `playerTextOf(id, locale)`, `PLAYER_TEXT` | As frases do jogo (pt-BR) e em inglês, por id |
| `createPlayerTestModule(options)` | Módulo `player_area` da sala de testes |

## Compõe com
`game-crowd` (implementa `PlayerCrowd`; a multidão ouve o `noise`), `game-weather` (`footstepScale` multiplica o raio do `noise`), `game-audio` (`host.audio`
toca `step` e `flesh`), `game-characters-undead` (dados da infecção zumbi), `game-stories` (a ficha do personagem).

## Ambiente de teste
`pnpm --filter @adatechnology/game-player test`: o golden `game-player.json` (18 roteiros do código do jogo em `node:vm`, gravados por
`pnpm --filter @adatechnology/characters-catalog-tool golden:vm`) é refeito quadro a quadro, mais testes da ficha, das feridas e da bancada.
`examples/player-test-area` (`sala-jogador.html`) carrega a bancada: a câmera da sala é o jogador; golpe, mordida, agarrão, empurrão, faca, curativo, derrubada,
infecção ligada ou não, agilidade e vigor. Também vai junto em `examples/interactables-test-area`.

## Cuidados
- `pressed` vale só no quadro em que a tecla desceu, como o `wasPressed` do jogo: dentro do agarrão o E e o F são gastos ali.
- A morte por queimadura sem sangrar mostra "Fome e sede" (`hunger_thirst`), como no jogo.
- Sem `crowd` não há agarrão de verdade, empurrão nem golpe: os eventos saem, mas não há em quem bater.
- Passe o mesmo `random` que o jogo usa para o resto se a ordem dos sorteios importar entre sistemas.
