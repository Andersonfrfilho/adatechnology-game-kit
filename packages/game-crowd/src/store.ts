/**
 * The agents as a struct of arrays (G 66717 `Z`, ZMAX 6000): one typed array per field, the same types as the game so the floats round the same way.
 * The names are the game's in English; `armHp` and `legHp` hold two values per agent (left, right).
 */
export const createStore = (capacity: number) => {
  const f32 = () => new Float32Array(capacity)
  const u8 = () => new Uint8Array(capacity)
  return {
    n: 0,
    capacity,
    x: f32(),
    z: f32(),
    vx: f32(),
    vz: f32(),
    yaw: f32(),
    phase: f32(),
    type: u8(),
    age: u8(),
    outfit: u8(),
    height: f32(),
    build: f32(),
    chaseSpeed: f32(),
    wanderSpeed: f32(),
    hp: f32(),
    hpMax: f32(),
    headHp: f32(),
    armHp: new Float32Array(capacity * 2),
    legHp: new Float32Array(capacity * 2),
    missing: new Uint16Array(capacity),
    helmet: u8(),
    state: u8(),
    stateTimer: f32(),
    lost: f32(),
    attackTimer: f32(),
    band: u8(),
    next: f32(),
    wx: f32(),
    wz: f32(),
    crawl: u8(),
    limp: u8(),
    color: new Uint32Array(capacity),
    skin: f32(),
    alertIn: f32(),
    cooldown: f32(),
    y: f32(),
    floor: u8(),
    floorLocked: u8(),
    vy: f32(),
    abilityTimer: f32(),
    eaten: u8(),
    stuck: f32(),
    stepCell: new Int32Array(capacity),
    burn: f32(),
    hunts: new Int8Array(capacity),
    named: new Int8Array(capacity),
    dvx: f32(),
    dvz: f32(),
    steering: u8(),
    renderYaw: f32(),
    renderSpeed: f32(),
    pause: f32(),
    lod: u8(),
    variant: u8(),
    attackPose: u8(),
    arms: f32(),
  }
}
export type CrowdStore = ReturnType<typeof createStore>
type Arrays = Omit<CrowdStore, 'n' | 'capacity' | 'armHp' | 'legHp'>
/** The one-per-agent fields (G 66733 `FIELDS`): what a removal copies from the last agent. */
export const AGENT_FIELDS = [
  'x', 'z', 'vx', 'vz', 'yaw', 'phase', 'type', 'age', 'outfit', 'height', 'build', 'chaseSpeed', 'wanderSpeed', 'hp', 'hpMax', 'headHp', 'missing', 'helmet', 'state', 'stateTimer', 'lost', 'attackTimer',
  'band', 'next', 'wx', 'wz', 'crawl', 'limp', 'color', 'skin', 'alertIn', 'cooldown', 'y', 'floor', 'floorLocked', 'vy', 'abilityTimer', 'eaten', 'stuck', 'stepCell', 'burn', 'hunts', 'named', 'dvx', 'dvz',
  'steering', 'renderYaw', 'renderSpeed', 'pause', 'lod', 'variant', 'attackPose', 'arms',
] as const satisfies readonly (keyof Arrays)[]
