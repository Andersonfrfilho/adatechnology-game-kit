# Evidência — Spec 012 (Altura real do personagem e quem cabe no veículo)

Worktree: `../adatechnology-game-kit-wt/spec-012` · Branch: `spec/012-altura-real` (base `origin/main` `e9b959906`).

## Registro de tasks

| Task | Commit | Comandos e códigos de saída | Números medidos / Prints |
|---|---|---|---|
| T0.1 | _(a preencher após commit)_ | `pnpm --filter @adatechnology/game-characters-three... --filter @adatechnology/game-vehicles-fleet... --filter @adatechnology/game-vehicles-three... build` (exit 0); `node tools/measure-body-and-cabin.mjs` (exit 0); `pnpm check:layers` (exit 0); `node tools/kit-audit/audit.mjs` (exit 0); `pnpm lint` (exit 0) | Ver tabelas abaixo (14 tipos Bestiário, 10 casos Sobreviventes, 6 casos Instanciado, 13 Assados, 69 veículos da frota). Sem prints (task de medição em Node). |

---

## Medições T0.1 — Baseline atual (sobre `dist`)

Gerado por `node tools/measure-body-and-cabin.mjs`.

### 1. Personagens — Corpo rico (Bestiário v17, pose neutra, `seed: 4242`)

| Tipo | Fator `s` | Topo do crânio (m) | Topo total c/ cabelo (m) | Base `minY` (m) | Obs |
|---|---:|---:|---:|---:|---|
| `Lento` | 1.00 | 1.979 | 2.062 | -0.003 | |
| `Corredor` | 0.97 | 1.920 | 2.000 | -0.002 | |
| `Brutamonte` | 1.42 | 2.805 | 3.018 | -0.004 | |
| `Rastejante` | 1.00 | 1.979 | 2.062 | 0.395 | sem pernas |
| `Gritador` | 1.00 | 1.979 | 2.062 | -0.003 | |
| `Inchado` | 1.03 | 2.038 | 2.124 | -0.003 | |
| `Espreitador` | 1.00 | 1.979 | 2.062 | -0.003 | |
| `Farejador` | 1.00 | 1.979 | 2.062 | -0.003 | |
| `Saltador` | 1.00 | 1.979 | 2.062 | -0.003 | |
| `Cego` | 1.00 | 1.979 | 2.062 | -0.003 | |
| `Afogado` | 1.00 | 1.975 | 2.058 | -0.003 | |
| `Carbonizado` | 1.00 | 1.975 | 1.975 | -0.003 | |
| `Devorador` | 1.00 | 1.979 | 2.062 | -0.003 | |
| `human` | 1.00 | 1.979 | 2.062 | -0.003 | |

### 2. Personagens — Corpo rico (Sobreviventes / `person-builder`)

| Caso | `h` | `bulk` | Topo do crânio (m) | Topo total c/ cabelo (m) | Base `minY` (m) |
|---|---:|---:|---:|---:|---:|
| male (`h=1.0`) | 1.00 | 1.00 | 1.982 | 2.045 | 0.001 |
| female (`h=1.0`) | 1.00 | 0.94 | 1.982 | 2.045 | 0.001 |
| child min (`h=0.52`) | 0.52 | 1.00 | 1.030 | 1.063 | 0.001 |
| child max (`h=0.70`) | 0.70 | 1.00 | 1.387 | 1.431 | 0.001 |
| young min (`h=0.97`) | 0.97 | 1.00 | 1.922 | 1.984 | 0.001 |
| young max (`h=1.00`) | 1.00 | 1.00 | 1.982 | 2.045 | 0.001 |
| adult min (`h=0.97`) | 0.97 | 1.00 | 1.922 | 1.984 | 0.001 |
| adult max (`h=1.07`) | 1.07 | 1.00 | 2.120 | 2.188 | 0.001 |
| elder min (`h=0.90`) | 0.90 | 1.00 | 1.783 | 1.840 | 0.001 |
| elder max (`h=1.00`) | 1.00 | 1.00 | 1.982 | 2.045 | 0.001 |

### 3. Personagens — Corpo instanciado (`buildInstancedBody`)

| Spec | Segmentos | Topo do crânio (m) | Topo total c/ cabelo (m) | Base `minY` (m) |
|---|---:|---:|---:|---:|
| `TEAM_GAME` | 16 / 10 / 5 | 1.813 | 1.830 / 1.829 / 1.828 | 0.017 |
| `GUIDE` | 16 / 10 / 5 | 1.813 | 1.830 / 1.829 / 1.828 | 0.017 |

### 4. Personagens — Corpo assado (`bakeBody`, LOD 1)

| Tipo | Fator `s` | `maxY` (m) | `minY` (m) | Vértices |
|---|---:|---:|---:|---:|
| `Lento` | 1.00 | 2.004 | -0.003 | 6209 |
| `Corredor` | 0.97 | 1.944 | -0.002 | 6209 |
| `Brutamonte` | 1.42 | 3.018 | -0.004 | 6673 |
| `Rastejante` | 1.00 | 2.004 | 0.395 | 6137 |
| `Gritador` | 1.00 | 2.004 | -0.003 | 6233 |
| `Inchado` | 1.03 | 2.064 | -0.003 | 8094 |
| `Espreitador` | 1.00 | 2.004 | -0.003 | 6209 |
| `Farejador` | 1.00 | 2.004 | -0.003 | 6209 |
| `Saltador` | 1.00 | 2.004 | -0.003 | 6209 |
| `Cego` | 1.00 | 2.004 | -0.003 | 6383 |
| `Afogado` | 1.00 | 2.000 | -0.003 | 6309 |
| `Carbonizado` | 1.00 | 1.975 | -0.003 | 6419 |
| `Devorador` | 1.00 | 2.004 | -0.003 | 6872 |

### 5. Frota inteira (69 veículos) — Resumo por grupo

Medição por 5 raios verticais a partir do topo da almofada (`offset ±0.06 m` em x e z, mínimo dos 5), raio horizontal `+x` na altura do joelho (`seat.y + 0.12`) a partir da borda frontal da almofada (somado a `seat.l / 2`), e caixa das zonas `type === 'door'`.

| Grupo | Veículos | Sem assento | Altura livre mín. / med. / máx. (m) | Espaço pernas mín. / med. (m) |
|---|---:|---:|---|---|
| `cars` | 15 | 0 | 0.519 / 0.646 / 0.802 | 0.291 / 0.430 |
| `motorcycles` | 12 | 12 | inf / — | inf / — |
| `suvs` | 4 | 0 | 0.713 / 0.751 / 0.840 | 0.424 / 0.430 |
| `pickups` | 4 | 0 | 0.771 / 0.863 / 0.878 | 0.424 / 0.430 |
| `vans` | 2 | 0 | 1.128 / 1.196 / 1.196 | 0.430 / 0.550 |
| `heavy` | 5 | 0 | 0.820 / 1.070 / 2.090 | 0.289 / 1.098 |
| `agricultural` | 1 | 0 | 1.105 / 1.105 / 1.105 | 0.562 / 0.562 |
| `military` | 8 | 0 | 0.240 / 0.858 / 1.150 | 0.288 / 0.452 |
| `water` | 7 | 0 | 1.130 / 1.130 / 1.268 | 0.600 / 1.500 |
| `air` | 11 | 0 | 0.367 / 0.920 / 1.239 | 0.300 / 1.522 |

### 6. Frota inteira (69 veículos) — Detalhe por modelo (assento 0 e portas)

| Veículo | Grupo | Kind | Assentos | Almofada `y` (m) | Altura livre mín. (m) | Espaço pernas (m) | Largura assento (m) | Portas (vão L×A m) |
|---|---|---|---:|---:|---:|---:|---:|---|
| `compact_hatch` | cars | car | 3 | 0.670 | 0.551 | 0.430 | 0.520 | door_front_left/right: 1.19×0.89; door_rear_left/right: 0.72×0.89 |
| `taxi` | cars | car | 3 | 0.670 | 0.601 | 0.430 | 0.520 | door_front: 1.19×0.89; door_rear: 0.80×0.89 |
| `entry_hatch` | cars | car | 3 | 0.710 | 0.648 | 0.430 | 0.520 | door_front: 1.11×0.85; door_rear: 0.78×0.85 |
| `electric_hatch` | cars | car | 3 | 0.710 | 0.611 | 0.430 | 0.520 | door_front: 1.27×0.88; door_rear: 0.82×0.88 |
| `midsize_sedan` | cars | car | 3 | 0.670 | 0.636 | 0.430 | 0.520 | door_front: 1.23×0.87; door_rear: 0.80×0.87 |
| `police_sedan` | cars | car | 3 | 0.680 | 0.601 | 0.430 | 0.520 | door_front: 1.23×0.88; door_rear: 0.84×0.88 |
| `highway_police_sedan` | cars | car | 3 | 0.680 | 0.601 | 0.430 | 0.520 | door_front: 1.23×0.88; door_rear: 0.84×0.88 |
| `beetle` | cars | car | 3 | 0.650 | 0.802 | 0.291 | 0.440 | door_front: 1.08×0.88 |
| `boxy_hatch` | cars | car | 3 | 0.620 | 0.743 | 0.430 | 0.520 | door_front: 1.11×0.86; door_rear: 0.71×0.86 |
| `family_hatch` | cars | car | 3 | 0.630 | 0.658 | 0.430 | 0.520 | door_front: 1.15×0.89; door_rear: 0.70×0.89 |
| `rideshare_hatch` | cars | car | 3 | 0.640 | 0.646 | 0.430 | 0.520 | door_front: 1.12×0.90; door_rear: 0.77×0.90 |
| `turbo_hatch` | cars | car | 3 | 0.630 | 0.696 | 0.430 | 0.520 | door_front: 1.17×0.92; door_rear: 0.77×0.92 |
| `fastback_sedan` | cars | car | 3 | 0.610 | 0.708 | 0.430 | 0.520 | door_front: 1.24×0.92; door_rear: 0.67×0.92 |
| `classic_six_sedan` | cars | car | 3 | 0.635 | 0.698 | 0.430 | 0.520 | door_front: 1.17×0.82; door_rear: 0.74×0.82 |
| `v8_coupe` | cars | car | 3 | 0.610 | 0.519 | 0.430 | 0.520 | door_front: 1.50×0.85 |
| `compact_suv` | suvs | car | 3 | 0.710 | 0.721 | 0.430 | 0.520 | door_front: 1.06×0.85; door_rear: 0.86×0.85 |
| `hybrid_suv` | suvs | car | 3 | 0.730 | 0.751 | 0.430 | 0.520 | door_front: 1.17×0.86; door_rear: 0.94×0.86 |
| `midsize_suv` | suvs | car | 3 | 0.750 | 0.713 | 0.430 | 0.520 | door_front: 1.13×0.86; door_rear: 0.96×0.86 |
| `large_suv` | suvs | car | 4 | 0.850 | 0.840 | 0.430 | 0.520 | door_front: 1.20×0.93; door_rear: 1.09×0.93 |
| `compact_pickup` | pickups | car | 3 | 0.725 | 0.776 | 0.430 | 0.520 | door_front: 1.10×0.82; door_rear: 0.93×0.82 |
| `crossover_pickup` | pickups | car | 3 | 0.810 | 0.771 | 0.430 | 0.520 | door_front: 1.17×0.88; door_rear: 1.02×0.88 |
| `midsize_pickup` | pickups | car | 3 | 0.870 | 0.863 | 0.430 | 0.520 | door_front: 1.13×0.89; door_rear: 1.06×0.89 |
| `monster_truck` | pickups | car | 2 | 1.960 | 0.878 | 0.430 | 0.500 | door_front: 1.10×0.85 |
| `cargo_van` | vans | car | 2 | 1.050 | 1.196 | 0.550 | 0.500 | door_front: 1.51×1.09; door_rear_right: 1.32×2.03 |
| `ambulance` | vans | car | 2 | 1.050 | 1.128 | 0.430 | 0.500 | door_front: 1.39×1.07; door_rear_right: 1.13×1.90 |
| `box_truck` | heavy | truck | 2 | 1.550 | 0.820 | 1.098 | 0.500 | — |
| `tanker_truck` | heavy | truck | 2 | 1.830 | 0.960 | 0.365 | 0.500 | — |
| `school_bus` | heavy | bus | 19 | 1.430 | 1.540 | 2.054 | 0.920 | — |
| `city_bus` | heavy | bus | 18 | 0.900 | 2.090 | 0.425 | 0.875 | — |
| `armored_truck` | heavy | truck | 2 | 1.750 | 1.070 | 0.289 | 0.500 | — |
| `tractor` | agricultural | tractor | 1 | 1.520 | 1.105 | 0.562 | 0.500 | — |
| `light_4x4` | military | car | 4 | 0.920 | 0.858 | 0.430 | 0.520 | door_front: 1.01×0.83 |
| `troop_truck` | military | truck | 18 | 1.850 | 1.120 | 0.365 | 0.500 | — |
| `apc_6x6` | military | car | 10 | 1.240 | 0.990 | 2.240 | 0.420 | — |
| `armored_car_6x6` | military | car | 3 | 1.430 | 0.335 | 0.805 | 0.460 | — |
| `battle_tank` | military | car | 4 | 0.970 | 0.435 | 1.083 | 0.440 | — |
| `transport_helicopter` | military | heli | 15 | 1.290 | 1.150 | 0.372 | 0.500 | — |
| `light_attack_turboprop` | military | plane | 2 | 1.570 | 1.048 | 0.288 | 0.500 | — |
| `attack_helicopter` | military | heli | 10 | 1.880 | 0.747 | 0.489 | 0.500 | — |
| `river_skiff` | water | boat | 3 | 0.320 | inf | 4.050 | 1.339 | — |
| `speedboat` | water | boat | 5 | 0.570 | inf | 1.920 | 0.500 | — |
| `jet_ski` | water | boat | 3 | 0.640 | inf | 1.156 | 0.450 | — |
| `sailboat` | water | boat | 2 | 0.900 | inf | 1.500 | 0.420 | — |
| `rescue_dinghy` | water | boat | 5 | 0.430 | inf | 2.134 | 1.200 | — |
| `fishing_boat` | water | boat | 1 | 1.121 | 1.268 | 0.600 | 0.500 | — |
| `patrol_boat` | water | boat | 3 | 1.889 | 1.130 | 0.800 | 0.520 | — |
| `single_engine_plane` | air | plane | 3 | 1.090 | 0.900 | 1.885 | 0.440 | — |
| `crop_duster` | air | plane | 1 | -0.030 | 0.416 | inf | 0.500 | — |
| `tandem_trainer` | air | plane | 2 | -0.090 | 0.492 | inf | 0.480 | — |
| `regional_turboprop` | air | plane | 18 | 1.370 | 1.239 | 2.214 | 0.500 | — |
| `amphibian_turboprop` | air | plane | 8 | 2.450 | 1.040 | 3.983 | 0.500 | — |
| `light_jet` | air | plane | 7 | 1.170 | 1.070 | 2.285 | 0.480 | — |
| `piston_helicopter` | air | heli | 3 | 1.090 | 0.844 | 1.522 | 0.480 | — |
| `rescue_helicopter` | air | heli | 3 | 1.170 | 1.060 | 0.300 | 0.500 | — |
| `trainer_helicopter` | air | heli | 2 | 0.950 | 0.738 | 1.464 | 0.440 | — |
| `turbine_helicopter` | air | heli | 3 | 1.050 | 0.920 | 0.301 | 0.480 | — |
| `police_helicopter` | air | heli | 8 | 1.110 | 1.162 | 0.348 | 0.500 | — |
| 12 motos/quad (`bicycle`, `scooter`, `commuter_motorcycle`, `trail_bike`, `adventure_bike`, `highway_police_bike`, `quad_bike`, `step_through_scooter`, `naked_bike`, `sport_bike`, `cruiser`, `delivery_bike`) | motorcycles | bike/quad | 0 | — | — | — | — | — |
