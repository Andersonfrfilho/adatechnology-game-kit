/* global GoldenTool */
// Capture for the Galeria 3D do Arsenal, tab "Desmembramento": the zombie with 11 segments and its damage rules (`damage`, `sever`, `explodeSeg`,
// `splitTorso`, `legLost`, `kill`, `grenadeAt`, the bleeders), run by the page's own code. `window.__team` is the page's closure, exposed by
// the patch in `record-golden-chrome.ts`. Every scenario starts from a fresh zombie and reseeds `Math.random`.
// Params: seed. Events carry the damage text, the state of the zombie and its bleeders; the gore geometry (splats, particles) is not recorded.
(() => {
  const { seed } = globalThis.__GOLDEN_PARAMS
  const team = globalThis.__team
  const { T, ZW, damage, grenadeAt, show, buildZombie } = team
  const recorder = GoldenTool.createEventRecorder()
  const TYPES = ['head', 'jaw', 'neck', 'torso', 'pelvis', 'upperArm', 'forearm', 'hand', 'thigh', 'shin', 'foot']
  const WEAPONS = ['pistola', 'fuzil', 'escopeta', 'cinquenta']
  const MAX_HITS = 8
  const DISTANCES = [0.5, 1, 1.5, 2]
  let counter = 0

  const fresh = () => {
    Math.random = GoldenTool.createSeededRandom(Number(seed) * 100000 + ++counter)
    show(buildZombie(), new T.Vector3(0.8, 0.35, 1))
    team.Z.pools = []
    team.Z.root.updateMatrixWorld(true)
    return team.Z
  }
  const bleeders = (Z) => Z.bleeders.map((bleeder) => [bleeder.rate, bleeder.dur, bleeder.spurt ? 1 : 0])
  const state = (Z) => ({
    life: Z.life,
    alive: Z.alive,
    state: Z.state,
    limp: Z.limp ?? 0,
    why: Z.why ?? '',
    attached: Z.segs.map((segment) => (segment.attached ? 1 : 0)).join(''),
    hp: Z.segs.map((segment) => segment.hp),
    bleeders: bleeders(Z),
  })
  const DIRECTION = () => new T.Vector3(0, 0, -1)
  const NORMAL = () => new T.Vector3(0, 0, 1)

  for (const weapon of WEAPONS) {
    const w = ZW[weapon]
    for (const type of TYPES) {
      for (const side of type === 'head' || type === 'jaw' || type === 'neck' || type === 'torso' || type === 'pelvis' ? [0] : [1, -1]) {
        for (const withPoint of weapon === 'fuzil' ? [false, true] : [false]) {
          const Z = fresh()
          const segment = Z.segs.find((candidate) => candidate.type === type && candidate.side === side)
          const id = `${weapon}_${type}${side === 0 ? '' : side > 0 ? '_L' : '_R'}${withPoint ? '_point' : ''}`
          recorder.record('start', { scenario: id, ...state(Z) })
          for (let hit = 1; hit <= MAX_HITS && segment.attached && Z.alive; hit++) {
            let text = ''
            for (let pellet = 0; pellet < w.pel; pellet++) {
              const point = withPoint ? segment.g.getWorldPosition(new T.Vector3()) : null
              text = damage(segment, w.dmg, DIRECTION(), point, withPoint ? NORMAL() : null, weapon === 'cinquenta') ?? text
            }
            recorder.record('hit', { scenario: id, hit, text, segmentHp: segment.hp, attachedSegment: segment.attached, ...state(Z) })
          }
        }
      }
    }
  }

  for (const distance of DISTANCES) {
    for (const aim of ['pelvis', 'head', 'foot']) {
      const Z = fresh()
      const target = Z.segs.find((candidate) => candidate.type === aim && candidate.side <= 0)
      const point = target.g.getWorldPosition(new T.Vector3()).add(new T.Vector3(distance, 0, 0))
      grenadeAt(point)
      recorder.record('grenade', { scenario: `grenade_${aim}_${distance}`, distance, ...state(Z) })
    }
  }
  return GoldenTool.createGoldenRecord({ name: 'arsenal-damage-segments', seed: Number(seed), events: recorder.events() })
})()
