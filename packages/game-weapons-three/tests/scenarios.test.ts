import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import { createWeaponsTestModule } from '../src'

vi.setConfig({ testTimeout: 60_000 })

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

describe('weapons module scenarios (real targets, real weapons)', () => {
  for (const locale of ['pt-BR', 'en'] as const) {
    it(`the target scenarios pass in ${locale}`, async () => {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const room = createTestRoom({ THREE, container, locale, catalog: [], renderer: stubRenderer(), ui: false })
      const report = room.loadModule(createWeaponsTestModule({ locale, sound: false }))
      expect(report.scenarios.sort()).toEqual(['target_concrete_stops_bullet', 'target_plywood_shotgun_holes', 'target_steel_hammer_dents', 'target_steel_heavy_through_hole', 'target_steel_torch_melts'])
      const result = await room.runScenarios(room.scenarios.filter((s) => report.scenarios.includes(s.id)))
      expect(result.results.filter((r) => !r.ok).map((r) => `${r.id}: ${r.checks.filter((c) => !c.ok).map((c) => c.label).join(' | ')}`)).toEqual([])
      expect(result.passed).toBe(5)
    })
  }
})
