import { createAtlasProvider } from './atlas'
import { DEFS, MATERIALS, TYPE_DEFS, type PropType } from './catalog'
import { ceilingBuilders } from './builders/ceiling'
import { floorBuilders } from './builders/floors'
import { furnitureBuilders } from './builders/furniture'
import { houseStateBuilders } from './builders/house-state'
import { plantBuilders } from './builders/plants'
import { wallBuilders } from './builders/wall'
import { yardBuilders } from './builders/yard'
import { createCover } from './cover'
import { makeKit } from './kit'
import { resolveStrings } from './locale'
import type { BuilderContext, BuilderMap, DocumentLike, EmitFn, Props3d, Props3dOptions, TypeInfo } from './types'

/** Type metadata with display names for a locale (`en` by default). */
export function listTypes(locale?: string): TypeInfo[] {
  const names = resolveStrings(locale).typeNames
  return TYPE_DEFS.map((t) => ({ ...t, name: names[t.id] }))
}

/**
 * Creates the props kit. Builders only describe primitives through the `api` you pass to them; nothing here touches a renderer.
 *
 * `three` is accepted so the call looks like the other game-kit packages, but the props never use it.
 *
 * ```ts
 * const props = create(THREE, { document })
 * props.builders.sofa_l({ w: 2.8, d: 1.7, h: 0.85, seed: 'living' }, api)
 * ```
 */
export function create(_three?: unknown, options: Props3dOptions = {}): Props3d {
  const emit: EmitFn = options.emit || (() => {})
  const doc: DocumentLike | null = options.document || (typeof document !== 'undefined' ? document : null)
  const strings = resolveStrings(options.locale)
  const atlas = createAtlasProvider(doc, strings.pictureNames)
  const cover = createCover(atlas)
  const ctx: BuilderContext = { kit: (M, api) => makeKit(M, api, emit), atlas, cover }
  const builders = Object.assign(
    {},
    ceilingBuilders(ctx),
    wallBuilders(ctx),
    plantBuilders(ctx),
    furnitureBuilders(ctx),
    floorBuilders(ctx),
    yardBuilders(ctx),
    houseStateBuilders(ctx),
  ) as BuilderMap
  return {
    builders,
    types: listTypes(options.locale),
    names: Object.keys(builders) as PropType[],
    atlas,
    cover,
    materials: MATERIALS,
  }
}

export { DEFS, MATERIALS, TYPE_DEFS }
