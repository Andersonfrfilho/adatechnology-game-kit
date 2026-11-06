import { itemModels } from '@adatechnology/game-items-three'
import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'

import { toWorldLens, VIEW_HOLD } from '../src'
import { createWeaponsTestModule } from '../src/testing'

vi.setConfig({ testTimeout: 30_000 })

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

// the world point of the `muzzle` mark of the model in the hands
const markOf = (scene: THREE.Scene): THREE.Vector3 | null => {
  let mark: THREE.Vector3 | null = null
  scene.getObjectByName('weapon-viewmodel')?.traverse((o) => {
    if (o.name === 'muzzle' && !mark) mark = o.getWorldPosition(new THREE.Vector3())
  })
  return mark
}

const tracerStart = (scene: THREE.Scene): THREE.Vector3 | null => {
  let start: THREE.Vector3 | null = null
  scene.traverse((o) => {
    const line = o as THREE.Line
    if (!line.isLine || !line.visible || (line.material as THREE.LineBasicMaterial).color?.getHex() !== 0xffe9a8) return
    start = new THREE.Vector3().fromBufferAttribute(line.geometry.getAttribute('position') as THREE.BufferAttribute, 0)
  })
  return start
}

// a gun fires once it is drawn (and a minigun once its barrels spin): pull until it does; the view the shot left from is kept (its kick turns the view after)
let shotView: THREE.PerspectiveCamera | null = null
const fireWhenReady = (room: { use(): string; update(dt: number): void; readonly camera: THREE.Camera }): string => {
  let status = ''
  for (let i = 0; i < 240 && status !== 'ok'; i++) {
    if (i > 0) room.update(1 / 60)
    shotView = (room.camera as THREE.PerspectiveCamera).clone()
    shotView.updateMatrixWorld(true)
    status = room.use()
  }
  return status
}

describe('the shot leaves the muzzle of the model in the hands', () => {
  it('lends the room the muzzle mark of the gallery model: the tracer starts there and the room draws no second flash, in both views', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = createTestRoom({ THREE, container, locale: 'pt-BR', catalog: [], renderer: stubRenderer(), ui: false })
    expect(room.loadModule(createWeaponsTestModule({ locale: 'pt-BR', sound: false, items: itemModels })).problems).toEqual([])
    const emit = vi.spyOn(room.renderer, 'emit')
    for (const view of ['first', 'third'] as const) {
      room.setCameraMode(view)
      for (const weapon of ['glock_17', 'ak_47', 'remington_870', 'm134']) {
        room.equip(weapon)
        for (let i = 0; i < 40; i++) room.update(1 / 60)
        room.look([0, 1.6, 2], [0, 1.2, -11])
        room.update(1 / 60)
        emit.mockClear()
        expect(fireWhenReady(room), weapon).toBe('ok')
        const mark = markOf(room.scene)
        expect(mark, weapon).not.toBeNull()
        // in first person the gun is drawn through its lens: the tracer leaves where the world sees the muzzle as drawn, through the view the shot left from (its kick turns it after)
        const seen = view === 'first' ? toWorldLens(shotView!, mark!.clone(), shotView!.fov, VIEW_HOLD[weapon === 'glock_17' ? 'handgun' : 'long'].fov) : mark!
        expect(tracerStart(room.scene)?.distanceTo(seen), `${view} ${weapon}`).toBeLessThan(0.002)
        expect(emit.mock.calls.some(([kind]) => kind === 'flash'), weapon).toBe(false)
        for (let i = 0; i < 30; i++) room.update(1 / 60)
      }
    }
    room.dispose()
  })
})
