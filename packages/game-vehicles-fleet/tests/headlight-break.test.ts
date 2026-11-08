import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import type { VehicleContext } from '@adatechnology/game-vehicles'
import { makeFleetKit } from './helpers/kit'

/** A headlight breaks by the material of its lens: glass shatters at once, polycarbonate takes holes and cracks first. Its bulbs go dark when a round reaches them. */
type Lamp = { kind: string; lens: Array<{ visible: boolean; material: unknown }>; inner: Array<{ material: unknown }>; broken: boolean | string; dark?: boolean; cracked?: boolean }

const PISTOL = { type: 'ballistic', energy: 527, caliber: 9 } as const

function car(key: string) {
  const kit = makeFleetKit('en')
  const item = buildVehicleItem(kit, key)
  const d = createVehicleDestructible(kit, item.vehicle, { id: `${key}_1`, frame: item.root })
  item.root.updateMatrixWorld(true)
  const c = item.vehicle as VehicleContext
  const bulbBroken = (kit as unknown as { _: { MATERIALS: { bulbBroken: unknown } } })._.MATERIALS.bulbBroken
  const part = d.describe().parts.find((p) => p.id === 'headlight_left')!
  const at = d.partWorldCenter!('headlight_left')
  // a round at the lens, from in front of the car or from its side, wherever the surface ray reaches it
  const shot = () => {
    const hit = d.surfaceRay!({ origin: [at[0] + 3, at[1], at[2]], direction: [-1, 0, 0], maxDistance: 10 }) ?? d.surfaceRay!({ origin: [at[0], at[1], at[2] + 3], direction: [0, 0, -1], maxDistance: 10 })
    expect(hit?.part).toBe('headlight_left')
    return d.hit({ ...PISTOL, point: hit!.point, part: hit!.part, normal: hit!.normal, direction: [-1, 0, 0] })
  }
  /** The lamp of the part: the one its zone draws. */
  const lampOf = (): Lamp => {
    const zone = (kit as unknown as { zonesOf(c: unknown): Array<{ id: string; lights: Lamp[] }> }).zonesOf(c).find((z) => z.id === 'headlight_left')!
    return zone.lights[0]!
  }
  return { d, part, shot, lamp: lampOf, bulbBroken }
}

describe('a headlight hit', () => {
  it('of polycarbonate (a modern car) takes a hole, cracks and goes dark, and comes apart after a few rounds', () => {
    const { part, shot, lamp, bulbBroken } = car('midsize_sedan')
    expect(part.material).toBe('plastic')
    expect(part.tags).toContain('lens_polycarbonate')
    const first = shot()
    expect(first.some((e) => e.type === 'hole')).toBe(true)
    expect(first.some((e) => e.type === 'fracture')).toBe(false)
    const L = lamp()
    expect(L.cracked).toBe(true)
    expect(L.lens.every((m) => m.visible)).toBe(true)
    // the round went through to the bulb: no light, no glow
    expect(L.inner.every((m) => m.material === bulbBroken)).toBe(true)
    let broke = false
    for (let i = 0; i < 4 && !broke; i++) broke = shot().some((e) => e.type === 'fracture')
    expect(broke).toBe(true)
    expect(L.broken).toBeTruthy()
    // the lens is gone but for its jagged edge in the bezel
    expect(L.lens.every((m) => !m.visible || (m as unknown as { userData: { lensRim?: boolean } }).userData.lensRim)).toBe(true)
  })
  it('of glass (an older car) shatters at the first round and goes dark', () => {
    const { part, shot, lamp, bulbBroken } = car('beetle')
    expect(part.material).toBe('glass')
    expect(shot().some((e) => e.type === 'fracture')).toBe(true)
    const L = lamp()
    expect(L.broken).toBeTruthy()
    expect(L.inner.every((m) => m.material === bulbBroken)).toBe(true)
  })
  it('by a blow: a kick shatters glass and only cracks polycarbonate, which stays lit', () => {
    const kick = { type: 'blunt', energy: 300, radius: 0.08 } as const
    const glass = car('beetle')
    const g = glass.d.hit({ ...kick, point: glass.d.partWorldCenter!('headlight_left') })
    expect(g.some((e) => e.type === 'fracture' && 'part' in e && e.part === 'headlight_left')).toBe(true)
    const plastic = car('midsize_sedan')
    const p = plastic.d.hit({ ...kick, point: plastic.d.partWorldCenter!('headlight_left') })
    expect(p.some((e) => e.type === 'fracture' && 'part' in e && e.part === 'headlight_left')).toBe(false)
    const L = plastic.lamp()
    expect(L.cracked).toBe(true)
    expect(L.inner.some((m) => m.material !== plastic.bulbBroken)).toBe(true)
  })
})

/**
 * A headlight a round put out reads as a dead lamp, not a lit one. The kit draws its lamps lit; with the bulb dark, what is left in the unit must not keep the look:
 * the chrome reflector lit by the scene and a cracked lens turned a smooth near-white pane read as a lamp still shining (owner, 2026-11-08).
 */
const LOOKS_LIT = { mirrorMetalness: 0.8, mirrorRoughness: 0.35, mirrorLightness: 0.4, glossyLensRoughness: 0.3, glossyLensOpacity: 0.5, glossyLensLightness: 0.6 }
type Look = THREE.MeshStandardMaterial

function looksLit(m: Look): string | null {
  const lightness = m.color ? (m.color.r + m.color.g + m.color.b) / 3 : 0
  if (m.emissive && m.emissiveIntensity > 0 && m.emissive.r + m.emissive.g + m.emissive.b >= 0.05) return 'glows'
  if ((m.metalness ?? 0) >= LOOKS_LIT.mirrorMetalness && (m.roughness ?? 1) <= LOOKS_LIT.mirrorRoughness && lightness >= LOOKS_LIT.mirrorLightness) return 'mirror chrome'
  if (m.transparent && m.opacity >= LOOKS_LIT.glossyLensOpacity && (m.roughness ?? 1) < LOOKS_LIT.glossyLensRoughness && lightness >= LOOKS_LIT.glossyLensLightness) return 'bright glossy lens'
  return null
}

describe('a headlight put out by one pistol round', () => {
  for (const key of ['midsize_sedan', 'compact_hatch', 'fastback_sedan', 'midsize_suv', 'beetle']) {
    it(`${key}: nothing left in the unit looks lit`, () => {
      const kit = makeFleetKit('en')
      const item = buildVehicleItem(kit, key)
      const d = createVehicleDestructible(kit, item.vehicle, { id: key, frame: item.root })
      item.root.updateMatrixWorld(true)
      const vehicle = (item.vehicle as VehicleContext).vehicle as THREE.Object3D
      for (const side of ['left', 'right']) {
        const id = `headlight_${side}`
        const part = d.describe().parts.find((p) => p.id === id)!
        if (part.shape.kind !== 'box') throw new Error(`${id} is not a box`)
        const size = part.shape.size
        const at = d.partWorldCenter!(id)
        const centre = vehicle.worldToLocal(new THREE.Vector3(...at))
        // from 3 m ahead of the car and a little above, as a player aims at the lamp
        const forward = new THREE.Vector3(1, 0, 0).transformDirection(vehicle.matrixWorld)
        const from = new THREE.Vector3(...at).addScaledVector(forward, 3).add(new THREE.Vector3(0, 0.2, 0))
        const towards = new THREE.Vector3(...at).sub(from).normalize()
        const hit = d.surfaceRay!({ origin: from.toArray(), direction: towards.toArray(), maxDistance: 10 })
        expect(hit?.part, `${key} ${id}`).toBe(id)
        d.hit({ ...PISTOL, point: hit!.point, part: id, normal: hit!.normal, direction: towards.toArray() })
        const lit: string[] = []
        vehicle.updateMatrixWorld(true)
        vehicle.traverse((o) => {
          const mesh = o as THREE.Mesh<THREE.BufferGeometry, Look>
          if (!mesh.isMesh || Array.isArray(mesh.material) || mesh.userData.decal) return
          for (let up: THREE.Object3D | null = mesh; up; up = up.parent) if (!up.visible) return
          mesh.geometry.computeBoundingBox()
          const mid = vehicle.worldToLocal(mesh.localToWorld(mesh.geometry.boundingBox!.getCenter(new THREE.Vector3())))
          if (![mid.x - centre.x, mid.y - centre.y, mid.z - centre.z].every((v, i) => Math.abs(v) <= size[i]! / 2)) return
          const why = looksLit(mesh.material)
          if (why) lit.push(`${why} #${mesh.material.color?.getHexString()}`)
        })
        expect(lit, `${key} ${id}`).toEqual([])
      }
    })
  }
})

