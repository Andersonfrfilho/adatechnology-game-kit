import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { ProjectileQuery } from '../src'
import { makeRoom } from './helpers'

const model = (name: string): THREE.Group => {
  const g = new THREE.Group()
  g.name = name
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.04)))
  return g
}
const run = (room: ReturnType<typeof makeRoom>, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) room.update(1 / 60)
}

describe('models of what is thrown or set down', () => {
  it('asks the host for the model of a rocket, points its axis along the flight, and draws a primitive where the host has none', () => {
    const asked: ProjectileQuery[] = []
    const room = makeRoom({
      projectileModel: (q) => {
        asked.push(q)
        return q.kind === 'rocket' ? { model: model('host_rocket'), axis: [1, 0, 0] } : null
      },
    })
    room.setTool('m72_law')
    run(room, 0.5)
    room.look([0, 1.7, 5], [0, 1.7, -30])
    room.use()
    run(room, 0.03)
    expect(asked).toMatchObject([{ weapon: 'm72_law', kind: 'rocket', explosive: expect.any(String) }])
    const rocket = room.scene.getObjectByName('host_rocket')!
    expect(rocket).toBeDefined()
    // +x of the model follows the velocity (towards -z)
    const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(rocket.quaternion)
    expect(forward.z).toBeLessThan(-0.9)

    room.clear()
    expect(room.scene.getObjectByName('host_rocket')).toBeUndefined()
    asked.length = 0
    room.setTool('frag_grenade')
    run(room, 0.5)
    room.use()
    run(room, 0.1)
    expect(asked).toMatchObject([{ weapon: 'frag_grenade', kind: 'grenade' }])
  })

  it('the charge set down wears the host model', () => {
    const room = makeRoom({ projectileModel: (q) => (q.kind === 'charge' ? { model: model('host_charge') } : null) })
    room.setTool('claymore')
    run(room, 0.5)
    room.look([0, 1.7, 5], [0, 0.2, 1])
    room.use()
    run(room, 0.2)
    expect(room.scene.getObjectByName('host_charge')).toBeDefined()
  })
})
