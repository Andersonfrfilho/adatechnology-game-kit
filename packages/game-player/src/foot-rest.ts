/** Samples of the ground across the foot's disc, per radius: the disc is walked in rings of this many steps. */
const RINGS = 32
const SAMPLES_PER_RING = 48

/**
 * The height a round foot of `radius` comes to rest at over ground `heightAt` (the lower sphere of the capsule): the highest, over the points of the disc under it, of
 * the ground there less how far the sphere's underside rises above its lowest point at that distance. Flat ground gives its own height; a bowl holds the foot above its middle.
 */
export const footRestHeight = (heightAt: (x: number, z: number) => number, x: number, z: number, radius: number): number => {
  let rest = heightAt(x, z)
  for (let ring = 1; ring <= RINGS; ring++) {
    const distance = (radius * ring) / RINGS
    const lift = radius - Math.sqrt(radius * radius - distance * distance)
    for (let sample = 0; sample < SAMPLES_PER_RING; sample++) {
      const angle = (2 * Math.PI * sample) / SAMPLES_PER_RING
      rest = Math.max(rest, heightAt(x + distance * Math.cos(angle), z + distance * Math.sin(angle)) - lift)
    }
  }
  return rest
}
