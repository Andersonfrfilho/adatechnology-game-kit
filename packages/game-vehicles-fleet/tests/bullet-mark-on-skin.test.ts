import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import { makeFleetKit } from './helpers/kit'

/** Cars with curved sides (doors, fenders, rear quarters) that the owner shot from a slant and saw marks hanging in the air off the panel. */
const MODELS = ['midsize_sedan', 'beetle', 'compact_hatch', 'family_hatch', 'midsize_pickup', 'fastback_sedan'] as const
/** The rim of a mark lies within this of the drawn skin, metres: the mark lies on the panel, not off it in the air nor under it. */
const RIM_GAP = 0.0035
/** A mark faces out along the panel's own normal at the hit (|cos| of the angle between them). */
const FACING = 0.999
/** A rim may dip this far under the skin, metres: a facet or a crease rising beside the hit (the disc lies 1 mm off the plane of the hit). */
const RIM_SINK = 0.0006
const RIM_SAMPLES = 24
const PROBE = 0.02
const SHOT = { type: 'ballistic', energy: 500, caliber: 9 } as const

type Mark = { readonly matrix: THREE.Matrix4 }

/** The decal batches under the vehicle and how many marks each holds, to find the mark the next round adds. */
function markCounts(root: THREE.Object3D): Map<THREE.InstancedMesh, number> {
  const counts = new Map<THREE.InstancedMesh, number>()
  root.traverse((o) => {
    if (o instanceof THREE.InstancedMesh && o.userData.decal) counts.set(o, o.count)
  })
  return counts
}

/** The world matrix of the entry mark a round just added: of the marks it added (its entry, and through a door its exit and the hole in the card), the one facing out along `normal`. */
function newMark(root: THREE.Object3D, before: Map<THREE.InstancedMesh, number>, normal: THREE.Vector3): Mark | undefined {
  root.updateMatrixWorld(true)
  let best: Mark | undefined
  let facing = -Infinity
  for (const [batch, count] of markCounts(root)) {
    for (let i = before.get(batch) ?? 0; i < count; i++) {
      const matrix = new THREE.Matrix4()
      batch.getMatrixAt(i, matrix)
      matrix.premultiply(batch.matrixWorld)
      const dot = new THREE.Vector3().setFromMatrixColumn(matrix, 2).normalize().dot(normal)
      if (dot > facing) {
        facing = dot
        best = { matrix }
      }
    }
  }
  return best
}

/** Rounds from a slant (from the front and from above, as the owner shot) at the side panels of one model: what each mark does wrong. */
function auditModel(key: string): string[] {
  const problems: string[] = []
  const kit = makeFleetKit('en')
  const item = buildVehicleItem(kit, key)
  const d = createVehicleDestructible(kit, item.vehicle, { id: `${key}_1`, frame: item.root })
  item.root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(item.root)
  const centre = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const along = size.x > size.z ? 'x' : 'z'
  const out = along === 'x' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(-1, 0, 0)
  const forward = along === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1)
  const ray = (origin: THREE.Vector3, direction: THREE.Vector3, maxDistance = 30) =>
    d.surfaceRay!({ origin: origin.toArray() as [number, number, number], direction: direction.toArray() as [number, number, number], maxDistance })
  for (let i = 0; i < 18; i++) {
    const target = centre.clone().addScaledVector(forward, ((i % 6) / 5 - 0.5) * size[along] * 0.8)
    target.y = box.min.y + (0.3 + Math.floor(i / 6) * 0.15) * size.y
    target.addScaledVector(out, -0.2)
    // in from the side, from ahead and from above: a slant on a curved panel
    const direction = out.clone().negate().addScaledVector(forward, -0.6).add(new THREE.Vector3(0, -0.3, 0)).normalize()
    const hit = ray(target.clone().addScaledVector(direction, -4), direction)
    if (!hit || /glass|window|windshield|tyre|wheel|light|mirror/.test(hit.part)) continue
    const before = markCounts(item.root)
    d.hit({ ...SHOT, point: hit.point, part: hit.part, normal: hit.normal, direction: direction.toArray() as [number, number, number] })
    const mark = newMark(item.root, before, new THREE.Vector3(...hit.normal).normalize())
    if (!mark) continue
    const where = `${hit.part} at ${hit.point.map((v) => v.toFixed(2)).join(', ')}`
    const normal = new THREE.Vector3(...hit.normal).normalize()
    const facing = new THREE.Vector3().setFromMatrixColumn(mark.matrix, 2).normalize()
    if (facing.dot(normal) < FACING) problems.push(`${where}: the mark faces ${facing.toArray().map((v) => v.toFixed(2))}, the panel ${normal.toArray().map((v) => v.toFixed(2))}`)
    // a round in through a gap that met a layer under the skin (the inner sheet of a door): the skin over it hides the mark, nothing hangs in the air
    const over = ray(new THREE.Vector3(...hit.point).addScaledVector(normal, PROBE), normal.clone().negate(), PROBE * 4)
    if (over && over.distance < PROBE - RIM_SINK) continue
    for (let k = 0; k < RIM_SAMPLES; k++) {
      const a = (k / RIM_SAMPLES) * Math.PI * 2
      const rim = new THREE.Vector3(Math.cos(a), Math.sin(a), 0).applyMatrix4(mark.matrix)
      const back = ray(rim.clone().addScaledVector(normal, PROBE), normal.clone().negate(), PROBE * 4)
      const gap = back ? back.distance - PROBE : Infinity
      if (gap < -RIM_SINK || gap > RIM_GAP) {
        problems.push(`${where}: the rim stands ${Number.isFinite(gap) ? (gap * 1000).toFixed(1) + ' mm' : 'in the air'} off the skin`)
        break
      }
    }
  }
  return problems
}

describe('a bullet mark lies on the car body: on the drawn skin, facing out along its normal, never hanging off a curved panel or an edge', () => {
  for (const key of MODELS) {
    it(key, () => {
      expect(auditModel(key)).toEqual([])
    })
  }
})
