import { markKitOrigin } from '@adatechnology/game-contracts'
import type * as THREE_NS from 'three'

import { modelKit } from './kit'
import type { ModelKit, Parent } from './kit'

type Marks = { readonly handle: readonly [number, number, number]; readonly support?: readonly [number, number, number] }
type MeleeBuilder = (kit: ModelKit, group: THREE_NS.Group) => Marks

const QUARTER = Math.PI / 2

/** A flat plate cut from a profile in (x, z), lying with its underside at `y` and `thickness` up: the blade of a knife or a sword. */
const plate = (kit: ModelKit, parent: Parent, profile: ReadonlyArray<readonly [number, number]>, thickness: number, y: number, material: THREE_NS.Material): THREE_NS.Mesh => {
  const shape = new kit.THREE.Shape()
  profile.forEach(([x, z], index) => (index === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)))
  const mesh = new kit.THREE.Mesh(new kit.THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false }), material)
  mesh.rotation.x = -QUARTER
  mesh.position.y = y
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

// The KA-BAR as the reference photo shows it (Wikimedia Commons, KA-BAR.jpg): the USMC Mk 2, 302 mm overall, a 7 in clip-point blade with its fuller, a steel crossguard, eleven
// leather washers and a steel pommel. Metres, the blade along +x, lying flat with the blade width along z.
const kabar: MeleeBuilder = (kit, group) => {
  const { M, box, cylinderX } = kit
  const axis = 0.0175
  cylinderX(group, 0.02, 0.016, M.metal, 0.008, axis, 0, 18)
  for (let index = 0; index < 11; index++) cylinderX(group, 0.0175, 0.01, index % 2 === 0 ? M.bake : M.dark, 0.016 + 0.005 + index * 0.01, axis, 0, 16)
  box(group, 0.007, 0.012, 0.052, M.metal, 0.1325, axis, 0)
  box(group, 0.012, 0.012, 0.004, M.metal, 0.136, axis, 0.026)
  box(group, 0.012, 0.012, 0.004, M.metal, 0.136, axis, -0.026)
  plate(kit, group, [[0.136, -0.0165], [0.248, -0.0165], [0.272, -0.0135], [0.2995, -0.006], [0.3, -0.001], [0.282, 0.008], [0.255, 0.0165], [0.136, 0.0165]], 0.0045, axis - 0.00225, M.metal)
  box(group, 0.095, 0.0016, 0.0045, M.dark, 0.19, axis + 0.0023, 0.006)
  return { handle: [0.07, axis, 0] }
}

const SORI = 0.018
const KATANA_TIP = 0.98
const KATANA_ROOT = 0.3
const SAMPLES = 24

// the spine bows by `SORI` at the middle of the blade (the blade is 70 cm of the 98), narrowing from 30 mm at the root to the point
const bow = (t: number): number => SORI * 4 * t * (1 - t)
const halfWidth = (t: number): number => 0.0155 - 0.006 * t

// The katana as the reference photo shows it (Wikimedia Commons, "Antique Japanese (samurai) katana met museum.jpg"): a 70 cm single-edged curved blade, a round iron tsuba, a brass habaki
// and a long oval handle wrapped in cord with its pommel cap, 98 cm in all; held with both hands on the handle.
const katana: MeleeBuilder = (kit, group) => {
  const { M, box, cylinderX } = kit
  const axis = 0.0135
  const wrap = kit.pivot(group)
  const handle = cylinderX(wrap, 0.0135, 0.25, M.lens, 0.145, axis, 0)
  handle.scale.set(1, 1, 1.18)
  for (let index = 0; index < 11; index++) {
    const band = cylinderX(wrap, 0.0142, 0.005, M.white, 0.034 + index * 0.02, axis, 0)
    band.scale.set(1, 1, 1.18)
  }
  const cap = cylinderX(group, 0.0155, 0.016, M.brass, 0.008, axis, 0)
  cap.scale.set(1, 1, 1.18)
  cylinderX(group, 0.04, 0.007, M.metal, 0.2735, axis, 0, 32)
  cylinderX(group, 0.0405, 0.0045, M.copper, 0.2735, axis, 0, 32)
  box(group, 0.022, 0.012, 0.03, M.brass, 0.29, axis, 0)
  box(group, 0.012, 0.007, 0.012, M.brass, 0.135, axis + 0.011, 0.012)
  const edge: Array<[number, number]> = []
  const spine: Array<[number, number]> = []
  for (let index = 0; index <= SAMPLES; index++) {
    const t = index / SAMPLES
    const x = KATANA_ROOT + t * (KATANA_TIP - KATANA_ROOT - 0.025)
    edge.push([x, bow(t) - halfWidth(t)])
    spine.push([x, bow(t) + halfWidth(t)])
  }
  const tip: [number, number] = [KATANA_TIP, bow(1) + 0.004]
  plate(kit, group, [...edge, tip, ...spine.reverse()], 0.0055, axis - 0.00275, M.steelL)
  return { handle: [0.2, axis, 0], support: [0.07, axis, 0] }
}

const RING_Z = [-0.0455, -0.0155, 0.0155, 0.0455] as const

// The brass knuckles as the reference photo shows them (Wikimedia Commons, "Brass knuckles-P5120192-white.jpg"): four finger rings in a row, the outer two a little smaller, joined by the bar the
// palm closes on. Worn: the ring row across z and the rings' axis along x, the way the punch goes; standing on the bottom of the rings.
const brassKnuckles: MeleeBuilder = (kit, group) => {
  const { M, box, cylinderZ, torus, THREE } = kit
  const centre = 0.0195
  RING_Z.forEach((z, index) => {
    const outer = index === 0 || index === 3
    const ring = torus(group, new THREE.TorusGeometry(outer ? 0.0118 : 0.0135, 0.0052, 10, 22), M.brass, 0.012, centre, z)
    ring.rotation.y = QUARTER
  })
  for (const z of [-0.03, 0, 0.03]) box(group, 0.014, 0.018, 0.008, M.brass, 0.012, centre, z)
  box(group, 0.012, 0.007, 0.13, M.brass, 0.012, centre + 0.0145, 0)
  cylinderZ(group, 0.0068, 0.116, M.brass, -0.012, centre + 0.002, 0, 14)
  for (const z of [-0.056, -0.019, 0.019, 0.056]) box(group, 0.026, 0.01, 0.008, M.brass, 0.0, centre + 0.002, z)
  return { handle: [-0.012, centre, 0] }
}

const BUILDERS: Readonly<Record<string, MeleeBuilder>> = {
  kabar,
  katana,
  brass_knuckles: brassKnuckles,
}

/** The weapon ids of the melee weapons this module draws. */
export const MELEE_MODEL_IDS: readonly string[] = Object.keys(BUILDERS)

export const hasMeleeModel = (weaponId: string): boolean => weaponId in BUILDERS

/**
 * The model of a melee weapon lying as the item models of a weapon do: the long axis along +x with the head at +x, the underside on y = 0, centred on x and z, an empty `handle` where the
 * (right) hand closes and, for a two-hand weapon, a `support` where the other one does. Undefined for a weapon this module did not draw.
 */
export function buildMeleeModel(THREE: typeof THREE_NS, weaponId: string): THREE_NS.Group | undefined {
  const builder = BUILDERS[weaponId]
  if (!builder) return undefined
  const kit = modelKit(THREE)
  const inner = kit.group()
  const marks = builder(kit, inner)
  inner.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(inner)
  const centre = box.getCenter(new THREE.Vector3())
  inner.position.set(-centre.x, -box.min.y, -centre.z)
  const group = markKitOrigin(kit.group(), { owner: 'game-weapons-three', kind: 'weapon', id: weaponId })
  group.name = weaponId
  group.add(inner)
  const mark = (name: string, at: readonly [number, number, number]): void => {
    const object = kit.mark(group, at[0] + inner.position.x, at[1] + inner.position.y, at[2] + inner.position.z)
    object.name = name
  }
  mark('handle', marks.handle)
  if (marks.support) mark('support', marks.support)
  return group
}
