import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { SfxManifest } from '../src'

const folder = join(dirname(fileURLToPath(import.meta.url)), '../assets/sfx')
const manifest = JSON.parse(readFileSync(join(folder, 'manifest.json'), 'utf8')) as SfxManifest
const credits = readFileSync(join(folder, 'CREDITOS.md'), 'utf8')
const takes = manifest.sounds.flatMap((sound) => Object.values(sound.layers).flatMap((entries) => entries ?? []))

describe('the licence of every recording in the kit', () => {
  it('every take names its source, its author and a licence the SDK may ship (CC0 or CC-BY)', () => {
    for (const take of takes) {
      expect(take.source, take.file).toMatch(/^https?:\/\//)
      expect(take.author.length, take.file).toBeGreaterThan(0)
      expect(['CC0', 'CC-BY'], take.file).toContain(take.license)
    }
  })

  it('every take has its line in CREDITOS.md with the same source, author and licence', () => {
    const rows = new Map(credits.split('\n').filter((line) => line.startsWith('| ') && line.includes('.ogg')).map((line) => [line.split('|')[1]!.trim(), line]))
    for (const take of takes) expect(rows.get(take.file), take.file).toBe(`| ${take.file} | ${take.source} | ${take.author} | ${take.license} |`)
  })

  it('every take has its file next to the manifest', () => {
    for (const take of takes) expect(existsSync(join(folder, take.file)), take.file).toBe(true)
  })
})
