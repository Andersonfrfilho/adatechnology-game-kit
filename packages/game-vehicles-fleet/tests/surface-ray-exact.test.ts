import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import type { VehicleDestructible, VehicleDestructibleOptions, VehicleItem } from '@adatechnology/game-vehicles'
import type { SurfaceRay, SurfaceRayHit, Vec3 } from '@adatechnology/game-contracts'
import { makeFleetKit } from './helpers/kit'

const MODEL = 'midsize_sedan'
const RAYS_PER_STATE = 1500
const SHOT = { type: 'ballistic', energy: 527, caliber: 9 } as const

/** A small deterministic generator: the same rays on every run. */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

type Rig = { item: VehicleItem; d: VehicleDestructible; options: VehicleDestructibleOptions; scene: THREE.Scene }

function rig(): Rig {
  const kit = makeFleetKit('en')
  const item = buildVehicleItem(kit, MODEL)
  const scene = new THREE.Scene()
  item.root.position.set(3, 0.2, -2)
  item.root.rotation.y = 0.6
  scene.add(item.root)
  // read at each ray: flipping it compares the index with three.js on the very same scene
  const options: VehicleDestructibleOptions = { id: `${MODEL}_1`, frame: item.root }
  const d = createVehicleDestructible(kit, item.vehicle, options)
  scene.updateMatrixWorld(true)
  return { item, d, options, scene }
}

/** Rays from a shell around the drawn car (not its flying effects) towards points inside its box (most cross it), some short, some from inside, some skipping parts. */
function raysAround(scene: THREE.Object3D, root: THREE.Object3D, count: number, seed: number): SurfaceRay[] {
  scene.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const centre = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const next = rng(seed)
  const rays: SurfaceRay[] = []
  for (let i = 0; i < count; i++) {
    const target = new THREE.Vector3(box.min.x + next() * size.x, box.min.y + next() * size.y, box.min.z + next() * size.z)
    const away = new THREE.Vector3(next() - 0.5, next() - 0.5, next() - 0.5).normalize()
    const origin = i % 10 === 0 ? centre.clone().add(new THREE.Vector3(next() - 0.5, next() * 0.4, next() - 0.5)) : centre.clone().addScaledVector(away, 3 + next() * 4)
    const direction = target.sub(origin).normalize()
    if (direction.lengthSq() === 0) continue
    const maxDistance = i % 7 === 0 ? 0.5 + next() * 3 : 30
    const ray: SurfaceRay = { origin: origin.toArray() as Vec3, direction: direction.toArray() as Vec3, maxDistance }
    rays.push(i % 11 === 0 ? { ...ray, ignored: (part: string) => /door|glass|window/.test(part) } : ray)
  }
  return rays
}

function compare(r: Rig, seed: number): { hits: number; parts: Set<string> } {
  const rays = raysAround(r.scene, r.item.vehicle.vehicle, RAYS_PER_STATE, seed)
  let hits = 0
  const parts = new Set<string>()
  for (const ray of rays) {
    r.options.bruteForceRays = true
    const expected: SurfaceRayHit | null = r.d.surfaceRay!(ray)
    r.options.bruteForceRays = false
    const got = r.d.surfaceRay!(ray)
    expect(got).toEqual(expected)
    if (got) {
      hits++
      parts.add(got.part)
    }
  }
  return { hits, parts }
}

function openEverything(r: Rig): number {
  let opened = 0
  for (const clip of r.d.animations()) {
    const last = clip.keys.at(-1)?.parts ?? {}
    for (const [name, pose] of Object.entries(last)) {
      const pivot = r.item.vehicle.vehicle.getObjectByName(name)
      if (!pivot || !pose.rotation) continue
      pivot.rotation.set(...(pose.rotation as [number, number, number]))
      opened++
    }
  }
  return opened
}

function damage(r: Rig): void {
  const d = r.d
  for (const part of ['windshield', 'door_front_left', 'door_rear_right', 'hood', 'bumper_rear']) {
    if (!d.describe().parts.some((p) => p.id === part)) continue
    const at = d.partWorldCenter(part)
    const from: Vec3 = [at[0], at[1] + 2, at[2] + 2]
    const dir = new THREE.Vector3(at[0] - from[0], at[1] - from[1], at[2] - from[2]).normalize()
    const hit = d.surfaceRay!({ origin: from, direction: dir.toArray() as Vec3, maxDistance: 10 })
    if (hit) d.hit({ ...SHOT, point: hit.point, part: hit.part, normal: hit.normal, direction: dir.toArray() as Vec3 })
  }
  d.hit({ type: 'blunt', point: d.partWorldCenter('bumper_front'), direction: [-1, 0, 0], energy: 30000, radius: 0.5 })
  const centre = d.partWorldCenter('hood')
  d.hit({ type: 'explosive', point: [centre[0] + 1.5, 0.3, centre[2] + 1.5], energy: 60000, radius: 4 })
  for (let i = 0; i < 5; i++) d.update!(0.1)
}

describe('surfaceRay through the triangle index', () => {
  it('answers every ray as three.js does (part, point, normal and distance), intact, damaged, posed and moved', () => {
    const r = rig()
    const intact = compare(r, 11)
    damage(r)
    const damaged = compare(r, 12)
    expect(openEverything(r)).toBeGreaterThan(2)
    for (const wheel of r.item.vehicle.wheels) wheel.rotation.x += 0.9
    const posed = compare(r, 13)
    r.item.root.position.x -= 1.2
    r.item.root.rotation.y += 0.4
    const moved = compare(r, 14)
    // the rays really test the car: most hit, over many parts
    for (const state of [intact, damaged, posed, moved]) {
      expect(state.hits).toBeGreaterThan(RAYS_PER_STATE / 4)
      expect(state.parts.size).toBeGreaterThan(10)
    }
  })

  it('follows every change without an update from the host: moved, posed, door open, wheel turned, damaged', () => {
    const r = rig()
    const rays = raysAround(r.scene, r.item.vehicle.vehicle, 200, 21)
    const mutations: Array<() => void> = [
      () => r.item.root.position.set(1, 0, 1),
      () => (r.item.root.rotation.y += 0.8),
      () => openEverything(r),
      () => r.item.vehicle.wheels.forEach((wheel) => (wheel.rotation.x += 1.3)),
      () => damage(r),
    ]
    for (const mutate of mutations) {
      mutate()
      // no updateMatrixWorld here: the ray must see the change by itself
      const got = rays.map((ray) => r.d.surfaceRay!(ray))
      r.scene.updateMatrixWorld(true)
      r.options.bruteForceRays = true
      const expected = rays.map((ray) => r.d.surfaceRay!(ray))
      r.options.bruteForceRays = false
      expect(got).toEqual(expected)
    }
  })

  it('leaves the effects of the vehicle (sparks, shards, debris) to the renderer', () => {
    const r = rig()
    const spark = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), new THREE.MeshBasicMaterial())
    r.item.vehicle.effects.add(spark)
    const rays = raysAround(r.scene, r.item.vehicle.vehicle, 50, 31)
    let updates = 0
    const update = spark.updateWorldMatrix.bind(spark)
    spark.updateWorldMatrix = (parents: boolean, children: boolean) => {
      updates++
      update(parents, children)
    }
    for (const ray of rays) r.d.surfaceRay!(ray)
    expect(updates).toBe(0)
    spark.geometry.dispose()
    ;(spark.material as THREE.Material).dispose()
  })

  it('is faster than testing every triangle (timing, not a gate)', () => {
    const r = rig()
    damage(r)
    const rays = raysAround(r.scene, r.item.vehicle.vehicle, 100, 41)
    const time = (brute: boolean): number => {
      r.options.bruteForceRays = brute
      const start = performance.now()
      for (const ray of rays) r.d.surfaceRay!(ray)
      return performance.now() - start
    }
    const firstIndexed = time(false)
    const brute = time(true)
    const indexed = time(false)
    r.options.bruteForceRays = false
    console.info(`surfaceRay, 100 rays at the ${MODEL}: three.js ${brute.toFixed(1)} ms, index ${indexed.toFixed(1)} ms (first pass, building the index: ${firstIndexed.toFixed(1)} ms)`)
    expect(indexed).toBeGreaterThan(0)
  })
})
