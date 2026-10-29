import { describe, expect, it } from 'vitest'

import { THREE, thumbnailSubjects } from '../src/catalog'
import { buildManifest, creditsOf } from '../src/manifest'
import { silhouetteSvg, VIEW_HEIGHT, VIEW_WIDTH } from '../src/silhouette'

const SAMPLE = ['glock_17', 'ak_47', 'm134', 'baseball_bat', 'frag_grenade', 'fuel_barrel']
const subjects = new Map(thumbnailSubjects().map((subject) => [subject.id, subject]))
const render = (id: string): string | undefined => {
  const subject = subjects.get(id)
  return subject ? silhouetteSvg(THREE, subject.build(), subject.view) : undefined
}

describe('silhouetteSvg', () => {
  it.each(SAMPLE)('writes the same bytes twice for %s', (id) => {
    const first = render(id)
    expect(first).toBeDefined()
    expect(render(id)).toBe(first)
  })

  it('is a 4:1 SVG that takes its colour from the page, with no script and no external reference', () => {
    const svg = render('ak_47') ?? ''
    expect(svg).toContain(`viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}"`)
    expect(svg).toContain('fill="currentColor"')
    expect(svg).not.toMatch(/<script|href=|style=|on\w+=/i)
    expect(Buffer.byteLength(svg)).toBeLessThan(12 * 1024)
  })

  it('draws a rifle with a light path under the solid one', () => {
    expect((render('ak_47') ?? '').match(/<path /g)).toHaveLength(2)
  })

  it('has a subject for every weapon of the arsenal but the body actions, and for the explosives that stand in the world', () => {
    expect(subjects.has('glock_17')).toBe(true)
    expect(subjects.has('fuel_barrel')).toBe(true)
    expect(subjects.has('fists')).toBe(false)
    expect(subjects.size).toBeGreaterThan(140)
  })

  it('stays under the size limit for every subject', () => {
    for (const [id, subject] of subjects) {
      const svg = silhouetteSvg(THREE, subject.build(), subject.view)
      expect(svg, id).toBeDefined()
      expect(Buffer.byteLength(svg ?? ''), id).toBeLessThan(12 * 1024)
    }
  })
})

describe('manifest', () => {
  it('prefers the Commons file that has a recorded source and falls back to the generated one', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const folder = mkdtempSync(join(tmpdir(), 'weapon-svg-'))
    mkdirSync(join(folder, 'generated'))
    mkdirSync(join(folder, 'commons'))
    for (const id of ['a', 'b', 'c']) writeFileSync(join(folder, 'generated', `${id}.svg`), '<svg/>')
    for (const id of ['a', 'c']) writeFileSync(join(folder, 'commons', `${id}.svg`), '<svg/>')
    const source = { title: 'File:A.svg', author: 'Someone', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:A.svg', originalUrl: 'https://upload.wikimedia.org/A.svg' }
    writeFileSync(join(folder, 'commons-sources.json'), JSON.stringify({ a: source }))
    const manifest = buildManifest(folder)
    expect(manifest.assets.a).toMatchObject({ source: 'commons', file: 'commons/a.svg', license: 'CC BY-SA 4.0' })
    expect(manifest.assets.b).toEqual({ source: 'generated', file: 'generated/b.svg' })
    expect(manifest.assets.c?.source).toBe('generated')
    expect(creditsOf(manifest, { a: source })).toContain('Someone')
  })
})

describe('committed silhouettes', () => {
  it('are what the tool writes today, one file per subject and no other', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const folder = new URL('../../../packages/game-weapons-three/assets/weapon-svg/generated/', import.meta.url)
    expect(readdirSync(folder).sort()).toEqual([...subjects.keys()].map((id) => `${id}.svg`).sort())
    for (const [id, subject] of subjects) expect(readFileSync(new URL(`${id}.svg`, folder), 'utf8'), id).toBe(silhouetteSvg(THREE, subject.build(), subject.view))
  })
})
