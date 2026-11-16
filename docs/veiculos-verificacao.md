# Verificação dos veículos

Resultado do teste `packages/game-vehicles-fleet/tests/vehicle-acceptance.test.ts`, que roda na frota inteira (69 modelos), e do teste no jogo real. Regras em `CLAUDE.md` §7.

O teste automático cobre: tiro na direção de cada vidro chega no vidro; o ar acima do veículo não recebe tiro; tiro no meio de cada porta acerta a porta; o furo fica na porta e gira com ela; para-brisa e vidro traseiro ficam encostados na carroceria; a porta abre para fora do corpo. **Ele não substitui os 21 critérios** de `criterios-fisica-objetos.md`.

## Modelos com pendência

| Modelo | O que falta olhar |
|---|---|
| `beetle` | o capô fica 8 mm acima do paralama |
| `apc_6x6` | o teste do capô mediu 561 mm: provável falso positivo, sem paralama ao lado |
| `armored_truck` | pane rear_viewport: the shots land on body_rear |
| `battle_tank` | pane commander_periscope: the shots land on turret |
| `police_helicopter` | a zona `taillight_right` mede 5 m ao longo do eixo errado e cobre a luz anticolisão do centro: tiro na lanterna direita deixa o brilho dela (teste `lamp-glow.test.ts`, `KNOWN_OPEN`) |
| `fastback_sedan` | pane windshield: the roof stands past it; pane windshield: the shots land on roof |
| `fishing_boat` | pane deckhouse_forward_windows: the shots land on deck |
| `midsize_suv` | pane quarter_glass: the shots land on roof |
| `single_engine_plane` | pane left_door_window: the fuel_tanks stands past it; pane left_door_window: the shots land on fuel_tanks; pane left_rear_window: the shots land on fuel_tanks; pane right_door_window: the fuel_tanks stands past it; pane  |

## Lanternas e pneu depois do tiro (frota inteira)

`lamp-glow.test.ts` e `flat-tyre.test.ts` rodam em todos os modelos de `fleetVehicleIds` (tiro de fuzil apaga o brilho dentro da caixa de cada lanterna quebrada; tiro de fuzil fura o pneu e nunca o arranca nos modelos com pneu; pistola, fogo e explosão sobre o pneu são testados só no `midsize_sedan`). Única exceção conhecida: `police_helicopter` (tabela acima); modelos sem peça de lanterna ficam em `NO_LAMPS`.

**Pendência:** depois de quebrar todas as peças de lanterna, continuam acesas peças que não têm peça de dano própria e ficam fora das caixas das lanternas: sinaleiras laterais, repetidores, o pisca do retrovisor e o farol de neblina do para-choque em vários carros, as sinaleiras de moto e ônibus, e os indicadores do painel (esses últimos são do painel, não de lanterna). Medido em 2026-11-16 com todas as lanternas quebradas: `compact_hatch` 10 meshes acesos, `scooter` 18, `quad_bike` 19, `armored_truck` 20, `school_bus` 12, `city_bus` 12. Correção: dar peça de dano a cada uma dessas luzes (ou casar por tipo de lâmpada em vez de por caixa).

## Porta aberta: nada atravessando o vão nem pendurado na porta

Corrigido em 2026-11-04 (prints do dono `bugs-1104/03` e `04`: barra na altura da janela atravessando o vão, haste vertical e placa solta embaixo da porta).
O teste da frota agora **reprova**, porta por porta, em toda a frota:

- **faixa atravessando o vão** (vinco, friso, moldura, pintura da carroceria) com a porta aberta. A faixa é cortada nas duas bordas da porta, um plano por
  corte: a faixa desenhada com poucos triângulos longos atravessava a porta inteira num só triângulo, e o corte pelo canto de dois planos errava a borda
  (o friso cromado do `midsize_sedan` ficava inteiro sobre a porta de trás). O forro do vão (`doorEdges`) não passa mais por cima da porta: o vão continua
  até o teto, e a faixa ali era uma barra na altura da janela;
- **peça da carroceria pendurada embaixo da porta**: o corte da zona da porta pegava a caixa de roda e o assoalho atrás da porta de trás (a "placa solta").
  A porta leva a pele e o que está a até 9 cm dela; o que fica mais fundo e olha para baixo ou ao longo do carro volta para a carroceria, no lugar;
- **friso de fechamento (a linha preta entre as portas) indo com a porta**: era a "haste vertical". Fica na carroceria e some enquanto uma das portas
  que ele marca está aberta.

## Vidro embaçado por dentro

Desde 2026-11-05: `createWindshieldMist` (`game-vehicles-three`) põe uma película clara em cada vidro do `context.glass`, **filha do próprio vidro** (desce com a
janela, vai com a porta) e na geometria dele. A película não tem `raycast`: tiro, golpe e a mira passam para o vidro de baixo, e o vidro continua respondendo
como vidro. Ela não escreve profundidade e sai no `dispose` com o material dela; a geometria é do vidro e fica. Vidro quebrado leva a película junto.

## Modelos que passam no teste automático (62)

`adventure_bike`, `ambulance`, `amphibian_turboprop`, `apc_6x6`, `armored_car_6x6`, `attack_helicopter`, `beetle`, `bicycle`, `box_truck`, `boxy_hatch`, `cargo_van`, `city_bus`, `classic_six_sedan`, `commuter_motorcycle`, `compact_hatch`, `compact_pickup`, `compact_suv`, `crop_duster`, `crossover_pickup`, `cruiser`, `delivery_bike`, `electric_hatch`, `entry_hatch`, `family_hatch`, `highway_police_bike`, `highway_police_sedan`, `hybrid_suv`, `jet_ski`, `large_suv`, `light_4x4`, `light_attack_turboprop`, `light_jet`, `midsize_pickup`, `midsize_sedan`, `monster_truck`, `naked_bike`, `patrol_boat`, `piston_helicopter`, `police_helicopter`, `police_sedan`, `quad_bike`, `regional_turboprop`, `rescue_dinghy`, `rescue_helicopter`, `rideshare_hatch`, `river_skiff`, `sailboat`, `school_bus`, `scooter`, `speedboat`, `sport_bike`, `step_through_scooter`, `tandem_trainer`, `tanker_truck`, `taxi`, `trail_bike`, `trainer_helicopter`, `transport_helicopter`, `troop_truck`, `turbine_helicopter`, `turbo_hatch`, `v8_coupe`

Só o `midsize_sedan` foi visto no jogo real até agora (sala de testes, `?scene=doors`).

## `midsize_sedan` nos 21 critérios

| # | Critério | Situação |
|---|---|---|
| 1 | Material e massa | Parcial: peças com material; porta com 8 a 12 kg, leve para uma porta real |
| 2 | Tiro | Testado no jogo: ponto, peça e calibre certos; impulso no carro não verificado |
| 5 | Destruição no padrão da latinha | Parcial: furo e trinca no ponto; deformação e vazamento não revistos |
| 7 | Usar (abrir porta) | Testado no jogo: porta com borda, soleira, vidro, borracha e espelho; a base preta do espelho ainda fica no corpo |
| 18 | Desgaste visual | Furo fica e acompanha a porta |
| 3, 4, 6, 8 a 17, 19 a 21 | Demais critérios | Não verificados nesta rodada |
