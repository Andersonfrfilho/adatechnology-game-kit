import { buttpad, swivel } from './details'
import type { RifleContext } from './rifle-context'
import { profileSolid } from './wood-profile'

// The one-piece sporter stock of the bolt-action hunting and sniper rifles as their reference photos show it (Remington 700, M24, Steyr SSG 69; Wikimedia Commons):
// metres in the model's frame, x from the butt to the muzzle, y up.

/**
 * The stock cut from its side profile as one smooth solid: the butt dropping from the comb to the toe, the wrist narrowing into the pistol-grip swell behind the trigger, the bedding under the
 * receiver and the forend tapering under the barrel; the buttpad, the floorplate of the magazine, the grip cap and the sling swivels.
 */
export function buildSporterStock(context: RifleContext, magazineX: number): void {
  const { kit, group, furniture: furn, length: L, stockLength: S, receiverEnd: x1, receiverHeight: hR } = context
  const { M, box } = kit
  const forendTip = x1 + (L - x1) * (context.options.fore ?? 0.5)
  const bottom = -hR / 2
  // the bedding rises to hold the receiver: the round action of a bolt rifle sits lower than the box of the others
  const bedTop = context.options.round ? context.barrelY - hR * 0.36 + 0.003 : bottom + 0.012
  profileSolid(
    kit,
    group,
    [
      [0.006, -0.016, -0.15],
      [0.14, -0.012, -0.118],
      [S - 0.11, -0.016, -0.084],
      [S - 0.05, -0.018, -0.114],
      [S - 0.01, -0.016, -0.09],
      [S + 0.03, bedTop, bottom - 0.03],
      [x1, bedTop, bottom - 0.026],
      [x1 + 0.08, bedTop, bottom - 0.024],
      [forendTip, bottom + 0.02, bottom - 0.012],
    ],
    0.04,
    furn,
  )
  buttpad(kit, group, 0.0, -0.083, 0.136, 0.04)
  box(group, 0.024, 0.006, 0.03, M.dark, S - 0.05, -0.116, 0, -0.5)
  const guard = kit.torus(group, new kit.THREE.TorusGeometry(0.024, 0.0025, 6, 16, Math.PI), M.metal, S + 0.075, bottom - 0.022, 0)
  guard.rotation.z = Math.PI
  box(group, 0.07, 0.004, 0.03, M.metal, magazineX, bottom - 0.03, 0)
  swivel(kit, group, 0.12, -0.12)
  swivel(kit, group, forendTip - 0.05, bottom - 0.02)
}

// The Kalashnikov's wooden stock as the AK-47, AKM and RPK photos show it (Wikimedia Commons): a wedge from the rear of the receiver to the steel buttplate.

/** The wedge: the comb falling a little and the belly falling a lot from the receiver to the butt, the steel buttplate and the sling loop. */
export function buildKalashnikovStock(context: RifleContext): void {
  const { kit, group, furniture: furn, stockLength: S, receiverHeight: hR } = context
  const { M, box } = kit
  profileSolid(kit, group, [[0.008, -0.034, -0.15], [S * 0.5, -0.014, -0.1], [S + 0.004, hR * 0.2, -hR / 2 - 0.002]], 0.036, furn)
  box(group, 0.008, 0.118, 0.038, M.metal, 0.004, -0.092, 0, -0.06)
  // the sling loop on the left of the butt, a little above the belly
  const loopX = 0.1
  const belly = -0.15 + ((loopX - 0.008) / (S * 0.5 - 0.008)) * 0.05
  box(group, 0.03, 0.006, 0.006, M.metal, loopX, belly + 0.032, -0.019, 0.3)
}
