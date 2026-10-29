import type { ImpactMaterial } from './blood'

/** What each material raises when hit: dust colour, chip colour and the number of sparks (W374-381). Zero means none. */
const TABLE: Readonly<Record<ImpactMaterial, { readonly dust: number; readonly chip: number; readonly spark: number }>> = {
  concrete: { dust: 0x8a857a, chip: 0x6e6a63, spark: 2 },
  metal: { dust: 0, chip: 0, spark: 18 },
  wood: { dust: 0x6a5038, chip: 0x7a5530, spark: 0 },
  glass: { dust: 0xbfd6e2, chip: 0xa8c8d8, spark: 0 },
  flesh: { dust: 0, chip: 0, spark: 0 },
  water: { dust: 0, chip: 0, spark: 0 },
}

export function sparkSpec(material: ImpactMaterial): { readonly dust: number; readonly chip: number; readonly spark: number } {
  return TABLE[material]
}
