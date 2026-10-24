| **Total** | **26474** | **-26217** |# Checklist de modelos 3D dos itens

Fonte: Itens do Vale Cinzento (`sources/armas-itens__itens-vale-cinzento.js`, catálogo `versao` 0.1, lista `MODELS`; artefato https://claude.ai/artifact/NKmkGZ2Lvcd96mp6Nyksds).
Gerado por `tools/items-catalog` (`pnpm --filter @adatechnology/items-catalog-tool catalog`). **36 de 257 itens têm modelo 3D; faltam 221.**

Pedido ao time de itens: entregar o modelo de cada item marcado `[ ]`, no estilo low poly dos que já existem e **no tamanho real**. A vitrine atual normaliza todos para 1,55 de altura;
o SDK não: desenha cada item na medida da coluna **tamanho real** (largura x altura x profundidade, no quadro do item). Para os 24 modelados a medida é a caixa do modelo do time vezes uma escala tirada
de uma medida real do objeto; para os demais é uma referência (REF) de um objeto comum, que o time pode corrigir ao entregar o modelo. Até o modelo chegar, o SDK usa a forma simples nessa medida.

| Categoria | Têm | Faltam |
|---|---|---|
| Comida | 3500 | -3464 |
| Bebida | 1248 | -1236 |
| Medicina e primeiros socorros | 2691 | -2665 |
| Ferramentas | 2858 | -2828 |
| Armas brancas e de disparo silencioso | 1916 | -1896 |
| Materiais de construção e crafting | 2245 | -2222 |
| Roupas e proteção | 2461 | -2438 |
| Mochilas e contêineres | 1630 | -1615 |
| Eletrônicos, rádio e luz | 2135 | -2115 |
| Combustível e energia | 1000 | -991 |
| Campo, pesca e caça | 1249 | -1238 |
| Livros e revistas | 666 | -661 |
| História e colecionáveis | 1668 | -1652 |
| Chaves e acesso | 1207 | -1196 |
| **Total** | **36** | **221** |

## Comida (15 de 36)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Arroz (1 kg) | `arroz` | `rice` | 1,0 kg | comum | 171 x 250 x 71 mm |
| [x] | Feijão em lata | `feijao_lata` | `canned_beans` | 0,45 kg | comum | 80 x 68 x 79 mm |
| [x] | Ração operacional do Exército | `racao_militar` | `military_ration` | 0,9 kg | comum | 194 x 260 x 59 mm |
| [x] | Açúcar (1 kg) (kit) | `acucar` | `sugar` | 1,0 kg | comum | 100 x 200 x 60 mm |
| [x] | Barra de chocolate (kit) | `chocolate` | `chocolate_bar` | 0,09 kg | comum | 150 x 70 x 10 mm |
| [x] | Batata (1 kg) (kit) | `batata` | `potatoes` | 1,0 kg | comum | 200 x 90 x 140 mm |
| [x] | Biscoito de água e sal (kit) | `biscoito` | `biscuits` | 0,2 kg | comum | 200 x 50 x 100 mm |
| [x] | Café em pó (500 g) (kit) | `cafe_po` | `coffee` | 0,5 kg | comum | 80 x 150 x 60 mm |
| [x] | Carne bovina crua (1 kg) (kit) | `carne_bovina` | `raw_beef` | 1,0 kg | comum | 200 x 50 x 150 mm |
| [x] | Carne de caça (capivara, javali) (kit) | `carne_caca` | `game_meat` | 1,5 kg | comum | 300 x 80 x 200 mm |
| [x] | Charque (kit) | `charque` | `jerked_beef` | 0,5 kg | incomum | 250 x 25 x 150 mm |
| [x] | Conserva caseira (pote) (kit) | `conserva` | `home_preserves` | 0,6 kg | incomum | 90 x 130 x 90 mm |
| [x] | Dúzia de ovos (kit) | `ovos` | `eggs` | 0,7 kg | comum | 250 x 70 x 100 mm |
| [x] | Farinha de mandioca (1 kg) (kit) | `farinha_mandioca` | `cassava_flour` | 1,0 kg | comum | 150 x 250 x 60 mm |
| [x] | Feijão seco (1 kg) (kit) | `feijao_seco` | `beans` | 1,0 kg | comum | 100 x 200 x 60 mm |
| [ ] | Frango congelado | `frango` | `frozen_chicken` | 1,2 kg | comum | 260 x 100 x 170 mm |
| [ ] | Laranja | `laranja` | `orange` | 0,2 kg | comum | 75 x 75 x 75 mm |
| [ ] | Leite condensado | `leite_condensado` | `condensed_milk` | 0,4 kg | incomum | 73 x 100 x 73 mm |
| [ ] | Macarrão (500 g) | `macarrao` | `pasta` | 0,5 kg | comum | 100 x 250 x 40 mm |
| [ ] | Macarrão instantâneo | `macarrao_inst` | `instant_noodles` | 0,08 kg | comum | 120 x 160 x 30 mm |
| [ ] | Mandioca (raiz) | `mandioca` | `cassava_root` | 1,5 kg | comum | 400 x 70 x 70 mm |
| [ ] | Milho e ervilha em lata | `milho_lata` | `canned_corn_and_peas` | 0,3 kg | comum | 73 x 85 x 73 mm |
| [ ] | Mortadela (peça) | `mortadela` | `mortadella` | 0,4 kg | comum | 150 x 60 x 50 mm |
| [ ] | Peixe fresco | `peixe_fresco` | `fresh_fish` | 0,6 kg | comum | 300 x 60 x 100 mm |
| [ ] | Peixe salgado | `peixe_salgado` | `salted_fish` | 0,4 kg | incomum | 250 x 30 x 100 mm |
| [ ] | Penca de banana | `banana` | `banana_bunch` | 1,0 kg | comum | 300 x 130 x 170 mm |
| [ ] | Pote de mel | `mel` | `honey_jar` | 0,5 kg | incomum | 80 x 100 x 80 mm |
| [ ] | Pão de forma | `pao_forma` | `bread` | 0,5 kg | comum | 300 x 100 x 100 mm |
| [ ] | Queijo minas | `queijo` | `cheese` | 0,5 kg | incomum | 150 x 40 x 100 mm |
| [ ] | Rapadura | `rapadura` | `rapadura` | 0,5 kg | incomum | 190 x 100 x 60 mm |
| [ ] | Ração de cachorro (1 kg) | `racao_cao` | `dog_food` | 1,0 kg | comum | 180 x 260 x 70 mm |
| [ ] | Sal (1 kg) | `sal` | `salt` | 1,0 kg | comum | 70 x 160 x 70 mm |
| [ ] | Salgadinho de pacote | `salgadinho` | `snack_chips` | 0,1 kg | comum | 200 x 280 x 60 mm |
| [ ] | Salsicha em lata | `salsicha_lata` | `canned_sausages` | 0,3 kg | comum | 73 x 85 x 73 mm |
| [ ] | Sardinha em lata | `sardinha` | `canned_sardines` | 0,13 kg | comum | 112 x 26 x 65 mm |
| [ ] | Óleo de cozinha (900 ml) | `oleo_cozinha` | `cooking_oil` | 0,9 kg | comum | 70 x 260 x 70 mm |

## Bebida (2 de 12)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Cachaça (garrafa) | `cachaca` | `cachaca` | 1,0 kg | incomum | 90 x 214 x 90 mm |
| [x] | Água mineral (500 ml) | `agua_500` | `water_bottle` | 0,52 kg | comum | 66 x 183 x 66 mm |
| [ ] | Cerveja (lata) | `cerveja` | `beer_can` | 0,35 kg | comum | 66 x 120 x 66 mm |
| [ ] | Energético (lata) | `energetico` | `energy_drink` | 0,27 kg | incomum | 58 x 135 x 58 mm |
| [ ] | Galão de água (5 L) | `galao_agua` | `water_jug_5l` | 5,2 kg | incomum | 190 x 330 x 150 mm |
| [ ] | Isotônico | `isotonico` | `sports_drink` | 0,52 kg | incomum | 66 x 183 x 66 mm |
| [ ] | Leite longa vida (1 L) | `leite` | `milk_carton` | 1,05 kg | comum | 70 x 200 x 70 mm |
| [ ] | Refrigerante (lata) | `refri_lata` | `soda_can` | 0,35 kg | comum | 66 x 120 x 66 mm |
| [ ] | Suco de caixinha | `suco_cx` | `juice_box` | 0,2 kg | comum | 52 x 100 x 37 mm |
| [ ] | Vinho de missa | `vinho` | `communion_wine` | 0,75 kg | incomum | 76 x 300 x 76 mm |
| [ ] | Água de coco | `agua_coco` | `coconut_water` | 0,4 kg | comum | 60 x 170 x 60 mm |
| [ ] | Água de rio ou poça | `agua_suja` | `dirty_water` | 0,5 kg | comum | 66 x 183 x 66 mm |

## Medicina e primeiros socorros (3 de 26)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Antibiótico (amoxicilina) | `amoxicilina` | `amoxicillin` | 0,05 kg | incomum | 100 x 53 x 69 mm |
| [x] | Atadura de crepe | `atadura` | `bandage` | 0,05 kg | comum | 101 x 78 x 44 mm |
| [x] | Kit de primeiros socorros | `kit_ps` | `first_aid_kit` | 0,9 kg | incomum | 250 x 214 x 96 mm |
| [ ] | Analgésico (dipirona, 10 comp.) | `analgesico` | `painkillers` | 0,03 kg | comum | 60 x 20 x 40 mm |
| [ ] | Analgésico forte (tramadol) | `opioide` | `tramadol` | 0,03 kg | raro | 95 x 50 x 15 mm |
| [ ] | Anti-inflamatório (ibuprofeno) | `ibuprofeno` | `ibuprofen` | 0,03 kg | comum | 95 x 50 x 15 mm |
| [ ] | Antialérgico | `antialergico` | `antihistamine` | 0,02 kg | incomum | 80 x 50 x 15 mm |
| [ ] | Antibiótico injetável (ceftriaxona) | `ceftriaxona` | `ceftriaxone` | 0,1 kg | raro | 100 x 60 x 30 mm |
| [ ] | Calmante (clonazepam) | `calmante` | `clonazepam` | 0,02 kg | raro | 90 x 50 x 15 mm |
| [ ] | Carvão ativado | `carvao_ativado` | `activated_charcoal` | 0,05 kg | incomum | 60 x 95 x 25 mm |
| [ ] | Curativo adesivo (caixa) | `curativo` | `adhesive_bandages` | 0,03 kg | comum | 100 x 60 x 15 mm |
| [ ] | Esparadrapo | `esparadrapo` | `medical_tape` | 0,04 kg | comum | 50 x 25 x 50 mm |
| [ ] | Gaze estéril | `gaze` | `sterile_gauze` | 0,02 kg | comum | 100 x 100 x 15 mm |
| [ ] | Iodopovidona | `pvpi` | `povidone_iodine` | 0,1 kg | incomum | 45 x 110 x 35 mm |
| [ ] | Kit de sutura | `kit_sutura` | `suture_kit` | 0,15 kg | raro | 150 x 80 x 30 mm |
| [ ] | Luvas de procedimento | `luva_proc` | `exam_gloves` | 0,02 kg | comum | 100 x 120 x 10 mm |
| [ ] | Máscara N95 | `n95` | `n95_mask` | 0,02 kg | incomum | 150 x 110 x 25 mm |
| [ ] | Polivitamínico | `vitamina` | `multivitamin` | 0,05 kg | comum | 50 x 90 x 50 mm |
| [ ] | Remédio de uso contínuo | `remedio_continuo` | `maintenance_medication` | 0,05 kg | comum | 45 x 90 x 45 mm |
| [ ] | Sais de reidratação | `sais_reidrat` | `rehydration_salts` | 0,03 kg | comum | 90 x 120 x 10 mm |
| [ ] | Seringa descartável | `seringa` | `syringe` | 0,01 kg | comum | 150 x 20 x 20 mm |
| [ ] | Soro antiofídico | `antiofidico` | `antivenom` | 0,2 kg | muito raro | 150 x 90 x 50 mm |
| [ ] | Soro fisiológico com equipo | `soro` | `saline_iv_bag` | 0,55 kg | raro | 120 x 250 x 45 mm |
| [ ] | Tala imobilizadora | `tala` | `splint` | 0,3 kg | incomum | 460 x 110 x 10 mm |
| [ ] | Termômetro | `termometro` | `thermometer` | 0,02 kg | comum | 120 x 20 x 30 mm |
| [ ] | Álcool 70% (500 ml) | `alcool70` | `alcohol_70` | 0,5 kg | comum | 70 x 200 x 50 mm |

## Ferramentas (2 de 30)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Martelo | `martelo` | `hammer` | 0,6 kg | comum | 159 x 330 x 47 mm |
| [x] | Pé de cabra | `pe_cabra` | `crowbar` | 1,5 kg | incomum | 188 x 750 x 48 mm |
| [ ] | Abridor de lata | `abridor` | `can_opener` | 0,05 kg | comum | 140 x 40 x 25 mm |
| [ ] | Alicate | `alicate` | `pliers` | 0,3 kg | comum | 200 x 30 x 70 mm |
| [ ] | Alicate corta-vergalhão | `corta_vergalhao` | `bolt_cutters` | 3,5 kg | raro | 600 x 60 x 150 mm |
| [ ] | Balde | `balde` | `bucket` | 0,5 kg | comum | 280 x 270 x 280 mm |
| [ ] | Binóculo | `binoculo` | `binoculars` | 0,6 kg | incomum | 180 x 150 x 120 mm |
| [ ] | Caixa de fósforos | `fosforo` | `matches` | 0,02 kg | comum | 50 x 15 x 35 mm |
| [ ] | Canivete multifuncional | `canivete` | `pocket_knife` | 0,15 kg | incomum | 110 x 22 x 32 mm |
| [ ] | Chave de fenda | `chave_fenda` | `screwdriver` | 0,15 kg | comum | 220 x 40 x 40 mm |
| [ ] | Chave inglesa | `chave_inglesa` | `adjustable_wrench` | 0,5 kg | comum | 250 x 20 x 60 mm |
| [ ] | Enxada | `enxada` | `hoe` | 1,8 kg | comum | 1,35 x 0,06 x 0,17 m |
| [ ] | Extintor de pó | `extintor` | `fire_extinguisher` | 4,0 kg | comum | 160 x 480 x 160 mm |
| [ ] | Fita silver tape | `silver_tape` | `duct_tape` | 0,2 kg | comum | 100 x 50 x 100 mm |
| [ ] | Fogareiro de camping | `fogareiro` | `camp_stove` | 0,8 kg | incomum | 180 x 100 x 110 mm |
| [ ] | Isqueiro | `isqueiro` | `lighter` | 0,02 kg | comum | 25 x 80 x 12 mm |
| [ ] | Kit de chaveiro (gazuas) | `kit_chaveiro` | `lockpick_kit` | 0,1 kg | muito raro | 100 x 70 x 20 mm |
| [ ] | Kit de costura | `kit_costura` | `sewing_kit` | 0,05 kg | comum | 90 x 50 x 30 mm |
| [ ] | Macaco e chave de roda | `macaco` | `car_jack` | 4,0 kg | comum | 300 x 110 x 110 mm |
| [ ] | Maleta de ferramentas do mecânico | `kit_mecanico` | `mechanic_toolbox` | 6,0 kg | raro | 400 x 200 x 200 mm |
| [ ] | Maçarico a gás | `macarico` | `gas_torch` | 3,0 kg | raro | 150 x 420 x 150 mm |
| [ ] | Máquina de solda inversora | `solda` | `inverter_welder` | 6,0 kg | raro | 300 x 220 x 130 mm |
| [ ] | Panela | `panela` | `pot` | 1,0 kg | comum | 250 x 150 x 250 mm |
| [ ] | Parafusadeira a bateria | `parafusadeira` | `cordless_drill` | 1,5 kg | incomum | 220 x 200 x 70 mm |
| [ ] | Pederneira | `pederneira` | `flint_striker` | 0,08 kg | raro | 110 x 20 x 15 mm |
| [ ] | Pedra de amolar | `amolador` | `sharpening_stone` | 0,3 kg | incomum | 200 x 50 x 25 mm |
| [ ] | Pá | `pa` | `shovel` | 2,0 kg | comum | 1,1 x 0,07 x 0,22 m |
| [ ] | Serra de arco | `serra_arco` | `hacksaw` | 0,4 kg | incomum | 420 x 30 x 120 mm |
| [ ] | Serrote | `serrote` | `handsaw` | 0,5 kg | comum | 500 x 35 x 130 mm |
| [ ] | Tesoura | `tesoura` | `scissors` | 0,1 kg | comum | 180 x 15 x 70 mm |

## Armas brancas e de disparo silencioso (3 de 20)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Facão | `facao` | `machete` | 0,7 kg | comum | 550 x 85 x 35 mm |
| [x] | Machado | `machado` | `axe` | 1,6 kg | incomum | 250 x 700 x 59 mm |
| [x] | Taco com pregos | `taco_pregos` | `nail_bat` | 1,2 kg | incomum | 223 x 860 x 221 mm |
| [ ] | Arco recurvo | `arco` | `recurve_bow` | 1,2 kg | raro | 1,3 x 0,2 x 0,05 m |
| [ ] | Besta | `besta` | `crossbow` | 3,2 kg | muito raro | 700 x 120 x 800 mm |
| [ ] | Cano de ferro | `cano` | `iron_pipe` | 1,2 kg | comum | 800 x 35 x 35 mm |
| [ ] | Cutelo de açougue | `cutelo` | `meat_cleaver` | 0,6 kg | incomum | 330 x 30 x 120 mm |
| [ ] | Estilingue | `estilingue` | `slingshot` | 0,15 kg | incomum | 130 x 150 x 25 mm |
| [ ] | Faca de cozinha | `faca_cozinha` | `knife` | 0,2 kg | comum | 250 x 30 x 40 mm |
| [ ] | Faca tática | `faca_tatica` | `tactical_knife` | 0,3 kg | raro | 260 x 28 x 45 mm |
| [ ] | Flechas e virotes (6) | `flecha` | `arrows_and_bolts` | 0,3 kg | raro | 700 x 25 x 40 mm |
| [ ] | Foice | `foice` | `sickle` | 1,2 kg | incomum | 400 x 35 x 350 mm |
| [ ] | Frigideira de ferro | `frigideira` | `cast_iron_skillet` | 1,2 kg | comum | 430 x 50 x 250 mm |
| [ ] | Lança improvisada | `lanca` | `improvised_spear` | 1,1 kg | incomum | 1,6 x 0,04 x 0,04 m |
| [ ] | Machadinha | `machadinha` | `hatchet` | 0,8 kg | incomum | 350 x 50 x 130 mm |
| [ ] | Marreta | `marreta` | `sledgehammer` | 5,0 kg | raro | 900 x 120 x 250 mm |
| [ ] | Motosserra | `motosserra` | `chainsaw` | 6,0 kg | muito raro | 450 x 260 x 230 mm |
| [ ] | Picareta | `picareta` | `pickaxe` | 2,8 kg | raro | 900 x 40 x 350 mm |
| [ ] | Taco de beisebol | `taco` | `baseball_bat` | 1,0 kg | incomum | 860 x 70 x 70 mm |
| [ ] | Tonfa policial | `tonfa` | `police_baton` | 0,6 kg | comum | 500 x 100 x 45 mm |

## Materiais de construção e crafting (1 de 23)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Tábua | `tabua` | `wooden_plank` | 2,0 kg | comum | 800 x 249 x 283 mm |
| [ ] | Arame (rolo de 10 m) | `arame` | `wire_roll` | 0,5 kg | comum | 140 x 50 x 140 mm |
| [ ] | Arame farpado (rolo de 25 m) | `arame_farpado` | `barbed_wire` | 4,0 kg | incomum | 300 x 120 x 300 mm |
| [ ] | Cacos de vidro | `cacos` | `glass_shards` | 0,2 kg | comum | 120 x 50 x 100 mm |
| [ ] | Chapa de metal | `chapa` | `sheet_metal` | 6,0 kg | incomum | 600 x 3 x 450 mm |
| [ ] | Cimento (saco de 25 kg) | `cimento` | `cement_bag` | 25,0 kg | incomum | 500 x 100 x 300 mm |
| [ ] | Cola epóxi | `cola` | `epoxy_glue` | 0,1 kg | incomum | 100 x 60 x 30 mm |
| [ ] | Componentes eletrônicos | `componentes` | `electronic_components` | 0,1 kg | incomum | 100 x 20 x 80 mm |
| [ ] | Corda (15 m) | `corda` | `rope` | 1,0 kg | comum | 150 x 80 x 150 mm |
| [ ] | Fio de cobre (5 m) | `fio_cobre` | `copper_wire` | 0,3 kg | comum | 80 x 30 x 80 mm |
| [ ] | Garrafa PET vazia | `garrafa_pet` | `pet_bottle` | 0,05 kg | comum | 105 x 330 x 105 mm |
| [ ] | Garrafa de vidro vazia | `garrafa_vidro` | `glass_bottle` | 0,3 kg | comum | 75 x 260 x 75 mm |
| [ ] | Lata vazia | `lata_vazia` | `empty_can` | 0,05 kg | comum | 66 x 120 x 66 mm |
| [ ] | Lenha | `lenha` | `firewood` | 1,5 kg | comum | 400 x 120 x 160 mm |
| [ ] | Lona (4 × 4 m) | `lona` | `tarp` | 2,0 kg | comum | 350 x 100 x 250 mm |
| [ ] | Parafusos (caixa de 50) | `parafusos` | `screws` | 0,4 kg | comum | 90 x 50 x 50 mm |
| [ ] | Pregos (caixa de 100) | `pregos` | `nails` | 0,5 kg | comum | 130 x 60 x 50 mm |
| [ ] | Saco de ráfia | `saco_areia` | `raffia_sack` | 0,2 kg | comum | 400 x 20 x 300 mm |
| [ ] | Sucata de metal | `sucata` | `scrap_metal` | 1,0 kg | comum | 200 x 80 x 150 mm |
| [ ] | Tijolos (10) | `tijolo` | `bricks` | 25,0 kg | comum | 190 x 180 x 290 mm |
| [ ] | Trapo | `trapo` | `rag` | 0,05 kg | comum | 220 x 25 x 180 mm |
| [ ] | Vergalhão | `vergalhao` | `rebar` | 2,0 kg | comum | 1,27 x 0,02 x 0,02 m |
| [ ] | Óleo lubrificante spray | `lubrificante` | `lubricant_spray` | 0,25 kg | comum | 50 x 170 x 50 mm |

## Roupas e proteção (1 de 23)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Capacete de moto fechado | `capacete_moto` | `motorcycle_helmet` | 1,4 kg | incomum | 260 x 254 x 274 mm |
| [ ] | Bota de borracha | `bota_borracha` | `rubber_boots` | 1,2 kg | comum | 300 x 350 x 220 mm |
| [ ] | Braçadeira de revista | `braco_revista` | `magazine_arm_guard` | 0,4 kg | incomum | 300 x 60 x 150 mm |
| [ ] | Calça de motociclista | `calca_couro` | `leather_motorcycle_pants` | 1,6 kg | raro | 400 x 90 x 300 mm |
| [ ] | Calça jeans | `calca_jeans` | `jeans` | 0,8 kg | comum | 350 x 60 x 220 mm |
| [ ] | Camiseta | `camiseta` | `tshirt` | 0,15 kg | comum | 300 x 40 x 220 mm |
| [ ] | Capa de chuva | `capa_chuva` | `raincoat` | 0,4 kg | comum | 300 x 40 x 250 mm |
| [ ] | Capacete de obra (EPI) | `capacete_obra` | `hard_hat` | 0,4 kg | comum | 250 x 150 x 300 mm |
| [ ] | Casaco acolchoado | `casaco_frio` | `padded_coat` | 1,3 kg | incomum | 450 x 150 x 350 mm |
| [ ] | Chinelo de dedo | `chinelo` | `flip_flops` | 0,2 kg | comum | 290 x 30 x 230 mm |
| [ ] | Coletes balísticos (II-A, III-A, III) | `colete` | `ballistic_vest` | 3,0 kg | raro | 400 x 70 x 450 mm |
| [ ] | Coturno | `coturno` | `combat_boots` | 1,6 kg | incomum | 300 x 200 x 220 mm |
| [ ] | Farda camuflada do Exército | `farda_eb` | `army_camouflage_uniform` | 1,5 kg | comum | 400 x 100 x 320 mm |
| [ ] | Jaqueta de motociclista (couro) | `jaqueta_couro` | `leather_motorcycle_jacket` | 1,8 kg | raro | 450 x 100 x 350 mm |
| [ ] | Jaqueta jeans | `jaqueta_jeans` | `denim_jacket` | 1,0 kg | comum | 400 x 80 x 300 mm |
| [ ] | Luvas de couro (raspa) | `luva_couro` | `leather_work_gloves` | 0,2 kg | comum | 250 x 30 x 120 mm |
| [ ] | Macacão de mecânico | `macacao` | `mechanic_coveralls` | 1,2 kg | comum | 400 x 90 x 300 mm |
| [ ] | Moletom | `moletom` | `hoodie` | 0,6 kg | comum | 380 x 80 x 280 mm |
| [ ] | Protetor de antebraço de chapa | `braco_chapa` | `sheet_metal_forearm_guard` | 1,5 kg | raro | 300 x 100 x 120 mm |
| [ ] | Roupa de apicultor | `apicultor` | `beekeeper_suit` | 1,4 kg | muito raro | 400 x 100 x 330 mm |
| [ ] | Roupa de bombeiro | `bombeiro` | `firefighter_suit` | 4,0 kg | raro | 550 x 200 x 400 mm |
| [ ] | Tênis de corrida | `tenis` | `sneakers` | 0,7 kg | comum | 300 x 120 x 120 mm |
| [ ] | Óculos de proteção | `oculos` | `safety_goggles` | 0,05 kg | comum | 160 x 60 x 80 mm |

## Mochilas e contêineres (1 de 15)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Mochila de trilha 40 L | `mochila_trilha` | `hiking_backpack_40l` | 1,3 kg | incomum | 411 x 550 x 319 mm |
| [ ] | Bag de entregador | `bag_entregador` | `delivery_bag` | 1,2 kg | incomum | 480 x 450 x 420 mm |
| [ ] | Bolsa transversal | `bolsa` | `crossbody_bag` | 0,3 kg | comum | 250 x 200 x 80 mm |
| [ ] | Caixa térmica | `caixa_termica` | `cooler_box` | 1,0 kg | comum | 320 x 250 x 230 mm |
| [ ] | Carrinho de mercado | `carrinho_merc` | `shopping_cart` | 12,0 kg | comum | 550 x 980 x 950 mm |
| [ ] | Carrinho de mão | `carrinho_mao` | `wheelbarrow` | 15,0 kg | comum | 0,65 x 0,65 x 1,5 m |
| [ ] | Cinto de ferramentas | `cinto_ferramentas` | `tool_belt` | 0,4 kg | comum | 350 x 100 x 250 mm |
| [ ] | Colete tático | `colete_tatico` | `tactical_vest` | 1,2 kg | raro | 350 x 100 x 400 mm |
| [ ] | Mala de rodinha | `mala` | `rolling_suitcase` | 3,0 kg | comum | 400 x 650 x 250 mm |
| [ ] | Mochila cargueira 70 L | `cargueira` | `trekking_backpack_70l` | 2,2 kg | muito raro | 380 x 750 x 300 mm |
| [ ] | Mochila escolar | `mochila_escolar` | `backpack` | 0,5 kg | comum | 300 x 300 x 200 mm |
| [ ] | Mochila militar | `mochila_militar` | `military_backpack` | 1,8 kg | raro | 350 x 600 x 300 mm |
| [ ] | Pochete | `pochete` | `fanny_pack` | 0,15 kg | comum | 250 x 100 x 120 mm |
| [ ] | Saco de lixo | `saco_lixo` | `trash_bag` | 0,05 kg | comum | 250 x 25 x 200 mm |
| [ ] | Sacola de mercado | `sacola` | `shopping_bag` | 0,02 kg | comum | 300 x 20 x 200 mm |

## Eletrônicos, rádio e luz (4 de 20)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Lanterna (2 pilhas AA) | `lanterna` | `flashlight` | 0,2 kg | comum | 56 x 160 x 56 mm |
| [x] | Pilhas AA (par) | `pilha_aa` | `batteries` | 0,05 kg | comum | 37 x 51 x 17 mm |
| [x] | Rádio AM/FM a pilha | `radio_portatil` | `portable_radio` | 0,5 kg | comum | 220 x 295 x 70 mm |
| [x] | Walkie-talkie (par) | `walkie` | `walkie_talkies` | 0,6 kg | incomum | 70 x 220 x 33 mm |
| [ ] | Bateria 9 V | `bateria_9v` | `battery_9v` | 0,05 kg | comum | 26 x 49 x 18 mm |
| [ ] | Celular | `celular` | `mobile_phone` | 0,2 kg | comum | 77 x 160 x 9 mm |
| [ ] | Controle de alarme de carro | `controle_alarme` | `car_alarm_remote` | 0,03 kg | comum | 40 x 70 x 12 mm |
| [ ] | Despertador de corda | `despertador` | `windup_alarm_clock` | 0,3 kg | comum | 110 x 125 x 55 mm |
| [ ] | Eletrificador de cerca rural | `eletrificador` | `electric_fence_energizer` | 3,0 kg | raro | 250 x 200 x 150 mm |
| [ ] | Extensão elétrica 20 m | `extensao` | `extension_cord` | 1,5 kg | comum | 230 x 80 x 230 mm |
| [ ] | Gerador portátil a gasolina | `gerador` | `portable_generator` | 25,0 kg | raro | 500 x 420 x 430 mm |
| [ ] | Lampião LED de camping | `lampiao_led` | `led_camp_lantern` | 0,4 kg | incomum | 110 x 200 x 110 mm |
| [ ] | Lanterna de cabeça | `lanterna_cabeca` | `headlamp` | 0,1 kg | incomum | 90 x 60 x 50 mm |
| [ ] | Notebook | `notebook` | `laptop` | 2,0 kg | incomum | 360 x 25 x 250 mm |
| [ ] | Painel solar dobrável | `painel_solar` | `folding_solar_panel` | 1,5 kg | raro | 400 x 300 x 50 mm |
| [ ] | Power bank | `power_bank` | `power_bank` | 0,3 kg | incomum | 150 x 70 x 16 mm |
| [ ] | Rádio amador PX | `radio_px` | `cb_radio` | 3,0 kg | raro | 250 x 80 x 200 mm |
| [ ] | Rádio militar de longo alcance | `radio_militar` | `military_radio` | 6,0 kg | lendário | 300 x 200 x 250 mm |
| [ ] | Vela | `vela` | `candles` | 0,05 kg | comum | 60 x 120 x 60 mm |
| [ ] | Óculos de visão noturna | `nvg` | `night_vision_goggles` | 0,6 kg | muito raro | 150 x 100 x 110 mm |

## Combustível e energia (2 de 9)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Botijão de gás P13 | `botijao` | `lpg_cylinder_13kg` | 29,0 kg | comum | 353 x 490 x 358 mm |
| [x] | Galão de combustível 20 L | `galao` | `fuel_jerrycan` | 1,2 kg | incomum | 308 x 470 x 154 mm |
| [ ] | Bateria 12 V | `bateria_12v` | `car_battery_12v` | 14,0 kg | incomum | 240 x 190 x 175 mm |
| [ ] | Cartucho de gás | `cartucho_gas` | `gas_cartridge` | 0,35 kg | incomum | 110 x 165 x 110 mm |
| [ ] | Carvão (saco de 3 kg) | `carvao` | `charcoal_bag` | 3,0 kg | comum | 300 x 120 x 400 mm |
| [ ] | Diesel (litro) | `diesel` | `diesel` | 0,85 kg | incomum | 90 x 260 x 90 mm |
| [ ] | Gasolina (litro) | `gasolina` | `gasoline` | 0,75 kg | incomum | 90 x 260 x 90 mm |
| [ ] | Querosene (1 L) | `querosene` | `kerosene` | 0,8 kg | incomum | 90 x 260 x 90 mm |
| [ ] | Óleo de motor | `oleo_motor` | `motor_oil` | 1,0 kg | comum | 100 x 260 x 70 mm |

## Campo, pesca e caça (0 de 11)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [ ] | Adubo (saco de 10 kg) | `adubo` | `fertilizer_bag` | 10,0 kg | raro | 450 x 130 x 300 mm |
| [ ] | Armadilha de laço | `armadilha_laco` | `snare_trap` | 0,3 kg | comum | 150 x 30 x 150 mm |
| [ ] | Caixa de pesca (anzol, linha, isca) | `kit_pesca` | `fishing_tackle_box` | 0,6 kg | comum | 300 x 100 x 180 mm |
| [ ] | Rama de mandioca (maniva) | `maniva` | `cassava_cuttings` | 2,0 kg | incomum | 700 x 120 x 120 mm |
| [ ] | Rede de pesca | `rede_pesca` | `fishing_net` | 3,0 kg | incomum | 350 x 150 x 300 mm |
| [ ] | Regador | `regador` | `watering_can` | 0,5 kg | comum | 400 x 260 x 180 mm |
| [ ] | Sementes de abóbora | `sem_abobora` | `pumpkin_seeds` | 0,05 kg | incomum | 90 x 130 x 15 mm |
| [ ] | Sementes de couve e alface | `sem_couve` | `kale_and_lettuce_seeds` | 0,05 kg | incomum | 90 x 130 x 15 mm |
| [ ] | Sementes de feijão | `sem_feijao` | `bean_seeds` | 0,1 kg | incomum | 100 x 150 x 20 mm |
| [ ] | Sementes de milho | `sem_milho` | `corn_seeds` | 0,1 kg | incomum | 100 x 150 x 20 mm |
| [ ] | Vara de pesca | `vara_pesca` | `fishing_rod` | 1,0 kg | comum | 1,8 x 0,04 x 0,04 m |

## Livros e revistas (0 de 5)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [ ] | Almanaque do agricultor | `almanaque` | `farmers_almanac` | 0,3 kg | incomum | 150 x 210 x 15 mm |
| [ ] | Livro de habilidade (volumes 1 a 5) | `livro_hab` | `skill_book` | 0,6 kg | incomum | 160 x 230 x 40 mm |
| [ ] | Manual técnico | `livro_tecnico` | `technical_manual` | 0,8 kg | raro | 210 x 300 x 40 mm |
| [ ] | Revista Faça Você Mesmo | `revista_receita` | `diy_magazine` | 0,2 kg | incomum | 210 x 280 x 8 mm |
| [ ] | Revista e gibi | `revista_passa` | `magazines_and_comics` | 0,2 kg | comum | 170 x 260 x 10 mm |

## História e colecionáveis (1 de 16)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Diário de sobrevivente | `diario` | `survivor_diary` | 0,3 kg | único | 162 x 210 x 55 mm |
| [ ] | Bilhete e carta | `bilhete` | `note` | 0,01 kg | comum | 150 x 2 x 100 mm |
| [ ] | Cartão-postal do Vale (19) | `postal` | `valley_postcard` | 0,01 kg | único | do jogo |
| [ ] | Fichas da penitenciária | `fichas_presos` | `prisoner_files` | 0,2 kg | único | do jogo |
| [ ] | Fita da Rádio Vale FM (12) | `fita_radio` | `radio_tape` | 0,05 kg | único | do jogo |
| [ ] | Fotografia | `foto` | `photo` | 0,01 kg | comum | 102 x 2 x 152 mm |
| [ ] | Item marcado de NPC (31) | `item_marcado` | `npc_marked_item` | 0,2 kg | único | do jogo |
| [ ] | Livro de registro da Mina São Jorge | `registro_mina` | `mine_logbook` | 0,4 kg | único | do jogo |
| [ ] | Mapa da cidade anotado | `mapa_cidade` | `city_map` | 0,05 kg | raro | 110 x 10 x 250 mm |
| [ ] | Mapa militar | `mapa_militar` | `military_map` | 0,05 kg | muito raro | do jogo |
| [ ] | Mapa rodoviário | `mapa_rodoviario` | `road_map` | 0,05 kg | comum | 110 x 10 x 250 mm |
| [ ] | Maço de cigarro | `cigarro` | `cigarettes` | 0,03 kg | comum | 55 x 88 x 22 mm |
| [ ] | Maço de dinheiro | `dinheiro` | `cash` | 0,05 kg | comum | 155 x 10 x 65 mm |
| [ ] | Ordem de evacuação do 7º BIS | `ordem_evac` | `evacuation_order` | 0,05 kg | único | do jogo |
| [ ] | Plaqueta de identificação militar | `plaqueta` | `dog_tag` | 0,01 kg | comum | 30 x 3 x 50 mm |
| [ ] | Prontuário do paciente zero | `prontuario` | `patient_zero_record` | 0,1 kg | único | do jogo |

## Chaves e acesso (1 de 11)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Chave de casa | `chave_casa` | `house_key` | 0,02 kg | comum | 85 x 46 x 4 mm |
| [ ] | Cadeado com chave | `cadeado_chave` | `padlock_key` | 0,3 kg | comum | 50 x 80 x 25 mm |
| [ ] | Chave de carro | `chave_carro` | `car_key` | 0,02 kg | comum | 60 x 45 x 15 mm |
| [ ] | Chave de cela | `chave_cela` | `cell_key` | 0,05 kg | raro | 120 x 30 x 8 mm |
| [ ] | Chave do cofre da delegacia | `chave_cofre` | `safe_key` | 0,05 kg | único | 70 x 25 x 5 mm |
| [ ] | Chave do gerador do hospital | `chave_gerador` | `generator_key` | 0,05 kg | único | 80 x 30 x 6 mm |
| [ ] | Chave do teleférico | `chave_teleferico` | `cable_car_key` | 0,05 kg | único | do jogo |
| [ ] | Chave mestra da portaria | `chave_mestra` | `master_key` | 0,05 kg | incomum | 90 x 35 x 6 mm |
| [ ] | Crachá da hidrelétrica | `cracha_rep` | `dam_badge` | 0,01 kg | único | do jogo |
| [ ] | Código do bunker (3 pedaços) | `codigo_bunker` | `bunker_code` | 0,01 kg | único | do jogo |
| [ ] | Molho de chaves do zelador | `molho_zelador` | `janitor_keys` | 0,15 kg | incomum | 120 x 100 x 20 mm |
