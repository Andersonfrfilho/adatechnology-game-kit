/**
 * How well a bullet cuts through for its energy (`Hit.piercing`, the 6th argument of `shoot`). The material's `penetration` is joules per
 * millimetre for a hard bullet; soft lead deforms on steel and concrete and a core of hardened steel does better. A host that knows the kind
 * of the bullet (`CaliberDef.kind` of `@adatechnology/game-weapons`) takes the number from here, or replaces the tables with its own.
 *
 * Reference: a 12 ga slug (3000 J) does not go through 8 mm of mild steel, a .50 BMG (18000 J) goes through 20 mm and more.
 */
export const PIERCING_BY_KIND: Readonly<Record<string, number>> = {
  fmj: 1, hp: 0.6, ap: 1.6, buck: 0.5, slug: 0.25, birdshot: 0.3, rimfire: 1, arrow: 1, bolt: 1,
}

/** Caliber ids whose bullet is lighter on the target than its kind says (a soft-core 5.56 ball does not go through a steel flange). */
export const PIERCING_BY_CALIBER: Readonly<Record<string, number>> = { '5_56x45': 0.5, '5_45x39': 0.5, '22lr': 0.5 }

export const piercingOf = (caliber: string, kind?: string): number => PIERCING_BY_CALIBER[caliber] ?? PIERCING_BY_KIND[kind ?? 'fmj'] ?? 1
