// pnpm check:packages — package.json policy of spec 005 (D9). Needs no build. Exits 1 with one line per problem.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const THREE_PEER_RANGE = '^0.160.0'
const INTERNAL_RANGE = 'workspace:^'
const INTERNAL_SCOPE = '@adatechnology/'
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

const packageDirectories = readdirSync(join(ROOT, 'packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

const problems = []

for (const directory of packageDirectories) {
  const manifest = readJson(join(ROOT, 'packages', directory, 'package.json'))
  const report = (message) => problems.push(`packages/${directory}: ${message}`)

  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, range] of Object.entries(manifest[field] ?? {})) {
      if (name.startsWith(INTERNAL_SCOPE) && range !== INTERNAL_RANGE) report(`${field}.${name} is "${range}", expected "${INTERNAL_RANGE}"`)
    }
  }

  for (const field of ['dependencies', 'optionalDependencies']) {
    if (manifest[field]?.three) report(`three is in ${field}; it must be a peerDependency`)
  }
  const threePeer = manifest.peerDependencies?.three
  if (threePeer !== undefined && threePeer !== THREE_PEER_RANGE) report(`peerDependencies.three is "${threePeer}", expected "${THREE_PEER_RANGE}"`)
  if (threePeer !== undefined && !manifest.devDependencies?.three) report('peerDependencies.three needs a devDependency three for the tests')
}

const changesetConfig = readJson(join(ROOT, '.changeset', 'config.json'))
const unsafeOptions = changesetConfig.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH ?? {}
if (unsafeOptions.onlyUpdatePeerDependentsWhenOutOfRange !== true) {
  problems.push('.changeset/config.json: ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH.onlyUpdatePeerDependentsWhenOutOfRange must be true')
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
  console.error(`\ncheck:packages failed: ${problems.length} problem(s)`)
  process.exit(1)
}
console.log(`check:packages ok (${packageDirectories.length} packages)`)
