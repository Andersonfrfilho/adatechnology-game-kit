/* global GoldenTool, GoldenExposed */
// Capture for the Oficina de VFX: every catalogue effect (minus rain, fog and headlights, which belong to the weather phase, and the
// living-fluids film, recorded by `vfx-workshop-fluids.js`) once per option of its parameter. The page's own `frame` runs, with the
// renderer silenced, so the timers, ticks and updates run in the page's order. `Math.random` is a counted stream seeded per effect and option.
// Params: mode = effects (default) | fluids.
(() => {
  const X = GoldenExposed
  const { mode = 'effects' } = globalThis.__GOLDEN_PARAMS
  const FRAME_MS = 1000 / 60
  const SKIPPED = new Set(['chuva', 'neblina', 'farol', 'fluidos'])
  const DEFAULT_SECONDS = 6
  const MAX_SPAWNS = 300
  const INSTANT_FRAMES = [6, 30, 60, 120]
  const FILM_INSTANTS = [0.5, 1, 2, 5, 10]
  const round4 = (value) => Math.round(value * 1e4) / 1e4 + 0
  const clean = (value) => {
    if (value === null || value === undefined) return null
    if (typeof value === 'number') return round4(value)
    if (typeof value === 'boolean' || typeof value === 'string') return value
    if (typeof value === 'function') return undefined
    if (Array.isArray(value)) return value.map((entry) => clean(entry) ?? null)
    if (value.isVector3) return [value.x, value.y, value.z].map(round4)
    if (value.isColor) return [value.r, value.g, value.b].map(round4)
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => typeof entry !== 'function').map(([key, entry]) => [key, clean(entry)]))
  }
  const hashArray = (array, count) => GoldenTool.hashText(Array.from(array.subarray(0, count), (value) => round4(value)).join(','))
  const poolHash = (pool, strides) =>
    GoldenTool.hashText(
      strides
        .map(([name, stride]) => `${name}:${hashArray(pool[name], pool.n * stride)}`)
        .join('|'),
    )
  const recorder = GoldenTool.createEventRecorder()
  const nativeRandom = Math.random
  let randomCalls = 0
  let frame = 0
  let spawns = []
  const trace = (kind, args) => {
    if (spawns.length < MAX_SPAWNS) spawns.push(`${frame} ${kind} ${randomCalls} ${JSON.stringify(clean(args))}`)
  }
  const seededFor = (id, option) => {
    const next = GoldenTool.createSeededRandom(parseInt(GoldenTool.hashText(`${id}:${option}`), 16))
    randomCalls = 0
    Math.random = () => {
      randomCalls++
      return next()
    }
  }
  const silence = () => {
    X.renderer.render = () => {}
  }
  const original = {}
  const wrapFunction = (name) => {
    original[name] = X[name]
    X[name] = (...args) => {
      trace(name, args)
      return original[name](...args)
    }
  }
  const wrapSpawn = (pool, label) => {
    const spawn = pool.spawn.bind(pool)
    pool.spawn = (options) => {
      trace(label, [options])
      return spawn(options)
    }
    return () => {
      pool.spawn = spawn
    }
  }
  const restores = [wrapSpawn(X.addP, 'add'), wrapSpawn(X.norP, 'normal'), wrapSpawn(X.streak, 'streak')]
  for (const name of ['debris', 'decal', 'ring', 'flash']) wrapFunction(name)
  silence()
  X.auto = false

  const screenState = () => Object.values(X.S).map(round4).join(' ')
  const counts = () => [X.addP.n, X.norP.n, X.streak.n, X.DB.filter((d) => d.on).length, X.DC.filter((d) => d.on).length, X.RG.filter((d) => d.on).length, X.LP.filter((l) => l.L.intensity > 0).length]
  const instantOf = (id, option, seconds) => {
    recorder.record('instant', {
      id,
      option,
      seconds,
      counts: counts().join('/'),
      add: poolHash(X.addP, [['pos', 3], ['vel', 3], ['c0', 3], ['c1', 3], ['life', 1], ['max', 1], ['s0', 1], ['gr', 1], ['a0', 1], ['g', 1], ['dr', 1], ['fi', 1], ['ds', 1]]),
      normal: poolHash(X.norP, [['pos', 3], ['vel', 3], ['c0', 3], ['c1', 3], ['life', 1], ['max', 1], ['s0', 1], ['gr', 1], ['a0', 1], ['g', 1], ['dr', 1], ['fi', 1], ['ds', 1]]),
      streak: poolHash(X.streak, [['p', 3], ['v', 3], ['life', 1], ['len', 1]]),
      debris: GoldenTool.hashText(X.DB.filter((d) => d.on).map((d) => [d.x, d.y, d.z, d.sx, d.life, d.rest ? 1 : 0].map(round4).join(',')).join('|')),
      decals: GoldenTool.hashText(X.DC.filter((d) => d.on).map((d) => [d.x, d.y, d.z, d.sx, d.sy, d.t, d.life].map(round4).join(',')).join('|')),
      screen: screenState(),
    })
  }

  const recordEffect = (effect, option) => {
    seededFor(effect.id, option)
    X.pr = option
    X.select(effect.id, true)
    const seconds = effect.loop > 0 ? effect.loop : DEFAULT_SECONDS
    const frames = Math.round(seconds * 60) - 1
    frame = 0
    spawns = []
    const timeline = []
    for (frame = 1; frame <= frames; frame++) {
      GoldenTool.stepFrames(1, FRAME_MS)
      timeline.push(counts().join('.'))
      if (INSTANT_FRAMES.includes(frame)) instantOf(effect.id, option, round4(frame / 60))
    }
    instantOf(effect.id, option, round4(frames / 60))
    recorder.record('spawns', { id: effect.id, option, count: spawns.length, list: spawns })
    recorder.record('frames', { id: effect.id, option, counts: timeline.join(' ') })
  }

  const recordFilm = (option) => {
    const effect = X.FX.find((entry) => entry.id === 'fluidos')
    seededFor('fluidos', option)
    let launches = 0
    original.fLaunch = X.fLaunch
    X.fLaunch = (...args) => {
      launches++
      return original.fLaunch(...args)
    }
    X.pr = option
    X.select('fluidos', true)
    const wet = () => {
      let cells = 0
      for (let i = 0; i < X.fh.length; i++) if (X.fh[i] > 0.035) cells++
      return cells
    }
    let elapsed = 0
    for (const seconds of FILM_INSTANTS) {
      const target = Math.round(seconds * 60)
      GoldenTool.stepFrames(target - elapsed, FRAME_MS)
      elapsed = target
      recorder.record('film', { id: effect.id, option, seconds, h: hashArray(X.fh, X.fh.length), dry: hashArray(X.fdry, X.fdry.length), wet: wet(), launches })
    }
    X.fLaunch = original.fLaunch
  }

  if (mode === 'fluids') {
    for (let option = 0; option < 4; option++) recordFilm(option)
  } else {
    for (const effect of X.FX) {
      if (SKIPPED.has(effect.id)) continue
      const options = effect.param ? effect.param.opts.length : 1
      for (let option = 0; option < options; option++) recordEffect(effect, option)
    }
  }
  for (const [name, fn] of Object.entries(original)) X[name] = fn
  for (const restore of restores) restore()
  Math.random = nativeRandom
  return GoldenTool.createGoldenRecord({ name: mode === 'fluids' ? 'vfx-workshop-fluids' : 'vfx-workshop', seed: 0, events: recorder.events(), scenes: {} })
})()
