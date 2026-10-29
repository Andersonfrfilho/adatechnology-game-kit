#!/usr/bin/env node
// Locale audit: for every package (and example/site file) that carries pt-BR and en texts, lists the keys missing on either side,
// en texts that are a copy of the pt-BR, and placeholder mismatches. No dependencies besides the repo's own `typescript`.
//
//   node tools/locale-audit/audit.mjs [--check] [--json] [--package game-vfx]...
//
// --check exits 1 when anything is found. Allowed identical texts live in allowlist.json (see README.md).
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const ts = createRequire(join(root, 'package.json'))('typescript')

const args = process.argv.slice(2)
const wantCheck = args.includes('--check')
const wantValues = args.includes('--values')
const wantJson = args.includes('--json')
const onlyPackages = args.flatMap((arg, index) => (arg === '--package' ? [args[index + 1]] : []))

const allowlist = JSON.parse(readFileSync(join(here, 'allowlist.json'), 'utf8'))
const allowedValues = new Set(allowlist.values ?? [])
const allowedKeys = new Set(allowlist.keys ?? [])
const allowedPatterns = (allowlist.keyPatterns ?? []).map((pattern) => new RegExp(pattern))
const excluded = (allowlist.excluded ?? []).map((pattern) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`))

const knownGaps = allowlist.knownGaps ?? {}
const EN = 'en'
const PT = 'pt-BR'
const SOURCE_EXTENSIONS = ['.ts', '.js', '.mjs']

/** Owner of a file: the package folder, the example folder or `site`. */
const ownerOf = (file) => {
  const parts = relative(root, file).split('/')
  return parts[0] === 'site' ? 'site' : `${parts[0] === 'packages' ? '' : `${parts[0]}/`}${parts[1]}`
}

const isExcluded = (owner) => excluded.some((pattern) => pattern.test(owner))

const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', 'tests', 'captures', 'fixtures', 'assets', 'specs'].includes(name)) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}

const candidateFiles = () => {
  const files = []
  for (const group of ['packages', 'examples']) {
    for (const name of readdirSync(join(root, group))) walk(join(root, group, name), files)
  }
  walk(join(root, 'site'), files)
  return files.filter((file) => /\.(ts|js|mjs|json)$/.test(file) && !/\.d\.ts$/.test(file) && !/package(-lock)?\.json$|tsconfig|decisions\.json|test\.mjs$/.test(file))
}

// ---- tiny CommonJS loader over TypeScript's transpiler ----

const moduleCache = new Map()

const resolveImport = (from, request) => {
  if (request.startsWith('@adatechnology/')) {
    const name = request.slice('@adatechnology/'.length)
    const entry = join(root, 'packages', name, 'src/index.ts')
    return existsSync(entry) ? entry : undefined
  }
  if (!request.startsWith('.')) return undefined
  const base = resolve(dirname(from), request)
  const options = [base, ...SOURCE_EXTENSIONS.map((ext) => base + ext), ...SOURCE_EXTENSIONS.map((ext) => join(base, `index${ext}`)), `${base}.json`]
  return options.find((option) => existsSync(option) && statSync(option).isFile())
}

const topLevelNames = (sourceFile) => {
  const names = []
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text)
  }
  return names
}

const loadModule = (file) => {
  if (moduleCache.has(file)) return moduleCache.get(file).exports
  const record = { exports: {} }
  moduleCache.set(file, record)
  if (file.endsWith('.json')) {
    record.exports = JSON.parse(readFileSync(file, 'utf8'))
    return record.exports
  }
  const text = readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true)
  const exposed = topLevelNames(sourceFile)
  const probe = exposed.length > 0 ? `\n;(globalThis).__localeProbe = {${exposed.map((name) => `${JSON.stringify(name)}: (() => { try { return ${name} } catch { return undefined } })()`).join(',')}}\n` : ''
  const output = ts.transpileModule(text + probe, {
    fileName: `${file}.ts`,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, resolveJsonModule: true },
  }).outputText
  const localRequire = (request) => {
    const target = resolveImport(file, request)
    if (!target) return {}
    const loaded = loadModule(target)
    return target.endsWith('.json') ? { default: loaded, ...loaded, __esModule: true } : loaded
  }
  const sandbox = { module: record, exports: record.exports, require: localRequire, console, globalThis: {}, URLSearchParams, Intl }
  sandbox.globalThis = sandbox
  record.probe = undefined
  vm.runInNewContext(output, sandbox, { filename: file, timeout: 5000 })
  record.probe = sandbox.__localeProbe
  return record.exports
}

// ---- table detection ----

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

const flatten = (value, prefix = '', out = new Map()) => {
  if (typeof value === 'string' || typeof value === 'function') out.set(prefix, value)
  else if (Array.isArray(value)) value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out))
  else if (isPlainObject(value)) for (const [key, item] of Object.entries(value)) flatten(item, prefix === '' ? key : `${prefix}.${key}`, out)
  return out
}

/** Finds `{ en, 'pt-BR' }` pairs anywhere inside a value. A pair with only one of them comes back with the other as undefined. */
const findPairs = (value, path, found, seen) => {
  if (!isPlainObject(value) || seen.has(value)) return
  seen.add(value)
  if (EN in value || PT in value) {
    found.push({ path, en: value[EN], pt: value[PT] })
    return
  }
  for (const [key, item] of Object.entries(value)) findPairs(item, path === '' ? key : `${path}.${key}`, found, seen)
}

const normalizeTableName = (name) => name.replace(/[_-]/g, '').toLowerCase()

/** Pairs of standalone tables named like `EN` / `PT_BR`, `modesEn` / `modesPtBr`, `en` / `ptBR`. */
const findNamedPairs = (names) => {
  const pairs = []
  const byBase = new Map()
  for (const name of Object.keys(names)) {
    const normalized = normalizeTableName(name)
    const match = /^(.*?)(ptbr|en)$/.exec(normalized) ?? /^(ptbr|en)(.*)$/.exec(normalized)
    if (!match) continue
    const isPrefix = match[1] === 'ptbr' || match[1] === 'en'
    const lang = isPrefix ? match[1] : match[2]
    const base = isPrefix ? match[2] : match[1]
    const entry = byBase.get(base) ?? {}
    entry[lang] = names[name]
    byBase.set(base, entry)
  }
  for (const [base, entry] of byBase) if (entry.en !== undefined && entry.ptbr !== undefined) pairs.push({ path: base, en: entry.en, pt: entry.ptbr })
  return pairs
}

const tablesOfFile = (file) => {
  if (file.endsWith('.json')) {
    const data = loadModule(file)
    const found = []
    findPairs(data, '', found, new Set())
    return found
  }
  const exports = loadModule(file)
  const probe = moduleCache.get(file).probe ?? {}
  const found = []
  const seen = new Set()
  for (const [name, value] of Object.entries({ ...probe, ...exports })) findPairs(value, name, found, seen)
  const named = findNamedPairs({ ...probe, ...exports })
  for (const pair of named) if (![...seen].includes(pair.en) && !found.some((entry) => entry.en === pair.en)) found.push(pair)
  return found
}

/** `locales/en.json` next to `locales/pt-BR.json`. */
const jsonLocalePairs = (files) => {
  const pairs = []
  for (const file of files) {
    if (!file.endsWith(`/${EN}.json`)) continue
    const sibling = file.replace(`/${EN}.json`, `/${PT}.json`)
    if (files.includes(sibling)) pairs.push({ file, path: '', en: loadModule(file), pt: loadModule(sibling) })
  }
  return pairs
}

// ---- comparison ----

const placeholders = (text) => (typeof text === 'string' ? (text.match(/\{[^{}\s]*\}/g) ?? []).sort().join(' ') : '')

const STRUCTURAL_KEY = /(^|\.)(id|role|roles|state|base|action|living|crosses)(\[\d+\])?$/

const hasLetters = (text) => /\p{L}{3,}/u.test(text)

const compare = ({ owner, file, path, en, pt }) => {
  const result = { owner, file: relative(root, file), table: path, missingInEn: [], missingInPt: [], copies: [], placeholderMismatch: [], known: [], values: {}, keys: 0 }
  if (en === undefined || pt === undefined) {
    const side = en === undefined ? 'en' : 'pt-BR'
    if (owner in knownGaps) {
      result.known = [`whole table in ${side === 'en' ? 'pt-BR' : 'en'} only: ${knownGaps[owner]}`]
      return result
    }
    result[en === undefined ? 'missingInEn' : 'missingInPt'].push(`(whole table: only ${side === 'en' ? 'pt-BR' : 'en'} exists)`)
    return result
  }
  const flatEn = flatten(en)
  const flatPt = flatten(pt)
  result.keys = new Set([...flatEn.keys(), ...flatPt.keys()]).size
  for (const key of flatPt.keys()) if (!flatEn.has(key)) result.missingInEn.push(key)
  for (const key of flatEn.keys()) if (!flatPt.has(key)) result.missingInPt.push(key)
  for (const [key, enValue] of flatEn) {
    const ptValue = flatPt.get(key)
    if (typeof enValue !== 'string' || typeof ptValue !== 'string') continue
    const qualified = `${owner}::${path === '' ? key : `${path}.${key}`}`
    if (placeholders(enValue) !== placeholders(ptValue)) result.placeholderMismatch.push(key)
    if (enValue === ptValue && hasLetters(enValue) && !STRUCTURAL_KEY.test(key) && !allowedValues.has(enValue) && !allowedKeys.has(qualified) && !allowedPatterns.some((pattern) => pattern.test(qualified))) {
      result.copies.push(key)
      result.values[key] = enValue
    }
  }
  return result
}

const run = () => {
  const files = candidateFiles()
  const results = []
  const failures = []
  const pairedJson = new Set()
  for (const pair of jsonLocalePairs(files)) {
    pairedJson.add(pair.file)
    pairedJson.add(pair.file.replace(`/${EN}.json`, `/${PT}.json`))
    const owner = ownerOf(pair.file)
    if (!isExcluded(owner)) results.push(compare({ ...pair, owner }))
  }
  for (const file of files) {
    if (pairedJson.has(file)) continue
    const owner = ownerOf(file)
    if (isExcluded(owner)) continue
    if (onlyPackages.length > 0 && !onlyPackages.includes(owner)) continue
    const text = readFileSync(file, 'utf8')
    if (!/pt-BR|ptBR|PT_BR/.test(text)) continue
    try {
      for (const pair of tablesOfFile(file)) results.push(compare({ ...pair, owner, file }))
    } catch (error) {
      failures.push({ owner, file: relative(root, file), reason: String(error.message ?? error).split('\n')[0] })
    }
  }
  const seenSignatures = new Set()
  const unique = results.filter((entry) => {
    if (issuesOf(entry) === 0) return true
    const signature = `${entry.owner}|${entry.missingInEn}|${entry.missingInPt}|${entry.copies}|${entry.placeholderMismatch}`
    if (seenSignatures.has(signature)) return false
    seenSignatures.add(signature)
    return true
  })
  return { results: unique.filter((entry) => onlyPackages.length === 0 || onlyPackages.includes(entry.owner)), failures }
}

const issuesOf = (entry) => entry.missingInEn.length + entry.missingInPt.length + entry.copies.length

const report = ({ results, failures }) => {
  const byOwner = new Map()
  for (const entry of results) byOwner.set(entry.owner, [...(byOwner.get(entry.owner) ?? []), entry])
  const lines = []
  let total = 0
  for (const owner of [...byOwner.keys()].sort()) {
    const entries = byOwner.get(owner)
    const issues = entries.reduce((sum, entry) => sum + issuesOf(entry), 0)
    const keys = entries.reduce((sum, entry) => sum + entry.keys, 0)
    total += issues
    lines.push(`${issues === 0 ? 'ok  ' : 'FAIL'} ${owner}  (${keys} keys, ${issues} issues)`)
    for (const entry of entries) {
      if (issuesOf(entry) === 0 && entry.placeholderMismatch.length === 0 && entry.known.length === 0) continue
      const label = `${entry.file}${entry.table ? ` [${entry.table}]` : ''}`
      const show = (title, list) => list.length > 0 && lines.push(`     ${title} (${list.length}) in ${label}: ${list.slice(0, wantValues ? 400 : 40).join(', ')}${list.length > (wantValues ? 400 : 40) ? ', ...' : ''}`)
      show('known gap, not counted', entry.known)
      show('missing in en', entry.missingInEn)
      show('missing in pt-BR', entry.missingInPt)
      show('en copies pt-BR', wantValues ? entry.copies.map((key) => `${key}=${JSON.stringify(entry.values[key])}`) : entry.copies)
      show('note, not counted: placeholders differ (grammar)', entry.placeholderMismatch)
    }
  }
  for (const failure of failures) lines.push(`SKIP ${failure.owner}  ${failure.file}: could not be evaluated (${failure.reason})`)
  lines.push(`\n${byOwner.size} owners, ${total} issues, ${failures.length} files not evaluated`)
  return { text: lines.join('\n'), total }
}

const outcome = run()
if (wantJson) console.log(JSON.stringify(outcome, null, 2))
else console.log(report(outcome).text)
if (wantCheck && report(outcome).total > 0) process.exit(1)
