// What leaks out of a part that holds a liquid with no container of the fluid world (a car's fuel tank, its oil pan, a radiator) lands in the fluid world.
import type * as THREE_NS from 'three'
import type { DestructionEvent, DestructionWorld, Vec3 } from '@adatechnology/game-destruction'
import type { FluidWorld, LiquidId } from '@adatechnology/game-fluids'

type LeakEvent = Extract<DestructionEvent, { type: 'leak' }>

/** The liquid of the fluid world each fluid of a part is, where the names differ. */
const LIQUID_OF: Readonly<Record<string, LiquidId>> = { oil: 'motor_oil', gasoline: 'fuel' }
/** Litres gathered before they are let fall as one splash: a slow drip still lands every few frames, not as a thousand splashes. */
const SPLASH_LITRES = 0.004
/** Metres per second the liquid leaves the hole with, along the way the event says it runs. */
const OUT_SPEED = 0.4

interface Leak {
  readonly object: string
  readonly part: string
  readonly liquid: LiquidId
  /** The hole and the way out of it, in the space of the object's root (the car moves, the hole goes with it). */
  readonly local: Vec3
  readonly out: Vec3
  litersLeft: number
  owed: number
}

export interface PartLeaksDeps {
  readonly THREE: { Vector3: typeof THREE_NS.Vector3; Matrix4: typeof THREE_NS.Matrix4 }
  readonly world: DestructionWorld
  readonly fluids: FluidWorld
  /** The drawn root of an object (where its holes are), or undefined when it has none. */
  readonly rootOf: (objectId: string) => THREE_NS.Object3D | undefined
}

export interface PartLeaks {
  /** A part with no container started leaking (`leak` event): what it loses from now on falls from the hole. */
  start(event: LeakEvent): void
  /** Once a step: what each part lost since the last step falls from its hole, and lands as a stain that grows with it. */
  update(): void
  clear(): void
}

/**
 * The liquid a part holds (`PartState.liters`) leaks by the world's own rate. Each step, the litres it lost leave the hole (moved with the object) and
 * fall onto what is under it: one stain that grows with what came out, spreads by the liquid's own viscosity and dries or stays by its own kind (petrol
 * evaporates, oil stays), and stops growing when the part is empty or the hole is shut. A hit on a part with no liquid leaks nothing.
 */
export function createPartLeaks({ THREE, world, fluids, rootOf }: PartLeaksDeps): PartLeaks {
  const leaks = new Map<string, Leak>()
  const point = new THREE.Vector3()
  const inverse = new THREE.Matrix4()
  const liquidOf = (fluid: string): LiquidId | null => {
    const id = LIQUID_OF[fluid] ?? fluid
    return fluids.liquids.has(id) ? id : null
  }
  const toWorld = (root: THREE_NS.Object3D, local: Vec3, direction: boolean): Vec3 => {
    point.set(local[0], local[1], local[2])
    if (direction) point.transformDirection(root.matrixWorld)
    else point.applyMatrix4(root.matrixWorld)
    return [point.x, point.y, point.z]
  }

  return {
    start(event) {
      const key = `${event.object}|${event.part}`
      const liquid = liquidOf(event.fluid)
      const root = rootOf(event.object)
      const left = world.part(event.object, event.part)?.liters
      if (leaks.has(key) || !liquid || !root || left === undefined) return
      root.updateWorldMatrix(true, false)
      inverse.copy(root.matrixWorld).invert()
      point.set(event.point[0], event.point[1], event.point[2]).applyMatrix4(inverse)
      const local: Vec3 = [point.x, point.y, point.z]
      point.set(event.direction[0], event.direction[1], event.direction[2]).transformDirection(inverse)
      leaks.set(key, { object: event.object, part: event.part, liquid, local, out: [point.x, point.y, point.z], litersLeft: left, owed: 0 })
    },
    update() {
      for (const [key, leak] of leaks) {
        const left = world.part(leak.object, leak.part)?.liters
        const root = rootOf(leak.object)
        if (left === undefined || !root) {
          leaks.delete(key)
          continue
        }
        leak.owed += Math.max(0, leak.litersLeft - left)
        leak.litersLeft = left
        if (leak.owed >= SPLASH_LITRES || (left <= 0 && leak.owed > 0)) {
          root.updateWorldMatrix(true, false)
          const out = toWorld(root, leak.out, true)
          fluids.splash(leak.liquid, toWorld(root, leak.local, false), leak.owed, [out[0] * OUT_SPEED, out[1] * OUT_SPEED, out[2] * OUT_SPEED])
          leak.owed = 0
        }
        if (left <= 0) leaks.delete(key)
      }
    },
    clear: () => leaks.clear(),
  }
}
