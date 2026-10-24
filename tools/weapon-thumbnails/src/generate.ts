import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { THREE, thumbnailSubjects } from './catalog'
import { silhouetteSvg } from './silhouette'

/** One file stays well under what a menu thumbnail needs. */
export const MAX_SVG_BYTES = 12 * 1024

export interface GeneratedSvg {
  readonly id: string
  readonly svg: string
}

export function generateAll(): GeneratedSvg[] {
  return thumbnailSubjects().map(({ id, view, build }) => {
    const svg = silhouetteSvg(THREE, build(), view)
    if (!svg) throw new Error(`weapon-thumbnails: nothing of "${id}" shows in the ${view} view`)
    const bytes = Buffer.byteLength(svg)
    if (bytes > MAX_SVG_BYTES) throw new Error(`weapon-thumbnails: "${id}" is ${bytes} bytes, over the ${MAX_SVG_BYTES} limit`)
    return { id, svg }
  })
}

/** Writes `<id>.svg` for every subject into `directory` and removes the `.svg` files that are no longer subjects. Returns the ids written. */
export function writeGenerated(directory: string): string[] {
  mkdirSync(directory, { recursive: true })
  const generated = generateAll()
  const wanted = new Set(generated.map(({ id }) => `${id}.svg`))
  for (const file of readdirSync(directory)) if (file.endsWith('.svg') && !wanted.has(file)) rmSync(join(directory, file))
  for (const { id, svg } of generated) writeFileSync(join(directory, `${id}.svg`), svg)
  return generated.map(({ id }) => id)
}
