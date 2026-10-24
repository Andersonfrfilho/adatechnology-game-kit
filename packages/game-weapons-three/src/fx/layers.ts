/** What the bench turns on or off in the presentation of the weapon: the ejected casings, the dropped magazines and the muzzle flash. */
export interface FxLayers {
  casings: boolean
  magazines: boolean
  muzzleFlash: boolean
}

export const createLayers = (): FxLayers => ({ casings: true, magazines: true, muzzleFlash: true })
