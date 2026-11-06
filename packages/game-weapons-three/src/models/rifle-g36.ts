import { buttpad, rail, vents } from './details'
import type { RifleContext } from './rifle-context'

// The Heckler & Koch G36 family as the reference photos show it (assets/weapon-references.json): metres in the model's frame, x from the butt to the muzzle, y up, z to the right.

const PI = Math.PI

/** The polymer receiver: the tall shell, the hinge block of the stock, the channel of the charging handle on top and the pins of the trigger group. */
export function buildG36Receiver(context: RifleContext): void {
  const { kit, group, receiverStart: x0, receiverEnd: x1, receiverHeight: hR, receiverWidth: wR, receiverLength: RL } = context
  const { M, box, cylinderZ } = kit
  const middle = (x0 + x1) / 2
  box(group, RL, hR, wR, M.poly, middle, 0, 0)
  box(group, 0.022, hR * 1.02, wR * 1.1, M.poly, x0 + 0.011, 0, 0)
  box(group, RL * 0.55, 0.008, wR * 0.6, M.dark, x1 - RL * 0.32, hR / 2 - 0.003, 0)
  box(group, RL * 0.92, 0.003, wR + 0.002, M.dark, middle, -hR * 0.18, 0)
  for (const fraction of [0.12, 0.42, 0.7]) cylinderZ(group, 0.004, wR + 0.004, M.metal, x0 + RL * fraction, -hR * 0.3, 0, 10)
}

// the G36 grip leans back more than the generic one (0.3 rad)
const GRIP_LEAN = 0.42

/** The trigger group under the receiver, one polymer housing from the grip to the magazine well, the well itself, and the grip leaning back as the G36's. */
export function buildG36Lower(context: RifleContext, gripX: number, magazineX: number): void {
  const { kit, group, parts, receiverHeight: hR, receiverWidth: wR } = context
  const { M, box } = kit
  if (parts.grip) parts.grip.rotation.z = -GRIP_LEAN
  const start = gripX - 0.03
  const end = magazineX - 0.028
  box(group, end - start, 0.018, wR * 0.9, M.poly, (start + end) / 2, -hR / 2 - 0.008, 0)
  box(group, 0.068, 0.03, wR * 1.06, M.poly, magazineX + 0.006, -hR / 2 - 0.012, 0)
}

/** The skeletal folding stock: butt plate, top bar, the bottom bar rising to the hinge and the strut between its two windows. */
export function buildG36Stock(context: RifleContext): void {
  const { kit, group, stockLength: S, receiverHeight: hR, receiverWidth: wR } = context
  const { M, box } = kit
  const width = wR * 0.8
  const bar = 0.018
  const top = hR / 2 - bar / 2
  const buttBottom = -hR / 2 - 0.06
  const buttHeight = top - buttBottom + bar
  box(group, 0.026, buttHeight, width, M.poly, 0.013, (top + buttBottom) / 2, 0)
  buttpad(kit, group, 0.003, (top + buttBottom) / 2, buttHeight, width)
  box(group, S, bar, width, M.poly, S / 2, top, 0)
  const run = S - 0.026
  const rise = -hR / 2 + bar / 2 - buttBottom
  const angle = Math.atan2(rise, run)
  box(group, Math.hypot(run, rise), bar, width, M.poly, 0.026 + run / 2, buttBottom + rise / 2, 0, angle)
  for (const fraction of [0.6, 0.86]) {
    const x = S * fraction
    const bottom = buttBottom + (x - 0.026) * Math.tan(angle)
    box(group, 0.014, top - bottom, width, M.poly, x, (top + bottom) / 2, 0)
  }
}

/** The handguard: long and slotted on the rifle, shorter on the carbines, with a rail underneath when the options ask for one (the G36C's vertical grip). */
export function buildG36Handguard(context: RifleContext): void {
  const { kit, group, options: o, length: L, receiverEnd: x1, receiverHeight: hR, receiverWidth: wR, barrelY: by } = context
  const { M, box } = kit
  const length = (L - x1) * (o.hgFrac || 0.5)
  const height = hR * 0.85
  const y = by - 0.004
  box(group, length, height, wR * 1.05, M.poly, x1 + length / 2, y, 0)
  box(group, 0.014, height * 0.75, wR * 0.9, M.poly, x1 + length + 0.007, y, 0)
  const count = Math.max(3, Math.round(length / 0.03))
  for (const side of [1, -1]) vents(kit, group, x1 + 0.02, length - 0.04, y + height * 0.25, side * (wR * 0.525 + 0.001), count, height * 0.18)
  if (o.rail) rail(kit, group, x1 + 0.01, length - 0.02, y - height / 2, 0, wR * 0.6, PI)
}

/** On top: the carry handle with its optic and the red dot over it (G36, G36K, `carry`), or the long rail on two risers ending in the front sight (G36C). */
export function buildG36Top(context: RifleContext): void {
  const { kit, group, options: o, receiverStart: x0, receiverEnd: x1, receiverHeight: hR, receiverWidth: wR } = context
  const { M, box, cylinderX } = kit
  const deck = hR / 2
  if (o.carry) {
    const towerX = x0 + 0.065
    box(group, 0.07, 0.05, wR * 0.8, M.poly, towerX, deck + 0.025, 0)
    cylinderX(group, 0.016, 0.074, M.dark, towerX, deck + 0.028, 0, 18)
    for (const end of [-1, 1]) cylinderX(group, 0.013, 0.002, M.lens, towerX + end * 0.038, deck + 0.028, 0, 18)
    box(group, 0.046, 0.02, 0.028, M.dark, towerX, deck + 0.06, 0)
    cylinderX(group, 0.009, 0.002, M.lens, towerX + 0.024, deck + 0.062, 0, 14)
    const handleStart = towerX + 0.035
    const handleEnd = x1 + 0.03
    box(group, handleEnd - handleStart, 0.014, wR * 0.55, M.poly, (handleStart + handleEnd) / 2, deck + 0.043, 0)
    box(group, 0.016, 0.052, wR * 0.55, M.poly, handleEnd, deck + 0.02, 0, 0.35)
    return
  }
  const start = x0 + 0.01
  const end = x1 + 0.05
  for (const x of [start + 0.016, end - 0.016]) box(group, 0.032, 0.02, wR * 0.7, M.poly, x, deck + 0.01, 0)
  rail(kit, group, start, end - start, deck + 0.02, 0, wR * 0.66)
  box(group, 0.01, 0.022, 0.006, M.dark, end - 0.008, deck + 0.036, 0)
  box(group, 0.016, 0.012, wR * 0.5, M.dark, start + 0.012, deck + 0.03, 0)
}

// the G36 magazine is about 7 cm front to back, the generic box one 5 cm
const MAGAZINE_DEPTH = 1.35

/** The translucent magazine: as deep as the G36's, with the rounds seen through it, staggered and lying along the barrel. */
export function fillG36Magazine(context: RifleContext): void {
  const { kit, parts } = context
  if (!parts.mag) return
  parts.mag.scale.x = MAGAZINE_DEPTH
  for (let i = 0; i < 9; i++) kit.cylinderX(parts.mag, 0.0045, 0.042, kit.M.brass, 0.002 + i * 0.001, -0.01 - i * 0.0115, i % 2 ? 0.004 : -0.004, 8)
}
