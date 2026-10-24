import type { FloorplanEngine, ItemInput, PaletteDraw, PaletteEarly, PaletteStyleDef, SlotKit, SlotLibrary, TemplateDef } from '@adatechnology/game-floorplan'

/** What each place of the triage tent can hold, taken from the pins of the team's gallery scene (`TemplateDef.place` is `triage`). */
export type TriageFindsHint = {
  readonly id: string
  readonly room: string
  readonly container: string
  readonly tags: readonly string[]
}

const SIDE_WIDTH = 8
const TENT_DEPTH = 10
const COT_COLUMNS = 3
const COT_ROWS = 2
const COT_SPACING = 2.1
const CRATES = 6

export const triageTent: TemplateDef = {
  id: 'triage_tent', use: 'military', place: 'triage', construction: 'canvas', partyWalls: [], style: 'military_camp',
  limits: { w: [2 * SIDE_WIDTH, 2 * SIDE_WIDTH], d: [TENT_DEPTH, TENT_DEPTH] }, defaults: { w: 2 * SIDE_WIDTH, d: TENT_DEPTH },
  lot: null,
  floors: [{
    label: 'ground_floor', ceiling: 3.4,
    rooms: (_w, d) => [
      { id: 'clean_side', type: 'tent', label: 'clean_side', library: 'triage_clean_side', rect: [0, 0, SIDE_WIDTH, d] },
      { id: 'bitten_side', type: 'tent', label: 'bitten_side', library: 'triage_bitten_side', rect: [SIDE_WIDTH, 0, 2 * SIDE_WIDTH, d] },
    ],
    doors: (_w, _d) => [
      { a: 'clean_side', b: 'outside', side: 'front', at: SIDE_WIDTH / 2, width: 1.6 },
      { a: 'bitten_side', b: 'outside', side: 'front', at: SIDE_WIDTH * 1.5, width: 1.6 },
    ],
    windows: () => [],
  }],
}

export const triageItems: ItemInput[] = [
  { type: 'cot', category: 'cot', w: 0.8, d: 1.9, h: 0.45, exactOnly: true },
  { type: 'medical_crate', category: 'medical_crate', w: 0.7, d: 0.7, h: 0.7, exactOnly: true },
  { type: 'rifle_trestle', category: 'rifle_trestle', w: 1, d: 1.6, h: 1.2, exactOnly: true },
]

const cotPoint = (column: number, row: number): { fx: number; fz: number } => ({ fx: (1.6 + column * COT_SPACING - 0.075) / (SIDE_WIDTH - 0.15), fz: (TENT_DEPTH - 3 - row * 3.6 - 0.075) / (TENT_DEPTH - 0.15) })

export function createTriageLibraries(kit: SlotKit): Record<string, SlotLibrary> {
  const { center, corner } = kit
  const cots = (): ReturnType<typeof center>[] => Array.from({ length: COT_COLUMNS * COT_ROWS }, (_, index) => center('cot_' + index, 0, 0, [0.8, 1.9], { '=cot': 1 }, { required: true, facing: 'v+', clearance: 0, slide: 0, ...cotPoint(index % COT_COLUMNS, Math.floor(index / COT_COLUMNS)) }))
  return {
    triage_clean_side: () => [...cots(), corner('rifle_trestle', 'front-left', [1, 1.6], { '=rifle_trestle': 1 }, { required: true, facing: 'u+', clearance: 0.3 })],
    triage_bitten_side: () => [
      ...cots(),
      ...Array.from({ length: CRATES }, (_, index) => center('crate_' + index, 0, 0, [0.7, 0.7], { '=medical_crate': 1 }, { required: true, clearance: 0, slide: 0, fx: (SIDE_WIDTH - 0.8 - 0.075) / (SIDE_WIDTH - 0.15), fz: (0.8 + index * 0.9 - 0.075) / (TENT_DEPTH - 0.15) })),
    ],
  }
}

export const triageFindsHints: readonly TriageFindsHint[] = [
  { id: 'triage.medical_crates', room: 'bitten_side', container: 'medical_crate', tags: ['bandages', 'morphine', 'military_rations'] },
  { id: 'triage.rifles', room: 'clean_side', container: 'rifle_trestle', tags: ['rifle_556', 'magazines', 'near_the_exit'] },
]

/** Palette recipe of the military camp: army greens on the facade, dusty neutrals inside (the same roles every palette style must define). */
function createMilitaryCampPalette(): PaletteStyleDef {
  return {
    seedKey: 'militar',
    facadeColors: [['army_green', 75, 0.25, 0.28], ['olive_drab', 70, 0.2, 0.32]],
    early({ base, H0, H1, jit, hsl }: PaletteDraw): PaletteEarly {
      const roles = {
        facade: hsl(H0, base[2], base[3]),
        facade_detail: hsl(H1, jit(0.25, 0.1), jit(0.3, 0.1)),
        wall: hsl(H0, base[2] * 0.7, Math.max(0.25, Math.min(0.6, base[3]))),
        gate: hsl(220, 0.04, 0.1),
        roof: hsl(H0, 0.2, 0.3),
        ceiling: hsl(H0, 0.1, 0.55),
      }
      const generalFloor: [number, number, number] = [jit(35, 8), jit(0.12, 0.08), jit(0.38, 0.06)]
      return { wallMode: false, sMax: 0.12, roles, generalFloor }
    },
    late({ H1, H2, jit, hsl }) {
      return {
        wood: hsl(jit(30, 6), jit(0.35, 0.1), jit(0.32, 0.06)),
        fabric_main: hsl(H1, jit(0.2, 0.1), jit(0.4, 0.1)),
        fabric_accent: hsl(H2, jit(0.25, 0.05), jit(0.38, 0.1)),
        picture_accent: hsl(H2, jit(0.4, 0.1), jit(0.4, 0.08)),
        metal: hsl(220, 0.05, 0.2),
        exterior_floor: hsl(35, 0.1, jit(0.5, 0.05)),
        lawn: hsl(jit(90, 12), 0.3, 0.3),
        dirt: hsl(28, 0.3, 0.34),
        deck_floor: hsl(jit(28, 4), 0.35, 0.36),
        water: hsl(190, 0.5, 0.5),
      }
    },
  }
}

/** Military camp style: wire fence, canvas facade in army greens and its own palette. */
export function registerTriageStyle(engine: FloorplanEngine): void {
  engine.registerStyle({
    id: 'military_camp', height: 1.4, fenceHeight: 1.4,
    front: { type: { fence: 1 }, top: { barbed_wire: 1 } }, sideYard: { type: { fence: 1 }, top: { barbed_wire: 1 } }, back: { type: { fence: 1 }, top: { barbed_wire: 1 } },
    gate: { garage: { sliding: 1 } },
    facade: { finish: { canvas: 1 }, grilles: 0, roof: { canvas: 1 } },
    grounds: { garden: { dirt: 1 }, parking: { dirt: 1 }, backyard: { dirt: 1 }, side_yard: { dirt: 1 } },
    swatches: [['army_green', '#4f5638'], ['olive_drab', '#5a6146']],
  })
  engine.registerPaletteStyle('military_camp', createMilitaryCampPalette())
}
