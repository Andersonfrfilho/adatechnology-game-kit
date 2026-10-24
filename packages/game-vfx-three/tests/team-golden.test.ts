import { readFileSync } from 'node:fs'
import { snapshotScene } from '@adatechnology/golden-tool'
import type { GoldenRecord } from '@adatechnology/golden-tool'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createGroundField, LOD_LAB } from '@adatechnology/game-vfx'
import { createVfxRenderer } from '../src'
import { createFakeCanvas } from './fake-canvas'

const golden = JSON.parse(readFileSync(new URL('../../game-vfx/tests/fixtures/team-golden/explosion-lab.json', import.meta.url), 'utf8')) as GoldenRecord
type EventData = Record<string, unknown>
const eventsOf = (type: string, key: string): EventData[] => golden.events.filter((event) => event.type === type && (event.data as EventData).key === key).map((event) => event.data as EventData)

const SCENES: Readonly<Record<string, { explosive: string; at: [number, number, number]; direction?: [number, number, number] }>> = {
  granada: { explosive: 'm67', at: [-4.2, 0.1, 3.4] },
  molotov: { explosive: 'molotov', at: [-3.7, 0.05, 2.6] },
  flash: { explosive: 'flashbang', at: [-4, 0.3, 3.3] },
  caseira: { explosive: 'pipe_bomb', at: [-4.3, 0.1, 3.4] },
  dinamite: { explosive: 'dynamite', at: [0, 0.05, 0] },
  c4: { explosive: 'c4', at: [0, 0.15, 0.3] },
  claymore: { explosive: 'claymore', at: [-2.9, 0.2, 0], direction: [1, 0, 0] },
  p13: { explosive: 'propane_p13', at: [0, 0.3, 0] },
  m79: { explosive: 'm79_40mm', at: [0, 0.1, 0] },
  m72: { explosive: 'm72_66mm', at: [-8, 1.5, 2], direction: [0, 0, -1] },
  at4: { explosive: 'at4_84mm', at: [-8, 1.5, 2], direction: [0, 0, -1] },
  rpg: { explosive: 'pg7v', at: [-8, 1.5, 2], direction: [0, 0, -1] },
  barril: { explosive: 'fuel_barrel', at: [0, 0.5, 0] },
  carro: { explosive: 'car_fuel_tank', at: [0, 0.6, 0] },
  posto: { explosive: 'fuel_station_tank', at: [-7, 0.4, -1] },
  horda: { explosive: 'm67', at: [0, 0.1, 0] },
}
const ORDER = Object.keys(SCENES)
const INSTANT_FRAMES = new Map([0.08, 0.25, 0.5, 1, 2, 4].map((seconds) => [Math.round(seconds * 60), seconds]))
const TOLERANCE = 2e-3

function bufferRow(mesh: THREE.Mesh, index: number): number[] {
  const geometry = mesh.geometry as THREE.InstancedBufferGeometry
  const row: number[] = []
  for (const [name, size] of [['aP', 4], ['aD', 4], ['aC', 3]] as const) {
    const array = (geometry.getAttribute(name) as THREE.InstancedBufferAttribute).array
    for (let k = 0; k < size; k++) row.push(array[index * size + k]!)
  }
  return row
}

function parseRows(sample: string): number[][] {
  return sample.split(' | ').map((half) => half.split(' ').map(Number))
}

describe('the Explosion Lab drawn by game-vfx-three, against the page', () => {
  for (const key of ORDER) {
    describe(key, () => {
      const scene = SCENES[key]!
      const index = ORDER.indexOf(key)
      const threeScene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(48, 1.6, 0.1, 600)
      const [cx, cy, cz] = (eventsOf('scene', key)[0] as { camera: number[] }).camera
      camera.position.set(cx!, cy!, cz!)
      const renderer = createVfxRenderer(THREE, {
        scene: threeScene,
        camera,
        vfx: { seed: 1000 + index * 97, randomMode: 'shared', profile: 'high', lod: LOD_LAB, areaCap: false, ground: createGroundField() },
        createCanvas: createFakeCanvas,
        reducedMotion: true,
      })
      const root = threeScene.children[0]!
      const marksGroup = root.children.at(-1)!
      const puffMesh = root.children[0] as THREE.Mesh
      const shocksGroup = root.children[5]!
      renderer.play({ effect: scene.explosive, point: scene.at, ...(scene.direction ? { direction: scene.direction } : {}) })
      const seen = new Map<number, { stage: string; shocks: string[]; rows: number[][] | undefined }>()
      for (let frame = 1; frame <= 480; frame++) {
        renderer.update(1 / 60)
        const seconds = INSTANT_FRAMES.get(frame)
        if (seconds === undefined) continue
        const shocks = shocksGroup.children.filter((child) => child.visible).map((child) => child)
        const live = renderer.world.pools().shocks.items.length
        const states: string[] = []
        for (let shock = 0; shock < live; shock++) {
          const shell = shocksGroup.children[shock * 2] as THREE.Mesh
          const ring = shocksGroup.children[shock * 2 + 1] as THREE.Mesh
          states.push([shell.scale.x, (shell.material as THREE.ShaderMaterial).uniforms.uA!.value, ring.scale.x, (ring.material as THREE.ShaderMaterial).uniforms.uA!.value].join(' '))
        }
        void shocks
        const count = (puffMesh.geometry as THREE.InstancedBufferGeometry).instanceCount
        seen.set(seconds, {
          stage: snapshotScene(marksGroup as never, { ignoreNames: true }).hash,
          shocks: states,
          rows: count > 0 ? Array.from({ length: Math.min(6, count) }, (_, index) => bufferRow(puffMesh, index)) : undefined,
        })
      }

      it('builds the same marks on the ground, mesh by mesh (scene hash)', () => {
        for (const instant of eventsOf('instant', key)) {
          expect(seen.get(instant.seconds as number)?.stage, `${instant.seconds} s`).toBe(instant.stage)
        }
        expect(snapshotScene(marksGroup as never, { ignoreNames: true }).hash).toBe((eventsOf('end', key)[0] as { stage: string }).stage)
      })

      it('draws the shock shell and ring at the same size and fade', () => {
        for (const instant of eventsOf('instant', key)) {
          const expected = (instant.shocks as string[]).map((entry) => entry.split(' ').map(Number)).map((v) => [v[6], v[7], v[8], v[9]])
          const actual = (seen.get(instant.seconds as number)?.shocks ?? []).map((entry) => entry.split(' ').map(Number))
          expect(actual.length).toBe(expected.length)
          actual.forEach((row, at) => row.forEach((value, k) => expect(value).toBeCloseTo(expected[at]![k]!, 3)))
        }
      })

      it('fills the puff buffers like the page (first and last live instance, float32)', () => {
        for (const instant of eventsOf('instant', key)) {
          const sample = instant.puffBuffer as string
          const rows = seen.get(instant.seconds as number)?.rows
          if (sample === '') {
            expect(rows).toBeUndefined()
            continue
          }
          for (const [at, expected] of parseRows(sample).entries()) {
            const [row, ...values] = expected
            const drawn = rows![row!]!
            values.forEach((value, k) => expect(Math.abs(drawn[k]! - value), `${instant.seconds} s sample ${at} (row ${row}) value ${k}`).toBeLessThan(TOLERANCE))
          }
        }
      })
    })
  }
})
