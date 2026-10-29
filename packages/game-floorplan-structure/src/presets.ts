import type { Construction, FoundationType, StructureSource } from './types'
import { WALL_THICKNESS } from './geometry'
import { ROOF_COVERINGS } from './registry'

const SLAB_COVERING = 'slab'
const PLASTERED_FINISHES = ['plaster', 'partial_plaster']

/** Masonry house of the engine's own templates: brick with plaster, concrete frame, tiles by facade; a unit in a building gets a flat slab roof. */
export function masonryConstruction(source: StructureSource): Construction {
  const unit = source.floorNumber !== undefined
  const covering = unit ? SLAB_COVERING : (source.facade.roof ?? 'colonial')
  const finish = source.facade.finish ?? 'roughcast'
  const budget = source.style === 'budget'
  const flat = unit || covering === SLAB_COVERING
  return {
    system: 'masonry',
    walls: { material: 'brick', cladding: PLASTERED_FINISHES.includes(finish) ? 'plaster' : null, finish, thickness: WALL_THICKNESS, ...(finish === 'exposed_block' ? { assembly: 'concrete_block_wall' } : {}) },
    floor: { material: budget ? 'concrete' : 'ceramic', finish: budget ? 'burnt_cement' : 'ceramic_tile' },
    roof: { material: ROOF_COVERINGS.get(covering)?.material ?? 'ceramic', covering, shape: flat ? 'slab' : 'gable', pitch: flat ? 0 : covering === 'colonial' ? 30 : 15, timber: 'wood_soft' },
    frame: { material: 'concrete', pillars: 'concrete', beams: 'concrete', slabs: 'concrete', timber: 'wood_soft', rebar: 'steel' },
    foundation: { type: unit ? 'building' : 'strip_footing', material: 'concrete', elevation: 0 },
  }
}

export interface WoodFrameOptions {
  foundation?: 'basement' | 'crawl_space' | 'raft'
  covering?: string
  finish?: string
  /** Cladding of the outer face (default soft wood). */
  cladding?: string
}

const FOUNDATIONS: Record<NonNullable<WoodFrameOptions['foundation']>, Construction['foundation']> = {
  basement: { type: 'basement', material: 'concrete', elevation: 0.5, depth: 2.4 },
  crawl_space: { type: 'crawl_space', material: 'concrete', elevation: 0.6 },
  raft: { type: 'raft', material: 'concrete', elevation: 0.2 },
}

const TIMBER_FRAME: Construction['frame'] = { material: 'wood_soft', pillars: 'wood_soft', beams: 'wood_soft', slabs: 'plywood', timber: 'wood_soft', rebar: null }

/** American wood frame house: 38x89 studs every 40 cm, plaster inside, wood outside, asphalt shingles. */
export function woodFrameConstruction(options: WoodFrameOptions = {}): Construction {
  const covering = options.covering ?? 'asphalt'
  return {
    system: 'wood_frame',
    walls: { material: 'wood_soft', interior: 'plaster', cladding: options.cladding ?? 'wood_soft', finish: options.finish ?? 'wood_siding', thickness: WALL_THICKNESS, studs: '38x89 every 40 cm', insulation: 'foam' },
    floor: { material: 'wood_hard', finish: 'wood_boards' },
    roof: { material: ROOF_COVERINGS.get(covering)?.material ?? 'plastic', covering, shape: 'gable', pitch: 28, timber: 'wood_soft', eave: 0.5 },
    frame: { ...TIMBER_FRAME },
    foundation: { ...FOUNDATIONS[options.foundation ?? 'raft'] },
  }
}

export interface ChaletOptions {
  covering?: string
  finish?: string
  piles?: boolean
}

/** Mountain chalet: A-frame roof at 52 degrees with gables front and back, 38x140 studs. */
export function chaletConstruction(options: ChaletOptions = {}): Construction {
  const covering = options.covering ?? 'colonial'
  return {
    system: 'wood_frame',
    walls: { material: 'wood_soft', interior: 'wood_soft', cladding: 'wood_hard', finish: options.finish ?? 'vertical_boards', thickness: WALL_THICKNESS, studs: '38x140 every 40 cm' },
    floor: { material: 'wood_hard', finish: 'wood_boards' },
    roof: { material: ROOF_COVERINGS.get(covering)?.material ?? 'wood_soft', covering, shape: 'gable', pitch: 52, timber: 'wood_soft', eave: 0.8, axis: 'v', profile: 'a_frame', gables: ['front', 'back'] },
    frame: { ...TIMBER_FRAME },
    foundation: options.piles ? { type: 'piles', material: 'stone', elevation: 0.9 } : { type: 'raft', material: 'concrete', elevation: 0.2 },
  }
}

/** Log cabin: every wall is a stack of 26 cm logs, notched at the corners, on stone piles. */
export function logCabinConstruction(options: { covering?: string } = {}): Construction {
  const covering = options.covering ?? 'wood'
  return {
    system: 'log',
    walls: { material: 'wood_hard', interior: 'wood_hard', cladding: null, finish: 'log', thickness: WALL_THICKNESS, logDiameter: 0.26, joint: 'notched_corners' },
    floor: { material: 'wood_hard', finish: 'wood_boards' },
    roof: { material: ROOF_COVERINGS.get(covering)?.material ?? 'wood_soft', covering, shape: 'gable', pitch: 32, timber: 'wood_hard', eave: 0.6 },
    frame: { material: 'wood_hard', pillars: 'wood_hard', beams: 'wood_hard', slabs: 'wood_hard', timber: 'wood_hard', rebar: null },
    foundation: { type: 'piles', material: 'stone', elevation: 0.5 },
  }
}

export interface ShackOptions {
  material?: 'wood' | 'zinc' | 'mixed'
  floor?: 'soil' | 'concrete'
}

const MIXED_SCRAP = ['wood_soft', 'steel', 'plywood', 'steel', 'wood_soft']

/** Shack of scrap boards and zinc sheets: timber posts carry the roof, the walls only close. */
export function shackConstruction(options: ShackOptions = {}): Construction {
  const material = options.material === 'zinc' ? 'steel' : 'wood_soft'
  const onSoil = options.floor === 'soil'
  return {
    system: 'improvised',
    walls: { material, interior: options.material === 'zinc' ? 'plywood' : material, cladding: null, finish: 'scrap', thickness: WALL_THICKNESS, ...(options.material === 'mixed' ? { mixed: MIXED_SCRAP } : {}) },
    floor: onSoil ? { material: 'soil', finish: 'packed_earth' } : { material: 'concrete', finish: 'burnt_cement' },
    roof: { material: 'steel', covering: 'zinc', shape: 'gable', pitch: 12, timber: 'wood_soft', eave: 0.3, fastening: 'nails_and_stones' },
    frame: { material: 'wood_soft', pillars: 'wood_soft', beams: 'wood_soft', slabs: 'concrete', timber: 'wood_soft', rebar: null },
    foundation: onSoil ? { type: 'ground', material: 'soil', elevation: 0 } : { type: 'raft', material: 'concrete', elevation: 0.08 },
  }
}

/** Camping: canvas over aluminium poles on the ground; there are no walls. */
export function campConstruction(): Construction {
  return {
    system: 'canvas',
    walls: { material: 'fabric', interior: 'fabric', cladding: null, finish: 'nylon', thickness: 0.002 },
    floor: { material: 'plastic', finish: 'waterproof_mat' },
    roof: { material: 'fabric', covering: 'canvas', shape: 'tent', pitch: 0, timber: 'aluminium', eave: 0 },
    frame: { material: 'aluminium', pillars: 'aluminium', beams: 'aluminium', slabs: 'plastic', timber: 'aluminium', rebar: null },
    foundation: { type: 'ground', material: 'soil', elevation: 0 },
  }
}

/** The construction a system gets on any plan when the options force it (`options.construction`). */
export function constructionOfSystem(system: string, source: StructureSource): Construction | undefined {
  const covering = source.facade.roof
  const keep = covering && covering !== SLAB_COVERING ? { covering } : {}
  switch (system) {
    case 'masonry':
      return masonryConstruction(source)
    case 'wood_frame':
      return woodFrameConstruction(keep)
    case 'log':
      return logCabinConstruction(keep)
    case 'improvised':
      return shackConstruction()
    case 'canvas':
      return campConstruction()
    default:
      return undefined
  }
}

export type { FoundationType }
