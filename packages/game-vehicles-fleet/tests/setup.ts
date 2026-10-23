// three.js warns when a fake canvas texture is serialised; the tests never need that text.
const warn = console.warn
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('Unable to serialize Texture')) return
  warn(...args)
}

// Let the worker answer vitest's reports between the (long, synchronous) builds of the golden tests.
import { afterEach } from 'vitest'
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))
