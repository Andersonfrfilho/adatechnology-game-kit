/* global GoldenTool */
// Capture for the Elenco: the cut rule of the segment tree (`hit`, `sever`, `breakBone`, the BELOW/FALLS cascades, the broken-bone pendulum
// parameters, limp, crawl and death), run by the page's own code on the first character of the lineup. `window.__team` is the page's closure,
// exposed by the patch in `record-golden-chrome.ts`. Each scenario builds a fresh character and reseeds `Math.random` (one draw per hit).
(() => {
  const { seed } = globalThis.__GOLDEN_PARAMS
  const team = globalThis.__team
  const { THREE, build, hit, WEAPONS, NPCS } = team
  const recorder = GoldenTool.createEventRecorder()
  const IDS = ['head', 'torso', 'pelvis', 'uArm0', 'uArm1', 'fArm0', 'fArm1', 'hand0', 'hand1', 'thigh0', 'thigh1', 'shin0', 'shin1']
  const MAX_HITS = 10
  let counter = 0

  const meshOf = (character, id) => {
    let found = null
    character.root.traverse((object) => {
      if (!found && object.isMesh && object.userData.seg === id && !object.userData.stump) found = object
    })
    return found
  }
  const state = (character) => ({
    states: Object.entries(character.segs).map(([key, segment]) => `${key}:${segment.state}`).join(' '),
    hp: Object.values(character.segs).map((segment) => segment.hp),
    dead: character.dmg.dead,
    crawl: character.dmg.leg,
    limp: [...character.limp],
    pendulums: character.pends.map((pendulum) => [pendulum.kind, pendulum.arm, pendulum.a, pendulum.v]),
  })

  for (const weapon of WEAPONS) {
    team.setWeapon(weapon.id)
    for (const id of IDS) {
      Math.random = GoldenTool.createSeededRandom(Number(seed) * 100000 + ++counter)
      const character = build(NPCS[0], 0)
      character.root.updateMatrixWorld(true)
      const segment = character.segs[id]
      const mesh = meshOf(character, id)
      const point = (segment.node ?? mesh).getWorldPosition(new THREE.Vector3())
      const scenario = `${weapon.id}_${id}`
      recorder.record('start', { scenario, ...state(character) })
      for (let step = 1; step <= MAX_HITS && segment.state !== 'cut' && segment.state !== 'quebrado' && !(character.dmg.dead && id !== 'head'); step++) {
        hit(character, id, point.clone(), new THREE.Vector3(0, 0, 1), mesh)
        recorder.record('hit', { scenario, step, message: team.lastMessage, segmentHp: segment.hp, segmentState: segment.state, ...state(character) })
      }
    }
  }
  return GoldenTool.createGoldenRecord({ name: 'elenco-cut-hierarchy', seed: Number(seed), events: recorder.events() })
})()
