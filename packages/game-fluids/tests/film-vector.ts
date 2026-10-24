/** Mutable vector with the arithmetic of the pages' three.js r128 (`normalize` multiplies by `1 / length`), so a replay rounds the same way. */
export class Vector {
  constructor(
    public x = 0,
    public y = 0,
    public z = 0,
  ) {}
  clone(): Vector {
    return new Vector(this.x, this.y, this.z)
  }
  add(other: Vector): this {
    this.x += other.x
    this.y += other.y
    this.z += other.z
    return this
  }
  multiplyScalar(scalar: number): this {
    this.x *= scalar
    this.y *= scalar
    this.z *= scalar
    return this
  }
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z)
  }
  normalize(): this {
    return this.multiplyScalar(1 / (this.length() || 1))
  }
  toArray(): [number, number, number] {
    return [this.x, this.y, this.z]
  }
}
