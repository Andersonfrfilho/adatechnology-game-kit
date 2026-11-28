// The water the furniture runs in the room: a tap as far as its handle is turned, a shower by its valve, a toilet's flush for its seconds once the button goes
// down. The room moves the parts itself (the leaf and the clips of each part) and has no interactables world, so this reads how far each handle part has
// moved from where it was built (`createFixtureEmitters` of game-interactables says which emitters run and how hard) and draws them with the kit's effects
// (`createEffects` of game-interactables-three: the stream, the drops and the splash, kept inside the bowl the piece says).
//
// A piece is followed from the moment it is built until it leaves the scene: a piece no longer in the scene is forgotten (CLAUDE.md "Memória").

/** @typedef {import('@adatechnology/game-interactables').ObjectSpec} ObjectSpec */
/** @typedef {import('@adatechnology/game-interactables').Motion} Motion */
/** @typedef {import('@adatechnology/game-interactables').ActiveEmitter} ActiveEmitter */
/** @typedef {import('@adatechnology/game-interactables').FixtureEmitters} FixtureEmitters */
/** @typedef {import('@adatechnology/game-interactables-three').ThreeLib} ThreeLib */
/** @typedef {import('@adatechnology/game-contracts').ModuleHost} ModuleHost */
/** @typedef {{ node: import('three').Object3D; motion: Motion; position: import('three').Vector3; quaternion: import('three').Quaternion }} HandlePart */
/** @typedef {{ group: import('three').Object3D; spec: ObjectSpec; driver: FixtureEmitters; handles: Map<string, HandlePart> }} Followed */

/**
 * @param {{ createFixtureEmitters: (spec: ObjectSpec) => FixtureEmitters; createEffects: typeof import('@adatechnology/game-interactables-three').createEffects }} kit
 */
export function createFixtureStreams(kit) {
  /** @type {Followed[]} */
  let followed = []
  let serial = 0

  /**
   * How far a handle part has moved from where it was built, 0 to 1 of its motion.
   * @param {HandlePart} h
   */
  const openingOf = (h) => {
    const m = h.motion
    if (m.kind === 'slide') return m.distance ? h.node.position.distanceTo(h.position) / Math.abs(m.distance) : 0
    if (m.kind === 'hinge' || m.kind === 'knob' || m.kind === 'rocker') {
      const w = Math.min(1, Math.abs(h.quaternion.dot(h.node.quaternion)))
      return m.angle ? (2 * Math.acos(w)) / Math.abs(m.angle) : 0
    }
    return 0
  }

  return {
    /**
     * Follows a piece just built: its handle parts as they stand now (closed), and the emitters they run.
     * @param {import('three').Object3D} group
     * @param {ObjectSpec} spec
     * @param {Record<string, import('three').Object3D>} parts the part nodes the room moves, by household part id
     */
    track(group, spec, parts) {
      const driver = kit.createFixtureEmitters(spec)
      if (!driver.runs) return
      /** @type {Map<string, HandlePart>} */
      const handles = new Map()
      for (const fixture of spec.fixtures ?? []) {
        const part = fixture.part ? (spec.parts ?? []).find((p) => p.id === fixture.part) : undefined
        const node = part ? parts[part.id] : undefined
        if (!part || !node) continue
        handles.set(part.id, { node, motion: part.motion, position: node.position.clone(), quaternion: node.quaternion.clone() })
      }
      group.userData.fixtureStreams = ++serial
      followed.push({ group, spec, driver, handles })
    },

    /**
     * Draws the running water every frame, in the host's scene.
     * @param {ModuleHost} host
     * @returns {() => void}
     */
    attach(host) {
      const THREE = /** @type {ThreeLib} */ (host.THREE)
      const scene = /** @type {import('three').Object3D} */ (host.scene)
      const effects = kit.createEffects(THREE, { scene, camera: /** @type {import('three').PerspectiveCamera} */ (host.camera), document: globalThis.document })
      const p = new THREE.Vector3()
      const d = new THREE.Vector3()
      /** @param {import('three').Object3D} o */
      const inScene = (o) => {
        for (let n = /** @type {import('three').Object3D | null} */ (o); n; n = n.parent) if (n === scene) return true
        return false
      }
      /** @type {ActiveEmitter[]} */
      const active = []
      const off = host.onFrame((dt) => {
        active.length = 0
        // what left the scene (cleared, broken, taken away) is forgotten; a piece only built to be measured never was in it
        followed = followed.filter((f) => inScene(f.group))
        for (const f of followed) {
          const running = f.driver.update(dt, (part) => {
            const h = f.handles.get(part)
            return h ? openingOf(h) : 0
          })
          if (running.length === 0) continue
          f.group.updateWorldMatrix(true, false)
          for (const { emitter, intensity } of running) {
            p.set(emitter.pos[0], emitter.pos[1], emitter.pos[2]).applyMatrix4(f.group.matrixWorld)
            const dir = emitter.dir ?? [0, -1, 0]
            d.set(dir[0], dir[1], dir[2]).transformDirection(f.group.matrixWorld)
            active.push({
              id: `${f.group.userData.fixtureStreams}:${emitter.id}`,
              object: String(f.group.userData.fixtureStreams),
              kind: emitter.kind,
              pos: [p.x, p.y, p.z],
              dir: [d.x, d.y, d.z],
              size: emitter.size ?? 0.05,
              ...(emitter.reach !== undefined ? { reach: emitter.reach } : {}),
              ...(emitter.bowl ? { bowl: emitter.bowl } : {}),
              intensity,
            })
          }
        }
        effects.update(dt, active)
      })
      const offClear = host.onClear?.(() => effects.clear())
      return () => {
        off()
        offClear?.()
        effects.dispose()
        followed = []
      }
    },
  }
}
