import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import type { GoldenRecord } from '@adatechnology/golden-tool'

/** One event per line, so a large golden stays readable in a diff and small in the repository. */
export const serializeGolden = (record: GoldenRecord): string => {
  const events = record.events.map((event) => `  ${JSON.stringify(event)}`).join(',\n')
  const scenes = JSON.stringify(record.scenes)
  return `{\n "schema": 1,\n "name": ${JSON.stringify(record.name)},\n "seed": ${record.seed},\n "events": [\n${events}\n ],\n "scenes": ${scenes}\n}\n`
}

export const writeGolden = (path: string, record: GoldenRecord): void => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, serializeGolden(record))
}
