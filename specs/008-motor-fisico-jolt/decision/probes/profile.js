// Per-stage cost of the room (T3.8b), by hand, never in CI: the same scene as room.js (blast or hammer on the floorplan house), timed per stage by wrapping the methods of the systems
// in the page. Times are inclusive (a stage inside another is counted in both); the render is not in `r.update`. `__KIND__` and `__DT__` are swapped by profile-drive.mjs.
(async () => {
  const KIND = '__KIND__'
  const DT = __DT__
  const r = window.__testRoom
  const wait = ms => new Promise(f => setTimeout(f, ms))
  r.openArea('floorplan_area')
  const b = r.bench('floorplan_area')
  b.set('package', 'residential'); b.set('template', 'single_storey_a'); b.set('seed', 1)
  b.act('build')
  await wait(8000)
  window.requestAnimationFrame = () => 0
  await wait(300)
  const o = r.world.serialize().objects.find(x => x.id === 'house3d:1').state.position
  const spot = [o[0] - 2.5, 0.6, o[2]]
  const sys = r.renderer.pieceSys
  const glue = sys.engine
  const jolt = glue ? glue.world : null
  const acc = new Map()
  const wrap = (object, name, label) => {
    const original = object[name]
    if (typeof original !== 'function') return
    object[name] = function (...args) {
      const t0 = performance.now()
      try { return original.apply(this, args) } finally { const e = acc.get(label) ?? { ms: 0, calls: 0 }; e.ms += performance.now() - t0; e.calls++; acc.set(label, e) }
    }
  }
  const wrapAll = (object, prefix, skip) => {
    if (!object) return
    for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(object))) if (name !== 'constructor' && !skip.includes(name)) wrap(object, name, `${prefix}.${name}`)
  }
  const cheap = ['centre', 'material', 'inertiaOf', 'rollingOf', 'sameFrom', 'shapeFrom', 'shapeKey', 'get', 'has', 'pieceOf', 'piece', 'pieces', 'activeCount']
  wrapAll(glue, 'kit.engine', cheap)
  wrapAll(glue && glue.statics, 'kit.statics', cheap)
  wrapAll(sys, 'kit.pieces', [...cheap, 'list', 'update'])
  if (jolt) {
    for (const name of ['stepFixed', 'setPose', 'setVelocity', 'createBody', 'createBodies', 'removeBody', 'setShape', 'wake', 'sleep', 'setMaterial', 'setMotion', 'contactPoints', 'penetration', 'moveKinematic', 'ignorePair', 'sweepBox', 'castRay', 'overlapBox']) wrap(jolt, name, `jolt.${name}`)
    if (jolt.iface) wrap(jolt.iface, 'Step', 'jolt.Step (wasm)')
    for (const name of ['OnContactAdded', 'OnContactPersisted', 'OnContactRemoved', 'OnContactValidate']) wrap(jolt.listener, name, `jolt.listener.${name}`)
  }
  wrap(sys, 'update', 'kit.pieces.update')
  wrap(r.renderer, 'update', 'room.renderer.update')
  wrap(r.world, 'update', 'room.world.update')
  const loop = sys.loop
  if (loop) wrap(loop, 'step', 'loop.step (all phases)')
  const updates = []
  const ou = r.update.bind(r)
  const timed = dt => {
    acc.clear()
    const t0 = performance.now()
    ou(dt)
    const total = performance.now() - t0
    const stages = {}
    for (const [label, e] of acc) stages[label] = { ms: +e.ms.toFixed(3), calls: e.calls }
    updates.push({ total: +total.toFixed(3), stages, active: jolt ? jolt.activeCount : 0, bodies: jolt ? jolt.bodyCount : 0 })
  }
  r.update = timed
  if (KIND === 'blast') { r.blastAt('c4', spot); timed(DT) }
  else for (let k = 0; k < 12; k++) { r.world.hit('house3d:1', { type: 'blunt', point: [spot[0], 0.5 + 0.5 * (k % 4), spot[2] + (k % 3 - 1) * 0.6], direction: [1, 0, 0], energy: 8000, radius: 0.5, source: 'player' }); timed(DT) }
  const seconds = 11
  const count = Math.round(seconds / DT)
  for (let i = 0; i < count; i++) { timed(DT); if (i % 20 === 0) await wait(10) }
  const sorted = [...updates].sort((a, b) => a.total - b.total)
  const labels = new Set(); for (const u of updates) for (const l of Object.keys(u.stages)) labels.add(l)
  const meanOf = list => { const out = {}; for (const l of labels) out[l] = { ms: +(list.reduce((a, u) => a + (u.stages[l] ? u.stages[l].ms : 0), 0) / list.length).toFixed(3), calls: +(list.reduce((a, u) => a + (u.stages[l] ? u.stages[l].calls : 0), 0) / list.length).toFixed(1) }; return out }
  const mid = sorted.slice(Math.floor(sorted.length * 0.4), Math.ceil(sorted.length * 0.6))
  const worst = sorted.slice(-3)
  const stalls = updates.map((u, i) => ({ i, total: u.total, stages: Object.fromEntries(Object.entries(u.stages).filter(([, e]) => e.ms >= 20).sort((a, b) => b[1].ms - a[1].ms)) })).filter((u) => u.total > 300)
  return { stalls, kind: KIND, dt: DT, n: updates.length, total: { mean: +(updates.reduce((a, u) => a + u.total, 0) / updates.length).toFixed(2), p50: sorted[Math.floor(sorted.length * 0.5)].total, p99: sorted[Math.floor(sorted.length * 0.99)].total, max: sorted[sorted.length - 1].total },
    stepsPerUpdate: jolt ? +(jolt.fixedStep ? DT / jolt.fixedStep : 0).toFixed(2) : 0, middle: { total: +(mid.reduce((a, u) => a + u.total, 0) / mid.length).toFixed(2), active: mid[0].active, bodies: mid[0].bodies, stages: meanOf(mid) },
    worst: worst.map(u => ({ total: u.total, active: u.active, bodies: u.bodies, stages: Object.fromEntries(Object.entries(u.stages).filter(([, e]) => e.ms >= 1).sort((a, b) => b[1].ms - a[1].ms)) })), all: { stages: meanOf(updates) } }
})()
