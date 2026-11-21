// @ts-check
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'

import { assertStampIsHead, pageHashOf, parsePageStamp, stampMarkupOf, stripPageStamp } from '../page-stamp.mjs'
import { assertReportIsOfHead, saveBase } from '../room-explosion-base.mjs'
import { assertDistsAreFresh, stalePackagesAt, stalePackagesOf } from '../stale-dist.mjs'

const HEAD = 'b'.repeat(40)
const BUILD = { commit: HEAD, dirty: false, builtAt: '2026-11-21T10:00:00.000Z' }
const page = (/** @type {string} */ stamp) => `<html><head><title>x</title>${stamp}</head><body>room</body></html>`

const directory = mkdtempSync(join(tmpdir(), 'page-stamp-'))
after(() => rmSync(directory, { recursive: true, force: true }))

test('stamp: written markup parses back, a page without one gives null', () => {
  assert.deepEqual(parsePageStamp(page(stampMarkupOf(BUILD))), BUILD)
  assert.deepEqual(parsePageStamp(page(stampMarkupOf({ ...BUILD, dirty: true }))), { ...BUILD, dirty: true })
  assert.equal(parsePageStamp(page('')), null)
  assert.equal(parsePageStamp(page('<meta name="kit-build" content=\'{broken\'>')), null)
})

test('stamp: stripping gives the page as it was without the stamp', () => {
  assert.equal(stripPageStamp(page(stampMarkupOf(BUILD))), page(''))
})

test('hash: two builds of the same code with different stamps hash the same, different code does not', () => {
  const first = page(stampMarkupOf(BUILD))
  const later = page(stampMarkupOf({ ...BUILD, builtAt: '2026-11-22T00:00:00.000Z', dirty: true }))
  assert.notEqual(first, later)
  assert.equal(pageHashOf(first), pageHashOf(later))
  assert.equal(pageHashOf(first), createHash('sha256').update(page('')).digest('hex'))
  assert.notEqual(pageHashOf(first), pageHashOf(first.replace('room', 'other room')))
})

test('assertStampIsHead: the same commit passes, another or a missing stamp throws', () => {
  assert.doesNotThrow(() => assertStampIsHead({ stamp: BUILD, head: HEAD }))
  assert.throws(() => assertStampIsHead({ stamp: { ...BUILD, commit: 'c'.repeat(40) }, head: HEAD }), /built at cccccccccccc but HEAD is bbbbbbbbbbbb/)
  assert.throws(() => assertStampIsHead({ stamp: null, head: HEAD }), /no build stamp/)
})

test('stalePackagesOf: src newer than dist, a missing dist, fresh and src-less packages', () => {
  assert.deepEqual(
    stalePackagesOf([
      { name: 'newer-src', srcNewestMs: 200, distNewestMs: 100 },
      { name: 'no-dist', srcNewestMs: 200, distNewestMs: undefined },
      { name: 'fresh', srcNewestMs: 100, distNewestMs: 200 },
      { name: 'same-time', srcNewestMs: 100, distNewestMs: 100 },
      { name: 'no-src', srcNewestMs: undefined, distNewestMs: undefined },
    ]),
    ['newer-src', 'no-dist'],
  )
})

/** A fake repo root with one package. @param {string} name @param {{ src: number, dist?: number, build?: boolean }} times */
const fakePackage = (name, { src, dist, build = true }) => {
  const root = join(directory, name)
  const folder = join(root, 'packages', 'game-x')
  mkdirSync(join(folder, 'src', 'deep'), { recursive: true })
  writeFileSync(join(folder, 'package.json'), JSON.stringify({ scripts: build ? { build: 'tsup' } : {} }))
  writeFileSync(join(folder, 'src', 'deep', 'a.ts'), '')
  utimesSync(join(folder, 'src', 'deep', 'a.ts'), src, src)
  if (dist !== undefined) {
    mkdirSync(join(folder, 'dist'), { recursive: true })
    writeFileSync(join(folder, 'dist', 'index.js'), '')
    utimesSync(join(folder, 'dist', 'index.js'), dist, dist)
  }
  return root
}

test('stalePackagesAt: reads the mtimes of nested src files and of dist', () => {
  assert.deepEqual(stalePackagesAt(fakePackage('stale', { src: 2000, dist: 1000 })), ['game-x'])
  assert.deepEqual(stalePackagesAt(fakePackage('missing', { src: 2000 })), ['game-x'])
  assert.deepEqual(stalePackagesAt(fakePackage('fresh', { src: 1000, dist: 2000 })), [])
  assert.deepEqual(stalePackagesAt(fakePackage('no-build-script', { src: 2000, build: false })), [])
})

test('assertDistsAreFresh: throws naming the package and the rebuild command, passes when fresh', () => {
  assert.throws(() => assertDistsAreFresh(fakePackage('throws', { src: 2000, dist: 1000 })), /game-x.*pnpm --filter @adatechnology\/game-x build/)
  assert.doesNotThrow(() => assertDistsAreFresh(fakePackage('passes', { src: 1000, dist: 2000 })))
})

test('assertReportIsOfHead: a missing, dirty or other-commit pageBuild is refused, a clean one of HEAD passes', () => {
  assert.throws(() => assertReportIsOfHead({}, HEAD), /no pageBuild/)
  assert.throws(() => assertReportIsOfHead({ pageBuild: null }, HEAD), /no pageBuild/)
  assert.throws(() => assertReportIsOfHead({ pageBuild: { ...BUILD, dirty: true } }, HEAD), /dirty tree/)
  assert.throws(() => assertReportIsOfHead({ pageBuild: { ...BUILD, commit: 'c'.repeat(40) } }, HEAD), /HEAD is bbbbbbbbbbbb/)
  assert.doesNotThrow(() => assertReportIsOfHead({ pageBuild: BUILD }, HEAD))
})

test('saveBase: a refused report writes nothing', () => {
  const report = join(directory, 'refused-report.json')
  const baseFile = join(directory, 'refused-base.json')
  writeFileSync(report, JSON.stringify({ budgetMode: 'deadline', pageBuild: { ...BUILD, dirty: true } }))
  assert.throws(() => saveBase(report, baseFile, HEAD), /dirty/)
  assert.equal(existsSync(baseFile), false)
})
