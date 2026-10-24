import { installPortableMath } from '@adatechnology/golden-tool'

// Math.pow changed its last bit between Node 22 and 24; the goldens must not depend on the Node that runs them.
installPortableMath()

// three.js warns when a fake canvas texture is serialised; the tests never need that text.
const warn = console.warn
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('Unable to serialize Texture')) return
  warn(...args)
}
