// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildKeys,
  changedPackages,
  checkKey,
  lintTargets,
  outsideReads,
  parseLsFiles,
  parseStatus,
  testJobs,
  toPackage,
  toWorkspace,
  withDependencies,
  withDependents,
  workspaceDeps,
} from '../plan.mjs'

const ws = toWorkspace([
  toPackage('packages/game-contracts', { name: '@a/contracts', scripts: { build: 'tsup' } }),
  toPackage('packages/game-shapes', { name: '@a/shapes', dependencies: { '@a/contracts': 'workspace:*', three: '^0.160.0' } }),
  toPackage('packages/game-floorplan', { name: '@a/floorplan', devDependencies: { '@a/shapes': 'workspace:^' } }),
  toPackage('packages/game-audio', { name: '@a/audio', peerDependencies: { '@a/contracts': 'workspace:*' } }),
  toPackage('tools/gpu', { name: '@a/gpu-tools' }),
])

/** @param {Record<string, string>} entries */
const ids = (entries) => new Map(Object.entries(entries))
const baseFiles = {
  'package.json': 'r1',
  'pnpm-lock.yaml': 'r2',
  'packages/game-contracts/src/index.ts': 'c1',
  'packages/game-shapes/src/index.ts': 's1',
  'packages/game-floorplan/src/index.ts': 'f1',
  'packages/game-audio/src/index.ts': 'a1',
  'specs/x.md': 'x1',
  'test-support/setup.ts': 't1',
}

test('only workspace: versions are workspace dependencies', () => {
  assert.deepEqual(workspaceDeps({ '@a/x': 'workspace:*', three: '^1' }), ['@a/x'])
  assert.deepEqual(workspaceDeps(undefined), [])
})

test('dependencies and dependents walk the graph both ways, through dev and peer dependencies', () => {
  assert.deepEqual([...withDependencies(ws, ['@a/floorplan'])].sort(), ['@a/contracts', '@a/floorplan', '@a/shapes'])
  assert.deepEqual([...withDependents(ws, ['@a/contracts'])].sort(), ['@a/audio', '@a/contracts', '@a/floorplan', '@a/shapes'])
  assert.deepEqual([...withDependents(ws, ['@a/floorplan'])], ['@a/floorplan'])
})

test('a changed file belongs to the package of its folder; files outside packages change none', () => {
  const changed = changedPackages(ws, ['packages/game-shapes/src/a.ts', 'tools/gpu/x.mjs', 'docs/a.md', 'examples/test-room/a.js'])
  assert.deepEqual([...changed].sort(), ['@a/gpu-tools', '@a/shapes'])
})

test('a build key changes with the package, its dependencies and the root inputs, and nothing else', () => {
  const before = buildKeys(ws, ids(baseFiles), 'v22')
  const shapes = buildKeys(ws, ids({ ...baseFiles, 'packages/game-shapes/src/index.ts': 's2' }), 'v22')
  assert.equal(shapes.get('@a/contracts'), before.get('@a/contracts'))
  assert.equal(shapes.get('@a/audio'), before.get('@a/audio'))
  assert.notEqual(shapes.get('@a/shapes'), before.get('@a/shapes'))
  assert.notEqual(shapes.get('@a/floorplan'), before.get('@a/floorplan'), 'a dependent is keyed by its dependency')

  const docs = buildKeys(ws, ids({ ...baseFiles, 'specs/x.md': 'x2' }), 'v22')
  assert.deepEqual([...docs], [...before], 'a file outside the packages builds nothing again')

  const lock = buildKeys(ws, ids({ ...baseFiles, 'pnpm-lock.yaml': 'r3' }), 'v22')
  for (const name of ws.keys()) assert.notEqual(lock.get(name), before.get(name))
  const node = buildKeys(ws, ids(baseFiles), 'v24')
  for (const name of ws.keys()) assert.notEqual(node.get(name), before.get(name))
})

test('a new or deleted file changes the key of its package', () => {
  const before = buildKeys(ws, ids(baseFiles), 'v22')
  const added = buildKeys(ws, ids({ ...baseFiles, 'packages/game-audio/src/new.ts': 'n1' }), 'v22')
  assert.notEqual(added.get('@a/audio'), before.get('@a/audio'))
  const { ['packages/game-audio/src/index.ts']: _gone, ...rest } = baseFiles
  assert.notEqual(buildKeys(ws, ids(rest), 'v22').get('@a/audio'), before.get('@a/audio'))
})

test('a package folder that is a prefix of another does not take its files', () => {
  const two = toWorkspace([toPackage('packages/game-a', { name: 'a' }), toPackage('packages/game-a-three', { name: 'a3' })])
  const one = buildKeys(two, ids({ 'packages/game-a/x': '1', 'packages/game-a-three/x': '1' }), 'v')
  const other = buildKeys(two, ids({ 'packages/game-a/x': '1', 'packages/game-a-three/x': '2' }), 'v')
  assert.equal(one.get('a'), other.get('a'))
})

test('the tests read outside the package: sibling packages and root folders are found in the sources', () => {
  const text = `
    import x from '../../game-items-goods/src/index'
    const specs = new URL('../../../specs/a.json', import.meta.url)
    readFileSync('../../../tools/golden/x')
    setupFiles: ['../../test-support/yield-between-tests.ts']`
  assert.deepEqual(outsideReads(text), { siblings: ['game-items-goods'], roots: ['specs', 'tools'] })
})

test('a recorded pass is keyed by what the tests read: the shared test folders always, the rest only when read', () => {
  /** @param {Record<string, string>} extra @param {{ siblings: string[], roots: string[] }} [reads] */
  const key = (extra, reads = { siblings: [], roots: [] }) => checkKey('b', ids({ ...baseFiles, ...extra }), reads)
  assert.equal(key({}), key({ 'specs/x.md': 'x2' }))
  assert.notEqual(key({}, { siblings: [], roots: ['specs'] }), key({ 'specs/x.md': 'x2' }, { siblings: [], roots: ['specs'] }))
  assert.notEqual(key({}), key({ 'test-support/setup.ts': 't2' }))
  const sibling = { siblings: ['game-audio'], roots: [] }
  assert.notEqual(key({}, sibling), key({ 'packages/game-audio/src/index.ts': 'a2' }, sibling))
})

test('lint: only the changed scripts, or everything when the rules change', () => {
  assert.deepEqual(lintTargets(['packages/a/src/x.ts', 'docs/a.md', 'specs/s.ts', 'tools/gpu/a.mjs']), { all: false, files: ['packages/a/src/x.ts', 'tools/gpu/a.mjs'] })
  assert.deepEqual(lintTargets(['eslint.config.mjs']), { all: true })
  assert.deepEqual(lintTargets(['tools/eslint/no-bare-remove.mjs']), { all: true })
  assert.deepEqual(lintTargets(['eslint-suppressions.json']), { all: true })
  assert.deepEqual(lintTargets(['README.md']), { all: false, files: [] })
})

test('git output: ls-files ids and the paths status lists, renames on both sides', () => {
  const ls = parseLsFiles('100644 abc 0\tpackages/a/x.ts\u0000100644 def 0\tREADME.md\u0000')
  assert.deepEqual([...ls], [['packages/a/x.ts', 'abc'], ['README.md', 'def']])
  assert.deepEqual(parseStatus(' M packages/a/x.ts\u0000?? new.ts\u0000R  to.ts\u0000from.ts\u0000 D gone.ts\u0000'), ['packages/a/x.ts', 'new.ts', 'to.ts', 'from.ts', 'gone.ts'])
})

test('test jobs: two at once (one on a small machine), or what PRE_PUSH_JOBS asks', () => {
  assert.equal(testJobs(24, undefined), 2)
  assert.equal(testJobs(4, undefined), 1)
  assert.equal(testJobs(24, '1'), 1)
  assert.equal(testJobs(24, 'x'), 2)
})
