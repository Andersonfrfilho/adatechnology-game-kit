// @ts-check
// node tools/sfx-sources/hits.mjs
//
// Where the hit of each recorded reload step is: the seconds from the start of the converted file (the converter cuts the silence before the
// first attack) to its loudest instant, the click of the magazine seating, the slide slamming home. The median of the takes of each cue goes to
// packages/game-weapons-three/src/data/reload-sample-hits.json, so the reload clip starts the sound that much before the part arrives and the
// click lands on the frame the animation reaches the stop (criterion C1). Needs ffmpeg; run after sfx:convert.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { hasKitSfx, kitSfxDir } from '../../packages/game-audio/scripts/sfx-dir.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
// the manifest is in the kit; the files are outside git (packages/game-audio/scripts/sfx-dir.mjs)
const manifestDir = join(root, 'packages/game-audio/assets/sfx')
const sfx = kitSfxDir(root)
if (!hasKitSfx(root)) {
  console.error(`hits: no sound files at ${sfx} (set .sfx-local.json "kit" or KIT_SFX_DIR to the game's assets/sfx)`)
  process.exit(1)
}
const target = join(root, 'packages/game-weapons-three/src/data/reload-sample-hits.json')
const RATE = 48000
const BLOCK = 96

/** @param {string} file */
function hitSeconds(file) {
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], { maxBuffer: 256 * 1024 * 1024 })
  const samples = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4)
  let peak = 0
  let at = 0
  for (let block = 0; block * BLOCK < samples.length; block++) {
    let max = 0
    for (let index = block * BLOCK; index < Math.min(samples.length, (block + 1) * BLOCK); index++) max = Math.max(max, Math.abs(samples[index] ?? 0))
    if (max > peak) {
      peak = max
      at = block
    }
  }
  return (at * BLOCK) / RATE
}

/** @param {number[]} values */
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

/** @type {{ sounds: { id: string, category: string, layers: Record<string, { file: string }[]> }[] }} */
const manifest = JSON.parse(readFileSync(join(manifestDir, 'manifest.json'), 'utf8'))
const spec = JSON.parse(readFileSync(join(here, 'firearms.json'), 'utf8'))
/** @type {Map<string, number[]>} */
const byCue = new Map()
for (const sound of manifest.sounds) {
  if (sound.category !== 'armas' || sound.id in spec.shots || sound.id in (spec.casings ?? {})) continue
  const cue = sound.id.replace(/_(light|medium|heavy)$/, '')
  const hits = (sound.layers.close ?? []).map((entry) => hitSeconds(join(sfx, entry.file)))
  byCue.set(cue, [...(byCue.get(cue) ?? []), ...hits])
}
/** @type {Record<string, number>} */
const hits = {}
for (const [cue, values] of [...byCue].sort(([a], [b]) => a.localeCompare(b))) hits[cue] = Math.round(median(values) * 1000) / 1000
writeFileSync(target, `${JSON.stringify({ $comment: 'Seconds from the start of each recorded reload step to its hit (median of its takes), measured on the converted files by tools/sfx-sources/hits.mjs. The reload clip starts the sound that much early, so the hit lands on the frame the part reaches its stop.', hits }, null, 1)}\n`)
console.log(hits)
