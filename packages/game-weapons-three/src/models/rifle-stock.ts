import { buttpad, swivel } from './details'
import type { RifleContext } from './rifle-context'

/** The stock by kind, in the order the page draws them. `magazineX` places the magazine well plate of the one-piece stock. */
export function buildStock(context: RifleContext, magazineX: number): void {
  const { kit, group, options: o, furniture: furn, length: L, stockLength: S, receiverStart: x0, receiverEnd: x1, receiverHeight: hR } = context
  const { M, box, cylinderX } = kit
  if (context.isTraditional) {
    buttpad(kit, group, 0.006, -0.04, 0.13, 0.038)
    box(group, 0.03, 0.13, 0.038, furn, 0.024, -0.04, 0)
    box(group, S, 0.055, 0.034, furn, S / 2, -0.012, 0, 0.06)
    box(group, 0.09, 0.05, 0.032, furn, x0 - 0.02, -0.035, 0, 0.25)
    const forendLength = x1 - x0 + (L - x1) * (o.fore ?? 0.62)
    if (forendLength > 0) box(group, forendLength, 0.045, 0.04, furn, x0 + forendLength / 2, -hR / 2 + 0.004, 0)
    if (o.stock === 'straight') box(group, 0.15, 0.04, 0.035, furn, x1 + 0.08, -hR / 2, 0)
    box(group, 0.04, 0.004, 0.03, M.metal, magazineX, -hR / 2 - 0.022, 0)
    swivel(kit, group, 0.2, -0.08)
    swivel(kit, group, x1 + (L - x1) * 0.45, -hR / 2 - 0.03)
    if (o.bands) for (const fraction of [0.35, 0.75]) cylinderX(group, 0.024, 0.008, M.metal, x1 + (L - x1) * fraction * (o.fore || 0.62), -0.004, 0, 16)
  } else if (o.stock === 'fixed' || o.stock === 'wood') {
    box(group, S, 0.05, 0.03, furn, S / 2, -0.008, 0, 0.05)
    box(group, 0.03, 0.13, 0.036, furn, 0.022, -0.035, 0)
    buttpad(kit, group, 0.004, -0.035, 0.13, 0.036)
    if (o.stock === 'wood') box(group, S * 0.6, 0.03, 0.028, furn, S * 0.55, -0.045, 0, 0.2)
    swivel(kit, group, 0.08, -0.09)
  } else if (o.stock === 'skeleton') {
    box(group, S, 0.014, 0.026, furn, S / 2, 0.012, 0, 0.03)
    box(group, S, 0.014, 0.026, furn, S / 2, -0.05, 0, -0.08)
    box(group, 0.03, 0.12, 0.034, furn, 0.02, -0.025, 0)
    buttpad(kit, group, 0.004, -0.025, 0.12, 0.034)
  } else if (o.stock === 'retract') {
    cylinderX(group, 0.013, S, M.metal, S / 2, 0, 0, 16)
    for (let i = 0; i < 5; i++) box(group, 0.003, 0.003, 0.008, M.dark, S * 0.2 + i * 0.015, -0.013, 0)
    box(group, 0.034, 0.11, 0.036, furn, 0.02, -0.025, 0)
    box(group, S * 0.55, 0.032, 0.03, furn, S * 0.35, 0, 0)
    buttpad(kit, group, 0.003, -0.025, 0.11, 0.036)
  } else if (o.stock === 'fold') {
    box(group, S, 0.006, 0.006, M.metal, S / 2, 0.01, 0.012)
    box(group, S, 0.006, 0.006, M.metal, S / 2, -0.04, 0.012, -0.12)
    box(group, 0.012, 0.1, 0.03, M.metal, 0.006, -0.02, 0.012)
  }
}
