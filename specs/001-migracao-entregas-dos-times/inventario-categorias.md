# Inventário de categorias dos itens (kinds)

Relatório da migração de `packages/game-items-goods` para o motor de categorias (`defineCategories`/`checkCategorized` de `game-contracts`). Gerado a partir de `items.json`, `kinds.json` e `known-gaps.json`; confira com `pnpm check:items`.

## Resumo

- Itens: 327, todos com `kind` concreto (a árvore tem 41 kinds, 8 abstratos).
- Itens com campo estimado: 177; campos estimados no total: 222.
- Lacunas conhecidas (`known-gaps.json`): 7 em 7 itens.
- `estimated` significa "estimado do mundo real, os times podem ajustar". `nonPerishable: true` é a forma explícita de "nunca estraga" (não foi usado `shelfLife: null` porque o `game-items` trata `null` como validade inválida).
- Pesos e tamanhos corrigidos (densidade abaixo de 0,02 kg/L, ou seja, mais leve que o ar da caixa): ver a seção "Densidades corrigidas".

## Itens por kind

| kind | caminho | itens |
|---|---|---|
| `food_ready` | item > consumable > food_ready | 17 |
| `canned_food` | item > consumable > food_ready > canned_food | 6 |
| `food_improves_cooked` | item > consumable > food_improves_cooked | 7 |
| `food_needs_prep` | item > consumable > food_needs_prep | 13 |
| `ingredient` | item > consumable > ingredient | 9 |
| `drink_ready` | item > consumable > drink_ready | 9 |
| `canned_drink` | item > consumable > drink_ready > canned_drink | 2 |
| `drink_untreated` | item > consumable > drink_untreated | 1 |
| `medicine` | item > consumable > medicine | 16 |
| `first_aid` | item > consumable > medicine > first_aid | 10 |
| `metal_can` | item > container > packaging > metal_can | 3 |
| `glass_bottle` | item > container > packaging > glass_bottle | 1 |
| `plastic_bottle` | item > container > packaging > plastic_bottle | 2 |
| `jar` | item > container > packaging > jar | 1 |
| `cookware` | item > container > cookware | 2 |
| `tableware` | item > container > tableware | 4 |
| `tank` | item > container > tank | 3 |
| `melee` | item > weapon > melee | 16 |
| `ranged` | item > weapon > ranged | 3 |
| `firearm` | item > weapon > firearm | 0 |
| `ammo` | item > weapon > ammo | 1 |
| `throwable` | item > weapon > throwable | 0 |
| `clothing` | item > wearable > clothing | 30 |
| `bag` | item > wearable > bag | 15 |
| `tool` | item > equipment > tool | 40 |
| `electronics` | item > equipment > electronics | 22 |
| `fuel` | item > equipment > fuel | 7 |
| `camping` | item > equipment > camping | 9 |
| `material` | item > material_misc > material | 41 |
| `book` | item > material_misc > book | 6 |
| `key` | item > material_misc > key | 9 |
| `collectible` | item > material_misc > collectible | 15 |
| `hygiene` | item > material_misc > hygiene | 7 |

Kinds sem itens hoje (`firearm`, `throwable`) existem para os itens do arsenal (`GOODS_ARSENAL_RECORDS`), que entram no catálogo por `itemsFromArsenal`.

## Campos estimados por kind

Contagem por campo: `caliber` 1, `charge` 20, `container` 3, `cookable` 3, `fluid` 19, `impact` 8, `leftover` 4, `nonPerishable` 8, `nutrition` 15, `parts` 114, `protection` 7, `shelfLife` 15, `weight` 5.

### `food_ready` (6 de 17 itens)

- `honey_jar`: nonPerishable
- `cereal_box`: nutrition, shelfLife
- `yogurt`: nutrition, shelfLife
- `apple`: nutrition, shelfLife
- `tomato`: nutrition, shelfLife
- `ice_cream`: nutrition, shelfLife

### `canned_food` (1 de 6 itens)

- `canned_food`: nutrition, shelfLife

### `food_improves_cooked` (3 de 7 itens)

- `ham`: nutrition, shelfLife
- `frozen_pizza`: nutrition, shelfLife
- `sandwich`: nutrition, shelfLife

### `food_needs_prep` (3 de 13 itens)

- `instant_noodles`: cookable
- `frozen_meat`: nutrition, shelfLife, cookable
- `frozen_vegetables`: nutrition, shelfLife, cookable

### `ingredient` (6 de 9 itens)

- `sugar`: nonPerishable
- `salt`: nonPerishable
- `flour`: nutrition, shelfLife
- `butter`: nutrition, shelfLife
- `ketchup`: nutrition, shelfLife
- `seasoning`: nutrition, shelfLife

### `drink_ready` (9 de 9 itens)

- `water_bottle`: nonPerishable, fluid
- `water_jug_5l`: nonPerishable, fluid
- `juice_box`: fluid, parts, impact, leftover
- `milk_carton`: fluid, parts, impact, leftover
- `sports_drink`: fluid
- `energy_drink`: fluid
- `coconut_water`: fluid
- `cachaca`: nonPerishable, fluid, parts, impact, leftover
- `communion_wine`: nonPerishable, fluid, parts, impact, leftover

### `canned_drink` (2 de 2 itens)

- `soda_can`: fluid
- `beer_can`: fluid

### `drink_untreated` (1 de 1 itens)

- `dirty_water`: nonPerishable, fluid

### `medicine` (4 de 16 itens)

- `alcohol_70`: parts
- `povidone_iodine`: parts
- `saline_iv_bag`: parts
- `insulin`: parts

### `first_aid` (5 de 10 itens)

- `syringe`: parts
- `splint`: parts
- `first_aid_kit`: parts
- `exam_gloves`: parts
- `n95_mask`: parts

### `plastic_bottle` (1 de 2 itens)

- `pet_bottle`: weight

### `cookware` (1 de 2 itens)

- `pot`: parts

### `tableware` (1 de 4 itens)

- `wine_glass`: parts

### `tank` (3 de 3 itens)

- `bucket`: container
- `watering_can`: container
- `barrel`: container

### `melee` (5 de 16 itens)

- `baseball_bat`: parts, impact
- `nail_bat`: parts, impact
- `police_baton`: parts
- `cast_iron_skillet`: parts
- `improvised_spear`: parts, impact

### `ammo` (1 de 1 itens)

- `arrows_and_bolts`: caliber, parts

### `clothing` (19 de 30 itens)

- `leather_motorcycle_jacket`: parts
- `leather_motorcycle_pants`: parts
- `motorcycle_helmet`: parts
- `hard_hat`: parts
- `safety_goggles`: parts
- `leather_work_gloves`: parts
- `combat_boots`: parts
- `rubber_boots`: parts
- `sneakers`: parts
- `flip_flops`: parts
- `magazine_arm_guard`: parts
- `sheet_metal_forearm_guard`: parts, impact
- `jacket`: protection
- `socks`: protection
- `underwear`: protection
- `hat`: protection
- `scarf`: protection
- `rubber_gloves`: protection, parts
- `eyeglasses`: protection, parts

### `bag` (9 de 15 itens)

- `shopping_bag`: weight
- `trash_bag`: parts
- `delivery_bag`: weight
- `hiking_backpack_40l`: weight
- `rolling_suitcase`: parts
- `tool_belt`: parts
- `cooler_box`: parts
- `shopping_cart`: parts
- `wheelbarrow`: parts

### `tool` (18 de 40 itens)

- `thermometer`: parts
- `duct_tape`: parts
- `sewing_kit`: parts
- `lighter`: parts
- `matches`: parts
- `binoculars`: parts
- `sharpening_stone`: parts
- `extension_cord`: parts
- `fishing_rod`: parts
- `fishing_tackle_box`: parts
- `fishing_net`: parts
- `pen`: parts
- `broomstick`: parts
- `stapler`: parts
- `cable_bundle`: parts
- `broom`: parts
- `clothespins`: parts
- `electrical_tape`: parts

### `electronics` (20 de 22 itens)

- `cordless_drill`: charge
- `flashlight`: charge
- `headlamp`: charge
- `power_bank`: charge
- `folding_solar_panel`: charge
- `portable_radio`: charge
- `walkie_talkies`: charge
- `cb_radio`: charge
- `military_radio`: charge
- `portable_generator`: charge, parts
- `led_camp_lantern`: charge
- `mobile_phone`: charge
- `laptop`: charge
- `windup_alarm_clock`: charge
- `car_alarm_remote`: charge
- `electric_fence_energizer`: charge
- `night_vision_goggles`: charge
- `car_battery_12v`: charge
- `phone_charger`: charge
- `remote_control`: charge

### `fuel` (7 de 7 itens)

- `fuel_jerrycan`: fluid
- `gasoline`: fluid
- `diesel`: fluid
- `lpg_cylinder_13kg`: fluid, parts
- `gas_cartridge`: fluid, parts
- `kerosene`: fluid
- `motor_oil`: fluid

### `camping` (7 de 9 itens)

- `camp_stove`: parts
- `candles`: parts
- `charcoal_bag`: parts
- `tongs`: parts
- `skewers`: parts
- `firelighter`: parts
- `ice_pack`: parts

### `material` (37 de 41 itens)

- `nails`: parts
- `screws`: parts
- `sheet_metal`: parts
- `scrap_metal`: parts
- `wire_roll`: parts
- `barbed_wire`: parts
- `rope`: parts
- `tarp`: parts
- `raffia_sack`: parts
- `bricks`: parts
- `cement_bag`: parts
- `rag`: parts
- `glass_shards`: parts
- `epoxy_glue`: parts
- `electronic_components`: parts
- `copper_wire`: parts
- `rebar`: parts
- `lubricant_spray`: parts
- `bean_seeds`: parts
- `corn_seeds`: parts
- `pumpkin_seeds`: parts
- `kale_and_lettuce_seeds`: parts
- `cassava_cuttings`: parts
- `fertilizer_bag`: parts
- `detergent`: parts
- `bleach`: parts
- `sponge`: parts
- `crumpled_paper`: parts
- `food_scraps`: parts
- `plastic_bag`: parts, weight
- `feather`: parts
- `bread_mold`: parts
- `disinfectant`: parts
- `laundry_powder`: parts
- `fabric_softener`: parts
- `full_trash_bag`: parts
- `food_packaging`: parts

### `key` (1 de 9 itens)

- `access_badge`: parts

### `collectible` (3 de 15 itens)

- `dog_tag`: parts
- `wallet`: parts
- `dvd`: parts

### `hygiene` (4 de 7 itens)

- `soap`: parts
- `deodorant`: parts
- `toilet_paper`: parts
- `towel`: parts

## Lacunas conhecidas

Itens que o kind exige algo que ainda não existe e que não dá para inventar com sentido. O teste falha se uma lacuna deixar de valer (a lista só encolhe) e não aceita item novo.

- `cassava_flour` (`ingredient`): is not an input of any recipe
- `coffee` (`ingredient`): is not an input of any recipe
- `flour` (`ingredient`): is not an input of any recipe
- `butter` (`ingredient`): is not an input of any recipe
- `ketchup` (`ingredient`): is not an input of any recipe
- `seasoning` (`ingredient`): is not an input of any recipe
- `slingshot` (`ranged`): missing weapon

Causas: ingredientes (`flour`, `cassava_flour`, `seasoning`, `butter`, `ketchup`, `coffee`) não entram em nenhuma das 33 receitas do time, e o `slingshot` não tem arma no arsenal. Resolver é dos times (receita nova, arma nova).

## Densidades corrigidas

O contrato `physical` recusa densidade fora de 0,02 a 22 kg/L (peso dividido pelo volume da caixa do item). Sete itens estavam fora:

| item | antes | depois | como |
|---|---|---|---|
| `pet_bottle` | 0,05 kg, 0,0137 kg/L | 0,08 kg, 0,022 kg/L | garrafa PET retornável de 2 L (70 a 100 g); o tamanho fica porque o modelo 3D foi desenhado nele |
| `shopping_bag` | 0,02 kg | 0,1 kg | sacola reutilizável tecida, dobrada |
| `delivery_bag` | 1,2 kg | 2 kg | mochila térmica de entrega de 90 L |
| `hiking_backpack_40l` | 1,3 kg | 1,8 kg | mochila de trilha de 40 L reforçada; o tamanho vem da escala do modelo do time |
| `crumpled_paper` | 0,02 kg, 0,1 x 0,1 x 0,1 m | 0,02 kg, 0,07 x 0,07 x 0,07 m | bola de quatro folhas A4 |
| `plastic_bag` | 0,02 kg, 0,2 x 0,2 x 0,1 m | 0,01 kg, 0,1 x 0,08 x 0,05 m | sacola de mercado amassada |
| `food_packaging` | 0,05 kg, 0,2 x 0,2 x 0,1 m | 0,05 kg, 0,15 x 0,12 x 0,08 m | embalagens vazias amassadas |

Pesos mudam em `tools/items-catalog/kinds-overlay.json` (campo `weight`, marcado `estimated`); tamanhos em `tools/items-catalog/decisions.json` (`dimensions`).

## Decisões que fogem do desenho aprovado

- Os itens do tipo "lata" são `canned_food` (filho de `food_ready`) e `canned_drink` (filho de `drink_ready`); o comportamento da lata (partes de aço fino, amassa sem soltar cacos, abrir e deixar `empty_can`) está em `canned_food` e `metal_can` (a lata vazia). Um kind tem um só pai, então os números de `canned_food` repetem os de `metal_can`; ajustar a lata de comida e a vazia são dois ajustes.
- Parte de `parts` usa `thickness` (como `PartSpec` da destruição), não `wallThickness`; não existe material `tinplate`, a lata é `steel` com 0,0002 m.
- `rawEffect` é `{ sickChance: 0..1 }`; o kind dá o padrão (0 para comida pronta, 0,5 para a que pede preparo, 0,4 para água suja).
- `shelfLife: null` não é usado: `nonPerishable: true` diz que nunca estraga.
- Kinds acrescentados à árvore aprovada: `ranged` (arco, besta, estilingue), `tableware` (louça), `first_aid` (filho de `medicine`) e `canned_drink` (filho de `drink_ready`).
- Reclassificados por não fazerem sentido no kind da categoria antiga: `towel` (clothing) vai para `hygiene`; `blanket`, `pillow`, `candles`, `charcoal_bag` para `camping`; `car_battery_12v` (fuel) para `electronics`; `extension_cord`, `cable_bundle` (electronics) para `tool`; `watering_can` (outdoors) para `tank`; `thermometer` (medical) para `tool`. Por isso há 7 roupas (e não 10) com `protection` estimada, 20 aparelhos com `charge` estimada e 7 combustíveis (e não 9) com `fluid`.
- `category` ficou como estava (as sorteios de loot leem); o teste confere que ela está em `lootCategory` do kind, que pode listar mais de uma categoria antiga.
- `items.json` continua gerado: o que a migração acrescenta fica em `tools/items-catalog/kinds-overlay.json` (escrito por `packages/game-items-goods/scripts/migrate-kinds.mjs`), que o gerador mescla em cada item; `catalog:check` reproduz o arquivo.
