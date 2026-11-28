# @adatechnology/game-player

Pure, seeded player body for games: vitals from an attribute sheet, stamina, wounds and bleeding, an optional individual infection, being grabbed and breaking free, knock-downs, low-wall vaults, footstep noise, panic, shove and melee against any crowd. A literal port of the team game's player. Knows nothing about any game.

API completa: `packages/game-player/README.md`.

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
| `createPlayerHud`, `createDeathScreen`, `playerHudViewOf` (`./hud`) | HUD do corpo em DOM sem three.js (vida, fôlego, fome, sede, sangramento, infecção, ferimentos, arma e munição, nome, mensagens, mira em 1ª pessoa) e a tela de morte ("Você morreu", tempo sobrevivido, "Reiniciar cena" com Enter/R, "Voltar ao início"); pt-BR e en |
| `player.use(efeito)`, `applyItemEffect`, `createBodyVitals`, `advanceNeeds`, `nourish`, `NEEDS_DEFAULTS` | Fome e sede (porte do `needs` do jogo do time, G 57255-57344): 0 alimentado a 100, começam em 20, sobem no relógio do jogo (1 h = 50 s; fome 2,5/h, 4/h correndo, sede 4/h, × 1,1 − 0,02 × vigor), acima de 90 tiram 0,2 de vida/s (morte `hunger_thirst`). O efeito do item (`ModuleItemUse.effect`) alimenta pela saciedade e hidratação do próprio item, `heal` cura, `stop_bleeding` estanca, `clean_wound` limpa a última ferida, `calm` tira o pânico. `createBodyVitals` é o mesmo corpo para quem não usa `createPlayer` (a sala de teste); `createVitalsPanel` (`./hud`) é a caixa do corpo sozinha |
| `createPlayerTestModule(options)` | Módulo `player_area` da sala de testes |
| `planHands`, `drawBackOf`, `interactionHandsFor`, `HANDS_DEFAULTS` | Mãos e coldre (dono, 2026-11-24): uma mão usa a mão livre e a arma fica; duas mãos guardam a arma no coldre/bandoleira que couber ou a soltam no chão; arma de duas mãos sempre sai; o guardado volta à mão no fim, o que caiu fica. Mãos e lugar de cada arma: `weaponHandsOf` (`game-weapons`) |
| `liftCheckFor`, `LIFT_DEFAULTS`, `BELT_SLOT` | Levantar com as mãos (dono, 2026-11-27): a massa (do material) contra a força, vezes a alavanca do tamanho (multiplicador horizontal da NIOSH); `too_bulky` empurra ou arrasta (sofá 45 kg), `too_heavy` nem isso. Segunda arma de uma mão vai para o cinto, não cai |

## Compõe com
`game-crowd` (implementa `PlayerCrowd`; a multidão ouve o `noise`), `game-weather` (`footstepScale` multiplica o raio do `noise`), `game-audio` (`host.audio`
toca `step` e `flesh`), `game-characters-undead` (dados da infecção zumbi), `game-stories` (a ficha do personagem).

## Ambiente de teste
`pnpm --filter @adatechnology/game-player test`: o golden `game-player.json` (18 roteiros do código do jogo em `node:vm`, gravados por
`pnpm --filter @adatechnology/characters-catalog-tool golden:vm`) é refeito quadro a quadro, mais testes da ficha, das feridas e da bancada.
`examples/player-test-area` (`sala-jogador.html`) carrega a bancada: a câmera da sala é o jogador; golpe, mordida, agarrão, empurrão, faca, curativo, derrubada,
infecção ligada ou não, agilidade e vigor. Também vai junto em `examples/interactables-test-area`.

## Andar pelo controlador do motor (spec 008, T4.1)
- `createPhysicsController(world, { position, collider })` → `PlayerWorld.controller` (`move`, `read`, `teleport`): `x`, `y`, `z` do jogador são os pés do controlador (degrau de 18 cm, rampa de 30°, empurra caixa de 30 kg, é empurrado) e `blocked` não é consultado. `player.update(h, input)` roda na fase `actors` do laço, com o passo fixo. Sem controlador a grade anda como antes. Teste: `tests/physics-controller.test.ts`.

## Cuidados
- `pressed` vale só no quadro em que a tecla desceu, como o `wasPressed` do jogo: dentro do agarrão o E e o F são gastos ali.
- A morte por queimadura sem sangrar mostra "Fome e sede" (`hunger_thirst`), como no jogo.
- Sem `crowd` não há agarrão de verdade, empurrão nem golpe: os eventos saem, mas não há em quem bater.
- Passe o mesmo `random` que o jogo usa para o resto se a ordem dos sorteios importar entre sistemas.
