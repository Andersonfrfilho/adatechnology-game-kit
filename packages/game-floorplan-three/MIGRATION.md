# Migration: Casa3DSDK and AndaresSDK (Visor de casas 3D) to `@adatechnology/game-floorplan-three`

The port is literal: the geometry, the draws and the seeded random of `Casa3DSDK.construir` are the team's. Only names changed (English API, texts in `locales`), and
what the page injected through globals is now an option. The scene equals the page's, node by node, for six plans (`tests/golden-scene.test.ts`, which maps the new ids to the
legacy ones through `seedKey`), and the level of detail planner gives the same levels in 25 situations.

## Entry point

| Visor de casas 3D | SDK |
|---|---|
| `Casa3DSDK.criar(THREE, cfg)` | `create(THREE, options)` (alias `createHouseRenderer`) |
| `sdk.construir(res, opts)` | `renderer.build(plan, options)` |
| `sdk.novoEstado()` | `renderer.newState()` |
| `sdk.tipos`, `sdk.mv` | `renderer.types` (type to `{ f, source }`), `renderer.mv` (the props module) |
| `sdk.aplicaParte(grupo, t)` | `renderer.applyPart(group, t)` |
| `sdk.materiais`, `sdk.mascaraLuz`, `sdk.iluminacao` | `renderer.materials`, `renderer.roomLightMask`, `renderer.lighting` |
| `sdk.definirNoite(n)` | `renderer.setNight(night)` |
| `sdk.carros.{modelo,grupo,info}` | `renderer.cars.{model,group,info}` (`info` returns `{ parts, tris, L, W, H }`) |
| `Casa3DSDK.planejaLOD(casas, foco, orcamento)` | `planLod(houses, focus, budget)` returns `{ total, levels, houses }` |

## Options (`cfg` of `criar`)

| VC3 | SDK |
|---|---|
| `document` | `document` |
| `qualidade` `'alta'` / `'jogo'` | `quality` `'high'` / `'game'` |
| `Moveis3DSDK` | `props` (default: `@adatechnology/game-props3d`) |
| `Reflector` | `reflector` |
| `frota` | `fleet` |
| (fixed lists of car models per lot style) | `carKinds` (`budget`, `mid`, `high`; ids of `game-vehicles-fleet`) |
| `hp` | `hp` |
| `texturas`, `atlas`, `materiais` | `textures`, `atlas`, `materials` |
| `destruicao` (world) | `destruction` (world of `game-destruction`) |
| (the page's own fragment drawing) | `destructionRenderer` (`game-destruction-three`) draws fracture, fragments, spalls and the rebar cage |
| `interativos` | `interactives` |
| `vegetacao` | `vegetation` |
| `lod` `{ interior, ocultar }` | `lod` `{ interior, hide }`, or `false` |
| `orcamentoDrawCalls` | `drawCallBudget` |
| `onMudou`, `onColisor`, `onDano`, `onEstrago`, `onInteragir`, `onLuz`, `onMensagem` | `onChange`, `onCollider`, `onDamage`, `onWreck`, `onInteract`, `onLight`, `onMessage` |
| (ids of the page's plan feed the seeded random) | `seedKey(id)` |
| (texts in Portuguese in the code) | `locale` (`'en'`, `'pt-BR'` or a table) |

## Build options (`opts` of `construir`)

| VC3 | SDK |
|---|---|
| `qualidade` | `quality` |
| `noite` | `night` |
| `corte` | `cut` |
| `estado` | `state` |
| `terreno: false` | `terrain: false` |
| `semPerimetro` | `noPerimeter` |
| `pecas: 'malhas'` | `pieces: 'meshes'` |
| `predio` `{ andares, andar, unidade, mostrarPredio }` | `building` `{ floors, floor, unit, showBuilding }` |
| `orcamentoDrawCalls` | `drawCallBudget` |

## The house (result of `construir`)

| VC3 | SDK | VC3 | SDK |
|---|---|---|---|
| `versao` | `version` | `grupo` | `group` |
| `casa` | `house` | `grupos` | `groups` (`f0`, `f1`, `t1`, `roof`, `lot`...) |
| `andares` | `floors` | `forros` | `ceilings` |
| `telhado` | `roof` | `lote` | `lot` |
| `chao` | `ground` | `predio` | `building` |
| `caixaDagua` `{ parte, grupo, pos, planta }` | `waterTank` `{ part, group, pos, plant }` | `colisores` | `colliders` |
| `partes` | `parts` | `carros` | `cars` |
| `interagiveis` | `interactables` | `portas` | `doors` |
| `escadas` | `stairs` | `rotulos` | `labels` |
| `semModelo` | `noModel` | `luzes` `{ lista, porComodo }` | `lights` `{ list, byRoom }` |
| `limites` | `limits` | `apt` | `apartment` |
| `mostraPredio` | `showBuilding` | `predioCfg` `{ andares, andar, unidade }` | `buildingConfig` `{ floors, floor, unit }` |
| `unidadeRy` | `unitRy` | `noite`, `corte` | `night`, `cut` |
| `interativos` | `interactives` | `estado` | `state` |
| `vegetacao`, `solar`, `agua`, `eletrica`, `calhas` | `vegetation`, `solar`, `water`, `electrical`, `gutters` | `estrutura` | `structure` |
| `destruicao` | `destruction` | `interno` | `internal` |

Methods: `atualiza(dt, tempo, foco)` is `update(dt, time, focus)`; `mostra({ andar, corte, lote })` is `show({ floor, cut, lot })`; `alvo` is `target`; `interage` is `interact`;
`mensagem` is `message`; `alternaPorta` is `toggleDoor`; `luzLigada` is `lightOn`; `alternaLuz` is `toggleLight`; `colide` is `collide`; `comodoEm` is `roomAt`;
`escolheEspelho` is `chooseMirror`; `definirLOD` is `setLod`; `centro` is `center`; `distancia` is `distance`; `dano` is `damage`; `danoColisor` is `colliderDamage`;
`parteDe(obj)` is `partOf(object)`; `parteEm(p, tol)` is `partAt(point, tolerance)`; `descartar` is `dispose`.

A door of `house.doors`: `{ id, andar, tipo ('aco' or 'giro'), aberta, t, bloq, trancada, macNomes, hT, cx, cz, visH, grupos, col }` is `{ id, floor, type ('steel' or 'swing'), open, t, blockedFlag, locked, handleNames, hT, cx, cz, visH, groups, col }`.

## Names of parts, groups and lights

| VC3 | SDK | VC3 | SDK |
|---|---|---|---|
| `porta:<id>` | `door:<id>` | `janela:<id>` | `window:<id>` |
| `espelho:<n>` | `mirror:<n>` | `carro:<n>:<zone>:<n>` | `car:<n>:<zone>:<n>` |
| `torn_<seed>_<n>` (tap) | `tap_<seed>_<n>` | `chuv_<seed>` (shower) | `shower_<seed>` |
| `correio_<seed>` | `mailbox_<seed>` | `roupas_<seed>` | `laundry_<seed>` |
| `botijao_<seed>` | `gas_cylinder_<seed>` | `caixa_<seed>` | `tank_<seed>` |
| `tabuas:<id>` | `boards:<id>` | `disjuntor_<n>` | `breaker_<n>` |
| light type `externa` | `outdoor` | `ix:`, `lamp_`, `lp_`, `sw_`, `lamp_ab_`, `lamp_ar_`, `lamp_ext_`, `lamp_pe_` | the same (they feed the seeded random) |
| mesh groups `chapisco`, `reboco`, `calcada`, `madeira`, `vidro`, `telha`, `liso`, `lote/...` | `roughcast`, `plaster`, `sidewalk`, `wood`, `glass`, `tile`, `plain`, `lot/...` | `fonte` of a type (`moveis3d`, `jogo`) | `source` (`props3d`, `game`) |

The salts of the seeded random (`'|varal'`, `'|luz'`, `'|temp'`, `'|veg'`...) are kept as the team wrote them: changing one changes the scene.

## Messages

All the texts the house shows are in `locales` (`en`, `pt-BR`): `prompt.*` (E: abrir a porta...), `what.*`, `message.*`, `outbuilding.*`, `warn.interactablesIncomplete`.

## AndaresSDK

| AndaresSDK | SDK |
|---|---|
| `AndaresSDK.criar()` | `createFloorNavigator()` |
| `registra({ id, andares: [{ y, h, solidos }], escadas, grupos, telhado, proprio })` | `register({ id, floors: [{ y, h, solids }], stairs, groups, roof, own })` |
| `casaEm`, `bloqueio(x, z, andar)`, `nivel`, `ponta`, `escadaPara`, `rumo`, `raio`, `tetoDe`, `oclui`, `cel` | `houseAt`, `blocked`, `level`, `landing`, `stairTo`, `heading`, `ray`, `ceilingOf`, `occlude`, `cell` |
| `aplica(casa, andar)` (internal) | `apply(house, floor)` |
| (new, T2.4d) | `openCells`, `closeCells`, `undoChanges`, `houseOf` |
| (new, T2.4d) | `navigationDefOf(house, options)`: the registration of a built house; `bindNavigator(navigator, id, house)`: follows the destruction |

## What is not here

- `AdaptadorInterativos` (plan to objects of the interactables kit) lives in `@adatechnology/game-floorplan-interactables` (spec 001, question 5) and is the default of the `interactives` option; a game can still inject its own with `interactives.adapter`.
- The globals of the page (`Moveis3DSDK`, `FrotaLeve`, `Reflector`...) are options now.
