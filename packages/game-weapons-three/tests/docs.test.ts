import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { auditWeapons } from './support/weapon-audit'
import { reloadDoc } from './support/reload-doc'

const specs = join(__dirname, '../../../specs/001-migracao-entregas-dos-times')
const write = process.env.WRITE_DOCS === '1'

const audit = auditWeapons()

describe('the spec documents of the weapons', () => {
  it('recargas-por-arma.md is what the data generates', () => {
    const text = reloadDoc(audit)
    const file = join(specs, 'recargas-por-arma.md')
    if (write) writeFileSync(file, text)
    expect(existsSync(file)).toBe(true)
    expect(readFileSync(file, 'utf8')).toBe(text)
  })
})
