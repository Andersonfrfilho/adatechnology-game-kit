import { readFileSync } from 'node:fs'

import { VM_GOLDENS } from './golden/vm-goldens'
import { serializeGolden, writeGolden } from './golden/write-golden'

const isCheck = process.argv.includes('--check')
const failures: string[] = []

for (const { id, path, record } of VM_GOLDENS) {
  if (!isCheck) {
    writeGolden(path, record())
    process.stdout.write(`golden written to ${path}\n`)
    continue
  }
  // Recorded twice in this process: the two must be byte-identical, and equal to the fixture in the repository.
  const [first, second] = [serializeGolden(record()), serializeGolden(record())]
  const problems = [first === second ? '' : 'two recordings differ', first === readFileSync(path, 'utf8') ? '' : 'differs from the fixture'].filter(Boolean)
  process.stdout.write(`${id}: ${problems.length === 0 ? 'identical twice and equal to the fixture' : problems.join(', ')}\n`)
  if (problems.length > 0) failures.push(id)
}
if (failures.length > 0) process.exit(1)
