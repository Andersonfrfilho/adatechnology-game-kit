import { OrderedPool } from '../pool'

/** Shrapnel, sparks and embers, stretched along their velocity by the shader (L239-293). `kind`: 0 hot fragment, 1 steel ball, 2 white spark, 3 glass, 4 slow ember. */
export interface Spark {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  t: number
  life: number
  w: number
  st: number
  kind: number
  drag: number
  g: number
  bounce: number
  age: number
}

export type SparkInit = Partial<Omit<Spark, 't' | 'age'>>

const GROUND_LIFT = 0.02
const BOUNCE_SLIDE = 0.55

export function createSparkPool(capacity: number): OrderedPool<Spark> {
  return new OrderedPool<Spark>(capacity, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, life: 0.8, w: 0.04, st: 0.035, kind: 0, drag: 0.6, g: 9.8, bounce: 0.35, age: 0 }))
}

export function spawnSpark(pool: OrderedPool<Spark>, init: SparkInit): Spark {
  const spark = pool.acquire()
  spark.x = init.x ?? 0
  spark.y = init.y ?? 0
  spark.z = init.z ?? 0
  spark.vx = init.vx ?? 0
  spark.vy = init.vy ?? 0
  spark.vz = init.vz ?? 0
  spark.t = 0
  spark.life = init.life ?? 0.8
  spark.w = init.w ?? 0.04
  spark.st = init.st ?? 0.035
  spark.kind = init.kind ?? 0
  spark.drag = init.drag ?? 0.6
  spark.g = init.g ?? 9.8
  spark.bounce = init.bounce ?? 0.35
  spark.age = 0
  return spark
}

function ageOrKeep(spark: Spark, dt: number): boolean {
  spark.t += dt
  return spark.t < spark.life
}

export interface SparkStep {
  readonly dt: number
  readonly groundAt: (x: number, z: number) => number
}

/** `updateSparks` (L277-293): drag, gravity, a bounce that kills some speed on the ground. */
export function updateSparks(pool: OrderedPool<Spark>, step: SparkStep): void {
  pool.compact(ageOrKeep, step.dt)
  for (const spark of pool.items) {
    const damping = Math.exp(-spark.drag * step.dt)
    spark.vx *= damping
    spark.vy *= damping
    spark.vz *= damping
    spark.vy -= spark.g * step.dt
    spark.x += spark.vx * step.dt
    spark.y += spark.vy * step.dt
    spark.z += spark.vz * step.dt
    const floor = step.groundAt(spark.x, spark.z) + GROUND_LIFT
    if (spark.y < floor) {
      spark.y = floor
      if (spark.vy < 0) {
        spark.vy *= -spark.bounce
        spark.vx *= BOUNCE_SLIDE
        spark.vz *= BOUNCE_SLIDE
      }
    }
    spark.age = spark.t / spark.life
  }
}
