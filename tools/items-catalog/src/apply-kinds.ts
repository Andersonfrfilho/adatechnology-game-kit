import { readFileSync } from 'node:fs'

import type { ItemRecord } from './build-items'
import { KIND_TEXTS_PATH, KINDS_OVERLAY_PATH, KINDS_PATH } from './paths'

/** What `packages/game-items-goods/scripts/migrate-kinds.mjs` adds to a row: its `kind` and the fields estimated from the real world. */
export type KindPatch = { kind: string; estimated?: string[] } & Record<string, unknown>
export type KindedRecord = ItemRecord & KindPatch

export const loadKindsOverlay = (): Readonly<Record<string, KindPatch>> => JSON.parse(readFileSync(KINDS_OVERLAY_PATH, 'utf8')) as Record<string, KindPatch>

/** The row with the patch merged over it: `kind` right after `category`, fields the row has stay in place, new ones go last (the same order as the migration script). */
export const mergeKindPatch = (row: ItemRecord, patch: KindPatch): KindedRecord => {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    out[key] = key in patch ? patch[key] : (row as Record<string, unknown>)[key]
    if (key === 'category') out.kind = patch.kind
  }
  for (const key of Object.keys(patch)) if (!(key in out)) out[key] = patch[key]
  return out as KindedRecord
}

/** Every item gets its patch from `kinds-overlay.json`; an item without one is an error (a new item needs a kind). */
export const applyKinds = (items: readonly ItemRecord[]): KindedRecord[] => {
  const overlay = loadKindsOverlay()
  return items.map((item) => {
    const patch = overlay[item.id]
    if (!patch) throw new Error(`items-catalog: item "${item.id}" has no entry in kinds-overlay.json (give it a kind)`)
    return mergeKindPatch(item, patch)
  })
}

export type KindText = { name: string; description: string }

/** pt-BR name and description of each kind (`kind-texts.json`); the kinds themselves are `packages/game-items-goods/src/data/kinds.json`. */
export const buildKindLocale = (): Record<string, string> => {
  const kinds = JSON.parse(readFileSync(KINDS_PATH, 'utf8')) as { id: string }[]
  const texts = JSON.parse(readFileSync(KIND_TEXTS_PATH, 'utf8')) as Record<string, KindText>
  const out: Record<string, string> = {}
  for (const { id } of kinds) {
    const text = texts[id]
    if (!text) throw new Error(`items-catalog: kind "${id}" has no text in kind-texts.json`)
    out[`kind.${id}`] = text.name
    out[`kind.${id}.description`] = text.description
  }
  return out
}
