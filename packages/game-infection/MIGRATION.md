# Migration: `Contagio` (contagio.js) to `@adatechnology/game-infection`

Source: `implementacao/sdk/contagio/contagio.js` (+ `LEIAME.md`, `teste.mjs`). Every old name maps to exactly one new name. The model logic is
unchanged: the same data gives bit-identical results (checked by running both on the Valley scenario and comparing every compartment of every
region plus `materializar` seeds, difference 0).

## Loading

| Old | New |
|---|---|
| `<script>` global `Contagio` / `require('./contagio.js')` | ESM `import { create } from '@adatechnology/game-infection'`, or IIFE `dist/index.global.js` exposing `GameInfection` |
| `Contagio.criar(dados)` | `GameInfection.create(config)` |
| `Contagio.ESTAGIOS` | `GameInfection.STAGES` |
| `Contagio.versao` | `GameInfection.version` |
| (internal defaults) | `GameInfection.DEFAULT_PARAMS` (new export) |

## Config (`criar` argument)

| Old | New |
|---|---|
| `semente` | `seed` |
| `incubacaoHoras` | `incubationHours` |
| `horaInicial` | `startHour` |
| `foco` | `focus` |
| `parametros` | `params` |
| `regioes` | `regions` |
| `ligacoes` | `links` |
| `fases` | `phases` |
| `eventos` | `events` |
| `opcoesInicio` (game data, never read by the SDK) | not part of the config; keep it in the game's own data |

## Parameters (`parametros`)

| Old | New |
|---|---|
| `contagio` | `transmission` |
| `contagioContido` | `containedTransmission` |
| `contagioInvasao` | `invasionTransmission` |
| `pisoAbrigados` | `shelteredFloor` |
| `curiosidade` | `curiosity` |
| `noite` | `night` |
| `horaNoite` | `nightHours` |
| `escapeContidos` | `containedEscape` |
| `fracaoEscondeMax` | `hideFractionMax` |
| `fracaoEscondePorConsciencia` | `hideFractionPerAwareness` |
| `vistoPorAtivo` | `seenPerActive` |
| `escalaVisto` | `seenScale` |
| `ganhoConsciencia` | `awarenessGain` |
| `fugaLeva` | `fleeCarry` |
| `fugaIncubandoMult` | `fleeIncubatingMult` |
| `fugaMax` | `fleeMax` |
| `fugaPressao` | `fleePressure` |
| `limiarCasos` | `thresholdCases` |
| `limiarPanico` | `thresholdPanic` |
| `limiarCaido` | `thresholdFallen` |
| `limiarTomado` | `thresholdOverrun` |

## Region definition (`regioes[]`)

| Old | New |
|---|---|
| `id` | `id` |
| `pop` | `pop` |
| `densidade` | `density` |
| `policia` | `police` |
| `multContagio` | `transmissionMult` |
| `urbana` | `urban` |
| `saida` | `exit` |
| `nome`, `lugar` (game data, ignored by the SDK) | still allowed as extra fields; rename in your data as you like |

## Link definition (`ligacoes[]`)

| Old | New |
|---|---|
| `a`, `b` | `a`, `b` |
| `fluxo` | `flow` |
| `ativos` | `active` |
| `desdeFase` | `fromPhase` |

## Phase definition (`fases[]`)

| Old | New |
|---|---|
| `id` | `id` |
| `diaMin` | `dayMin` |
| `diaMax` | `dayMax` |
| `limiar` | `threshold` |
| `consciencia` | `awareness` |
| `abateFixo` | `cullFixed` |
| `abateFracao` | `cullFraction` |
| `abrigo` | `shelter` |
| `fuga` | `flee` |
| `saida` | `exit` |
| `focoTransfer` | `focusTransfer` |
| `nome` (game data) | still allowed as an extra field |

## Events (`eventos[]`)

| Old | New |
|---|---|
| `id` | `id` |
| `hora` | `hour` |
| `acao` | `action` |
| `texto` (game data) | still allowed as an extra field |

Action ids (data ids):

| Old `acao` | New `action` | Fields |
|---|---|---|
| `'semear'` | `'seed'` | `regiao` -> `region`, `n`, `posicaoFila` -> `queuePosition` |
| `'moverPopulacao'` | `'move_population'` | `de` (array) -> `from`, `para` -> `to`, `fracao` -> `fraction`, `levaIncubando` -> `carryIncubating` |
| `'liberarAtivos'` | `'release_active'` | `de` -> `from`, `para` -> `to`, `fracao` -> `fraction` |
| `'avisar'` | `'warn'` | `regiao` -> `region`, `nivel` -> `level`, `guarda` -> `guard` |

## Model methods (return of `criar`)

| Old | New |
|---|---|
| `c.avancar(horas)` | `model.advance(hours)` |
| `c.hora()` | `model.hour()` |
| `c.dia()` | `model.day()` |
| `c.fase()` | `model.phase()` |
| `c.regiao(id)` | `model.region(id)` |
| `c.regioes()` | `model.regions()` |
| `c.total(campo)` | `model.total(field)` |
| `c.infectar(regiao, n, horasPassadas)` | `model.infect(region, n, hoursElapsed)` |
| `c.remover(regiao, n)` | `model.remove(region, n)` |
| `c.avisar(regiao, nivel, guarda)` | `model.warn(region, level, guard)` |
| `c.materializar(regiao, n)` | `model.materialize(region, n)` |
| `c.devolver(regiao, lote)` | `model.giveBack(region, batch)` |
| `c.on(nome, fn)` | `model.on(name, listener)` |
| `c.salvar()` | `model.save()` |
| `c.carregar(json)` | `model.load(json)` |

## Return fields

`fase()` -> `phase()`:

| Old | New |
|---|---|
| `id` | `id` |
| `indice` | `index` |
| `desde` | `since` |
| `proxima` | `next` |

`regiao()` / `regioes()` -> `region()` / `regions()`:

| Old | New |
|---|---|
| `id`, `pop` | `id`, `pop` |
| `livre` | `free` |
| `abrigado` | `sheltered` |
| `incubando` | `incubating` |
| `ativo` | `active` |
| `contido` | `contained` |
| `fora` (left the map) | `departed` |
| `removido` | `removed` |
| `consciencia` | `awareness` |
| `estagio` | `stage` |

`total(campo)` argument (same words as the compartments above): `'livre'` -> `'free'`, `'abrigado'` -> `'sheltered'`, `'incubando'` -> `'incubating'`,
`'ativo'` -> `'active'`, `'contido'` -> `'contained'`, `'fora'` -> `'departed'`, `'removido'` -> `'removed'`.

`materializar()` items (`{ estado, semente }`) -> `materialize()` items:

| Old | New |
|---|---|
| `estado` | `state` |
| `semente` | `seed` |
| `estado: 'ativo'` | `state: 'active'` |
| `estado: 'contido'` | `state: 'contained'` |
| `estado: 'removido'` (accepted by `devolver`) | `state: 'removed'` (accepted by `giveBack`) |

## Notifications (`on`)

| Old event | New event | Payload |
|---|---|---|
| `'fase'` `{ id, hora, total }` | `'phase'` | `{ id, hour, total }` |
| `'estagio'` `{ regiao, de, para, hora }` | `'stage'` | `{ region, from, to, hour }` |
| `'evento'` `{ id, hora }` | `'event'` | `{ id, hour }` |
| `'limiar'` (mentioned in the old header comment, never emitted) | removed | |

## Stage ids (data ids)

| Old | New |
|---|---|
| `calmo` | `calm` |
| `casos` | `cases` |
| `panico` | `panic` |
| `caido` | `fallen` |
| `tomado` | `overrun` |

## Saved state

`salvar()` produced `{ st: { hora, fase, faseDesde }, rs, eventos, R: [...] }`. `save()` now produces
`{ state: { hour, phase, phaseSince }, rng, events, regions: [{ free, sheltered, queue, active, contained, departed, removed, awareness, seen, guard, stage }] }`.
**Old saves are not readable by `load`.** If the game has persisted saves, convert them once in the adapter (key mapping:
`st`->`state`, `hora`->`hour`, `fase`->`phase`, `faseDesde`->`phaseSince`, `rs`->`rng`, `eventos`->`events`, `R`->`regions`,
`livre`->`free`, `abrigado`->`sheltered`, `fila`->`queue`, `ativo`->`active`, `contido`->`contained`, `fora`->`departed`,
`removido`->`removed`, `consciencia`->`awareness`, `visto`->`seen`, `guarda`->`guard`, `estagio`->`stage`) or regenerate them.

## Error messages

`'Contágio: região desconhecida <id>'` -> `'Infection: unknown region <id>'`.

## Behaviour changes beyond renaming

None in the model. The fixture used by the tests is the Valley data translated to the English schema (region ids translated, names/texts dropped:
`centro` -> `downtown`, `jardim` -> `garden`, `vilaesp` -> `hope_village`, `fabril` -> `industrial`, `outros` -> `other_districts`, `sitios` -> `farmland`,
`penit` -> `prison`, `base` -> `army_base`, `tresp` -> `three_bridges`, `porto` -> `port`, `campo` -> `wide_field`, `corvo` -> `crow_village`,
`vilas` -> `villages`). Region ids are game data, so the adapter keeps whatever ids its own data uses.
