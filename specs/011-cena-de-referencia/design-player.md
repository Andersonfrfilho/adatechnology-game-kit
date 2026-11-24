# T1.6 — Desenho da ação do jogador no SDK (`createPlayerActions`)

Status: **aprovado com mudanças pelo `architect` (2026-11-24); as sete obrigatórias estão aplicadas** (marcadas `[B1]`…`[B7]`). Lido na `origin/spec/011-room-on-host` (depois da T1.5: `room.ts` com 5.303 linhas,
`994986c2d`). Toda linha `room.ts NNNN` abaixo é dessa versão; os arquivos irmãos estão em `packages/game-test-room/src/`; o host em
`packages/game-kit-defaults/src/world/`. Só desenho: nenhum código muda nesta task.

## 1. Inventário: o que ainda é ação do jogador na sala

| Bloco | `room.ts` | Linhas | Arquivos irmãos (linhas) |
|---|---|---|---|
| Mira (`aim`, `legAim`, `withoutHeld`) | 1592–1593, 1938–1995 | 60 | — |
| Tiro (`muzzle`, `tracer`, `shotPush`, `shoveFree`, água, `traceShot` 2349, `fireShots` 2356, `fireRays`, `heatRays`) | 2028–2074, 2167–2474 | 355 | — |
| Golpe e ferramenta de trabalho (`meleeUse`, `strikeUse`, `stepStrikes` 2620, pá, extintor, `startFire`) | 2475–2743 | 269 | `shovel.ts` 108, `body-sounds.ts` 108 |
| Explosivos (`blastWater`, `crossingBodies`, `createExplosives` 2756) | 453–467, 2744–2790 | 62 | `explosives.ts` 659, `blast-settings.ts` 39, `segment-box.ts` 23 (`explosives.ts` 11) |
| Fogo no chão **[B1]**: zonas, manchas que queimam, `igniteNear` 2097, `updateFires` 2127 (regra de mundo; `startFire` 2734 a alimenta) | 2075–2166 | 92 | — |
| Canal de eventos ao host **[B1]**: `emitHost`/`flushEvents` (4322–4334, `toHostEvent` em 4329), todo o `actions.on(HostEvent)` | (nos 344 do gatilho) | — | `host-events.ts` 56 |
| Gatilho e arma na mão (estado por arma, `loadout`, `useTool` 2816, `applyUses` 2855, duas mãos, menu, comandos 4322–4408, `equip`/`pickTool`) | 470–499, 2791–2993, 3739–3762, 4322–4408 | 344 | `dual-reload.ts` 93 |
| Pegar, segurar, arremessar (`grab` 3136, `throwHeld` 3196, `pickUpTool` 3043, `respawnSaved` 3056, `putDownTool` 3071, `followHeld` 3239) | 2994–3313 | 320 | `hand-sounds.ts` 75 |
| Uso de item (`useItem` 3352, `updateItemUse` 3407, lacre, abertura) | 3314–3467 | 154 | — |
| Recipientes (`syncContainers` 3925, `syncPieceMass`) | 3925–3954 | 30 | — |
| Andar, empurrar, portas, assento, chute, esbarrão, ser jogado (`footing` 686, `kickLight`, `createPlayer` 753, `createRoomPush` 897, `createRoomShove`, `createSeating`, `createRoomDoors` 1028, `pushByPlayer` 1380, `slamPlayer`/`knockPlayer` 1665–1710, `stepFeet` 2012) | 682–1088, 1318–1411, 1615–1710, 1996–2023 | 625 | `player.ts` 724, `door-open.ts` 651, `furniture-push.ts` 290, `furniture-carry.ts` 168, `furniture-shove.ts` 109, `seating.ts` 150, `walk-plan.ts` 17 |
| **Total** | | **2.311** | **3.270** |

**Somam ~5.600 linhas, não 3.000 a 4.000** (`design-host.md` §6). A conta antiga não tinha `furniture-shove.ts`, `seating.ts`, os sons do
corpo e da mão, `host-events.ts`, `segment-box.ts`, o fogo no chão nem o andar inteiro (625 linhas do `room.ts`). O marca-passo da explosão
**já saiu** na T1.5 (`world/blast-pacing.ts`); a T1.7 não o move.

**[B1] Fogo no chão e leitores do corpo.** `startFire` (2734) cria zonas de fogo que `updateFires` (2127, ligado ao host por `kit.rules.use`,
3983) queima; dependem dele os explosivos (molotov, `explosives.ts` 119, 483), o lança-chamas (`heatRays` 2442, 2452) e o extintor
(`extinguishUse` 2710), e o evento `ignite` do mundo (606). Por isso o fogo vai **para o host**, não para a ação: `world/fire.ts` (zonas,
manchas, `igniteNear`, `start`) ligado ao gancho `rules.fire` que já existe, na T1.7, antes dos explosivos; a ação chama `world.fire.start`.
`rockPlayer` (3580, a onda empurra o corpo: `player.moveBy`) e `updateLoads` (3602, o peso no chão) ficam regras de mundo no `afterWorld`,
mas leem o corpo: passam a ler `actions.body` (posição, pés, massa) pelo mesmo nome na T1.9.

Fica na sala (escolha de jogo ou ferramenta de teste): teclas (`onKey` 3622–3738, 117 linhas), mochila (`inventory-room.ts` 202), torneira do
cenário (3468–3480), inspetor (3763–3857), animação de clipes da bancada (4133–4249), avatar e câmera de 3ª pessoa (1594–1936).

Já é do SDK e é só usado: `createArsenal`, `WeaponState`, `Shot`/`Use`, `ExplosiveBody`, `tripwireSegment`, `sweepGround` (`game-weapons`);
`createFurniturePush`, `createDoorUse`, `dragMarkFor` (`game-player`); `createItemUse` (`game-fluids`); `sealBlock`, `sealOpener`,
`twistStroke`, `useToHit`, `shotExtras`, `knockOf` (`game-contracts`). O que está na sala é a **cola** entre essas regras e o mundo three.

## 2. Onde mora cada parte

Regra pura (sem three) no núcleo dono (`kit_owner`: `weapons` → `game-weapons`; `people` → `game-player`); a cola que lê o mundo e desenha em
**L5, entrada `@adatechnology/game-kit-defaults/player`** (pasta `src/player/`, arquivos de até 200 linhas, como `src/world/`). O motivo do L5
continua o de `design-host.md` §6: a cola usa `destruction-three` (`Piece`, `impulse`, `emit`), `fluids-three`, `terrain-three` e `vfx-three`
juntos, e `no-domain-adapter-to-adapter` (`.dependency-cruiser.cjs` 146) proíbe isso a um `-three` de domínio.

| Bloco | Regra pura → núcleo | Cola → `game-kit-defaults/player` | Escolha do jogo (fica fora) |
|---|---|---|---|
| Mira | — | `aim.ts`: olho da câmera do host, `withoutHeld` | câmera de 3ª pessoa empresta a mira (§3, pergunta P2) |
| Tiro | `game-weapons`: impulso do tiro (`shotPush` 2236, `pushPiece` 2192) e entrada na água como conta de raio | `shots.ts`, `rays.ts`: `world.shoot`, rastro, faísca, `renderer.impulse` | texto do relato (`act.shoot.*`) |
| Golpe | `game-weapons`: alcance do pé e do corpo (`footRay`, `bodyReach`), combo (`setStrikeCombo`, tempos do `stepStrikes`). Pá **[B7]**: `shovelful`, `dumpOf`, `nearestHeap`, `deepestNear` → `game-terrain` (dono de cavar); `SHOVEL`, `digsWith`, `biteShareOf` → `game-weapons`; `toolConditionOf` fica em L5. `Terrain` nunca passa pelo `game-contracts` | `strikes.ts`, `tool-work.ts`: raios, cavar, extintor; `toolConditionOf` | `strikeClips`, `punchHand`, `punchTools` (opções) |
| Explosivos | já em `game-weapons` (`ExplosiveBody`, `blastEffect`, `tripwireSegment`) | `explosives.ts` (o arquivo de hoje, dividido em 4: voo, carga, fumaça, água) e `blast-settings.ts` | `projectileModel` (modelo do `game-weapons-three`) |
| Gatilho | `game-weapons`: `dual-reload.ts` (só usa `game-contracts`), a fila de comandos (`runToolCommand` 4388) | `trigger.ts`: estados por arma, `applyUses` despacha para tiro, golpe, explosivo | `loadout`, menu de armas, teclas Q/B/R |
| Pegar e arremessar | `game-player`: limite de carga, velocidade do arremesso, mola do que se segura (`followHeld`) | `hold.ts`, `carry-tool.ts`: `grab`, `throwHeld`, `pickUpTool`/`respawnSaved`/`putDownTool` | mochila (`inventory`), som de pegar por item |
| Uso de item | já em `game-fluids` (`createItemUse`) e `game-contracts` (lacre) | `item-use.ts`: `useItem`, `updateItemUse`, `openingProgress` | `itemUses` (opção), tecla de agachar (`crouch`) |
| Recipientes | — | `containers.ts`: `syncContainers` | — |
| Andar | `game-player`: `createBodyMotion` (§2.2), o passo 3D do corpo de `player.ts` (andar entre colisores, subir degrau, pular, agachar, cair, ser jogado, recuo), `walk-plan.ts`, `footing` como conta sobre caixas | `walk.ts`, `push.ts`, `doors.ts`, `seating.ts`, `bump.ts`: colisores do mundo, `renderer.solidsNear`, peças | teclado, mouse e trava do ponteiro (hoje dentro de `player.ts` 195+) |
| Sons | — | `sounds.ts`: tabelas de `body-sounds.ts` e `hand-sounds.ts` (chave de som por golpe, passo, pegar) | amostras do jogo (`userSamplesBaseUrl`) |

Na conta: ~600 linhas viram regra pura nos núcleos (com teste sem GPU), ~90 vão ao host (fogo), ~4.500 viram cola em L5 e ~400 ficam na
sala como entrada.

**[B6] Dependências novas do `game-kit-defaults`:** `game-weapons`, `game-weapons-three` (tipos `ProjectileModel`/`ProjectileQuery`),
`game-player` e `game-shapes-three` (`releaseObject3D` de rastros e projéteis, §8). `game-terrain`, `-three`, `game-fluids`, `-three`,
`game-vfx`, `-three`, `game-destruction`, `-three` e `game-audio` já estão. Nenhuma é de conteúdo; a entrada `./player` ganha o mesmo
mapeamento do `/world` no tsconfig do dependency-cruiser e no `dts` do tsup.

### 2.1 Tipos que saem do `game-test-room` **[B2]**

L5 nunca importa `game-test-room` (`nothing-imports-test-room`). Os tipos que a ação usa e que hoje moram na sala vão para o dono:

| Tipo | Hoje | Vai para |
|---|---|---|
| `KickLeg` | `avatar.ts` 101 | `game-player` (perna do corpo) |
| `PunchHand`, `DEFAULT_STRIKE_CLIPS` | `avatar.ts` 103, 107–108 | `game-weapons` (qual mão e qual clipe cada arma de golpe usa: dado da arma) |
| `StrikeComboOption` | `types.ts` 38 (cópia do `StrikeCombo` do `game-characters-people`) | `game-weapons`, como `StrikeCombo`; o `game-characters-people` continua com os dados, compatíveis pela forma, sem importar |
| `ProjectileModel`, `ProjectileQuery` | `types.ts` 172, 179 (cópia) | **já existem** em `game-weapons-three` (`projectile-model.ts` 10, 17): a cópia da sala sai e todos importam de lá |

A sala reexporta os nomes antigos até a próxima major (D2), para quem importa de `game-test-room`.

### 2.2 O corpo e o `createPlayer` do `game-player` **[B3]**

O `game-player` já tem `createPlayer`/`Player` (`src/player.ts` 55, 158), "the player body": porte literal do jogador do time (G 68427–68640),
2D, com vitais, feridas, fôlego, pânico e a horda. O `createPlayer` da sala (`player.ts` 166) é outra coisa: o movimento 3D da câmera entre
colisores. **Não se reaproveita um no outro:** mudar o porte literal é proibido (§1), e pôr os vitais no andar mudaria velocidade e hash da sala.
O movimento entra no `game-player` com nome próprio, **`createBodyMotion`/`BodyMotion`**, ao lado do `createPlayer`, com as constantes de
hoje (o `speedAt` continua o fator do terreno, `room.ts` 761). Compor os dois (vitais dando a velocidade, o `slam` do movimento chamando o
`knock` dos vitais) é escolha do jogo e fica fora da 1b: a sala não tem vitais hoje. Na ação o corpo é **`actions.body`**, nunca `actions.player`.

## 3. API

```ts
const actions = createPlayerActions(world, {          // world: KitWorld<TRecord extends PlayerActionObject>
  arsenal?, weapons?, loadout?,                        // TestRoomOptions.arsenal / .weapons / .loadout (room.ts 471–473)
  itemUses?, maxCarryKg?, playerMass?,                 // .itemUses (391) / .maxCarryKg (808) / .playerMass
  push?, doors?, kickLeg?, kickHeights?,               // .push / .doors / .kickLeg / .kickHeights
  strikeClips?, strikeCombo?, strikeComboOn?, punchHand?, punchTools?,
  blast?, blastImpulse?, projectileModel?,             // .blast / .blastImpulse / .projectileModel
  translate?, format?, nameOf?,                        // internos de hoje: t, num (createExplosives 2774–2775), nameOf (508)
})

actions.use(hold?) ; actions.useOff(hold?) ; actions.reload() ; actions.kick()      // room.ts 4945, 4925, 4943 e a API da sala
actions.grab() ; actions.throwHeld(speed?) ; actions.equip(id) ; actions.useItem(id)
actions.walk(to, seconds) ; actions.look(position, target) ; actions.blastAt(explosive, point)   // 5013, 4969, 5003
actions.push.begin() / end() ; actions.useLeaf(objectId, part?) ; actions.sit(objectId, seatId) / stand()
actions.input(dt, paused) ; actions.scripted(dt)       // o que o sistema de entrada do jogo chama (hoje room.input 5252–5264)
actions.on(listener)                                   // HostEvent do game-contracts (hoje emitHost 4322)
actions.setMuzzleSource(source)                        // hoje ModuleHost.setMuzzleSource (4524)
actions.body ; actions.tool ; actions.held             // estado lido pelo HUD, pelo avatar e por rockPlayer/updateLoads
actions.reset() ; actions.dispose()
```

**Nenhuma opção inventada.** Cada campo de criação é um campo de `TestRoomOptions` com o mesmo nome e tipo, ou um callback que a sala já passa
a um irmão hoje (`translate`, `format` e `say` vão ao `createExplosives`; `nameOf` é da sala). **`player` e `hands` do texto da T1.6 não
viram opção:** o corpo é criado pela própria ação a partir de `world.view.camera` e dos colisores do mundo (hoje `createPlayer` 753 recebe
`camera`, `colliders`, `footing`, `blockers`, `limit`, `floorAt`, todos do mundo); as mãos são emprestadas em tempo de jogo por quem desenha a
arma, como hoje (`setMuzzleSource`). `limit` vem de `bounds` do host; `crouchKeys` e `dom` ficam com a entrada do jogo.

**[B6] Explosivos.** A opção é o `blast` de cima (`TestRoomOptions.blast`, `types.ts` 388), não o `debris.blast` (375, política D4 do host).
Os outros campos do `createExplosives` (2756–2790) passam a vir de:

| Campo | Fonte na ação |
|---|---|
| `THREE`, `scene`, `camera` | `world.view` |
| `world`, `renderer` | `world.destruction.world` / `.renderer` |
| `effects`, `audio` | `world.effects.world`, `world.sound.audio` |
| `blasts` | `world.blastPacing` |
| `groundAt`, `waterLevelAt` | `world.ground.at`, `world.ground.terrain.waterAt` |
| `water`, `splash` | `blastWater` (453) e o jorro de 2783, sobre `world.liquids.water` e o terreno |
| `startFire` | `world.fire.start` (host, [B1]) |
| `objects`, `bodies` | `world.objects` (sem `arena`) e `actions.body` (`crossingBodies` 2744) |
| `toolId`, `toolName` | o gatilho da ação; `arsenal.name` |
| `withoutHeld` | `aim.ts` da ação |
| `translate`, `format` | locales da ação (opções `translate`/`format`) |
| `action`, `say` | `world.reports.emit`; `say` vira relato `hud.*` que o jogo mostra (a sala: `ui.toast`, 2176) |
| `emitHost` | `actions.on` |
| `blasted`, `projectileModel` | `blast-settings.ts` da ação; opção `projectileModel` |

**`world.objects`.** A ação lê só o registro do host (T1.6a), nunca `entries`. O registro é genérico (`ObjectRegistry<TRecord>`,
`world/objects.ts`); a ação pede `TRecord extends PlayerActionObject`, um tipo estrutural com os campos que já existem no `Entry` da sala
(`room.ts` 85–113: `so`, `item`, `name`, `arena`, `containerId`, `fluidPart`, `fluidOffset`, `uses`, `piece`, `free`, `pushable`, `opened`,
`fluid*`, `sealLoss`). O `Entry` da sala satisfaz sem mudar; o jogo usa o tipo direto. Segurar é `world.objects.hold/release/held` (a sala já
faz isso em `grab` 3174); as peças soltas são `world.pieces.all` (469). **[B4] Achar a peça de um id:** a sala mantém um mapa próprio
(`rendererPieces` 392, 22 linhas, ~23 usos) que tiro, golpe e pegar consultam. Ele guarda dois tipos de peça: as soltas pelo renderizador
(evento `piece`, 421) e **objetos inteiros que viraram peça** (`loosened` 409, `makePushPiece` 863, móvel solto 1129, `shoveFree` 2292). O
`world.pieces` só junta o evento `piece` (`world/destruction.ts` 149). Por isso a consulta é
`world.objects.get(id)?.piece ?? world.pieces.get(id)`: o objeto que virou peça já leva a peça no registro (`Entry.piece`), e `world.pieces`
ganha só o `get` das soltas (um `Map` ao lado da lista em `world/pieces.ts`). A T1.7 começa por isso, e o mapa da sala sai.

**Registro no quadro.** Os ids `room.*` do agendador não mudam (`design-host.md` §4.1):

| Onde | O quê | Hoje |
|---|---|---|
| `world.frame.beforeWorld` | **um** sistema, nesta ordem: plano de andar, golpes, uso de item, explosivos, recipientes | 3973–3981 |
| `world.frame.on('afterFilm')` | estado de cada arma (`update`, `flushEvents`) e a recarga das duas mãos | 4006–4017 |
| `world.frame.on('beforePresent')` | vida dos rastros de tiro | 4018–4031 |
| fase `input` (do jogo) | o jogo chama `actions.input`/`actions.scripted` dentro do seu `room.input`: corpo, empurrar, portas, chute, esbarrão, passos, gatilho segurado, `followHeld` | 4035–4070, 5252–5264 |

`afterSound` (seguidores), `afterWaterView` (pegadas) e `afterPresent` (`flush`) são regras de mundo e ficam fora da ação.

**Eventos.** Três canais, como hoje: (1) `world.reports.emit(WorldReport)` com os tipos de hoje (`shoot`, `melee`, `strike`, `combo`, `grab`,
`drop`, `throw`, `pickup_tool`, `stow`, `use_item`, `open_seal`, `dig`, `molotov_fire`, `explode`, `dud`, `place_charge`, `tripwire`,
`backblast`, `blast_player`, `player_*`, `kick`, `bump`, `sit`, `stand`...), com `text` preenchido pelas chaves `act.*`/`hud.*` que vão junto
para `game-kit-defaults/player/locales` (o log da sala fica igual; o jogo ignora `text`, `world/reports.ts`); (2) `actions.on(HostEvent)`
(`footfall`, `motion`, `tool`, `explosion`...), que a sala repassa aos módulos; (3) os eventos públicos da sala (`fire('grab'|'throw'|'push'|
'door'|'footfall'|'tool')`, 546) a sala deriva de (1), (2) e do `world.objects.on`.

**Aleatório.** O tiro sorteia rastro no fluxo da sala (`rnd()` 2387), o mesmo que o fogo (2137–2157) e que a sala dá ao host como `random`
(288). A ação sorteia **só** de `world.random`, na mesma ordem. A fumaça dos explosivos usa `Math.random` (`explosives.ts` 162): fica.

## 4. Ordem de extração

Regra das três: a sala só troca o corpo de uma função pela chamada à peça extraída, no mesmo lugar do passo; `room.ts` só diminui; goldens,
`pnpm check:room` e o hash (3822996173 com marca-passo / 1819424859 sem) iguais depois de cada uma (gate 5 do `tasks.md`).

| Passo | Move | Sai do `room.ts` | Entra em |
|---|---|---|---|
| **T1.7** | consulta de peça ([B4]); fogo no chão para o host ([B1]); `ProjectileModel`/`Query` da sala trocados pelos do `game-weapons-three` ([B2]); explosivos (`explosives.ts`, `segment-box.ts`, `blast-settings.ts`, `blastWater`, `crossingBodies`); tiro e raios (2028–2074, 2179–2474 menos a fala); impulso do tiro em `game-weapons` | ~510 + 721 dos irmãos | `world/fire.ts`; `player/explosives*.ts`, `shots.ts`, `rays.ts` |
| **T1.8** | `PunchHand`, `DEFAULT_STRIKE_CLIPS`, `StrikeCombo` para `game-weapons` ([B2]); gatilho e arma na mão (344) com `host-events.ts`; golpe e pá (269, partida conforme [B7]); pegar/segurar/arremessar (320), uso de item (154); `dual-reload.ts`, sons | ~1.090 + 440 | `trigger.ts`, `host-events.ts`, `strikes.ts`, `hold.ts`, `item-use.ts`... |
| **T1.9** | `KickLeg` para `game-player`; `createBodyMotion` ([B3]); andar, empurrar, portas, assento, esbarrão, ser jogado (625), recipientes (30), mira (60); `player.ts` partido em corpo (núcleo) e teclado (sala); `rockPlayer`/`updateLoads` leem `actions.body`; `createPlayerActions` junta tudo e se registra no quadro | ~715 + 2.109 | `walk.ts`, `push.ts`, `doors.ts`..., `create-player-actions.ts` |

Durante T1.7 e T1.8 cada peça é uma fábrica (`createShots`, `createExplosivesHost`, `createStrikes`, `createHold`...) que a sala liga
**no mesmo ponto de hoje**; o sistema `beforeWorld` continua o da sala (3973), chamando as peças na mesma ordem. Só na T1.9 o
`createPlayerActions` compõe as fábricas e registra o próprio sistema. A sala então registra o relógio (`simTime`, 3974) antes da ação e
`updateAnimations` (clipes da bancada) depois: **a única mudança de ordem da fase**, de entre golpe e uso de item para depois dos recipientes (P3).

**O hash cobre pouco da 1b.** O `room-determinism.mjs` só chama `room.blastAt` (61) e compara `world.serialize()` e os eventos da destruição
(34–44): guarda os explosivos (T1.7) e o passo do mundo, mas **não dispara tiro, golpe, pegar, uso de item nem andar**. Proposta (T1.6b, antes
da T1.7): um replay sem GPU com `happy-dom` e `stubRenderer` (`game-test-room/tests/helpers.ts` 7, 23), em duas partes. (a) A API
roteirizada que já existe (`use(hold)`, `useOff`, `grab`, `throwHeld`, `walk`, `kick`, `useLeaf`, `sit`, um clipe tocando durante um golpe).
(b) **[B5]** O `updateInput` não roteirizado (4035), com `dt` fixo e teclas sintéticas: o modo roteirizado só roda `seating.update`,
`player.update(0)`, `push`, `doors` e `followHeld` (5252–5264) e deixa de fora `kickLight`, `pushByPlayer`, `stepFeet` e o gatilho segurado.
Grava o hash dos relatos, dos `HostEvent`, do `world.serialize()` e **da pose do corpo** (posição, pés, `yaw`, `pitch`) na sala de hoje.
Teste novo, não regravação de golden; a T1.7–T1.9 exigem o mesmo hash dele.

**O passo mais arriscado é a T1.9.** É o maior (~2.800 linhas), roda na fase `input` em tempo real e não no tique (pausa, câmera lenta e
roteiro passam por `updateInput` 4035 e `room.input` 5252), mexe no corpo que todos os outros blocos leem (`player.position`, `feet`, `yaw`),
está preso ao avatar e à câmera de 3ª pessoa (`seating.seat` 1680, 1784, 2016; `aim` 1963) e o hash não o vê. A T1.8 vem logo atrás:
`pickUpTool`/`respawnSaved`/`putDownTool` serializam, tiram e recriam objetos (3043–3133) e conversam com a mochila da sala (`bagHost`).

## 5. A cena (N5) e o tamanho

**Roteiro pela mesma API.** Enquanto a 1b não fecha, o `src/test/` da cena chama o SDK direto (`world.shoot`, `throwableUse`; spec §9 N5).
Fechada a 1b, o roteiro troca para `createPlayerActions` sem entrada de teclado: `actions.walk(to, s)` e `actions.look()` para o caminho,
`actions.equip('glock_17')` + `actions.use(hold)` para os 15 tiros da fase `shoot`, `actions.equip('m67')` + `actions.use()` para arremessar,
`actions.blastAt('c4', point)` e a carga posta (`placeUse` + detonar) para o `caos_blast`, `actions.useLeaf` para o portão e a porta da fase
`enter`. São as mesmas chamadas que a sala roteirizada usa hoje, no mesmo passo fixo: o roteiro é determinístico e a régua mede a cola do
jogador de verdade (o `evidence.md` deixa de dizer que ela não está medida). O `src/game/` da cena liga teclado e mouse a essas chamadas e é o
exemplo que o jogo copia (D7).

**Estimativa [B6].** Pelo ritmo da Fase 1 (host de ~2.300 linhas e T1.5 em dois dias de trabalho, com revisão), somando o que a revisão
achou: tipos que mudam de pacote ([B2]), o corpo novo ao lado do `createPlayer` ([B3]), o fogo no host ([B1]), ~95 chamadas de texto
(`t()`, `say`, `action`, `log.coalesce`) passando ao porto de relato, e os prints da §5 em 1ª e 3ª pessoa numa GPU compartilhada (um comando
pesado por vez, com a trava):

| Task | Dias úteis |
|---|---|
| T1.6b replay das ações (roteirizado e `updateInput`) | 1–2 |
| T1.7 (com fogo no host e consulta de peça) | 3–4 |
| T1.8 (com tipos, pá partida, prints §5) | 4–5 |
| T1.9 (com `createBodyMotion`, prints §5) | 5–6 |
| revisão, PRs, evidência | 1 |
| **Total** | **14 a 18 dias úteis (cerca de 3 a 3,5 semanas)** |

**Passa do limite de 2 semanas da 1b. O dono precisa ser consultado antes da T1.7** (prompt de execução do `tasks.md`). As duas saídas estão
na P4.

## 6. Riscos e perguntas

**Riscos**

- **A ação vira um segundo `room.ts` em L5.** Mitigação igual à do host: um arquivo por ligação, até 200 linhas; `explosives.ts` (659) e
  `player.ts` (724) entram partidos, nunca inteiros.
- **Ordem e aleatório.** Sorteio fora de `world.random` ou passo fora do lugar muda o hash. Mitigação: §4, uma peça por vez, hash da sala e
  do replay a cada passo; hash diferente, para e pergunta.
- **Textos.** ~95 chamadas a `t()`/`say`/`action` nas faixas extraídas; uma chave perdida muda o log da sala. Mitigação: as chaves mudam de
  pacote com teste que compara o catálogo de chaves antes e depois.
- **Mão e arma na mão (§5).** Golpe, segurar e mira mexem na pose: T1.8 e T1.9 validam 1ª e 3ª pessoa, uma arma por família, com print.
- **Memória (§8).** Rastros, projéteis e o que se arremessa passam a ter dono em L5: `dispose` da ação e `leak.mjs` no teste sem GPU.
- **Mochila.** `bagHost` (3087–3133) chama o interior de pegar/soltar; a ação expõe só os métodos que ele usa, e a mochila fica na sala.

**Perguntas (para o `architect` e, P4, para o dono)**

- **P1 (fechada, [B4]).** Consulta de peça pelo registro e pelo `world.pieces.get` das soltas (§3).
- **P2.** Mira em 3ª pessoa: o olho mira pelo ponto que o raio da câmera do ombro acerta (`aim` 1963–1977), e o ombro é do avatar, que fica no
  jogo. Recomendo um empréstimo em tempo de jogo como `setMuzzleSource` (`setAimSource`), não opção de criação. É o único método novo da API.
- **P3.** `updateAnimations` passa de entre golpe e uso de item para depois dos recipientes na T1.9. O hash não o vê (nenhum clipe toca);
  o replay da T1.6b sim. Aceitar, ou a ação expõe as etapas para a sala intercalar? **[B5]** Na fase `input` há uma segunda costura: o
  `stepAvatar` da sala roda entre `pushByPlayer` e `stepFeet` (`updateInput` 4049, 4051, 4052), e o avatar fica no jogo. `actions.input` então
  sai em duas chamadas (corpo e esbarrão; depois passos, gatilho e `followHeld`), com o `stepAvatar` da sala entre elas, ou o avatar passa a
  rodar depois dos passos (outra mudança de ordem, que o replay [B5] vê).
- **P4 (dono).** A 1b estima 14 a 18 dias úteis, acima das 2 semanas. Três saídas:
  1. estender o prazo da 1b para ~3,5 semanas;
  2. **o recuo que o `tasks.md` já prevê** (Fase 1b, parágrafo de abertura; `design-host.md` §9): a Fase 2 começa com explosivos roteirizados
     pelo cenário e o tiro do jogador vem depois;
  3. **o corte desta proposta:** T1.6b + T1.7 + T1.8 nas 2 semanas, apertadas (tiro, explosivos, golpe, pegar e arremessar destravam
     `shoot`, `grenade`, `horde`, `caos_fire` e `caos_blast`); a T1.9 vira fase própria depois da Fase 2, e a cena anda pela câmera do roteiro.
- **P5 (fechada, [B7]).** A pá se parte entre `game-terrain`, `game-weapons` e L5 (§2); o `Terrain` nunca passa pelo `game-contracts`.
