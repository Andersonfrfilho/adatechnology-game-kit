/** What the bench turns on or off in the presentation of the weapon: the ejected casings, the dropped magazines, the muzzle flash, the accessory models and the light and laser beams. */
export interface FxLayers {
  casings: boolean
  magazines: boolean
  muzzleFlash: boolean
  attachments: boolean
  beams: boolean
}

export const createLayers = (): FxLayers => ({ casings: true, magazines: true, muzzleFlash: true, attachments: true, beams: true })
