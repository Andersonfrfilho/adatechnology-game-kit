import { rail, vents } from './details'
import type { RifleContext } from './rifle-context'

const PI = Math.PI

/** Handguard by kind and the front sight, which the page draws unless a long scope replaces it. */
export function buildForend(context: RifleContext): void {
  const { kit, group, options: o, furniture: furn, length: L, receiverEnd: x1, receiverHeight: hR, receiverWidth: wR, barrelRadius: r, barrelY: by } = context
  const { M, box } = kit
  const hasLongScope = (o.scope ?? 0) >= 3
  if (!context.isTraditional && o.hg !== 'none') {
    const handguardLength = (L - x1) * (o.hgFrac || 0.5)
    const hx = x1 + handguardLength / 2
    const hh = hR * 0.8
    if (o.hg === 'rail') {
      box(group, handguardLength, hh, wR * 1.04, M.dark, hx, by - 0.002, 0)
      rail(kit, group, x1, handguardLength, by + hh / 2, 0, wR * 0.66)
      rail(kit, group, x1 + 0.01, handguardLength - 0.02, by - 0.002, wR * 0.54, wR * 0.4, PI / 2)
      rail(kit, group, x1 + 0.01, handguardLength - 0.02, by - 0.002, -wR * 0.54, wR * 0.4, -PI / 2)
      rail(kit, group, x1 + 0.01, handguardLength - 0.02, by - hh / 2, 0, wR * 0.6, PI)
    } else {
      const material = o.hg === 'wood' ? M.wood : furn
      if (o.ak) {
        box(group, handguardLength, hh * 0.55, wR * 1.08, material, hx, by - hh * 0.22, 0)
        box(group, handguardLength * 0.75, hh * 0.35, wR * 0.7, material, hx - handguardLength * 0.1, by + r * 2.2, 0)
      } else {
        box(group, handguardLength, hh, wR * 1.08, material, hx, by - 0.002, 0)
        vents(kit, group, x1 + 0.01, handguardLength - 0.02, by + hh * 0.15, wR * 0.54 + 0.001, Math.round(handguardLength / 0.025), hh * 0.3)
        vents(kit, group, x1 + 0.01, handguardLength - 0.02, by + hh * 0.15, -wR * 0.54 - 0.001, Math.round(handguardLength / 0.025), hh * 0.3)
      }
    }
    if (!hasLongScope && !o.rail && o.ak) {
      box(group, 0.03, 0.016, wR * 0.6, M.metal, x1 + 0.02, by + r * 2.5 + 0.01, 0)
      box(group, 0.012, 0.004, wR * 0.5, M.dark, x1 + 0.03, by + r * 2.5 + 0.019, 0)
    }
  }
  if (hasLongScope) return
  const sightX = L - (o.ak ? 0.06 : 0.08)
  if (o.ak) {
    box(group, 0.022, 0.022, wR * 0.6, M.metal, sightX, by + 0.008, 0)
    box(group, 0.006, 0.024, 0.004, M.metal, sightX, by + 0.026, 0.008)
    box(group, 0.006, 0.024, 0.004, M.metal, sightX, by + 0.026, -0.008)
    box(group, 0.003, 0.016, 0.003, M.dark, sightX, by + 0.022, 0)
  } else if (!o.rail || o.carry) {
    box(group, 0.018, 0.014, wR * 0.55, M.dark, sightX, by + 0.008, 0)
    box(group, 0.012, 0.034, 0.008, M.dark, sightX, by + 0.03, 0, -0.25)
  } else box(group, 0.012, 0.024, 0.012, M.dark, sightX - 0.04, by + hR * 0.4 + 0.012, 0)
}
