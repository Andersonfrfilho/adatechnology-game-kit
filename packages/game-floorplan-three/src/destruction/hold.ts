import { embedmentStrength } from '@adatechnology/game-destruction';
import type { JointKind } from '@adatechnology/game-contracts';

/** Metres a piece may stand off what holds it and still be on it (the drawing's tolerance). */
export const HOLD_TOUCH = 0.05;
/** Top of the terrain the house's spec lays (`toDestructibleSpec`: the ground is y = 0 in the house's space). */
export const TERRAIN_TOP = 0;

/** A piece's footprint and foot in the house's space: `aabb` is [u0, v0, u1, v1], `y0` its lowest point. */
export interface Footing {
  readonly aabb: readonly number[];
  readonly y0: number;
}

/** The buried base a piece declares when its drawing stops at the surface (a pole drawn from the ground up): metres deep and across. */
export interface Embedment {
  readonly depth: number;
  readonly width: number;
}

/** Height of the terrain under a piece: the lowest of its footprint's four corners (a lot may slope; the house's terrain is flat, `TERRAIN_TOP`). */
export function terrainUnder(part: Footing, heightAt: (u: number, v: number) => number = () => TERRAIN_TOP): number {
  const [u0 = 0, v0 = 0, u1 = 0, v1 = 0] = part.aabb;
  return Math.min(heightAt(u0, v0), heightAt(u1, v0), heightAt(u0, v1), heightAt(u1, v1));
}

/** Whether a piece stands on the ground or in it: its foot at the terrain (within `HOLD_TOUCH`) or below it. A buried foot is anchored, never floating. */
export function standsOnGround(part: Footing, terrain: number = terrainUnder(part)): boolean {
  return part.y0 <= terrain + HOLD_TOUCH;
}

/**
 * The base a piece has in the ground: the depth it is drawn below the terrain, or what it declares (`embedment`) when that is deeper; across, the wider side of its
 * footprint (the buried face that holds it against a push across its thin side, how a wall or a post falls) unless it declares its own.
 */
export function buriedBase(part: Footing & { readonly embedment?: Embedment }, terrain: number = terrainUnder(part)): Embedment {
  const [u0 = 0, v0 = 0, u1 = 0, v1 = 0] = part.aabb;
  const drawn = Math.max(0, terrain - part.y0);
  const declared = part.embedment;
  return { depth: Math.max(drawn, declared?.depth ?? 0), width: declared?.width ?? Math.max(u1 - u0, v1 - v0) };
}

/** Hit points of the joint that sets a piece in the ground with `kind`: as strong as its buried base holds in the soil (`embedmentStrength`); none buried, the kind's own. */
export function groundJointStrength(part: Footing & { readonly embedment?: Embedment }, kind: JointKind): number | undefined {
  const base = buriedBase(part);
  return base.depth > 0 ? embedmentStrength(kind, base) : undefined;
}
