// Turns the old-to-new tables of the five MIGRATION.md files into vc3-id-map.json, which the team-golden test uses to put
// an SDK plan back into the vocabulary the team page (PlantasSDK) speaks. Run again after a MIGRATION table changes:
//   node tests/fixtures/team-golden/build-vc3-id-map.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGES = join(HERE, '../../../..')
const FILES = {
  engine: 'game-floorplan/MIGRATION.md',
  residential: 'game-floorplan-residential/MIGRATION.md',
  commercial: 'game-floorplan-commercial/MIGRATION.md',
  rural: 'game-floorplan-rural/MIGRATION.md',
  postApocalyptic: 'game-floorplan-post-apocalyptic/MIGRATION.md',
}

const identifiersOf = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1])

function pairsOf(line) {
  const cells = line.split('|').slice(1, -1).map((cell) => cell.trim())
  if (cells.length < 2) return []
  const [oldNames, newNames] = [identifiersOf(cells[0]), identifiersOf(cells[1])]
  if (oldNames.length === 0 || oldNames.length !== newNames.length) return []
  return oldNames.map((oldName, index) => [oldName, newNames[index]])
}

function tablesOf(markdown) {
  const tables = {}
  let heading = ''
  for (const line of markdown.split('\n')) {
    if (line.startsWith('#')) heading = line.replace(/^#+\s*/, '').trim()
    else if (line.startsWith('|')) (tables[heading] ??= []).push(...pairsOf(line))
  }
  return Object.fromEntries(Object.entries(tables).filter(([, pairs]) => pairs.length > 0))
}

const map = Object.fromEntries(Object.entries(FILES).map(([name, file]) => [name, tablesOf(readFileSync(join(PACKAGES, file), 'utf8'))]))
writeFileSync(join(HERE, 'vc3-id-map.json'), JSON.stringify(map, null, 1) + '\n')
console.log('vc3-id-map.json written')
