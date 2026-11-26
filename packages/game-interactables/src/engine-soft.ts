import type { BodyId, SeamWorld } from '@adatechnology/game-physics'

import { buildChain, chainEnd, disposeChain } from './engine-chain'
import type { Chain } from './engine-chain'
import { localToWorld, rotY } from './math'
import type { SoftDriver } from './part-physics'
import type { SoftSpec, Transform, Vec3 } from './types'

const STRIP_WIDTH = 0.12
const LINK_LENGTH = 0.15
const MAX_LINKS = 8
const FABRIC_KG_PER_M2 = 0.3
const FABRIC_HALF_DEPTH = 0.01
const TWIST_RANGE = 0.3
const DEFAULT_MAX_ANGLE = 0.7
const DEFAULT_DAMPING = 4
const JOINT_HOLD_NM = 0.002
/** An actor's velocity (m/s) to the speed it gives a strip (the body only brushes the cloth). */
const PUSH_GAIN = 0.4

/**
 * A curtain, cloth or strip as hanging chains from a rail along its anchor line, one chain per `STRIP_WIDTH` of width: they swing when an actor pushes through and
 * settle by the damping (the world's spring is not used). The world's `sway` reads back the mean tip offset of the chains as the two swing angles.
 */
export function attachStrips(world: SeamWorld, soft: SoftSpec, transform: Transform): SoftDriver {
  const [width, height, depth] = soft.size
  const strips = Math.max(1, Math.round(width / STRIP_WIDTH))
  const links = Math.min(MAX_LINKS, Math.max(2, Math.round(height / LINK_LENGTH)))
  const rail: BodyId = world.createBody({ shape: { kind: 'box', half: [width / 2, 0.01, Math.max(depth, 0.02) / 2] }, motion: 'static', position: localToWorld(transform, soft.anchor), layer: 'static', user: -3 })
  const damping = soft.damping ?? DEFAULT_DAMPING
  const chains: Chain[] = []
  const tops: Vec3[] = []
  for (let i = 0; i < strips; i++) {
    const x = soft.anchor[0] - width / 2 + (width * (i + 0.5)) / strips
    const top = localToWorld(transform, [x, soft.anchor[1], soft.anchor[2]])
    tops.push(top)
    chains.push(
      buildChain(world, {
        points: Array.from({ length: links + 1 }, (_, k): Vec3 => [top[0], top[1] - (height * k) / links, top[2]]),
        halfWidth: (width / strips) * 0.45,
        halfDepth: FABRIC_HALF_DEPTH,
        totalMass: (width / strips) * height * FABRIC_KG_PER_M2,
        startBody: rail,
        halfCone: soft.maxAngle ?? DEFAULT_MAX_ANGLE,
        twist: TWIST_RANGE,
        jointFriction: JOINT_HOLD_NM,
        damping: damping / 4,
      }),
    )
  }
  const tip = new Float64Array(3)
  const lastLinks = chains.map((chain) => chain.bodies[chain.bodies.length - 1] as BodyId)
  const cosYaw = Math.cos(-transform.ry)
  const sinYaw = Math.sin(-transform.ry)
  let restedAx = 0
  let restedAz = 0
  let isRested = false
  let disposed = false
  const everyLinkAsleep = (): boolean => {
    for (let i = 0; i < lastLinks.length; i++) if (!world.isSleeping(lastLinks[i] as BodyId)) return false
    return true
  }
  return {
    swing(out) {
      const asleep = everyLinkAsleep()
      if (asleep && isRested) {
        out[0] = restedAx
        out[1] = restedAz
        return
      }
      let dx = 0
      let dz = 0
      for (let i = 0; i < chains.length; i++) {
        chainEnd(world, chains[i] as Chain, tip)
        const top = tops[i] as Vec3
        const offsetX = (tip[0] as number) - top[0]
        const offsetZ = (tip[2] as number) - top[2]
        // the object's yaw undone (the same turn about y as `worldToLocal`)
        dx += offsetX * cosYaw + offsetZ * sinYaw
        dz += -offsetX * sinYaw + offsetZ * cosYaw
      }
      // rotation about x turns the tip toward -z for a positive angle (and about z toward +x), as the world's spring has it
      out[0] = -Math.asin(Math.max(-1, Math.min(1, dz / strips / height)))
      out[1] = Math.asin(Math.max(-1, Math.min(1, dx / strips / height)))
      restedAx = out[0]
      restedAz = out[1]
      isRested = asleep
    },
    push(velocity) {
      const world3 = rotY(velocity, transform.ry)
      for (const chain of chains) {
        for (const body of chain.bodies) world.addImpulse(body, [world3[0] * PUSH_GAIN * linkMass(soft, strips, links), world3[1] * PUSH_GAIN * linkMass(soft, strips, links), world3[2] * PUSH_GAIN * linkMass(soft, strips, links)])
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const chain of chains) disposeChain(world, chain)
      world.removeBody(rail)
    },
  }
}

const linkMass = (soft: SoftSpec, strips: number, links: number): number => (soft.size[0] / strips) * (soft.size[1] / links) * FABRIC_KG_PER_M2
