import { shapeGeometries } from '@adatechnology/game-shapes-three'
import type { Three, THREE_NS } from '../three'

const GRAVITY = 9.8
const FLOOR_Y = 0.07
const BOUNCE = -0.3
const FRICTION = 0.6
const SPIN_DAMPING = 0.5
const REST_SPEED = 0.4
const LEG_COLOR = 0x2c3340

/** Where a limb comes from: arms leave at chest height with the sleeve's colour, legs low and long with the trousers'. */
export type LimbLaunch = {
  readonly x: number
  readonly z: number
  readonly kind: 'arm' | 'leg'
  /** The sleeve colour of the owner (arms). */
  readonly color: number
  /** The blood of the owner's age: colour, dried colour and whether it bleeds at all (the oldest dead do not: they spill dust). */
  readonly blood: { readonly color: number; readonly dried: number; readonly bleeds: boolean }
}

export type FlyingLimb = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  rx: number
  rz: number
  w: number
  t: number
  rest: boolean
  len: number
  col: number
  cor: number
  seco: number
  splat: boolean
}

/** The fluids bridge: where a limb bleeds when it leaves and where it splats when it lands. The host decides what that draws. */
export type LimbEffects = {
  onLaunch?(limb: FlyingLimb, kind: 'arm' | 'leg'): void
  onSplat?(splat: { readonly x: number; readonly z: number; readonly radius: number; readonly rotation: number; readonly color: number; readonly dried: number }): void
}

export type FlyingLimbsOptions = {
  /** Pieces alive at once (the game's 40 per player); the oldest is reused. */
  readonly max?: number
  readonly random: () => number
  readonly effects?: LimbEffects
}

export type FlyingLimbs = {
  readonly mesh: THREE_NS.InstancedMesh
  readonly limbs: readonly FlyingLimb[]
  launch(launch: LimbLaunch): FlyingLimb
  update(dt: number): void
}

/** Torn-off pieces that fly, bounce and stay on the ground, as one instanced mesh of capsules (G 67953 `fxLimb`, 68040 update). */
export const createFlyingLimbs = (host: Three, { max = 40, random, effects = {} }: FlyingLimbsOptions): FlyingLimbs => {
  const three = shapeGeometries(host)
  const limbs: FlyingLimb[] = []
  const mesh = new three.InstancedMesh(new three.CapsuleGeometry(0.065, 0.32, 2, 6), new three.MeshLambertMaterial({ color: 0xffffff }), max)
  mesh.count = 0
  mesh.castShadow = true
  mesh.setColorAt(0, new three.Color())
  const matrix = new three.Matrix4()
  const quaternion = new three.Quaternion()
  const scale = new three.Vector3()
  const position = new three.Vector3()
  const euler = new three.Euler()
  const color = new three.Color()
  return {
    mesh,
    limbs,
    launch({ x, z, kind, color: sleeve, blood }) {
      const isLeg = kind === 'leg'
      const limb = (limbs.length < max ? {} : limbs.shift()) as FlyingLimb
      Object.assign(limb, {
        x,
        y: isLeg ? 0.5 : 1.2,
        z,
        vx: (random() - 0.5) * 3,
        vy: 2 + random() * 2,
        vz: (random() - 0.5) * 3,
        rx: random() * 6,
        rz: random() * 6,
        w: (random() - 0.5) * 10,
        t: 0,
        rest: false,
        len: isLeg ? 1.3 : 1,
        col: isLeg ? LEG_COLOR : sleeve,
      })
      limbs.push(limb)
      limb.cor = blood.color
      limb.seco = blood.dried
      limb.splat = !blood.bleeds
      effects.onLaunch?.(limb, kind)
      return limb
    },
    update(dt) {
      limbs.forEach((limb, index) => {
        if (!limb.rest) {
          limb.t += dt
          limb.vy -= GRAVITY * dt
          limb.x += limb.vx * dt
          limb.y += limb.vy * dt
          limb.z += limb.vz * dt
          limb.rx += limb.w * dt
          if (limb.y < FLOOR_Y) {
            limb.y = FLOOR_Y
            limb.vy *= BOUNCE
            limb.vx *= FRICTION
            limb.vz *= FRICTION
            limb.w *= SPIN_DAMPING
            if (!limb.splat) {
              limb.splat = true
              effects.onSplat?.({ x: limb.x, z: limb.z, radius: 0.2 + random() * 0.2, rotation: random() * 6.28, color: limb.cor, dried: limb.seco })
            }
            if (Math.abs(limb.vy) < REST_SPEED) {
              limb.rest = true
              limb.rx = Math.PI / 2
            }
          }
        }
        matrix.compose(position.set(limb.x, limb.y, limb.z), quaternion.setFromEuler(euler.set(limb.rx, limb.rz, 0)), scale.set(1, limb.len, 1))
        mesh.setMatrixAt(index, matrix)
        mesh.setColorAt(index, color.set(limb.col))
      })
      mesh.count = limbs.length
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    },
  }
}
