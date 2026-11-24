# Evidência — Spec 012 (Altura real do personagem e quem cabe no veículo)

Worktree: `../adatechnology-game-kit-wt/spec-012` · Branch: `spec/012-altura-real` (base `origin/main` `e9b959906`).

## Registro de tasks

| Task | Commit | Comandos e códigos de saída | Números medidos / Prints |
|---|---|---|---|
| T0.1 | `59fb86730` (PR #426) | `pnpm --filter @adatechnology/game-characters-three... --filter @adatechnology/game-vehicles-fleet... --filter @adatechnology/game-vehicles-three... build` (exit 0); `node tools/measure-body-and-cabin.mjs` (exit 0); `pnpm check:layers` (exit 0); `node tools/kit-audit/audit.mjs` (exit 0); `pnpm lint` (exit 0) | Ver tabelas abaixo (14 tipos Bestiário, 10 casos Sobreviventes, 6 casos Instanciado, 13 Assados, 69 veículos da frota). Sem prints (task de medição em Node). |
| T0.2 🧠 | `71ca55a` (PR #452) | `pnpm --filter @adatechnology/game-contracts build && typecheck && test` (exit 0, 19 arquivos / 122 testes); `pnpm --filter "@adatechnology/game-vehicles..." build && pnpm --filter @adatechnology/game-vehicles typecheck && test` (exit 0, 25 arquivos / 352 testes); `pnpm check:layers` (exit 0, 0 violações novas); `pnpm check:packages` (exit 0, 66 pacotes); `node tools/kit-audit/audit.mjs --check` (exit 0); `pnpm lint` (exit 0, 0 erros) | Contratos `BodyMeasures`, `SeatRole`, `SeatSpace`, `DoorOpening`, `FitRejectReason`, `FitResult` em `game-contracts/src/body-measures.ts`; tabela R6 (11 categorias, `entryDuckFactor = 0.44`) em `game-vehicles/src/data/cabin.json` + `src/cabin.ts`. Aprovado pelo dono em 2026-11-24. Sem prints (só contratos e dados). |
| T1.1 | _(commit T1.1)_ | `pnpm --filter "@adatechnology/game-characters..." build` (exit 0); `pnpm --filter @adatechnology/game-characters typecheck` (exit 0); `pnpm --filter @adatechnology/game-characters test` (exit 0, 17 arquivos / 387 testes); `pnpm check:layers` (exit 0) | `heightRangeMetres` (`0.8..3.0 m`) e `heightsByTypeMetres` (14 tipos) em `body.json`; `heightFactor`, `assertHeight`, `defaultHeightMetres`, `InvalidHeightError` em `game-characters/src/body/height.ts`. |

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

---

## Decisão T0.2 🧠 — Contratos, arquitetura de `fits` e tabela de cabine (aprovado em 2026-11-24)

Worktree desta etapa: `../adatechnology-game-kit-wt/spec-012-fase0` · Branch: `spec/012-fase0` (base `origin/main` `923fa511f`).

### 1. Tipos em `@adatechnology/game-contracts` (`packages/game-contracts/src/body-measures.ts`)

Somente tipos puros (zero runtime, zero `three.js`, zero dependência de pacote de domínio), re-exportados de `packages/game-contracts/src/index.ts`. Todas as medidas em **metros** (`Infinity` representa vão/espaço aberto sem obstrução).

```ts
import type { Vec3 } from './destruction'

/** Anthropometric measures of a standing/seated body derived from stature and lateral build (metres). */
export type BodyMeasures = {
  /** Standing stature from sole to top of skull (excluding hair/hat), in metres. */
  readonly heightMetres: number
  /** Lateral build multiplier (1.0 = reference adult). */
  readonly build: number
  /** Vertical distance from seat surface (H-point) to top of skull, in metres. */
  readonly seatedHeightMetres: number
  /** Vertical distance from seat surface (H-point) to eye level, in metres. */
  readonly seatedEyeHeightMetres: number
  /** Bideltoid shoulder width, in metres. */
  readonly shoulderWidthMetres: number
  /** Horizontal buttock-to-knee length (hip to front of knee), in metres. */
  readonly thighLengthMetres: number
  /** Vertical knee-to-sole length (popliteal/knee height), in metres. */
  readonly shinLengthMetres: number
}

/** Functional role of a vehicle seat. */
export type SeatRole = 'driver' | 'front_passenger' | 'rear' | 'cargo' | 'rider' | 'pilot' | 'crew'

/** Usable interior clearance of one seat in vehicle local coordinates (+x front, +y up, +z right), in metres. */
export type SeatSpace = {
  /** Stable seat identifier within the vehicle (e.g. 'driver', 'front_right', 'rear_left', 'rider'). */
  readonly id: string
  /** Functional role of the seat. */
  readonly role: SeatRole
  /** Seat hip point (H-point, cushion top centre) in vehicle local coordinates, in metres. */
  readonly hipPoint: Vec3
  /** Clear vertical height from hipPoint to headliner/roof (min of 5 rays). `Infinity` for open vehicles/bikes/boats. */
  readonly headroomMetres: number
  /** Clear longitudinal knee/leg space from hipPoint along seat facing direction to first obstruction. `Infinity` if open. */
  readonly legroomMetres: number
  /** Available lateral width at shoulder height for this seat, in metres. `Infinity` for open-sided seats. */
  readonly widthMetres: number
  /** Id of the door opening that serves this seat (matches `DoorOpening.id`); `undefined` for open entry. */
  readonly doorId?: string
}

/** Clear opening of a vehicle door or hatch, in metres. */
export type DoorOpening = {
  /** Matches the vehicle door zone id (e.g. 'door_front_left', 'hatch_commander'). */
  readonly id: string
  /** Clear horizontal opening width, in metres. `Infinity` if open entry. */
  readonly widthMetres: number
  /** Clear vertical opening height, in metres. `Infinity` if open entry. */
  readonly heightMetres: number
}

/** Why a body does not fit a seat/door pair (D2: binary with reason). */
export type FitRejectReason = 'head' | 'legs' | 'shoulders' | 'door'

/** Result of checking whether a body fits a seat (and optionally its access door). */
export type FitResult =
  | { readonly fits: true }
  | { readonly fits: false; readonly reason: FitRejectReason }
```

### 2. Onde mora `fits` e validação contra `check:layers` e regras §2 / §3

| Pacote | Camada (`depcruise`) | Responsabilidade na Spec 012 | Dependências |
|---|---|---|---|
| `@adatechnology/game-contracts` | L0 (contracts) | `src/body-measures.ts`: tipos `BodyMeasures`, `SeatRole`, `SeatSpace`, `DoorOpening`, `FitRejectReason`, `FitResult` | nenhuma |
| `@adatechnology/game-characters` | L2 (core) | `src/data/body.json` (razões antropométricas com fonte + `heightMetres` por tipo + faixa suportada), `src/body/height.ts`, `src/body/measures.ts` (`bodyMeasures`) | `game-contracts` (já existe) |
| `@adatechnology/game-vehicles` | L2 (core) | `src/data/cabin.json` (mínimos por categoria + fatores de entrada), `src/fit.ts` (`fits({ body, seat, door? }): FitResult`), `interior.ts`/`context.ts` gravando `SeatSpace` e `DoorOpening` | `game-contracts` (já existe). `fit.ts` é **100% puro, sem `three.js`**, sem importar `game-characters` (respeita `core-no-three` e `no-circular`) |
| `@adatechnology/game-vehicles-fleet` | L3 (content) | Cabines corrigidas, mapeamento modelo → categoria de cabine, teste de aceitação da frota (69) e goldens de espaço/`fits` | `game-vehicles`, `game-contracts` |
| `@adatechnology/game-vehicles-three` | L4 (adapter) | `driverEye` derivado de `BodyMeasures` + `SeatSpace`; cenário "quem cabe" em `src/test-area/` | `game-vehicles`, `game-contracts` |

**Por que `fits` fica em `game-vehicles` (e não em `game-contracts`):**
- `game-contracts` guarda contratos entre pacotes (§4), não heurísticas de ergonomia veicular (fator de inclinação ao entrar na porta do carro, tolerâncias de cabine).
- `game-vehicles` não importa `game-characters` (recebe `BodyMeasures` via `game-contracts`), mantendo os dois domínios desacoplados e 100% compatíveis com `pnpm check:layers`.
- Quando existir `passesOpening` para portas de casa (fora do escopo desta spec), ele morará em `game-floorplan-structure` consumindo o mesmo `BodyMeasures` de `game-contracts`.

### 3. Razões antropométricas (para T2.1) e regra de avaliação de `fits` (para T4.1)

Fonte antropométrica (para citar em `packages/game-characters/src/data/body.json`): **ISO 7250-1 / NASA-STD-3000 (Vol. I §3.3) / ANSUR II (adulto p50)**.

| Medida | Razão sobre `heightMetres` | 1,55 m (`build=1`) | 1,80 m (`build=1`) | 2,05 m (`build=1`) |
|---|---:|---:|---:|---:|
| `seatedHeightMetres` | `0.520` | 0,806 m | **0,936 m** | 1,066 m |
| `seatedEyeHeightMetres` | `0.455` | 0,705 m | **0,819 m** | 0,933 m |
| `shoulderWidthMetres` | `0.260 × build` | 0,403 m | **0,468 m** | 0,533 m |
| `thighLengthMetres` (quadril–joelho) | `0.340` | 0,527 m | **0,612 m** | 0,697 m |
| `shinLengthMetres` (joelho–sola) | `0.285` | 0,442 m | **0,513 m** | 0,584 m |

**Ordem de avaliação em `fits({ body, seat, door })`** (todas as constantes de margem em `packages/game-vehicles/src/data/cabin.json`, nenhuma mágica no código):
1. **`'door'`** (se `door` definido):
   - Largura: `body.shoulderWidthMetres <= door.widthMetres`
   - Altura (pessoa inclina o tronco ao entrar pela porta do veículo — fator `entryDuckFactor = 0.44` sobre `heightMetres`, fonte: ergonomia automotiva SAE J1100 / acesso por porta lateral; a 1,80 m = `0,792 m`, a 2,05 m = `0,902 m`): `body.heightMetres * entryDuckFactor <= door.heightMetres`.
   - _Justificativa com dados T0.1:_ portas dianteiras de carro na frota medem `0,82–0,92 m` de altura (`classic_six_sedan` 0,82 m, `compact_hatch` 0,89 m). Usar `seatedHeightMetres` (0,936 m) reprovaria 1,80 m em todo carro; com `0.44`, 1,80 m passa (`0,792 ≤ 0,82`) e 2,05 m (`0,902 m`) é barrado por `'door'` em portas baixas (`≤ 0,89 m`) como cupês e hatches compactos.
2. **`'head'`**: `body.seatedHeightMetres <= seat.headroomMetres` (a 1,80 m = `0,936 ≤ 0,95`; a 2,05 m = `1,066 > 0,95` → recusa `'head'` em carros, cabe em van `1,19 m` e motos/abertos `Infinity`).
3. **`'legs'`**: `body.thighLengthMetres <= seat.legroomMetres`.
   - _Achado importante da T0.1:_ em `interior.ts`, o painel tem `d = 0.5` em `x0 - 0.07` e o banco fica em `x0 - 1.0`, então o raio na altura `seat.y + 0.12` bateu na face do painel em exatos `0,430 m` em quase todos os carros (enquanto o vão dos pés/joelhos abaixo do painel vai até a parede corta-fogo). Na T3.1/T3.2, `legroomMetres` mede a folga real de joelho a partir do `hipPoint` até a primeira obstrução à frente (abaixo da borda superior do painel ou encosto do banco da frente na fila traseira), exigindo `≥ 0,62 m` nos bancos dianteiros de carro (1,80 m precisa de `0,612 m`).
4. **`'shoulders'`**: `body.shoulderWidthMetres <= seat.widthMetres`.
   - _Convenção:_ `seat.widthMetres` é a **largura útil na altura dos ombros** (da forração da porta até o console/limite do assento vizinho), não apenas a largura da espuma do assento (`beetle` tem espuma de `0,44 m`, mas a cabine tem largura lateral útil maior).

### 4. Tabela de cabine por categoria (`packages/game-vehicles/src/data/cabin.json` — R6)

Sem alterar nenhuma medida externa de veículo. Cobertura dos 69 modelos da frota:

| Categoria (`CabinCategory`) | Modelos da frota (69) | Headroom mín. dianteiro (m) | Headroom mín. traseiro (m) | Legroom mín. dianteiro (m) | Largura útil mín. (m) | Porta mín. L × A (m) | Situação no baseline T0.1 |
|---|---|---:|---:|---:|---:|---|---|
| `passenger_car` | `cars` (15) | **0,95** (R6) | **0,90** | **0,62** | **0,52** | `0,65 × 0,80` | Headroom 0,519–0,802 m → corrigir piso/almofada/forro na T3.2 |
| `suv_pickup` | `suvs` (4) + `pickups` (4) | **0,98** | **0,93** | **0,64** | **0,54** | `0,70 × 0,82` | Headroom 0,713–0,878 m → corrigir na T3.2 |
| `van` | `vans` (2: `cargo_van`, `ambulance`) | **1,05** | **1,05** | **0,65** | **0,54** | `0,75 × 0,95` | Headroom 1,128–1,196 m (OK); ajustar legroom |
| `truck` | `box_truck`, `tanker_truck`, `armored_truck`, `troop_truck` (4) | **1,00** | **1,00** | **0,62** | **0,52** | `0,65 × 0,85` | `box_truck` 0,820 m (corrigir); gravar portas na T3.3 |
| `bus` | `school_bus`, `city_bus` (2) | **1,20** | **1,20** | **0,62** | **0,50** | `0,70 × 1,75` | Headroom 1,54–2,09 m (OK); gravar portas na T3.3 |
| `agricultural` | `tractor` (1) | **1,05** | — | **0,62** | **0,52** | `0,65 × 0,90` | Headroom 1,105 m (OK) |
| `military_light` | `light_4x4`, `apc_6x6` (2) | **0,95** | **0,92** | **0,62** | **0,50** | `0,60 × 0,80` | `light_4x4` 0,858 m (corrigir) |
| `military_armored` | `armored_car_6x6`, `battle_tank` (2) | **0,88** *(ver ponto 5)* | **0,88** | **0,58** | **0,46** | `0,50 × 0,55` | Baseline 0,335–0,435 m → corrigir assento interno na T3.3 |
| `open_vehicle` | `motorcycles` (12) + 5 barcos abertos (`river_skiff`, `speedboat`, `jet_ski`, `sailboat`, `rescue_dinghy`) | `Infinity` | `Infinity` | `Infinity` | `Infinity` | sem porta | R5; motos/quad ganham assento `rider` na T3.1 |
| `boat_cabin` | `fishing_boat`, `patrol_boat` (2) | **1,05** | **1,05** | **0,62** | **0,52** | `0,60 × 0,90` | Headroom 1,130–1,268 m (OK) |
| `aircraft_enclosed` | `air` (11) + `transport_helicopter`, `attack_helicopter`, `light_attack_turboprop` (3) | **0,95** | **0,92** | **0,62** | **0,48** | `0,55 × 0,80` | `crop_duster` (0,416 m, y=-0,03), `tandem_trainer` (0,492 m, y=-0,09), `attack_helicopter` (0,747 m), `trainer_helicopter` (0,738 m), `piston_helicopter` (0,844 m) → corrigir na T3.3 |

### 5. Pontos para aprovação do dono antes de fechar a Fase 0 e abrir a Fase 1

1. **Contratos (`game-contracts/src/body-measures.ts`) e local de `fits` (`game-vehicles/src/fit.ts`):** aprova os campos acima e `fits` morando em `game-vehicles` (puro, sem `three.js` e sem importar `game-characters`)?
2. **`military_armored` (`battle_tank`, `armored_car_6x6`):** manter cabine blindada realista mais apertada (`headroom >= 0,88 m`, onde 1,80 m é barrado por `'head'` e entra quem tem até ~1,69 m) ou subir o mínimo para `0,95 m` para 1,80 m também caber no tanque?
3. **Banco traseiro de carro (`passenger_car`):** aprova `0,95 m` nos dianteiros (R6) e `0,90 m` nos traseiros (evita violar o teto caído de cupê/fastback sem mudar altura externa)?
4. **Fator de inclinação na porta (`entryDuckFactor = 0.44`):** aprova esse valor em `cabin.json` (1,80 m entra em porta de `0,80 m+`; 2,05 m é barrado por `'door'` em portas `≤ 0,89 m`)?
5. **Fechamento da Fase 0:** após aprovação, commitar os tipos em `packages/game-contracts/src/body-measures.ts` + `packages/game-vehicles/src/data/cabin.json` + `evidence.md` e abrir o PR da Fase 0 antes de iniciar a Fase 1 (ou levar T0.2 já para o PR da Fase 1)?
