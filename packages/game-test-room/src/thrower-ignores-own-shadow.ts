import type { BodyDesc, BodyId, PhysicsServices } from '@adatechnology/game-physics'

const bound = <TTarget extends object>(target: TTarget, key: string | symbol): unknown => {
  const value: unknown = Reflect.get(target, key, target)
  return typeof value === 'function' ? value.bind(target) : value
}

/**
 * A swept piece born in the hand or at the ejection port (a grenade, a casing) starts touching the player's capsule: it never meets the player's own body,
 * or it would be pushed back into the throw. The services come back wrapped; only `world.createBody` changes.
 */
export const servicesIgnoringOwnShadow = (services: PhysicsServices, shadowBody: () => BodyId | undefined): PhysicsServices => {
  const createBody = (desc: BodyDesc): BodyId => {
    const id = services.world.createBody(desc)
    const own = shadowBody()
    if (own !== undefined && desc.layer === 'debris' && desc.continuous) services.world.ignorePair(id, own, true)
    return id
  }
  const world = new Proxy(services.world, { get: (target, key) => (key === 'createBody' ? createBody : bound(target, key)) })
  return new Proxy(services, { get: (target, key) => (key === 'world' ? world : bound(target, key)) })
}
