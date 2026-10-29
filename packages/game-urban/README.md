# @adatechnology/game-urban

The urban pattern as data, with no three.js: the five street poles with a light budget, roads with a dashed centre line, sidewalks, street grids, blocks filled with city buildings, and the props of a street. A literal port of the pieces of the team's Galeria do Vale Cinzento (`poleLED`, `poleConcrete`, `poleIron`, `poleWood`, `floodTower`, `road`, `walk`, `streetGrid`, `fillBlock`, `fence`, `tent`, `pine`, `tree`, `container`, `watchtower`, `sandbags`, `stripLabel`, `wires`).

Everything is a **part** on the silhouette vocabulary of `@adatechnology/game-floorplan` (boxes with the rounded edge, cylinders, prisms, lines, signs, groups), plus the few the street needs (cones, crowns, planes, labels, lights). A drawer such as `@adatechnology/game-urban-three` turns the parts into meshes. The package knows no game and no place: the named valley, the neighbourhood of the zombie checkpoint and the like belong to the game that uses it.

```ts
import { createUrban } from '@adatechnology/game-urban'

const urban = createUrban({ lights: { budget: 16 } })
const b = urban.builder({ seed: 7 })               // the page's generator, mulberry32(7)

urban.streets.grid(b, { block: 36, count: 2, width: 10 })
urban.block.fill(b, { cx: 0, cz: 0, size: 26, minHeight: 12, maxHeight: 36, lit: 0.05, shop: 0.5 })
urban.poles.get('led_double').build(b, { x: 18, z: 5, on: true })
urban.props.watchtower(b, 40, 0, true)

const scene = b.scene()                            // { parts, items, windows: { lit, dark } }
```

## Poles

| id | shape | what it is |
|---|---|---|
| `led_double` | `double_arm` | 9 m mast, two arms with white LED heads (avenue) |
| `concrete_arm` | `single_arm` | 8 m concrete mast, one arm, sodium lamp, optional transformer drum (`dir` -1 mirrors the arm) |
| `cast_iron` | `lantern` | 4 m iron post, lantern box and pointed cap |
| `wood_crossarm` | `crossarm` | 7 m wooden pole with a crossarm and a hanging lamp |
| `flood_tower` | `flood_tower` | 12 m four-legged tower with three floodlights |

A pole that is `on` has a glowing lens and, while the **light budget** lasts, a real point light (white LED 1.3 / 24 m, sodium 1.3 / 20 m, lantern 1 / 14 m, crossarm 0.9 / 16 m, floodlight 1.6 / 34 m). The budget is the Galeria's counter: 16 by default, `take()` is `left-- > 0`, so `left` keeps falling below zero when more lamps ask than the budget had, and the lamps that did not get a light keep their lens. `flicker: true` marks the light of a failing lamp; the drawer animates it.

Every number of a pole is data. A game patches one by id, adds a pole or takes one out, and a pole of a new shape brings its builder:

```ts
createUrban({
  patch: { poles: { led_double: { spec: { light: { distance: 30 } } } } },
  packs: { poles: [{ id: 'banner', shape: 'banner', spec: { height: 5 } }] },
  shapes: { banner: (b, spec, o) => b.box(o.x, 0, o.z, 0.2, spec.height, 0.2, 0xffffff) },
  remove: { poles: ['wood_crossarm'] },
  facades: [0x777777, 0x998877],        // colours of the city buildings
  streets: { road: { color: 0x303030, dash: { every: 4 } } },
})
```

## Streets, blocks and props

- `streets.road(b, x, z, w, l, 'x' | 'z')`: a plane at 2 cm with a dash (1.8 x 0.16 m) every 5 m from 2 m after the start, as instances. `walk`, `ground` and `grid({ block, count, width })` (2n+1 roads each way and a sidewalk slab on each of the 2n x 2n blocks).
- `block.fill(b, { cx, cz, size, minHeight, maxHeight, k, gap, lit, shop })`: a `k x k` split of the block less 2 m of street; a building a little smaller than its lot, as tall as `lerp(min, max, random^1.6)` (more low buildings than tall ones), drawn by `createCityBuilding` of game-floorplan with the shared generator. Returns the buildings for the game's bookkeeping. `block.building` places one.
- `props`: `fence`, `tent`, `pine`, `tree`, `container`, `watchtower` (with a searchlight whose beam circles the ground), `sandbags` (instances), `label` (two lines on a 22 x 4.4 m board) and `wires`.

### Towers

`createUrban({ towers: true })` (off by default; the output is then the same as before, byte for byte) draws a building of the block or of an avenue that is at least `minHeight` (60 m) tall as a **tower** instead of a box: a podium with a taller ground storey, the shaft with a row of windows on every storey of its four faces, darker bands without windows where the plant floors are, the top plant floor set back, the parapet and a mast. Which kind is drawn is chosen by weight among the `presets`, whose numbers are the ones of the typologies of `game-floorplan-commercial` (`office`: 4 m storeys, a plant floor every 20, glass curtain wall) and `game-floorplan-residential` (`residential`: 3.1 m storeys, every 25, masonry with a window in each bay); the tests keep them equal. A game turns them off, changes the cut-off height, the presets and their weights, or draws the tower itself:

```ts
createUrban({
  towers: {
    minHeight: 80,
    presets: [{ id: 'office', weight: 1, storeyHeight: 4, mechanicalEvery: 20, glass: true, color: 0x3c5a73 }],
    mast: 0.04,
    provider: (request, b) => myTower(request, b),   // request: x, z, width, depth, height, color, preset, lit
  },
})
```

The heights come from where the building is drawn: `block.fill`'s `minHeight` and `maxHeight`, or the `buildings` of the `downtown` pattern (raise them with `patch`). The pack `TOWER_PATTERNS` (not in the sample sheet) adds `financial_district`, the avenue with 20 m lots and towers of 70 to 180 m: `createUrban({ packs: { neighbourhoods: TOWER_PATTERNS }, towers: true })`.

## Neighbourhood patterns

`urban.neighbourhoods` has the ten patterns of the Galeria's sample sheet: `downtown`, `suburb`, `working_class`, `historic_street`, `industrial_port`, `railway_village`, `mountain_resort`, `stilt_village`, `military` and `rural`. A pattern is data (`streetWidth`, `walkWidth`, `typologies`, `pole`, `lightColor`, `spacing`, `lit` = the share of lamps on and the rest burnt out, `marker`, `text` in `pt-BR` and `en`, and the `params` of its composer) plus a `compose` key into the registry of composers, which draw the street. A game changes a number with `patch`, adds a pattern with `packs` and a composer with `composers`, or takes one out with `remove`.

```ts
const plan = urban.neighbourhoods.get('suburb').compose(b, { x: 0, z: 0 }, {
  locale: 'en',
  providers: {
    house: (typology, request, b) => myHouse(typology, request, b),   // default: the far-away silhouettes of game-floorplan
    vehicle: createVehicleProvider(),                                // default: none (the page's box car is not shipped)
    plant: createPlantProvider(),                                    // default: the cone pine and the ball tree of the props
  },
})
// plan: { id, origin, houses, buildings, poles, vehicles, plants }  (what was put where)
urban.neighbourhoods.composeSampleSheet(b)   // the ground and the ten cells, in the order the page builds them
```

### Vehicles and plants from the other packages

`createVehicleProvider({ ids?, pick?, paint? })` parks a vehicle of `game-vehicles-fleet` (cars, SUVs, pickups and vans by default) where a pattern parks one, and `createPlantProvider({ region?, contexts?, seed?, pick? })` plants a species of `game-vegetation-species` where a pattern plants (a tree from the region's `sidewalk_tree` table, a pine from `square`). They do not draw: they add a `placement` part (`b.place(kind, id, x, z, { ry, scale, color, seed })`) that says what to put and where. The choice depends on the spot and not on `b.random`, so the scene around it keeps the same draw order. The drawer (`game-urban-three`) asks a resolver for each kind and leaves the spot empty when it has none.

## City plans (zoning)

A **district kind** (`urban.cities.kinds`, 22 shipped) says what a patch of the city is: its map `color`, the `zone` of the floorplan packages (`zt`, `zc`, `zr1`, ...), the neighbourhood `pattern` that dresses it (an id of `urban.neighbourhoods`, or `financial_district` of `TOWER_PATTERNS`), the `floors` `[min, max]`, the share of buildings by `uses` (`commercial`, `residential`, `industrial`, `institutional`, `agricultural`), the `block` size in metres (0 = no blocks) and its `text` in `pt-BR` and `en`. A **city plan** (`urban.cities.plans`) paints kinds on a map of metres (centre 0,0, x east, z south): `districts` (`{ id, kind, rect: [x0, z0, x1, z1], name?, floors?, uses? }`) listed from the outer to the inner one, so the **last district that contains a point wins**; `lines` (avenue, street, highway, rail, river) and `landmarks`. Plans are data: nothing is drawn unless you call `fillBlock`, and existing scenes do not change.

| id | scale | size (m) | what it is |
|---|---|---|---|
| `metropolis` | metropolis | 6000 x 6000 | Tower downtown ringed by commerce, high-rise and low-rise neighbourhoods, outskirts and industry on the railway |
| `regional_city` | city | 4000 x 4000 | Commercial centre with a few tall buildings, house neighbourhoods and an industrial district |
| `port_city` | city | 4000 x 3000 | Quays and warehouses on the shore, old town behind the port and neighbourhoods up the hill |
| `rail_town` | town | 3000 x 3000 | A town grown around its station: rail yard, old centre, company village |
| `country_town` | town | 2400 x 2400 | Main square with the church, ground-floor shops around, houses, a co-op and smallholdings |
| `mountain_village` | village | 1600 x 1200 | Church square, a street of inns up the slope and chalets scattered on the hill |

```ts
const urban = createUrban({ towers: true })
const layout = urban.cities.layout('regional_city', { locale: 'en', maxFloors: 40 })
layout.districtAt(0, 0)                              // { id, kind, color, zone, pattern, floors, uses, block, name, rect }
const center = layout.districts.find((d) => d.kind === 'commercial_center')!
const blocks = layout.blocks(center.id, { street: 10 })   // { x, z, size, district, building: { floors, uses, zone, pattern } }[]
const b = urban.builder({ seed: 7 })
for (const block of blocks) urban.cities.fillBlock(b, block)   // block.fill with the block's floors and uses
urban.cities.stats(layout)                           // [{ kind, area, share, districts }] by kind
```

`blocks` is the grid of the district's rectangle by the kind's `block` size, less the street, skipping the cells whose centre belongs to another district (one painted over it). `block.building` is the config a building generator takes. `fillBlock` calls `block.fill` with the block's `floors` and `uses` (and `storeyPresets` / `storeyHeight` when you pass them), so each building picks its use by weight and gets `floors x storey height` of that use's tower preset (`office` 4 m, `residential` 3.1 m; a game that changes the presets changes it); with `towers` on, tall commercial buildings become office towers and tall residential ones residential towers, capped by `towers.maxStoreys`. The ground-floor `shop` chance defaults to the commercial share. It draws nothing for kinds with no storeys or no pattern.

**Floors are capped at 60 by default**, after the district's own override: `createUrban({ cities: { maxFloors: 40 } })` or `layout(plan, { maxFloors })` clamp every district to `[0, maxFloors]`. A game raises the cap and the kind together.

A game adds its own city (or kind) with `packs`, changes numbers with `patch` and takes some out with `remove`, under the keys `districtKinds` and `cityPlans`. A plan can start from another with `extends`: its districts, lines and landmarks come first, a district or line with the same id replaces the parent's in place, new ones append (landmarks always append), and `size`, `scale` and `text` are inherited when omitted.

```ts
createUrban({
  cities: { maxFloors: 80 },
  packs: {
    districtKinds: [{ id: 'harbour_lofts', color: '#5aa0a8', zone: 'zr3_zm', pattern: 'downtown', floors: [3, 9], uses: { residential: 0.7, commercial: 0.3 }, block: 60,
      text: { 'pt-BR': { name: 'Lofts do cais', description: 'Armazéns reformados.' }, en: { name: 'Harbour lofts', description: 'Converted warehouses.' } } }],
    cityPlans: [{
      id: 'my_port',
      extends: 'port_city',
      districts: [{ id: 'lofts', kind: 'harbour_lofts', rect: [-400, -200, 0, 300] }],   // painted over what is there
      lines: [{ id: 'ferry', kind: 'street', width: 12, points: [[-400, 0], [0, 0]] }],
      landmarks: [{ kind: 'lighthouse', at: [-380, 120], name: 'Old light' }],
    }],
  },
  patch: { districtKinds: { downtown: { floors: [30, 80] } } },
  remove: { cityPlans: ['rail_town'] },
})
```

## Terrain

`urban.terrain(options)` is a ground made of layers, as the Galeria's Vale: a rolling base (waves), masked relief (mountains, hills: `mask · (level + waves)`), cities levelled flat, rivers carved to a bed, lakes carved to a level, a forest density, and a colour for every point by ordered rules (low ground, ellipses such as a bog, city rectangles, high rock, forest, then open fields picked by a hash of the map cell). It answers `heightAt(px, py)`, `forestAt`, `colorAt`, `nearRiver` and `toWorld`/`fromWorld` (the frame maps the plan to metres: `world = plan · scale + origin`), and hands a drawer `grid(segments)`: the 32-bit coordinates, heights and colours of the square mesh, rows along z. `urban.drawTerrain(b, terrain)` adds the mesh part and the water plane. `custom(px, py, h)` has the last word on a height.

The numbers of a place are the game's: the Vale Cinzento (4 rivers, 4 lakes, 5 cities, the Serra, the Mata Funda) is `game-slice/urban/valley-terrain.json` in the spec folder, and a copy of it is the fixture of the tests.

## Same seed, same city

The page keeps one generator for everything it draws and draws from it in call order. The builder does the same: the facade colour, the shop signs, the lit windows and the heights come from `b.random`, in the page's order, so a scene drawn with the same seed and the same calls has the same parts. The golden test in `game-urban-three` compares 34 parts, the terrain mesh (181 x 181 vertices, heights and colours) and the whole sample sheet (1029 objects, the lists of instances and windows, the light budget left, the next number of the random and the map markers) with the page's scene hash, the lists the page keeps before its flush and the surface of each material.

### Configurar pelo jogo (torres da cidade)

`createUrban({ towers })` aceita `minHeight`, `maxStoreys` (padrão 60: um lote mais alto é desenhado com 60 andares do tipo), `presets` (cada um com `weight`, `storeyHeight`, `mechanicalEvery`, `glass`, `minStoreys`, `maxStoreys`), `mast`, `lit` e `provider`. `towerPresetOf` monta um preset a partir do layout de uma tipologia, para a cidade desenhar a mesma torre que o jogo configurou em `office_tower` / `residential_tower`.

```ts
const office = officeTowerLayout({ storeys: 50, height: 3.4 })
const kit = createUrban({
  packs: { neighbourhoods: TOWER_PATTERNS },
  towers: {
    maxStoreys: 70,
    presets: [
      towerPresetOf('office', 0.3, office, { mechanicalEvery: 18, minStoreys: 25, maxStoreys: 70 }),
      { ...DEFAULT_TOWER_PRESETS[1], weight: 0.7, maxStoreys: 40 },
    ],
  },
})
```

Por prédio, o bloco também aceita os andares e os usos (os mesmos nomes de `building` de um bloco de `urban.cities`): `block.fill(b, { ..., floors: [8, 40], uses: { commercial: 0.6, residential: 0.4 } })`. `floors` é um número ou `[min, max]` e vira altura (andares vezes o pé-direito do preset do uso; sem uso, `storeyHeight`); `uses` sorteia o uso de cada prédio por peso, e `storeyPresets` (padrão `{ commercial: 'office', residential: 'residential' }`) diz que tipo de torre cada uso desenha. Com `towers` ligado, prédios altos comerciais viram `office` e residenciais `residential` (o `TowerRequest` traz `use` e `storeys`); os baixos seguem o prédio comum com a altura dos andares pedidos. Sem `floors` e `uses` a saída não muda.

```ts
kit.block.fill(b, { cx: 0, cz: 0, size: 100, minHeight: 20, maxHeight: 60, ...block.building })  // block.building = { floors: [10, 40], uses: { commercial: 1 } }
```
