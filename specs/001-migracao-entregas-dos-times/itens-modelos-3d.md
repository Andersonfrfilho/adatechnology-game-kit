# Checklist de modelos 3D dos itens

Fonte: Itens do Vale Cinzento (`sources/armas-itens__itens-vale-cinzento.js`, catálogo `versao` 0.1, lista `MODELS`; artefato https://claude.ai/artifact/NKmkGZ2Lvcd96mp6Nyksds).
Gerado por `tools/items-catalog` (`pnpm --filter @adatechnology/items-catalog-tool catalog`). **157 de 257 itens têm modelo 3D; faltam 100.**

Pedido ao time de itens: entregar o modelo de cada item marcado `[ ]`, no estilo low poly dos que já existem e **no tamanho real**. A vitrine atual normaliza todos para 1,55 de altura;
o SDK não: desenha cada item na medida da coluna **tamanho real** (largura x altura x profundidade, no quadro do item). Para os 24 modelados a medida é a caixa do modelo do time vezes uma escala tirada
de uma medida real do objeto; para os demais é uma referência (REF) de um objeto comum, que o time pode corrigir ao entregar o modelo. Até o modelo chegar, o SDK usa a forma simples nessa medida.

| Categoria | Têm | Faltam |
|---|---|---|
| Comida | 36 | 0 |
| Bebida | 12 | 0 |
| Medicina e primeiros socorros | 26 | 0 |
| Ferramentas | 30 | 0 |
| Armas brancas e de disparo silencioso | 20 | 0 |
| Materiais de construção e crafting | 23 | 0 |
| Roupas e proteção | 1 | 22 |
| Mochilas e contêineres | 1 | 14 |
| Eletrônicos, rádio e luz | 4 | 16 |
| Combustível e energia | 2 | 7 |
| Campo, pesca e caça | 0 | 11 |
| Livros e revistas | 0 | 5 |
| História e colecionáveis | 1 | 15 |
| Chaves e acesso | 1 | 10 |
| **Total** | **157** | **100** |

## Comida (36 de 36)

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
| [x] | Frango congelado (kit) | `frango` | `frozen_chicken` | 1,2 kg | comum | 260 x 100 x 170 mm |
| [x] | Laranja (kit) | `laranja` | `orange` | 0,2 kg | comum | 75 x 75 x 75 mm |
| [x] | Leite condensado (kit) | `leite_condensado` | `condensed_milk` | 0,4 kg | incomum | 73 x 100 x 73 mm |
| [x] | Macarrão (500 g) (kit) | `macarrao` | `pasta` | 0,5 kg | comum | 100 x 250 x 40 mm |
| [x] | Macarrão instantâneo (kit) | `macarrao_inst` | `instant_noodles` | 0,08 kg | comum | 120 x 160 x 30 mm |
| [x] | Mandioca (raiz) (kit) | `mandioca` | `cassava_root` | 1,5 kg | comum | 400 x 70 x 70 mm |
| [x] | Milho e ervilha em lata (kit) | `milho_lata` | `canned_corn_and_peas` | 0,3 kg | comum | 73 x 85 x 73 mm |
| [x] | Mortadela (peça) (kit) | `mortadela` | `mortadella` | 0,4 kg | comum | 150 x 60 x 50 mm |
| [x] | Peixe fresco (kit) | `peixe_fresco` | `fresh_fish` | 0,6 kg | comum | 300 x 60 x 100 mm |
| [x] | Peixe salgado (kit) | `peixe_salgado` | `salted_fish` | 0,4 kg | incomum | 250 x 30 x 100 mm |
| [x] | Penca de banana (kit) | `banana` | `banana_bunch` | 1,0 kg | comum | 300 x 130 x 170 mm |
| [x] | Pote de mel (kit) | `mel` | `honey_jar` | 0,5 kg | incomum | 80 x 100 x 80 mm |
| [x] | Pão de forma (kit) | `pao_forma` | `bread` | 0,5 kg | comum | 300 x 100 x 100 mm |
| [x] | Queijo minas (kit) | `queijo` | `cheese` | 0,5 kg | incomum | 150 x 40 x 100 mm |
| [x] | Rapadura (kit) | `rapadura` | `rapadura` | 0,5 kg | incomum | 190 x 100 x 60 mm |
| [x] | Ração de cachorro (1 kg) (kit) | `racao_cao` | `dog_food` | 1,0 kg | comum | 180 x 260 x 70 mm |
| [x] | Sal (1 kg) (kit) | `sal` | `salt` | 1,0 kg | comum | 70 x 160 x 70 mm |
| [x] | Salgadinho de pacote (kit) | `salgadinho` | `snack_chips` | 0,1 kg | comum | 200 x 280 x 60 mm |
| [x] | Salsicha em lata (kit) | `salsicha_lata` | `canned_sausages` | 0,3 kg | comum | 73 x 85 x 73 mm |
| [x] | Sardinha em lata (kit) | `sardinha` | `canned_sardines` | 0,13 kg | comum | 112 x 26 x 65 mm |
| [x] | Óleo de cozinha (900 ml) (kit) | `oleo_cozinha` | `cooking_oil` | 0,9 kg | comum | 70 x 260 x 70 mm |

## Bebida (12 de 12)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Cachaça (garrafa) | `cachaca` | `cachaca` | 1,0 kg | incomum | 90 x 214 x 90 mm |
| [x] | Água mineral (500 ml) | `agua_500` | `water_bottle` | 0,52 kg | comum | 66 x 183 x 66 mm |
| [x] | Cerveja (lata) (kit) | `cerveja` | `beer_can` | 0,35 kg | comum | 66 x 120 x 66 mm |
| [x] | Energético (lata) (kit) | `energetico` | `energy_drink` | 0,27 kg | incomum | 58 x 135 x 58 mm |
| [x] | Galão de água (5 L) (kit) | `galao_agua` | `water_jug_5l` | 5,2 kg | incomum | 190 x 330 x 150 mm |
| [x] | Isotônico (kit) | `isotonico` | `sports_drink` | 0,52 kg | incomum | 66 x 183 x 66 mm |
| [x] | Leite longa vida (1 L) (kit) | `leite` | `milk_carton` | 1,05 kg | comum | 70 x 200 x 70 mm |
| [x] | Refrigerante (lata) (kit) | `refri_lata` | `soda_can` | 0,35 kg | comum | 66 x 120 x 66 mm |
| [x] | Suco de caixinha (kit) | `suco_cx` | `juice_box` | 0,2 kg | comum | 52 x 100 x 37 mm |
| [x] | Vinho de missa (kit) | `vinho` | `communion_wine` | 0,75 kg | incomum | 76 x 300 x 76 mm |
| [x] | Água de coco (kit) | `agua_coco` | `coconut_water` | 0,4 kg | comum | 60 x 170 x 60 mm |
| [x] | Água de rio ou poça (kit) | `agua_suja` | `dirty_water` | 0,5 kg | comum | 66 x 183 x 66 mm |

## Medicina e primeiros socorros (26 de 26)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Antibiótico (amoxicilina) | `amoxicilina` | `amoxicillin` | 0,05 kg | incomum | 100 x 53 x 69 mm |
| [x] | Atadura de crepe | `atadura` | `bandage` | 0,05 kg | comum | 101 x 78 x 44 mm |
| [x] | Kit de primeiros socorros | `kit_ps` | `first_aid_kit` | 0,9 kg | incomum | 250 x 214 x 96 mm |
| [x] | Analgésico (dipirona, 10 comp.) (kit) | `analgesico` | `painkillers` | 0,03 kg | comum | 60 x 20 x 40 mm |
| [x] | Analgésico forte (tramadol) (kit) | `opioide` | `tramadol` | 0,03 kg | raro | 95 x 50 x 15 mm |
| [x] | Anti-inflamatório (ibuprofeno) (kit) | `ibuprofeno` | `ibuprofen` | 0,03 kg | comum | 95 x 50 x 15 mm |
| [x] | Antialérgico (kit) | `antialergico` | `antihistamine` | 0,02 kg | incomum | 80 x 50 x 15 mm |
| [x] | Antibiótico injetável (ceftriaxona) (kit) | `ceftriaxona` | `ceftriaxone` | 0,1 kg | raro | 100 x 60 x 30 mm |
| [x] | Calmante (clonazepam) (kit) | `calmante` | `clonazepam` | 0,02 kg | raro | 90 x 50 x 15 mm |
| [x] | Carvão ativado (kit) | `carvao_ativado` | `activated_charcoal` | 0,05 kg | incomum | 60 x 95 x 25 mm |
| [x] | Curativo adesivo (caixa) (kit) | `curativo` | `adhesive_bandages` | 0,03 kg | comum | 100 x 60 x 15 mm |
| [x] | Esparadrapo (kit) | `esparadrapo` | `medical_tape` | 0,04 kg | comum | 50 x 25 x 50 mm |
| [x] | Gaze estéril (kit) | `gaze` | `sterile_gauze` | 0,02 kg | comum | 100 x 100 x 15 mm |
| [x] | Iodopovidona (kit) | `pvpi` | `povidone_iodine` | 0,1 kg | incomum | 45 x 110 x 35 mm |
| [x] | Kit de sutura (kit) | `kit_sutura` | `suture_kit` | 0,15 kg | raro | 150 x 80 x 30 mm |
| [x] | Luvas de procedimento (kit) | `luva_proc` | `exam_gloves` | 0,02 kg | comum | 100 x 120 x 10 mm |
| [x] | Máscara N95 (kit) | `n95` | `n95_mask` | 0,02 kg | incomum | 150 x 110 x 25 mm |
| [x] | Polivitamínico (kit) | `vitamina` | `multivitamin` | 0,05 kg | comum | 50 x 90 x 50 mm |
| [x] | Remédio de uso contínuo (kit) | `remedio_continuo` | `maintenance_medication` | 0,05 kg | comum | 45 x 90 x 45 mm |
| [x] | Sais de reidratação (kit) | `sais_reidrat` | `rehydration_salts` | 0,03 kg | comum | 90 x 120 x 10 mm |
| [x] | Seringa descartável (kit) | `seringa` | `syringe` | 0,01 kg | comum | 150 x 20 x 20 mm |
| [x] | Soro antiofídico (kit) | `antiofidico` | `antivenom` | 0,2 kg | muito raro | 150 x 90 x 50 mm |
| [x] | Soro fisiológico com equipo (kit) | `soro` | `saline_iv_bag` | 0,55 kg | raro | 120 x 250 x 45 mm |
| [x] | Tala imobilizadora (kit) | `tala` | `splint` | 0,3 kg | incomum | 460 x 110 x 10 mm |
| [x] | Termômetro (kit) | `termometro` | `thermometer` | 0,02 kg | comum | 120 x 20 x 30 mm |
| [x] | Álcool 70% (500 ml) (kit) | `alcool70` | `alcohol_70` | 0,5 kg | comum | 70 x 200 x 50 mm |

## Ferramentas (30 de 30)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Martelo | `martelo` | `hammer` | 0,6 kg | comum | 159 x 330 x 47 mm |
| [x] | Pé de cabra | `pe_cabra` | `crowbar` | 1,5 kg | incomum | 188 x 750 x 48 mm |
| [x] | Abridor de lata (kit) | `abridor` | `can_opener` | 0,05 kg | comum | 140 x 40 x 25 mm |
| [x] | Alicate (kit) | `alicate` | `pliers` | 0,3 kg | comum | 200 x 30 x 70 mm |
| [x] | Alicate corta-vergalhão (kit) | `corta_vergalhao` | `bolt_cutters` | 3,5 kg | raro | 600 x 60 x 150 mm |
| [x] | Balde (kit) | `balde` | `bucket` | 0,5 kg | comum | 280 x 270 x 280 mm |
| [x] | Binóculo (kit) | `binoculo` | `binoculars` | 0,6 kg | incomum | 180 x 150 x 120 mm |
| [x] | Caixa de fósforos (kit) | `fosforo` | `matches` | 0,02 kg | comum | 50 x 15 x 35 mm |
| [x] | Canivete multifuncional (kit) | `canivete` | `pocket_knife` | 0,15 kg | incomum | 110 x 22 x 32 mm |
| [x] | Chave de fenda (kit) | `chave_fenda` | `screwdriver` | 0,15 kg | comum | 220 x 40 x 40 mm |
| [x] | Chave inglesa (kit) | `chave_inglesa` | `adjustable_wrench` | 0,5 kg | comum | 250 x 20 x 60 mm |
| [x] | Enxada (kit) | `enxada` | `hoe` | 1,8 kg | comum | 1,35 x 0,06 x 0,17 m |
| [x] | Extintor de pó (kit) | `extintor` | `fire_extinguisher` | 4,0 kg | comum | 160 x 480 x 160 mm |
| [x] | Fita silver tape (kit) | `silver_tape` | `duct_tape` | 0,2 kg | comum | 100 x 50 x 100 mm |
| [x] | Fogareiro de camping (kit) | `fogareiro` | `camp_stove` | 0,8 kg | incomum | 180 x 100 x 110 mm |
| [x] | Isqueiro (kit) | `isqueiro` | `lighter` | 0,02 kg | comum | 25 x 80 x 12 mm |
| [x] | Kit de chaveiro (gazuas) (kit) | `kit_chaveiro` | `lockpick_kit` | 0,1 kg | muito raro | 100 x 70 x 20 mm |
| [x] | Kit de costura (kit) | `kit_costura` | `sewing_kit` | 0,05 kg | comum | 90 x 50 x 30 mm |
| [x] | Macaco e chave de roda (kit) | `macaco` | `car_jack` | 4,0 kg | comum | 300 x 110 x 110 mm |
| [x] | Maleta de ferramentas do mecânico (kit) | `kit_mecanico` | `mechanic_toolbox` | 6,0 kg | raro | 400 x 200 x 200 mm |
| [x] | Maçarico a gás (kit) | `macarico` | `gas_torch` | 3,0 kg | raro | 150 x 420 x 150 mm |
| [x] | Máquina de solda inversora (kit) | `solda` | `inverter_welder` | 6,0 kg | raro | 300 x 220 x 130 mm |
| [x] | Panela (kit) | `panela` | `pot` | 1,0 kg | comum | 250 x 150 x 250 mm |
| [x] | Parafusadeira a bateria (kit) | `parafusadeira` | `cordless_drill` | 1,5 kg | incomum | 220 x 200 x 70 mm |
| [x] | Pederneira (kit) | `pederneira` | `flint_striker` | 0,08 kg | raro | 110 x 20 x 15 mm |
| [x] | Pedra de amolar (kit) | `amolador` | `sharpening_stone` | 0,3 kg | incomum | 200 x 50 x 25 mm |
| [x] | Pá (kit) | `pa` | `shovel` | 2,0 kg | comum | 1,1 x 0,07 x 0,22 m |
| [x] | Serra de arco (kit) | `serra_arco` | `hacksaw` | 0,4 kg | incomum | 420 x 30 x 120 mm |
| [x] | Serrote (kit) | `serrote` | `handsaw` | 0,5 kg | comum | 500 x 35 x 130 mm |
| [x] | Tesoura (kit) | `tesoura` | `scissors` | 0,1 kg | comum | 180 x 15 x 70 mm |

## Armas brancas e de disparo silencioso (20 de 20)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Facão | `facao` | `machete` | 0,7 kg | comum | 550 x 85 x 35 mm |
| [x] | Machado | `machado` | `axe` | 1,6 kg | incomum | 250 x 700 x 59 mm |
| [x] | Taco com pregos | `taco_pregos` | `nail_bat` | 1,2 kg | incomum | 223 x 860 x 221 mm |
| [x] | Arco recurvo (kit) | `arco` | `recurve_bow` | 1,2 kg | raro | 1,3 x 0,2 x 0,05 m |
| [x] | Besta (kit) | `besta` | `crossbow` | 3,2 kg | muito raro | 700 x 120 x 800 mm |
| [x] | Cano de ferro (kit) | `cano` | `iron_pipe` | 1,2 kg | comum | 800 x 35 x 35 mm |
| [x] | Cutelo de açougue (kit) | `cutelo` | `meat_cleaver` | 0,6 kg | incomum | 330 x 30 x 120 mm |
| [x] | Estilingue (kit) | `estilingue` | `slingshot` | 0,15 kg | incomum | 130 x 150 x 25 mm |
| [x] | Faca de cozinha (kit) | `faca_cozinha` | `knife` | 0,2 kg | comum | 250 x 30 x 40 mm |
| [x] | Faca tática (kit) | `faca_tatica` | `tactical_knife` | 0,3 kg | raro | 260 x 28 x 45 mm |
| [x] | Flechas e virotes (6) (kit) | `flecha` | `arrows_and_bolts` | 0,3 kg | raro | 700 x 25 x 40 mm |
| [x] | Foice (kit) | `foice` | `sickle` | 1,2 kg | incomum | 400 x 35 x 350 mm |
| [x] | Frigideira de ferro (kit) | `frigideira` | `cast_iron_skillet` | 1,2 kg | comum | 430 x 50 x 250 mm |
| [x] | Lança improvisada (kit) | `lanca` | `improvised_spear` | 1,1 kg | incomum | 1,6 x 0,04 x 0,04 m |
| [x] | Machadinha (kit) | `machadinha` | `hatchet` | 0,8 kg | incomum | 350 x 50 x 130 mm |
| [x] | Marreta (kit) | `marreta` | `sledgehammer` | 5,0 kg | raro | 900 x 120 x 250 mm |
| [x] | Motosserra (kit) | `motosserra` | `chainsaw` | 6,0 kg | muito raro | 450 x 260 x 230 mm |
| [x] | Picareta (kit) | `picareta` | `pickaxe` | 2,8 kg | raro | 900 x 40 x 350 mm |
| [x] | Taco de beisebol (kit) | `taco` | `baseball_bat` | 1,0 kg | incomum | 860 x 70 x 70 mm |
| [x] | Tonfa policial (kit) | `tonfa` | `police_baton` | 0,6 kg | comum | 500 x 100 x 45 mm |

## Materiais de construção e crafting (23 de 23)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Tábua | `tabua` | `wooden_plank` | 2,0 kg | comum | 800 x 249 x 283 mm |
| [x] | Arame (rolo de 10 m) (kit) | `arame` | `wire_roll` | 0,5 kg | comum | 140 x 50 x 140 mm |
| [x] | Arame farpado (rolo de 25 m) (kit) | `arame_farpado` | `barbed_wire` | 4,0 kg | incomum | 300 x 120 x 300 mm |
| [x] | Cacos de vidro (kit) | `cacos` | `glass_shards` | 0,2 kg | comum | 120 x 50 x 100 mm |
| [x] | Chapa de metal (kit) | `chapa` | `sheet_metal` | 6,0 kg | incomum | 600 x 3 x 450 mm |
| [x] | Cimento (saco de 25 kg) (kit) | `cimento` | `cement_bag` | 25,0 kg | incomum | 500 x 100 x 300 mm |
| [x] | Cola epóxi (kit) | `cola` | `epoxy_glue` | 0,1 kg | incomum | 100 x 60 x 30 mm |
| [x] | Componentes eletrônicos (kit) | `componentes` | `electronic_components` | 0,1 kg | incomum | 100 x 20 x 80 mm |
| [x] | Corda (15 m) (kit) | `corda` | `rope` | 1,0 kg | comum | 150 x 80 x 150 mm |
| [x] | Fio de cobre (5 m) (kit) | `fio_cobre` | `copper_wire` | 0,3 kg | comum | 80 x 30 x 80 mm |
| [x] | Garrafa PET vazia (kit) | `garrafa_pet` | `pet_bottle` | 0,05 kg | comum | 105 x 330 x 105 mm |
| [x] | Garrafa de vidro vazia (kit) | `garrafa_vidro` | `glass_bottle` | 0,3 kg | comum | 75 x 260 x 75 mm |
| [x] | Lata vazia (kit) | `lata_vazia` | `empty_can` | 0,05 kg | comum | 66 x 120 x 66 mm |
| [x] | Lenha (kit) | `lenha` | `firewood` | 1,5 kg | comum | 400 x 120 x 160 mm |
| [x] | Lona (4 × 4 m) (kit) | `lona` | `tarp` | 2,0 kg | comum | 350 x 100 x 250 mm |
| [x] | Parafusos (caixa de 50) (kit) | `parafusos` | `screws` | 0,4 kg | comum | 90 x 50 x 50 mm |
| [x] | Pregos (caixa de 100) (kit) | `pregos` | `nails` | 0,5 kg | comum | 130 x 60 x 50 mm |
| [x] | Saco de ráfia (kit) | `saco_areia` | `raffia_sack` | 0,2 kg | comum | 400 x 20 x 300 mm |
| [x] | Sucata de metal (kit) | `sucata` | `scrap_metal` | 1,0 kg | comum | 200 x 80 x 150 mm |
| [x] | Tijolos (10) (kit) | `tijolo` | `bricks` | 25,0 kg | comum | 190 x 180 x 290 mm |
| [x] | Trapo (kit) | `trapo` | `rag` | 0,05 kg | comum | 220 x 25 x 180 mm |
| [x] | Vergalhão (kit) | `vergalhao` | `rebar` | 2,0 kg | comum | 1,27 x 0,02 x 0,02 m |
| [x] | Óleo lubrificante spray (kit) | `lubrificante` | `lubricant_spray` | 0,25 kg | comum | 50 x 170 x 50 mm |

## Roupas e proteção (1 de 23)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Capacete de moto fechado | `capacete_moto` | `motorcycle_helmet` | 1,4 kg | incomum | 260 x 254 x 274 mm |
| [ ] | Bota de borracha | `bota_borracha` | `rubber_boots` | 1,2 kg | comum | 300 x 350 x 220 mm |
| [x] | Braçadeira de revista (kit) | `braco_revista` | `magazine_arm_guard` | 0,4 kg | incomum | 300 x 60 x 150 mm |
| [x] | Calça de motociclista (kit) | `calca_couro` | `leather_motorcycle_pants` | 1,6 kg | raro | 400 x 90 x 300 mm |
| [x] | Calça jeans (kit) | `calca_jeans` | `jeans` | 0,8 kg | comum | 350 x 60 x 220 mm |
| [ ] | Camiseta | `camiseta` | `tshirt` | 0,15 kg | comum | 300 x 40 x 220 mm |
| [ ] | Capa de chuva | `capa_chuva` | `raincoat` | 0,4 kg | comum | 300 x 40 x 250 mm |
| [x] | Capacete de obra (EPI) (kit) | `capacete_obra` | `hard_hat` | 0,4 kg | comum | 250 x 150 x 300 mm |
| [x] | Casaco acolchoado (kit) | `casaco_frio` | `padded_coat` | 1,3 kg | incomum | 450 x 150 x 350 mm |
| [x] | Chinelo de dedo (kit) | `chinelo` | `flip_flops` | 0,2 kg | comum | 290 x 30 x 230 mm |
| [x] | Coletes balísticos (II-A, III-A, III) (kit) | `colete` | `ballistic_vest` | 3,0 kg | raro | 400 x 70 x 450 mm |
| [x] | Coturno (kit) | `coturno` | `combat_boots` | 1,6 kg | incomum | 300 x 200 x 220 mm |
| [x] | Farda camuflada do Exército (kit) | `farda_eb` | `army_camouflage_uniform` | 1,5 kg | comum | 400 x 100 x 320 mm |
| [x] | Jaqueta de motociclista (couro) (kit) | `jaqueta_couro` | `leather_motorcycle_jacket` | 1,8 kg | raro | 450 x 100 x 350 mm |
| [x] | Jaqueta jeans (kit) | `jaqueta_jeans` | `denim_jacket` | 1,0 kg | comum | 400 x 80 x 300 mm |
| [x] | Luvas de couro (raspa) (kit) | `luva_couro` | `leather_work_gloves` | 0,2 kg | comum | 250 x 30 x 120 mm |
| [x] | Macacão de mecânico (kit) | `macacao` | `mechanic_coveralls` | 1,2 kg | comum | 400 x 90 x 300 mm |
| [x] | Moletom (kit) | `moletom` | `hoodie` | 0,6 kg | comum | 380 x 80 x 280 mm |
| [ ] | Protetor de antebraço de chapa | `braco_chapa` | `sheet_metal_forearm_guard` | 1,5 kg | raro | 300 x 100 x 120 mm |
| [x] | Roupa de apicultor (kit) | `apicultor` | `beekeeper_suit` | 1,4 kg | muito raro | 400 x 100 x 330 mm |
| [x] | Roupa de bombeiro (kit) | `bombeiro` | `firefighter_suit` | 4,0 kg | raro | 550 x 200 x 400 mm |
| [ ] | Tênis de corrida | `tenis` | `sneakers` | 0,7 kg | comum | 300 x 120 x 120 mm |
| [ ] | Óculos de proteção | `oculos` | `safety_goggles` | 0,05 kg | comum | 160 x 60 x 80 mm |

## Mochilas e contêineres (1 de 15)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Mochila de trilha 40 L | `mochila_trilha` | `hiking_backpack_40l` | 1,3 kg | incomum | 411 x 550 x 319 mm |
| [x] | Bag de entregador (kit) | `bag_entregador` | `delivery_bag` | 1,2 kg | incomum | 480 x 450 x 420 mm |
| [x] | Bolsa transversal (kit) | `bolsa` | `crossbody_bag` | 0,3 kg | comum | 250 x 200 x 80 mm |
| [x] | Caixa térmica (kit) | `caixa_termica` | `cooler_box` | 1,0 kg | comum | 320 x 250 x 230 mm |
| [ ] | Carrinho de mercado | `carrinho_merc` | `shopping_cart` | 12,0 kg | comum | 550 x 980 x 950 mm |
| [ ] | Carrinho de mão | `carrinho_mao` | `wheelbarrow` | 15,0 kg | comum | 0,65 x 0,65 x 1,5 m |
| [ ] | Cinto de ferramentas | `cinto_ferramentas` | `tool_belt` | 0,4 kg | comum | 350 x 100 x 250 mm |
| [ ] | Colete tático | `colete_tatico` | `tactical_vest` | 1,2 kg | raro | 350 x 100 x 400 mm |
| [ ] | Mala de rodinha | `mala` | `rolling_suitcase` | 3,0 kg | comum | 400 x 650 x 250 mm |
| [ ] | Mochila cargueira 70 L | `cargueira` | `trekking_backpack_70l` | 2,2 kg | muito raro | 380 x 750 x 300 mm |
| [x] | Mochila escolar (kit) | `mochila_escolar` | `backpack` | 0,5 kg | comum | 300 x 300 x 200 mm |
| [x] | Mochila militar (kit) | `mochila_militar` | `military_backpack` | 1,8 kg | raro | 350 x 600 x 300 mm |
| [x] | Pochete (kit) | `pochete` | `fanny_pack` | 0,15 kg | comum | 250 x 100 x 120 mm |
| [ ] | Saco de lixo | `saco_lixo` | `trash_bag` | 0,05 kg | comum | 250 x 25 x 200 mm |
| [ ] | Sacola de mercado | `sacola` | `shopping_bag` | 0,02 kg | comum | 300 x 20 x 200 mm |

## Eletrônicos, rádio e luz (4 de 20)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Lanterna (2 pilhas AA) | `lanterna` | `flashlight` | 0,2 kg | comum | 56 x 160 x 56 mm |
| [x] | Pilhas AA (par) | `pilha_aa` | `batteries` | 0,05 kg | comum | 37 x 51 x 17 mm |
| [x] | Rádio AM/FM a pilha | `radio_portatil` | `portable_radio` | 0,5 kg | comum | 220 x 295 x 70 mm |
| [x] | Walkie-talkie (par) | `walkie` | `walkie_talkies` | 0,6 kg | incomum | 70 x 220 x 33 mm |
| [x] | Bateria 9 V (kit) | `bateria_9v` | `battery_9v` | 0,05 kg | comum | 26 x 49 x 18 mm |
| [x] | Celular (kit) | `celular` | `mobile_phone` | 0,2 kg | comum | 77 x 160 x 9 mm |
| [x] | Controle de alarme de carro (kit) | `controle_alarme` | `car_alarm_remote` | 0,03 kg | comum | 40 x 70 x 12 mm |
| [ ] | Despertador de corda | `despertador` | `windup_alarm_clock` | 0,3 kg | comum | 110 x 125 x 55 mm |
| [x] | Eletrificador de cerca rural (kit) | `eletrificador` | `electric_fence_energizer` | 3,0 kg | raro | 250 x 200 x 150 mm |
| [x] | Extensão elétrica 20 m (kit) | `extensao` | `extension_cord` | 1,5 kg | comum | 230 x 80 x 230 mm |
| [x] | Gerador portátil a gasolina (kit) | `gerador` | `portable_generator` | 25,0 kg | raro | 500 x 420 x 430 mm |
| [x] | Lampião LED de camping (kit) | `lampiao_led` | `led_camp_lantern` | 0,4 kg | incomum | 110 x 200 x 110 mm |
| [x] | Lanterna de cabeça (kit) | `lanterna_cabeca` | `headlamp` | 0,1 kg | incomum | 90 x 60 x 50 mm |
| [x] | Notebook (kit) | `notebook` | `laptop` | 2,0 kg | incomum | 360 x 25 x 250 mm |
| [x] | Painel solar dobrável (kit) | `painel_solar` | `folding_solar_panel` | 1,5 kg | raro | 400 x 300 x 50 mm |
| [x] | Power bank (kit) | `power_bank` | `power_bank` | 0,3 kg | incomum | 150 x 70 x 16 mm |
| [x] | Rádio amador PX (kit) | `radio_px` | `cb_radio` | 3,0 kg | raro | 250 x 80 x 200 mm |
| [x] | Rádio militar de longo alcance (kit) | `radio_militar` | `military_radio` | 6,0 kg | lendário | 300 x 200 x 250 mm |
| [x] | Vela (kit) | `vela` | `candles` | 0,05 kg | comum | 60 x 120 x 60 mm |
| [x] | Óculos de visão noturna (kit) | `nvg` | `night_vision_goggles` | 0,6 kg | muito raro | 150 x 100 x 110 mm |

## Combustível e energia (2 de 9)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Botijão de gás P13 | `botijao` | `lpg_cylinder_13kg` | 29,0 kg | comum | 353 x 490 x 358 mm |
| [x] | Galão de combustível 20 L | `galao` | `fuel_jerrycan` | 1,2 kg | incomum | 308 x 470 x 154 mm |
| [x] | Bateria 12 V (kit) | `bateria_12v` | `car_battery_12v` | 14,0 kg | incomum | 240 x 190 x 175 mm |
| [x] | Cartucho de gás (kit) | `cartucho_gas` | `gas_cartridge` | 0,35 kg | incomum | 110 x 165 x 110 mm |
| [x] | Carvão (saco de 3 kg) (kit) | `carvao` | `charcoal_bag` | 3,0 kg | comum | 300 x 120 x 400 mm |
| [x] | Diesel (litro) (kit) | `diesel` | `diesel` | 0,85 kg | incomum | 90 x 260 x 90 mm |
| [x] | Gasolina (litro) (kit) | `gasolina` | `gasoline` | 0,75 kg | incomum | 90 x 260 x 90 mm |
| [x] | Querosene (1 L) (kit) | `querosene` | `kerosene` | 0,8 kg | incomum | 90 x 260 x 90 mm |
| [x] | Óleo de motor (kit) | `oleo_motor` | `motor_oil` | 1,0 kg | comum | 100 x 260 x 70 mm |

## Campo, pesca e caça (0 de 11)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Adubo (saco de 10 kg) (kit) | `adubo` | `fertilizer_bag` | 10,0 kg | raro | 450 x 130 x 300 mm |
| [ ] | Armadilha de laço | `armadilha_laco` | `snare_trap` | 0,3 kg | comum | 150 x 30 x 150 mm |
| [x] | Caixa de pesca (anzol, linha, isca) (kit) | `kit_pesca` | `fishing_tackle_box` | 0,6 kg | comum | 300 x 100 x 180 mm |
| [x] | Rama de mandioca (maniva) (kit) | `maniva` | `cassava_cuttings` | 2,0 kg | incomum | 700 x 120 x 120 mm |
| [x] | Rede de pesca (kit) | `rede_pesca` | `fishing_net` | 3,0 kg | incomum | 350 x 150 x 300 mm |
| [ ] | Regador | `regador` | `watering_can` | 0,5 kg | comum | 400 x 260 x 180 mm |
| [ ] | Sementes de abóbora | `sem_abobora` | `pumpkin_seeds` | 0,05 kg | incomum | 90 x 130 x 15 mm |
| [x] | Sementes de couve e alface (kit) | `sem_couve` | `kale_and_lettuce_seeds` | 0,05 kg | incomum | 90 x 130 x 15 mm |
| [x] | Sementes de feijão (kit) | `sem_feijao` | `bean_seeds` | 0,1 kg | incomum | 100 x 150 x 20 mm |
| [x] | Sementes de milho (kit) | `sem_milho` | `corn_seeds` | 0,1 kg | incomum | 100 x 150 x 20 mm |
| [x] | Vara de pesca (kit) | `vara_pesca` | `fishing_rod` | 1,0 kg | comum | 1,8 x 0,04 x 0,04 m |

## Livros e revistas (0 de 5)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Almanaque do agricultor (kit) | `almanaque` | `farmers_almanac` | 0,3 kg | incomum | 150 x 210 x 15 mm |
| [ ] | Livro de habilidade (volumes 1 a 5) | `livro_hab` | `skill_book` | 0,6 kg | incomum | 160 x 230 x 40 mm |
| [ ] | Manual técnico | `livro_tecnico` | `technical_manual` | 0,8 kg | raro | 210 x 300 x 40 mm |
| [x] | Revista Faça Você Mesmo (kit) | `revista_receita` | `diy_magazine` | 0,2 kg | incomum | 210 x 280 x 8 mm |
| [x] | Revista e gibi (kit) | `revista_passa` | `magazines_and_comics` | 0,2 kg | comum | 170 x 260 x 10 mm |

## História e colecionáveis (1 de 16)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Diário de sobrevivente | `diario` | `survivor_diary` | 0,3 kg | único | 162 x 210 x 55 mm |
| [x] | Bilhete e carta (kit) | `bilhete` | `note` | 0,01 kg | comum | 150 x 2 x 100 mm |
| [ ] | Cartão-postal do Vale (19) | `postal` | `valley_postcard` | 0,01 kg | único | do jogo |
| [ ] | Fichas da penitenciária | `fichas_presos` | `prisoner_files` | 0,2 kg | único | do jogo |
| [ ] | Fita da Rádio Vale FM (12) | `fita_radio` | `radio_tape` | 0,05 kg | único | do jogo |
| [x] | Fotografia (kit) | `foto` | `photo` | 0,01 kg | comum | 102 x 2 x 152 mm |
| [ ] | Item marcado de NPC (31) | `item_marcado` | `npc_marked_item` | 0,2 kg | único | do jogo |
| [ ] | Livro de registro da Mina São Jorge | `registro_mina` | `mine_logbook` | 0,4 kg | único | do jogo |
| [x] | Mapa da cidade anotado (kit) | `mapa_cidade` | `city_map` | 0,05 kg | raro | 110 x 10 x 250 mm |
| [ ] | Mapa militar | `mapa_militar` | `military_map` | 0,05 kg | muito raro | do jogo |
| [ ] | Mapa rodoviário | `mapa_rodoviario` | `road_map` | 0,05 kg | comum | 110 x 10 x 250 mm |
| [x] | Maço de cigarro (kit) | `cigarro` | `cigarettes` | 0,03 kg | comum | 55 x 88 x 22 mm |
| [x] | Maço de dinheiro (kit) | `dinheiro` | `cash` | 0,05 kg | comum | 155 x 10 x 65 mm |
| [ ] | Ordem de evacuação do 7º BIS | `ordem_evac` | `evacuation_order` | 0,05 kg | único | do jogo |
| [x] | Plaqueta de identificação militar (kit) | `plaqueta` | `dog_tag` | 0,01 kg | comum | 30 x 3 x 50 mm |
| [ ] | Prontuário do paciente zero | `prontuario` | `patient_zero_record` | 0,1 kg | único | do jogo |

## Chaves e acesso (1 de 11)

| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |
|---|---|---|---|---|---|---|
| [x] | Chave de casa | `chave_casa` | `house_key` | 0,02 kg | comum | 85 x 46 x 4 mm |
| [x] | Cadeado com chave (kit) | `cadeado_chave` | `padlock_key` | 0,3 kg | comum | 50 x 80 x 25 mm |
| [x] | Chave de carro (kit) | `chave_carro` | `car_key` | 0,02 kg | comum | 60 x 45 x 15 mm |
| [x] | Chave de cela (kit) | `chave_cela` | `cell_key` | 0,05 kg | raro | 120 x 30 x 8 mm |
| [ ] | Chave do cofre da delegacia | `chave_cofre` | `safe_key` | 0,05 kg | único | 70 x 25 x 5 mm |
| [x] | Chave do gerador do hospital (kit) | `chave_gerador` | `generator_key` | 0,05 kg | único | 80 x 30 x 6 mm |
| [ ] | Chave do teleférico | `chave_teleferico` | `cable_car_key` | 0,05 kg | único | do jogo |
| [x] | Chave mestra da portaria (kit) | `chave_mestra` | `master_key` | 0,05 kg | incomum | 90 x 35 x 6 mm |
| [ ] | Crachá da hidrelétrica | `cracha_rep` | `dam_badge` | 0,01 kg | único | do jogo |
| [ ] | Código do bunker (3 pedaços) | `codigo_bunker` | `bunker_code` | 0,01 kg | único | do jogo |
| [x] | Molho de chaves do zelador (kit) | `molho_zelador` | `janitor_keys` | 0,15 kg | incomum | 120 x 100 x 20 mm |
