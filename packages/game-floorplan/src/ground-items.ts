import { registerItems } from './registry'

/** Ground cover types the lot builder can draw. Colours come from the palette roles of the same purpose. */
export function registerGroundItems(): void {
  const flat = { category: 'ground_cover', w: 1, d: 1, h: 0, decor: true, mount: 'ground', flat: true } as const
  registerItems([
    { type: 'lawn', ...flat, color: { role: 'lawn' } },
    { type: 'tile_floor', ...flat, color: { role: 'exterior_floor' } },
    { type: 'concrete', ...flat, color: { role: 'exterior_floor' } },
    { type: 'deck_floor', ...flat, color: { role: 'deck_floor' } },
    { type: 'dirt', ...flat, color: { role: 'dirt' } },
  ])
}
