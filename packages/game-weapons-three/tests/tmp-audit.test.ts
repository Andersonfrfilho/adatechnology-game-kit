import { it } from 'vitest'
import * as THREE from 'three'
import { writeFileSync } from 'node:fs'
import { createArsenal, planReload } from '@adatechnology/game-weapons'
import { buildWeaponModelById, hasWeaponModel } from '../src/models'
import { buildToolClips } from '../src/animation/clip-set'

it('audit', () => {
  const arsenal = createArsenal({ rules: { faults: false } })
  const rows: unknown[] = []
  for (const def of arsenal.weapons.values ? [...arsenal.weapons.values()] : (arsenal as any).list()) {
    const a: any = def.action
    const row: any = { id: def.id, name: arsenal.name(def.id), action: a.kind, family: a.family, reload: a.reload, timings: a.timings, perRound: a.perRound, cap: a.capacity ?? def.capacity }
    if (a.kind === 'firearm' || a.kind === 'launcher') {
      const cap = a.capacity ?? 10
      const plans: any = {}
      for (const [k, ammo, req] of [['tactical', Math.max(1, cap - 1), 'auto'], ['empty', 0, 'auto'], ['full', 0, 'full'], ['obo', Math.max(0, cap - 2), 'one_by_one']] as const) {
        try { const p = planReload(a, ammo, cap, 999, req as any); plans[k] = { kind: p.kind, total: +p.total.toFixed(3), step: p.step } } catch { /* */ }
      }
      row.plans = plans
    }
    if (hasWeaponModel(def.id)) {
      const m = buildWeaponModelById(THREE, def.id)
      if (m) {
        row.model = m.parts.family
        const clips = buildToolClips({ parts: m.parts, family: m.parts.family, caseType: 'rifle', reloadFamily: a.family } as any)
        row.clips = Object.fromEntries(Object.entries(clips).filter(([k]) => k.startsWith('reload') || k === 'feed').map(([k, c]: any) => [k, +c.duration.toFixed(3)]))
      }
    }
    rows.push(row)
  }
  writeFileSync('/tmp/claude-0/-home-user/900c36aa-66d8-52a6-86a7-8ef046f65f0e/scratchpad/audit.json', JSON.stringify(rows, null, 0))
  console.log('rows', rows.length)
})
