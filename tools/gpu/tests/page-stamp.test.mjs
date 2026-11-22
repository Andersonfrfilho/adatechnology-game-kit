// @ts-check
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'

import { assertStampIsHead, dirtyStateOf, hasRelevantChange, isPageRelevantPath, pageHashOf, parsePageStamp, stampMarkupOf, stripPageStamp } from '../page-stamp.mjs'
import { assertReportIsOfHead, saveBase, trySaveBase } from '../room-explosion-base.mjs'
import { distFilesOf } from '../../../examples/test-room/page-packages.mjs'
import { assertDistsAreFresh, stalePackagesAt, stalePackagesOf } from '../stale-dist.mjs'

// a git hook exports these, and the temp repo below would then commit into the real one
for (const key of Object.keys(process.env)) if (key.startsWith('GIT_')) delete process.env[key]

const HEAD = 'b'.repeat(40)
const MACHINE = { gpu: { renderer: 'NVIDIA GeForce RTX 5070 Laptop GPU', vendor: 'NVIDIA Corporation', tier: 'discrete', driver: { module: '620.73.04', userspace: '620.73.04', mismatch: false } } }
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

/** @param {string} root */
const staleAt = (root) => stalePackagesAt(root).map(({ name }) => name)
/** @param {string} name @param {number | undefined} srcNewestMs @param {(number | undefined)[]} distEntryMs @param {string[]} [dependencies] @returns {import('../stale-dist.mjs').PackageTimes} */
const times = (name, srcNewestMs, distEntryMs, dependencies = []) => ({ name, srcNewestMs, distEntryMs, dependencies })
/** @param {import('../stale-dist.mjs').PackageTimes[]} packages @param {string[]} [checked] */
const staleNames = (packages, checked = packages.map(({ name }) => name)) => stalePackagesOf(packages, checked).map(({ name }) => name)

test('stalePackagesOf: src newer than a dist entry, a missing entry, fresh and src-less packages', () => {
  assert.deepEqual(
    staleNames([times('newer-src', 200, [100]), times('no-dist', 200, [undefined]), times('one-entry-stale', 200, [300, 100]), times('fresh', 100, [200, 300]), times('same-time', 100, [100]), times('no-src', undefined, [undefined])]),
    ['newer-src', 'no-dist', 'one-entry-stale'],
  )
})

test('stalePackagesOf: a dependency whose src is newer makes the dependent stale and is named', () => {
  const graph = [times('app', 100, [200], ['lib']), times('lib', 300, [400])]
  assert.deepEqual(stalePackagesOf(graph, ['app']), [{ name: 'app', isMissing: false, newerSources: ['lib'] }])
  assert.deepEqual(staleNames([times('app', 100, [200], ['lib']), times('lib', 150, [400])]), [])
})

test('stalePackagesOf: dependencies count transitively (A -> B -> C, C changed)', () => {
  const graph = [times('a', 100, [200], ['b']), times('b', 100, [500], ['c']), times('c', 300, [500])]
  assert.deepEqual(stalePackagesOf(graph, ['a']), [{ name: 'a', isMissing: false, newerSources: ['c'] }])
})

test('stalePackagesOf: a dependency cycle ends and a dependency outside the graph is ignored', () => {
  const cycle = [times('a', 100, [200], ['b']), times('b', 100, [200], ['a', 'not-in-packages'])]
  assert.deepEqual(staleNames(cycle), [])
  assert.deepEqual(staleNames([times('a', 300, [200], ['b']), times('b', 100, [200], ['a'])]), ['a', 'b'])
})

/** A fake repo root with one package. @param {string} name @param {string} packageName @param {{ src: number, dist?: number }} timestamps @param {string[]} [dependencies] */
const fakePackage = (name, packageName, { src, dist }, dependencies = []) => {
  const root = join(directory, name)
  const folder = join(root, 'packages', packageName)
  mkdirSync(join(folder, 'src', 'deep'), { recursive: true })
  writeFileSync(join(folder, 'package.json'), JSON.stringify({ dependencies: Object.fromEntries(dependencies.map((dependency) => [`@adatechnology/${dependency}`, 'workspace:*'])) }))
  writeFileSync(join(folder, 'src', 'deep', 'a.ts'), '')
  utimesSync(join(folder, 'src', 'deep', 'a.ts'), src, src)
  utimesSync(join(folder, 'src', 'deep'), src, src)
  utimesSync(join(folder, 'src'), src, src)
  if (dist !== undefined) {
    mkdirSync(join(folder, 'dist'), { recursive: true })
    for (const file of distFilesOf(packageName)) {
      writeFileSync(join(folder, file), '')
      utimesSync(join(folder, file), dist, dist)
    }
  }
  return root
}

test('stalePackagesAt: nested src files against the dist entry; a package bundled from src is ignored', () => {
  assert.deepEqual(staleAt(fakePackage('stale', 'game-audio', { src: 2000, dist: 1000 })), ['game-audio'])
  assert.deepEqual(staleAt(fakePackage('missing', 'game-audio', { src: 2000 })), ['game-audio'])
  assert.deepEqual(staleAt(fakePackage('fresh', 'game-audio', { src: 1000, dist: 2000 })), [])
  assert.deepEqual(staleAt(fakePackage('from-src', 'game-physics', { src: 2000 })), [])
  assert.deepEqual(staleAt(fakePackage('not-bundled', 'game-vehicles', { src: 2000 })), [])
})

test('stalePackagesAt: a newer unrelated file in dist does not hide a stale entry', () => {
  const root = fakePackage('unrelated', 'game-audio', { src: 2000, dist: 1000 })
  const other = join(root, 'packages', 'game-audio', 'dist', 'other-script-output.json')
  writeFileSync(other, '')
  utimesSync(other, 3000, 3000)
  assert.deepEqual(staleAt(root), ['game-audio'])
})

test('stalePackagesAt: a subpath entry the page resolves counts (game-audio/fitted)', () => {
  const root = fakePackage('subpath', 'game-audio', { src: 2000, dist: 3000 })
  assert.deepEqual(staleAt(root), [])
  utimesSync(join(root, 'packages', 'game-audio', 'dist', 'fitted.js'), 1000, 1000)
  assert.deepEqual(staleAt(root), ['game-audio'])
})

test('stalePackagesAt: a file deleted from src (only its folder mtime moves) is stale', () => {
  const root = fakePackage('deleted', 'game-audio', { src: 1000, dist: 2000 })
  assert.deepEqual(staleAt(root), [])
  const deep = join(root, 'packages', 'game-audio', 'src', 'deep')
  writeFileSync(join(deep, 'b.ts'), '')
  utimesSync(join(deep, 'b.ts'), 1000, 1000)
  utimesSync(deep, 1000, 1000)
  unlinkSync(join(deep, 'b.ts'))
  utimesSync(deep, 3000, 3000)
  assert.deepEqual(staleAt(root), ['game-audio'])
})

test('stalePackagesAt: reads package.json dependencies; a workspace dependency edited after the dependent was built makes it stale', () => {
  const root = fakePackage('deps', 'game-floorplan-three', { src: 1000, dist: 2000 }, ['game-destruction', 'not-a-workspace-folder'])
  fakePackage('deps', 'game-destruction', { src: 1000, dist: 2000 })
  assert.deepEqual(staleAt(root), [])
  const source = join(root, 'packages', 'game-destruction', 'src', 'deep', 'a.ts')
  utimesSync(source, 3000, 3000)
  assert.deepEqual(staleAt(root), ['game-destruction', 'game-floorplan-three'])
  assert.throws(() => assertDistsAreFresh(root), /game-floorplan-three \(src of game-destruction is newer\)/)
})

test('assertDistsAreFresh: throws naming the package and the rebuild command, passes when fresh', () => {
  assert.throws(() => assertDistsAreFresh(fakePackage('throws', 'game-audio', { src: 2000, dist: 1000 })), /game-audio.*pnpm --filter "@adatechnology\/game-audio\.\.\." build/)
  assert.doesNotThrow(() => assertDistsAreFresh(fakePackage('passes', 'game-audio', { src: 1000, dist: 2000 })))
})

test('isPageRelevantPath: sources count, screenshots and unrelated folders do not', () => {
  assert.equal(isPageRelevantPath('packages/game-audio/src/a.ts'), true)
  assert.equal(isPageRelevantPath('tools/gpu/room-explosion.mjs'), true)
  assert.equal(isPageRelevantPath('examples/test-room/src/main.js'), true)
  assert.equal(isPageRelevantPath('examples/test-room/shots/burning-sofa.png'), false)
  assert.equal(isPageRelevantPath('docs/a.md'), false)
  assert.equal(isPageRelevantPath('package.json'), false)
})

test('hasRelevantChange: only screenshots is clean, a source (or a rename into one) is dirty', () => {
  assert.equal(hasRelevantChange(' M examples/audio-test-area/shots/audio-en.png\n M examples/x/shots/b.png\n'), false)
  assert.equal(hasRelevantChange(''), false)
  assert.equal(hasRelevantChange(' M examples/x/shots/b.png\n M packages/game-audio/src/a.ts\n'), true)
  assert.equal(hasRelevantChange('R  docs/a.md -> packages/p/src/a.ts\n'), true)
})

/** A temp git repo with a screenshot, a package source and a clean commit. @returns {{ root: string, head: string }} */
const gitRepo = () => {
  const root = mkdtempSync(join(directory, 'repo-'))
  const git = (/** @type {string[]} */ ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root, encoding: 'utf8' }).trim()
  git('init', '-q')
  mkdirSync(join(root, 'examples/x/shots'), { recursive: true })
  mkdirSync(join(root, 'packages/x/src'), { recursive: true })
  writeFileSync(join(root, 'examples/x/shots/a.png'), 'one')
  writeFileSync(join(root, 'packages/x/src/a.ts'), 'one')
  git('add', '-A')
  git('commit', '-q', '-m', 'init')
  return { root, head: git('rev-parse', 'HEAD') }
}

test('dirtyStateOf with real git: a rewritten screenshot is clean, a changed source is dirty, and saveBase follows the stamp', () => {
  const { root, head } = gitRepo()
  const report = join(directory, 'git-report.json')
  const baseFile = join(directory, 'git-base.json')
  const reportOf = () => JSON.stringify({ budgetMode: 'deadline', machine: MACHINE, pageBuild: parsePageStamp(page(stampMarkupOf({ commit: head, dirty: dirtyStateOf(root), builtAt: 'now' }))) })

  writeFileSync(join(root, 'examples/x/shots/a.png'), 'two')
  assert.equal(dirtyStateOf(root), false)
  writeFileSync(report, reportOf())
  saveBase(report, baseFile, head)
  assert.equal(JSON.parse(readFileSync(baseFile, 'utf8')).budgetMode, 'deadline')

  rmSync(baseFile)
  writeFileSync(join(root, 'packages/x/src/a.ts'), 'two')
  assert.equal(dirtyStateOf(root), true)
  writeFileSync(report, reportOf())
  assert.throws(() => saveBase(report, baseFile, head), /dirty tree/)
  assert.equal(existsSync(baseFile), false)
})

test('trySaveBase: a refusal comes back as a reason and writes nothing, an accepted report saves', () => {
  const report = join(directory, 'try-report.json')
  const baseFile = join(directory, 'try-base.json')
  writeFileSync(report, JSON.stringify({ budgetMode: 'deadline', pageBuild: { ...BUILD, dirty: true } }))
  const refused = trySaveBase(report, baseFile, HEAD)
  assert.equal(refused.ok, false)
  assert.match(String('reason' in refused ? refused.reason : ''), /dirty tree/)
  assert.equal(existsSync(baseFile), false)
  writeFileSync(report, JSON.stringify({ budgetMode: 'deadline', machine: MACHINE, pageBuild: BUILD }))
  assert.deepEqual(trySaveBase(report, baseFile, HEAD), { ok: true })
  assert.equal(existsSync(baseFile), true)
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
