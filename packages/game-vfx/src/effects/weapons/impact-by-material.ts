import { add, eq, FRESH, INDEX, ite, PARAM, pick, rnd, variable, vadd } from '../dsl'
import { localToWorld } from '../props'
import { after, behavior, call, camera, decal, repeat, set, when } from '../steps'
import type { EffectDef } from '../types'

const MATERIALS = ['concrete', 'metal', 'wood', 'glass', 'flesh', 'water']
const CAR_ORIGIN = [5.6, 0, 0.8] as const
const CAR_ROTATION = [0, -0.4, 0] as const
const FACING_WALL = [0, 0, 1] as const
const UP = [0, 1, 0] as const
const GLASS = 3
const FLESH = 4
const WATER = 5
const SHOT_TIMES = [0, 0.55, 1.1]
const LAST_SHOT = 2
const BUMPER = localToWorld(CAR_ORIGIN, CAR_ROTATION, [0.96, 0.7, 0.4])
const CAR_SIDE = [Math.cos(CAR_ROTATION[1]), 0, -Math.sin(CAR_ROTATION[1])] as const
/** Where each material is hit and the way the surface faces (W752-756). */
const POINTS = [[-2, 1.6, -4.45], BUMPER, [2, 1.3, -4.36], [-5, 1.9, -4.45], [0, 1.25, 0.16], [-1.5, 0.012, 2.2]]
const NORMALS = [FACING_WALL, CAR_SIDE, FACING_WALL, FACING_WALL, FACING_WALL, UP]
/** The eye the page glides to for each material on the first run (W773-774); the car's is found from the car. */
const EYES = [[-2, 1.6, -1.8], localToWorld(CAR_ORIGIN, CAR_ROTATION, [3, 1.4, 1.5]), [2, 1.3, -1.6], [-5, 1.9, -1.8], [0, 1.2, 2.6], [-1.5, 0.8, 4.6]]
/** The shop window as the glass texture sees it (`crackAt` takes pixels): 2.6 x 1.8 m on 256 x 180. */
const WINDOW = { centreX: -5, centreY: 1.9, width: 2.6, height: 1.8, pixelsX: 256, pixelsY: 180 }

const scatter = ite(eq(PARAM, WATER), [rnd(-0.6, 0.6), 0, rnd(-0.3, 0.3)], ite(eq(PARAM, FLESH), [rnd(-0.1, 0.1), rnd(-0.15, 0.15), 0], [rnd(-0.4, 0.4), rnd(-0.3, 0.3), 0]))
const hitX = { $: 'vx', a: [variable('hit')] }
const hitY = { $: 'vy', a: [variable('hit')] }
const pixelX = { $: 'mul', a: [{ $: 'add', a: [{ $: 'div', a: [{ $: 'sub', a: [hitX, WINDOW.centreX] }, WINDOW.width] }, 0.5] }, WINDOW.pixelsX] }
const pixelY = { $: 'mul', a: [{ $: 'sub', a: [1, { $: 'add', a: [{ $: 'div', a: [{ $: 'sub', a: [hitY, WINDOW.centreY] }, WINDOW.height] }, 0.5] }] }, WINDOW.pixelsY] }

/** W762-775: three hits, 0.55 s apart, on the material the parameter names; the window keeps its cracks and the puddle takes a dark patch. */
export const IMPACT_BY_MATERIAL: EffectDef = {
  id: 'impact',
  pageId: 'impacto',
  team: 'weapons',
  params: { id: 'material', options: MATERIALS, default: 0 },
  budget: { particles: 40, decals: 1 },
  loop: 2.6,
  view: { eye: [0, 1.8, 4.5], target: [0, 1.2, -2] },
  props: ['cracks'],
  timeline: [
    when({ $: 'eq', a: [PARAM, WATER] }, [decal(-1.5, 0, 2.2, 3.2, 0x0d1218, { grow: 0, life: 60, ar: 0.55 })]),
    repeat(
      SHOT_TIMES.length,
      after(
        add(0.2, pick(SHOT_TIMES, INDEX)),
        set('hit', vadd(pick(POINTS, PARAM), scatter)),
        call('impact', pick(MATERIALS, PARAM), variable('hit'), pick(NORMALS, PARAM), 1, 0),
        when(eq(PARAM, GLASS), [behavior('cracks', 'crack', { x: pixelX, y: pixelY, big: eq(INDEX, LAST_SHOT) })]),
      ),
    ),
    when(FRESH, [camera(pick(EYES, PARAM), pick(POINTS, PARAM))]),
  ],
}
