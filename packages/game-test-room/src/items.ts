import type * as THREE_NS from 'three'
import { buildFrame } from '@adatechnology/game-destruction'
import type { DestructibleSpec, JointSpec, MaterialDef, PartSpec, Vec3 } from '@adatechnology/game-destruction'
import { buildFromSpec } from './build-from-spec'
import { resolveStrings } from './locale'
import type { TestRoomItem } from './types'

/**
 * Extra materials the demo items need on top of the core ones. None any more (the bottle uses the core `glass`, which now breaks from a drop);
 * kept so that code passing it to `worldOptions.materials` keeps working.
 */
export const DEMO_MATERIALS: MaterialDef[] = []

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Small spec helpers
// ---------------------------------------------------------------------------------------------------------------------------------------------

type Extra = Partial<Omit<PartSpec, 'id' | 'material' | 'shape' | 'position'>>

const box = (id: string, material: string, size: Vec3, position: Vec3, extra: Extra = {}): PartSpec => ({ id, material, shape: { kind: 'box', size }, position, ...extra })
const cyl = (id: string, material: string, radius: number, height: number, position: Vec3, extra: Extra = {}): PartSpec => ({
  id,
  material,
  shape: { kind: 'cylinder', radius, height },
  position,
  ...extra,
})
const sph = (id: string, material: string, radius: number, position: Vec3, extra: Extra = {}): PartSpec => ({ id, material, shape: { kind: 'sphere', radius }, position, ...extra })
const joint = (a: string, b: string, kind: JointSpec['kind'], extra: Partial<JointSpec> = {}): JointSpec => ({ a, b, kind, ...extra })

/** Spec of the brick target wall: `cols` x `rows` brick panels, the bottom row anchored, mortar joints between neighbours. */
export function brickWallSpec(cols = 8, rows = 6, panel: Vec3 = [1.25, 0.5, 0.2]): DestructibleSpec {
  const parts: PartSpec[] = []
  const joints: JointSpec[] = []
  const id = (c: number, r: number): string => `brick_${r}_${c}`
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      parts.push(box(id(c, r), 'brick', panel, [(c - (cols - 1) / 2) * panel[0], panel[1] / 2 + r * panel[1], 0], { anchored: r === 0 }))
      if (c > 0) joints.push(joint(id(c - 1, r), id(c, r), 'mortar'))
      if (r > 0) joints.push(joint(id(c, r - 1), id(c, r), 'mortar'))
    }
  }
  return { name: 'brick wall', parts, joints, tags: ['structure'] }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Demo specs
// ---------------------------------------------------------------------------------------------------------------------------------------------

const chair = (): DestructibleSpec => {
  const legs = [
    [-0.18, -0.18],
    [0.18, -0.18],
    [-0.18, 0.18],
    [0.18, 0.18],
  ]
  return {
    name: 'chair',
    parts: [
      box('seat', 'wood_soft', [0.42, 0.04, 0.42], [0, 0.45, 0]),
      ...legs.map(([x, z], i) => box(`leg_${i + 1}`, 'wood_soft', [0.04, 0.43, 0.04], [x, 0.215, z])),
      box('backrest', 'wood_soft', [0.4, 0.3, 0.03], [0, 0.64, -0.195]),
    ],
    joints: [...legs.map((_, i) => joint(`leg_${i + 1}`, 'seat', 'screw')), joint('backrest', 'seat', 'screw')],
    tags: ['furniture'],
  }
}

const crate = (): DestructibleSpec => ({
  name: 'wooden crate',
  parts: [
    box('front', 'wood_soft', [0.5, 0.5, 0.02], [0, 0.25, 0.24], { hp: 70 }),
    box('back', 'wood_soft', [0.5, 0.5, 0.02], [0, 0.25, -0.24], { hp: 70 }),
    box('left', 'wood_soft', [0.02, 0.5, 0.46], [-0.24, 0.25, 0], { hp: 70 }),
    box('right', 'wood_soft', [0.02, 0.5, 0.46], [0.24, 0.25, 0], { hp: 70 }),
    box('bottom', 'wood_soft', [0.46, 0.02, 0.46], [0, 0.01, 0], { hp: 70 }),
  ],
  joints: [
    joint('front', 'left', 'nail'),
    joint('front', 'right', 'nail'),
    joint('back', 'left', 'nail'),
    joint('back', 'right', 'nail'),
    joint('front', 'bottom', 'nail'),
    joint('back', 'bottom', 'nail'),
    joint('left', 'bottom', 'nail'),
    joint('right', 'bottom', 'nail'),
  ],
  tags: ['container'],
})

const drum = (): DestructibleSpec => ({
  name: 'steel drum',
  parts: [
    cyl('drum_body', 'steel', 0.29, 0.86, [0, 0.45, 0], { mass: 12, thickness: 0.0012 }),
    cyl('drum_top', 'steel', 0.29, 0.02, [0, 0.89, 0], { mass: 1.5, thickness: 0.0012 }),
    cyl('drum_bottom', 'steel', 0.29, 0.02, [0, 0.01, 0], { mass: 1.5, thickness: 0.0012 }),
  ],
  joints: [joint('drum_body', 'drum_top', 'weld'), joint('drum_body', 'drum_bottom', 'weld')],
  tags: ['container'],
})

const steelSheet = (): DestructibleSpec => ({
  name: 'steel sheet',
  parts: [
    box('sheet', 'steel', [1, 1, 0.003], [0, 1.1, 0]),
    box('post_l', 'steel', [0.04, 0.54, 0.04], [-0.35, 0.33, 0], { mass: 4 }),
    box('post_r', 'steel', [0.04, 0.54, 0.04], [0.35, 0.33, 0], { mass: 4 }),
    box('foot_l', 'steel', [0.06, 0.06, 0.5], [-0.35, 0.03, 0], { mass: 6 }),
    box('foot_r', 'steel', [0.06, 0.06, 0.5], [0.35, 0.03, 0], { mass: 6 }),
  ],
  joints: [joint('sheet', 'post_l', 'weld'), joint('sheet', 'post_r', 'weld'), joint('post_l', 'foot_l', 'weld'), joint('post_r', 'foot_r', 'weld')],
  tags: ['structure'],
})

const glassPane = (): DestructibleSpec => ({
  name: 'glass pane',
  parts: [
    box('pane', 'glass', [0.8, 1, 0.006], [0, 1.05, 0], { hp: 40 }),
    box('frame_top', 'aluminium', [0.88, 0.04, 0.04], [0, 1.57, 0], { mass: 1 }),
    box('frame_bottom', 'aluminium', [0.88, 0.04, 0.04], [0, 0.53, 0], { mass: 1 }),
    box('frame_l', 'aluminium', [0.04, 1.04, 0.04], [-0.42, 1.05, 0], { mass: 1 }),
    box('frame_r', 'aluminium', [0.04, 1.04, 0.04], [0.42, 1.05, 0], { mass: 1 }),
    box('foot_l', 'steel', [0.06, 0.5, 0.4], [-0.35, 0.25, 0], { mass: 5 }),
    box('foot_r', 'steel', [0.06, 0.5, 0.4], [0.35, 0.25, 0], { mass: 5 }),
  ],
  joints: [
    joint('pane', 'frame_top', 'clip'),
    joint('pane', 'frame_bottom', 'clip'),
    joint('pane', 'frame_l', 'clip'),
    joint('pane', 'frame_r', 'clip'),
    joint('frame_bottom', 'foot_l', 'bolt'),
    joint('frame_bottom', 'foot_r', 'bolt'),
    joint('frame_l', 'frame_top', 'weld'),
    joint('frame_r', 'frame_top', 'weld'),
    joint('frame_l', 'frame_bottom', 'weld'),
    joint('frame_r', 'frame_bottom', 'weld'),
  ],
  tags: ['structure'],
})

const concreteBlock = (): DestructibleSpec => ({
  name: 'concrete block',
  parts: [box('block', 'concrete', [0.4, 0.4, 0.4], [0, 0.2, 0])],
  tags: ['structure'],
})

const brickColumn = (): DestructibleSpec => {
  const parts: PartSpec[] = []
  const joints: JointSpec[] = []
  const layers = 8
  const id = (l: number, x: number, z: number): string => `brick_${l}_${x}${z}`
  for (let l = 0; l < layers; l++) {
    for (let x = 0; x < 2; x++) {
      for (let z = 0; z < 2; z++) {
        parts.push(box(id(l, x, z), 'brick', [0.2, 0.2, 0.2], [(x - 0.5) * 0.2, 0.1 + l * 0.2, (z - 0.5) * 0.2], { anchored: l === 0 }))
        if (x > 0) joints.push(joint(id(l, x - 1, z), id(l, x, z), 'mortar'))
        if (z > 0) joints.push(joint(id(l, x, z - 1), id(l, x, z), 'mortar'))
        if (l > 0) joints.push(joint(id(l - 1, x, z), id(l, x, z), 'mortar'))
      }
    }
  }
  return { name: 'brick column', parts, joints, tags: ['structure'] }
}

/**
 * A small house frame (2 x 2 columns on foundations, beams, a roof slab) from the core's `buildFrame`. The columns are rated at 4.4 t so that
 * losing one column leaves the roof standing (the others carry about 90% of their capacity) and losing two overloads the rest until the roof
 * comes down.
 */
const frame = (): DestructibleSpec => ({ ...buildFrame({ spanX: 4, spanZ: 4, columnsX: 2, columnsZ: 2, height: 2.8, floors: 1, walls: false, roof: true, columnCapacity: 4400 }), name: 'building frame' })

const bucket = (): DestructibleSpec => ({
  name: 'plastic bucket',
  parts: [
    cyl('bucket_body', 'plastic', 0.14, 0.28, [0, 0.14, 0], { mass: 0.5, thickness: 0.002 }),
    box('handle', 'plastic', [0.3, 0.012, 0.012], [0, 0.3, 0], { mass: 0.05 }),
  ],
  joints: [joint('handle', 'bucket_body', 'clip')],
  tags: ['container'],
})

const bottle = (): DestructibleSpec => ({
  name: 'glass bottle',
  parts: [
    cyl('bottle_body', 'glass', 0.037, 0.17, [0, 0.085, 0], { mass: 0.3, thickness: 0.003, contains: { fluid: 'water', liters: 0.5 } }),
    cyl('bottle_neck', 'glass', 0.015, 0.09, [0, 0.215, 0], { mass: 0.08, thickness: 0.002 }),
  ],
  joints: [joint('bottle_neck', 'bottle_body', 'fused')],
  tags: ['item'],
})

const cup = (): DestructibleSpec => ({
  name: 'coffee cup',
  parts: [
    cyl('cup', 'ceramic', 0.05, 0.11, [0, 0.055, 0], { mass: 0.3, thickness: 0.004, contains: { fluid: 'coffee', liters: 0.25 } }),
    box('cup_handle', 'ceramic', [0.02, 0.06, 0.014], [0.068, 0.06, 0], { mass: 0.04 }),
  ],
  joints: [joint('cup_handle', 'cup', 'fused')],
  tags: ['item'],
})

const jerrycan = (): DestructibleSpec => ({
  name: 'jerrycan',
  parts: [
    box('tank', 'plastic', [0.34, 0.45, 0.14], [0, 0.225, 0], { mass: 1.2, thickness: 0.003, contains: { fluid: 'fuel', liters: 20 } }),
    cyl('cap', 'plastic', 0.025, 0.03, [0.08, 0.465, 0], { mass: 0.05 }),
    box('handle', 'plastic', [0.1, 0.03, 0.03], [-0.07, 0.465, 0], { mass: 0.1 }),
  ],
  joints: [joint('cap', 'tank', 'screw'), joint('handle', 'tank', 'fused')],
  tags: ['container'],
})

const gasBottle = (): DestructibleSpec => ({
  name: 'gas bottle',
  parts: [
    cyl('cylinder', 'steel', 0.15, 0.7, [0, 0.4, 0], {
      mass: 11,
      thickness: 0.003,
      contains: { fluid: 'gas', liters: 13, pressurized: true },
      explodes: { energy: 120000, radius: 5, atC: 300 },
    }),
    cyl('valve', 'steel', 0.03, 0.1, [0, 0.8, 0], { mass: 0.5 }),
    cyl('foot_ring', 'steel', 0.14, 0.05, [0, 0.025, 0], { mass: 1 }),
  ],
  joints: [joint('valve', 'cylinder', 'weld'), joint('foot_ring', 'cylinder', 'weld')],
  tags: ['container'],
})

const tree = (): DestructibleSpec => ({
  name: 'small tree',
  parts: [
    cyl('trunk', 'green_wood', 0.08, 2.2, [0, 1.1, 0], { anchored: true }),
    cyl('branch_1', 'green_wood', 0.03, 0.8, [0.34, 1.7, 0], { rotation: [0, 0, -0.9] }),
    cyl('branch_2', 'green_wood', 0.03, 0.8, [-0.3, 1.9, 0.12], { rotation: [0, 0, 0.8] }),
    cyl('branch_3', 'green_wood', 0.025, 0.7, [0.05, 2.0, -0.28], { rotation: [0.8, 0, 0] }),
    sph('crown_top', 'foliage', 0.55, [0, 2.55, 0], { mass: 2 }),
    sph('crown_1', 'foliage', 0.38, [0.62, 2.0, 0], { mass: 1 }),
    sph('crown_2', 'foliage', 0.38, [-0.58, 2.2, 0.15], { mass: 1 }),
    sph('crown_3', 'foliage', 0.32, [0.05, 2.3, -0.55], { mass: 1 }),
  ],
  joints: [
    joint('branch_1', 'trunk', 'stem'),
    joint('branch_2', 'trunk', 'stem'),
    joint('branch_3', 'trunk', 'stem'),
    joint('crown_top', 'trunk', 'stem'),
    joint('crown_1', 'branch_1', 'stem'),
    joint('crown_2', 'branch_2', 'stem'),
    joint('crown_3', 'branch_3', 'stem'),
  ],
  tags: ['plant'],
})

const pottedPlant = (): DestructibleSpec => ({
  name: 'potted plant',
  parts: [
    cyl('pot', 'ceramic', 0.15, 0.25, [0, 0.125, 0], { mass: 2, thickness: 0.008 }),
    cyl('soil', 'soil', 0.14, 0.06, [0, 0.26, 0], { mass: 1.5 }),
    sph('leaves_1', 'foliage', 0.16, [0, 0.46, 0], { mass: 0.3 }),
    sph('leaves_2', 'foliage', 0.12, [0.12, 0.38, 0.04], { mass: 0.2 }),
    sph('leaves_3', 'foliage', 0.12, [-0.1, 0.4, -0.06], { mass: 0.2 }),
  ],
  joints: [joint('soil', 'pot', 'fused'), joint('leaves_1', 'soil', 'stem'), joint('leaves_2', 'soil', 'stem'), joint('leaves_3', 'soil', 'stem')],
  tags: ['plant'],
})

const oldTv = (): DestructibleSpec => ({
  name: 'old TV',
  parts: [
    box('stand', 'wood_soft', [0.6, 0.35, 0.42], [0, 0.175, 0]),
    box('shell', 'plastic', [0.58, 0.44, 0.42], [0, 0.57, 0], { mass: 3, thickness: 0.004 }),
    box('screen', 'glass', [0.42, 0.32, 0.012], [0, 0.57, 0.212], { mass: 1.5 }),
    box('coil', 'copper', [0.2, 0.1, 0.2], [0, 0.55, -0.05], { mass: 1.5 }),
  ],
  joints: [joint('shell', 'stand', 'screw'), joint('screen', 'shell', 'clip'), joint('coil', 'shell', 'screw')],
  tags: ['furniture'],
})

const carDoor = (): DestructibleSpec => ({
  name: 'car door',
  parts: [
    box('post', 'steel', [0.1, 1.3, 0.1], [-0.58, 0.65, 0], { mass: 12, anchored: true }),
    box('skin', 'steel', [1, 0.8, 0.05], [0, 0.75, 0], { mass: 14, thickness: 0.0008 }),
    box('window', 'glass', [0.78, 0.32, 0.01], [0.04, 1.31, 0.01], { mass: 3 }),
    box('seal', 'rubber', [0.84, 0.03, 0.03], [0.04, 1.14, 0.01], { mass: 0.3 }),
  ],
  joints: [
    joint('skin', 'post', 'hinge', { id: 'hinge_upper' }),
    joint('skin', 'post', 'hinge', { id: 'hinge_lower' }),
    joint('window', 'seal', 'clip'),
    joint('seal', 'skin', 'clip'),
  ],
  tags: ['vehicle'],
})

const sofa = (): DestructibleSpec => ({
  name: 'sofa',
  parts: [
    box('frame', 'wood_soft', [1.8, 0.3, 0.8], [0, 0.15, 0], { mass: 14 }),
    box('seat_cushion', 'foam', [1.5, 0.18, 0.62], [0, 0.39, 0.06], { mass: 4 }),
    box('back_cushion', 'foam', [1.5, 0.5, 0.16], [0, 0.65, -0.3], { mass: 4 }),
    box('arm_l', 'fabric', [0.15, 0.4, 0.8], [-0.82, 0.5, 0], { mass: 3 }),
    box('arm_r', 'fabric', [0.15, 0.4, 0.8], [0.82, 0.5, 0], { mass: 3 }),
  ],
  joints: [
    joint('seat_cushion', 'frame', 'clip'),
    joint('back_cushion', 'frame', 'clip'),
    joint('arm_l', 'frame', 'screw'),
    joint('arm_r', 'frame', 'screw'),
  ],
  tags: ['furniture'],
})

const shelf = (): DestructibleSpec => ({
  name: 'shelf',
  parts: [
    box('back', 'plywood', [0.84, 1.5, 0.012], [0, 0.75, -0.14], { anchored: true }),
    box('board_1', 'wood_soft', [0.8, 0.025, 0.28], [0, 0.35, 0]),
    box('board_2', 'wood_soft', [0.8, 0.025, 0.28], [0, 0.75, 0]),
    box('board_3', 'wood_soft', [0.8, 0.025, 0.28], [0, 1.15, 0]),
    box('board_4', 'wood_soft', [0.8, 0.025, 0.28], [0, 1.5, 0]),
  ],
  joints: [joint('board_1', 'back', 'screw'), joint('board_2', 'back', 'screw'), joint('board_3', 'back', 'screw'), joint('board_4', 'back', 'screw')],
  tags: ['furniture'],
})

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------------------------------------------------------------------------

interface DemoDef {
  id: string
  group: string
  spec: () => DestructibleSpec
  colors?: Record<string, number>
  movable?: boolean
  fluid?: TestRoomItem['fluid']
}

const DEFS: DemoDef[] = [
  { id: 'chair', group: 'furniture', spec: chair, colors: { wood_soft: 0xa8703a } },
  { id: 'sofa', group: 'furniture', spec: sofa, colors: { frame: 0x6b4426, seat_cushion: 0x7d3b4c, back_cushion: 0x7d3b4c, arm_l: 0x6a2f40, arm_r: 0x6a2f40 } },
  { id: 'shelf', group: 'furniture', spec: shelf, colors: { back: 0xd9c9a3 }, movable: false },
  { id: 'old_tv', group: 'furniture', spec: oldTv, colors: { shell: 0x6d5a3e, stand: 0x8a5a30, screen: 0x4f6f68 } },
  { id: 'steel_sheet', group: 'structure', spec: steelSheet, movable: false, colors: { sheet: 0xb5bcc4 } },
  { id: 'glass_pane', group: 'structure', spec: glassPane, movable: false },
  { id: 'concrete_block', group: 'structure', spec: concreteBlock },
  { id: 'brick_column', group: 'structure', spec: brickColumn, movable: false },
  { id: 'building_frame', group: 'structure', spec: frame, movable: false, colors: { roof: 0x7d7d79 } },
  { id: 'car_door', group: 'vehicles', spec: carDoor, movable: false, colors: { skin: 0xc0392b, window: 0x9cd6e6 } },
  { id: 'small_tree', group: 'plants', spec: tree, movable: false },
  { id: 'potted_plant', group: 'plants', spec: pottedPlant, colors: { pot: 0xc4673a } },
  { id: 'coffee_cup', group: 'items', spec: cup, colors: { cup: 0xf3efe6 }, fluid: { container: { capacity: 0.6, liquid: 'coffee', liters: 0.25, temperature: 80, shape: { kind: 'cylinder', radius: 0.045, height: 0.1 }, opening: 0.045 }, part: 'cup', uses: ['drink', 'sip', 'pour'], offset: [0, 0.01, 0] } },
  {
    id: 'glass_bottle',
    group: 'items',
    spec: bottle,
    colors: { bottle_body: 0x7fd6b0, bottle_neck: 0x7fd6b0 },
    fluid: { container: { capacity: 0.5, liquid: 'water', liters: 0.5, temperature: 18, shape: { kind: 'cylinder', radius: 0.034, height: 0.14 }, opening: 0.012 }, part: 'bottle_body', uses: ['drink', 'sip', 'pour'], offset: [0, 0.015, 0] },
  },
  { id: 'wooden_crate', group: 'containers', spec: crate },
  { id: 'steel_drum', group: 'containers', spec: drum, colors: { drum_body: 0x2b5f9e, drum_top: 0x2b5f9e, drum_bottom: 0x2b5f9e } },
  { id: 'plastic_bucket', group: 'containers', spec: bucket, colors: { bucket_body: 0xd9482b, handle: 0x8a8a8a } },
  {
    id: 'jerrycan',
    group: 'containers',
    spec: jerrycan,
    colors: { tank: 0xc23b22, cap: 0xf2c230, handle: 0xc23b22 },
    fluid: { container: { capacity: 20, liquid: 'fuel', liters: 20, temperature: 20, shape: { kind: 'box', size: [0.33, 0.44, 0.13] }, opening: 0.025, closed: true }, part: 'tank', uses: ['pour', 'open', 'close'], offset: [0, 0.008, 0] },
  },
  { id: 'gas_bottle', group: 'containers', spec: gasBottle, colors: { cylinder: 0xd8d8d0, valve: 0x777777, foot_ring: 0x555555 } },
]

/**
 * The generic demo catalogue, names and groups translated for `locale` (`en` or `pt-BR`). Every item is a procedural low-poly build (one mesh per
 * destruction part, drawn by `buildFromSpec`) plus an explicit destruction spec. Containers carry a fluid container where it makes sense.
 */
export function demoItems(locale = 'en', extra: TestRoomItem[] = []): TestRoomItem[] {
  const s = resolveStrings(locale)
  const out: TestRoomItem[] = DEFS.map((d) => ({
    id: d.id,
    name: s.items[d.id] ?? d.id,
    group: s.groups[d.group] ?? d.group,
    build: (THREE: typeof THREE_NS) => buildFromSpec(THREE, d.spec(), { colors: d.colors }),
    spec: d.spec,
    movable: d.movable,
    fluid: d.fluid,
  }))
  return [...out, ...extra]
}

/** The demo catalogue in English (see `demoItems` for other locales). */
export const DEMO_ITEMS: TestRoomItem[] = demoItems('en')
