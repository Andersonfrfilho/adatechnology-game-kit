/* eslint-disable @typescript-eslint/no-require-imports -- a depcruise config is CommonJS */
// Layer rules of spec 005 (D1). Layers are decided by package name, so a new package lands in the right class without editing the rules.
// Known violations live in .dependency-cruiser-known-violations.json; `pnpm check:layers` fails only on a NEW one.
// Imports between workspace packages resolve to packages/<name>/src/index.ts through an alias, so the check needs no build.

const L0_CONTRACTS = ['game-contracts']
const L1_BASE = ['game-shapes', 'game-runtime']
const L3_CONTENT_PATTERN = '-(fleet|species|goods|household|residential|commercial|rural|post-apocalyptic|people|uniformed|undead)$'
const L3_CONTENT_NAMES = ['game-props3d']
const L4_ADAPTER_PATTERN = '-three$'
const L4_ADAPTER_NAMES = ['game-render-three']
const L4B_BRIDGES = ['game-floorplan-interactables']
const L5_COMPOSITION = ['game-test-room', 'game-kit-defaults']

// the adapters every domain adapter may use
const SHARED_ADAPTERS = ['game-shapes-three', 'game-render-three']

// Composition between domain adapters that is declared on purpose: 'from': { 'to': 'reason' }.
const ADAPTER_COMPOSITION_ALLOWLIST = {
  'game-crowd-three': {
    'game-characters-three': 'the crowd renderer draws its bodies with the character rig (review item 4: stays, declared)',
  },
}

const fs = require('node:fs')
const path = require('node:path')

const packageNames = fs
  .readdirSync(path.join(__dirname, 'packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

const isAdapter = (name) => new RegExp(L4_ADAPTER_PATTERN).test(name) || L4_ADAPTER_NAMES.includes(name)
const isContent = (name) => new RegExp(L3_CONTENT_PATTERN).test(name) || L3_CONTENT_NAMES.includes(name)
const isCore = (name) =>
  !isAdapter(name) &&
  !isContent(name) &&
  ![...L0_CONTRACTS, ...L1_BASE, ...L4B_BRIDGES, ...L5_COMPOSITION].includes(name)

// depcruise reads tsconfig `paths`, so a generated tsconfig maps every workspace package name to its source entry.
const workspacePaths = Object.fromEntries(
  packageNames.map((name) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'packages', name, 'package.json'), 'utf8'))
    return [manifest.name, [path.join(__dirname, 'packages', name, 'src', 'index.ts')]]
  }),
)
const generatedTsConfigDirectory = path.join(__dirname, 'node_modules', '.cache', 'dependency-cruiser')
const generatedTsConfig = path.join(generatedTsConfigDirectory, 'tsconfig.json')
fs.mkdirSync(generatedTsConfigDirectory, { recursive: true })
fs.writeFileSync(
  generatedTsConfig,
  JSON.stringify({ extends: path.join(__dirname, 'tsconfig.base.json'), include: [path.join(__dirname, 'packages/game-contracts/src')], compilerOptions: { baseUrl: __dirname, paths: workspacePaths } }),
)

const adapters = packageNames.filter(isAdapter)
const contents = packageNames.filter(isContent)
const cores = packageNames.filter(isCore)

const inPackages = (names) => (names.length === 0 ? '^$' : `^packages/(${names.join('|')})/`)
const escapeDots = (name) => name.replace(/[.]/g, '\\.')

const THREE_PATH = '(^|/)node_modules/(@types/)?three/|/three@[^/]+/node_modules/three/'

const domainAdapterRules = adapters.map((adapterName) => {
  const allowed = [...SHARED_ADAPTERS, ...Object.keys(ADAPTER_COMPOSITION_ALLOWLIST[adapterName] ?? {})]
  return {
    name: 'no-domain-adapter-to-adapter',
    comment: 'A domain adapter only imports game-shapes-three and game-render-three; composition is listed in ADAPTER_COMPOSITION_ALLOWLIST (test-area/ and bench/ excepted).',
    severity: 'error',
    // test-area/ and bench/ are the code behind ./testing: a test area composes the other adapters on purpose (D6)
    from: { path: `^packages/${escapeDots(adapterName)}/src/`, pathNot: `^packages/${escapeDots(adapterName)}/src/(test-area|bench)/` },
    to: {
      path: inPackages(adapters),
      pathNot: [`^packages/${escapeDots(adapterName)}/`, ...allowed.map((name) => `^packages/${escapeDots(name)}/`)],
    },
  }
})

module.exports = {
  forbidden: [
    {
      name: 'core-no-three',
      comment: 'L2 cores (and L0/L1) have no three.js: not the library and not a -three adapter.',
      severity: 'error',
      from: { path: `^packages/(${[...L0_CONTRACTS, ...L1_BASE, ...cores].join('|')})/src/` },
      to: { path: [THREE_PATH, inPackages(adapters)] },
    },
    {
      name: 'core-not-content',
      comment: 'A core does not import content packs: the game swaps content by option.',
      severity: 'error',
      from: { path: `^packages/(${[...L0_CONTRACTS, ...L1_BASE, ...cores].join('|')})/src/` },
      to: { path: inPackages(contents) },
    },
    {
      name: 'content-not-adapter',
      comment: 'Content is data: no -three adapter and no game-props3d.',
      severity: 'error',
      from: { path: `^packages/(${contents.join('|')})/src/` },
      to: { path: inPackages(adapters) },
    },
    {
      name: 'content-not-adapter',
      comment: 'Content is data: no -three adapter and no game-props3d (props3d itself is content, so it may import itself).',
      severity: 'error',
      from: { path: `^packages/(${contents.join('|')})/src/`, pathNot: '^packages/game-props3d/' },
      to: { path: '^packages/game-props3d/' },
    },
    {
      name: 'adapter-not-content',
      comment: 'An adapter receives content by option; the default is wired by the composition layer.',
      severity: 'error',
      from: { path: `^packages/(${adapters.join('|')})/src/` },
      to: { path: inPackages(contents) },
    },
    ...domainAdapterRules,
    {
      name: 'nothing-imports-test-room',
      comment: 'Only examples/ (outside the analysed scope) and the composition layer import the test room.',
      severity: 'error',
      from: { path: '^packages/', pathNot: '^packages/game-test-room/' },
      to: { path: '^packages/game-test-room/' },
    },
    {
      name: 'no-deep-import',
      comment: 'Import a package by its name or its exports subpaths, never by /src or /dist.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^@adatechnology/[^/]+/(src|dist)(/|$)' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true, dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'testing-only-from-testing',
      comment: 'test-area/ and bench/ are reached through the ./testing subpath, not the package root (reported until phase 2).',
      severity: 'warn',
      from: { path: '^packages/[^/]+/src/index\\.ts$' },
      to: { path: '^packages/[^/]+/src/(test-area|bench)/' },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules', '(^|/)dist/'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: generatedTsConfig },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
}
