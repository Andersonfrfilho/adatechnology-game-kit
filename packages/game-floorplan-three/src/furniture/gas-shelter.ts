/** A box of the shelter, in the cylinder's frame (metres): `front` is along the way the shelter's door faces, `across` along the wall it is backed on. */
export interface ShelterBox {
  readonly part: 'wall' | 'roof' | 'door' | 'louvre'
  readonly front: readonly [number, number]
  readonly across: readonly [number, number]
  readonly y: readonly [number, number]
}

/** The shelter of a cooking gas cylinder as the plan gives it (NBR 13523): its square side and its height, metres. */
export interface ShelterSize {
  readonly side: number
  readonly height: number
}

/** Concrete of the shelter's walls and roof, metres. */
const WALL = 0.04
/** The roof stands out past the walls at the front and the sides, metres. */
const EAVE = 0.03
const ROOF = 0.05
/** How far the back of the shelter stands off the planned line of the house wall it is backed on: clear of the render's face whatever the wall's thickness. */
export const SHELTER_OFF_WALL = 0.025
/** The door is set back from the walls' front faces, its sides off the walls, and its louvres stand proud of it (never a face on another's plane). */
const DOOR = { recess: 0.012, thick: 0.02, side: 0.004, bottom: 0.03 } as const
const LOUVRE = { proud: 0.003, slat: 0.012, pitch: 0.025, count: 4 } as const

/**
 * The ventilated shelter of a cooking gas cylinder (NBR 13523): back and side walls and a roof of concrete, a metal door at the front with louvres low and high
 * (the gas is heavier than air: it leaves by the low ones, air comes in by the high ones). Boxes in the cylinder's frame, the cylinder at the origin; the back
 * stands `SHELTER_OFF_WALL` off the house wall. Walls butt with their faces back to back, the door and the louvres stand off every other face.
 */
export function gasShelterBoxes({ side, height }: ShelterSize): ShelterBox[] {
  const half = side / 2, back = -half + SHELTER_OFF_WALL
  const boxes: ShelterBox[] = [
    { part: 'wall', front: [back, back + WALL], across: [-half, half], y: [0, height] },
    { part: 'wall', front: [back + WALL, half], across: [-half, -half + WALL], y: [0, height] },
    { part: 'wall', front: [back + WALL, half], across: [half - WALL, half], y: [0, height] },
    { part: 'roof', front: [back, half + EAVE], across: [-half - EAVE, half + EAVE], y: [height, height + ROOF] },
  ]
  const doorFace = half - DOOR.recess, doorAcross: readonly [number, number] = [-half + WALL + DOOR.side, half - WALL - DOOR.side]
  boxes.push({ part: 'door', front: [doorFace - DOOR.thick, doorFace], across: doorAcross, y: [DOOR.bottom, height - DOOR.bottom] })
  const slats = (from: number): ShelterBox[] =>
    Array.from({ length: LOUVRE.count }, (_, k) => ({ part: 'louvre' as const, front: [doorFace, doorFace + LOUVRE.proud] as const, across: [doorAcross[0] + 0.03, doorAcross[1] - 0.03] as const, y: [from + k * LOUVRE.pitch, from + k * LOUVRE.pitch + LOUVRE.slat] as const }))
  boxes.push(...slats(DOOR.bottom + 0.04), ...slats(height - DOOR.bottom - 0.04 - (LOUVRE.count - 1) * LOUVRE.pitch - LOUVRE.slat))
  return boxes
}
