// @ts-check
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { AREAS, BASE_PACKAGES, basePackagesOf, readWorkspace, selectSuites, SUITES } from '../select-suites.mjs'

const workspace = readWorkspace(resolve(dirname(fileURLToPath(import.meta.url)), '../../..'))
/** @param {readonly string[]} changed */
const idsFor = (changed) => selectSuites(workspace, changed).suites.map((suite) => suite.id)
const ROOM_SUITES = ['test-room', 'scene', 'cost', 'leak']

test('a change only to docs, specs, markdown or unit tests runs no browser suite', () => {
  const selection = selectSuites(workspace, ['docs/a.md', 'specs/004/tasks.md', 'packages/game-vfx/README.md', 'packages/game-vfx/tests/burst.test.ts', '.changeset/x.md', '.github/workflows/ci.yml'])
  assert.equal(selection.all, false)
  assert.deepEqual(selection.suites, [])
})

test('a base file or package runs every suite, with the reason', () => {
  for (const file of ['.githooks/pre-push', 'tools/gpu/perf-gate.mjs', 'package.json', 'pnpm-lock.yaml', 'tsconfig.base.json', 'examples/test-room/src/main.js', 'packages/game-contracts/src/index.ts', 'packages/game-test-room/src/room.ts']) {
    const selection = selectSuites(workspace, [file])
    assert.equal(selection.all, true, file)
    assert.match(selection.reason, new RegExp(file.replace(/[.]/g, '\\.')))
    assert.equal(selection.suites.length, SUITES.length)
  }
})

test('a path outside the map runs every suite', () => {
  assert.equal(selectSuites(workspace, ['assets/sfx-inbox/new.wav']).all, true)
})

test('a leaf package runs the areas that load it and the room, not the others', () => {
  const ids = idsFor(['packages/game-weather-three/src/rain.ts'])
  for (const id of ['weather-test-area', 'interactables-test-area', ...ROOM_SUITES]) assert.ok(ids.includes(id), id)
  for (const id of ['audio-test-area', 'vfx-test-area', 'characters-test-area', 'stories-test-area']) assert.ok(!ids.includes(id), id)
})

test('a package runs the areas of the packages that depend on it', () => {
  // game-vfx is drawn by game-vfx-three, which vfx-test-area loads
  assert.ok(idsFor(['packages/game-vfx/src/burst.ts']).includes('vfx-test-area'))
  // the animals are loaded by the animals area only: the sound area (which loads the test room, and through it the effects) does not run
  const animals = idsFor(['packages/game-animals/src/species.ts'])
  assert.ok(animals.includes('animals-test-area'))
  assert.ok(!animals.includes('audio-test-area'))
})

test('an example folder runs only its own suite; tools/kit-audit runs scene and cost', () => {
  assert.deepEqual(idsFor(['examples/audio-test-area/test.mjs']), ['audio-test-area'])
  assert.deepEqual(idsFor(['tools/kit-audit/rules.json']), ['scene', 'cost'])
  assert.deepEqual(idsFor(['tools/golden/src/cli.ts']), [])
})

test('every area of the battery has a suite, and the room suites open the room page', () => {
  assert.deepEqual(SUITES.filter((suite) => suite.group === 'areas').map((suite) => suite.id), [...AREAS])
  for (const id of ROOM_SUITES) assert.ok(SUITES.find((suite) => suite.id === id)?.pages.includes('test-room'), id)
})

test('the base list holds every package three in four area pages load (the graph rule)', () => {
  for (const name of basePackagesOf(workspace)) assert.ok(BASE_PACKAGES.includes(name), `${name} is loaded by most areas: add it to BASE_PACKAGES`)
})

test('a push leaves the suites that open the whole room to the nightly run', async () => {
  const { splitForPush, NIGHTLY_SUITES } = await import('../select-suites.mjs')
  const selection = { suites: [{ id: 'weapons-test-area', reasons: ['game-weapons'] }, { id: 'test-room', reasons: ['game-weapons'] }, { id: 'scene', reasons: [] }, { id: 'leak', reasons: [] }] }
  assert.deepEqual(splitForPush(selection, false), { run: [{ id: 'weapons-test-area', reasons: ['game-weapons'] }], left: ['test-room', 'scene', 'leak'] })
  assert.deepEqual(splitForPush(selection, true).run.map((picked) => picked.id), ['weapons-test-area', 'test-room', 'scene', 'leak'])
  assert.deepEqual([...NIGHTLY_SUITES], ['test-room', 'scene', 'cost', 'leak'])
})
