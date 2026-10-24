// The ESM entry adds the node-only helpers; the page bundle (browser.ts) must not load `node:vm`.
export * from './browser'
export { cutLiteral, evaluateLiteral, extractLiteral } from './cut-literal'
