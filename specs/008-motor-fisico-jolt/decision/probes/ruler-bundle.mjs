// Prints the ruler (`packages/game-destruction-three/tests/energy-ruler.ts`, no imports) as one JS expression that evaluates to its exports.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const ts = createRequire(`${root}package.json`)('typescript')
const source = readFileSync(`${root}packages/game-destruction-three/tests/energy-ruler.ts`, 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
process.stdout.write(`(() => { const exports = {}; ${outputText}\n return exports })()`)
