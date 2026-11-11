// @ts-check
// What `pnpm check:<area>` runs (tools/check-area/plan.mjs), and that every test area has its check:<area> script in the root package.json.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { areaId, listAreas, pagePackages, planCheck } from '../plan.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

test('area names drop the -test-area and -area suffixes', () => {
  assert.equal(areaId('floorplan-test-area'), 'floorplan')
  assert.equal(areaId('vehicles-proving-area'), 'vehicles-proving')
  assert.equal(areaId('interactables-showroom'), 'showroom')
  assert.equal(areaId('test-room'), 'room')
  assert.equal(areaId('items-test-area'), 'items-area')
})

test('every test area has a check:<area> script that runs this tool', () => {
  const manifest = /** @type {{ scripts: Record<string, string> }} */ (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')))
  const areas = listAreas(root)
  assert.ok(areas.length >= 15)
  for (const area of areas) assert.equal(manifest.scripts[`check:${area.id}`], `node tools/check-area/check-area.mjs ${area.id}`, `check:${area.id}`)
})

test('the page packages come from the manifest and from the build script, only workspace packages', () => {
  const found = pagePackages({
    manifest: JSON.stringify({ devDependencies: { '@adatechnology/game-floorplan': 'workspace:*', 'other': '1' } }),
    build: "const packages = ['game-contracts', 'game-unknown']\nconst p = pkg('game-floorplan-three')",
    packages: ['game-contracts', 'game-floorplan', 'game-floorplan-three'],
  })
  assert.deepEqual(found, ['game-contracts', 'game-floorplan', 'game-floorplan-three'])
})

const area = { id: 'floorplan', folder: 'floorplan-test-area', name: '@adatechnology/floorplan-test-area' }
const all = { unit: true, browser: true, room: false }

test('with the room page built: build, area build, unit tests, page', () => {
  const steps = planCheck({ area, packages: ['game-floorplan'], roomPackages: ['game-test-room'], roomBuilt: true, flags: all })
  assert.deepEqual(steps.map((step) => step.args.join(' ')), [
    '--filter @adatechnology/game-floorplan... run build',
    'examples/floorplan-test-area/build.mjs',
    '--filter @adatechnology/game-floorplan run test',
    'examples/floorplan-test-area/test.mjs',
  ])
})

test('without the room page (or with --room) the room packages and page are built first', () => {
  for (const [roomBuilt, room] of [[false, false], [true, true]]) {
    const steps = planCheck({ area, packages: ['game-floorplan'], roomPackages: ['game-test-room'], roomBuilt, flags: { ...all, room } })
    assert.equal(steps[0]?.args.join(' '), '--filter @adatechnology/game-floorplan... --filter @adatechnology/game-test-room... run build')
    assert.equal(steps[1]?.args.join(' '), 'examples/test-room/build.mjs')
  }
})

test('--no-unit and --no-browser leave those steps out', () => {
  const steps = planCheck({ area, packages: ['game-floorplan'], roomPackages: [], roomBuilt: true, flags: { unit: false, browser: false, room: false } })
  assert.deepEqual(steps.map((step) => step.args.at(-1)), ['build', 'examples/floorplan-test-area/build.mjs'])
})

test('the showroom is not built over the room page', () => {
  const showroom = { id: 'showroom', folder: 'interactables-showroom', name: 'x' }
  const steps = planCheck({ area: showroom, packages: ['game-interactables'], roomPackages: ['game-test-room'], roomBuilt: false, flags: all })
  assert.ok(steps.every((step) => !step.args.join(' ').includes('test-room')))
})
