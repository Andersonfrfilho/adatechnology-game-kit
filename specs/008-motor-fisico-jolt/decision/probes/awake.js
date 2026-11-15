// T3.8h: who is still awake after 3 s (C4) in the hammer: per frame, the awake pieces with speed, spin, contacts and every kit write (wake, setPose, setVelocity, wakeInBox) that touched them.
// `awake-drive.mjs` swaps __KIND__ and __FROM__ (seconds after the last blow from which frames are logged).
(async () => {
  const KIND = '__KIND__', FROM = Number('__FROM__')
  const r = window.__testRoom
  const wait = ms => new Promise(f => setTimeout(f, ms))
  r.openArea('floorplan_area')
  const b = r.bench('floorplan_area')
  b.set('package', 'residential'); b.set('template', 'single_storey_a'); b.set('seed', 1)
  b.act('build')
  await wait(8000)
  window.requestAnimationFrame = () => 0
  await wait(300)
  const base = new Set(r.renderer.pieces().map(p => p.objectId))
  const o = r.world.serialize().objects.find(x => x.id === 'house3d:1').state.position
  const spot = [o[0] - 2.5, 0.6, o[2]]
  const glue = r.renderer.pieceSys.engine
  const world = glue.world
  if (KIND === 'ground') {
    const rows = []
    for (let z = -3; z <= -1; z += 0.1) { const row = []; for (let x = 7; x <= 9; x += 0.1) row.push(+glue.o.groundAt(x, z).toFixed(3)); rows.push(row.join(' ')) }
    const coarse = []
    for (let z = -12; z <= 12; z += 2) { const row = []; for (let x = -4; x <= 16; x += 2) row.push(+glue.o.groundAt(x + 0.01, z + 0.01).toFixed(3)); coarse.push(row.join(' ')) }
    return { rows, coarse, fellThrough: 0, frames: [], names: {}, nets: [], final: [] }
  }
  world.trackPairs = true
  const objectOfLink = () => { const m = new Map(); for (const [objectId, body] of glue.byObject) { const l = glue.links.get(body); if (l) m.set(l.id, objectId) } return m }
  let writes = new Map()
  const note = (id, what) => { const k = objectOfLink().get(id) ?? ('#' + id); const a = writes.get(k) ?? []; a.push(what); writes.set(k, a) }
  const proto = Object.getPrototypeOf(world)
  const skip = new Set(['entry', 'readPose', 'readVelocity', 'isSleeping', 'touching', 'update', 'step', 'constructor', 'createBody'])
  for (const name of Object.getOwnPropertyNames(proto)) { if (skip.has(name) || typeof world[name] !== 'function' || ['wake', 'setPose', 'setVelocity', 'wakeInBox'].includes(name)) continue; const f = world[name].bind(world); world[name] = (...args) => { if (typeof args[0] === 'number') note(args[0], name); return f(...args) } }
  for (const name of ['wake', 'setPose', 'setVelocity']) { const f = world[name].bind(world); world[name] = (id, ...rest) => { note(id, name); return f(id, ...rest) } }
  const wib = world.wakeInBox.bind(world); let boxWakes = 0; world.wakeInBox = (a, c) => { boxWakes++; return wib(a, c) }
  const gc = glue.groundChanged.bind(glue); let groundChanges = 0; glue.groundChanged = (x, z, rad) => { groundChanges++; return gc(x, z, rad) }
  const tp = glue.topple.bind(glue); const toppled = new Map(); let gave = []
  const kitPush = (p, f) => { const v = [...p.velocity, ...p.angularVelocity]; const out = f(); const u = [...p.velocity, ...p.angularVelocity]; if (v.some((x, i) => x !== u[i])) gave.push(p.objectId); return out }
  glue.topple = (p, dt) => { toppled.set(p.objectId, (toppled.get(p.objectId) ?? 0) + 1); return kitPush(p, () => tp(p, dt)) }
  const ps = r.renderer.pieceSys; const imp = ps.impulse.bind(ps); ps.impulse = (p, i, pt) => { gave.push(p.objectId); return imp(p, i, pt) }
  const staticOf = new Map()
  const indexStatics = () => { for (const [oid, fx] of glue.statics.bodies) for (const [key, h] of fx.held) staticOf.set(h.id, { oid, key, c: h.solid.center.map(x => +x.toFixed(3)), half: h.solid.half.map(x => +x.toFixed(3)), mesh: !!h.solid.mesh }) }
  const detail = (objectId) => { indexStatics(); const l = glue.links.get(glue.byObject.get(objectId)); const axis = new Float64Array(3); const depth = world.penetration ? world.penetration(l.id, axis, glue.statics.ids) : NaN; const bd = world.entry(l.id).body; const parts = []; const lg = world.pairLog; for (let i = 0; i < lg.length; i += 2) { const o = lg[i] === l.id ? lg[i + 1] : lg[i + 1] === l.id ? lg[i] : undefined; if (o !== undefined && staticOf.has(o)) parts.push(staticOf.get(o)) } const wb = bd.GetWorldSpaceBounds(), mn = [wb.mMin.GetX(), wb.mMin.GetY(), wb.mMin.GetZ()], mx = [wb.mMax.GetX(), wb.mMax.GetY(), wb.mMax.GetZ()]; const near = []; for (const st of staticOf.values()) { const r = Math.hypot(...st.half); if ([0, 1, 2].every(k => st.c[k] + r > mn[k] && st.c[k] - r < mx[k])) near.push(st) } const piece = r.renderer.pieces().find(q => q.objectId === objectId); return { bounds: [mn, mx].map(a => a.map(x => +x.toFixed(2))), half: piece.halfExtents.map(x => +x.toFixed(3)), boxes: (piece.partBoxes || []).length, overlapping: near.filter(x => !x.mesh).slice(0, 8), depth: +depth.toFixed(4), axis: [...axis].map(x => +x.toFixed(2)), partners: parts.slice(0, 6), nPartners: parts.length } }
  // T3.8h: every time the kit's net puts a piece back above the ground (`EnginePieces.fellThrough`), where it was, what the ground was for the kit and for the engine
  const nets = []
  const readBackOf = glue.readBack.bind(glue)
  glue.readBack = (b, dt, time) => {
    const before = glue.fellThrough
    const link = glue.links.get(b)
    const pre = link ? { sleeping: link.sleeping, vel: [...b.velocity], dirty: undefined } : undefined
    readBackOf(b, dt, time)
    if (glue.fellThrough > before && nets.length < 40) {
      const c = glue.centre(b)
      const floor = glue.o.groundAt(c.x, c.z)
      const hit = world.rayFirst ? world.rayFirst([c.x, c.y + 2, c.z], [0, -1, 0], 6) : null
      const tx = Math.floor(c.x / 2), tz = Math.floor(c.z / 2), tile = glue.tiles.get((tx + 32768) * 65536 + (tz + 32768))
      nets.push({ step: stepNo, id: b.objectId, m: +b.mass.toFixed(2), pos: [c.x, c.y, c.z].map(x => +x.toFixed(3)), floor: +floor.toFixed(3), reach: +Math.hypot(...b.halfExtents).toFixed(3), pre, rayY: hit ? +(c.y + 2 - hit.distance).toFixed(3) : null, tile: tile ? { dirty: tile.dirty, slab: tile.slab, boxes: tile.boxes.length } : 'none', speed: +Math.hypot(...b.velocity).toFixed(2) })
    }
  }
  const objects = () => r.world.serialize().objects
  const nameOf = id => { const ob = objects().find(x => x.id === id); return ob && ob.state && ob.state.parts ? ob.state.parts.map(x => x.id).slice(0, 2).join('|') : (ob ? ob.type : '?') }
  let t = 0, lastInput = 0, frames = []
  const ou = r.update.bind(r)
  const bornAt = new Map(); let stepNo = 0; const bornBoxes = new Map()
  const track = () => {
    stepNo++
    for (const p of r.renderer.pieces()) if (!base.has(p.objectId) && !bornAt.has(p.objectId)) { bornBoxes.set(p.objectId, (p.partBoxes || []).map(x => ({ c: x.center.map(y => +y.toFixed(2)), h: x.half.map(y => +y.toFixed(2)), r: x.rotation && x.rotation.map(y => +y.toFixed(2)) }))); bornAt.set(p.objectId, { step: stepNo, m: +p.mass.toFixed(2), pos: [...p.root.position.toArray()].map(x => +x.toFixed(2)), v: +Math.hypot(...p.velocity).toFixed(2), half: p.halfExtents.map(x => +x.toFixed(2)), nboxes: (p.partBoxes || []).length }) }
    const pieces = r.renderer.pieces().filter(p => !base.has(p.objectId))
    const awake = pieces.filter(p => !p.sleeping)
    const log = world.pairLog, om = objectOfLink(), pairs = new Map()
    for (let i = 0; i < log.length; i += 2) { const a = om.get(log[i]) ?? 'S' + log[i], c = om.get(log[i + 1]) ?? 'S' + log[i + 1]; for (const [x, y] of [[a, c], [c, a]]) { const s = pairs.get(x) ?? new Set(); s.add(y); pairs.set(x, s) } }
    const partnerInfo = (objectId) => { const link = glue.links.get(glue.byObject.get(objectId)); if (!link) return []; const out = []; for (let i = 0; i < log.length; i += 2) { const other = log[i] === link.id ? log[i + 1] : log[i + 1] === link.id ? log[i] : undefined; if (other === undefined) continue; try { const bd = world.entry(other).body; const lv = bd.GetLinearVelocity(); out.push({ id: om.get(other) ?? 'S' + other, motion: bd.GetMotionType(), active: bd.IsActive(), sensor: bd.IsSensor(), speed: +Math.hypot(lv.GetX(), lv.GetY(), lv.GetZ()).toFixed(3) }) } catch (e) { out.push({ id: other, err: String(e) }) } } return out.filter(x => x.motion !== 0 || x.active) }
    const gaveNow = gave; gave = []
    if (t - lastInput >= FROM) frames.push({ t: +(t - lastInput).toFixed(2), gaveNow, awake: awake.map(p => ({ id: p.objectId, m: +p.mass.toFixed(2), v: +Math.hypot(...p.velocity).toFixed(3), w: +Math.hypot(...p.angularVelocity).toFixed(3), y: +p.root.position.y.toFixed(3), touches: [...(pairs.get(p.objectId) ?? [])], writes: writes.get(p.objectId), toppled: toppled.get(p.objectId), moving: partnerInfo(p.objectId), detail: (p.mass < 20 && Math.hypot(...p.velocity) < 0.05 && t - lastInput > 3 && Math.round((t - lastInput) * 20) % 20 === 0) ? detail(p.objectId) : undefined, pole: p.mass > 500 ? (() => { const l = glue.links.get(glue.byObject.get(p.objectId)); if (!l) return undefined; const bd = world.entry(l.id).body; const q = bd.GetRotation(); const out = new Float32Array(48); const n = world.contactPoints(l.id, out); const pts = []; for (let i = 0; i < n; i++) pts.push([out[i * 3], out[i * 3 + 1], out[i * 3 + 2]].map(x => +x.toFixed(3))); return { q: [q.GetX(), q.GetY(), q.GetZ(), q.GetW()].map(x => +x.toFixed(4)), pts, boxes: bornBoxes.get(p.objectId) } })() : undefined, raw: (() => { const l = glue.links.get(glue.byObject.get(p.objectId)); if (!l) return; const bd = world.entry(l.id).body; const pos = bd.GetPosition(), lv = bd.GetLinearVelocity(), av = bd.GetAngularVelocity(); return { pos: [pos.GetX(), pos.GetY(), pos.GetZ()].map(x => +x.toFixed(5)), lv: [lv.GetX(), lv.GetY(), lv.GetZ()].map(x => +x.toFixed(5)), av: [av.GetX(), av.GetY(), av.GetZ()].map(x => +x.toFixed(5)), allowSleep: bd.GetAllowSleeping ? bd.GetAllowSleeping() : undefined } })() })), boxWakes, groundChanges })
    writes = new Map(); boxWakes = 0; groundChanges = 0
  }
  r.update = (dt) => { const ms = ou(dt); t += dt; track(); return ms }
  if (KIND === 'blast') { r.blastAt('c4', spot); r.update(0.05) }
  else { for (let k = 0; k < 12; k++) { r.world.hit('house3d:1', { type: 'blunt', point: [spot[0], 0.5 + 0.5*(k%4), spot[2] + (k%3-1)*0.6], direction: [1,0,0], energy: 8000, radius: 0.5, source: 'player' }); r.update(0.05) } }
  lastInput = t
  const timeline = []
  for (let i = 0; i < 160; i++) { r.update(0.05); const a = r.renderer.pieces().filter(p => !base.has(p.objectId) && !p.sleeping).length; timeline.push(a); if (i % 20 === 0) await wait(10) }
  const names = {}
  for (const f of frames) for (const a of f.awake) if (!names[a.id]) names[a.id] = nameOf(a.id)
  // the frame at which the last piece went to sleep
  const lastAwake = frames.filter(f => f.awake.length).map(f => f.t).pop()
  const lastGave = frames.filter(f => f.gaveNow.length).map(f => f.t).pop()
  return { nets, fellThrough: glue.fellThrough, final: r.renderer.pieces().filter(p => !base.has(p.objectId)).map(p => { const c = glue.centre(p); const hit = world.rayFirst([c.x, c.y + 1, c.z], [0, -1, 0], 4); const all = []; world.rayAll([c.x, c.y + 1, c.z], [0, -1, 0], 4, all); const tx = Math.floor(c.x / 2), tz = Math.floor(c.z / 2); const around = [[0, 0], [0, -1], [-1, 0], [-1, -1]].map(([a, b]) => { const t = glue.tiles.get((tx + a + 32768) * 65536 + (tz + b + 32768)); return t ? { k: [tx + a, tz + b], slab: t.slab, boxes: t.boxes.length, steps: t.steps !== null, solid: t.solid !== null } : { k: [tx + a, tz + b], none: true } }); return { rays: all.map(h => ({ body: h.body, user: h.user, y: +(c.y + 1 - h.distance).toFixed(4) })), around, id: p.objectId, m: +p.mass.toFixed(2), half: p.halfExtents.map(x => +x.toFixed(3)), pos: [c.x, c.y, c.z].map(x => +x.toFixed(3)), groundAt: +glue.o.groundAt(c.x, c.z).toFixed(4), rayY: hit ? +(c.y + 1 - hit.distance).toFixed(4) : null, sleeping: p.sleeping } }).filter(x => x.m < 1 && x.pos[1] - x.half[1] < 0.005), born: Object.fromEntries(bornAt), lastGave, lastAwake, names, frames: frames.filter(f => f.awake.length), awakeCount: timeline.filter((_, i) => true).join(',') }
})()
