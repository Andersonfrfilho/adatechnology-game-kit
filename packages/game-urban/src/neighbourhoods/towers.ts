import type { DowntownParams } from './composers'
import type { NeighbourhoodPattern } from './types'

/**
 * The financial district: the avenue of the downtown pattern with lots wide enough for a tower (20 m) and heights from 70 to 180 m. A pack for a game
 * to add (`createUrban({ packs: { neighbourhoods: TOWER_PATTERNS }, towers: true })`); with `towers` off the same numbers draw tall boxes. It is not
 * in `DEFAULT_PATTERNS`, so the Galeria's sample sheet is the one of the page.
 */
const financialDistrict: NeighbourhoodPattern<DowntownParams> = {
  id: 'financial_district',
  streetWidth: 16,
  walkWidth: 4,
  typologies: ['office_tower', 'residential_tower'],
  pole: 'led_double',
  lightColor: 0xdfe8ff,
  spacing: 25,
  lit: 1,
  compose: 'downtown',
  marker: { height: 40 },
  text: {
    'pt-BR': { label: 'Distrito financeiro', title: 'DISTRITO FINANCEIRO', caption: 'avenida 2 × 8 m · torres de 70 a 180 m', detail: 'Torres de escritórios e residenciais de 70 a 180 m. Poste metálico duplo, LED branco.' },
    en: { label: 'Financial district', title: 'FINANCIAL DISTRICT', caption: 'avenue 2 × 8 m · towers of 70 to 180 m', detail: 'Office and residential towers of 70 to 180 m. Double steel pole, white LED.' },
  },
  params: {
    roadLength: 110,
    roadColor: 0x222428,
    median: { width: 1.6, height: 0.18, color: 0x3a4a2c },
    poles: { from: -50, to: 50 },
    buildings: { perRow: 4, first: -39, pitch: 26, rowOffset: 24, size: 20, north: { minHeight: 90, range: 90, lit: 0.12 }, south: { minHeight: 70, range: 80, lit: 0.1 } },
    walks: { offset: 14, length: 110 },
    car: { dx: -8, dz: -3, ry: 1.57, color: 0x6b6450 },
  },
}

/** The patterns of the tower pack. */
export const TOWER_PATTERNS: readonly NeighbourhoodPattern<any>[] = [financialDistrict]

/** Where the sample sheet puts them (pass it as `cells`). */
export const TOWER_SAMPLE_CELLS: Readonly<Record<string, { x: number; z: number }>> = { financial_district: { x: 160, z: 56 } }
