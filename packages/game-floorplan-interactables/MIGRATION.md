# Migration notes

Port of `AdaptadorInterativos` v0.3.0, the IIFE of the team's pages (`area-casas.html`, `visor-casas-3d.html`, `zombiada-modo-livre.html`; the three copies are identical).
The port is literal: the same planning, the same order of draws, the same fitting of the doors. What changed is the **names** (Portuguese to English), where the
**tables** live (registries the game can override) and where the adapter **reads** the house (the plan of the kit, not the `PlantasSDK` result).

The tests run the team's original code in a `vm` (`tests/fixtures/team-golden/adaptador-interativos.js`, verbatim, sha256
`0cc377e6248bbbad3b49c82e7b8b864f3449442923a0c32a2d53f4129d72d7c4`) on the same houses and compare the answers, after renaming, with `toEqual`: the plan of 17
typologies over 3 seeds and the states, the serialization of the world, the result of `add` (hinges turned, objects moved), `blockedOf` on a grid of points, the chimney and the contents drawn from the goods catalog.

## Functions

| Team | Here |
|---|---|
| `AdaptadorInterativos.criar(opcoes)` | `create(options)` (also `FloorplanInteractables.create`) |
| `.planejar(res, opcoes)` | `plan(house, planOptions)` |
| `.criarMundo(res, opcoes)` | `createWorld(house, worldOptions)` |
| `.adicionar(mundo, plano, opcoes)` | `add(world, planned, addOptions)` |
| `.bloqueadoDe(res, opcoes)` | `blockedOf(house, options)` |
| `.pontoDe(mundo, id)` | `pointOf(world, id)` |
| `.especProprio(tipo, ...)` | `ownSpec(type, ...)` |
| `.versao` | `.version` (`'0.3.0'`) |

## Options

| Team | Here |
|---|---|
| `regiao` | `region` (default `'br'`) |
| `locale` | `locale` (default `'pt-BR'`) |
| `cadeiras` | `chairs` (also a plan option) |
| `semente` | `seed` |
| `andar` | `floor` |
| `externos` | `externals` |
| `noite` | `night` |
| `luzesLigadas` | `lightsOn` |
| `origemX`, `origemZ` | `originX`, `originZ` |
| `base`, `inw` | `base`, `inw` |
| `rede` | `grid` |
| `agua` | `water` |
| `bloqueado` | `isBlocked` |
| `construir` | `build` |
| `folga` | `margin` |

New: `typeMap`, `contentMap`, `contentByGroup`, `contentFallback`, `groupOf`, `chairTables`, `chairSide`, `fixturesOfPoint`, `substitutes`, `preference`, `ownTypes`,
`frozenItems`, `drawerItems`, `seedKey`, `messages`. Each table of the team became a registry with the team's values as default; a key with `null` removes the entry.

## Answer of `plan` (`planejar`)

| Team | Here |
|---|---|
| `versao`, `template`, `semente` | `version`, `template`, `seed` |
| `andar` / `piso` (of an entry) | `floor` / `floorY` |
| `itens` | `items` |
| `tomadas`, `interruptores`, `luzes`, `lampioes` | `outlets`, `switches`, `lights`, `lanterns` |
| `botijoes`, `fogoes`, `pontos` | `cylinders`, `stoves`, `points` |
| `entradaEnergia`, `quadro`, `medidor`, `conduites` | `serviceEntrance`, `panel`, `meter`, `conduits` |
| `mapeados`, `naoMapeados`, `descartados`, `avisos` | `mapped`, `unmapped`, `discarded`, `warnings` |
| `cadeiras`, `origem` | `chairs`, `origin` |
| entry `{ tipo, origem, ligacoes, ligada, ponto, afastado }` | `{ type, origin, connections, lit, point, moved }` |
| connections `chuveiro, tomada, botijao, circuito, controla, topoChamine, vazao_lpm, circuitoTomada` | `shower, outlet, cylinder, circuit, controls, chimneyTop, flowLpm, outletCircuit` |
| fixture `{ objeto, tipoPonto }` (`torneira`, `chuveiro`, `descarga`, `tanque`, `maquina`) | `{ object, pointKind }` (`tap`, `shower`, `flush`, `tub`, `machine`) |
| botijao `{ fogao, local }` (`ao_lado`, `nicho_externo`, `sob_bancada`) | cylinder `{ stove, place }` (`beside`, `external_niche`, `under_counter`) |
| `add` answer `{ adicionados, partes, dobradicas, afastados, avisos }` | `{ added, parts, hinges, moved, warnings }` |
| stack data `{ nome_pt, origem, categoria, pegavel }` | `{ source, group, pickable }` (`nome_pt` is dropped: the item has its own name) |

## Ids the adapter creates

| Team | Here |
|---|---|
| `entrada_energia` | `service_entrance` |
| `quadro`, `medidor` | `panel`, `meter` |
| `gas_encanado` (type `gas_encanado`) | `piped_gas` (type `gas_piped`) |
| `conduite_descida`, `circuito_avulso` | `conduit_descent`, `standalone_circuit` |
| `<id>#aereo`, `<id>#armario`, `<id>#cadeiraN` | `<id>#overhead`, `<id>#cabinet`, `<id>#chairN` |

Seeds: the objects the adapter creates are drawn from the seed of their id, so the renamed ids draw different numbers than the team's. A game that must reproduce a scene
saved with the team's ids passes `seedKey` (the house renderer forwards its own `seedKey` option).

## Furniture types (team `tipo` to the type of the plan)

| Kit type (key of `typeMap`) | Team `tipo` |
|---|---|
| `table_lamp` | `abajur` |
| `sideboard` | `aparador` |
| `console_table` | `aparador_c` |
| `kitchen_cabinet` | `armario_cozinha` |
| `kitchen_cabinet_large` | `armario_cozinha_g` |
| `kitchen_cabinet_small` | `armario_cozinha_p` |
| `laundry_cabinet` | `armario_lav` |
| `filing_cabinet` | `arquivo` |
| `workbench` | `bancada_ferr` |
| `bench` | `banco` |
| `garden_bench` | `banco_jardim` |
| `log_bench` | `banco_tronco` |
| `stool` | `banqueta` |
| `bunk_bed` | `beliche` |
| `gas_cylinder` | `botijao` |
| `camp_gas_canister` | `botijao_camping` |
| `cooking_gas_cylinder` | `botijao_gas` |
| `shower` | `box` |
| `shower_large` | `box_g` |
| `buffet` | `bufe` |
| `rocking_chair` | `cadeira_balanco` |
| `camp_chair` | `cadeira_camping` |
| `mailbox` | `caixa_correio` |
| `double_bed` | `cama_casal` |
| `improvised_bed` | `cama_improvisada` |
| `king_bed` | `cama_king` |
| `queen_bed` | `cama_queen` |
| `single_bed` | `cama_solteiro` |
| `doghouse` | `casinha_cachorro` |
| `bbq_grill` | `churrasqueira` |
| `bbq_simple` | `churrasqueira_simples` |
| `dresser` | `comoda` |
| `cooler` | `cooler` |
| `curtain` | `cortina` |
| `nightstand` | `criado` |
| `china_cabinet` | `cristaleira` |
| `pantry` | `despensa` |
| `desk` | `escrivaninha` |
| `waiting_bench` | `espera` |
| `tool_shelf` | `estante_ferr` |
| `stove` | `fogao` |
| `stove_4burner` | `fogao4` |
| `wood_stove` | `fogao_lenha` |
| `camp_stove` | `fogareiro` |
| `campfire` | `fogueira` |
| `freezer` | `freezer` |
| `fridge` | `geladeira` |
| `fridge_large` | `geladeira2` |
| `display_fridge_medium` | `geladeira_med` |
| `wardrobe` | `guarda` |
| `closet_wardrobe` | `guarda_closet` |
| `wardrobe_large` | `guarda_g` |
| `wardrobe_small` | `guarda_peq` |
| `oil_lamp` | `lampiao` |
| `camp_lantern` | `lampiao_camping` |
| `ceiling_oil_lamp` | `lampiao_teto` |
| `fireplace` | `lareira` |
| `trash_bin` | `lixeira` |
| `outdoor_bin` | `lixeira_ext` |
| `floor_lamp` | `luminaria` |
| `chandelier` | `lustre` |
| `washing_machine` | `maquina` |
| `dining_table` | `mesa` |
| `camp_table` | `mesa_camping` |
| `office_desk` | `mesa_escr` |
| `office_desk_large` | `mesa_escr_g` |
| `outdoor_table` | `mesa_ext` |
| `gourmet_table` | `mesa_gourmet` |
| `gourmet_table_small` | `mesa_gourmet_peq` |
| `dining_table_large` | `mesa_grande` |
| `dining_table_small` | `mesa_peq` |
| `dining_table_round` | `mesa_red` |
| `microwave` | `microondas` |
| `pendant` | `pendente` |
| `blinds` | `persiana` |
| `washbasin` | `pia_b` |
| `pedestal_basin` | `pia_coluna` |
| `rustic_sink` | `pia_rustica` |
| `ceiling_light` | `plafon` |
| `well` | `poco` |
| `armchair` | `poltrona` |
| `armchair_high` | `poltrona_alta` |
| `plank_shelf` | `prateleira_tabua` |
| `outhouse` | `privada` |
| `tv_unit` | `rack` |
| `tv_unit_large` | `rack_grande` |
| `tv_unit_small` | `rack_peq` |
| `display_fridge` | `refrig_exp` |
| `sofa_2seat` | `sofa2` |
| `sofa_3seat` | `sofa3` |
| `sofa_l` | `sofa_l` |
| `sofa_xl` | `sofa_xl` |
| `track_spot` | `spot_trilho` |
| `laundry_tub` | `tanque` |
| `tv` | `tv` |
| `tv_large` | `tv_grande` |
| `clothesline` | `varal` |
| `toilet` | `vaso` |

## Content ids (team to household item)

The team's table was keyed by the ids of `PlantasSDK`; the plan of the kit carries the ids of `game-items-goods` and of the structure pack, which the adapter resolves
before using `contentMap` (31 ids of the structure table were matched by name; see the evidence of spec 001).

| Kit id (key of `contentMap`) | Team id |
|---|---|
| `sugar` | `acucar` |
| `water_jug_5l` | `agua_galao` |
| `water_jug` | `agua_galao` |
| `water_bottle` | `agua_garrafa` |
| `bleach` | `agua_sanitaria` |
| `alcohol_70` | `alcool` |
| `rubbing_alcohol` | `alcool` |
| `pliers` | `alicate` |
| `fabric_softener` | `amaciante` |
| `rice` | `arroz` |
| `bucket` | `balde` |
| `biscuits` | `biscoito` |
| `cable_bundle` | `cabos` |
| `cables` | `cabos` |
| `coffee` | `cafe` |
| `jeans` | `calca` |
| `trousers` | `calca` |
| `tshirt` | `camisa` |
| `shirt` | `camisa` |
| `t_shirt` | `camiseta` |
| `mug` | `caneca` |
| `pen` | `caneta` |
| `frozen_meat` | `carne` |
| `raw_beef` | `carne` |
| `packed_meat` | `carne` |
| `phone_charger` | `carregador` |
| `charger` | `carregador` |
| `letter` | `carta` |
| `jacket` | `casaco` |
| `coat` | `casaco` |
| `clothespins` | `cesto_pregadores` |
| `screwdriver` | `chave_fenda` |
| `house_key` | `chaves` |
| `keys` | `chaves` |
| `flip_flops` | `chinelo` |
| `blanket` | `cobertor` |
| `bill` | `conta` |
| `remote_control` | `controle_remoto` |
| `cup` | `copo` |
| `rope` | `corda` |
| `adhesive_bandages` | `curativo` |
| `bandages` | `curativo` |
| `disinfectant` | `desinfetante` |
| `detergent` | `detergente` |
| `dish_soap` | `detergente` |
| `documents` | `documento` |
| `dvd` | `dvd` |
| `dvds` | `dvd` |
| `food_packaging` | `embalagem` |
| `packaging` | `embalagem` |
| `toothbrush` | `escova_dente` |
| `sponge` | `esponja` |
| `knife` | `faca` |
| `kitchen_knife` | `faca` |
| `flour` | `farinha` |
| `beans` | `feijao` |
| `electrical_tape` | `fita_isolante` |
| `insulating_tape` | `fita_isolante` |
| `apple` | `fruta` |
| `fruit` | `fruta` |
| `stapler` | `grampeador` |
| `shoe_polish` | `graxa` |
| `insulin` | `insulina` |
| `yogurt` | `iogurte` |
| `flashlight` | `lanterna` |
| `canned_food` | `lata_atum` |
| `canned_tuna` | `lata_atum` |
| `canned_corn_and_peas` | `lata_milho` |
| `canned_corn` | `lata_milho` |
| `paint_can` | `lata_tinta` |
| `empty_can` | `lata_vazia` |
| `milk_carton` | `leite` |
| `book` | `livro` |
| `rubber_gloves` | `luvas` |
| `pasta` | `macarrao` |
| `hammer` | `martelo` |
| `socks` | `meias` |
| `backpack` | `mochila` |
| `eyeglasses` | `oculos` |
| `glasses` | `oculos` |
| `cooking_oil` | `oleo` |
| `eggs` | `ovos` |
| `pot` | `panela` |
| `flyer` | `panfleto` |
| `crumpled_paper` | `papel_amassado` |
| `toilet_paper` | `papel_higienico` |
| `painkillers` | `paracetamol` |
| `painkiller` | `paracetamol` |
| `screws` | `parafusos` |
| `batteries` | `pilhas` |
| `plate` | `prato` |
| `china_plates` | `prato` |
| `plates` | `prato` |
| `nails` | `pregos` |
| `cheese` | `queijo` |
| `soda_can` | `refrigerante` |
| `soda` | `refrigerante` |
| `maintenance_medication` | `remedio` |
| `medicine` | `remedio` |
| `underwear` | `roupa_intima` |
| `laundry_powder` | `sabao_po` |
| `washing_powder` | `sabao_po` |
| `soap` | `sabonete` |
| `trash_bag` | `saco_lixo` |
| `full_trash_bag` | `saco_lixo_cheio` |
| `shoes` | `sapato` |
| `handsaw` | `serrote` |
| `hand_saw` | `serrote` |
| `shampoo` | `shampoo` |
| `leftover_meal` | `sobras` |
| `leftovers` | `sobras` |
| `ice_cream` | `sorvete` |
| `wine_glass` | `taca` |
| `wine_glasses` | `taca` |
| `seasoning` | `tempero` |
| `spices` | `tempero` |
| `sneakers` | `tenis` |
| `scissors` | `tesoura` |
| `broom` | `vassoura` |
