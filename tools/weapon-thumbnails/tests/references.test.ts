import { describe, expect, it } from 'vitest'

import { findReferences, queryOf, referenceOf } from '../src/references'

const file = (title: string, width: number, height: number, license: string) => ({
  title,
  imageinfo: [{ url: `https://upload.wikimedia.org/${title}`, thumburl: `https://upload.wikimedia.org/thumb/${title}`, descriptionurl: `https://commons.wikimedia.org/wiki/${title}`, width, height, extmetadata: { LicenseShortName: { value: license }, Artist: { value: '<a href="x">Someone</a>' } } }],
})

describe('referenceOf', () => {
  it('keeps a free photo with its author and licence', () => {
    const reference = referenceOf(file('File:G36C.jpg', 1600, 700, 'CC BY-SA 4.0'), 'wikipedia: Heckler & Koch G36', false)
    expect(reference).toMatchObject({ title: 'File:G36C.jpg', author: 'Someone', license: 'CC BY-SA 4.0', url: 'https://upload.wikimedia.org/thumb/File:G36C.jpg' })
  })

  it('leaves out an image that is not free', () => {
    expect(referenceOf(file('File:Poster.jpg', 1600, 700, 'Fair use'), 'wikipedia: X', false)).toBeNull()
  })

  it('takes for a long weapon only a long photo, never a drawing or a sound', () => {
    expect(referenceOf(file('File:G36 left.jpg', 900, 900, 'Public domain'), 'commons: G36', true)).toBeNull()
    expect(referenceOf(file('File:G36.svg', 1800, 700, 'Public domain'), 'commons: G36', true)).toBeNull()
    expect(referenceOf(file('File:Nail bat.ogg', 1800, 700, 'Public domain'), 'commons: Nail bat', true)).toBeNull()
    expect(referenceOf(file('File:G36 left.jpg', 1800, 700, 'Public domain'), 'commons: G36', true)).not.toBeNull()
  })
})

describe('queryOf', () => {
  it('searches a gun as a firearm and a blade by its name alone', () => {
    expect(queryOf({ name: 'Glock 17', category: 'pistol' })).toBe('Glock 17 firearm')
    expect(queryOf({ name: 'Machete', category: 'melee_blade' })).toBe('Machete')
  })
})

describe('findReferences', () => {
  const empty = async (): Promise<unknown> => ({ query: { search: [], pages: {} } })

  it('lists the weapons with no photo', async () => {
    const found = await findReferences(null, empty)
    expect(found.missing).toContain('hk_g36c')
    expect(found.missing).not.toContain('fists')
  })

  it('uses the file a person pinned, before any search, whatever its name', async () => {
    const pinnedFile = file('File:G36C show 2010.jpg', 1400, 700, 'CC BY-SA 3.0')
    const asked: string[] = []
    const fetchJson = async (url: string): Promise<unknown> => {
      asked.push(url)
      return url.includes('titles=File%3AG36C') ? { query: { pages: { 1: pinnedFile } } } : { query: { search: [], pages: {} } }
    }
    const found = await findReferences({ about: '', references: {}, missing: [], pinned: { hk_g36c: 'File:G36C show 2010.jpg' } }, fetchJson)
    expect(found.references['hk_g36c']).toMatchObject({ title: 'File:G36C show 2010.jpg', found: 'pinned' })
    expect(found.pinned).toEqual({ hk_g36c: 'File:G36C show 2010.jpg' })
  })
})
