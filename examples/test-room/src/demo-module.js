// A module that follows the contracts of @adatechnology/game-contracts: a rental car that brings its own destruction (DestructibleImpl),
// its own animation (the door `open` clip) and an unbolting wheel. The room only loads it (`room.loadModule(DEMO_MODULE)`): it runs the
// contract checks and shows the car, its scenarios and its animations. Nothing here depends on the destruction package: it only follows the
// contract types (a DestructibleImpl, an AnimationClipSpec, a TestableModule).
import * as THREE from 'three'

const PARTS = [
  { id: 'body', material: 'steel', shape: { kind: 'box', size: [1.6, 0.5, 3.4] }, position: [0, 0.55, 0], mass: 700, hp: 900, colour: 0x2a6fd6 },
  { id: 'door_l', material: 'steel', shape: { kind: 'box', size: [0.05, 0.6, 1.0] }, position: [-0.82, 0.75, 0.2], mass: 25, hp: 160, colour: 0x2a6fd6 },
  { id: 'windshield', material: 'glass', shape: { kind: 'box', size: [1.4, 0.5, 0.03] }, position: [0, 1.1, 0.8], mass: 12, hp: 20, colour: 0x9fd6ee },
  { id: 'wheel_fl', material: 'rubber', shape: { kind: 'cylinder', radius: 0.3, height: 0.2 }, position: [-0.85, 0.3, 1.0], rotation: [0, 0, Math.PI / 2], mass: 18, hp: 120, colour: 0x1c1c1e },
]
const JOINTS = [{ id: 'wheel_fl~body', a: 'wheel_fl', b: 'body', kind: 'bolt', tools: ['wrench'], seconds: 4 }]

function buildCar() {
  const root = new THREE.Group()
  const mesh = (name, geo, colour, x, y, z) => {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colour, roughness: 0.5, metalness: name === 'windshield' ? 0 : 0.3, transparent: name === 'windshield', opacity: name === 'windshield' ? 0.55 : 1 }))
    m.name = name
    m.position.set(x, y, z)
    m.castShadow = true
    root.add(m)
    return m
  }
  mesh('body', new THREE.BoxGeometry(1.6, 0.5, 3.4), PARTS[0].colour, 0, 0.55, 0)
  // the cabin is the same part as the body: it only needs the name `body` to be driven by it
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 1.5), new THREE.MeshStandardMaterial({ color: 0x2a6fd6, roughness: 0.5, metalness: 0.3 }))
  cabin.name = 'body'
  cabin.position.set(0, 1.0, -0.45)
  cabin.castShadow = true
  root.add(cabin)
  // the door turns about its front edge: the origin of the mesh is the hinge
  const doorGeo = new THREE.BoxGeometry(0.05, 0.6, 1.0)
  doorGeo.translate(0, 0, -0.5)
  mesh('door_l', doorGeo, 0x1f5cb8, -0.82, 0.75, 0.7)
  mesh('windshield', new THREE.BoxGeometry(1.4, 0.5, 0.03), PARTS[2].colour, 0, 1.1, 0.8)
  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 18)
  wheelGeo.rotateZ(Math.PI / 2)
  mesh('wheel_fl', wheelGeo, PARTS[3].colour, -0.85, 0.3, 1.0)
  for (const [n, x, z] of [['wheel_fr', 0.85, 1.0], ['wheel_rl', -0.85, -1.0], ['wheel_rr', 0.85, -1.0]]) mesh(n, wheelGeo, PARTS[3].colour, x, 0.3, z)
  return root
}

// The car's own damage rule (nothing like the default world): panels take `energy / 40` hp, glass takes `energy / 4`, the closest part wins.
function createCarImpl(root, id) {
  const hp = Object.fromEntries(PARTS.map((p) => [p.id, p.hp]))
  const dents = Object.fromEntries(PARTS.map((p) => [p.id, []]))
  let wheel = { progress: 0, open: false }
  let queue = []
  let clock = 0
  const local = (pt) => {
    root.updateMatrixWorld(true)
    return root.worldToLocal(new THREE.Vector3(pt[0], pt[1], pt[2]))
  }
  const distTo = (p, v) => {
    const half = p.shape.kind === 'box' ? p.shape.size.map((s) => s / 2) : [p.shape.radius + 0.1, p.shape.radius, p.shape.radius]
    const d = [0, 1, 2].map((k) => Math.max(0, Math.abs([v.x, v.y, v.z][k] - p.position[k]) - half[k]))
    return Math.hypot(d[0], d[1], d[2])
  }
  const world = (v) => {
    const w = root.localToWorld(v.clone())
    return [w.x, w.y, w.z]
  }
  const damage = (part, amount, damageType, source) => {
    if (hp[part.id] <= 0) return []
    const before = hp[part.id]
    hp[part.id] = Math.max(0, before - amount)
    const out = [{ type: 'damage', object: id, time: clock, part: part.id, amount: before - hp[part.id], hp: hp[part.id], damageType, ...(source ? { source } : {}) }]
    if (hp[part.id] <= 0) {
      const c = world(new THREE.Vector3(...part.position))
      out.push({ type: 'fracture', object: id, time: clock, part: part.id, style: part.material === 'glass' ? 'shatter' : 'snap', fragments: [], point: c })
    }
    return out
  }
  const impl = {
    id,
    name: 'Rental car',
    describe: () => ({ name: 'rental_car', parts: PARTS.map((p) => ({ id: p.id, material: p.material, shape: p.shape, position: p.position, rotation: p.rotation, mass: p.mass, hp: p.hp })), joints: JOINTS.map((j) => ({ ...j })) }),
    hit(h) {
      const events = []
      if (h.type === 'fire' || h.type === 'heat') return events
      const energy = h.energy ?? 0
      if (h.type === 'explosive') {
        for (const p of PARTS) {
          const d = distTo(p, local(h.point))
          if (d <= (h.radius ?? 1)) events.push(...damage(p, energy / (1 + d * d) / 40, 'explosive', h.source))
        }
        return events
      }
      const v = local(h.point)
      let best = PARTS[0]
      let bd = Infinity
      for (const p of PARTS) {
        if (hp[p.id] <= 0) continue
        const d = distTo(p, v)
        if (d < bd) {
          bd = d
          best = p
        }
      }
      if (bd > 0.35) return events
      events.push(...damage(best, energy / (best.material === 'glass' ? 4 : 40), h.type, h.source))
      if (best.material === 'steel' && hp[best.id] > 0 && energy > 50) {
        const dent = { point: [v.x, v.y, v.z], normal: [0, 1, 0], radius: 0.05, depth: Math.min(0.05, energy / 20000) }
        dents[best.id].push(dent)
        events.push({ type: 'dent', object: id, time: clock, part: best.id, dent, worldPoint: [...h.point] })
      }
      return events
    },
    update(dt) {
      clock += dt
      const out = queue
      queue = []
      return out
    },
    state() {
      const loose = wheel.open ? ['wheel_fl'] : []
      const main = PARTS.filter((p) => hp[p.id] > 0 && !loose.includes(p.id)).map((p) => p.id)
      const groups = loose.length ? [main, loose] : [main]
      return {
        id,
        name: 'Rental car',
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        parts: PARTS.map((p) => ({
          id: p.id,
          material: p.material,
          status: hp[p.id] <= 0 ? 'broken' : hp[p.id] < p.hp ? 'damaged' : 'intact',
          hp: hp[p.id],
          maxHp: p.hp,
          mass: p.mass,
          temperature: 20,
          burning: false,
          fuel: 0,
          char: 0,
          melt: 0,
          dents: dents[p.id].map((d) => ({ ...d })),
          holes: [],
          cracks: [],
          group: hp[p.id] <= 0 ? -1 : loose.includes(p.id) ? 1 : 0,
        })),
        joints: JOINTS.map((j) => ({ id: j.id, a: j.a, b: j.b, kind: j.kind, hp: 200, maxHp: 200, progress: wheel.progress, open: wheel.open, ...(wheel.open ? { openedBy: 'tool' } : {}) })),
        groups,
        destroyed: PARTS.every((p) => hp[p.id] <= 0),
      }
    },
    reset() {
      for (const p of PARTS) {
        hp[p.id] = p.hp
        dents[p.id] = []
      }
      wheel = { progress: 0, open: false }
      queue = []
    },
    // four seconds of wrench work take the wheel off; the event goes out with the next update
    disassemble(jointId, tool, dt) {
      if (jointId !== JOINTS[0].id || tool !== 'wrench') return -1
      if (wheel.open) return 1
      wheel.progress = Math.min(1, wheel.progress + dt / JOINTS[0].seconds)
      queue.push({ type: 'disassemble_progress', object: id, time: clock, joint: JOINTS[0].id, tool, progress: wheel.progress })
      if (wheel.progress >= 1) {
        wheel.open = true
        queue.push({ type: 'detach', object: id, time: clock, joint: JOINTS[0].id, parts: ['wheel_fl', 'body'], by: 'tool', groups: [['body', 'door_l', 'windshield'], ['wheel_fl']] })
      }
      return wheel.progress
    },
  }
  return impl
}

const doorOpen = {
  id: 'open',
  duration: 1.2,
  keys: [{ t: 0 }, { t: 0.15, parts: { door_l: { rotation: [0, 0.05, 0] } } }, { t: 1.2, parts: { door_l: { rotation: [0, 1.1, 0] } } }],
  events: [{ t: 0.15, type: 'sound', data: { key: 'door_latch' } }, { t: 1.2, type: 'sound', data: { key: 'door_swing_end' } }],
}

export const DEMO_MODULE = {
  id: 'rental_cars',
  name: 'Rental cars',
  group: 'Rental cars',
  items: (locale) => [
    {
      id: 'rental_car',
      name: locale === 'en' ? 'Rental car (module)' : 'Carro de aluguel (módulo)',
      build: () => buildCar(),
      impl: (root, id) => createCarImpl(root, id),
      movable: false,
      animations: [doorOpen],
    },
  ],
  scenarios: (locale) => {
    const en = locale === 'en'
    const car = (room, z = -5) => {
      const so = room.spawn('rental_car', [0, 0, z], 0)
      return { id: so.objectId, root: so.root, z }
    }
    return [
      {
        id: 'rental_car_wheel_unbolts',
        name: en ? 'Rental car: the wrench takes the wheel off' : 'Carro de aluguel: a chave inglesa solta a roda',
        run({ room, step, expect }) {
          const { id, z } = car(room)
          room.setTool('wrench')
          room.look([-1.3, 0.5, z + 1], [-0.775, 0.45, z + 1])
          room.use(5)
          step(0.3)
          const st = room.world.state(id)
          const open = !!st.joints.find((j) => j.id === 'wheel_fl~body')?.open
          const detach = room.log.entries({ type: 'detach', objectId: id }).length
          expect(open && st.groups.length === 2 && detach > 0, en ? `Wrench on the wheel: bolt open ${open}, ${st.groups.length} piece group(s), ${detach} detach line(s) in the log (expected: open, 2, 1)` : `Chave na roda: parafuso aberto ${open ? 'sim' : 'não'}, ${st.groups.length} grupo(s), ${detach} linha(s) de soltura no log (esperado: aberto, 2, 1)`, { open, groups: st.groups.length })
        },
      },
      {
        id: 'rental_car_own_damage',
        name: en ? 'Rental car: its own damage rule breaks the windshield only' : 'Carro de aluguel: a regra própria quebra só o para-brisa',
        run({ room, step, expect }) {
          const { id, z } = car(room)
          room.setTool('pistol_9mm')
          room.look([0, 1.1, z + 3.5], [0, 1.1, z + 0.8])
          room.use()
          step(0.3)
          const glass = room.world.part(id, 'windshield')
          const body = room.world.part(id, 'body')
          expect(glass?.status === 'broken' && body?.status === 'intact', en ? `9 mm into the windshield: glass ${glass?.status}, body ${body?.status} (expected: broken, intact)` : `9 mm no para-brisa: vidro ${glass?.status}, carroceria ${body?.status} (esperado: broken, intact)`, { glass: glass?.status, body: body?.status })
        },
      },
    ]
  },
}
