import type { DebrisKind, FractureStyle, MaterialDef } from './types'

/**
 * The look of what a material throws when it is hit or breaks, by family: the effects of a renderer are drawn per family (wood throws splinters, masonry
 * chips and dust, glass shards, metal sparks), in the colour of the material that broke.
 */
export type DebrisFamily = 'wood' | 'masonry' | 'glass' | 'metal' | 'soft' | 'soil'

export const DEBRIS_FAMILIES: readonly DebrisFamily[] = ['wood', 'masonry', 'glass', 'metal', 'soft', 'soil']

/** What happened to the material: a shot, a coat coming off, a damage stage, rebar laid bare, a fracture, a blast or a collapse. */
export type DebrisEvent = 'shot' | 'spall' | 'stage1' | 'stage2' | 'stage3' | 'expose' | 'fracture' | 'explosion' | 'collapse'

export const DEBRIS_EVENTS: readonly DebrisEvent[] = ['shot', 'spall', 'stage1', 'stage2', 'stage3', 'expose', 'fracture', 'explosion', 'collapse']

/** The mark a hit leaves on the face: a ragged hole in wood, a crater in masonry, a star crack in glass, a bright dent in metal, a torn hole in soft stuff. */
export type DebrisMark = 'splintered_hole' | 'crater' | 'star_crack' | 'dent' | 'torn_hole' | 'pit'

/** The impact recipe of the effects library a shot on this family plays (`impact_<name>` of `game-vfx`), if it has one. */
export type ImpactRecipe = 'concrete' | 'metal' | 'wood' | 'glass'

export interface DebrisLook {
  readonly family: DebrisFamily
  /** The kind of debris thrown. */
  readonly debris: DebrisKind
  /** Colour of the debris (`0xRRGGBB`). */
  readonly color: number
  /** Colour of the dust raised with it, or `undefined` when the material raises none (metal). */
  readonly dust: number | undefined
  readonly mark: DebrisMark
  /** The hit throws sparks (steel on steel, a round on metal). */
  readonly sparks: boolean
  readonly impact: ImpactRecipe | undefined
}

export interface DebrisLookOptions {
  /** Colour the part is drawn in, used when the material has no colour of its own inside. */
  readonly partColor?: number
  /** Fracture style, for a `fracture` event (default the material's). */
  readonly style?: FractureStyle
}

/** Default colours of each family when neither the material nor the part gives one: the debris and its dust. */
export const FAMILY_COLORS: Readonly<Record<DebrisFamily, { readonly debris: number; readonly dust: number | undefined }>> = {
  wood: { debris: 0xb08a5a, dust: 0xb59a74 },
  masonry: { debris: 0x9b9a94, dust: 0xa8a49b },
  glass: { debris: 0xa8c8d8, dust: 0xbfd6e2 },
  metal: { debris: 0x8a8f96, dust: undefined },
  soft: { debris: 0x9a9488, dust: undefined },
  soil: { debris: 0x7a6a55, dust: 0x8a7a62 },
}

/** Colours that are wood and only wood: no other family may throw them. */
export const WOOD_ONLY_COLORS: readonly number[] = [0x7a5530, 0xb08a5a, 0x7a6048, 0xa0764a, 0xb59a74]

const MARKS: Readonly<Record<DebrisFamily, DebrisMark>> = { wood: 'splintered_hole', masonry: 'crater', glass: 'star_crack', metal: 'dent', soft: 'torn_hole', soil: 'pit' }
const IMPACTS: Readonly<Record<DebrisFamily, ImpactRecipe | undefined>> = { wood: 'wood', masonry: 'concrete', glass: 'glass', metal: 'metal', soft: undefined, soil: undefined }
const FAMILY_DEBRIS: Readonly<Record<Exclude<DebrisFamily, 'soft'>, DebrisKind>> = { wood: 'splinters', masonry: 'chips', glass: 'shards', metal: 'sparks', soil: 'dust' }
const STYLE_DEBRIS: Readonly<Record<FractureStyle, DebrisKind>> = { shatter: 'shards', crumble: 'chips', splinter: 'splinters', tear: 'fibers', snap: 'chips', none: 'sparks' }

const FRACTURE_FAMILY: Readonly<Record<FractureStyle, DebrisFamily>> = { none: 'metal', shatter: 'glass', splinter: 'wood', crumble: 'masonry', tear: 'soft', snap: 'soft' }

/** The family a material belongs to, by its tags (`metal`, `glass`, `wood`, `masonry`, `soil`), else by its fracture. */
export function debrisFamily(def: MaterialDef | undefined): DebrisFamily {
  const tags = def?.tags ?? []
  if (tags.includes('metal')) return 'metal'
  if (tags.includes('glass') || def?.visual?.transparent) return 'glass'
  if (tags.includes('wood') || def?.penetrationClass === 'wood') return 'wood'
  if (tags.includes('soil')) return 'soil'
  if (tags.includes('masonry') || tags.includes('ceramic')) return 'masonry'
  // a material of a game with no tags is told by how it breaks
  return FRACTURE_FAMILY[def?.fracture ?? 'tear']
}

/** Colour of what breaks off the material: the colour of its inside, of a whole unit of it, of the part, or the family's. */
export function debrisColor(def: MaterialDef | undefined, partColor?: number): number {
  const family = debrisFamily(def)
  if (def?.visual?.innerColor !== undefined) return def.visual.innerColor
  if (def?.visual?.unitColor !== undefined) return def.visual.unitColor
  // the paint over metal and glass is not what flies off them, and a painted wall's chips are of its inside (handled above)
  if (partColor !== undefined && family !== 'metal' && family !== 'glass') return partColor
  return FAMILY_COLORS[family].debris
}

/** Which face of the material a fragment shows: a whole unit of it (a brick out of its joints), its inside (fresh wood, the pages of a book) or neither. */
export interface FragmentFace {
  readonly unit?: boolean
  readonly inner?: boolean
}

/**
 * Colour of one fragment: a whole unit shows the unit's colour, a piece of the inside the inner colour, any other the part's colour (or the family's when
 * the part has none). The unit wins over the inside: a brick knocked out whole is fired clay, not the core of the wall.
 */
export function fragmentTone(def: MaterialDef | undefined, face: FragmentFace, partColor?: number): number {
  if (face.unit && def?.visual?.unitColor !== undefined) return def.visual.unitColor
  if (face.inner && def?.visual?.innerColor !== undefined) return def.visual.innerColor
  return partColor ?? FAMILY_COLORS[debrisFamily(def)].debris
}

/** Colour of the dust the material raises, lighter than its debris; `undefined` for metal. */
export function dustColor(def: MaterialDef | undefined, partColor?: number): number | undefined {
  const family = debrisFamily(def)
  const base = FAMILY_COLORS[family].dust
  if (base === undefined) return undefined
  if (family === 'glass') return base
  return mix(debrisColor(def, partColor), 0xd8d4cc, 0.3)
}

/** Debris kind of an event on a material. */
function debrisKindOf(def: MaterialDef | undefined, family: DebrisFamily, event: DebrisEvent, style: FractureStyle | undefined): DebrisKind {
  if (event === 'fracture') return STYLE_DEBRIS[style ?? def?.fracture ?? 'crumble']
  if (event === 'shot') return def?.hitDebris ?? (family === 'soft' ? 'chips' : FAMILY_DEBRIS[family])
  if (event === 'stage2' || event === 'stage3' || event === 'explosion' || event === 'collapse') return def?.breakDebris ?? 'dust'
  if (family === 'soft') return def?.hitDebris ?? 'chips'
  return FAMILY_DEBRIS[family]
}

/** What an event on a material looks like: debris, colour, dust and the mark it leaves. */
export function debrisLook(def: MaterialDef | undefined, event: DebrisEvent, options: DebrisLookOptions = {}): DebrisLook {
  const family = debrisFamily(def)
  return {
    family,
    debris: debrisKindOf(def, family, event, options.style),
    color: debrisColor(def, options.partColor),
    dust: dustColor(def, options.partColor),
    mark: MARKS[family],
    sparks: family === 'metal',
    impact: IMPACTS[family],
  }
}

function mix(a: number, b: number, t: number): number {
  const channel = (shift: number): number => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift
  return channel(16) | channel(8) | channel(0)
}
