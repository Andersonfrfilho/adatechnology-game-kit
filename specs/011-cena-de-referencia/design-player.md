# T1.6 — Desenho da ação do jogador no SDK (`createPlayerActions`)

Status: **rascunho para o `architect`** (2026-11-24). Lido na `origin/spec/011-room-on-host` (depois da T1.5: `room.ts` com 5.303 linhas,
`994986c2d`). Toda linha `room.ts NNNN` abaixo é dessa versão; os arquivos irmãos estão em `packages/game-test-room/src/`; o host em
`packages/game-kit-defaults/src/world/`. Só desenho: nenhum código muda nesta task.

## 1. Inventário: o que ainda é ação do jogador na sala

| Bloco | `room.ts` | Linhas | Arquivos irmãos (linhas) |
|---|---|---|---|
| Mira (`aim`, `legAim`, `withoutHeld`) | 1592–1593, 1938–1995 | 60 | — |
| Tiro (`muzzle`, `tracer`, `shotPush`, `shoveFree`, água, `traceShot` 2349, `fireShots` 2356, `fireRays`, `heatRays`) | 2028–2074, 2167–2474 | 355 | — |
| Golpe e ferramenta de trabalho (`meleeUse`, `strikeUse`, `stepStrikes` 2620, pá, extintor, `startFire`) | 2475–2743 | 269 | `shovel.ts` 108, `body-sounds.ts` 108 |
| Explosivos (`blastWater`, `crossingBodies`, `createExplosives` 2756) | 453–467, 2744–2790 | 62 | `explosives.ts` 659, `blast-settings.ts` 39 |
| Gatilho e arma na mão (estado por arma, `loadout`, `useTool` 2816, `applyUses` 2855, duas mãos, menu, comandos 4322–4408, `equip`/`pickTool`) | 470–499, 2791–2993, 3739–3762, 4322–4408 | 344 | `dual-reload.ts` 93 |
| Pegar, segurar, arremessar (`grab` 3136, `throwHeld` 3196, `pickUpTool` 3043, `respawnSaved` 3056, `putDownTool` 3071, `followHeld` 3239) | 2994–3313 | 320 | `hand-sounds.ts` 75 |
| Uso de item (`useItem` 3352, `updateItemUse` 3407, lacre, abertura) | 3314–3467 | 154 | — |
| Recipientes (`syncContainers` 3925, `syncPieceMass`) | 3925–3954 | 30 | — |
| Andar, empurrar, portas, assento, chute, esbarrão, ser jogado (`footing` 686, `kickLight`, `createPlayer` 753, `createRoomPush` 897, `createRoomShove`, `createSeating`, `createRoomDoors` 1028, `pushByPlayer` 1380, `slamPlayer`/`knockPlayer` 1665–1710, `stepFeet` 2012) | 682–1088, 1318–1411, 1615–1710, 1996–2023 | 625 | `player.ts` 724, `door-open.ts` 651, `furniture-push.ts` 290, `furniture-carry.ts` 168, `furniture-shove.ts` 109, `seating.ts` 150, `walk-plan.ts` 17 |
| **Total** | | **2.219** | **3.191** |

**Somam ~5.400 linhas, não 3.000 a 4.000** (`design-host.md` §6). A conta antiga não tinha `furniture-shove.ts`, `seating.ts`, os sons do
corpo e da mão, nem o andar inteiro (625 linhas do `room.ts`). O marca-passo da explosão **já saiu** na T1.5 (`world/blast-pacing.ts`); a
T1.7 não o move.

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
| Golpe | `game-weapons`: alcance do pé e do corpo (`footRay`, `bodyReach`), combo (`setStrikeCombo`, tempos do `stepStrikes`); `shovel.ts` (pá: `shovelful`, `biteShareOf`, `toolConditionOf`) | `strikes.ts`, `tool-work.ts`: raios, cavar no terreno, extintor, fogo | `strikeClips`, `punchHand`, `punchTools` (opções) |
| Explosivos | já em `game-weapons` (`ExplosiveBody`, `blastEffect`, `tripwireSegment`) | `explosives.ts` (o arquivo de hoje, dividido em 4: voo, carga, fumaça, água) e `blast-settings.ts` | `projectileModel` (modelo do `game-weapons-three`) |
| Gatilho | `game-weapons`: `dual-reload.ts` (só usa `game-contracts`), a fila de comandos (`runToolCommand` 4388) | `trigger.ts`: estados por arma, `applyUses` despacha para tiro, golpe, explosivo | `loadout`, menu de armas, teclas Q/B/R |
| Pegar e arremessar | `game-player`: limite de carga, velocidade do arremesso, mola do que se segura (`followHeld`) | `hold.ts`, `carry-tool.ts`: `grab`, `throwHeld`, `pickUpTool`/`respawnSaved`/`putDownTool` | mochila (`inventory`), som de pegar por item |
| Uso de item | já em `game-fluids` (`createItemUse`) e `game-contracts` (lacre) | `item-use.ts`: `useItem`, `updateItemUse`, `openingProgress` | `itemUses` (opção), tecla de agachar (`crouch`) |
| Recipientes | — | `containers.ts`: `syncContainers` | — |
| Andar | `game-player`: o passo do corpo de `player.ts` (andar entre colisores, subir degrau, pular, agachar, cair, ser jogado, recuo), `walk-plan.ts`, `footing` como conta sobre caixas | `walk.ts`, `push.ts`, `doors.ts`, `seating.ts`, `bump.ts`: colisores do mundo, `renderer.solidsNear`, peças | teclado, mouse e trava do ponteiro (hoje dentro de `player.ts` 195+) |
| Sons | — | `sounds.ts`: tabelas de `body-sounds.ts` e `hand-sounds.ts` (chave de som por golpe, passo, pegar) | amostras do jogo (`userSamplesBaseUrl`) |

Na conta: ~600 linhas viram regra pura nos núcleos (com teste sem GPU), ~4.400 viram cola em L5 e ~400 ficam na sala como entrada.

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
actions.player ; actions.tool ; actions.held           // estado lido pelo HUD e pelo avatar
actions.reset() ; actions.dispose()
```

**Nenhuma opção inventada.** Cada campo de criação é um campo de `TestRoomOptions` com o mesmo nome e tipo, ou um callback que a sala já passa
a um irmão hoje (`translate`, `format` e `say` vão ao `createExplosives`; `nameOf` é da sala). **`player` e `hands` do texto da T1.6 não
viram opção:** o corpo é criado pela própria ação a partir de `world.view.camera` e dos colisores do mundo (hoje `createPlayer` 753 recebe
`camera`, `colliders`, `footing`, `blockers`, `limit`, `floorAt`, todos do mundo); as mãos são emprestadas em tempo de jogo por quem desenha a
arma, como hoje (`setMuzzleSource`). `limit` vem de `bounds` do host; `crouchKeys` e `dom` ficam com a entrada do jogo.

**`world.objects`.** A ação lê só o registro do host (T1.6a), nunca `entries`. O registro é genérico (`ObjectRegistry<TRecord>`,
`world/objects.ts`); a ação pede `TRecord extends PlayerActionObject`, um tipo estrutural com os campos que já existem no `Entry` da sala
(`room.ts` 85–113: `so`, `item`, `name`, `arena`, `containerId`, `fluidPart`, `fluidOffset`, `uses`, `piece`, `free`, `pushable`, `opened`,
`fluid*`, `sealLoss`). O `Entry` da sala satisfaz sem mudar; o jogo usa o tipo direto. Segurar é `world.objects.hold/release/held` (a sala já
faz isso em `grab` 3174); as peças soltas são `world.pieces.all` (469). **Falta ao host um `world.pieces.get(id)`:** a sala mantém um mapa
próprio (`rendererPieces` 392, 15 usos) que tiro, golpe e pegar consultam. A T1.7 começa pondo esse mapa no `world/pieces.ts` (P1).

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
| **T1.7** | `world.pieces.get`; explosivos (`explosives.ts`, `blast-settings.ts`, `blastWater`, `crossingBodies`); tiro e raios (2028–2074, 2179–2474 menos a fala); impulso do tiro em `game-weapons` | ~420 + 698 dos irmãos | `player/explosives*.ts`, `shots.ts`, `rays.ts` |
| **T1.8** | gatilho e arma na mão (344), golpe e pá (269), pegar/segurar/arremessar (320), uso de item (154); `dual-reload.ts`, `shovel.ts`, sons | ~1.090 + 384 | `trigger.ts`, `strikes.ts`, `hold.ts`, `item-use.ts`... |
| **T1.9** | andar, empurrar, portas, assento, esbarrão, ser jogado (625), recipientes (30), mira (60); `player.ts` partido em corpo (núcleo) e teclado (sala); `createPlayerActions` junta tudo e se registra no quadro | ~715 + 2.109 | `walk.ts`, `push.ts`, `doors.ts`..., `create-player-actions.ts` |

Durante T1.7 e T1.8 cada peça é uma fábrica (`createShots`, `createExplosivesHost`, `createStrikes`, `createHold`...) que a sala liga
**no mesmo ponto de hoje**; o sistema `beforeWorld` continua o da sala (3973), chamando as peças na mesma ordem. Só na T1.9 o
`createPlayerActions` compõe as fábricas e registra o próprio sistema. A sala então registra o relógio (`simTime`, 3974) antes da ação e
`updateAnimations` (clipes da bancada) depois: **a única mudança de ordem da fase**, de entre golpe e uso de item para depois dos recipientes (P3).

**O hash cobre pouco da 1b.** O `room-determinism.mjs` só chama `room.blastAt` (61) e compara `world.serialize()` e os eventos da destruição
(34–44): guarda os explosivos (T1.7) e o passo do mundo, mas **não dispara tiro, golpe, pegar, uso de item nem andar**. Proposta (T1.6b, antes
da T1.7): um replay sem GPU no padrão dos testes da sala, pela API roteirizada que já existe (`use(hold)`, `useOff`, `grab`, `throwHeld`,
`walk`, `kick`, `useLeaf`, `sit`, um clipe tocando durante um golpe), gravando o hash dos relatos, dos `HostEvent` e do `world.serialize()`
na sala de hoje. Teste novo, não regravação de golden; a T1.7–T1.9 exigem o mesmo hash dele.

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

**Estimativa.** Pelo ritmo da Fase 1 (host de ~2.300 linhas e T1.5 em dois dias de trabalho, com revisão), e com a rodada do hash e o
`check:room` numa máquina compartilhada (um comando pesado por vez):

| Task | Dias úteis |
|---|---|
| T1.6b replay das ações | 1 |
| T1.7 | 2–3 |
| T1.8 | 3–4 |
| T1.9 | 4–5 |
| revisão, PRs, evidência | 1–2 |
| **Total** | **11 a 15 dias úteis (2,2 a 3 semanas)** |

**Passa do limite de 2 semanas da 1b. O dono precisa ser consultado antes da T1.7** (prompt de execução do `tasks.md`). Corte sugerido, se o
dono mantiver as 2 semanas: T1.6b + T1.7 + T1.8 dentro do prazo (tiro, explosivos, golpe, pegar e arremessar: destravam `shoot`, `grenade`,
`horde`, `caos_fire`, `caos_blast`); a T1.9 vira fase própria depois da Fase 2, e a cena anda pela câmera do roteiro, como prevê
`design-host.md` §9.

## 6. Riscos e perguntas

**Riscos**

- **A ação vira um segundo `room.ts` em L5.** Mitigação igual à do host: um arquivo por ligação, até 200 linhas; `explosives.ts` (659) e
  `player.ts` (724) entram partidos, nunca inteiros.
- **Ordem e aleatório.** Sorteio fora de `world.random` ou passo fora do lugar muda o hash. Mitigação: §4, uma peça por vez, hash da sala e
  do replay a cada passo; hash diferente, para e pergunta.
- **Textos.** ~80 chamadas a `t()`/`say`/`action` nas faixas extraídas; uma chave perdida muda o log da sala. Mitigação: as chaves mudam de
  pacote com teste que compara o catálogo de chaves antes e depois.
- **Mão e arma na mão (§5).** Golpe, segurar e mira mexem na pose: T1.8 e T1.9 validam 1ª e 3ª pessoa, uma arma por família, com print.
- **Memória (§8).** Rastros, projéteis e o que se arremessa passam a ter dono em L5: `dispose` da ação e `leak.mjs` no teste sem GPU.
- **Mochila.** `bagHost` (3087–3133) chama o interior de pegar/soltar; a ação expõe só os métodos que ele usa, e a mochila fica na sala.

**Perguntas (para o `architect` e, P4, para o dono)**

- **P1.** `world.pieces.get(id)` no host (≈15 linhas em `world/pieces.ts`) ou a ação mantém o próprio mapa pelos eventos `piece`/`released`,
  como a sala? Recomendo o host: um mapa só.
- **P2.** Mira em 3ª pessoa: o olho mira pelo ponto que o raio da câmera do ombro acerta (`aim` 1963–1977), e o ombro é do avatar, que fica no
  jogo. Recomendo um empréstimo em tempo de jogo como `setMuzzleSource` (`setAimSource`), não opção de criação. É o único método novo da API.
- **P3.** `updateAnimations` passa de entre golpe e uso de item para depois dos recipientes na T1.9. O hash não o vê (nenhum clipe toca);
  o replay da T1.6b sim. Aceitar, ou a ação expõe as etapas para a sala intercalar?
- **P4 (dono).** A 1b estima 11 a 15 dias úteis, acima das 2 semanas. Estender o prazo, ou cortar a T1.9 para depois da Fase 2 (§5)?
- **P5.** `shovel.ts` usa tipos do `game-terrain`: a regra da pá vai para `game-weapons` (que hoje só depende do `game-contracts`) com esses
  tipos passados pelo `game-contracts`, ou fica em L5?
