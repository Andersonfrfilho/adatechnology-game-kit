// pnpm check:packages — package.json policy of spec 005 (D9) and "declared = imported" for internal dependencies. Needs no build.
// Exits 1 with one line per problem.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const THREE_PEER_RANGE = '^0.160.0'
const INTERNAL_RANGE = 'workspace:^'
const INTERNAL_SCOPE = '@adatechnology/'
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

const SOURCE_FILE = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/
const BUNDLER_CONFIG_FILE = /\.config\.(ts|mts|js|mjs|cjs)$/ // noExternal lists name packages without importing them
const IGNORED_DIRECTORIES = new Set(['node_modules', 'dist'])
const INTERNAL_IMPORT = /['"](@adatechnology\/[a-z0-9-]+)(?:\/[^'"]*)?['"]/g
const TESTING_ONLY_SOURCE = /^src\/(test-area|bench)\//
const RUNTIME_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies']

// Declared on purpose without an import: package -> { dependency: reason }.
const DECLARED_WITHOUT_IMPORT = {
  'game-floorplan-commercial': {
    '@adatechnology/game-floorplan-residential': 'registration order: the pack reuses residential libraries and palette, so residential must be registered first',
  },
  'game-floorplan-rural': {
    '@adatechnology/game-floorplan-residential': 'registration order: the pack extends residential libraries and the "mid" palette, so residential must be registered first',
  },
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

const packageDirectories = readdirSync(join(ROOT, 'packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

function listSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return IGNORED_DIRECTORIES.has(entry.name) ? [] : listSourceFiles(join(directory, entry.name))
    return SOURCE_FILE.test(entry.name) && !BUNDLER_CONFIG_FILE.test(entry.name) ? [join(directory, entry.name)] : []
  })
}

// Internal packages imported by a package, split by where they are imported: production source, test-only source, tests and scripts.
function collectInternalImports(packageDirectory) {
  const imports = { production: new Set(), testingSource: new Set(), outsideSource: new Set() }
  for (const file of listSourceFiles(packageDirectory)) {
    const relativePath = relative(packageDirectory, file)
    const bucket = !relativePath.startsWith('src/') ? 'outsideSource' : TESTING_ONLY_SOURCE.test(relativePath) ? 'testingSource' : 'production'
    for (const match of readFileSync(file, 'utf8').matchAll(INTERNAL_IMPORT)) imports[bucket].add(match[1])
  }
  return imports
}

function checkDeclaredEqualsImported(directory, manifest, report) {
  const imports = collectInternalImports(join(ROOT, 'packages', directory))
  const importedAnywhere = new Set([...imports.production, ...imports.testingSource, ...imports.outsideSource])
  const declaredIn = (field) => Object.keys(manifest[field] ?? {}).filter((name) => name.startsWith(INTERNAL_SCOPE))
  const runtimeDeclared = new Set(RUNTIME_FIELDS.flatMap(declaredIn))
  const allDeclared = new Set([...runtimeDeclared, ...declaredIn('devDependencies')])
  const allowed = DECLARED_WITHOUT_IMPORT[directory] ?? {}

  for (const name of imports.production) {
    if (name !== manifest.name && !runtimeDeclared.has(name)) report(`${name} is imported by src/ but is not in dependencies or peerDependencies`)
  }
  for (const name of [...imports.testingSource, ...imports.outsideSource]) {
    if (name !== manifest.name && !allDeclared.has(name)) report(`${name} is imported (tests, test-area or bench) but is not declared`)
  }
  for (const name of runtimeDeclared) {
    if (allowed[name] || imports.production.has(name) || imports.testingSource.has(name)) continue
    const where = importedAnywhere.has(name) ? 'only by tests: move it to devDependencies' : 'by nothing: remove it'
    report(`${name} is declared for runtime but imported ${where}`)
  }
  for (const name of declaredIn('devDependencies')) {
    if (!importedAnywhere.has(name) && !runtimeDeclared.has(name)) report(`devDependencies.${name} is imported by nothing: remove it`)
  }
}

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
  checkDeclaredEqualsImported(directory, manifest, report)

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
