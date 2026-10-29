import type * as THREE from 'three'
import { buildBeltBox } from './attachments/belt-box'
import { buildDrum } from './attachments/drum'
import { buildHelicalMagazine } from './helical-magazine'
import type { RifleContext } from './rifle-context'

/** Grip, trigger group and selector. Returns the x of the grip, which the magazine and the lever hang from. */
export function buildGrip(context: RifleContext): number {
  const { kit, group, parts, options: o, furniture: furn, receiverStart: x0, receiverHeight: hR, receiverWidth: wR } = context
  const { M, box } = kit
  const gx = x0 + (o.gripAt || 0.07)
  if (!context.isTraditional && o.grip !== 'none') {
    const grip = kit.pivot(group, gx - 0.012, -hR / 2 - 0.046, 0)
    grip.rotation.z = -0.3
    parts.grip = grip
    box(grip, 0.032, 0.105, 0.028, furn, 0, 0, 0)
    for (let i = 0; i < 3; i++) box(grip, 0.006, 0.012, 0.026, furn, 0.017, 0.022 - i * 0.02, 0)
    box(grip, 0.034, 0.008, 0.03, furn, 0, -0.052, 0)
  }
  box(group, 0.06, 0.004, 0.01, M.metal, gx + 0.03, -hR / 2 - 0.024, 0)
  box(group, 0.004, 0.022, 0.01, M.metal, gx + 0.06, -hR / 2 - 0.013, 0)
  parts.trigger = box(group, 0.004, 0.016, 0.004, M.dark, gx + 0.024, -hR / 2 - 0.012, 0, 0.15)
  if (o.sel) parts.safety = box(group, 0.016, 0.005, 0.003, M.dark, gx + 0.005, -hR * 0.15, -wR / 2 - 0.002, 0.4)
  return gx
}

/** The magazine of the kind the options name (curved, box, drum, internal, belt), and the cover and belt box of a belt-fed gun. Returns the x of the well. */
export function buildMagazine(context: RifleContext, gx: number): number {
  const { kit, group, parts, options: o, receiverStart: x0, receiverHeight: hR, receiverWidth: wR, receiverLength: RL } = context
  const { M, box } = kit
  if (o.mag === 'helical') return buildHelicalMagazine(context)
  const mx = o.magAt != null ? x0 + o.magAt : gx + 0.075
  const scale = o.magLen || 1
  const magazine = kit.pivot(group, mx, -hR / 2, 0)
  parts.mag = magazine
  const finish: THREE.Material | undefined = o.magMat === 'bakelite' ? M.bakelite : o.magMat === 'poly' ? M.polyMag : undefined
  if (o.mag === 'curved') {
    let px = 0
    let py = 0
    const material = finish ?? M.metal
    for (const angle of [0.06, 0.22, 0.38]) {
      const length = 0.07 * scale
      const cx = px + (Math.sin(angle) * length) / 2
      const cy = py - (Math.cos(angle) * length) / 2
      box(magazine, 0.052, length + 0.004, 0.024, material, cx, cy, 0, angle)
      box(magazine, 0.04, length * 0.8, 0.026, M.dark, cx, cy, 0, angle)
      px += Math.sin(angle) * length
      py -= Math.cos(angle) * length
    }
    box(magazine, 0.058, 0.008, 0.028, material, px, py, 0, 0.38)
    parts.magDrop = 0.07 * scale * 3 + 0.04
  } else if (o.mag === 'box') {
    const length = 0.13 * scale
    const curve = o.curve || 0
    const segment = length / 3
    const material = finish ?? M.dark
    let px = 0
    let py = 0
    let angle = 0.08
    for (let i = 0; i < 3; i++) {
      angle = 0.08 + curve * i
      const cx = px + (Math.sin(angle) * segment) / 2
      const cy = py - (Math.cos(angle) * segment) / 2
      box(magazine, 0.05, segment + 0.004, 0.024, material, cx, cy, 0, angle)
      box(magazine, 0.04, 0.003, 0.026, M.metal, cx, cy, 0, angle)
      px += Math.sin(angle) * segment
      py -= Math.cos(angle) * segment
    }
    box(magazine, 0.056, 0.007, 0.028, material, px, py - 0.002, 0, angle)
    parts.magDrop = length + 0.03
  } else if (o.mag === 'drum') {
    buildDrum(kit, magazine)
    parts.magDrop = 0.2
  } else if (o.mag === 'internal') {
    box(group, 0.08, 0.025, 0.03, context.isTraditional ? context.furniture : M.metal, mx, -hR / 2 - 0.012, 0)
    parts.mag = null
  } else parts.mag = null
  if (o.mag === 'belt') {
    const belt = kit.pivot(group, mx + 0.02, -hR / 2 - 0.05, -0.045)
    parts.belt = belt
    buildBeltBox(kit, belt)
    const cover = kit.pivot(group, x0 + 0.01, hR / 2, 0)
    parts.cover = cover
    box(cover, RL - 0.03, 0.014, wR * 1.05, M.metal, (RL - 0.03) / 2, 0.007, 0)
    box(cover, 0.02, 0.012, wR * 0.6, M.dark, RL - 0.04, 0.016, 0)
  }
  return mx
}
