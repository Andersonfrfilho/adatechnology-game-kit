# Migration: rural templates of the Visor de casas 3D (`PlantasSDK`) to `@adatechnology/game-floorplan-rural`

Source: the five rural templates, the `rural` style and the wood, cabin and camp libraries of the team page `visor-casas-3d` (VC3, regions `casa_madeira_americana` to `barraca_camping`).
The plans are the page's plans: 5 templates x 25 seeds x 3 states = 375 plans give the same rooms, walls, openings, items, state items and lot
(`game-floorplan-post-apocalyptic/tests/team-golden-vc3.test.ts`, with the id tables of the MIGRATION files). Names follow the other packs: English ids, texts in `locales/`.

Needs the engine and the residential pack: `residential.register(engine)` first, then `rural.register(engine)`. The pack extends the residential `living` and `laundry` libraries and the `mid` palette recipe.

## Template ids

| Old | New | Style | Use | Floors | Construction | Place |
|---|---|---|---|---|---|---|
| `casa_madeira_americana` | `wood_frame_house` | `rural` | `residential_single` | 1 or 2 | `wood_frame` | `house` |
| `chale_madeira` | `a_frame_chalet` | `rural` | `residential_single` | ground floor and mezzanine | `wood_frame` | `cabin` |
| `cabana_tronco` | `log_cabin` | `rural` | `residential_single` | 1 | `log` | `cabin` |
| `barraco` | `shack` | `rural` | `residential_single` | 1 | `improvised` | `shack` |
| `barraca_camping` | `campsite` | `rural` | `recreational` | 1 (tents, no walls) | `canvas` | `camp` |

`construction` is the id the structure pack registers (`wood_frame`, `log`, `improvised`, `canvas`); `region` is `br` on all of them.

## Options

| Old | New | Values |
|---|---|---|
| `andares` | `floors` | 1, 2 |
| `garagem` | `garage` | `true`, `false` |
| `lareira` | `fireplace` | `true`, `false` |
| `porao` | `basement` | `none` (slab), `crawl_space` (`vazio`), `basement` (`porao`) |
| `sotao` | `attic` | `true`, `false` |
| `quartos` | `bedrooms` | 2 to 4 |
| `fundacao` (chalet) | `foundation` | `stilts` (`pilotis`), `slab` (`radier`) |
| `comodos` (cabin, shack) | `rooms` | 1, 2 |
| `energia` | `power` | `grid` (`rede`), `offgrid` |
| `solar` | `solar` | `true`, `false` |
| `banheiro` (cabin) | `bathroom` | `outhouse` (`privada`), `indoor` (`interno`) |
| `banheiro` (shack) | `bathroom` | `outside` (`fora`), `indoor` (`interno`) |
| `agua` | `water` | `tank` (`tanque`), `well` (`poco`) |
| `material` (shack) | `material` | `wood`, `zinc`, `mixed` |
| `piso` (shack) | `floorSurface` | `dirt` (`terra`), `concrete` (`cimento`) |
| `barracas` | `tents` | 1 to 4 |
| `tipo` (campsite) | `tentType` | `dome` (`domo`), `tunnel` (`tunel`) |

## Plan settings (`result.config`)

The old `config()` and `extras` hooks become `TemplateDef.config`, written to `result.config` and read by the decor pass and the structure pack:
`power` is `grid`, `offgrid` or `tap` (the shack's illegal tap, the old `gato`), `solar`, plus per template `foundation`, `fireplace`, `attic`, `bathroom`, `water`, `material`, `floorSurface`.
A template with `power: 'offgrid'` gets kerosene lamps (`ceiling_oil_lamp`, `oil_lamp`) instead of ceiling lights.

## Room types

| Old | New |
|---|---|
| `alpendre` | `porch` |
| `despensa` | `pantry` |
| `barraca` | `tent` |
| `acampamento` | `camp` |

## Lot zone types

| Old | New |
|---|---|
| `acampamento` | `camp` |

## Room ids (inside templates)

| Old | New |
|---|---|
| `alpendre` | `porch` |
| `despensa` | `pantry` |
| `quarto4` | `bedroom_4` |
| `banheiro_up` | `bathroom_guest` |
| `quarto_loft` | `loft_bedroom` |
| `barraca1` | `tent_1` |
| `barraca2` | `tent_2` |
| `barraca3` | `tent_3` |
| `barraca4` | `tent_4` |
| `acampamento` | `campsite` |

The legacy stream names of these rooms are registered (`legacy-seeds.ts`), so old seeds still draw the same numbers. The rest of the ids come from the residential tables (`sala` is `living`, `lavabo` is `powder_room`, `circ` is `circulation`...).

## Library ids (slot libraries)

| Old | New |
|---|---|
| `sala_am` | `living_wood_frame` |
| `garagem_am` | `garage_wood_frame` |
| `alpendre` | `porch` |
| `lavanderia_am` | `laundry_wood_frame` |
| `despensa` | `pantry` |
| `quintal_rural` | `backyard_rural` |
| `quintal_am` | `backyard_wood_frame` |
| `sala_cabana` | `living_cabin` |
| `quarto_cabana` | `bedroom_cabin` |
| `quintal_cabana_00` | `backyard_cabin_00` |
| `quintal_cabana_01` | `backyard_cabin_01` |
| `quintal_cabana_10` | `backyard_cabin_10` |
| `quintal_cabana_11` | `backyard_cabin_11` |
| `sala_barraco` | `living_shack` |
| `quarto_barraco` | `bedroom_shack` |
| `acampamento` | `campsite` |
| `quintal_camping` | `backyard_camping` |
| `jardim_camping` | `garden_camping` |
| `vazia` | `empty` |
| `barraca_1` | `tent_1` |
| `barraca_2` | `tent_2` |
| `barraca_3` | `tent_3` |
| `barraca_4` | `tent_4` |

In the `living` overrides the old slot ids `rackDir`, `tvDir`, `sofaDir`, `mesaDir`, `tapeteDir`, `rackFundo`, `sofaFundo` are `tv_unit_right`, `tv_right`, `sofa_right`, `table_right`, `rug_right`, `tv_unit_back`, `sofa_back`.

## Door models and types

| Old | New |
|---|---|
| `porta` | `door` |
| `abertura` | `opening` |
| `ziper` | `zip` |
| `degraus` | `steps` |

A door of type `steps` (and every outside door of a floor above 0.1 m) carries `steps`: one per 0.18 m of the foundation's elevation (slab 0.2, crawl space 0.6, basement 0.5, stilts 0.9, cabin 0.5). A tent door is placed with `DoorDef.edge`.

## Item types (rural)

| Old type | New type | Old category | New category |
|---|---|---|---|
| `lareira` | `fireplace` | `lareira` | `fireplace` |
| `fogao_lenha` | `wood_stove` | `fogao_lenha` | `wood_stove` |
| `escada_porao` | `basement_stairs` | `escada_porao` | `basement_stairs` |
| `beliche` | `bunk_bed` | `beliche` | `bunk_bed` |
| `cama_improvisada` | `improvised_bed` | `cama` | `bed` |
| `pia_rustica` | `rustic_sink` | `pia` | `kitchen_cabinet` |
| `balde` | `bucket` | `balde` | `bucket` |
| `banco_tronco` | `log_bench` | `banco` | `bench` |
| `mesa_tronco` | `log_table` | `mesa_jantar` | `dining_table` |
| `prateleira_tabua` | `plank_shelf` | `estante` | `shelf_unit` |
| `cadeira_balanco` | `rocking_chair` | `cadeira_varanda` | `porch_chair` |
| `lenha` | `firewood` | `lenha` | `firewood` |
| `privada` | `outhouse` | `privada` | `outhouse` |
| `poco` | `well` | `poco` | `well` |
| `tambor_agua` | `water_drum` | `tambor_agua` | `water_drum` |
| `lampiao` | `oil_lamp` | `lampiao` | `oil_lamp` |
| `lampiao_teto` | `ceiling_oil_lamp` | `lampiao` | `oil_lamp` |
| `tabua_pilha` | `plank_pile` | `sucata` | `scrap` |
| `sucata_zinco` | `zinc_scrap` | `sucata` | `scrap` |
| `saco_dormir` | `sleeping_bag` | `saco_dormir` | `sleeping_bag` |
| `colchonete` | `sleeping_pad` | `colchonete` | `sleeping_pad` |
| `fogueira` | `campfire` | `fogueira` | `campfire` |
| `mesa_camping` | `camp_table` | `mesa_camping` | `camp_table` |
| `cadeira_camping` | `camp_chair` | `cadeira_camping` | `camp_chair` |
| `cooler` | `cooler` | `cooler` | `cooler` |
| `lampiao_camping` | `camp_lantern` | `lampiao` | `oil_lamp` |
| `fogareiro` | `camp_stove` | `fogareiro` | `camp_stove` |
| `botijao_camping` | `camp_gas_canister` | `botijao_camping` | `camp_gas_canister` |

`so: true` in the old catalogue is `exactOnly` (picked only by `=type`). `cama_improvisada`, `pia_rustica`, `banco_tronco`, `mesa_tronco` and `prateleira_tabua` are exact-only.

## Style, palette and decor

| Old | New |
|---|---|
| style `rural` | style `rural` (`fenceHeight` 1.1, wire fence on every side) |
| `ESTILOS.rural.fachada.acab` `tabua_horizontal` / `tabua_vertical` / `tronco` | finish `horizontal_boards` / `vertical_boards` / `log` |
| roof `asfaltica` / `zinco` / `madeira` | roof `asphalt` / `zinc` / `wood` |
| `PALETAS.rural` and `TAB_FACHADA.rural` | `ruralSwatches` and `ruralFacadeColors` (`natural_wood`, `worn_white`, `moss_green`, `bluish_grey`, `barn_red`, `wood_grey`) |
| `DENS.rural` | `ruralDecorProfile` |
| `cores.telhado` of each template | `facade.roofColor` |

The palette stream is `rural` and follows the residential `mid` recipe, as in the page.

## Not ported here

`construcao`, `extras` and `caixa` (structure, chimney, basement, attic, water tank on a trestle) belong to `game-floorplan-structure`; the template only names its `construction` and the `config` it reads.
Wall and floor colours of `porch`, `tent` and `camp` (the page copies the balcony's) are not inherited yet: the engine palette has no alias for room types.
