import type { FloorplanEngine } from '@adatechnology/game-floorplan'

/** Names of the seeded streams of the Portuguese SDK for the rooms this pack adds; they keep old seeds reproducible and never appear in the output. */
export const legacySeedKeys: Parameters<FloorplanEngine['registerSeedKeys']>[0] = {
  rooms: {
    porch: 'alpendre',
    pantry: 'despensa',
    bedroom_4: 'quarto4',
    bathroom_guest: 'banheiro_up',
    loft_bedroom: 'quarto_loft',
    tent_1: 'barraca1',
    tent_2: 'barraca2',
    tent_3: 'barraca3',
    tent_4: 'barraca4',
    campsite: 'acampamento',
  },
}
