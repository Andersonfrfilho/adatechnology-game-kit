import type { ExplosionDef } from '../src'

/** A small made-up profile that touches every layer; the real profiles are checked against the Lab in `team-golden.test.ts`. */
export const TEST_BLAST: ExplosionDef = {
  id: 'test_blast',
  lethal: 5,
  injury: 15,
  visualRadius: 1.3,
  fireballs: 10,
  smoke: { color: 0x6a655f, count: 8, life: 5 },
  dust: { color: 0x7d7368, count: 10 },
  shrapnel: { count: 20, kind: 0, speed: 30, embers: 6 },
  chunks: { count: 6, colors: [0x3b3a38, 0x2c2b2a], hot: 1 },
  mark: { scorch: 1.7, crater: 0.9, dent: 0.25 },
  flash: { light: 45 },
  shake: 1.1,
  push: 9,
  mushroom: { height: 4, radius: 1.5, count: 10, stem: 5, life: 6 },
  residualFires: [{ radius: 1, life: 4, rate: 20 }],
  ignite: 4,
  sources: ['test'],
}

export const TEST_CATALOGUE = { test_blast: TEST_BLAST } as const
