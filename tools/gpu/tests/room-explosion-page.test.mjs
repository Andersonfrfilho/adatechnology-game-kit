// @ts-check
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { after, test } from 'node:test'

import { baseOverwriteError, pagePairOf, pageSelectionOf } from '../room-explosion.mjs'
import { assertNightlyBuildsItsOwnPage, savedPagesOf } from '../room-explosion-base.mjs'

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

test('baseOverwriteError: a non-c4 explosive writing over the base is refused', () => {
  assert.match(String(baseOverwriteError({ explosive: 'tnt', savedPage: undefined, reportOut: 'base.json', baseFile: './base.json' })), /would overwrite a base/)
})

test('baseOverwriteError: a saved page writing over the base is refused', () => {
  assert.match(String(baseOverwriteError({ explosive: 'c4', savedPage: '/tmp/before.html', reportOut: 'base.json', baseFile: 'base.json' })), /saved page/)
})

test('baseOverwriteError: c4 without a saved page may write the base', () => {
  assert.equal(baseOverwriteError({ explosive: 'c4', savedPage: undefined, reportOut: 'base.json', baseFile: 'base.json' }), undefined)
})

test('baseOverwriteError: different files, or no base, are allowed', () => {
  assert.equal(baseOverwriteError({ explosive: 'tnt', savedPage: '/tmp/before.html', reportOut: 'out.json', baseFile: 'base.json' }), undefined)
  assert.equal(baseOverwriteError({ explosive: 'tnt', savedPage: '/tmp/before.html', reportOut: 'out.json', baseFile: undefined }), undefined)
})

test('pageSelectionOf: no saved page builds the worktree page', () => {
  assert.deepEqual(pageSelectionOf({ savedPage: undefined, root: '/work/tree' }), { pageFile: '/work/tree/examples/test-room/dist/test-room.html', shouldBuild: true })
})

test('pageSelectionOf: a saved page is resolved and never built', () => {
  assert.deepEqual(pageSelectionOf({ savedPage: 'saved/before.html', root: '/work/tree' }), { pageFile: resolve('saved/before.html'), shouldBuild: false })
})

test('savedPagesOf: an empty variable is an unset one', () => {
  assert.deepEqual(savedPagesOf({ ROOM_EXPLOSION_PAGE: '', ROOM_EXPLOSION_OTHER_PAGE: '' }), { page: undefined, otherPage: undefined })
  assert.deepEqual(savedPagesOf({ ROOM_EXPLOSION_PAGE: '/a.html', ROOM_EXPLOSION_OTHER_PAGE: '/b.html' }), { page: '/a.html', otherPage: '/b.html' })
})

test('assertNightlyBuildsItsOwnPage: refuses either variable, accepts none or empty ones', () => {
  assert.throws(() => assertNightlyBuildsItsOwnPage({ ROOM_EXPLOSION_PAGE: '/a.html' }), /never a saved page/)
  assert.throws(() => assertNightlyBuildsItsOwnPage({ ROOM_EXPLOSION_OTHER_PAGE: '/b.html' }), /never a saved page/)
  assert.doesNotThrow(() => assertNightlyBuildsItsOwnPage({}))
  assert.doesNotThrow(() => assertNightlyBuildsItsOwnPage({ ROOM_EXPLOSION_PAGE: '', ROOM_EXPLOSION_OTHER_PAGE: '' }))
})
