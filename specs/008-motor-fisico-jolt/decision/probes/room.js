// Room probe (blast or hammer) measured with the one ruler of spec 008 (`packages/game-destruction-three/tests/energy-ruler.ts`).
// `drive.mjs` puts the ruler's exports in scope as `EnergyRuler` and swaps the kind marker (blast | hammer).
// Ruler of the room: only the gain with no input from outside counts (C2); sleep counts from the last input from outside (C4).
(async () => {
  const KIND = '__KIND__'
  const DISCRETE = '__DISCRETE__'
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
  const rulerWithoutR3 = new EnergyRuler.EnergyRuler()
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
  // R3: pieces whose continuous-motion body has a contact it did not have in the previous update (the same rule as tests/contact-graph.ts `createFirstContactTracker`)
  let previousPartners = new Map()
  const firstContactNow = () => {
    if (!graph) return undefined
    const log = glue.world.pairLog, partners = new Map()
    const add = (key, other) => { const set = partners.get(key) ?? new Set(); set.add(other); partners.set(key, set) }
    for (let i = 0; i < log.length; i += 2) { add(log[i], log[i + 1]); add(log[i + 1], log[i]) }
    const first = new Set()
    for (const [objectId, body] of glue.byObject) {
      const link = glue.links.get(body), now = link && partners.get(link.id)
      if (!link || !now) continue
      const before = previousPartners.get(link.id)
      if (![...now].some(other => !(before && before.has(other)))) continue
      if (glue.world.bi.GetMotionQuality(glue.world.entry(link.id).id) === glue.world.J.EMotionQuality_LinearCast) first.add(objectId)
    }
    previousPartners = partners
    return first
  }
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
  // T3.8u: energy of the heavy pieces (the lot's poles) after every fixed step of the engine, with what each touches, kept for the steps that gain
  const fixedLog = []
  let fixedUpdate = -1
  if (glue && glue.world.stepFixed) {
    const stepFixedOf = glue.world.stepFixed.bind(glue.world)
    const buffer = new Float64Array(7), speeds = new Float64Array(6)
    const tileKeys = () => { const m = new Map(); for (const [k, t] of glue.tiles) { if (t.ground !== undefined) m.set(t.ground, 'tile:' + k); if (t.steps) m.set(t.steps, 'steps'); if (t.solid) m.set(t.solid, 'solid') } return m }
    const J = glue.world.J
    glue.world.stepFixed = (h) => {
      if (DISCRETE !== 'none') for (const p of r.renderer.pieces()) {
        if (base.has(p.objectId) || (DISCRETE === 'heavy' && p.mass < 500)) continue
        const link = glue.links.get(glue.byObject.get(p.objectId)); if (!link) continue
        const e = glue.world.entry(link.id)
        if (glue.world.bi.GetMotionQuality(e.id) !== J.EMotionQuality_Discrete) glue.world.bi.SetMotionQuality(e.id, J.EMotionQuality_Discrete)
      }
      stepFixedOf(h)
      for (const p of r.renderer.pieces()) {
        if (p.mass < 500 || base.has(p.objectId)) continue
        const link = glue.links.get(glue.byObject.get(p.objectId)); if (!link) continue
        glue.world.readPose(link.id, buffer, 0); glue.world.readVelocity(link.id, speeds, 0)
        const [qx, qy, qz, qw] = [buffer[3], buffer[4], buffer[5], buffer[6]]
        // body-frame angular velocity: rotate by the inverse of q
        const [wx, wy, wz] = [speeds[3], speeds[4], speeds[5]]
        const cx = [-qx, -qy, -qz]
        const t = [2 * (cx[1] * wz - cx[2] * wy), 2 * (cx[2] * wx - cx[0] * wz), 2 * (cx[0] * wy - cx[1] * wx)]
        const bw = [wx + qw * t[0] + (cx[1] * t[2] - cx[2] * t[1]), wy + qw * t[1] + (cx[2] * t[0] - cx[0] * t[2]), wz + qw * t[2] + (cx[0] * t[1] - cx[1] * t[0])]
        const energyHeight = EnergyRuler.energyHeightOf({ centreY: buffer[1], velocity: [speeds[0], speeds[1], speeds[2]], bodyAngularVelocity: bw, halfExtents: p.halfExtents, mass: p.mass, inertia: tensorOf(p) })
        const partners = glue.world.partners.get(link.id)
        const names = []
        if (partners) { const tiles = tileKeys(); for (const [other, n] of partners) { const e = glue.world.entry(other); names.push((tiles.get(other) ?? (e ? e.layer + ':' + e.user : '?')) + 'x' + n) } }
        fixedLog.push({ u: fixedUpdate, id: p.objectId, y: +buffer[1].toFixed(4), vy: +speeds[1].toFixed(3), v: +Math.hypot(speeds[0], speeds[1], speeds[2]).toFixed(3), w: +Math.hypot(wx, wy, wz).toFixed(3), e: energyHeight, mass: p.mass, partners: names })
      }
    }
  }
  // T3.8u: every kit move of a heavy piece (setPose, setVelocity) and every ground change, stamped with the update and the fixed step it happens before
  const kitOps = []
  if (glue && glue.world.setPose) {
    const objectOfKey = key => { for (const [objectId, body] of glue.byObject) { const link = glue.links.get(body); if (link && link.id === key) return objectId } return undefined }
    const tmp = new Float64Array(7), tmpV = new Float64Array(6)
    const setPoseOf = glue.world.setPose.bind(glue.world)
    glue.world.setPose = (id, position, rotation, wake) => {
      const objectId = objectOfKey(id)
      const piece = objectId && r.renderer.pieces().find(p => p.objectId === objectId)
      if (piece && piece.mass > 5) { glue.world.readPose(id, tmp, 0); const dy = position[1] - tmp[1]; const d = Math.hypot(position[0] - tmp[0], dy, position[2] - tmp[2]); if (d > 0.0003) kitOps.push({ u: fixedUpdate, op: 'setPose', id: objectId, dy: +(dy * 1000).toFixed(2), dmm: +(d * 1000).toFixed(2), fixedSteps: fixedLog.length }) }
      return setPoseOf(id, position, rotation, wake)
    }
    const setVelocityOf = glue.world.setVelocity.bind(glue.world)
    glue.world.setVelocity = (id, lin, ang) => {
      const objectId = objectOfKey(id)
      const piece = objectId && r.renderer.pieces().find(p => p.objectId === objectId)
      if (piece && piece.mass > 5) { glue.world.readVelocity(id, tmpV, 0); const d = Math.hypot(lin[0] - tmpV[0], lin[1] - tmpV[1], lin[2] - tmpV[2]) + Math.hypot(ang[0] - tmpV[3], ang[1] - tmpV[4], ang[2] - tmpV[5]); if (d > 0.001) kitOps.push({ u: fixedUpdate, op: 'setVelocity', id: objectId, d: +d.toFixed(3), fixedSteps: fixedLog.length }) }
      return setVelocityOf(id, lin, ang)
    }
    const groundOf = glue.groundChanged.bind(glue)
    glue.groundChanged = (x, z, radius) => { const n0 = kitOps.length; const rootsBefore = new Map(r.renderer.pieces().filter(p => p.mass > 5).map(p => [p.objectId, p.root.position.y])); groundOf(x, z, radius); for (const p of r.renderer.pieces()) { const y0 = rootsBefore.get(p.objectId); if (y0 !== undefined && Math.abs(p.root.position.y - y0) > 1e-5) kitOps.push({ u: fixedUpdate, op: 'groundChanged-lift', id: p.objectId, dy: +((p.root.position.y - y0) * 1000).toFixed(2), at: [+x.toFixed(1), +z.toFixed(1), +radius.toFixed(1)], fixedSteps: fixedLog.length }) } }
  }
  let worstIsland = null
  // T3.8u: the C3 offender (same sum as the ruler: rise beyond own upward speed, updates with no outside energy) with its history, and the last steps of every piece for the C1 island
  const lifts = new Map()
  const ring = []
  const partsOf = id => { const ob = r.world.serialize().objects.find(x => x.id === id); return ob && ob.state && ob.state.parts ? ob.state.parts.map(x => x.id).slice(0, 5) : null }
  const keyInfo = key => { const e = glue && glue.world.entry ? glue.world.entry(key) : undefined; return e ? { layer: e.layer, user: e.user === undefined ? null : String(e.user).slice(0, 40), fixed: e.invMass === 0 } : null }
  const kitEnergy = { shoves: 0, topples: 0, kgm: 0 }
  let input = 'none'
  const ou = r.update.bind(r)
  r.update = (dt) => {
    const all = r.renderer.pieces().filter(p => !base.has(p.objectId))
    // a piece born in the previous update has its mesh at a pre-sync pose until its first step: it enters the ruler from its second observation
    const pieces = all.filter(p => (seen.get(p.objectId) ?? 0) >= 1)
    const before = pieces.map(sampleOf)
    fixedUpdate = stepNo
    const t0 = performance.now()
    ou(dt)
    const ms = performance.now() - t0
    const after = pieces.map(sampleOf)
    for (let k = 0; k < before.length; k++) {
      const rise = after[k].energyHeight - before[k].energyHeight
      if (input === 'none' && !given.has(before[k].id) && rise > 0.02) steps.push({ step: stepNo, id: before[k].id, mass: +before[k].mass.toFixed(1), rise: +rise.toFixed(3), speedBefore: +before[k].speed.toFixed(2), speedAfter: +after[k].speed.toFixed(2), y: +after[k].centre[1].toFixed(3), yBefore: +before[k].centre[1].toFixed(3), seen: (seen.get(before[k].id) ?? 0), xz: [+after[k].centre[0].toFixed(2), +after[k].centre[2].toFixed(2)], sleepingBefore: before[k].sleeping, kin: before[k].mass > 500 ? { dy: +(after[k].centre[1] - before[k].centre[1]).toFixed(3), vyBefore: +before[k].velocityY.toFixed(2), vyAfter: +after[k].velocityY.toFixed(2), spinBefore: +before[k].spin.toFixed(2), spinAfter: +after[k].spin.toFixed(2), radius: +before[k].radius.toFixed(2) } : undefined, near: rise > 1 ? after.map((o, j) => ({ id: o.id, d: +Math.hypot(o.centre[0] - after[k].centre[0], o.centre[1] - after[k].centre[1], o.centre[2] - after[k].centre[2]).toFixed(2), mass: +o.mass.toFixed(1), speedBefore: +before[j].speed.toFixed(2), speedAfter: +o.speed.toFixed(2), y: +o.centre[1].toFixed(2) })).filter(o => o.id !== before[k].id).sort((a, b) => a.d - b.d).slice(0, 4) : undefined })
    }
    const islandNetOf = (() => { const t = touchingNow(); if (!t) return () => undefined; const isl = EnergyRuler.islandsOf(before, after, t); const sums = new Map(); before.forEach((b0, k) => sums.set(isl[k], (sums.get(isl[k]) ?? 0) + b0.mass * (after[k].energyHeight - b0.energyHeight - (given.get(b0.id) ?? 0)))); return k => +sums.get(isl[k]).toFixed(2) })()
    if (input === 'none') for (let k = 0; k < before.length; k++) {
      const b0 = before[k], a0 = after[k]
      const rise = Math.max(0, a0.centre[1] - b0.centre[1] - Math.max(0, b0.velocityY) * dt)
      const e = lifts.get(b0.id) ?? { total: 0, givenPart: 0, mass: b0.mass, hist: [] }
      e.total += rise
      if (given.has(b0.id)) e.givenPart += rise
      if (rise > 0.001) e.hist.push({ step: stepNo, islandNet: islandNetOf(k), rise: +rise.toFixed(4), dEm: +(b0.mass * (a0.energyHeight - b0.energyHeight - (given.get(b0.id) ?? 0))).toFixed(2), spinBefore: +b0.spin.toFixed(2), spinAfter: +a0.spin.toFixed(2), given: given.has(b0.id) ? +given.get(b0.id).toFixed(3) : 0, vyBefore: +b0.velocityY.toFixed(2), vyAfter: +a0.velocityY.toFixed(2), speedBefore: +b0.speed.toFixed(2), speedAfter: +a0.speed.toFixed(2), y: +a0.centre[1].toFixed(3), sleepingBefore: b0.sleeping })
      lifts.set(b0.id, e)
    }
    ring.push({ step: stepNo, s: before.map((b0, k) => ({ id: b0.id, y: +after[k].centre[1].toFixed(4), vy: +after[k].velocityY.toFixed(2), v: +after[k].speed.toFixed(2), sl: after[k].sleeping, dE: +(b0.mass * (after[k].energyHeight - b0.energyHeight - (given.get(b0.id) ?? 0))).toFixed(3) })) })
    if (ring.length > 8) ring.shift()
    for (const q of all) seen.set(q.objectId, (seen.get(q.objectId) ?? 0) + 1)
    stepNo++
    for (const [id, h] of given) { kitEnergy.shoves++; const m = before.find(x => x.id === id); if (m) kitEnergy.kgm += m.mass * h }
    const touching = touchingNow()
    if (input === 'none' && touching) {
      const isl = EnergyRuler.islandsOf(before, after, touching)
      const sums = new Map()
      before.forEach((b0, k) => { const e = b0.mass * (after[k].energyHeight - b0.energyHeight - (given.get(b0.id) ?? 0)); const o = sums.get(isl[k]) ?? { e: 0, m: 0, ks: [] }; o.e += e; o.m += b0.mass; o.ks.push(k); sums.set(isl[k], o) })
      for (const o of sums.values()) { const ex = o.e - o.m * 0.001; if (ex > (worstIsland ? worstIsland.excess : 0.2)) { worstIsland = { excess: +ex.toFixed(2), step: stepNo, members: o.ks.map(k => ({ id: before[k].id, mass: +before[k].mass.toFixed(1), dEm: +(before[k].mass * (after[k].energyHeight - before[k].energyHeight - (given.get(before[k].id) ?? 0))).toFixed(2), v0: +before[k].speed.toFixed(2), v1: +after[k].speed.toFixed(2), sleepingBefore: before[k].sleeping, y: +after[k].centre[1].toFixed(2) })).filter(m => Math.abs(m.dEm) > 0.05 || m.mass > 100) }
        const ids = new Set(worstIsland.members.map(m => m.id))
        worstIsland.parts = Object.fromEntries([...ids].map(id => [id, partsOf(id)]))
        const objectKey = new Map(); for (const [objectId, body] of glue.byObject) { const link = glue.links.get(body); if (link) objectKey.set(link.id, objectId) }
        const log = glue.world.pairLog, cs = []
        for (let i = 0; i < log.length; i += 2) { const a = objectKey.get(log[i]), c = objectKey.get(log[i + 1]); if ((a !== undefined && ids.has(a)) || (c !== undefined && ids.has(c))) cs.push({ a: a ?? keyInfo(log[i]), b: c ?? keyInfo(log[i + 1]) }) }
        worstIsland.contacts = cs.slice(0, 40)
        const around = new Set(ids); for (const c of cs) { if (typeof c.a === 'string') around.add(c.a); if (typeof c.b === 'string') around.add(c.b) }
        worstIsland.history = ring.map(rg => ({ step: rg.step, s: rg.s.filter(x => around.has(x.id)) }))
        worstIsland.neighbours = Object.fromEntries([...around].filter(id => !ids.has(id)).map(id => [id, { parts: partsOf(id), mass: (all.find(q => q.objectId === id) || {}).mass }])) } }
    }
    const firstContact = firstContactNow()
    ruler.step(before, after, dt, input, { touching, given, firstContact })
    rulerWithoutR3.step(before, after, dt, input, { touching, given })
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
  // who the pieces that gain more than the limit are (T3.8e): mass, box and the parts of the object they were, from the ruler's own per-piece gains
  const gains = new Map(ruler.pieceGains)
  for (const [id, episode] of ruler.episodes) gains.set(id, ruler.withEpisode(gains.get(id), episode))
  const objects = r.world.serialize().objects
  const overPieces = [...gains].filter(([, g]) => g.conditioned > EnergyRuler.C2_LIMIT).map(([id, g]) => {
    const p = pieces.find(q => q.objectId === id), ob = objects.find(x => x.id === id)
    return { id, gain: +g.conditioned.toFixed(3), mass: p && +p.mass.toFixed(1), half: p && p.halfExtents.map(x => +x.toFixed(2)), parts: ob && ob.state && ob.state.parts ? ob.state.parts.map(x => x.id).slice(0, 4) : null }
  })
  const c3List = [...lifts].sort((a, b) => b[1].total - a[1].total).slice(0, 3).map(([id, e]) => { const p = pieces.find(q => q.objectId === id); return { id, total: +e.total.toFixed(4), givenPart: +e.givenPart.toFixed(4), mass: +e.mass.toFixed(1), half: p && p.halfExtents.map(x => +x.toFixed(2)), parts: partsOf(id), hist: e.hist.slice(0, 40) } })
  const fixedGain = []
  const perId = new Map()
  for (const row of fixedLog) { const list = perId.get(row.id) ?? []; list.push(row); perId.set(row.id, list) }
  for (const list of perId.values()) for (let i = 1; i < list.length; i++) { const a = list[i - 1], b = list[i]; if (b.u < (KIND === 'blast' ? 10 : 20)) continue; const d = b.mass * (b.e - a.e); if (d > 0.3) fixedGain.push({ gain: +d.toFixed(2), prev: list.slice(Math.max(0, i - 4), i + 2).map(x => ({ ...x, e: +x.e.toFixed(4), mass: undefined })) }) }
  const quality = (() => { const out = {}; for (const p of r.renderer.pieces()) { if (base.has(p.objectId) || p.mass < 500) continue; const link = glue.links.get(glue.byObject.get(p.objectId)); if (link) out[p.objectId] = glue.world.bi.GetMotionQuality(glue.world.entry(link.id).id) } return out })()
  const oldC3 = Math.max(0, ...[...lifts.values()].map(e => e.total - e.givenPart))
  const oldC1 = rulerWithoutR3.result()
  return { before: { c1Excess: oldC1.c1Excess, c1Violations: oldC1.c1Violations, c3LiftWithoutR1: oldC3 }, motionQuality: quality, discrete: DISCRETE, kitOps: kitOps.filter(o => o.u >= (KIND === 'blast' ? 10 : 20) && (o.op !== 'setPose' || Math.abs(o.dy) > 3) && (o.op !== 'setVelocity' || o.d > 0.3)).slice(0, 80), kitOpsTotal: kitOps.length, fixedGain: fixedGain.sort((a, b) => b.gain - a.gain).slice(0, 6), fixedSteps: fixedLog.length, c3Offenders: c3List, overPieces, worstIsland, kitEnergy: { updatesWithKitEnergy: kitEnergy.shoves, kgm: +kitEnergy.kgm.toFixed(1) }, kind: KIND, islands: graph ? 'contact graph' : 'bounding spheres', n: pieces.length, asleep: pieces.filter(p => p.sleeping).length, c2Limit: EnergyRuler.C2_LIMIT, ...ruler.result(), worstRises: steps.sort((a, b) => b.rise - a.rise).slice(0, 8), risingSteps: steps.length, frameMs: { p50: +times[110].toFixed(2), p99: +times[Math.floor(times.length * 0.99)].toFixed(2), max: +times[times.length - 1].toFixed(2), wakeFrame: +wakeFrameMs.toFixed(2) } }
})()
