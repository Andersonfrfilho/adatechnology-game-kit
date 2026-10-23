---
name: game-weapons
description: Use quando precisar da regra de armas e munição de um jogo, sem engine, como arma, calibre, tiro, recarga, carregador, modo de disparo, dispersão, recuo, espingarda, corpo a corpo, lança-chamas, granada, ferramenta ou ruído. Cada disparo vira Shot com energia em joules.
---

# @adatechnology/game-weapons

## Objetivo
Armas e munição independentes de engine. Calibres reais como dados (energia de boca = `0,5 × m × v²`), arquétipos de armas e um runtime pequeno e
determinístico: carregador, modos de tiro, recarga, dispersão e *bloom*, chumbos de espingarda, recuo e ruído, mais corpo a corpo, chama, calor,
arremessáveis, ferramentas e extintor. Puxar o gatilho devolve dados puros (`Shot`, `Use`) que qualquer modelo de dano consome.
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
`auto` dispara na cadência enquanto segurado; `burst` emite as balas juntas numa chamada.

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createArsenal(options?)` | `Arsenal`: `create(id, { seed?, reserve? })`, `muzzleEnergy`, `name`, `list(category?)`, mapas `calibers` e `weapons` |
| `WeaponState` | `ammo`, `capacity`, `reserve`, `mode`, `reloading`, `spread`, `trigger`, `release`, `reload`, `cycleMode`, `update`, `refill` |
| `Shot` | `origin`, `direction`, `energy` (J), `caliber` (mm), `caliberId`, `speed`, `energyAt(distância)`, `pellet`, `weapon`, `source` |
| `Use` | `melee`, `flame`, `heat`, `throw`, `tool`, `extinguish`, `hand` |
| `TriggerResult` | `shots`, `uses`, `status` (`ok`, `empty`, `reloading`, `cooldown`, `no_fuel`, `safe`), `recoil`, `noise` |
| `CALIBERS`, `WEAPONS`, `DEFAULT_LOADOUT` | dados embutidos (18 calibres, armas por categoria, kit inicial de 19 ids) |
| `muzzleEnergy(calibre, cano?)` | energia de um projétil (ou de um chumbo) |
| `resolveStrings`, `locales` | nomes em `en` e `pt-BR` |

## Compõe com
- `@adatechnology/game-contracts`: dono dos tipos `Shot`, `Use` e `Vec3` (reexportados aqui).
- `game-destruction`: recebe `shot.energy` e `shot.caliber` direto em `world.shoot`.
- `game-weapons-three`: modelo 3D, arma na mão, cápsulas e som sobre este runtime.
- Regra do projeto: o jogo só junta; não reimplemente tabela de armas no jogo.

## Ambiente de teste
`examples/weapons-test-area` (ver `game-weapons-three`): `node build.mjs` gera `dist/sala-armas.html`, a sala de testes com todas as armas em balcões.
Os testes do pacote estão em `packages/game-weapons/tests/weapons.test.ts`.

## Cuidados
- A recarga nunca é automática: o jogo chama `reload()`. Arma de tubo carrega uma bala por `reload` segundos e o gatilho interrompe.
- Chame `trigger(dt)` e `update(dt)` no mesmo quadro sem medo: o `dt` não conta em dobro.
- Espingarda gera **um `Shot` por chumbo** (`12ga_00buck` 9, `12ga_birdshot` 90); a energia é por chumbo.
- O sorteio vem da semente: mesma semente, mesmos tiros em qualquer máquina. Cada portador cria o seu `WeaponState`.
- `create` com id desconhecido lança erro. Locale desconhecido cai em `en`; rótulos de calibre não são traduzidos.
- `flame`/`heat` gastam `fuelPerSecond × dt`; `throwable` arremessa uma vez por puxada, com leve arco para cima.
- O alcance (`range`) não corta o tiro: a energia só decai (`energyAt`); quem corta é o host.
- Hoje os nomes de armas são genéricos (sem marca); a migração muda isso.

## O que vem pela migração (spec 001)
- Lista de armas vira a **união de todas as fontes** (A1): 77 da Galeria, granadas e explosivos do Laboratório, molotov, lança-chamas, arco, besta e ferramentas. **Marcas e modelos reais** entram no SDK (G5).
- Calibres novos: 9×18, 5,7×28, .44 Mag, .50 AE, 5,45×39, .30-30, 7,62×54R, .30-06, .300 WM, .408; .50 BMG fica em 12,7 mm (A6, A7).
- Contratos de animação (A5): o pacote dá as fases com tempo (sacar, atirar, ciclar, recarga tática e vazia, pane, destravar) e emite eventos; tempos do Arsenal.
- Ruído do Arsenal: 150 / 300 / 600 m (A3). Dois raios de explosão, letal e de ferimento, como dado aqui (E3).
- Força de penetração por calibre, para o dano em corpos (P7). O jogo passa a atirar por este pacote (A12).
