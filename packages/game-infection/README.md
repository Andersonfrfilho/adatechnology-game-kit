# @adatechnology/game-infection

Abstract, deterministic simulation of anything that spreads by contact with a delay (zombies, plague, rumours), by regions.
There is nothing game-specific inside: regions, links, phases and events come from the host as data. Zero runtime dependencies; works in the
browser and in Node.

- Per-region compartments: `free`, `sheltered`, `incubating` (a queue of N hours), `active`, `contained`, `departed` (left the map), `removed`.
- One-hour steps. Same configuration and same calls give the same result (seeded PRNG), and `save()` / `load()` round-trip exactly.
- Emits `phase`, `stage` and `event` notifications.
- Lets a game hand real bites and kills to the model (`infect`, `remove`, `warn`) and take agents out of it (`materialize`, `giveBack`).

## Install

```sh
pnpm add @adatechnology/game-infection
```

Browser without a bundler (the global is `GameInfection`):

```html
<script src="https://unpkg.com/@adatechnology/game-infection/dist/index.global.js"></script>
<script>
  const model = GameInfection.create(data)
</script>
```

## Usage

```ts
import { create, type InfectionConfig } from '@adatechnology/game-infection'

const data: InfectionConfig = {
  seed: 20261022,
  incubationHours: 48,
  startHour: -144,
  focus: 'hospital', // urban regions send incubating people here
  params: { transmission: 0.7 },
  regions: [
    { id: 'downtown', pop: 7200, density: 1.4, police: 6, urban: 1 },
    { id: 'hospital', pop: 700, density: 2.2, police: 1, transmissionMult: 1.3 },
  ],
  links: [{ a: 'downtown', b: 'hospital', flow: 0.012 }],
  phases: [
    { id: 'routine', dayMin: -99, dayMax: -99, threshold: 0, awareness: 0, cullFixed: 0.004, cullFraction: 0.002, shelter: 0, flee: 0, exit: 0, focusTransfer: 0.008 },
    // ...
  ],
  events: [{ id: 'lab_bites', hour: -122, action: 'seed', region: 'downtown', n: 4 }],
}

const model = create(data)
model.on('phase', (p) => console.log('phase', p.id, 'at hour', p.hour))
model.on('stage', (s) => console.log(s.region, s.from, '->', s.to))
model.advance(24) // one day
model.region('downtown') // { free, sheltered, incubating, active, contained, departed, removed, awareness, stage, ... }
model.total('active')
```

## Model

Every region keeps `free`, `sheltered`, `incubating` (a queue of `incubationHours`), `active`, `contained` (turned while hiding at home),
`departed` and `removed`. One step is one game hour:

1. Events of the hour (`seed`, `move_population`, `release_active`, `warn`).
2. Transmission: `new = transmission x density x (1 + (1 - awareness) x curiosity) x night x active x free / present`. Sheltered people are only
   infected by contained ones and by invasion, with a floor that is never infected.
3. The queue advances; whoever reaches the end becomes `contained` (a share that grows with awareness) or `active`.
4. Phase cull (fixed x police of the region + fraction), sheltering, contained people escaping.
5. Links: fleeing carries free and hidden-incubating people; `active` can cross links with `fromPhase`.
6. Exit of the map in regions with `exit`; transfer to the `focus` region from `urban` regions.
7. The next phase starts when the day is within `dayMin..dayMax` and the total passes `threshold`, or when `dayMax` arrives.

Stages per region (`STAGES`): `calm`, `cases`, `panic`, `fallen` (15% turned), `overrun` (less than 10% alive).

## API

### `create(config) => Infection`

| Config field | Meaning |
|---|---|
| `seed` | PRNG seed (used by `materialize`) |
| `incubationHours` | Queue length, default `48` |
| `startHour` | Initial hour (negative = prologue) |
| `focus` | Region id receiving incubating people from `urban` regions |
| `params` | Partial `InfectionParams` over `DEFAULT_PARAMS` |
| `regions` | `RegionDef[]` (`id`, `pop`, `density`, `police`, `transmissionMult`, `urban`, `exit`) |
| `links` | `LinkDef[]` (`a`, `b`, `flow`, `active`, `fromPhase`) |
| `phases` | `PhaseDef[]` |
| `events` | `InfectionEvent[]`, discriminated by `action` |

### `Infection`

| Member | Description |
|---|---|
| `advance(hours = 1)` | Run abstract steps (returns the model) |
| `hour()`, `day()`, `phase()` | Clock and current `{ id, index, since, next }` |
| `region(id)`, `regions()` | Snapshot(s) of the compartments, `awareness` and `stage` |
| `total(field)` | Sum of a compartment (`'incubating'` included) |
| `infect(region, n, hoursElapsed)` | A real bite enters the incubation queue |
| `remove(region, n)` | A real kill |
| `warn(region, level, guard)` | Raise awareness; `guard < 1` reduces who flees in |
| `materialize(region, n)` | Take `n` infected out as `{ state, seed }` seeds |
| `giveBack(region, batch)` | Return them |
| `on('phase' \| 'stage' \| 'event', fn)` | Subscribe |
| `save()`, `load(json)` | Serialise / restore the whole state |

Coming from the Portuguese `Contagio` SDK? See [MIGRATION.md](./MIGRATION.md). The test suite uses the ZombiAdA "Valley" scenario translated to
the English schema as a fixture (`tests/fixtures/valley-outbreak.json`).

## Português

Simulação abstrata e determinística de qualquer coisa que se espalha por contato com atraso (zumbi, praga, boato), organizada por regiões. Não
tem nada de jogo dentro: regiões, ligações, fases e eventos chegam como dados.

```ts
const modelo = create(dados)
modelo.advance(24) // avança um dia
modelo.region('downtown').active // ativos na região
```

Os identificadores agora estão em inglês (`regions`, `links`, `phases`, `events`, `advance`, `infect`, `warn`...). A tabela completa de nomes
antigos e novos está em [MIGRATION.md](./MIGRATION.md).
