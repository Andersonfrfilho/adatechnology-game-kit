import type * as THREE_NS from 'three'

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
    title: '7 · Telhado (Madeiramento, Telhas e Calhas)',
    description: 'Tesouras, caibros e cumeeira do telhado, cobertura de telhas, rufos, calhas, condutores pluviais e painéis solares.',
  },
  {
    level: 8,
    title: '8 · Casa Completa (Móveis, Louças e Quintal)',
    description: 'Louças e metais sanitários, móveis interativos, eletrodomésticos, iluminação, paisagismo, veículos e muros/portões do lote.',
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
    title: '7 · Roof (Framing, Tiles, Gutters & Solar)',
    description: 'Timber/metal roof trusses, rafters and ridge beams, roof tiles, gutters, downspouts and solar panels.',
  },
  {
    level: 8,
    title: '8 · Complete House (Furniture, Fixtures & Yard)',
    description: 'Plumbing fixtures, interactive household furniture, appliances, lighting, yard vegetation, vehicles and lot perimeter.',
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
      return level >= 7 && opts.roofLayer !== false
    case 'furniture':
      return level >= 8
    case 'perimeter':
      return level >= 8 && opts.lotLayer !== false
    default:
      return true
  }
}

export function applyConstructionLevel(
  houseGroup: THREE_NS.Group,
  rawLevel: number,
  opts: ApplyConstructionLevelOptions = {},
): number {
  const level = clampConstructionLevel(rawLevel)
  const waterOn = opts.waterLayer === true
  const roofOn = opts.roofLayer !== false
  const lotOn = opts.lotLayer !== false

  for (const child of houseGroup.children) {
    const name = child.name
    if (name === 'stage:0:blueprint') {
      child.visible = level <= 1
      continue
    }
    if (name === 'stage:1:foundation') {
      child.visible = level >= 1 && level <= 4
      continue
    }
    if (name === 'stage:2:frame') {
      child.visible = level >= 2 && level <= 4
      continue
    }
    if (name === 'stage:3:masonry') {
      child.visible = level >= 3 && level <= 4
      continue
    }
    if (name === 'stage:4:installations') {
      child.visible = level === 4 || (level >= 4 && waterOn)
      continue
    }
    if (name === 'stage:7:roof_framing') {
      child.visible = (level === 7 && roofOn) || (level >= 7 && !roofOn)
      continue
    }
    if (name === 'roof') {
      child.visible = level >= 7 && roofOn
      continue
    }
    if (name === 'attic_tank') {
      child.visible = level >= 4
      continue
    }
    if (/^t\d+$/.test(name)) {
      child.visible = level >= 5
      continue
    }
    if (name === 'lot') {
      child.visible = level >= 4 && lotOn
    } else if (/^f\d+$/.test(name)) {
      child.visible = level >= 4
    }

    child.traverse((obj) => {
      if (obj === child) return
      const ud = obj.userData
      if (!ud) return
      if (ud.part === 'wall_pipe') {
        obj.visible = waterOn
        return
      }
      if (typeof ud.constructionStage === 'string') {
        obj.visible = stageVisible(ud.constructionStage, level, opts)
      }
    })
  }
  return level
}
