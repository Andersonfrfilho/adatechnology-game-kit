# Migration: `ModoLivreSDK` (modo-livre.js) to `@adatechnology/game-devtools`

Source: `sdk/teste/modo-livre.js` and its README. Every old name maps to exactly one new name. With `locale: 'pt-BR'` every user-facing string is
identical to the original (checked by running both implementations on the same inputs and comparing HUD, form and panel texts, placeholders,
aria-labels, notification messages and the copy text).

## Loading

| Old | New |
|---|---|
| global `ModoLivreSDK` (concatenated `<script>`) | ESM `import { create } from '@adatechnology/game-devtools'`, or IIFE `dist/index.global.js` exposing `GameDevtools` |
| `ModoLivreSDK.criar(THREE, cfg)` | `GameDevtools.create(THREE, options)` |

## Options (`criar` second argument)

| Old | New |
|---|---|
| `chaveMarcas` (default `'sdk-modo-livre-marcas'`) | `marksStorageKey` (default `'game-devtools-marks'`) |
| `colecao` (default `'marcas'`) | `collection` (default `'marks'`) |
| `arquivo` (default `'marcas.txt'`) | `fileName` (default from the locale: `marks.txt` / `marcas.txt`) |
| `equipes` (default `[['geral', 'Geral']]`) | `teams` (default `[['general', <locale label>]]`) |
| `area` | `area` |
| `hora` | `time` |
| `msg(texto, segundos)` | `notify(text, seconds)` |
| `pausa(aberto)` | `pause(paused)` |
| `pos()` | `position()` |
| `limites` | `bounds` |
| `velocidade` | `speed` |
| `etiquetasMax` | `labelsMax` |
| `etiquetasDist` | `labelsDistance` (still not read, kept for compatibility) |
| (none) | `locale` (`'en'` default, `'pt-BR'`) and `strings` (partial overrides) |

Data that already exists under the old defaults keeps working if you pass the old values: `marksStorageKey: 'sdk-modo-livre-marcas'`,
`collection: 'marcas'`. The ZombiAdA adapter passes its own `chaveMarcas`, so only `collection` matters for server-side marks. Stored marks also carry
renamed fields (see "Mark fields" below): marks saved by the old SDK have `rumo`/`graus`/`olhar`/`hora`/`voo` and need a one-off conversion, or
simply start fresh.

Team ids are game data, so `'geral'` stays valid if you declare `teams` yourself.

## Returned object (`ml`)

State and fields:

| Old | New |
|---|---|
| `ml.voo` | `dev.flying` |
| `ml.x`, `ml.y`, `ml.z` | `dev.x`, `dev.y`, `dev.z` |
| `ml.vel` | `dev.speed` |
| `ml.hud` | `dev.hud` |
| `ml.aberto` (`null`, `'form'`, `'lista'`) | `dev.openPanel` (`null`, `'form'`, `'list'`) |
| `ml.db` | `dev.db` |
| `ml.marcas` | `dev.marks` |
| `ml.chaves` | internal (use `dev.toggle`) |
| `ml.acoes` | internal (use `dev.action`) |
| `ml.horas` | internal (use `dev.timesOfDay`) |
| `ml.grupos` | internal (use `dev.places`) |
| `ml.cens` | `dev.scenarioList` (read-only) |
| `ml.cenAtivo` | `dev.activeScenario` (read-only) |
| `ml.etiq` | `dev.showLabels` |
| `ml.etiquetas` | internal (use `dev.labelsFor`) |
| `ml.abertos` | internal (which place groups are expanded) |
| `ml.irPara` | `dev.goTo` |
| `ml.extras` | `dev.extras` |

Methods:

| Old | New |
|---|---|
| `ml.rumo(yaw)` | `dev.compass(yaw)` |
| `ml.aqui()` | `dev.here()` |
| `ml.linha(marca)` | `dev.line(mark)` |
| `ml.voa(dt, yaw, pitch, teclas)` | `dev.fly(dt, yaw, pitch, keys)` |
| `ml.cameraVoo(cam, yaw, pitch)` | `dev.flyCamera(camera, yaw, pitch)` |
| `ml.chave(id, nome, get, set)` | `dev.toggle(id, label, get, set)` |
| `ml.acao(id, nome, fn)` | `dev.action(id, label, fn)` |
| `ml.horasDoDia(lista, set)` | `dev.timesOfDay(list, set)` |
| `ml.lugares(fn)` | `dev.places(fn)` |
| `ml.etiquetasDe(fn)` | `dev.labelsFor(fn)` |
| `ml.cenarios(lista, aplicar, checar)` | `dev.scenarios(list, apply, check)` |
| `ml.cenario(id)` | `dev.scenario(id)` |
| `ml.checar(id)` | `dev.check(id)` |
| `ml.abre('form' \| 'lista')` | `dev.open('form' \| 'list')` |
| `ml.fecha()` | `dev.close()` |
| `ml.render()` | `dev.render()` |
| `ml.atualiza(dt, cam, visivel)` | `dev.update(dt, camera, visible)` |
| `ml.expoe()` | `dev.expose()` |
| (none) | `dev.dispose()` (new) |

## Key object for `voa` (`fly`)

| Old | New |
|---|---|
| `frente` | `forward` |
| `lado` | `strafe` |
| `sobe` | `up` |
| `rapido` | `fast` |

## Mark and `aqui()` (`here()`) fields

| Old | New |
|---|---|
| `x`, `y`, `z`, `yaw`, `pitch` | unchanged |
| `area` | `area` |
| `rumo` | `heading` |
| `graus` | `degrees` |
| `olhar` | `look` |
| `hora` | `time` |
| `voo` | `flying` |
| `team`, `text`, `at`, `by`, `id` (mark only) | unchanged |

`rumo(yaw)` returned `[rumo, graus]`; `compass(yaw)` returns `[heading, degrees]`.

## Callback and registration argument shapes

| Old | New |
|---|---|
| `lugares(() => [[grupo, [[nome, ir]]]])` | `places(() => [[group, [[name, go]]]])` (same shape) |
| `etiquetasDe(cam => [{ x, y, z, texto, cor }])` | `labelsFor(camera => [{ x, y, z, text, color }])` |
| `texto` | `text` |
| `cor` | `color` |
| `horasDoDia([[nome, valor]], set)` | `timesOfDay([[label, value]], set)` (same shape) |
| `cenarios(lista, aplicar, checar)`: `checar(c) -> { criterio: { ok, nota } }` | `scenarios(list, apply, check)`: `check(s) -> { criterion: { ok, note } }` |
| `nota` | `note` |
| `chave(...)` `set` returns `true` to close the panel | `toggle(...)` `set` returns `true` to close the panel (same) |
| `acao(...)` `fn` returns `true` to keep the panel open | `action(...)` `fn` returns `true` to keep the panel open (same) |

## Browser-test globals (`expoe`)

| Old | New |
|---|---|
| `window.__cenario` | `window.__scenario` |
| `window.__cenCheck` | `window.__scenarioCheck` |
| `window.__cenLista` | `window.__scenarioList` |
| `window.__modoLivre` | `window.__devtools` |

## DOM (ids, classes, data attributes)

| Old | New |
|---|---|
| `#mlpos`, `.mlpos`, `.mlpos.voo` | `#gd-pos`, `.gd-pos`, `.gd-pos.flying` |
| `#mlform` | `#gd-form` |
| `#mllista` | `#gd-list` |
| `.mlpainel` | `.gd-panel` |
| `#mlet`, `.mlet` | `#gd-labels`, `.gd-labels` |
| `.mlrow` | `.gd-row` |
| `.mlsub` | `.gd-sub` |
| `.mlm` | `.gd-mark` |
| `.mlcopia`, `#mlcopia` | `.gd-copy`, `#gd-copy` |
| `#mleq` | `#gd-team` |
| `#mltxt` | `#gd-note` |
| `#mlbaixar` | `#gd-download` |
| `data-f="salva" / "fecha" / "copiar" / "baixar"` | `data-f="save" / "close" / "copy" / "download"` |
| `data-tg` | `data-toggle` |
| `data-ac` | `data-action` |
| `data-hora` | `data-time` |
| `data-lug` | `data-place` |
| `data-ir` | `data-goto` |
| `data-apaga` | `data-delete` |
| `data-g` | `data-g` (unchanged) |

The CSS variables read from the host (`--panel`, `--ink`, `--line`, `--accent`, `--muted`, `--f-mono`, `--f-display`) are unchanged.

## User-facing strings (now in the locale table)

`pt-BR` equals the previous Portuguese text exactly.

| Old (hard-coded) | New key | `en` |
|---|---|---|
| `['N','NE','L','SE','S','SO','O','NO']` | `compass` | `N NE E SE S SW W NW` |
| `'Geral'` | `defaultTeam` | `General` |
| `'marcas.txt'` | `fileName` | `marks.txt` |
| `'Marcar ajuste'` | `markFormLabel` | `Mark adjustment` |
| `'Modo livre'` (panel heading and aria-label) | `panelTitle` | `Free mode` |
| `'Marcar este lugar'` | `markHereTitle` | `Mark this place` |
| `'olhando'` | `lookingAt` | `looking` |
| `'Equipe'` | `teamLabel` | `Team` |
| `'O que ajustar aqui?'` | `notePlaceholder` | `What should be adjusted here?` |
| `'Salvar (Enter)'` | `saveButton` | `Save (Enter)` |
| `'Cancelar (Esc)'` | `cancelButton` | `Cancel (Esc)` |
| `'sim'` / `'não'` | `yes` / `no` | `yes` / `no` |
| `'Lugares de teste'` | `placesTitle` | `Test places` |
| `` `Marcas (${n})` `` | `marksTitle(n)` | `Marks (n)` |
| `'Salvas no servidor desta página: Claude lê direto, não precisa copiar.'` | `savedOnServer` | `Saved on this page's server: Claude reads them directly, no need to copy.` |
| `'Salvas neste navegador. Para mandar: Copiar tudo e colar no chat, ou Baixar arquivo.'` | `savedInBrowser` | `Saved in this browser. To send them: Copy all and paste in the chat, or Download file.` |
| `'(sem nota)'` | `noNote` | `(no note)` |
| `'Ir'` | `goButton` | `Go` |
| `'Apagar'` | `deleteButton` | `Delete` |
| `'Nenhuma marca ainda.'` | `noMarks` | `No marks yet.` |
| `'Copiar tudo'` | `copyAll` | `Copy all` |
| `'Baixar arquivo'` | `downloadFile` | `Download file` |
| `'Fechar (Esc)'` | `closeButton` | `Close (Esc)` |
| `'Copiado'` | `copied` | `Copied` |
| `'Selecionado: Ctrl+C'` | `copySelected` | `Selected: Ctrl+C` |
| `'Marca salva. Claude já consegue ler'` | `savedServerMsg` | `Mark saved. Claude can already read it` |
| `'Não deu para salvar no servidor, ficou neste navegador'` | `serverFailMsg` | `Could not save to the server, it stayed in this browser` |
| `'Marca salva neste navegador. Abra o painel para copiar'` | `savedBrowserMsg` | `Mark saved in this browser. Open the panel to copy` |
| `olhar` (HUD) | `hudLook` | `look` |
| `` `voo ${v} m/s` `` | `hudFlight(speed)` | `fly <v> m/s` |
| `` `${n} marcas` `` | `hudMarks(n)` | `n mark(s)` |

Use `create(THREE, { locale: 'pt-BR' })` to keep the Portuguese UI. Override any entry with `strings`.

## Behaviour changes beyond renaming

- New `dispose()` removes the injected `<style>`, elements and the `wheel`/`keydown` listeners (the original had no teardown).
- Options set to `undefined` no longer erase their defaults (the original `{ ...defaults, ...cfg }` did).
- The mark text/serialisation logic is now also exported as pure functions (`formatMarkLine`, `serializeMarks`, `sortMarks`, `compass`) and the
  scenario bookkeeping as `createScenarioRunner`, with no behaviour difference.
- Default `collection` and `marksStorageKey` changed (see above); pass the old values to keep existing data.
