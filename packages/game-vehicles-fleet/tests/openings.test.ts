import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible, openEdgeCount } from '@adatechnology/game-vehicles'
import type { VehicleKit } from '@adatechnology/game-vehicles'
import { makeFleetKit } from './helpers/kit'

/** Cars of the fleet built the same way (a sedan, hatches, a fastback, a beetle with curved doors, an SUV and a pickup). */
const CARS = ['midsize_sedan', 'compact_hatch', 'fastback_sedan', 'beetle', 'midsize_suv', 'midsize_pickup'] as const
/** A part of the model within a door's zone and no larger than this, metres, belongs to the door. */
const DOOR_PART_MARGIN = 0.03
const DOOR_PART_SIZE = 0.3
/** Edges a T-junction of the body's cut may leave unmatched in a closed opening. */
const OPEN_EDGES_AT_A_JUNCTION = 2
/** An edge shorter than this, metres, is a sliver of the cut: no gap one could see. */
const SLIVER = 0.001

type ZoneBox = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
type Zone = { id: string; box: ZoneBox; side: number }
type Pose = { rotation?: [number, number, number] }
type Clip = { id: string; keys: Array<{ parts: Record<string, Pose> }> }

function build(kit: VehicleKit, key: string) {
  const item = buildVehicleItem(kit, key)
  const d = createVehicleDestructible(kit, item.vehicle, { id: `${key}_openings`, frame: item.root })
  const vehicle = d.vehicle.vehicle as THREE.Object3D
  const zones = (kit as unknown as { zonesOf(c: unknown): Zone[] }).zonesOf(d.vehicle)
  const clips = d.animations() as unknown as Clip[]
  const openPose = (clip: string): Record<string, Pose> => clips.find((c) => c.id === clip)?.keys.at(-1)?.parts ?? {}
  return { item, d, vehicle, zones, openPose }
}

const meshesUnder = (root: THREE.Object3D): THREE.Mesh[] => {
  const out: THREE.Mesh[] = []
  root.traverseVisible((o: THREE.Object3D) => {
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh)
  })
  return out
}

function trianglesIn(meshes: THREE.Mesh[], frame: THREE.Object3D): number[] {
  const inverse = new THREE.Matrix4().copy(frame.matrixWorld).invert()
  const out: number[] = []
  const v = new THREE.Vector3()
  for (const mesh of meshes) {
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry
    const m = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)
    const p = g.getAttribute('position')
    for (let i = 0; i < p.count; i++) out.push(...v.fromBufferAttribute(p, i).applyMatrix4(m).toArray())
  }
  return out
}

const boxIn = (mesh: THREE.Object3D, frame: THREE.Object3D): THREE.Box3 => new THREE.Box3().setFromObject(mesh).applyMatrix4(new THREE.Matrix4().copy(frame.matrixWorld).invert())

const isUnder = (o: THREE.Object3D, root: THREE.Object3D): boolean => {
  for (let q: THREE.Object3D | null = o; q; q = q.parent) if (q === root) return true
  return false
}

/** The small parts the model draws inside a door's zone that are not on its hinge yet. */
function partsInside(vehicle: THREE.Object3D, piv: THREE.Object3D, B: ZoneBox): THREE.Mesh[] {
  return meshesUnder(vehicle).filter((m) => {
    if (isUnder(m, piv) || m.userData.decal || m.userData.glass) return false
    const box = boxIn(m, vehicle)
    const c = box.getCenter(new THREE.Vector3())
    const s = box.getSize(new THREE.Vector3())
    const within = c.x > B.x0 + DOOR_PART_MARGIN && c.x < B.x1 - DOOR_PART_MARGIN && c.y > B.y0 + DOOR_PART_MARGIN && c.y < B.y1 - DOOR_PART_MARGIN && c.z > B.z0 + DOOR_PART_MARGIN && c.z < B.z1 - DOOR_PART_MARGIN
    return within && Math.max(s.x, s.y, s.z) <= DOOR_PART_SIZE
  })
}

describe('doors and lids of the fleet open as whole parts', () => {
  const kit = makeFleetKit('en')
  for (const key of CARS) {
    it(`${key}: every door and the lid are closed volumes that take every part of theirs with them`, () => {
      const { item, d, vehicle, zones, openPose } = build(kit, key)
      const poses = { ...openPose('open_doors'), ...openPose('open_trunk') }
      expect(Object.keys(poses).length, key).toBeGreaterThan(0)
      for (const [id, pose] of Object.entries(poses)) {
        const piv = item.root.getObjectByName(id)!
        const B = zones.find((z) => z.id === id)!.box
        const side = zones.find((z) => z.id === id)!.side
        item.root.updateMatrixWorld(true)
        const inside = id.startsWith('door_') ? partsInside(vehicle, piv, B) : []
        piv.rotation.set(...(pose.rotation ?? [0, 0, 0]))
        item.root.updateMatrixWorld(true)
        // nothing of the door stays in the air where it was: every one of those parts now turns with it
        expect(inside.filter((m) => !isUnder(m, piv)).map((m) => `${m.geometry.type}#${(m.material as THREE.MeshStandardMaterial).color?.getHexString()}`), `${key} ${id}`).toEqual([])
        const hung = meshesUnder(piv)
        const fold = hung.filter((m) => m.userData.doorShell === 'fold')
        const inner = hung.filter((m) => m.userData.doorShell === 'inner')
        expect([fold.length, inner.length], `${key} ${id}`).toEqual([1, 1])
        for (const m of hung) expect(m.material, `${key} ${id}`).toBeTruthy()
        const open = new THREE.Box3()
        for (const m of hung) open.union(boxIn(m, vehicle))
        piv.rotation.set(0, 0, 0)
        item.root.updateMatrixWorld(true)
        const skin = hung.filter((m) => m.userData.doorSkin)
        // the skin, the fold and the inner panel close a volume: no face of the opening is left open (a T-junction the body's cut leaves in the
        // skin can leave one edge pair of the fold unmatched, never a side)
        expect(openEdgeCount(trianglesIn([...skin, ...fold, ...inner], vehicle), SLIVER), `${key} ${id}`).toBeLessThanOrEqual(OPEN_EDGES_AT_A_JUNCTION)
        if (id === 'lid') {
          // the lid hinges on the front edge of its top and lifts up: its far, lowest edge rises (a tailgate also swings out over the bumper)
          expect(piv.position.x, key).toBeGreaterThan(B.x1 - 0.06)
          expect(piv.position.y, key).toBeGreaterThan(B.y1 - 0.06)
          const shut = new THREE.Box3()
          for (const m of hung) shut.union(boxIn(m, vehicle))
          expect(open.max.y - shut.max.y, key).toBeGreaterThan(0.3)
          expect(open.min.y - shut.min.y, key).toBeGreaterThan(0.2)
          // the trunk under it is lined: a tub and a seal
          expect(meshesUnder(vehicle).filter((m) => m.userData.trunkBay).length, key).toBeGreaterThanOrEqual(2)
          continue
        }
        if (!id.includes('rear')) continue
        // a rear door stops at the wheel arch: none of its skin is over the rear wheel, which stays in its wheel house on the body
        const wheel = new THREE.Vector3(...d.partWorldCenter(`tyre_rear_${side < 0 ? 'left' : 'right'}`)).applyMatrix4(new THREE.Matrix4().copy(vehicle.matrixWorld).invert())
        const points = trianglesIn(skin, vehicle)
        let overWheel = 0
        for (let k = 0; k < points.length; k += 3) if (Math.hypot(points[k]! - wheel.x, points[k + 1]! - wheel.y) < 0.26) overWheel++
        expect(overWheel, `${key} ${id}`).toBe(0)
      }
    }, 60000)
  }
})
