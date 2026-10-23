import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { assertMatchesGolden, createEventRecorder, createGoldenRecord, diffGolden } from '../src'
import type { SceneNodeLike } from '../src'

function buildScene(color: number): SceneNodeLike {
  const root = new THREE.Group()
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color })))
  return root as unknown as SceneNodeLike
}

function recordSession(color: number, shots: number) {
  const recorder = createEventRecorder()
  for (let shot = 0; shot < shots; shot++) recorder.record('shot', { index: shot, energy: 351.123456789 })
  return createGoldenRecord({ name: 'session', seed: 5, events: recorder.events(), scenes: { main: buildScene(color) } })
}

describe('createEventRecorder', () => {
  it('keeps events in order and rounds numbers inside nested data', () => {
    const recorder = createEventRecorder()
    recorder.record('reload')
    recorder.record('shot', { energy: 1 / 3, parts: [0.123456, { depth: 2.00004 }] })
    expect(recorder.events()).toEqual([
      { type: 'reload' },
      { type: 'shot', data: { energy: 0.3333, parts: [0.1235, { depth: 2 }] } },
    ])
  })
})

describe('diffGolden', () => {
  it('is empty for the same seed, events and scene', () => {
    expect(diffGolden(recordSession(0xff0000, 2), recordSession(0xff0000, 2))).toEqual([])
    expect(() => assertMatchesGolden(recordSession(0xff0000, 2), recordSession(0xff0000, 2))).not.toThrow()
  })

  it('points at the first different event', () => {
    const messages = diffGolden(recordSession(0xff0000, 2), recordSession(0xff0000, 3))
    expect(messages.join('\n')).toContain('events[2]')
    expect(messages.join('\n')).toContain('expected (none)')
  })

  it('shows the changed node when the scene differs', () => {
    const messages = diffGolden(recordSession(0xff0000, 1), recordSession(0x00ff00, 1))
    expect(messages[0]).toMatch(/scene "main": hash \w+ -> \w+/)
    expect(messages.join('\n')).toContain('ff0000')
    expect(messages.join('\n')).toContain('00ff00')
  })

  it('throws a readable error from assertMatchesGolden', () => {
    expect(() => assertMatchesGolden(recordSession(0xff0000, 1), recordSession(0x00ff00, 1))).toThrow(/"session" differs from the golden \(seed 5\)/)
  })
})
