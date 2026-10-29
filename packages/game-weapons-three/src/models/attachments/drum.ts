import type { Parent, ModelKit } from '../kit'

/** The drum magazine of the gallery (`mag: 'drum'`): the drum with its core, and the neck that goes into the well. Drawn in the frame of the magazine pivot. */
export function buildDrum(kit: ModelKit, magazine: Parent): void {
  const { M, box, cylinderZ } = kit
  cylinderZ(magazine, 0.075, 0.07, M.dark, 0.02, -0.085, 0, 22)
  cylinderZ(magazine, 0.05, 0.074, M.metal, 0.02, -0.085, 0, 18)
  box(magazine, 0.05, 0.04, 0.03, M.dark, 0, -0.02, 0)
}
