import type { Parent, ModelKit } from '../kit'

/** The belt box of the gallery's belt-fed rifles: the olive box with its lid and the loose cartridges of the belt on top. Drawn in the frame of the belt pivot. */
export function buildBeltBox(kit: ModelKit, belt: Parent): void {
  const { M, box, cylinderX } = kit
  box(belt, 0.11, 0.1, 0.08, M.olive, 0, 0, 0)
  box(belt, 0.112, 0.012, 0.082, M.dark, 0, 0.046, 0)
  for (let i = 0; i < 7; i++) {
    cylinderX(belt, 0.0042, 0.034, M.brass, -0.04 + i * 0.012, 0.07, 0.035, 10)
    box(belt, 0.006, 0.006, 0.012, M.metal, -0.04 + i * 0.012, 0.066, 0.035)
  }
}
