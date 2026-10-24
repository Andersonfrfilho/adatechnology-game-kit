// Records the team audio fixtures: runs the literal cuts of jogo.js and Cena de Arte against a fake AudioContext under a seeded Math.random.
// Needs `pnpm build` first. Usage: node tools/golden/bin/record-audio.mjs [--seed 1]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { recordTeamAudioFixture, serializeTeamAudioFixture } from '../dist/team-audio.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const spec = resolve(root, 'specs/001-migracao-entregas-dos-times')
const seedFlag = process.argv.indexOf('--seed')
const seed = seedFlag > 0 ? Number(process.argv[seedFlag + 1]) : 1

const targets = [
  { profile: 'game', source: resolve(spec, 'artefatos/2UG1Mhe9LqJkQKKVsJkTWR/jogo.js'), out: 'game-audio.json' },
  { profile: 'art_scene', source: resolve(spec, 'sources/arte__cena-de-arte.js'), out: 'art-scene-audio.json' },
]
const outDir = resolve(root, 'tools/golden/fixtures/audio')
mkdirSync(outDir, { recursive: true })
for (const { profile, source, out } of targets) {
  const fixture = recordTeamAudioFixture(profile, readFileSync(source, 'utf8'), seed)
  writeFileSync(resolve(outDir, out), serializeTeamAudioFixture(fixture))
  console.log(`${out}: ${fixture.cases.length} cases`)
}
