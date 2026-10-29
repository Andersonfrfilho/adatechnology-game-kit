import { describe, expect, it } from 'vitest'
import { auditWeapons } from './support/weapon-audit'

const audit = auditWeapons()

describe('the reload of every weapon with a model', () => {
  it('audits a good number of weapons', () => {
    expect(audit.length).toBeGreaterThan(100)
  })

  for (const row of audit) {
    if (row.runs.length === 0) continue
    describe(row.id, () => {
      for (const run of row.runs) {
        it(`${run.scenario} (${run.kind}): the clip lasts the ${run.seconds} s of the rule`, () => {
          expect(run.clip, 'the model has a reload clip for this kind').not.toBeNull()
          expect(Math.abs(run.clip!.seconds - run.seconds)).toBeLessThanOrEqual(0.05)
        })
        if (run.stages.length > 0) {
          it(`${run.scenario} (${run.kind}): the clip marks each step of the rule at the second the rule gives it`, () => {
            expect(run.clip!.markers.map((marker) => marker.stage)).toEqual(run.stages.map((entry) => entry.stage))
            run.stages.forEach((entry, index) => expect(Math.abs(run.clip!.markers[index]!.at - entry.at)).toBeLessThanOrEqual(0.05))
          })
        }
      }
    })
  }
})
