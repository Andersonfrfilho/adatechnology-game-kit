/** A custom generator both threads register: a few seeded boxes. */
export const rocks = (params, ctx) => ({
  kind: 'group',
  children: Array.from({ length: params.count }, () => ({ kind: 'box', size: [ctx.random() * 0.3 + 0.1, 0.1, 0.2], position: [ctx.random(), 0, ctx.random()], material: 'stone' })),
})
