import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { recordPage, writePatchedPage } from '@adatechnology/golden-tool/record-page'

import { CHROME_GOLDENS, GAME_THREE } from './golden/chrome-goldens'
import { CAPTURES_DIR } from './paths'
import type { ChromeGolden, Slices } from './golden/chrome-goldens'

const withSlices = (captureFile: string, slices: Slices | undefined, directory: string): string => {
  if (!slices) return join(CAPTURES_DIR, captureFile)
  const path = join(directory, captureFile)
  writeFileSync(path, `globalThis.__SLICES = ${JSON.stringify(slices)};\n${readFileSync(join(CAPTURES_DIR, captureFile), 'utf8')}`)
  return path
}

const record = async (golden: ChromeGolden, out: string): Promise<void> => {
  const directory = mkdtempSync(join(tmpdir(), 'characters-golden-'))
  const page = writePatchedPage(golden.page, golden.patches, directory)
  if (golden.gameThree) copyFileSync(GAME_THREE, join(directory, 'three.module.js'))
  await recordPage({
    page,
    capture: withSlices(golden.capture, golden.slices?.(), directory),
    out,
    ready: golden.ready ?? 'globalThis.__team',
    ...(golden.addons ? { addons: golden.addons } : {}),
  })
}

const isCheck = process.argv.includes('--check')
const selected = process.argv.slice(2).filter((argument) => !argument.startsWith('--'))
const failures: string[] = []

for (const golden of CHROME_GOLDENS.filter((entry) => selected.length === 0 || selected.includes(entry.id))) {
  if (!isCheck) {
    await record(golden, golden.out)
    continue
  }
  // Re-recorded twice into a scratch folder: the two recordings must be byte-identical, and equal to the fixture in the repository.
  const directory = mkdtempSync(join(tmpdir(), 'characters-golden-check-'))
  const [first, second] = [join(directory, 'first.json'), join(directory, 'second.json')]
  await record(golden, first)
  await record(golden, second)
  const [a, b, committed] = [readFileSync(first), readFileSync(second), readFileSync(golden.out)]
  const problems = [a.equals(b) ? '' : 'two recordings differ', a.equals(committed) ? '' : 'differs from the fixture'].filter(Boolean)
  process.stdout.write(`${golden.id}: ${problems.length === 0 ? 'identical twice and equal to the fixture' : problems.join(', ')}\n`)
  if (problems.length > 0) failures.push(golden.id)
}
if (failures.length > 0) process.exit(1)
