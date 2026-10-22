# @adatechnology/game-devtools

In-game test tooling for three.js games. It knows nothing about any game: the host plugs everything in through options and a handful of
registration calls.

- **Free-fly mode** that goes through everything (bounded, mouse-wheel speed).
- **Position HUD**: area, coordinates, compass heading, look angle, time of day, optional extras.
- **Notes and marks**: "mark this place" form with team and note. Marks are stored in the page's server database when one is available
  (`window.claude`), otherwise in `localStorage`, with copy-all and download. Pure helpers format and serialise them.
- **Panel** with on/off switches, action buttons, time-of-day buttons and grouped test places.
- **Scenarios runner**: apply a scenario by id and run an automatic check that returns `{ criterion: { ok, note } }`.
- **Entity labels** floating over world points.
- Localised (`en`, `pt-BR`); every default string can be overridden.

`three` is a peer dependency used for types only: you pass your own `THREE` instance at runtime.

## Install

```sh
pnpm add @adatechnology/game-devtools three
```

Browser without a bundler (the global is `GameDevtools`):

```html
<script src="https://unpkg.com/@adatechnology/game-devtools/dist/index.global.js"></script>
<script>
  const dev = GameDevtools.create(THREE, { locale: 'en' })
</script>
```

## Usage

```ts
import * as THREE from 'three'
import { create } from '@adatechnology/game-devtools'

const dev = create(THREE, {
  marksStorageKey: 'my-game-marks',
  teams: [['map', 'Map'], ['art', 'Art']],
  area: (x, z) => 'Plaza',
  time: () => '12:00',
  notify: (text, seconds) => showToast(text, seconds),
  position: () => ({ x, y, z, yaw, pitch }),
  bounds: { x: [-500, 500], y: [0.4, 260], z: [-500, 500] },
  pause: (paused) => { /* release the mouse, pause the game */ },
  locale: 'en', // or 'pt-BR'
})

dev
  .toggle('fog', 'Fog', () => fog, (on) => { fog = on })
  .action('spawn', 'Spawn zombie', () => { spawn(); return true /* keep the panel open */ })
  .timesOfDay([['Morning', 0.3], ['Night', 0.9]], setTimeOfDay)
  .places(() => [['City', [['Plaza', () => teleport(0, 0)]]]])
  .labelsFor((camera) => [{ x, y, z, text: 'npc-12', color: '#9fd0ff' }])
  .scenarios(list, (scenario) => apply(scenario), (scenario) => ({ lit: { ok: isLit(), note: '...' } }))

dev.goTo = (x, y, z, yaw, pitch) => teleport(x, y, z, yaw, pitch)

// every frame
if (dev.flying) {
  dev.fly(dt, yaw, pitch, { forward, strafe, up, fast })
  dev.flyCamera(camera, yaw, pitch)
}
dev.update(dt, camera, visible)

// your own keys
dev.open('form') // or 'list'; dev.close()
dev.expose() // window.__scenario, __scenarioCheck, __scenarioList, __devtools for Playwright
```

Keys stay in the game. Free-fly is on when you set `dev.flying = true`.

## API

### `create(THREE, options?) => Devtools`

| Option | Default | Meaning |
|---|---|---|
| `marksStorageKey` | `'game-devtools-marks'` | localStorage key for marks |
| `collection` | `'marks'` | Server database collection |
| `fileName` | locale (`marks.txt` / `marcas.txt`) | Name of the downloaded file |
| `teams` | `[['general', 'General']]` | `[id, label]` pairs for the form |
| `area(x, z)` | `''` | Area name |
| `time()` | `''` | Time-of-day text |
| `notify(text, seconds)` | no-op | Short messages to the player |
| `pause(paused)` | no-op | Called with `true` when a panel opens and `false` when it closes |
| `position()` | origin | `{ x, y, z, yaw, pitch }` of the player |
| `bounds` | +-1e4 / y 0.4..400 | Free-fly limits |
| `speed` | `14` | Initial free-fly speed (m/s) |
| `labelsMax` | `48` | Label pool size |
| `locale` | `'en'` | `'en'` or `'pt-BR'` |
| `strings` | | Partial overrides of any user-facing string |

### `Devtools`

State (read/write): `flying`, `x`, `y`, `z`, `speed`, `hud`, `showLabels`, `goTo`, `extras`. State (read): `openPanel`, `marks`, `db`, `scenarioList`,
`activeScenario`.

Methods: `compass(yaw)`, `here()`, `line(mark)`, `fly(dt, yaw, pitch, keys)`, `flyCamera(camera, yaw, pitch)`, `toggle(...)`, `action(...)`,
`timesOfDay(...)`, `places(...)`, `labelsFor(...)`, `scenarios(list, apply, check)`, `scenario(id)`, `check(id?)`, `open(panel)`, `close()`, `render()`,
`update(dt, camera, visible?)`, `expose()`, `dispose()`.

### Pure helpers (no DOM)

`compass(yaw, headings)`, `formatMarkLine(mark, teams, strings)`, `sortMarks(marks)`, `serializeMarks(marks, teams, strings)` (returns `{ text, file }`; `file`
is the text plus the raw JSON array), `createScenarioRunner()`, `escapeHtml(s)`, and the `locales` table.

Coming from the Portuguese `ModoLivreSDK`? See [MIGRATION.md](./MIGRATION.md).

## Português

Ferramentas de teste dentro do jogo para three.js: voo livre que atravessa tudo, posição na tela, marcas com nota (banco do artifact ou
navegador), painel com chaves, ações, hora e lugares de teste, cenários com checagem automática e etiquetas sobre entidades. Não conhece nenhum jogo.

```ts
const dev = create(THREE, { locale: 'pt-BR', teams: [['mapa', 'Mapa']], area, time, notify, position, pause })
dev.toggle('neblina', 'Neblina', () => neblina, (on) => { neblina = on })
```

Com `locale: 'pt-BR'` todos os textos (HUD, painel, formulário, mensagens, pontos cardeais "N NE L SE S SO O NO") ficam idênticos aos do SDK
original. A tabela de nomes antigos e novos está em [MIGRATION.md](./MIGRATION.md).
