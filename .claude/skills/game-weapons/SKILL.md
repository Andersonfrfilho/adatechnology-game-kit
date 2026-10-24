---
name: game-weapons
description: Use quando precisar da regra de armas e munição de um jogo, sem engine, como arma, calibre, tiro, recarga, carregador, modo de disparo, dispersão, recuo, espingarda, corpo a corpo, lança-chamas, granada, ferramenta ou ruído. Cada disparo vira Shot com energia em joules.
---

# @adatechnology/game-weapons

## Objetivo
Armas e munição independentes de engine. 28 calibres reais como dados (energia de boca = `0,5 × m × v²`), 79 armas reais com marca e medidas, 17 explosivos,
42 arquétipos e um runtime determinístico: carregador, modos de tiro, saque, ciclo manual, recarga por tipo com etapas, panes e desobstruir, trava, calor
do cano, dispersão e *bloom*, chumbos de espingarda, recuo e ruído, mais corpo a corpo, chama, calor, arremessáveis, lançadores, ferramentas e extintor. Puxar o gatilho devolve dados puros (`Shot`, `Use`) que qualquer modelo de dano consome.
Unidades: metros, segundos, joules, mm (diâmetro), gramas (projétil), m/s, graus, °C.

## Quando usar e quando não usar
- Use para: calcular o que acontece ao puxar o gatilho, controlar munição e recarga, listar armas e calibres.
- Não use para modelo 3D, animação ou som (é o `game-weapons-three`), nem para dano em pessoas (`game-characters`) ou em objetos (`game-destruction`).

## Como usar
```ts
import { createArsenal } from '@adatechnology/game-weapons'

const arsenal = createArsenal({ seed: 42, locale: 'pt-BR' })
const gun = arsenal.create('shotgun_pump_12', { reserve: 24 })
arsenal.name('shotgun_pump_12') // "espingarda de repetição calibre 12"

// a cada quadro
gun.update(dt)
if (mouseDown) {
  const result = gun.trigger(cameraPos, cameraDir, dt, mouseHeldSinceLastFrame)
  for (const shot of result.shots) world.shoot(shot.origin, shot.direction, shot.energy, shot.caliber) // game-destruction
  for (const use of result.uses) handleUse(use) // golpe, chama, arremesso, ferramenta
  camera.kick(...result.recoil) // [pitch, yaw] em graus
  horde.hear(cameraPos, result.noise) // metros
} else gun.release()
if (reloadKey) gun.reload()
```
`semi`, `single`, `pump` e `bolt` disparam uma vez por puxada: com `held = true` só o primeiro quadro atira (status `cooldown` depois) até `release()`.
`auto` dispara na cadência enquanto segurado; `burst` emite as balas juntas numa chamada (`result.rounds` e `result.roundTimes` dizem quantas e quando).
Panes: `result.fault` (ou `status` `fault`/`misfire`); `weapon.clearFault()` desobstrui em 1,2 s. `weapon.drain()` devolve os eventos para animar e tocar som.

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createArsenal(options?)` | `Arsenal`: `create(id, { seed?, reserve?, condition?, ammoQuality? })`, `muzzleEnergy`, `energy`, `name`, `list(category?)`, mapas `calibers`, `weapons`, `explosives`, `rules`; opções `weapons`, `calibers`, `explosives`, `patch`, `remove`, `include`, `rules`, `strings` |
| `WeaponState` | `ammo`, `capacity`, `reserve`, `mode`, `reloading`, `locked`, `phase`, `fault`, `safety`, `heat`, `heatLevel`, `spread`, `trigger`, `release` (devolve o arremesso da granada cozida), `cooking`, `setFuseLength`, `draw`, `reload(kind?)`, `cycleMode`, `setSafety`, `clearFault`, `setCondition`, `setAmmoQuality`, `update`, `refill`, `drain` |
| `Shot` | `origin`, `direction`, `energy` (J), `caliber` (mm), `caliberId`, `speed`, `energyAt(distância)`, `pellet`, `weapon`, `source` |
| `Use` | `melee`, `flame`, `heat`, `throw` (com `explosive`, `trigger`, `armDistance`), `place` (mina, C4), `backblast`, `tool`, `extinguish`, `hand` |
| `createExplosiveBody(use, arsenal.explosives, arsenal.rules.explosives)` | `ExplosiveBody` de um `throw`/`place`: `step(dt, probe?)` voa com gravidade, quica, conta a espoleta e devolve eventos `armed`, `impact`, `dud`, `detonate`; `trigger('wire'\|'remote'\|…)` dispara a carga posta |
| `blastEffect(detonation, ponto)`, `backblastEffect(use, ponto)` | zona (`lethal`, `injury`, `none`), queda de 1 a 0 e atordoamento; cone da Claymore; perigo atrás do lançador |
| `TriggerResult` | `shots`, `uses`, `status` (`ok`, `empty`, `reloading`, `cooldown`, `no_fuel`, `safe`, `drawing`, `fault`, `misfire`, `clearing`), `recoil`, `noise`, `rounds`, `roundTimes`, `fault?` |
| `CALIBERS`, `WEAPONS`, `EXPLOSIVES`, `ARCHETYPE_IDS`, `DEFAULT_LOADOUT` | dados embutidos (28 calibres, 79 armas reais + 42 arquétipos, 17 explosivos, kit inicial) |
| `DEFAULT_RULES`, `RELOAD_STAGES`, `checkArsenal` | números das regras (panes, calor, ruído, tempos), ordem das etapas de recarga e verificação de consistência |
| `muzzleEnergy(calibre, cano?)` | energia de um projétil (ou de um chumbo) |
| `resolveStrings`, `locales` | nomes em `en` e `pt-BR` |

## Explosivos e lançadores (T1.5)
```ts
const result = launcher.trigger(pos, dir, dt)            // rpg_7, at4, m72_law, carl_gustaf_m4, m79
const [projectile, backblast] = result.uses              // throw (explosive, trigger 'impact', armDistance 10 m) + backblast (5 m, cone de 19°)
const body = createExplosiveBody(projectile, arsenal.explosives, arsenal.rules.explosives)
for (const event of body.step(dt, (from, to) => raycast(from, to))) {   // probe: { point, normal, ground? } ou null
  if (event.type === 'detonate') for (const target of targets) apply(blastEffect(event.detonation, target.position))
}
mine.trigger(pos, dir, 0)                                // claymore/c4: use `place`; body.trigger('wire') / body.trigger('remote')
const wire = tripwireSegment(placeUse)                   // claymore: { from, to } do fio; quando um corpo cruza, body.trigger('wire')
```
- Foguete é projétil físico (velocidade do lançador, gravidade 9,8, jogo.js 68303); abaixo de `armDistance` (10 m) bate sem explodir (`dud`).
- Cozinhar (dono, 2026-10-24): `trigger` num arremessável de espoleta tira o pino (`cook` start), `release(origin, dir)` DEVOLVE o arremesso com a espoleta que sobrou (`use.fuse`, `use.cooked`); segurar além da espoleta explode na mão (`use.inHand`, `cook` burst). Impacto (molotov, lançadores) e postos (C4, Claymore, dinamite de pavio longo) agem no puxão.
- Espoleta: `fuse` fixo, `fuseRange` sorteado por arremesso em fluxo próprio (flashbang 1,0 a 2,3 s da M84), ou `fuseLength` × `burnRate` ± `burnTolerance` (dinamite 0,03 m a 131 s/m ±10%, cerca de 4 s); `setFuseLength` ou `patch.explosives` alongam; a partir de `rules.explosives.placeFuseFrom` (10 s) vira carga posta acesa.
- Claymore dispara por fio (`tripwire`: 10 m, 0°, 0,15 m, derivado; configurável por explosivo ou em `rules.explosives.tripwire`), não pelo jogador; o detonador (`remote`) é do C4.
- Granada: espoleta conta do arremesso (M67 4 s); molotov explode no primeiro choque e deixa fogo de 4 m por 9 s; flashbang atordoa 4 s até 10 m; Claymore só atinge o cone de 60° (letal 15 m, ferimento 50 m); C4 só responde ao detonador (`remote`).
- Quique do jogo (`rules.explosives`): chão devolve 35% da queda e 60% do que anda; parede 40%.
- Cada explosivo do mundo (`propane_p13`, `fuel_barrel`, `car_fuel_tank`, `fuel_pump`, `fuel_station_tank`) traz `chain` (tempos entre tiro, fogo ou explosão vizinha e a explosão); `game-destruction` usa em `explosivePart`.
- Lança-chamas: `flame` com `range` (M2 6 m, caseiro 3,6 m), `fuelPerSecond` e combustível em segundos (M2 9 s, caseiro 5 s); o último tick é cortado ao que sobra.

## Compõe com
- `@adatechnology/game-contracts`: dono dos tipos `Shot`, `Use` e `Vec3` (reexportados aqui).
- `game-destruction`: recebe `shot.energy` e `shot.caliber` direto em `world.shoot`.
- `game-weapons-three`: modelo 3D, arma na mão, cápsulas e som sobre este runtime.
- Regra do projeto: o jogo só junta; não reimplemente tabela de armas no jogo.

## Ambiente de teste
`examples/weapons-test-area` (ver `game-weapons-three`): `node build.mjs` gera `dist/sala-armas.html`, a sala de testes com todas as armas em balcões.
Os testes do pacote estão em `packages/game-weapons/tests/` (`weapons`, `rules`, `catalog`, `arsenal-options` e o golden da Galeria em `team-golden`). A área mostra as 121 armas e ferramentas em até seis balcões. Golden por arma: `tests/weapon-goldens.test.ts` roda um cenário com semente (saque, trava, cada modo de tiro, vazio, as recargas que a arma tem, pane forçada e destravar) e compara a sequência de eventos, munição, reserva e calor de cada passo com `tests/fixtures/rule-goldens/weapon-scenarios.json`; mudou a regra de propósito: `UPDATE_GOLDEN=1 pnpm --filter @adatechnology/game-weapons test` e leia o diff.

## Cuidados
- A recarga nunca é automática: o jogo chama `reload()`. Arma de tubo carrega uma bala por `reload` segundos e o gatilho interrompe.
- Chame `trigger(dt)` e `update(dt)` no mesmo quadro sem medo: o `dt` não conta em dobro.
- Espingarda gera **um `Shot` por chumbo** (`12ga_00buck` 9, `12ga_birdshot` 90); a energia é por chumbo.
- O sorteio vem da semente: mesma semente, mesmos tiros em qualquer máquina. Cada portador cria o seu `WeaponState`.
- `create` com id desconhecido lança erro. Locale desconhecido cai em `en`; rótulos de calibre não são traduzidos.
- `flame`/`heat` gastam `fuelPerSecond × dt`; `throwable` arremessa com leve arco para cima (o de espoleta de tempo no `release`, ver acima). Molotov, M67 e companhia seguem o `ExplosiveDef` (espoleta, fogo, energia): trocar o explosivo troca o arremessável.
- O alcance (`range`) não corta o tiro: a energia só decai (`energyAt`); quem corta é o host.
- Panes vêm ligadas por padrão (condição `new`, 0,3% por cartucho); sala de teste e jogo que não tratam `fault` passam `rules: { faults: false }`. O sorteio da pane usa outra sequência (`seed ^ 0x6a09e667`): a dispersão de uma semente não muda.
- Arco e besta não têm estojo: não esquentam e nunca engasgam. O cartucho na câmara (`chamber`) é só dado; `capacity` é o carregador.
- `drain()` esvazia a lista de eventos: chame uma vez por quadro (a sala de teste faz isso e os converte para eventos do host).

## O que vem pela migração (spec 001)
Já entrou (T1.1): a lista é a **união das fontes** (A1) com marcas e modelos reais (G5): 79 armas reais, 6 lançadores, 17 explosivos; 28 calibres (9×18, 5,7×28, .44 Mag,
.50 AE, 5,45×39, .30-30, 7,62×54R, .30-06, .300 WM, .408; .50 BMG em 12,7 mm, A6); tempos do Arsenal (A5), fases com tempo e eventos (saque, ciclo, recarga tática, vazia e
um a um, pane, desobstruir), calor do cano, ruído do Arsenal 150 / 300 / 420 / 600 m (A3) e dois raios de explosão (E3). Falta:
- Modelos 3D, animação por família e a área com todas as armas (T1.2 a T1.4). Entrou na T1.5: lançador completo, arremessáveis, cargas postas, lança-chamas e a cadeia dos explosivos do mundo.
- (Feito na T1.3) Teclas X (desobstruir) e B (trava) na sala; a sala usa as panes da regra. Y detona as cargas postas (T1.6).
- Força de penetração por calibre, para o dano em corpos (P7). O jogo passa a atirar por este pacote (A12).
