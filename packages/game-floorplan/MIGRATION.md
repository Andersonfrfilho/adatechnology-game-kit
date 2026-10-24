# Migration: `PlantasSDK` (plantas.js) to `@adatechnology/game-floorplan`

Source: `sdk/plantas/plantas.js` (PlantasSDK, about v3) with its `teste.mjs`, `README.md` and `montar-visor.mjs`. The SDK was split into four packages:
the generic engine, a residential content pack, a commercial content pack and a post-apocalyptic genre pack.

This file covers the **engine** (`@adatechnology/game-floorplan`): API, options, result fields, ids and the generic vocabularies. Content tables are in:

- [`game-floorplan-residential/MIGRATION.md`](../game-floorplan-residential/MIGRATION.md): residential templates, rooms, library ids, residential item types and categories, styles, facade values.
- [`game-floorplan-commercial/MIGRATION.md`](../game-floorplan-commercial/MIGRATION.md): market and pharmacy, shop item types.
- [`game-floorplan-post-apocalyptic/MIGRATION.md`](../game-floorplan-post-apocalyptic/MIGRATION.md): the `protegida` / `abandonada` states and their items.

## Behaviour

The generator logic is unchanged. For the same seed and options (after the id mapping below) the new packages produce the same positions,
rotations, sizes, colours, palette integers, state items and slots as the old SDK. This was checked with a throw-away script that ran both
generators over all templates, variants, states, seeds, sizes and styles and compared every number, boolean and colour: 0 differences.
Names and labels are strings and come from the locale files; the `pt-BR` locale reproduces the old Portuguese texts.
The only deliberate behaviour additions are opt-in: the `zone` option (urban zoning) and the `locale` option. Without them nothing changes.

## Loading

| Old | New |
|---|---|
| `<script>` global `PlantasSDK` / `require('./plantas.js')` (everything in one file) | ESM `import { engine } from '@adatechnology/game-floorplan'` plus the packs you need, or IIFE globals `GameFloorplan`, `GameFloorplanResidential`, `GameFloorplanCommercial`, `GameFloorplanPostApocalyptic` |
| templates, items and states built in | content is registered: `residential.register(engine)`, `commercial.register(engine)`, `postApocalyptic.register(engine)` |
| (not available) | `register(engine, { region: 'br' })`: region data, see the residential MIGRATION |

Minimal replacement of `PlantasSDK`:

```ts
import { engine } from '@adatechnology/game-floorplan'
import { register as residential } from '@adatechnology/game-floorplan-residential'
import { register as commercial } from '@adatechnology/game-floorplan-commercial'
import { register as postApocalyptic } from '@adatechnology/game-floorplan-post-apocalyptic'

residential(engine); commercial(engine); postApocalyptic(engine)
const plan = engine.generate('townhouse', { seed: 3, state: 'fortified', locale: 'pt-BR' })
```

## API

| Old | New |
|---|---|
| `PlantasSDK.gerar(id, opcoes)` | `engine.generate(id, options)` (also a named export `generate`) |
| `PlantasSDK.slots(id, opcoes)` | `engine.slots(id, options)` |
| `PlantasSDK.validar(res)` | `engine.validate(result, { locale? })` |
| `PlantasSDK.paleta(opcoes)` | `engine.palette(options)` |
| `PlantasSDK.listarTemplates()` | `engine.listTemplates()` |
| `PlantasSDK.limitesDe(id, opcoes)` | `engine.limitsOf(id, options)` (returns `{ limits, defaults }`) |
| `PlantasSDK.registrarTemplate(t)` | `engine.registerTemplate(t)` |
| `PlantasSDK.registrarItem(item)` | `engine.registerItem(item)` / `engine.registerItems(items)` |
| `PlantasSDK.registrarBiblioteca(nome, fn)` | `engine.registerLibrary(name, fn)` (`registerLibraryAlias(alias, id)` is new) |
| `PlantasSDK.criaRng(semente, chave)` | `engine.createRng(seed, key)` |
| `PlantasSDK.sobrepoe` | `engine.overlaps` |
| `PlantasSDK.zonaJanela` | `engine.windowZone` |
| `PlantasSDK.zonasAbertura` | `engine.openingZones` |
| `PlantasSDK.templates` | `engine.templates` |
| `PlantasSDK.catalogo` | `engine.catalog` |
| `PlantasSDK.biblioteca` | `engine.libraries` |
| `PlantasSDK.estilos` | `engine.styles` |
| `PlantasSDK.estados` | `engine.listStates()` (only `normal` until a state pack is registered) |
| `PlantasSDK.cor` | `engine.color` |
| `PlantasSDK.cor.lstar` / `hsl` / `hex` | `engine.color.lstar` / `hsl` / `hex` |
| `PlantasSDK.cor.MIN_PAREDE_PISO` | `engine.color.MIN_WALL_FLOOR_CONTRAST` |
| `PlantasSDK.cor.MIN_TECIDO_PISO` | `engine.color.MIN_FABRIC_FLOOR_CONTRAST` |
| `PlantasSDK.cor.SAT_ALTA` | `engine.color.HIGH_SATURATION` |
| `PlantasSDK.constantes.ESP` | `engine.constants.WALL_THICKNESS` |
| `PlantasSDK.constantes.ZONA_PORTA` | `engine.constants.DOOR_CLEARANCE` |
| `PlantasSDK.versao` | `engine.version` |
| (none) | `engine.registerState`, `setStateDistribution`, `registerStyle`, `registerPaletteStyle`, `registerRoomColors`, `registerDecorProfile`, `registerPass`, `registerGroundOverlay`, `registerWallTop`, `registerSeedKeys`, `registerLocale`, `translate`, `listLocales`, `slotKit`, `hashString`, `mulberry32` |
| (none) | zoning: `engine.defineZone`, `getZone`, `listZones`, `checkLot`, `registerPermeableGround` |

The engine is a module-level singleton (`engine`). Packs only import its *types* and receive it in `register(engine, options)`, so an IIFE page that loads
several bundles shares one registry.

## Options of `generate` / `slots` / `palette`

| Old | New | Notes |
|---|---|---|
| `semente` | `seed` | number or string |
| `w`, `d` | `w`, `d` | unchanged |
| `estilo` | `style` | values in the residential MIGRATION; alias `nobre` is now `luxury` |
| `estado` | `state` | `protegida` is `fortified`, `abandonada` is `abandoned`; default drawn from the seed by the state pack |
| `padrao` | `tier` | `apartment_modern`: `medio` is `mid`, `alto` is `high` |
| `andares` | `floors` | `mansion`, `mid_modern_townhouse`, `high_end_contemporary` |
| `elevador` | `elevator` | `mansion` |
| `andar` | `floor` | storey of an apartment unit |
| (none) | `locale` | `en` (default) or `pt-BR`; chooses `name` and messages |
| (none) | `zone` | zone id or `ZoneDef`; see Zoning below |

## Result of `generate`

| Old | New |
|---|---|
| `template` | `template` |
| `nome` | `name` (localized); the key is in `label` |
| `semente` | `seed` |
| `estilo` | `style` |
| `estado` | `state` |
| `w`, `d` | `w`, `d` |
| `andares` | `floors` |
| `comodos` | `rooms` |
| `paredes` | `walls` |
| `portas` | `doors` |
| `janelas` | `windows` |
| `abertos` | `openPairs` |
| `fachada` | `facade` |
| `lote` | `lot` (`null` for apartments, as before) |
| `moveis` | `items` |
| `estadoItens` | `stateItems` |
| `cores` | `colors` |
| `predio` | `building` |
| `faltando` | `missing` |
| (none) | `use`, `partyWalls`, `zoning` (only with `zone`) |

Floor (`andares[i]`): `indice` is `index`, `nome` is `name` (+ `label`), `y0` is `y0`, `pe` is `ceiling`.

Room (`comodos[i]`): `id`, `tipo` is `type`, `nome` is `name` (+ `label`), `andar` is `floor`, `u0 v0 u1 v1` unchanged, `partes` is `parts`, `liga` is `link`, `pe` is `ceiling`, `cor` is `color` (`{ wall, floor }` palette keys).

Wall (`paredes[i]`): `andar` is `floor`, `eixo` is `axis`, `esp` is `thickness`, `lados` is `sides`, `ext` is `exterior`, `tipo` is `type`, `h` is `h`.

Door (`portas[i]`): `andar` is `floor`, `eixo` is `axis`, `larg` is `width`, `a`, `b` unchanged (`b: 'fora'` is `'outside'`), `abre` is `opensTo`, `ext` is `exterior`, `lado` is `side`, `folhas` is `leaves`, `modelo` is `model`, `dobradica` is `hinge`, `zonas` is `zones`, `bloqueada` is `blocked`, `aberta` is `open`.

Window (`janelas[i]`): `andar` is `floor`, `eixo` is `axis`, `larg` is `width`, `comodo` is `room`, `lado` is `side`, `tabuas` is `boards`.

Facade (`fachada`): `estilo` is `style`, `cor` is `color` (`{ name, key, hex }`), `acabamento` is `finish`, `grades` is `grilles`, `telhado` is `roof`, `sacada` is `balcony`, `varanda` is `veranda`, `portaAco` is `steelDoor`, `andares` is `floors`, `roles` is `roles` (`muro` is `wall`).

Lot (`lote`): `rect`, `recuo` is `setback`, `quintal` is `backyard`, `estilo` is `style`, `piscina` is `pool`, `zonas` is `zones`, `perimetro` is `perimeter`, `portoes` is `gates`, `caminhos` is `paths`; new: `sideYard`.

Lot zone: `id`, `tipo` is `type`, `nome` is `name` (+ `label`), `partes` is `parts`, `piso` is `ground`.

Perimeter segment: `lado` is `side`, `tipo` is `type`, `altura` is `height`, `topo` is `top`, `alturaTotal` is `totalHeight`, `esp` is `thickness`, `cor` is `color` (`muro` is `wall`).

Gate: `tipo` is `type`, `modelo` is `model`, `larg` is `width`, `altura` is `height`, `lado` is `side`, `para` is `to`, `aberto` is `open`.

Path: `tipo` is `type`, `de` is `from`, `para` is `to`, `larg` is `width`, `rects` and `points` unchanged.

Item (`moveis[i]`): `tipo` is `type`, `categoria` is `category`, `fu`/`fv` are `frontU`/`frontV`, `comodo` is `room`, `andar` is `floor`, `externo` is `outdoor`, `sobre` is `on`, `modo` is `mode`, `folga` is `clearance`, `plano` is `flat`, `baixo` is `low`, `montagem` is `mount`, `janela` is `window`, `apoio` is `supportId`, `suporte` is `bracket`, `liga` is `link`, `cor` is `color`, `camada` is `layer`, `zona` is `zone`, `poligono` is `polygon`, `barricada` is `barricade`, `reviradas` is `ransacked`, `porta_aberta` is `doorOpen`, `movido` is `moved`, `criado` is `created`, `par` is `par`. `x z ry w d h y aabb slot id decor` unchanged.

Slot (`slots()` rows): `comodo` is `room`, `externo` is `outdoor`, `ancora` is `anchor`, `lado` is `side`, `obrigatorio` is `required`, `prob` is `chance`, `folga` is `clearance`, `frente` is `front`, `grupo` is `group`, `requer` is `requires`, `sobre` is `on`, `alvo` is `target`, `valido` is `valid`, `motivo` is `reason` (a code, see Reasons).

Building (`predio`, `apartment_modern`): `andares` is `floors`, `unidadesPorAndar` is `unitsPerFloor`, `peDireito` is `ceilingHeight`, `laje` is `slab`, `unidade` is `unit`, `corredor` is `corridor`, `hall`, `elevador` is `elevator`, `escada` is `stairs`, `unidades` is `units`, `espelhada` is `mirrored`, `nota` is `note` (now in English).

## Ids that changed shape

| Old | New |
|---|---|
| door `p<floor>_<i>` (`p0_1`) | `d<floor>_<i>` (`d0_1`) |
| window `j<floor>_<i>` | `w<floor>_<i>` |
| perimeter `m<i>`, gate `g<i>` | unchanged |
| path `cam_social` / `cam_garagem` / `cam_carga` | `pedestrian_path` / `garage_path` / `cargo_path` |
| item `<room>.<slot>` (`sala.rackDir`) | same shape with the new room and slot ids (`living.tv_unit_right`) |
| expanded window slot `<id>@j<i>` | `<id>@w<i>` |
| state item `estado.<n>.<tipo>` | `state.<n>.<type>` |

## Slot reasons (`motivo` to `reason`) and messages

`reason` is now a code; the text is localized under `reasons` in the locale files.

| Old text | New code |
|---|---|
| `pai inválido` | `invalid_parent` |
| `lado inválido` | `invalid_side` |
| `bloqueado por porta` | `blocked_by_door` |
| `parede aberta` | `open_wall` |
| `canto inválido` | `invalid_corner` |
| `sem janela` | `no_window` |
| `janela fora do cômodo` | `window_outside_room` |
| `slot maior que o cômodo` | `larger_than_room` |
| `âncora desconhecida` | `unknown_anchor` |

`validate()` messages are localized too: `Sobreposição: a e b` is `overlap`, `Porta bloqueada por id` is `door_blocked`, `Portão bloqueado por id` is `gate_blocked`, `Item obrigatório ausente: sala/slot` is `missing_required`; new: `zone_violation`.

## Slot anchors, sides, facing, mounts

### Anchors
| Old | New |
|---|---|
| `parede` | `wall` |
| `canto` | `corner` |
| `centro` | `center` |
| `janela` | `window` |
| `sobre` | `on` |
| `dentro` | `inside` |

### Sides and corners
| Old | New |
|---|---|
| `frente` | `front` |
| `fundos` | `back` |
| `fundo` | `back` |
| `esq` | `left` |
| `dir` | `right` |
| `qualquer` | `any` |
| `frente-esq` | `front-left` |
| `frente-dir` | `front-right` |
| `fundo-esq` | `back-left` |
| `fundo-dir` | `back-right` |

### Facing (`frente`)
| Old | New |
|---|---|
| `centro` | `center` |
| `porta` | `door` |
| `alvo` | `target` |

### Mounts (`montagem`)
| Old | New |
|---|---|
| `teto` | `ceiling` |
| `parede` | `wall` |
| `janela` | `window` |
| `apoio` | `support` |
| `chao` | `floor` |
| `cobertura` | `roof` |
| `solo` | `ground` |
| `muro` | `wall_top` |

## Lot zone types, wall tops, gates, doors, finishes

| Old | New |
|---|---|
| `vaga` | `parking` |
| `jardim` | `garden` |
| `quintal` | `backyard` |
| `lateral` | `side_yard` |

Boundary types: `muro` is `wall`, `cerca` is `fence`, `grade` is `railing`. Wall tops: `nada` is `none`, `caco` is `glass`, `concertina` is `razor_wire`, `grade` is `railing`, `arame_farpado` is `barbed_wire` (registered by the post-apocalyptic pack).
Gate types: `social` is `pedestrian`, `garagem` is `garage`, `carga` is `cargo`. Door models: `basculante` is `tilting`, `correr` is `sliding`, `aco` is `steel`, `dupla` is `double`, `folha` is `single`. Hinge `ini` is `start`. Materials: `ferro` is `iron`, `bloco` is `block`, `alambrado` is `wire_mesh`.

### Miscellaneous vocabulary
| Old | New |
|---|---|
| `fora` | `outside` |
| `social` | `pedestrian` |
| `carga` | `cargo` |
| `garagem_int` | `inner_garage` |
| `pedestre` | `pedestrian` |
| `veiculo` | `vehicle` |
| `ferro` | `iron` |
| `bloco` | `block` |
| `alambrado` | `wire_mesh` |
| `basculante` | `tilting` |
| `correr` | `sliding` |
| `aco` | `steel` |
| `dupla` | `double` |
| `folha` | `single` |
| `ini` | `start` |
| `guardacorpo` | `railing` |
| `fibrocimento` | `fiber_cement` |
| `laje` | `slab` |
| `reboco` | `plaster` |
| `chapisco` | `roughcast` |
| `reboco_parcial` | `partial_plaster` |
| `bloco_exposto` | `exposed_block` |
| `tijolo_aparente` | `exposed_brick` |
| `analoga` | `analogous` |
| `complementar` | `complementary` |
| `complementar_dividida` | `split_complementary` |
| `triade` | `triad` |
| `parede_` | `wall_` |
| `piso_` | `floor_` |
| `madeira` | `wood` |
| `tecido_principal` | `fabric_main` |
| `tecido_acento` | `fabric_accent` |
| `quadro_acento` | `picture_accent` |
| `ext_piso` | `exterior_floor` |
| `gramado_` | `lawn` |
| `fachada` | `facade` |
| `fachada_detalhe` | `facade_detail` |
| `portao` | `gate` |
| `telhado` | `roof` |
| `teto_role` | `ceiling` |
| `agua` | `water` |
| `terra_role` | `soil` |
| `deck_madeira_role` | `wood_deck` |
| `parede` | `wall` |
| `piso` | `floor` |
| `objeto` | `object` |

## Palette

`palette(options)` returns the same integers as `paleta`; only the keys are renamed. Room keys are `wall_<room type>` and `floor_<room type>`.

| Old palette key | New palette key |
|---|---|
| `fachada` | `facade` |
| `fachada_detalhe` | `facade_detail` |
| `muro` | `wall` |
| `portao` | `gate` |
| `telhado` | `roof` |
| `teto` | `ceiling` |
| `madeira` | `wood` |
| `tecido_principal` | `fabric_main` |
| `tecido_acento` | `fabric_accent` |
| `quadro_acento` | `picture_accent` |
| `metal` | `metal` |
| `ext_piso` | `exterior_floor` |
| `gramado` | `lawn` |
| `terra` | `dirt` |
| `deck_madeira` | `deck_floor` |
| `agua` | `water` |

Harmony schemes: `analoga` is `analogous`, `complementar` is `complementary`, `complementar_dividida` is `split_complementary`, `triade` is `triad`; `meta.modoAcento` is `meta.accentMode`.
The palette recipes per style are data supplied by the packs (`registerPaletteStyle`); the harmony algorithm and the contrast rules stay in the engine.

## Engine-level item types and categories (ground cover)

| Old type | New type | Old category | New category |
|---|---|---|---|
| `planta_alta` | `plant_tall` | `planta` | `plant` |
| `planta_baixa` | `plant_short` | `planta` | `plant` |
| `lixeira_ext` | `outdoor_bin` | `lixeira_ext` | `outdoor_bin` |
| `gramado` | `lawn` | `piso_ext` | `ground_cover` |
| `piso_ceramico` | `tile_floor` | `piso_ext` | `ground_cover` |
| `cimentado` | `concrete` | `piso_ext` | `ground_cover` |
| `deck_madeira` | `deck_floor` | `piso_ext` | `ground_cover` |
| `terra` | `dirt` | `piso_ext` | `ground_cover` |

| Old category | New category |
|---|---|
| `lixeira_ext` | `outdoor_bin` |
| `piso_ext` | `ground_cover` |
| `planta` | `plant` |

`piso_ext` is now `ground_cover` and is built into the engine, because the ground of every lot zone needs it. `lawn` and `dirt` are registered as permeable grounds.

## Reasons for changes you may notice

- Item and slot ids carry English names, and the old nightstand slots `criadoE` / `criadoD` are `nightstand_left` / `nightstand_right`.
- Everything the old SDK held in Portuguese (names, labels, reasons, messages) is now a key plus a locale entry (`en`, `pt-BR`). Register more with `engine.registerLocale('xx', table)`.
- Randomness is drawn from the same named streams as before so seeds reproduce. Those stream names are the only Portuguese left in the code, in each pack's `legacy-seeds.ts` (for example `'fachada'`, `'lote'`, `'c:sala'`, `'estado:protegida'`). Do not translate them: changing a stream name changes every plan generated from an existing seed.

## Rules from the Visor de casas 3D (spec 001, T2.2b)

The team page (PlantasSDK of the Visor de casas 3D, VC3) kept changing the generator after this port was made (86 regions, rules R01-R72). The engine now follows it; with the id
tables of the four MIGRATION files, the 12 residential and commercial templates give the same rooms, walls, openings, items, state items and lot as the page
(900 plans recorded in `game-floorplan-post-apocalyptic/tests/fixtures/team-golden/vc3-plans.json`, plus 4500 more checked once). **The old VP-equality claim above no longer holds**:
plans differ from the earlier port on purpose. The five rural templates are still to come (T2.2f).

| VC3 | Engine | Effect |
|---|---|---|
| `RAIO_JOG` 0.24 | option `playerRadius` (default 0.24, `engine.constants.PLAYER_RADIUS`) | walkability grid has 10 cm cells indoors and drops cells closer than the radius to a wall body; furniture may not close the way for that disc (relaxed pass: 0.12) |
| `PORTA_FOLGA`, `folga` | `DoorDef.clearance`, `TemplateDef.clearance.door` (default 0.12) | door never closer to a corner or junction than this |
| `JAN_FOLGA` 0.3, R10 | `TemplateDef.clearance.window`; windows are spread over the wall stretch they fall in (one centred, several with equal gaps, never near a corner, junction or door; bathroom windows small and high) | window positions differ from the earlier port |
| R43 `SEM_JANELA` | `WINDOWLESS_ROOM_TYPES`: any other room with an exterior wall gets a window in its longest free stretch | |
| `bloqueiaJanela`, `hjan`, `aereo`, `H_AEREO` 2.15 | `blocksWindow(item, window, overheadOff?)`, `FurnitureDef.windowHeight`, `FurnitureDef.overhead` | a wall cabinet and a shower enclosure block a window; a second pass drops the cabinet (`item.overhead = false`) |
| R30 `FOLGA_CARRO`, `candidatosCarro` | `parking.ts` (`carCandidates`), option `carClearance` (driver 0.8, side 0.6, end 0.6); the item gets `driver` and `carClearance` | the driver door of a parked car opens |
| `partesUteis` | `usableParts` | inset only where there is a real wall |
| `corposParedes` | the grid reads the wall bodies | |
| R07 | `paths.ts`: every ground-floor exterior door gets a paved path to the pedestrian gate or the nearest path (`path_<door id>`, `entrance_path` for the template's `doorTarget`); a building at the street line has `from: null` | |
| R23 | the yard water tank slot has `chance: 0` (the tank sits on the slab, T2.2e) | |
| R20 | `mailbox` item on the front wall beside the pedestrian gate | |
| R64 | `table_lamp` on a nightstand, dresser or console table (stream `abajur:<room legacy key>`) | |
| R66 | `single_storey_a`: the bathroom opens from the living room, washbasin on the back wall | |
| state | fortified: at least one window boarded, the barricade must cover the door zone, a mattress search on a fixed grid in tight houses; abandoned: clothes and stains retry until 2 | |
| hooks for the rural pack | `TemplateDef.noWalls`, `cumulativeCeilings`, `reservations`, `paths`, `place`; `DoorDef.edge`, `model`, `type`, `steps`; `LotConfig.extraZones`; `StyleDef.fenceHeight`; slot `floorFree`; `FurnitureDef.exactOnly` | |

New vocabulary (VC3 names to SDK): door `tipo` is `type` (`porta` is `door`), `degraus` is `steps`, item `aereo` is `overhead`, `hjan` is `windowHeight`, `so` is `exactOnly`.

New API: `registerResultExtension(name, run, { after?, seedKey? })` (output in `result[name]`, runs after the state and before the zoning report, `rng = createRng(seed, seedKey ?? name)`, so a pack can
reproduce a team stream and the structure pack puts `result.structure` in the plan), `registerFindsProvider(provider)` and `findsFor(query)` (stub for phase 3: `FindsQuery { place, container, state, rng, day?, region?, footprint?, key? }`,
`FindStack { itemId, count, data? }`), `registerViewerLayer(layer)` (a pack adds a checkbox and a drawing to the 2D viewer; `engine.viewerLayers`). Furniture extension fields live on `FurnitureDef` (the former `ItemDef` of this package,
renamed so it does not collide with the item catalogue's `ItemDef`).

## Zoning (new)

Urban zoning is a generic layer in the engine; the zones themselves are content (see the residential and commercial `regions/br`).

```ts
import { engine, defineZone, checkLot } from '@adatechnology/game-floorplan'

defineZone({
  id: 'my_zone', allowedUses: ['residential_single'], maxFloors: 2, maxHeight: 9,
  setbacks: { front: 5, side: 1.5, back: 3 }, maxCoverage: 0.5, maxFar: 1, minLot: 250, minFrontage: 10, permeableMin: 0.25,
})

const plan = engine.generate('mansion', { seed: 1, zone: 'my_zone' })
plan.floors.length   // 2: clamped from 3
plan.zoning          // { zone, adjustments: [{ field: 'floors', from: 3, to: 2, reason: 'max_floors' }, ...], violations: [] }
checkLot('my_zone', plan.lot, plan)   // [] when compliant, otherwise [{ rule, actual, limit }]
```

- Uses are generic strings: `residential_single`, `residential_multi`, `commercial`, `mixed`, `industrial`, or your own. Each template declares its `use` (default `residential_single`) and `floorRange`.
- `generate(..., { zone })` clamps `floors` (or an apartment's `floor`) to `maxFloors` and `maxHeight`, raises the front, side and back setbacks (party walls are exempt on the shared side) and turns paved garden, yard and side zones into lawn until `permeableMin` is met. Each change is listed in `zoning.adjustments` as `{ field, from, to, reason }`.
- What cannot be fixed by clamping (a use that is not allowed, minimum lot, frontage, coverage, floor area ratio) is reported in `zoning.violations`. `validate()` includes them as `zone_violation` messages.
- `checkLot(zone, lot, plan)` checks any generated plan against any zone, so you can ask whether a plan fits a neighbourhood without regenerating it.
