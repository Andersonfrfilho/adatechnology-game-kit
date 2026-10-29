# Migration: `PlantasSDK` residential content to `@adatechnology/game-floorplan-residential`

Source: `sdk/plantas/plantas.js` (PlantasSDK, about v3) with its `teste.mjs`, `README.md` and `montar-visor.mjs`. The SDK was split into four packages:
the generic engine, a residential content pack, a commercial content pack and a post-apocalyptic genre pack.

This file lists the residential content: template ids, room types and ids, library ids, item types and categories, styles and facade values.
For the API, options and result fields see [`game-floorplan/MIGRATION.md`](../game-floorplan/MIGRATION.md).

## Behaviour

The generator logic is unchanged. For the same seed and options (after the id mapping below) the new packages produce the same positions,
rotations, sizes, colours, palette integers, state items and slots as the old SDK. This was checked with a throw-away script that ran both
generators over all templates, variants, states, seeds, sizes and styles and compared every number, boolean and colour: 0 differences.
Names and labels are strings and come from the locale files; the `pt-BR` locale reproduces the old Portuguese texts.
The only deliberate behaviour additions are opt-in: the `zone` option (urban zoning) and the `locale` option. Without them nothing changes.

## Template ids

| Old | New | Style | Use | Floors |
|---|---|---|---|---|
| `casaA` | `single_storey_a` | `budget` | `residential_single` | 1 |
| `sobrado` | `townhouse` | `budget` | `residential_single` | 2 |
| `apartamento` | `apartment_basic` | `budget` | `residential_multi` | 1 (unit) |
| `popular_laje` | `budget_slab_house` | `budget` | `residential_single` | 1 (default) to 3, party wall right |
| `popular_geminada` | `budget_semi_detached` | `budget` | `residential_single` | 1, party wall left |
| `media_terrea_moderna` | `mid_modern_single_storey` | `mid` | `residential_single` | 1 |
| `sobrado_medio_moderno` | `mid_modern_townhouse` | `mid` | `residential_single` | 2 or 3 |
| `alto_padrao_contemporanea` | `high_end_contemporary` | `high` | `residential_single` | 2 or 3 |
| `mansao` | `mansion` | `high` | `residential_single` | 1 to 3 |
| `apartamento_novo` | `apartment_modern` | `mid` / `high` | `residential_multi` | 1 (unit) |

The old `mercado` and `farmacia` are in the commercial pack. A second, unreachable `mansao` template that the old file redefined was dropped.

## Styles, tiers

| Old | New |
|---|---|
| `popular` | `budget` |
| `medio` | `mid` |
| `alto` | `high` |
| `comercial` | `commercial` |
| `nobre` | `luxury` |

Style ids registered by this pack: `budget`, `mid`, `high` (alias `luxury`). The commercial pack adds `commercial`. Tiers of `apartment_modern`: `medio` is `mid`, `alto` is `high`.
Palette style recipes use the same ids; their legacy stream names (`popular`, `medio`, `alto`) stay in `legacy-seeds.ts`.

## Room types
| Old | New |
|---|---|
| `sala` | `living` |
| `cozinha` | `kitchen` |
| `quarto` | `bedroom` |
| `banheiro` | `bathroom` |
| `corredor` | `corridor` |
| `jantar` | `dining` |
| `lavanderia` | `laundry` |
| `garagem` | `garage` |
| `escritorio` | `office` |
| `escada` | `stairs` |
| `sacada` | `balcony` |
| `terraco` | `terrace` |
| `loja` | `shop` |
| `balcao` | `counter` |
| `estoque` | `stockroom` |
| `elevador` | `elevator` |
| `vazio` | `void` |

## Room ids (inside templates)
| Old | New |
|---|---|
| `sala_estar` | `sitting_room` |
| `estar` | `lounge` |
| `vazio_sala` | `void_living` |
| `quarto1` | `bedroom_1` |
| `quarto2` | `bedroom_2` |
| `quarto3` | `bedroom_3` |
| `lavabo` | `powder_room` |
| `circ` | `circulation` |
| `corredor_a` | `corridor_upper` |
| `escada_a` | `stairs_upper` |
| `escada_c` | `stairs_top` |
| `banheiro_a` | `bathroom_upper` |
| `banheiro_s` | `bathroom_suite` |
| `banho1` | `bath_1` |
| `banho2` | `bath_2` |
| `banho3` | `bath_3` |
| `banho4` | `bath_4` |
| `banhoA` | `bath_a` |
| `banhoB` | `bath_b` |
| `banhoC` | `bath_c` |
| `banhoD` | `bath_d` |
| `banho_m` | `bath_master` |
| `suite1` | `suite_1` |
| `suite2` | `suite_2` |
| `suite3` | `suite_3` |
| `suite4` | `suite_4` |
| `suiteA` | `suite_a` |
| `suiteB` | `suite_b` |
| `suiteC` | `suite_c` |
| `suiteD` | `suite_d` |
| `closet_m` | `closet_master` |
| `galeria` | `gallery` |
| `galeria_c` | `gallery_top` |
| `consultorio` | `consulting_room` |
| `dependencia` | `maid_room` |
| `gourmet_int` | `gourmet_indoor` |
| `sacada_a` | `balcony_upper` |
| `varanda` | `veranda` |
| `elevador_a` | `elevator_upper` |
| `elevador_c` | `elevator_top` |
| `vaga` | `parking` |
| `jardim` | `garden` |
| `quintal` | `backyard` |
| `lateral_esq` | `side_left` |
| `lateral_dir` | `side_right` |
| `fora` | `outside` |

## Library ids (slot libraries)
| Old | New |
|---|---|
| `sala` | `living` |
| `cozinha` | `kitchen` |
| `quarto` | `bedroom` |
| `banheiro` | `bathroom` |
| `corredor` | `corridor` |
| `jantar` | `dining` |
| `lavanderia` | `laundry` |
| `garagem` | `garage` |
| `escritorio` | `office` |
| `escada` | `stairs` |
| `sacada` | `balcony` |
| `terraco` | `terrace` |
| `loja` | `shop` |
| `balcao` | `counter` |
| `estoque` | `stockroom` |
| `elevador` | `elevator` |
| `vazio` | `void` |
| `banheiro_wc` | `bathroom_wc` |
| `loja_mercado` | `shop_market` |
| `balcao_mercado` | `counter_market` |
| `loja_farmacia` | `shop_pharmacy` |
| `balcao_farmacia` | `counter_pharmacy` |
| `jardim` | `garden` |
| `jardim_nobre` | `garden_grand` |
| `vaga` | `parking` |
| `acesso` | `access` |
| `lateral` | `side_yard` |
| `quintal` | `backyard` |
| `quintal_nobre` | `backyard_pool` |
| `quintal_servico` | `backyard_service` |
| `cozinha_int` | `kitchen_integrated` |
| `gourmet_coberto` | `gourmet_covered` |
| `garagem3` | `garage_3car` |
| `varanda_gourmet` | `balcony_gourmet` |
| `varanda` | `veranda` |
| `quintal_laje` | `backyard_slab` |
| `jardim_medio` | `garden_mid` |
| `jardim_alto` | `garden_high` |
| `quintal_medio` | `backyard_mid` |
| `gourmet_alto` | `gourmet_high` |
| `quintal_alto` | `backyard_high` |
| `quintal_sobrado` | `backyard_townhouse` |
| `closet_m` | `closet_master` |
| `sala_cinema` | `cinema_room` |

## Facade values

| Old | New |
|---|---|
| finish `chapisco` | `roughcast` |
| finish `reboco` | `plaster` |
| finish `reboco_parcial` | `partial_plaster` |
| finish `bloco_exposto` | `exposed_block` |
| finish `tijolo_aparente` | `exposed_brick` |
| roof `colonial` | `colonial` |
| roof `fibrocimento` | `fiber_cement` |
| roof `laje` | `slab` |

## Item types (residential)

| Old type | New type | Old category | New category |
|---|---|---|---|
| `sofa3` | `sofa_3seat` | `sofa` | `sofa` |
| `sofa2` | `sofa_2seat` | `sofa` | `sofa` |
| `sofa_l` | `sofa_l` | `sofa` | `sofa` |
| `sofa_xl` | `sofa_xl` | `sofa` | `sofa` |
| `rack` | `tv_unit` | `rack` | `tv_unit` |
| `rack_peq` | `tv_unit_small` | `rack` | `tv_unit` |
| `rack_grande` | `tv_unit_large` | `rack` | `tv_unit` |
| `tv` | `tv` | `tv` | `tv` |
| `tv_grande` | `tv_large` | `tv` | `tv` |
| `mesinha` | `coffee_table` | `mesa_centro` | `coffee_table` |
| `mesinha_red` | `coffee_table_round` | `mesa_centro` | `coffee_table` |
| `tapete` | `rug` | `tapete` | `rug` |
| `tapete_peq` | `rug_small` | `tapete` | `rug` |
| `poltrona` | `armchair` | `poltrona` | `armchair` |
| `poltrona_alta` | `armchair_high` | `poltrona` | `armchair` |
| `estante` | `shelf_unit` | `estante` | `shelf_unit` |
| `estante_peq` | `shelf_unit_small` | `estante` | `shelf_unit` |
| `luminaria` | `floor_lamp` | `luz` | `lamp` |
| `aparador` | `sideboard` | `aparador` | `sideboard` |
| `aparador_c` | `console_table` | `aparador_c` | `console_table` |
| `banco` | `bench` | `banco` | `bench` |
| `bancada_ferr` | `workbench` | `bancada` | `workbench` |
| `espelho_pe` | `floor_mirror` | `espelho` | `mirror` |
| `geladeira` | `fridge` | `geladeira` | `fridge` |
| `geladeira2` | `fridge_large` | `geladeira` | `fridge` |
| `fogao` | `stove` | `fogao` | `stove` |
| `fogao4` | `stove_4burner` | `fogao` | `stove` |
| `armario_cozinha` | `kitchen_cabinet` | `pia` | `kitchen_cabinet` |
| `armario_cozinha_g` | `kitchen_cabinet_large` | `pia` | `kitchen_cabinet` |
| `armario_cozinha_p` | `kitchen_cabinet_small` | `pia` | `kitchen_cabinet` |
| `mesa` | `dining_table` | `mesa_jantar` | `dining_table` |
| `mesa_peq` | `dining_table_small` | `mesa_jantar` | `dining_table` |
| `mesa_red` | `dining_table_round` | `mesa_jantar` | `dining_table` |
| `mesa_grande` | `dining_table_large` | `mesa_jantar_g` | `dining_table_large` |
| `microondas` | `microwave` | `eletro` | `appliance` |
| `lixeira` | `trash_bin` | `lixeira` | `trash_bin` |
| `despensa` | `pantry` | `despensa` | `pantry` |
| `cama_casal` | `double_bed` | `cama` | `bed` |
| `cama_queen` | `queen_bed` | `cama` | `bed` |
| `cama_solteiro` | `single_bed` | `cama` | `bed` |
| `cama_king` | `king_bed` | `cama_g` | `bed_king` |
| `criado` | `nightstand` | `criado` | `nightstand` |
| `guarda` | `wardrobe` | `guarda` | `wardrobe` |
| `guarda_peq` | `wardrobe_small` | `guarda` | `wardrobe` |
| `guarda_g` | `wardrobe_large` | `guarda_g` | `wardrobe_large` |
| `guarda_closet` | `closet_wardrobe` | `guarda_g` | `wardrobe_large` |
| `comoda` | `dresser` | `comoda` | `dresser` |
| `escrivaninha` | `desk` | `mesa_trab` | `desk` |
| `penteadeira` | `vanity_table` | `penteadeira` | `vanity_table` |
| `vaso` | `toilet` | `vaso` | `toilet` |
| `pia_b` | `washbasin` | `pia_b` | `washbasin` |
| `pia_coluna` | `pedestal_basin` | `pia_b` | `washbasin` |
| `box` | `shower` | `box` | `shower` |
| `box_g` | `shower_large` | `box` | `shower` |
| `cesto` | `hamper` | `cesto` | `hamper` |
| `tanque` | `laundry_tub` | `tanque` | `laundry_tub` |
| `maquina` | `washing_machine` | `maquina` | `washing_machine` |
| `armario_lav` | `laundry_cabinet` | `armario_lav` | `laundry_cabinet` |
| `estante_lav` | `laundry_shelf` | `estante_lav` | `laundry_shelf` |
| `carro` | `car` | `carro` | `car` |
| `carro_peq` | `car_small` | `carro` | `car` |
| `moto` | `motorcycle` | `moto` | `motorcycle` |
| `estante_ferr` | `tool_shelf` | `estante_ferr` | `tool_shelf` |
| `caixote` | `crate` | `caixote` | `crate` |
| `mesa_escr` | `office_desk` | `mesa_escr` | `office_desk` |
| `mesa_escr_g` | `office_desk_large` | `mesa_escr` | `office_desk` |
| `estante_livros` | `bookcase` | `estante_livros` | `bookcase` |
| `arquivo` | `filing_cabinet` | `arquivo` | `filing_cabinet` |
| `bufe` | `buffet` | `bufe` | `buffet` |
| `cristaleira` | `china_cabinet` | `cristaleira` | `china_cabinet` |
| `escada` | `stairs` | `escada` | `stairs` |
| `canteiro` | `planter_bed` | `canteiro` | `planter_bed` |
| `canteiro_peq` | `planter_bed_small` | `canteiro` | `planter_bed` |
| `arvore_peq` | `tree_small` | `arvore` | `tree` |
| `arvore_grande` | `tree_large` | `arvore_g` | `tree_large` |
| `arbusto` | `shrub` | `arbusto` | `shrub` |
| `vaso_ext` | `outdoor_pot` | `vaso_ext` | `outdoor_pot` |
| `fonte` | `fountain` | `fonte` | `fountain` |
| `banco_jardim` | `garden_bench` | `banco_j` | `garden_bench` |
| `varal` | `clothesline` | `varal` | `clothesline` |
| `churrasqueira` | `bbq_grill` | `churrasqueira` | `bbq_grill` |
| `edicula` | `outbuilding` | `edicula` | `outbuilding` |
| `casinha_cachorro` | `doghouse` | `casinha` | `doghouse` |
| `caixa_dagua` | `water_tank` | `caixa_dagua` | `water_tank` |
| `piscina` | `pool` | `piscina` | `pool` |
| `piscina_g` | `pool_large` | `piscina` | `pool` |
| `espreguicadeira` | `sun_lounger` | `espreguicadeira` | `sun_lounger` |
| `mesa_ext` | `outdoor_table` | `mesa_ext` | `outdoor_table` |
| `botijao` | `gas_cylinder` | `botijao` | `gas_cylinder` |
| `bicicleta` | `bicycle` | `bicicleta` | `bicycle` |
| `plafon` | `ceiling_light` | `luz_teto` | `ceiling_light` |
| `pendente` | `pendant` | `luz_teto` | `ceiling_light` |
| `spot_trilho` | `track_spot` | `luz_teto` | `ceiling_light` |
| `lustre` | `chandelier` | `luz_teto` | `ceiling_light` |
| `split_interno` | `wall_ac` | `ar_cond` | `air_conditioner` |
| `condensadora` | `ac_condenser` | `condensadora` | `ac_condenser` |
| `quadro_peq` | `picture_small` | `quadro` | `picture` |
| `quadro_grande` | `picture_large` | `quadro` | `picture` |
| `espelho` | `mirror` | `quadro` | `picture` |
| `vaso_chao` | `floor_plant` | `planta` | `plant` |
| `vaso_mesa` | `table_plant` | `planta` | `plant` |
| `pendente_planta` | `hanging_plant` | `planta` | `plant` |
| `cortina` | `curtain` | `cortina` | `curtain` |
| `persiana` | `blinds` | `cortina` | `curtain` |
| `bancada_am` | `breakfast_bar` | `bancada_am` | `breakfast_bar` |
| `sauna_cabine` | `sauna` | `sauna` | `sauna` |
| `ofuro` | `soaking_tub` | `ofuro` | `soaking_tub` |
| `bancada_gourmet` | `gourmet_counter` | `gourmet` | `gourmet` |
| `bancada_gourmet_peq` | `gourmet_counter_small` | `gourmet` | `gourmet` |
| `mesa_gourmet` | `gourmet_table` | `gourmet` | `gourmet` |
| `mesa_gourmet_peq` | `gourmet_table_small` | `gourmet` | `gourmet` |
| `piscina_peq` | `pool_small` | `piscina` | `pool` |
| `piscina_media` | `pool_medium` | `piscina` | `pool` |
| `deck` | `deck` | `deck` | `deck` |
| `canteiro_horta` | `garden_bed` | `horta` | `garden_bed` |
| `arvore_frutifera` | `fruit_tree` | `arvore` | `tree` |
| `palmeira` | `palm_tree` | `arvore` | `tree` |
| `pergolado` | `pergola` | `pergolado` | `pergola` |
| `churrasqueira_simples` | `bbq_simple` | `churrasqueira_simples` | `bbq_simple` |
| `escorregador` | `slide` | `brinquedo` | `playground` |
| `balanco` | `swing` | `brinquedo` | `playground` |
| `banqueta` | `stool` | `banqueta` | `stool` |
| `abajur` | `table_lamp` | `luz_mesa` | `table_light` |
| `caixa_correio` | `mailbox` | `correio` | `mailbox` |

Several types are Brazilian in flavour and kept as they were: `churrasqueira` is `bbq_grill`, `edicula` is `outbuilding`, `tanque` is `laundry_tub`, `varal` is `clothesline`, `caixa_dagua` is `water_tank`, `botijao` is `gas_cylinder`, `bancada_gourmet` is `gourmet_counter`. They come with the residential pack and can be replaced per region.

## Item categories (residential)

| Old category | New category |
|---|---|
| `aparador` | `sideboard` |
| `aparador_c` | `console_table` |
| `ar_cond` | `air_conditioner` |
| `arbusto` | `shrub` |
| `armario_lav` | `laundry_cabinet` |
| `arquivo` | `filing_cabinet` |
| `arvore` | `tree` |
| `arvore_g` | `tree_large` |
| `bancada` | `workbench` |
| `bancada_am` | `breakfast_bar` |
| `banco` | `bench` |
| `banco_j` | `garden_bench` |
| `banqueta` | `stool` |
| `bicicleta` | `bicycle` |
| `botijao` | `gas_cylinder` |
| `box` | `shower` |
| `brinquedo` | `playground` |
| `bufe` | `buffet` |
| `caixa_dagua` | `water_tank` |
| `caixote` | `crate` |
| `cama` | `bed` |
| `cama_g` | `bed_king` |
| `canteiro` | `planter_bed` |
| `carro` | `car` |
| `casinha` | `doghouse` |
| `cesto` | `hamper` |
| `churrasqueira` | `bbq_grill` |
| `churrasqueira_simples` | `bbq_simple` |
| `comoda` | `dresser` |
| `condensadora` | `ac_condenser` |
| `cortina` | `curtain` |
| `criado` | `nightstand` |
| `cristaleira` | `china_cabinet` |
| `deck` | `deck` |
| `despensa` | `pantry` |
| `edicula` | `outbuilding` |
| `eletro` | `appliance` |
| `escada` | `stairs` |
| `espelho` | `mirror` |
| `espreguicadeira` | `sun_lounger` |
| `estante` | `shelf_unit` |
| `estante_ferr` | `tool_shelf` |
| `estante_lav` | `laundry_shelf` |
| `estante_livros` | `bookcase` |
| `fogao` | `stove` |
| `fonte` | `fountain` |
| `geladeira` | `fridge` |
| `gourmet` | `gourmet` |
| `guarda` | `wardrobe` |
| `guarda_g` | `wardrobe_large` |
| `horta` | `garden_bed` |
| `lixeira` | `trash_bin` |
| `luz` | `lamp` |
| `luz_teto` | `ceiling_light` |
| `maquina` | `washing_machine` |
| `mesa_centro` | `coffee_table` |
| `mesa_escr` | `office_desk` |
| `mesa_ext` | `outdoor_table` |
| `mesa_jantar` | `dining_table` |
| `mesa_jantar_g` | `dining_table_large` |
| `mesa_trab` | `desk` |
| `moto` | `motorcycle` |
| `ofuro` | `soaking_tub` |
| `penteadeira` | `vanity_table` |
| `pergolado` | `pergola` |
| `pia` | `kitchen_cabinet` |
| `pia_b` | `washbasin` |
| `piscina` | `pool` |
| `planta` | `plant` |
| `poltrona` | `armchair` |
| `quadro` | `picture` |
| `rack` | `tv_unit` |
| `sauna` | `sauna` |
| `sofa` | `sofa` |
| `tanque` | `laundry_tub` |
| `tapete` | `rug` |
| `tv` | `tv` |
| `varal` | `clothesline` |
| `vaso` | `toilet` |
| `vaso_ext` | `outdoor_pot` |

## Display names (locale keys)

The strings below were literal Portuguese in the old SDK. They are now keys in `src/locales/en.json` and `pt-BR.json`; `pt-BR` returns exactly the old text.

| Portuguese label (pt-BR locale) | Locale key | English (en locale) |
|---|---|---|
| `Sala` | `living` | `Living room` |
| `Cozinha` | `kitchen` | `Kitchen` |
| `Quarto` | `bedroom` | `Bedroom` |
| `Banheiro` | `bathroom` | `Bathroom` |
| `Quarto 1` | `bedroom_1` | `Bedroom 1` |
| `Quarto 2` | `bedroom_2` | `Bedroom 2` |
| `Quarto 3` | `bedroom_3` | `Bedroom 3` |
| `Lavabo` | `powder_room` | `Powder room` |
| `Lavanderia` | `laundry` | `Laundry` |
| `Escada` | `stairs` | `Stairs` |
| `Circulação` | `circulation` | `Circulation` |
| `Corredor` | `corridor` | `Corridor` |
| `Sacada` | `balcony` | `Balcony` |
| `Caixas` | `checkouts` | `Checkouts` |
| `Loja` | `shop` | `Shop floor` |
| `Estoque` | `stockroom` | `Stockroom` |
| `Escritório` | `office` | `Office` |
| `Balcão` | `counter` | `Counter` |
| `Consultório` | `consulting_room` | `Consulting room` |
| `Suíte` | `suite` | `Suite` |
| `Banheiro da suíte` | `bathroom_suite` | `Suite bathroom` |
| `Sala de estar` | `sitting_room` | `Sitting room` |
| `Sala de jantar` | `dining` | `Dining room` |
| `Hall` | `hall` | `Hall` |
| `Garagem` | `garage` | `Garage` |
| `Banheiro social` | `bathroom_guest` | `Guest bathroom` |
| `Banheiro da suíte ` | `bathroom_suite` | `Suite bathroom` |
| `Área gourmet` | `gourmet_area` | `Gourmet area` |
| `Suíte 1` | `suite_1` | `Suite 1` |
| `Suíte 2` | `suite_2` | `Suite 2` |
| `Suíte 3` | `suite_3` | `Suite 3` |
| `Suíte 4` | `suite_4` | `Suite 4` |
| `Banheiro 1` | `bathroom_1` | `Bathroom 1` |
| `Banheiro 2` | `bathroom_2` | `Bathroom 2` |
| `Banheiro 3` | `bathroom_3` | `Bathroom 3` |
| `Banheiro 4` | `bathroom_4` | `Bathroom 4` |
| `Varanda` | `veranda` | `Veranda` |
| `Terraço` | `terrace` | `Terrace` |
| `Térreo` | `ground_floor` | `Ground floor` |
| `Andar superior` | `upper_floor` | `Upper floor` |
| `Cobertura` | `penthouse_floor` | `Top floor` |
| `Andar` | `floor` | `Floor` |
| `Sala (pé-direito duplo)` | `living_double_height` | `Living room (double height)` |
| `Home office` | `home_office` | `Home office` |
| `Garagem (3 carros)` | `garage_3car` | `Garage (3 cars)` |
| `Sala íntima` | `family_room` | `Family room` |
| `Spa (sauna e ofurô)` | `spa` | `Spa (sauna and soaking tub)` |
| `Espaço gourmet` | `gourmet_space` | `Gourmet space` |
| `Vazio da sala` | `void_living` | `Living room void` |
| `Galeria` | `gallery` | `Gallery` |
| `Closet` | `closet` | `Closet` |
| `Suíte A` | `suite_a` | `Suite A` |
| `Suíte B` | `suite_b` | `Suite B` |
| `Suíte C` | `suite_c` | `Suite C` |
| `Suíte D` | `suite_d` | `Suite D` |
| `Banheiro A` | `bathroom_a` | `Bathroom A` |
| `Banheiro B` | `bathroom_b` | `Bathroom B` |
| `Banheiro C` | `bathroom_c` | `Bathroom C` |
| `Banheiro D` | `bathroom_d` | `Bathroom D` |
| `Suíte master` | `suite_master` | `Master suite` |
| `Banheiro master` | `bathroom_master` | `Master bathroom` |
| `Closet master` | `closet_master` | `Master closet` |
| `Cinema` | `cinema` | `Cinema` |
| `Terraço (deck e jacuzzi)` | `terrace_deck` | `Terrace (deck and jacuzzi)` |
| `Elevador` | `elevator` | `Elevator` |
| `Dependência` | `maid_room` | `Maid room` |
| `Área de serviço` | `service_area` | `Service area` |
| `Varanda gourmet` | `veranda_gourmet` | `Gourmet veranda` |
| `Vaga` | `parking` | `Parking` |
| `Jardim` | `garden` | `Garden` |
| `Quintal` | `backyard` | `Backyard` |
| `Lateral esquerda` | `side_left` | `Left side` |
| `Lateral direita` | `side_right` | `Right side` |
| `Gourmet` | `gourmet` | `Gourmet` |
| `Piscina e jardim` | `pool_garden` | `Pool and garden` |

## Regions and zones

`register(engine, { region })` selects region data. `'br'` (default) holds the house paint swatches, facade colour names and the Brazilian zoning table; the region is a plain object (`ResidentialRegion`), so `regions/us` can be added without touching the templates, or pass an object directly.

| Zone id | Intent | Uses | Floors | Max height | Setbacks front / side / back |
|---|---|---|---|---|---|
| `zr1` | Low-density residential | `residential_single` | 2 | 9 m | 5 / 1.5 / 3 |
| `zr_ap` | High-end gated residential | `residential_single` | 3 | 12 m | 8 / 3 / 5 |
| `zr2` | Medium density | single and multi | 4 | 14 m | 4 / 1.5 / 3 |
| `zr3_zm` | Mixed use | single, multi, `commercial`, `mixed` | 12 | 40 m | 0 / 0 / 3 |

Labels are in the `zones` locale namespace (for example `pt-BR`: `ZR-1 – Residencial de baixa densidade`). Commercial and industrial zones (`zc`, `zi`) come with the commercial pack.

## Slab house with upper floors (spec 001, T2.2g)

`budget_slab_house` takes `floors` 1 to 3 (`floorRange: [1, 3]`). **Default stays 1 floor**, the page's plan (the 75 recorded plans of `popular_laje` still match); `randomFloors: true` draws 1 to 3 evenly from the seed (the Galeria's `1 + floor(R * 3)`).
Each upper floor repeats the footprint with two bedrooms and a bathroom (`bedroom_1`, `bedroom_2`, `bath_1`; then `bedroom_3`, `bedroom_4`, `bath_2`). A straight stair on the left side margin reaches them from outside:
`result.config.sideStair` = `{ side, rect, flights, risers, doors }` (one 3.9 m flight per floor, `doors` are the outside doors of the upper floors, ids `d1_0`, `d2_0`). The top slab shows rebar starter bars (`facade.slab.exposedRebar`) in 60% of the multi-floor houses (always on the one-floor house, as on the page).
