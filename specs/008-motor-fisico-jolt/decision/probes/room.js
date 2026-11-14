// Room probe (blast or hammer) measured with the one ruler of spec 008 (`packages/game-destruction-three/tests/energy-ruler.ts`).
// `drive.mjs` puts the ruler's exports in scope as `EnergyRuler` and swaps the kind marker (blast | hammer).
// Ruler of the room: only the gain with no input from outside counts (C2); sleep counts from the last input from outside (C4).
(async () => {
  const KIND = '__KIND__'
  const r = window.__testRoom
  const wait = ms => new Promise(f => setTimeout(f, ms))
  r.openArea('floorplan_area')
  const b = r.bench('floorplan_area')
  b.set('package', 'residential'); b.set('template', 'single_storey_a'); b.set('seed', 1)
  b.act('build')
  await wait(8000)
  window.requestAnimationFrame = () => 0
  await wait(300)
  const THREE = r.camera.position.constructor
  const v = new THREE()
  const base = new Set(r.renderer.pieces().map(p => p.objectId))
  const o = r.world.serialize().objects.find(x => x.id === 'house3d:1').state.position
  const spot = [o[0] - 2.5, 0.6, o[2]]
  // the engine's own inertia tensor of a piece (Jolt holds the inverse in the body's frame): the box's is wrong for a piece whose parts are thin plates at one end (the lot's poles); the own solver has none
  const tensorOf = p => {
    const g = r.renderer.pieceSys && r.renderer.pieceSys.engine
    if (!g || !g.world.entry) return undefined
    const link = g.links.get(g.byObject.get(p.objectId))
    if (!link) return undefined
    const m = g.world.entry(link.id).body.GetMotionProperties().GetLocalSpaceInverseInertia()
    const x = m.GetAxisX(), y = m.GetAxisY(), z = m.GetAxisZ()
    const a = x.GetX(), b = y.GetX(), c = z.GetX(), d = y.GetY(), e = z.GetY(), f = z.GetZ()
    const det = a * (d * f - e * e) - b * (b * f - e * c) + c * (b * e - d * c)
    return [(d * f - e * e) / det, (a * f - c * c) / det, (a * d - b * b) / det, (c * e - b * f) / det, (b * e - c * d) / det, (b * c - a * e) / det]
  }
  const sampleOf = p => {
    p.root.updateMatrixWorld(true)
    const c = v.set(p.localCenter[0], p.localCenter[1], p.localCenter[2]).applyMatrix4(p.root.matrixWorld)
    const centre = [c.x, c.y, c.z]
    const w = v.set(p.angularVelocity[0], p.angularVelocity[1], p.angularVelocity[2]).applyQuaternion(p.root.quaternion.clone().invert())
    const [hx, hy, hz] = p.halfExtents
    return {
      id: p.objectId, mass: p.mass, centre, radius: Math.hypot(hx, hy, hz),
      energyHeight: EnergyRuler.energyHeightOf({ centreY: centre[1], velocity: p.velocity, bodyAngularVelocity: [w.x, w.y, w.z], halfExtents: p.halfExtents, mass: p.mass, inertia: tensorOf(p) }),
      velocityY: p.velocity[1], speed: Math.hypot(...p.velocity), spin: Math.hypot(...p.angularVelocity), sleeping: p.sleeping,
    }
  }
  const steps = []
  const seen = new Map()
  let stepNo = 0
  const ruler = new EnergyRuler.EnergyRuler()
  // islands are the engine's contact graph of the update (T3.8b); the own solver has no log: bounding spheres, as before
  const glue = r.renderer.pieceSys && r.renderer.pieceSys.engine
  const graph = !!(glue && glue.world.pairLog)
  if (graph) glue.world.trackPairs = true
  const touchingNow = () => {
    if (!graph) return undefined
    const objectOf = new Map()
    for (const [objectId, body] of glue.byObject) { const link = glue.links.get(body); if (link) objectOf.set(link.id, objectId) }
    const log = glue.world.pairLog, out = []
    for (let i = 0; i < log.length; i += 2) { const a = objectOf.get(log[i]), b = objectOf.get(log[i + 1]); if (a !== undefined && b !== undefined && a !== b) out.push([a, b]) }
    return out
  }
  // energy the kit's own rules give a piece (a blast's front that arrives later and a second explosion shove it; the kit's balancing push turns a pole or a plank over): measured as the
  // energy height it adds, in the update it lands, and taken out of that piece's island and episode, so only what the engine makes on top of it counts
  let given = new Map()
  const giving = (piece, apply) => {
    const before = sampleOf(piece).energyHeight
    const result = apply()
    const added = sampleOf(piece).energyHeight - before
    if (added > 0) given.set(piece.objectId, (given.get(piece.objectId) ?? 0) + added)
    return result
  }
  const pieceSys = r.renderer.pieceSys
  const impulseOf = pieceSys.impulse.bind(pieceSys)
  pieceSys.impulse = (piece, impulse, point) => giving(piece, () => impulseOf(piece, impulse, point))
  const engineGlue = pieceSys.engine
  if (engineGlue) { const toppleOf = engineGlue.topple.bind(engineGlue); engineGlue.topple = (piece, dt) => giving(piece, () => toppleOf(piece, dt)) }
  let worstIsland = null
  const kitEnergy = { shoves: 0, topples: 0, kgm: 0 }
  let input = 'none'
  const ou = r.update.bind(r)
  r.update = (dt) => {
    const all = r.renderer.pieces().filter(p => !base.has(p.objectId))
    // a piece born in the previous update has its mesh at a pre-sync pose until its first step: it enters the ruler from its second observation
    const pieces = all.filter(p => (seen.get(p.objectId) ?? 0) >= 1)
    const before = pieces.map(sampleOf)
    const t0 = performance.now()
    ou(dt)
    const ms = performance.now() - t0
    const after = pieces.map(sampleOf)
    for (let k = 0; k < before.length; k++) {
      const rise = after[k].energyHeight - before[k].energyHeight
      if (input === 'none' && !given.has(before[k].id) && rise > 0.02) steps.push({ step: stepNo, id: before[k].id, mass: +before[k].mass.toFixed(1), rise: +rise.toFixed(3), speedBefore: +before[k].speed.toFixed(2), speedAfter: +after[k].speed.toFixed(2), y: +after[k].centre[1].toFixed(3), yBefore: +before[k].centre[1].toFixed(3), seen: (seen.get(before[k].id) ?? 0), xz: [+after[k].centre[0].toFixed(2), +after[k].centre[2].toFixed(2)], sleepingBefore: before[k].sleeping, kin: before[k].mass > 500 ? { dy: +(after[k].centre[1] - before[k].centre[1]).toFixed(3), vyBefore: +before[k].velocityY.toFixed(2), vyAfter: +after[k].velocityY.toFixed(2), spinBefore: +before[k].spin.toFixed(2), spinAfter: +after[k].spin.toFixed(2), radius: +before[k].radius.toFixed(2) } : undefined, near: rise > 1 ? after.map((o, j) => ({ id: o.id, d: +Math.hypot(o.centre[0] - after[k].centre[0], o.centre[1] - after[k].centre[1], o.centre[2] - after[k].centre[2]).toFixed(2), mass: +o.mass.toFixed(1), speedBefore: +before[j].speed.toFixed(2), speedAfter: +o.speed.toFixed(2), y: +o.centre[1].toFixed(2) })).filter(o => o.id !== before[k].id).sort((a, b) => a.d - b.d).slice(0, 4) : undefined })
    }
    for (const q of all) seen.set(q.objectId, (seen.get(q.objectId) ?? 0) + 1)
    stepNo++
    for (const [id, h] of given) { kitEnergy.shoves++; const m = before.find(x => x.id === id); if (m) kitEnergy.kgm += m.mass * h }
    const touching = touchingNow()
    if (input === 'none' && touching) {
      const isl = EnergyRuler.islandsOf(before, after, touching)
      const sums = new Map()
      before.forEach((b0, k) => { const e = b0.mass * (after[k].energyHeight - b0.energyHeight - (given.get(b0.id) ?? 0)); const o = sums.get(isl[k]) ?? { e: 0, m: 0, ks: [] }; o.e += e; o.m += b0.mass; o.ks.push(k); sums.set(isl[k], o) })
      for (const o of sums.values()) { const ex = o.e - o.m * 0.001; if (ex > (worstIsland ? worstIsland.excess : 0.2)) worstIsland = { excess: +ex.toFixed(2), step: stepNo, members: o.ks.map(k => ({ id: before[k].id, mass: +before[k].mass.toFixed(1), dEm: +(before[k].mass * (after[k].energyHeight - before[k].energyHeight - (given.get(before[k].id) ?? 0))).toFixed(2), v0: +before[k].speed.toFixed(2), v1: +after[k].speed.toFixed(2), sleepingBefore: before[k].sleeping, y: +after[k].centre[1].toFixed(2) })).filter(m => Math.abs(m.dEm) > 0.05 || m.mass > 100) } }
    }
    ruler.step(before, after, dt, input, { touching, given })
    given = new Map()
    input = 'none'
    return ms
  }
  let wakeFrameMs = 0
  if (KIND === 'blast') { input = 'energy'; r.blastAt('c4', spot); wakeFrameMs = r.update(0.05) }
  else { for (let k = 0; k < 12; k++) { r.world.hit('house3d:1', { type: 'blunt', point: [spot[0], 0.5 + 0.5*(k%4), spot[2] + (k%3-1)*0.6], direction: [1,0,0], energy: 8000, radius: 0.5, source: 'player' }); input = 'energy'; wakeFrameMs = Math.max(wakeFrameMs, r.update(0.05)) } }
  const times = []
  for (let i = 0; i < 220; i++) { times.push(r.update(0.05)); if (i % 20 === 0) await wait(10) }
  const pieces = r.renderer.pieces().filter(p => !base.has(p.objectId))
  times.sort((a, b) => a - b)
  const engine = r.renderer.pieceSys && r.renderer.pieceSys.engine
  ruler.recordFellThrough(engine ? engine.fellThrough : 0)
  return { worstIsland, kitEnergy: { updatesWithKitEnergy: kitEnergy.shoves, kgm: +kitEnergy.kgm.toFixed(1) }, kind: KIND, islands: graph ? 'contact graph' : 'bounding spheres', n: pieces.length, asleep: pieces.filter(p => p.sleeping).length, c2Limit: EnergyRuler.C2_LIMIT, ...ruler.result(), worstRises: steps.sort((a, b) => b.rise - a.rise).slice(0, 8), risingSteps: steps.length, frameMs: { p50: +times[110].toFixed(2), p99: +times[Math.floor(times.length * 0.99)].toFixed(2), max: +times[times.length - 1].toFixed(2), wakeFrame: +wakeFrameMs.toFixed(2) } }
})()
