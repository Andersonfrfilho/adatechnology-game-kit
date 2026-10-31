import type * as THREE_NS from 'three'
import { LIGHT_PRIORITY } from '@adatechnology/game-render-three'
import type { LightBudget, SourceHandle } from '@adatechnology/game-render-three'
import type { WorkshopEngine } from '@adatechnology/game-vfx'
import type { WeatherSample } from '@adatechnology/game-weather'
import type { ThreeLib, Vec3 } from './types'

/** The Workshop's car lamps (W101-103) and the rain that glows inside their beam (W1161-1170). */
export const HEADLIGHTS = {
  spot: { color: 0xfff1d0, intensity: 2.4, distance: 26, angle: 0.33, penumbra: 0.5, decay: 1.6 },
  /** Lamp position on the car (x is mirrored), where the spot points, and the cone drawn in the air. */
  lamp: [0.65, 0.74, 2.15],
  aim: [0.65, 0.2, 12],
  cone: { radius: 2.4, length: 9, segments: 18, color: 0xfff1d0, opacity: 0.06 },
  lens: { on: 0xfff1d0, off: 0x3a3a34 },
  /** Lit drops a second, thrown into the beam 1 to 13 m ahead (W1176). */
  lit: { rate: 600, depth: [1, 13], spread: 0.33, color: 0xcfdcf0, alpha: 0.9, life: 0.06, len: 0.035, velocity: [0.8, -14, 0] },
  /** Beyond this many metres a car keeps only the cone: no real light (W-b text of `farol`). */
  lightRange: 40,
} as const

export type HeadlightRules = {
  /** Whether the lamps are lit in this weather and light (default: night, rain or fog). */
  readonly lit?: (sample: WeatherSample) => boolean
  readonly lightRange?: number
  /**
   * The host's light budget: each lamp is a source of it (it competes for a spot slot by distance) instead of a `SpotLight` on the car. Without it the lamps create their own spots (deprecated,
   * removed in the next major).
   */
  readonly lights?: LightBudget
}

/** Night (the sun below the page's 0.3 night factor), rain or fog make a driver turn the lamps on. */
export const defaultHeadlightRule = (sample: WeatherSample): boolean => sample.nightFactor > 0.3 || sample.rain > 0 || sample.fogDensity > 0.02 || sample.visibility < 150

type Rig = { readonly car: THREE_NS.Object3D; readonly spots: THREE_NS.SpotLight[]; readonly sources: SourceHandle[]; readonly cones: THREE_NS.Mesh[]; readonly lens: THREE_NS.MeshBasicMaterial | undefined; readonly targets: THREE_NS.Object3D[] }

export type Headlights = {
  /** Gives `car` its two spot lights and two beam cones (`lens`, when given, is the material of the lamp glass, lit with them). Returns the function that takes them off. */
  attach(car: THREE_NS.Object3D, lens?: THREE_NS.MeshBasicMaterial): () => void
  /** Lights the lamps of the cars attached, the real light only within range of `camera`; throws the lit drops of the beams into the Workshop's streak pool. */
  update(sample: WeatherSample, dt: number, camera: Vec3, engine?: WorkshopEngine, enabled?: boolean): void
  count(): number
  dispose(): void
}

export function createHeadlights(THREE: ThreeLib, rules: HeadlightRules = {}): Headlights {
  const rigs = new Set<Rig>()
  const cone = HEADLIGHTS.cone
  const lampWorld = new THREE.Vector3()
  const aimWorld = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const rule = rules.lit ?? defaultHeadlightRule
  const range = rules.lightRange ?? HEADLIGHTS.lightRange
  const lights = rules.lights
  const forwardAxis = new THREE.Vector3(0, 0, -1)

  /** A lamp the budget lights: a node on the car whose -z points where the spot aims, followed by the source. */
  function lampSource(side: number, car: THREE_NS.Object3D, targets: THREE_NS.Object3D[]): SourceHandle {
    const lamp = new THREE.Object3D()
    lamp.position.set(side * HEADLIGHTS.lamp[0], HEADLIGHTS.lamp[1], HEADLIGHTS.lamp[2])
    const aim = new THREE.Vector3(side * HEADLIGHTS.aim[0], HEADLIGHTS.aim[1], HEADLIGHTS.aim[2]).sub(lamp.position).normalize()
    lamp.quaternion.setFromUnitVectors(forwardAxis, aim)
    car.add(lamp)
    targets.push(lamp)
    const spot = HEADLIGHTS.spot
    return lights!.addSource({ owner: 'weather.headlight', kind: 'spot', priority: LIGHT_PRIORITY.headlight, color: spot.color, intensity: 0, distance: spot.distance, decay: spot.decay, angle: spot.angle, penumbra: spot.penumbra, position: [0, 0, 0], follow: lamp })
  }

  function legacySpot(side: number, car: THREE_NS.Object3D, targets: THREE_NS.Object3D[]): THREE_NS.SpotLight {
    // eslint-disable-next-line no-restricted-syntax -- D2: legacy path without LightBudget, removed in the next major
    const spot = new THREE.SpotLight(HEADLIGHTS.spot.color, 0, HEADLIGHTS.spot.distance, HEADLIGHTS.spot.angle, HEADLIGHTS.spot.penumbra, HEADLIGHTS.spot.decay)
    spot.position.set(side * HEADLIGHTS.lamp[0], HEADLIGHTS.lamp[1], HEADLIGHTS.lamp[2])
    const target = new THREE.Object3D()
    target.position.set(side * HEADLIGHTS.aim[0], HEADLIGHTS.aim[1], HEADLIGHTS.aim[2])
    car.add(spot, target)
    spot.target = target
    targets.push(target)
    return spot
  }

  function attach(car: THREE_NS.Object3D, lens?: THREE_NS.MeshBasicMaterial): () => void {
    const spots: THREE_NS.SpotLight[] = []
    const cones: THREE_NS.Mesh[] = []
    const targets: THREE_NS.Object3D[] = []
    const sources: SourceHandle[] = []
    for (const side of [-1, 1]) {
      if (lights) sources.push(lampSource(side, car, targets))
      else spots.push(legacySpot(side, car, targets))
      const geometry = new THREE.ConeGeometry(cone.radius, cone.length, cone.segments, 1, true)
      geometry.translate(0, -cone.length / 2, 0)
      geometry.rotateX(-Math.PI / 2)
      const material = new THREE.MeshBasicMaterial({ color: cone.color, transparent: true, opacity: cone.opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
      const beam = new THREE.Mesh(geometry, material)
      beam.position.set(side * HEADLIGHTS.lamp[0], HEADLIGHTS.lamp[1], HEADLIGHTS.lamp[2])
      beam.visible = false
      car.add(beam)
      cones.push(beam)
    }
    const rig: Rig = { car, spots, sources, cones, lens, targets }
    rigs.add(rig)
    return () => {
      rigs.delete(rig)
      for (const object of [...spots, ...cones, ...targets]) car.remove(object)
      for (const beam of cones) {
        beam.geometry.dispose()
        ;(beam.material as THREE_NS.Material).dispose()
      }
      for (const spot of spots) spot.dispose()
      for (const source of sources) source.remove()
      lens?.color.setHex(HEADLIGHTS.lens.off)
    }
  }

  return {
    attach,
    update(sample, dt, camera, engine, enabled = true) {
      const on = enabled && rule(sample)
      let index = 0
      for (const rig of rigs) {
        rig.car.updateWorldMatrix(true, false)
        lampWorld.set(0, HEADLIGHTS.lamp[1], HEADLIGHTS.lamp[2]).applyMatrix4(rig.car.matrixWorld)
        const near = Math.hypot(lampWorld.x - camera[0], lampWorld.z - camera[2]) <= range
        for (const spot of rig.spots) spot.intensity = on && near ? HEADLIGHTS.spot.intensity : 0
        for (const source of rig.sources) source.update({ intensity: on && near ? HEADLIGHTS.spot.intensity : 0 })
        for (const beam of rig.cones) beam.visible = on
        rig.lens?.color.setHex(on ? HEADLIGHTS.lens.on : HEADLIGHTS.lens.off)
        if (!on || !engine || sample.rain <= 0 || !near) {
          index++
          continue
        }
        aimWorld.set(0, HEADLIGHTS.lamp[1], HEADLIGHTS.lamp[2] + 1).applyMatrix4(rig.car.matrixWorld)
        forward.copy(aimWorld).sub(lampWorld).normalize()
        const side: [number, number] = [forward.z, -forward.x]
        const { random } = engine
        const lit = HEADLIGHTS.lit
        engine.emit(`weather-lit-${index}`, 'streak', lit.rate, dt, () => {
          const depth = random.between(lit.depth[0], lit.depth[1])
          const spread = depth * lit.spread * Math.sqrt(random.next())
          const turn = random.between(0, 6.283)
          return {
            p: [lampWorld.x + forward.x * depth + side[0] * Math.cos(turn) * spread, lampWorld.y + forward.y * depth + Math.sin(turn) * spread * 0.6, lampWorld.z + forward.z * depth + side[1] * Math.cos(turn) * spread],
            v: lit.velocity as unknown as [number, number, number],
            sp: 0,
            life: lit.life,
            len: lit.len,
            c0: lit.color,
            a: lit.alpha,
          }
        })
        index++
      }
    },
    count: () => rigs.size,
    dispose() {
      for (const rig of [...rigs]) {
        rigs.delete(rig)
        for (const object of [...rig.spots, ...rig.cones, ...rig.targets]) rig.car.remove(object)
        for (const source of rig.sources) source.remove()
      }
    },
  }
}
