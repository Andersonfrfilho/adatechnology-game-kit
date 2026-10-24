/**
 * The kernel `K` is the closure the team's Casa3DSDK kept in one function: every installer of a module reads what the earlier ones
 * defined from it and adds what it defines (`Object.assign(K, ...)`). `Shared` holds the per-house state `enter(house)` swaps.
 * The modules are ported literally from the team's closure, so their inner values stay untyped; the public API (index.ts) is typed.
 */
export type Kernel = Record<string, any>
export type Shared = Record<string, any>
export type Installer = (K: Kernel, shared: Shared) => any
