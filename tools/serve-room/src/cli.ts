// The 4280: `node tools/serve-room/dist/cli.js [--port 4280] [--host 0.0.0.0] [--dir examples/test-room/dist] [--isolate[=require-corp|credentialless]]`.
// Without --isolate (or ROOM_ISOLATE) it serves exactly what python3 -m http.server did; with it, the page is cross-origin isolated.
import { resolve } from 'node:path'

import { ISOLATION, createRoomServer, isIsolation } from './index'
import type { Isolation } from './index'

const valueOf = (name: string): string | undefined => {
  const args = process.argv.slice(2)
  const inline = args.find((arg) => arg.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3)
  const at = args.indexOf(`--${name}`)
  const next = at >= 0 ? args[at + 1] : undefined
  return next && !next.startsWith('--') ? next : at >= 0 ? '' : undefined
}

const isolationOf = (raw: string | undefined): Isolation => {
  if (raw === undefined || raw === '0' || raw === ISOLATION.OFF) return ISOLATION.OFF
  if (raw === '' || raw === '1') return ISOLATION.REQUIRE_CORP
  if (isIsolation(raw)) return raw
  throw new Error(`--isolate takes require-corp or credentialless, got ${raw}`)
}

const port = Number(valueOf('port') ?? process.env.ROOM_PORT ?? 4280)
const host = valueOf('host') ?? process.env.ROOM_HOST ?? '0.0.0.0'
const root = resolve(valueOf('dir') ?? process.env.ROOM_DIR ?? 'examples/test-room/dist')
const isolation = isolationOf(valueOf('isolate') ?? process.env.ROOM_ISOLATE)

createRoomServer({ root, isolation }).listen(port, host, () => {
  console.log(`serve-room: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/ from ${root}, isolation ${isolation}`)
})
