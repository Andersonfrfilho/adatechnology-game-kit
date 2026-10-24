import type * as THREE_NS from 'three'

/** The three.js namespace the host passes in: the package never imports three itself, so one script tag works. */
export type Three = typeof THREE_NS
export type { THREE_NS }
