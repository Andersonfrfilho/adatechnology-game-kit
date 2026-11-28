import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import { makeFleetKit } from './helpers/kit'

type Vec3 = [number, number, number]

/** The midsize sedan with its front left door square to the shooter: the door's middle, its normal (out) and the destructible. */
function sedan() {
  const kit = makeFleetKit('en')
  const item = buildVehicleItem(kit, 'midsize_sedan')
  const d = createVehicleDestructible(kit, item.vehicle, { id: 'sedan_1', frame: item.root })
  item.root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(item.root)
  const centre = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const out = size.x > size.z ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(-1, 0, 0)
  const ray = (origin: THREE.Vector3, direction: THREE.Vector3) => d.surfaceRay!({ origin: origin.toArray() as Vec3, direction: direction.toArray() as Vec3, maxDistance: 10 })
  const target = centre.clone().setY(box.min.y + size.y * 0.42)
  const hit = ray(target.clone().addScaledVector(out, 4), out.clone().negate())!
  return { item, d, hit, out, ray }
}

/** How deep the skin goes in at a point of the door, against the plane of the first hit (the panel's normal there): a ray along the normal back to the skin. */
const depthAt = (s: ReturnType<typeof sedan>, offset: THREE.Vector3): number => {
  const n = new THREE.Vector3(...s.hit.normal).normalize()
  const at = new THREE.Vector3(...s.hit.point).add(offset).addScaledVector(n, 0.05)
  const back = s.ray(at, n.clone().negate())
  return back ? back.distance - 0.05 : NaN
}

/** The marks (decal instances) the vehicle holds, each with its world matrix. */
function marks(root: THREE.Object3D): THREE.Matrix4[] {
  const all: THREE.Matrix4[] = []
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    if (!(o instanceof THREE.InstancedMesh) || !o.userData.decal) return
    for (let i = 0; i < o.count; i++) {
      const m = new THREE.Matrix4()
      o.getMatrixAt(i, m)
      all.push(m.premultiply(o.matrixWorld))
    }
  })
  return all
}

describe('blows and rounds on the car body show where they landed, outside and inside', () => {
  it('a punch presses a small dent into the door, a kick a deeper one: the sheet moves in at the hit and not a hand away', () => {
    const s = sedan()
    const away = new THREE.Vector3(0, 0.2, 0)
    const before = depthAt(s, new THREE.Vector3())
    const beforeAway = depthAt(s, away)
    s.d.hit({ type: 'blunt', point: s.hit.point, direction: s.out.clone().negate().toArray() as Vec3, energy: 25, radius: 0.1 })
    const punched = depthAt(s, new THREE.Vector3())
    expect(punched - before).toBeGreaterThan(0.002)
    expect(Math.abs(depthAt(s, away) - beforeAway)).toBeLessThan(0.0005)
    s.d.hit({ type: 'blunt', point: s.hit.point, direction: s.out.clone().negate().toArray() as Vec3, energy: 250, radius: 0.08 })
    expect(depthAt(s, new THREE.Vector3()) - punched).toBeGreaterThan(0.004)
  })

  it('a bat swung level leaves a crease along its barrel: long across the swing, narrow up and down', () => {
    const s = sedan()
    const sweep = new THREE.Vector3(0, 0, 0).crossVectors(s.out, new THREE.Vector3(0, 1, 0)).normalize()
    const before = [depthAt(s, sweep.clone().multiplyScalar(0.1)), depthAt(s, new THREE.Vector3(0, 0.1, 0))]
    s.d.hit({ type: 'blunt', point: s.hit.point, direction: s.out.clone().negate().toArray() as Vec3, energy: 150, radius: 0.1, contactLength: 0.3, sweep: sweep.toArray() as Vec3 })
    const alongBarrel = depthAt(s, sweep.clone().multiplyScalar(0.1)) - before[0]!
    const across = depthAt(s, new THREE.Vector3(0, 0.1, 0)) - before[1]!
    expect(alongBarrel).toBeGreaterThan(0.002)
    expect(across).toBeLessThan(alongBarrel / 3)
  })

  it('a blade leaves a long mark along its swing, lying on the panel', () => {
    const s = sedan()
    const sweep = new THREE.Vector3(0, -1, 0)
    const before = marks(s.item.root).length
    s.d.hit({ type: 'slash', point: s.hit.point, direction: s.out.clone().negate().toArray() as Vec3, energy: 140, radius: 0.06, sweep: sweep.toArray() as Vec3 })
    const all = marks(s.item.root)
    expect(all.length).toBe(before + 1)
    const mark = all[all.length - 1]!
    const along = new THREE.Vector3().setFromMatrixColumn(mark, 0)
    const across = new THREE.Vector3().setFromMatrixColumn(mark, 1)
    const facing = new THREE.Vector3().setFromMatrixColumn(mark, 2).normalize()
    expect(along.length() / across.length()).toBeGreaterThan(5)
    expect(Math.abs(along.normalize().dot(sweep))).toBeGreaterThan(0.9)
    expect(facing.dot(new THREE.Vector3(...s.hit.normal))).toBeGreaterThan(0.99)
  })

  it('a round through the door leaves its exit on the inside of the sheet, facing in, and a hole through what stands behind it', () => {
    const s = sedan()
    const before = marks(s.item.root).length
    s.d.hit({ type: 'ballistic', point: s.hit.point, part: s.hit.part, normal: s.hit.normal, direction: s.out.clone().negate().toArray() as Vec3, energy: 1700, caliber: 5.7 })
    const added = marks(s.item.root).slice(before)
    const n = new THREE.Vector3(...s.hit.normal).normalize()
    const facings = added.map((m) => new THREE.Vector3().setFromMatrixColumn(m, 2).normalize().dot(n))
    // the entry faces out; the exit on the inside of the sheet faces in, at the same spot
    expect(facings.some((f) => f > 0.99)).toBe(true)
    expect(facings.some((f) => f < -0.99)).toBe(true)
    const entry = new THREE.Vector3().setFromMatrixPosition(added[0]!)
    const exit = added.map((m) => new THREE.Vector3().setFromMatrixPosition(m)).find((p, i) => facings[i]! < -0.99)!
    expect(entry.distanceTo(exit)).toBeLessThan(0.01)
    // and the door's card behind the sheet: its entry facing the round, its exit facing the cabin, a few centimetres in
    expect(added.length).toBe(4)
    const deeper = added.map((m) => new THREE.Vector3().setFromMatrixPosition(m)).filter((p) => p.distanceTo(entry) > 0.03)
    expect(deeper).toHaveLength(2)
  })
})
