// @ts-check
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'

import { pagePairOf } from '../room-explosion.mjs'

const directory = mkdtempSync(join(tmpdir(), 'room-explosion-page-'))
after(() => rmSync(directory, { recursive: true, force: true }))

/** @param {string} name @param {string} content */
const pageFile = (name, content) => {
  const file = join(directory, name)
  writeFileSync(file, content)
  return file
}
/** @param {string} content */
const sha256 = (content) => createHash('sha256').update(content).digest('hex')

test('pagePairOf: gives the sha256 of the page bytes', () => {
  const page = pageFile('single.html', '<html>single</html>')
  assert.deepEqual(pagePairOf({ page }), { pageSha256: sha256('<html>single</html>') })
})

test('pagePairOf: a missing page throws', () => {
  assert.throws(() => pagePairOf({ page: join(directory, 'missing.html') }), /page does not exist/)
})

test('pagePairOf: a missing other page throws', () => {
  const page = pageFile('has-other.html', '<html>a</html>')
  assert.throws(() => pagePairOf({ page, otherPage: join(directory, 'missing-other.html') }), /ROOM_EXPLOSION_OTHER_PAGE does not exist/)
})

test('pagePairOf: the same bytes in two files throw, naming the short hash', () => {
  const page = pageFile('twin-a.html', '<html>twin</html>')
  const otherPage = pageFile('twin-b.html', '<html>twin</html>')
  assert.throws(() => pagePairOf({ page, otherPage }), new RegExp(sha256('<html>twin</html>').slice(0, 12)))
})

test('pagePairOf: different bytes pass', () => {
  const page = pageFile('before.html', '<html>before</html>')
  const otherPage = pageFile('after.html', '<html>after</html>')
  assert.deepEqual(pagePairOf({ page, otherPage }), { pageSha256: sha256('<html>before</html>') })
})
