import type { PartSpec } from '@adatechnology/game-contracts'

/**
 * How much of a drawn block is material (`PartSpec.fill`): the builders draw a piece as solid blocks, but a real wardrobe is boards around air, a fridge is a steel and
 * plastic skin around insulation and shelves, a sofa cushion is foam in a cloth cover. Without this the mass of the destruction world (density x volume) made a three-seat
 * sofa weigh 506 kg and a wardrobe 1.5 t. A block thicker than twice the skin of its material is a shell of that skin (the skin is what the thing is made of: an 18 mm
 * board, a 4 mm moulded plastic wall, a 1.2 mm steel sheet); a thinner one is solid (a shelf, a table leg, a sheet of glass). Upholstery (`fabric`) thicker than a cloth
 * is foam (`FOAM_DENSITY`) in a 3 mm cover. Materials that are solid through (paper, stone, concrete, soil...) keep `fill` 1.
 */

/** Skin of a hollow block of each material, metres. */
export const STRUCTURE_SKIN: Readonly<Record<string, number>> = {
  wood_hard: 0.018,
  wood_soft: 0.018,
  plywood: 0.015,
  mdf: 0.018,
  plastic: 0.004,
  rubber: 0.005,
  steel: 0.0012,
  aluminium: 0.002,
  cast_iron: 0.006,
  copper: 0.001,
  glass: 0.005,
  tempered_glass: 0.006,
  ceramic: 0.008,
}

/** Upholstery: a foam core (kg/m³, the `foam` of game-destruction) in a cloth cover this thick. */
export const FOAM_DENSITY = 30
export const FABRIC_DENSITY = 400
export const UPHOLSTERY_COVER = 0.003

const shellFraction = (shape: PartSpec['shape'], skin: number): number => {
  if (shape.kind === 'box') {
    const [a, b, c] = shape.size
    const inner = Math.max(0, a - 2 * skin) * Math.max(0, b - 2 * skin) * Math.max(0, c - 2 * skin)
    return 1 - inner / (a * b * c)
  }
  if (shape.kind === 'cylinder') {
    const { radius: r, height: h } = shape
    const inner = Math.max(0, r - skin) ** 2 * Math.max(0, h - 2 * skin)
    return 1 - inner / (r * r * h)
  }
  return 1 - (Math.max(0, shape.radius - skin) / shape.radius) ** 3
}

const thinnest = (shape: PartSpec['shape']): number =>
  shape.kind === 'box' ? Math.min(...shape.size) : shape.kind === 'cylinder' ? Math.min(shape.radius * 2, shape.height) : shape.radius * 2

/** `fill` of a block of `material` drawn as `shape` (1: solid through). */
export function structureFill(material: string, shape: PartSpec['shape']): number {
  if (material === 'fabric') {
    if (thinnest(shape) <= 4 * UPHOLSTERY_COVER) return 1
    const cover = shellFraction(shape, UPHOLSTERY_COVER)
    return cover + (1 - cover) * (FOAM_DENSITY / FABRIC_DENSITY)
  }
  const skin = STRUCTURE_SKIN[material]
  if (skin === undefined || thinnest(shape) <= 3 * skin) return 1
  return shellFraction(shape, skin)
}
