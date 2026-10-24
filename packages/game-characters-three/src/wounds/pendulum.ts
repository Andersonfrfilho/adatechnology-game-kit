/** The numbers of the Elenco's swinging arm (`pends`, line 593). */
export const PENDULUM = {
  /** Spring toward the pose of the body: `-26 (angle + base)`. */
  spring: 26,
  /** Damping: `-1.8 v`. */
  damping: 1.8,
  /** Angular speed the blow gives the arm. */
  kick: 6,
  /** Sway added while the body walks: `sin(2 phase) * 9`. */
  walkSway: 9,
  /** Sideways swing of the node: `sin(3 angle) * 0.12`; a shoulder also keeps its side * 0.12. */
  sideSwing: 0.12,
  /** The forearm of a broken shoulder hangs at this angle. */
  forearmHang: -0.05,
} as const

export type Pendulum = {
  /** The group that swings (the upper arm of a broken shoulder, the forearm of a broken elbow). */
  readonly node: { rotation: { x: number; z: number } }
  readonly kind: 'shoulder' | 'elbow'
  /** The side of the arm, +1 or -1. */
  readonly side: number
  /** The forearm of a broken shoulder, pulled to `forearmHang`. */
  readonly forearm?: { rotation: { x: number } }
  a: number
  v: number
}

export const createPendulum = (node: Pendulum['node'] & { rotation: { x: number } }, kind: Pendulum['kind'], side: number, forearm?: Pendulum['forearm']): Pendulum => ({
  node,
  kind,
  side,
  ...(forearm ? { forearm } : {}),
  a: node.rotation.x,
  v: PENDULUM.kick,
})

/** One step: `base` is the angle the body carries the arm at (the spine and figure lean, plus the shoulder for an elbow); `walkPhase` sways it while walking. */
export const stepPendulum = (pendulum: Pendulum, base: number, dt: number, walkPhase?: number): void => {
  const acceleration = -PENDULUM.spring * (pendulum.a + base) - PENDULUM.damping * pendulum.v + (walkPhase === undefined ? 0 : Math.sin(walkPhase * 2) * PENDULUM.walkSway)
  pendulum.v += acceleration * dt
  pendulum.a += pendulum.v * dt
  pendulum.node.rotation.x = pendulum.a
  pendulum.node.rotation.z = (pendulum.kind === 'shoulder' ? pendulum.side * PENDULUM.sideSwing : 0) + Math.sin(pendulum.a * 3) * PENDULUM.sideSwing
  if (pendulum.kind === 'shoulder' && pendulum.forearm) pendulum.forearm.rotation.x = PENDULUM.forearmHang
}
