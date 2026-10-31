/* eslint-disable @typescript-eslint/no-require-imports -- a depcruise config is CommonJS */
// Layer rules of spec 005 (D1). Layers are decided by package name, so a new package lands in the right class without editing the rules.
// Known violations live in .dependency-cruiser-known-violations.json; `pnpm check:layers` fails only on a NEW one.
// Imports between workspace packages resolve to packages/<name>/src/index.ts through an alias, so the check needs no build.

const L0_CONTRACTS = ['game-contracts']
const L1_BASE = ['game-shapes', 'game-runtime']
const L3_CONTENT_PATTERN = '-(fleet|species|goods|household|residential|commercial|rural|post-apocalyptic|people|uniformed|undead)$'
const L3_CONTENT_NAMES = []
// game-props3d is a shared builder, not content (spec 005, D1): its PropsApi vocabulary, shape recorder and node skin are what content (household), cores and adapters all draw with.
// It sits beside L1: it imports no content and no adapter, and anything may import it.
const SHARED_BUILDERS = ['game-props3d']
// Imports of a shared builder that stay on purpose: 'file': 'reason'.
const SHARED_BUILDER_COMPAT_REEXPORTS = {
  'packages/game-props3d/src/merge-by-material.ts': 'deprecated re-export of mergeByMaterial kept by D2 until the next major of game-props3d',
}
const L4_ADAPTER_PATTERN = '-three$'
const L4_ADAPTER_NAMES = ['game-render-three']
const L4B_BRIDGES = ['game-floorplan-interactables']
const L5_COMPOSITION = ['game-test-room', 'game-kit-defaults']

// the adapters every domain adapter may use
const SHARED_ADAPTERS = ['game-shapes-three', 'game-render-three']

// Composition between domain adapters that is declared on purpose: 'from': { 'to': 'reason' }.
const FALLBACK_EFFECTS_WORLD = 'fallback effects world when the host passes none; item 12 removes it in Phase 5'
// The packages that have a src/test-area or src/bench folder (the code behind their ./testing subpath). Only they may compose other adapters there (D6).
const PACKAGES_WITH_TESTING_FOLDER = [
  'game-animals-three',
  'game-audio',
  'game-characters-three',
  'game-crowd-three',
  'game-floorplan-three',
  'game-items-three',
  'game-player',
  'game-stories',
  'game-terrain-three',
  'game-urban-three',
  'game-vegetation-three',
  'game-vehicles-three',
  'game-vfx-three',
  'game-weapons-three',
  'game-weather',
  'game-weather-three',
]
const TESTING_FOLDERS = '(test-area|bench)'

const D2_REASON = (packageName) => `D2: deprecated default until the next major of ${packageName}`
const ADAPTER_COMPOSITION_ALLOWLIST = {
  'game-destruction-three': { 'game-vfx-three': FALLBACK_EFFECTS_WORLD },
  'game-fluids-three': { 'game-vfx-three': FALLBACK_EFFECTS_WORLD },
  'game-weapons-three': { 'game-vfx-three': FALLBACK_EFFECTS_WORLD, 'game-items-three': D2_REASON('game-weapons-three') },
  'game-crowd-three': {
    'game-characters-three': 'the crowd renderer draws its bodies with the character rig (review item 4: stays, declared)',
  },
}

// Content imports of a core or an adapter that stay so an old call keeps working (spec 005, D2): 'file': { 'content package': 'reason' }.
// The by-option path is the recommended one and the preset (game-kit-defaults) uses it; the default import goes in the next major.
const D2_DEPRECATED_DEFAULTS = {
  'packages/game-urban/src/neighbourhoods/providers.ts': { 'game-vehicles-fleet': D2_REASON('game-urban'), 'game-vegetation-species': D2_REASON('game-urban') },
  'packages/game-stories/src/world.ts': { 'game-characters-people': D2_REASON('game-stories') },
  'packages/game-stories/src/sheet/sheet.ts': { 'game-characters-people': D2_REASON('game-stories') },
  'packages/game-stories/src/bench/module.ts': { 'game-characters-people': D2_REASON('game-stories') },
  'packages/game-characters-three/src/player/room-avatar.ts': { 'game-characters-people': D2_REASON('game-characters-three') },
  'packages/game-floorplan-three/src/furniture/spec.ts': { 'game-floorplan-residential': D2_REASON('game-floorplan-three') },
  'packages/game-vehicles-three/src/build.ts': { 'game-vehicles-fleet': D2_REASON('game-vehicles-three') },
  'packages/game-vehicles-three/src/test-area/module.ts': { 'game-vehicles-fleet': D2_REASON('game-vehicles-three') },
  'packages/game-vegetation-three/src/test-area/module.ts': { 'game-vegetation-species': D2_REASON('game-vegetation-three') },
  'packages/game-vegetation-three/src/test-area/nursery.ts': { 'game-vegetation-species': D2_REASON('game-vegetation-three') },
  'packages/game-vegetation-three/src/test-area/types.ts': { 'game-vegetation-species': D2_REASON('game-vegetation-three') },
  'packages/game-urban-three/src/resolvers.ts': { 'game-vegetation-species': D2_REASON('game-urban-three') },
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
  ![...L0_CONTRACTS, ...L1_BASE, ...SHARED_BUILDERS, ...L4B_BRIDGES, ...L5_COMPOSITION].includes(name)

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

// A rule that forbids content imports from `fromPackages`, except the D2 entries: each entry file is checked by its own rule that lets only the named content packages through.
const contentImportRules = (name, comment, fromPackages) => {
  const exempt = Object.entries(D2_DEPRECATED_DEFAULTS).filter(([file]) => fromPackages.some((packageName) => file.startsWith(`packages/${packageName}/`)))
  return [
    {
      name,
      comment,
      severity: 'error',
      from: { path: `^packages/(${fromPackages.join('|')})/src/`, ...(exempt.length === 0 ? {} : { pathNot: exempt.map(([file]) => `^${escapeDots(file)}$`) }) },
      to: { path: inPackages(contents) },
    },
    ...exempt.map(([file, allowed]) => ({
      name,
      comment: `${comment} ${file} keeps ${Object.keys(allowed).join(', ')} (${[...new Set(Object.values(allowed))].join('; ')}).`,
      severity: 'error',
      from: { path: `^${escapeDots(file)}$` },
      to: { path: inPackages(contents), pathNot: Object.keys(allowed).map((packageName) => `^packages/${escapeDots(packageName)}/`) },
    })),
  ]
}

const domainAdapterRules = adapters.map((adapterName) => {
  const allowed = [...SHARED_ADAPTERS, ...Object.keys(ADAPTER_COMPOSITION_ALLOWLIST[adapterName] ?? {})]
  return {
    name: 'no-domain-adapter-to-adapter',
    comment: 'A domain adapter only imports game-shapes-three and game-render-three; composition is listed in ADAPTER_COMPOSITION_ALLOWLIST (test-area/ and bench/ excepted, in the packages that have them).',
    severity: 'error',
    // test-area/ and bench/ are the code behind ./testing: a test area composes the other adapters on purpose (D6), in the packages that have those folders
    from: {
      path: `^packages/${escapeDots(adapterName)}/src/`,
      ...(PACKAGES_WITH_TESTING_FOLDER.includes(adapterName) ? { pathNot: `^packages/${escapeDots(adapterName)}/src/${TESTING_FOLDERS}/` } : {}),
    },
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
    ...contentImportRules('core-not-content', 'A core does not import content packs: the game swaps content by option.', [...L0_CONTRACTS, ...L1_BASE, ...cores]),
    {
      name: 'content-not-adapter',
      comment: 'Content is data: no -three adapter.',
      severity: 'error',
      from: { path: `^packages/(${contents.join('|')})/src/` },
      to: { path: inPackages(adapters) },
    },
    {
      name: 'shared-builder-not-content-or-adapter',
      comment: 'A shared builder (game-props3d) imports no content and no adapter; the one re-export left is in SHARED_BUILDER_COMPAT_REEXPORTS.',
      severity: 'error',
      from: { path: `^packages/(${SHARED_BUILDERS.join('|')})/src/`, pathNot: Object.keys(SHARED_BUILDER_COMPAT_REEXPORTS).map((file) => `^${escapeDots(file)}$`) },
      to: { path: inPackages([...contents, ...adapters]) },
    },
    ...contentImportRules('adapter-not-content', 'An adapter receives content by option; the default is wired by the composition layer.', adapters),
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
      comment: 'test-area/ and bench/ are reached through the ./testing subpath, not the package root: the root re-exports left for D2 are reported until the next major.',
      severity: 'warn',
      from: { path: '^packages/[^/]+/src/index\\.ts$' },
      to: { path: '^packages/[^/]+/src/(testing\\.ts$|(test-area|bench)/)' },
    },
    {
      name: 'no-runtime-to-testing',
      comment: 'Runtime code does not import test-area/ or bench/ (the code behind ./testing); only testing.ts, index.ts (the D2 re-exports) and the folders themselves do.',
      severity: 'error',
      from: { path: '^packages/[^/]+/src/', pathNot: '^packages/[^/]+/src/(testing\\.ts$|index\\.ts$|(test-area|bench)/)' },
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
