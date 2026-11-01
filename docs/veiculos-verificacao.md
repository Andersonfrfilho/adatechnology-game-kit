# Verificação dos veículos

Resultado do teste `packages/game-vehicles-fleet/tests/vehicle-acceptance.test.ts`, que roda na frota inteira (69 modelos), e do teste no jogo real. Regras em `CLAUDE.md` §7.

O teste automático cobre: tiro na direção de cada vidro chega no vidro; o ar acima do veículo não recebe tiro; tiro no meio de cada porta acerta a porta; o furo fica na porta e gira com ela; a porta abre para fora do corpo. **Ele não substitui os 21 critérios** de `criterios-fisica-objetos.md`.

## Modelos com pendência

| Modelo | O que falta olhar |
|---|---|
| `battle_tank` | pane commander_periscope: the shots land on turret |
| `fishing_boat` | pane deckhouse_forward_windows: the shots land on deck; pane port_aft_window: the shots land on deck; pane port_forward_window: the shots land on deck; pane starboard_aft_window: the shots land on deck, side_right; pane  |
| `midsize_suv` | pane quarter_glass: the shots land on roof |
| `patrol_boat` | pane wheelhouse_windshield: the shots land on deck |
| `single_engine_plane` | pane left_door_window: the shots land on fuel_tanks; pane left_rear_window: the shots land on fuel_tanks; pane right_door_window: the shots land on fuel_tanks; pane right_rear_window: the shots land on fuel_tanks |
| `turbine_helicopter` | pane chin_windows: the shots land on nose |

## Modelos que passam no teste automático (63)

`adventure_bike`, `ambulance`, `amphibian_turboprop`, `apc_6x6`, `armored_car_6x6`, `armored_truck`, `attack_helicopter`, `beetle`, `bicycle`, `box_truck`, `boxy_hatch`, `cargo_van`, `city_bus`, `classic_six_sedan`, `commuter_motorcycle`, `compact_hatch`, `compact_pickup`, `compact_suv`, `crop_duster`, `crossover_pickup`, `cruiser`, `delivery_bike`, `electric_hatch`, `entry_hatch`, `family_hatch`, `fastback_sedan`, `highway_police_bike`, `highway_police_sedan`, `hybrid_suv`, `jet_ski`, `large_suv`, `light_4x4`, `light_attack_turboprop`, `light_jet`, `midsize_pickup`, `midsize_sedan`, `monster_truck`, `naked_bike`, `piston_helicopter`, `police_helicopter`, `police_sedan`, `quad_bike`, `regional_turboprop`, `rescue_dinghy`, `rescue_helicopter`, `rideshare_hatch`, `river_skiff`, `sailboat`, `school_bus`, `scooter`, `speedboat`, `sport_bike`, `step_through_scooter`, `tandem_trainer`, `tanker_truck`, `taxi`, `tractor`, `trail_bike`, `trainer_helicopter`, `transport_helicopter`, `troop_truck`, `turbo_hatch`, `v8_coupe`

Só o `midsize_sedan` foi visto no jogo real até agora (sala de testes, `?scene=doors`).

## `midsize_sedan` nos 21 critérios

| # | Critério | Situação |
|---|---|---|
| 1 | Material e massa | Parcial: peças com material; porta com 8 a 12 kg, leve para uma porta real |
| 2 | Tiro | Testado no jogo: ponto, peça e calibre certos; impulso no carro não verificado |
| 5 | Destruição no padrão da latinha | Parcial: furo e trinca no ponto; deformação e vazamento não revistos |
| 7 | Usar (abrir porta) | Testado no jogo, com a borda da porta ainda em degraus |
| 18 | Desgaste visual | Furo fica e acompanha a porta |
| 3, 4, 6, 8 a 17, 19 a 21 | Demais critérios | Não verificados nesta rodada |
