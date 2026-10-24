import type { MaterialId } from '@adatechnology/game-contracts'

/** kg/m3 the plan structure weighs its parts with (the table of the Visor de casas 3D; a material outside it weighs like soft wood). */
export const DENSITY: Readonly<Record<string, number>> = {
  steel: 7850, cast_iron: 7200, aluminium: 2700, copper: 8900, wood_soft: 500, wood_hard: 800, plywood: 600, mdf: 750, glass: 2500,
  tempered_glass: 2500, ceramic: 2000, concrete: 2400, brick: 1800, plaster: 1000, stone: 2600, plastic: 950, rubber: 1100, fabric: 400,
  foam: 30, leather: 900, paper: 800, foliage: 100, green_wood: 900, cactus: 700, flesh_fruit: 900, wax: 900, soil: 1600,
}
export const DEFAULT_DENSITY = 500

export const densityOf = (material: MaterialId): number => DENSITY[material] ?? DEFAULT_DENSITY
