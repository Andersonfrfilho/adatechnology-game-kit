/* global GoldenTool, GoldenExposed */
// Capture for the Laboratório de Explosões: the 16 scenes, each blasted straight through `blast` (not `run`, so the throw physics and the
// zombies are skipped) from the scene's own camera, then stepped at 1/60 s for 8 s with the page's update functions in the page's order.
// Needs --expose with the names listed in tools/golden/README.md. Params: seed (unused: each scene uses the page's own seed 1000 + index * 97).
(() => {
  const X = GoldenExposed
  const FRAME_SECONDS = 1 / 60
  const TOTAL_FRAMES = 480
  const INSTANTS = [0.08, 0.25, 0.5, 1, 2, 4]
  const MAX_SPAWNS = 400
  // where each scene detonates, copied from the `run` of the page (y and direction included)
  const BLASTS = {
    granada: { at: [-4.2, 0.1, 3.4] },
    molotov: { at: [-3.7, 0.05, 2.6] },
    flash: { at: [-4, 0.3, 3.3] },
    caseira: { at: [-4.3, 0.1, 3.4] },
    dinamite: { at: [0, 0.05, 0] },
    c4: { at: [0, 0.15, 0.3] },
    claymore: { at: [-2.9, 0.2, 0], direction: [1, 0, 0] },
    p13: { at: [0, 0.3, 0] },
    m79: { at: [0, 0.1, 0] },
    m72: { at: [-8, 1.5, 2], direction: [0, 0, -1] },
    at4: { at: [-8, 1.5, 2], direction: [0, 0, -1] },
    rpg: { at: [-8, 1.5, 2], direction: [0, 0, -1] },
    barril: { at: [0, 0.5, 0] },
    carro: { at: [0, 0.6, 0] },
    posto: { at: [-7, 0.4, -1] },
    horda: { at: [0, 0.1, 0] },
  }
  const round4 = (value) => Math.round(value * 1e4) / 1e4 + 0
  const num = (value) => (value === null || value === undefined ? -1 : round4(Number(value)))
  const line = (values) => values.map(num).join(' ')
  const colorOf = (color) => [color.r, color.g, color.b]
  const tracedFields = {
    puff: (p) => [p.x, p.y, p.z, p.vx, p.vy, p.vz, p.s0, p.s1, p.sg, p.gk, p.life, p.h0, p.hl, p.drag, p.buoy, p.grav, p.kind, p.seed, p.wind, ...colorOf(p.c)],
    spark: (s) => [s.x, s.y, s.z, s.vx, s.vy, s.vz, s.life, s.w, s.st, s.kind, s.drag, s.g, s.bounce],
    glow: (g) => [g.x, g.y, g.z, g.s, g.s1, g.i, g.life, ...g.c, g.curve, g.fx, g.fy, g.fz, g.follow ? 1 : 0, g.flick ? 1 : 0],
    chunk: (c) => [c.x, c.y, c.z, c.vx, c.vy, c.vz, c.rx, c.ry, c.rz, c.ax, c.ay, c.az, c.sx, c.sy, c.sz, ...colorOf(c.col), c.plate ? 1 : 0, c.hot ? 1 : 0],
    fire: (f) => [f.x, f.y, f.z, f.r, f.r0, f.grow, f.life, f.rate, f.smoke, ...colorOf(f.col)],
  }
  const stateFields = {
    puff: (p) => [...tracedFields.puff(p), p.t, p.ph ?? -1, p.th ?? -1, ...(p.ring ? [p.ring.t, p.ring.x, p.ring.z, p.ring.y0, p.ring.rise, p.ring.R0, p.ring.R1, p.ring.r] : [-1])],
    spark: (s) => [...tracedFields.spark(s), s.t],
    glow: (g) => [...tracedFields.glow(g), g.t],
    chunk: (c) => [...tracedFields.chunk(c), c.rest ? 1 : 0, c.t, c.trail],
    fire: (f) => [...tracedFields.fire(f), f.t, f.acc, f.smokeAcc, f.fade],
  }
  const hashPool = (items, toFields) => GoldenTool.hashText(items.map((item) => line(toFields(item))).join('\n'))

  const recorder = GoldenTool.createEventRecorder()
  let frame = 0
  let spawns = []
  const trace = (kind, values) => {
    if (spawns.length < MAX_SPAWNS) spawns.push(`${frame} ${kind} ${line(values)}`)
  }
  // wraps the page's spawners through the exposed accessors (the page calls them by name, so the wrapper sees every call, nested ones included)
  const original = {}
  const wrap = (name, onCall, afterReturn) => {
    original[name] = X[name]
    X[name] = (...args) => {
      if (!afterReturn) onCall(...args)
      const result = original[name](...args)
      if (afterReturn) onCall(result)
      return result
    }
  }
  for (const kind of ['puff', 'spark', 'glow', 'chunk', 'fire']) wrap(kind, (made) => trace(kind, tracedFields[kind](made)), true)
  wrap('shock', (x, y, z, rs, rg, dur) => trace('shock', [x, y, z, rs, rg, dur ?? -1]))
  wrap('boomLight', (x, y, z, peak, dist, life, hex) => trace('light', [x, y, z, peak, dist, life, hex ?? -1]))
  wrap('scorch', (x, z, r) => trace('scorch', [x, z, r]))
  wrap('crater', (x, z, r, depth) => trace('crater', [x, z, r, depth]))
  wrap('mushroom', (x, y, z, m) => trace('mushroom', [x, y, z, m.h, m.r, m.n ?? -1, m.stem ?? -1, m.life ?? -1, m.rk ?? -1, m.roll ?? -1]))

  const updates = ['updateRings', 'updatePuffs', 'updateSparks', 'updateGlows', 'updateShocks', 'updateChunks', 'updateBodies', 'updateFires', 'updateBlood', 'updateZombies', 'updateLights']
  const aliveLight = () => X.XL.some((entry) => entry.l.intensity > 0.05)
  const layerAlive = {
    flash: () => aliveLight() || X.GL.some((g) => !g.follow),
    fire: () => X.P.some((p) => p.h0 > 0 && p.t < p.hl),
    shock: () => X.SHOCKS.length > 0,
    smoke: () => X.P.length > 0,
    shrapnel: () => X.S.length > 0 || X.CH.length > 0,
    mark: () => X.stage.children.length > 0,
  }
  const counts = () => [X.P.length, X.S.length, X.GL.length, X.CH.length, X.FIRES.length, X.SHOCKS.length, X.RINGS.length, X.XL.filter((entry) => entry.l.intensity > 0.05).length]
  const stageRoot = () => X.stage

  function describeInstant(key, seconds) {
    const lights = [...X.XL.map((entry) => entry.l.intensity), ...X.FL.map((l) => l.intensity), X.U.uGlowI.value, X.U.uGlowPos.value.x, X.U.uGlowPos.value.y, X.U.uGlowPos.value.z]
    recorder.record('instant', {
      key,
      seconds,
      counts: counts().join('/'),
      puffs: hashPool(X.P, stateFields.puff),
      sparks: hashPool(X.S, stateFields.spark),
      glows: hashPool(X.GL, stateFields.glow),
      chunks: hashPool(X.CH, stateFields.chunk),
      fires: hashPool(X.FIRES, stateFields.fire),
      rings: GoldenTool.hashText(X.RINGS.map((r) => line([r.t, r.x, r.z, r.y0, r.rise, r.rk, r.R0, r.R1, r.r, r.roll, r.life])).join('\n')),
      shocks: X.SHOCKS.map((s) => line([s.Rs, s.Rg, s.t, s.dur, s.x, s.z, s.sm.scale.x, s.sm.material.uniforms.uA.value, s.rm.scale.x, s.rm.material.uniforms.uA.value])),
      lights: line(lights),
      stage: GoldenTool.snapshotScene ? GoldenTool.snapshotScene(stageRoot()).hash : '',
      // the first and last live instance values of the buffers the shaders read (float32, compared with a tolerance by the renderer test)
      puffBuffer: X.P.length > 0 ? bufferSample(X.pA, X.pD, X.pC, X.P.length) : '',
    })
  }
  function bufferSample(positions, state, colors, count) {
    const pick = (index) => [...positions.subarray(index * 4, index * 4 + 4), ...state.subarray(index * 4, index * 4 + 4), ...colors.subarray(index * 3, index * 3 + 3)]
    return `${line(pick(0))} | ${line(pick(count - 1))}`
  }

  const keys = [...X.ORDER]
  for (const key of keys) {
    const index = X.ORDER.indexOf(key)
    X.seed = 1000 + index * 97
    X.clearAll()
    // the page keeps these across scenes; each scene starts from the same state so it can be replayed on its own
    X.clock = 0
    X.xlIdx = 0
    X.decalY = 0
    X.flashDecay = 6
    X.lodNow = 1
    X.WINDOWS.length = 0
    X.applyCam(X.SC[key])
    X.renderFicha(key)
    const profile = X.profOf(key)
    const spec = BLASTS[key]
    const extra = spec.direction ? { dir: new X.camera.position.constructor(...spec.direction) } : {}
    const definition = Object.assign({}, profile, extra)
    frame = 0
    spawns = []
    const camera = X.camera.position
    recorder.record('scene', { key, seed: 1000 + index * 97, camera: [camera.x, camera.y, camera.z], estimate: document.getElementById('mPv').textContent })
    X.blast(spec.at[0], spec.at[1], spec.at[2], definition)
    recorder.record('after_blast', { key, lod: X.lodNow, counts: counts().join('/'), shake: X.shakeAmp, flash: X.flashV, flashDecay: X.flashDecay, events: [X.evCount.p, X.evCount.s, X.evCount.c, X.evCount.l], seed: X.seed })
    const timeline = []
    const first = {}
    const last = {}
    const instantFrames = new Map(INSTANTS.map((seconds) => [Math.round(seconds * 60), seconds]))
    for (frame = 1; frame <= TOTAL_FRAMES; frame++) {
      X.clock += FRAME_SECONDS
      X.simT += FRAME_SECONDS
      for (const name of updates) X[name](FRAME_SECONDS)
      timeline.push(counts().join('.'))
      for (const [layer, alive] of Object.entries(layerAlive)) {
        if (!alive()) continue
        if (first[layer] === undefined) first[layer] = frame
        last[layer] = frame
      }
      if (instantFrames.has(frame)) describeInstant(key, instantFrames.get(frame))
    }
    recorder.record('spawns', { key, count: spawns.length, list: spawns })
    recorder.record('frames', { key, counts: timeline.join(' ') })
    recorder.record('layers', { key, first, last })
    recorder.record('end', { key, seed: X.seed, stage: GoldenTool.snapshotScene(stageRoot()).hash })
  }
  for (const [name, fn] of Object.entries(original)) X[name] = fn
  return GoldenTool.createGoldenRecord({ name: 'explosion-lab', seed: 0, events: recorder.events(), scenes: {} })
})()
