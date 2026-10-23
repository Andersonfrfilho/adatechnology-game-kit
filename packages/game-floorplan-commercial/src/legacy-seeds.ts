import type { FloorplanEngine } from '@adatechnology/game-floorplan'

/**
 * Names of the seeded random streams of the Portuguese SDK this pack replaces. They are kept so
 * that a plan generated from an old seed is identical; they never appear in the output.
 */
export const legacySeedKeys: Parameters<FloorplanEngine['registerSeedKeys']>[0] = {
  rooms: {
    counter: 'balcao',
    bathroom: 'banheiro',
    consulting_room: 'consultorio',
    office: 'escritorio',
    stockroom: 'estoque',
    shop: 'loja',
    backyard: 'quintal',
  },
  items: {},
}
