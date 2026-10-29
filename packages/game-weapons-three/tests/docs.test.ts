import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { auditWeapons } from './support/weapon-audit'
import { createArsenal } from '@adatechnology/game-weapons'
import { checklistDoc } from './support/checklist-doc'
import { reloadDoc } from './support/reload-doc'
import { checkWeapons } from './support/weapon-checks'

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

  it('checklist-animacoes.md is what the checks measure, and no weapon with a model is left with a ✗', () => {
    const rows = checkWeapons()
    const arsenal = createArsenal({ seed: 1 })
    const modelled = new Set(rows.map((row) => row.id))
    const without = [...arsenal.weapons.values()].filter((def) => !modelled.has(def.id)).map((def) => ({ id: def.id, name: def.name ?? def.id, category: def.category, kind: def.action.kind }))
    const text = checklistDoc(rows, without)
    const file = join(specs, 'checklist-animacoes.md')
    if (write) writeFileSync(file, text)
    expect(rows.filter((row) => [row.support, row.trigger, row.tactical, row.empty, row.time, row.contact, row.sound].some((check) => check.ok === false)).map((row) => row.id)).toEqual([])
    expect(readFileSync(file, 'utf8')).toBe(text)
  }, 120000)
})
