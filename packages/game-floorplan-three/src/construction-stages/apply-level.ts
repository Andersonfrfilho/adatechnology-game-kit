import type * as THREE_NS from 'three'
import { BLUEPRINT_LINES } from './blueprint.js'
import { SPOIL_HEAP } from './installations-stage.js'

export const CONSTRUCTION_LEVEL_MAX = 8

export interface ConstructionLevelInfo {
  readonly level: number
  readonly title: string
  readonly description: string
}

const LEVELS_PT: readonly ConstructionLevelInfo[] = [
  {
    level: 0,
    title: '0 · Planta e Gabarito',
    description: 'Marcação da planta baixa no terreno, tabeiras do gabarito, eixos de paredes e locação dos pilares.',
  },
  {
    level: 1,
    title: '1 · Fundação e Baldrame',
    description: 'Sapatas, estacas, vigas baldrame de concreto armado, contrapiso/radier e ferros de espera (CA-50).',
  },
  {
    level: 2,
    title: '2 · Estrutura (Pilares, Vigas e Lajes)',
    description: 'Esqueleto estrutural: pilares de concreto/madeira, vigas cintas de amarração, vergas, contravergas e lajes.',
  },
  {
    level: 3,
    title: '3 · Alvenaria / Vedação no Osso',
    description: 'Levantamento das paredes no osso (fiadas de tijolo baiano, blocos de concreto, wood-frame ou toras) entre os pilares.',
  },
  {
    level: 4,
    title: '4 · Instalações (Água, Esgoto, Luz e Gás)',
    description: 'Caixa d’água, tubulações de água fria e esgoto, eletrodutos corrugados, quadro de disjuntores, padrão de entrada e gás P13.',
  },
  {
    level: 5,
    title: '5 · Reboco, Pisos e Rodapés',
    description: 'Chapisco, emboço, reboco e pintura das paredes, pisos cerâmicos/madeira, forro/teto, rodapés e calçada perimetral.',
  },
  {
    level: 6,
    title: '6 · Esquadrias (Portas, Janelas e Guarda-Corpos)',
    description: 'Batentes, folhas de portas, fechaduras, caixilhos de janelas, vidros, grades e guarda-corpos.',
  },
  {
    level: 7,
    title: '7 · Madeiramento do Telhado',
    description: 'Pontaletes sobre a laje, terças, cumeeira, espigões, caibros e ripas: a estrutura de madeira pronta para receber as telhas.',
  },
  {
    level: 8,
    title: '8 · Telhas e Casa Completa',
    description: 'Telhas, rufos, calhas e condutores, painéis solares, louças e metais, móveis, eletrodomésticos, iluminação, quintal e muros do lote.',
  },
]

const LEVELS_EN: readonly ConstructionLevelInfo[] = [
  {
    level: 0,
    title: '0 · Blueprint & Batter Boards',
    description: '2D floorplan layout lines on the lot terrain, wooden batter boards, wall axes and column markers.',
  },
  {
    level: 1,
    title: '1 · Foundation & Grade Beams',
    description: 'Footing piers, reinforced concrete grade beams (baldrame), ground slab/raft and starter rebar cages.',
  },
  {
    level: 2,
    title: '2 · Structural Frame (Columns, Beams & Slabs)',
    description: 'Columns, top bond beams, slab beams, concrete lintels, window sill beams and upper structural slabs.',
  },
  {
    level: 3,
    title: '3 · Bare Masonry & Wall Framing',
    description: 'Unplastered brick courses, concrete blocks, wood-frame studs, timber logs or corrugated sheets between columns.',
  },
  {
    level: 4,
    title: '4 · Rough-In Utilities (Water, Sewer, Power & Gas)',
    description: 'Water tank, wall-routed cold water & sewer PVC pipes, corrugated electrical conduits, breaker panel, meter and LPG cylinder.',
  },
  {
    level: 5,
    title: '5 · Plaster, Floors & Baseboards',
    description: 'Wall plaster and paint, room floors, ceilings, ceramic baseboards and perimeter protective sidewalk.',
  },
  {
    level: 6,
    title: '6 · Openings (Doors, Windows & Guardrails)',
    description: 'Door frames, leaves and handles, window frames, glass panes, security grilles and guardrails.',
  },
  {
    level: 7,
    title: '7 · Roof Framing',
    description: 'Posts on the slab, purlins, ridge beam, hips, rafters and battens: the timber frame ready for the tiles.',
  },
  {
    level: 8,
    title: '8 · Tiles & Complete House',
    description: 'Roof tiles, flashings, gutters and downspouts, solar panels, fixtures, furniture, appliances, lighting, yard and lot perimeter.',
  },
]

export function clampConstructionLevel(level: number): number {
  if (!Number.isFinite(level)) return CONSTRUCTION_LEVEL_MAX
  return Math.max(0, Math.min(CONSTRUCTION_LEVEL_MAX, Math.round(level)))
}

export function constructionLevelInfo(level: number, locale = 'pt-BR'): ConstructionLevelInfo {
  const idx = clampConstructionLevel(level)
  const table = locale.toLowerCase().startsWith('pt') ? LEVELS_PT : LEVELS_EN
  return table[idx] ?? table[CONSTRUCTION_LEVEL_MAX]!
}

export interface ApplyConstructionLevelOptions {
  readonly waterLayer?: boolean
  readonly roofLayer?: boolean
  readonly lotLayer?: boolean
}

function stageVisible(stage: string, level: number, opts: ApplyConstructionLevelOptions): boolean {
  switch (stage) {
    case 'installations':
      return level >= 4
    case 'finishes':
      return level >= 5
    case 'openings':
      return level >= 6
    case 'roof':
      return level >= 8 && opts.roofLayer !== false
    case 'furniture':
      return level >= 8
    case 'perimeter':
      return level >= 8 && opts.lotLayer !== false
    default:
      return true
  }
}

/**
 * The runs cut into the masonry and the boxes they end in: laid in the rough-in stage and there from then on, in their chases under the render (the render covers
 * them, nothing hides them by level): a wall broken open shows them where they run.
 */
const EMBEDDED = new Set(['wall_pipe', 'wall_conduit', 'electrical_box'])

/** Which of the house's own groups and stage groups show at a level. Null: the group is not a stage's, its children decide. */
function groupVisible(name: string, level: number, opts: ApplyConstructionLevelOptions): boolean | null {
  const roofOn = opts.roofLayer !== false
  if (name === 'stage:0:blueprint') return level <= 1
  if (name === 'stage:1:foundation') return level >= 1 && level <= 4
  if (name === 'stage:1:starter_bars') return level === 1
  if (name === 'stage:2:frame') return level >= 2 && level <= 4
  if (name === 'stage:3:masonry') return level >= 3 && level <= 4
  if (name === 'stage:4:installations') return level === 4 || (level >= 4 && opts.waterLayer === true)
  if (name === 'stage:4:sewer_boxes') return level >= 4
  // the timber frame goes up before the tiles and stays under them
  if (name === 'stage:7:roof_framing') return level >= 7 && roofOn
  if (name === 'roof') return level >= 8 && roofOn
  if (name === 'attic_tank') return level >= 4
  if (/^t\d+$/.test(name)) return level >= 5
  return null
}

export function applyConstructionLevel(
  houseGroup: THREE_NS.Group,
  rawLevel: number,
  opts: ApplyConstructionLevelOptions = {},
): number {
  const level = clampConstructionLevel(rawLevel)
  const lotOn = opts.lotLayer !== false

  for (const child of houseGroup.children) {
    const name = child.name
    const own = groupVisible(name, level, opts)
    if (own !== null) {
      child.visible = own
      // the chalk of the walls lies where the ground beams are cast: from the foundation on it is under them
      const lines = name === 'stage:0:blueprint' ? child.getObjectByName(BLUEPRINT_LINES) : undefined
      if (lines) lines.visible = level === 0
      // the spoil goes back into the trenches when they are filled: past the rough-in the water layer shows the runs, never the heaps by them
      const heap = name === 'stage:4:installations' ? child.getObjectByName(SPOIL_HEAP) : undefined
      if (heap) heap.visible = level === 4
      continue
    }
    if (name === 'lot') child.visible = level >= 4 && lotOn
    else if (/^f\d+$/.test(name)) child.visible = level >= 4

    child.traverse((obj) => {
      if (obj === child) return
      const ud = obj.userData
      if (!ud) return
      // the socket hangs from the slab's underside in the rough-in and from the rendered ceiling once the walls are rendered, with its lamp; the fitting goes up after
      if (ud.part === 'lamp_holder' || ud.part === 'lamp_bulb') {
        obj.visible = typeof ud.id !== 'string' || (ud.mount === 'slab' ? level === 4 : level >= 5 && level <= 7)
        return
      }
      if (typeof ud.part === 'string' && EMBEDDED.has(ud.part)) {
        obj.visible = level >= 4
        return
      }
      if (typeof ud.constructionStage !== 'string') return
      // a part hidden by default (a tap's water, a lamp that is off) is never shown by its stage, only hidden with it
      obj.visible = stageVisible(ud.constructionStage, level, opts) && ud.hidden !== true
    })
  }
  return level
}
