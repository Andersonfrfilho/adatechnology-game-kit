# @adatechnology/game-floorplan-post-apocalyptic

Genre pack for [`@adatechnology/game-floorplan`](../game-floorplan): the **fortified** and **abandoned** house states as a state plugin, with their item types and flags, and a configurable default seed distribution (35 % fortified, 45 % abandoned, 20 % normal).

- `fortified`: boarded windows, a heavy item barricading each exterior door, sandbags at the gates, barbed wire on the wall, floor mattresses, supplies and a lantern.
- `abandoned`: doors and gates left open, ransacked drawers, open suitcases, clothes on the floor, blood stains, a fallen chair, cars with a door open; the palette is desaturated and darkened.

The engine itself knows only `normal`; this pack adds the rest through `registerState`.

It also registers the **triage tent** (`triage_tent`, `place: 'triage'`, construction `canvas`, style `military_camp`): a 16 x 10 m military tent with a clean side and a bitten side (8 x 10 m each), six cots on each, six medical crates and a rifle trestle. `triageFindsHints` lists what its places can hold. It is a template, not a state: a state changes a building that exists and the tent has no host building.

## Install

```sh
pnpm add @adatechnology/game-floorplan @adatechnology/game-floorplan-post-apocalyptic
```

Browser without a bundler (the global is `GameFloorplanPostApocalyptic`):

```html
<script>GameFloorplanPostApocalyptic.register(GameFloorplan.engine)</script>
```

## Usage

```ts
import { engine } from '@adatechnology/game-floorplan'
import { register } from '@adatechnology/game-floorplan-post-apocalyptic'

register(engine)                                              // default distribution
register(engine, { distribution: { fortified: 1 } })          // always fortified unless a state is given
register(engine, { distribution: null })                      // default state is always normal

engine.generate('townhouse', { seed: 3, state: 'abandoned' }).stateItems
```

`generate` without `state` draws one from the seed using the distribution. `stateItems` are not part of `items`; barricades also mark the moved item (`barricade`, `moved`) and the door (`blocked`).

| State | Flags | State item types |
|---|---|---|
| `fortified` | doors `blocked`, windows `boards`, items `barricade` | `window_boards`, `barricade`, `sandbags`, `barbed_wire`, `razor_wire`, `canned_food`, `water_bottle_crates`, `water_jug`, `floor_mattress`, `lantern`, `candles` |
| `abandoned` | doors/gates `open`, items `ransacked`, `doorOpen` | `open_doors`, `ransacked_drawers`, `open_suitcases`, `clothes_on_floor`, `fallen_chair`, `blood_stains`, `open_gates` |

## Tests

This package hosts the property suite ported from the old SDK (`tests/floorplan.test.ts`), because it needs all four packs. It checks overlaps, blocked doors and windows, walkable paths, stair landings and reachability, pool rings, decor rules, ground cover, state consistency, palette contrast and determinism over every template, variant and state.

```sh
pnpm --filter @adatechnology/game-floorplan-post-apocalyptic test            # 25 seeds, about 90 s
FULL=1 pnpm --filter @adatechnology/game-floorplan-post-apocalyptic test      # the original 200 seeds
TPL='mansion' pnpm --filter @adatechnology/game-floorplan-post-apocalyptic test   # only matching variants
```

See [MIGRATION.md](MIGRATION.md) for the old-to-new names.

## Português

O pacote também registra a **tenda de triagem** (`triage_tent`, lugar `triage`, construção `canvas`, estilo `military_camp`): tenda militar de 16 x 10 m com o lado LIMPO e o lado MORDIDO (8 x 10 m cada), seis catres em cada, seis caixas médicas e um cavalete de fuzis; `triageFindsHints` lista o que cada lugar pode guardar. É modelo, não estado: o estado muda um prédio que já existe e a tenda não tem prédio hospedeiro.

Pacote de gênero para o `@adatechnology/game-floorplan`: os estados **protegida** (`fortified`) e **abandonada** (`abandoned`) da casa como plugin de estado, com seus itens e marcas, e uma distribuição de sementes configurável (35 % / 45 % / 20 % por padrão).

```ts
register(engine)                                      // distribuição padrão
register(engine, { distribution: { fortified: 1 } })  // sempre protegida, salvo se o estado for informado
```

`protegida` é `fortified` e `abandonada` é `abandoned`. Os nomes traduzidos dos estados estão em `locales/pt-BR.json`. A suíte de propriedades do SDK antigo fica aqui; `FULL=1` roda as 200 sementes originais (padrão: 25). Veja [MIGRATION.md](MIGRATION.md).
