import { scope } from './details'
import type { RifleContext } from './rifle-context'

/** What is bolted on after the stock: optic, carry handle, bipod, bolt handle, lever, magazine tube, pump, heat shield, bayonet lug and cleaning rod. */
export function buildFittings(context: RifleContext, gripX: number): void {
  const { kit, group, parts, options: o, furniture: furn, length: L, receiverStart: x0, receiverEnd: x1, receiverHeight: hR, receiverWidth: wR, barrelRadius: r, barrelY: by } = context
  const { M, box, cylinderX, cylinderZ, sphere } = kit
  const middle = (x0 + x1) / 2
  if (o.scope) scope(kit, group, o.scope, middle + 0.03, hR / 2 + (o.rail ? 0.006 : 0), o.scope === 4 ? -0.02 : 0)
  if (o.carry) {
    box(group, 0.15, 0.026, 0.014, M.metal, middle, hR / 2 + 0.03, 0)
    box(group, 0.012, 0.03, 0.014, M.metal, middle + 0.07, hR / 2 + 0.014, 0)
    box(group, 0.012, 0.03, 0.014, M.metal, middle - 0.07, hR / 2 + 0.014, 0)
  }
  if (o.bipod) {
    const bx = x1 + (L - x1) * 0.45
    cylinderX(group, 0.008, 0.02, M.dark, bx + 0.04, by - 0.012, 0, 12)
    for (const side of [-1, 1]) {
      const leg = kit.pivot(group, bx + 0.04, by - 0.012, side * 0.012)
      leg.rotation.set(side * 0.15, 0, -0.35)
      box(leg, 0.006, 0.2, 0.006, M.dark, 0, -0.1, 0)
      box(leg, 0.01, 0.006, 0.01, M.rubber, 0, -0.2, 0)
    }
  }
  if (o.bolt) {
    const handle = kit.pivot(group, x1 - 0.045, by, 0)
    parts.boltHandle = handle
    parts.boltHandleRest = handle.position.x
    cylinderZ(handle, 0.0042, 0.05, M.steelL, 0, 0, wR / 2 + 0.022, 12)
    sphere(handle, 0.0095, M.dark, 0, -0.004, wR / 2 + 0.048, 1)
    cylinderX(group, hR * 0.3, 0.03, M.steel, x0 + 0.005, by, 0, 16)
  }
  if (o.lever) {
    const lever = kit.pivot(group, gripX - 0.02, -hR / 2 - 0.01, 0)
    parts.lever = lever
    box(lever, 0.11, 0.006, 0.012, M.metal, 0.055, -0.052, 0)
    box(lever, 0.006, 0.05, 0.012, M.metal, 0.003, -0.028, 0)
    box(lever, 0.006, 0.05, 0.012, M.metal, 0.108, -0.028, 0)
    box(lever, 0.04, 0.006, 0.012, M.metal, 0.08, -0.002, 0)
    box(group, 0.03, 0.012, 0.003, M.dark, x1 - 0.04, by, wR / 2 + 0.001)
  }
  if (o.tube) {
    const tubeLength = (L - x1) * (o.tubeLen || 0.8)
    cylinderX(group, 0.0105, tubeLength, M.metal, x1 + tubeLength / 2, by - 0.023, 0, 16)
    cylinderX(group, 0.0125, 0.02, M.dark, x1 + tubeLength + 0.006, by - 0.023, 0, 16)
  }
  if (o.pump) {
    const pump = kit.pivot(group)
    parts.pump = pump
    box(pump, 0.17, 0.042, 0.046, furn, x1 + 0.14, by - 0.022, 0)
    for (let i = 0; i < 8; i++) box(pump, 0.006, 0.044, 0.048, M.dark, x1 + 0.07 + i * 0.02, by - 0.022, 0)
  }
  if (o.heat) {
    cylinderX(group, r * 1.75, (L - x1) * 0.7, M.dark, x1 + (L - x1) * 0.4, by, 0, 12)
    for (let i = 0; i < 10; i++) box(group, 0.008, r * 1.5, 0.004, M.hole, x1 + (L - x1) * (0.1 + i * 0.06), by + r * 0.8, r * 1.5)
  }
  if (o.bayo) box(group, 0.025, 0.008, 0.01, M.metal, L - 0.07, by - 0.016, 0)
  if (o.rod) cylinderX(group, 0.003, (L - x1) * 0.85, M.steel, x1 + (L - x1) * 0.45, by - 0.014, 0, 8)
}
