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

## Neighbourhood patterns

`urban.neighbourhoods` has the ten patterns of the Galeria's sample sheet: `downtown`, `suburb`, `working_class`, `historic_street`, `industrial_port`, `railway_village`, `mountain_resort`, `stilt_village`, `military` and `rural`. A pattern is data (`streetWidth`, `walkWidth`, `typologies`, `pole`, `lightColor`, `spacing`, `lit` = the share of lamps on and the rest burnt out, `marker`, `text` in `pt-BR` and `en`, and the `params` of its composer) plus a `compose` key into the registry of composers, which draw the street. A game changes a number with `patch`, adds a pattern with `packs` and a composer with `composers`, or takes one out with `remove`.

```ts
const plan = urban.neighbourhoods.get('suburb').compose(b, { x: 0, z: 0 }, {
  locale: 'en',
  providers: {
    house: (typology, request, b) => myHouse(typology, request, b),   // default: the far-away silhouettes of game-floorplan
    vehicle: (request, b) => myCar(request, b),                      // default: none (the page's box car is not shipped)
    plant: (request, b) => myTree(request, b),                       // default: the cone pine and the ball tree of the props
  },
})
// plan: { id, origin, houses, buildings, poles, vehicles, plants }  (what was put where)
urban.neighbourhoods.composeSampleSheet(b)   // the ground and the ten cells, in the order the page builds them
```

## Same seed, same city

The page keeps one generator for everything it draws and draws from it in call order. The builder does the same: the facade colour, the shop signs, the lit windows and the heights come from `b.random`, in the page's order, so a scene drawn with the same seed and the same calls has the same parts. The golden test in `game-urban-three` compares 34 parts and the whole sample sheet (1029 objects, the lists of instances and windows, the light budget left, the next number of the random and the map markers) with the page's scene hash, the lists the page keeps before its flush and the surface of each material.
