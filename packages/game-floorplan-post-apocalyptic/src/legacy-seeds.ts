/**
 * Names of the seeded random streams of the Portuguese SDK this pack replaces. They are kept so
 * that a plan generated from an old seed is identical; they never appear in the output.
 */
export const LEGACY_STREAMS = {
  distribution: 'estado',
  fortified: 'estado:protegida',
  abandoned: 'estado:abandonada',
} as const

/** Item id the original SDK hashed to colour the car of an abandoned house. */
export const legacyCarId = (n: number): string => 'estado.' + n + '.carro'
