import type * as THREE_NS from 'three'
import type { OrderedPool, Shock } from '@adatechnology/game-vfx'
import { RING_FRAGMENT, RING_VERTEX, SHELL_FRAGMENT, SHELL_VERTEX } from './shaders/shock'
import type { ThreeLib } from './types'

interface Pair {
  readonly shell: THREE_NS.Mesh
  readonly ring: THREE_NS.Mesh
  readonly shellAlpha: { value: number }
  readonly ringAlpha: { value: number }
}

const RING_HEIGHT = 0.05

export interface ShockLayer {
  readonly group: THREE_NS.Group
  sync(): number
  dispose(): void
}

/** The shock shell and ground ring of each live shock (L319-348): one pair of meshes per slot, shown while the slot has a shock. */
export function createShockLayer(THREE: ThreeLib, pool: OrderedPool<Shock>): ShockLayer {
  const group = new THREE.Group()
  const shellGeometry = new THREE.SphereGeometry(1, 28, 18)
  const ringGeometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2)
  const pairs: Pair[] = []

  function makePair(): Pair {
    const shellAlpha = { value: 0 }
    const ringAlpha = { value: 0 }
    const shellMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uA: shellAlpha }, vertexShader: SHELL_VERTEX, fragmentShader: SHELL_FRAGMENT })
    const ringMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uA: ringAlpha, uW: { value: 0.12 }, uC: { value: new THREE.Color(0.55, 0.5, 0.44) } }, vertexShader: RING_VERTEX, fragmentShader: RING_FRAGMENT,
    })
    const shell = new THREE.Mesh(shellGeometry, shellMaterial)
    shell.renderOrder = 4
    const ring = new THREE.Mesh(ringGeometry, ringMaterial)
    ring.renderOrder = 3
    group.add(shell, ring)
    return { shell, ring, shellAlpha, ringAlpha }
  }

  return {
    group,
    sync() {
      const shocks = pool.items
      for (let index = 0; index < shocks.length; index++) {
        const pair = (pairs[index] ??= makePair())
        const shock = shocks[index]!
        pair.shell.visible = pair.ring.visible = true
        pair.shell.position.set(shock.x, shock.y, shock.z)
        pair.shell.scale.setScalar(shock.shellScale)
        pair.shellAlpha.value = shock.shellAlpha
        pair.ring.position.set(shock.x, RING_HEIGHT, shock.z)
        pair.ring.scale.setScalar(shock.ringScale)
        pair.ringAlpha.value = shock.ringAlpha
      }
      for (let index = shocks.length; index < pairs.length; index++) pairs[index]!.shell.visible = pairs[index]!.ring.visible = false
      return shocks.length
    },
    dispose() {
      for (const pair of pairs) {
        ;(pair.shell.material as THREE_NS.Material).dispose()
        ;(pair.ring.material as THREE_NS.Material).dispose()
      }
      shellGeometry.dispose()
      ringGeometry.dispose()
    },
  }
}
