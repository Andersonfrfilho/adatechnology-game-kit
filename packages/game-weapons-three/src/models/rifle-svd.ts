import { buttpad } from './details'
import type { RifleContext } from './rifle-context'
import { profileSolid } from './wood-profile'

// The SVD Dragunov as the reference photo shows it (Wikimedia Commons, SVD Dragunov.jpg): metres in the model's frame, x from the butt to the muzzle, y up.

/**
 * The thumbhole stock: the comb running back from the receiver with the cheek rest on it, the butt behind the hole and the bottom bar that closes the hole under it, joining the
 * foot of the pistol grip. The grip the generic builder draws is the front edge of the hole.
 */
export function buildSvdStock(context: RifleContext): void {
  const { kit, group, furniture: furn, stockLength: S } = context
  const width = 0.034
  // one solid from the butt to the foot of the grip, the thumbhole cut through it
  profileSolid(
    kit,
    group,
    [
      [0.006, 0.02, -0.142],
      [0.07, 0.022, -0.13],
      [0.16, 0.024, -0.122],
      [S - 0.03, 0.027, -0.124],
      [S + 0.006, 0.028, -0.128],
      [S + 0.035, -0.02, -0.13],
    ],
    width,
    furn,
    [[0.125, -0.02], [0.2, -0.018], [S - 0.01, -0.022], [S + 0.012, -0.05], [S - 0.01, -0.094], [0.2, -0.095], [0.125, -0.09], [0.112, -0.055]],
  )
  profileSolid(kit, group, [[0.06, 0.044, 0.016], [0.11, 0.05, 0.016], [0.2, 0.046, 0.016]], width * 0.9, furn)
  buttpad(kit, group, 0.003, -0.06, 0.16, width)
}

/** The chunky two-piece wooden handguard with its three slots a side, the band in front of it and the gas block over the barrel. */
export function buildSvdHandguard(context: RifleContext): void {
  const { kit, group, furniture: furn, receiverEnd: x1, receiverWidth: wR, barrelRadius: r, barrelY: by } = context
  const { M, box, cylinderX } = kit
  const length = 0.27
  profileSolid(kit, group, [[x1, by + 0.024, by - 0.03], [x1 + 0.06, by + 0.026, by - 0.03], [x1 + length, by + 0.02, by - 0.024]], wR * 1.12, furn)
  for (let i = 0; i < 3; i++) for (const side of [-1, 1]) box(group, 0.028, 0.008, 0.002, M.hole, x1 + 0.07 + i * 0.06, by + 0.004, side * wR * 0.57)
  cylinderX(group, wR * 0.5, 0.012, M.metal, x1 + length + 0.006, by, 0, 16)
  cylinderX(group, r * 1.2, 0.05, M.metal, x1 + length + 0.035, by + r * 2.4, 0, 12)
  box(group, 0.016, r * 3.4, wR * 0.5, M.metal, x1 + length + 0.05, by + r * 1.2, 0)
}
