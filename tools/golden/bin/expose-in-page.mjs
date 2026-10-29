const INLINE_CLASSIC_SCRIPT = /<script(?![^>]*\btype=)[^>]*>([\s\S]*?)<\/script>/g
const IIFE_END = /\}\)\(\);?\s*$/

// The page keeps its functions inside an IIFE; this adds, at the end of that IIFE, accessors published on globalThis.GoldenExposed
// (the getter reads the binding, the setter writes it, so a capture can also swap a `let` such as the page's seeded random).
export function exposeInPage(html, names) {
  const scripts = [...html.matchAll(INLINE_CLASSIC_SCRIPT)].filter((match) => /^\s*\(function\s*\(/.test(match[1]) && IIFE_END.test(match[1]))
  const target = scripts.at(-1)
  if (!target) throw new Error('--expose: no inline script that is a single IIFE was found in the page')
  const accessors = names.map((name) => `${JSON.stringify(name)}:{get:()=>${name},set:(value)=>{${name}=value},enumerable:true}`).join(',')
  const publish = `;Object.defineProperties(globalThis.GoldenExposed=globalThis.GoldenExposed||{},{${accessors}});\n`
  const body = target[1].replace(IIFE_END, (end) => publish + end)
  return html.slice(0, target.index) + target[0].replace(target[1], () => body) + html.slice(target.index + target[0].length)
}
