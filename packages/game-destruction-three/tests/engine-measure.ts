import * as THREE from 'three'
import type { Piece } from '../src/types'

/** What an update did to one piece, by energy (`DECISION-fable.md` §2). */
export interface EnergyReport {
  /** C2: the most energy height (m) a piece gained over one episode (wake to sleep) that it started at rest. */
  restGain: number
  /** C2 with its exemption: gains in updates where another piece moving faster than 1 m/s was within its reach (a hit, not a launch) are left out. */
  restGainUnhit: number
  /** C3: the most a centre of mass rose beyond what its own upward speed carried it, summed over a piece's episode (m). */
  lift: number
  /** C1: the largest rise of the scene's total m * energy height in one update, over m_total * g (m): energy made by contacts. */
  created: number
  /** C1: updates that made more than 1 mm. */
  createdOver1mm: number
}

const GRAVITY = 9.81
const v = new THREE.Vector3()
const q = new THREE.Quaternion()
const w = new THREE.Vector3()

interface Kinetic {
  readonly velocity: number[]
  readonly angularVelocity: number[]
  readonly halfExtents: number[]
  readonly mass: number
  readonly sleeping: boolean
}

const centreY = (p: Piece): number => {
  p.root.updateMatrixWorld(true)
  return v.set(p.localCenter[0], p.localCenter[1], p.localCenter[2]).applyMatrix4(p.root.matrixWorld).y
}

/** y + (|v|^2 + w.Iw/m) / 2g, with the box inertia of the piece in its own frame. */
export const energyHeight = (p: Piece): number => {
  const k = p as unknown as Kinetic
  const [hx, hy, hz] = k.halfExtents
  const ix = (hy * hy + hz * hz) / 3
  const iy = (hx * hx + hz * hz) / 3
  const iz = (hx * hx + hy * hy) / 3
  q.copy(p.root.quaternion).invert()
  w.set(k.angularVelocity[0], k.angularVelocity[1], k.angularVelocity[2]).applyQuaternion(q)
  const vv = k.velocity[0] ** 2 + k.velocity[1] ** 2 + k.velocity[2] ** 2
  return centreY(p) + (vv + ix * w.x * w.x + iy * w.y * w.y + iz * w.z * w.z) / (2 * GRAVITY)
}

/** Runs `frames` updates and measures C1-C3 around each. */
export const measureEnergy = (pieces: () => Piece[], update: (dt: number) => void, dt: number, frames: number, between?: () => void): EnergyReport => {
  const episode = new Map<Piece, { gain: number; unhit: number; lift: number; fromRest: boolean }>()
  const out: EnergyReport = { restGain: 0, restGainUnhit: 0, lift: 0, created: 0, createdOver1mm: 0 }
  for (let f = 0; f < frames; f++) {
    between?.()
    const list = pieces()
    const before = list.map((p) => {
      const k = p as unknown as Kinetic
      const c = v.set(p.localCenter[0], p.localCenter[1], p.localCenter[2]).applyMatrix4(p.root.matrixWorld)
      return { p, e: energyHeight(p), y: centreY(p), vy: k.velocity[1], speed: Math.hypot(...k.velocity), asleep: k.sleeping, x: c.x, z: c.z, reach: Math.hypot(...k.halfExtents) }
    })
    update(dt)
    let total = 0
    let mass = 0
    for (const b of before) {
      const k = b.p as unknown as Kinetic
      const e = energyHeight(b.p)
      total += k.mass * (e - b.e)
      mass += k.mass
      let ep = episode.get(b.p)
      // an episode starts when a piece is at rest (asleep, or slower than 5 cm/s) and ends when it sleeps
      if (!ep) episode.set(b.p, (ep = { gain: 0, unhit: 0, lift: 0, fromRest: b.asleep || b.speed < 0.05 }))
      ep.gain += Math.max(0, e - b.e)
      const hit = before.some((o) => o !== b && o.speed > 1 && Math.hypot(o.x - b.x, o.z - b.z) < o.reach + b.reach)
      if (!hit) ep.unhit += Math.max(0, e - b.e)
      ep.lift += Math.max(0, centreY(b.p) - b.y - Math.max(0, b.vy) * dt)
      out.lift = Math.max(out.lift, ep.lift)
      if (ep.fromRest) {
        out.restGain = Math.max(out.restGain, ep.gain)
        out.restGainUnhit = Math.max(out.restGainUnhit, ep.unhit)
      }
      if (k.sleeping) episode.delete(b.p)
    }
    const made = total / Math.max(mass, 1e-9)
    out.created = Math.max(out.created, made)
    if (made > 0.001) out.createdOver1mm++
  }
  return out
}
