/**
 * Names of the seeded random streams.
 *
 * These strings come from the Portuguese-language SDK this engine replaces. They are kept
 * verbatim on purpose: a stream is `hash(seed + '|' + name)`, so renaming one would change every
 * plan generated from an existing seed. They never appear in the output.
 */
export const STREAM = {
  facade: 'fachada',
  lot: 'lote',
  decor: 'decor',
  roomPrefix: 'c:',
  palettePrefix: 'paleta:',
} as const
