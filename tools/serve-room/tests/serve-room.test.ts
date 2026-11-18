import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ISOLATION, createRoomServer, fileOf, isolationHeaders } from '../src/index'
import type { Isolation } from '../src/index'

const root = mkdtempSync(join(tmpdir(), 'serve-room-'))
mkdirSync(join(root, 'area'))
writeFileSync(join(root, 'test-room.html'), '<!doctype html>room')
writeFileSync(join(root, 'area/index.html'), 'area')
writeFileSync(join(root, 'jolt.js'), 'export default 1')

const servers: { close(): void }[] = []
const start = async (isolation: Isolation): Promise<string> => {
  const server = createRoomServer({ root, isolation })
  servers.push(server)
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

describe('serve-room', () => {
  let plain = ''
  let isolated = ''
  beforeAll(async () => {
    plain = await start(ISOLATION.OFF)
    isolated = await start(ISOLATION.REQUIRE_CORP)
  })
  afterAll(() => {
    for (const server of servers) server.close()
  })

  it('serves the files with no isolation header by default, as the old server did', async () => {
    const response = await fetch(`${plain}/test-room.html?area=floorplan`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(await response.text()).toBe('<!doctype html>room')
    expect(response.headers.get('cross-origin-opener-policy')).toBeNull()
    expect(response.headers.get('cross-origin-embedder-policy')).toBeNull()
  })

  it('sends COOP and COEP on every response when isolated, the script and the folder index too', async () => {
    for (const path of ['/test-room.html', '/jolt.js', '/area/']) {
      const response = await fetch(`${isolated}${path}`)
      expect(response.status).toBe(200)
      expect(response.headers.get('cross-origin-opener-policy')).toBe('same-origin')
      expect(response.headers.get('cross-origin-embedder-policy')).toBe('require-corp')
      expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin')
    }
    expect((await fetch(`${isolated}/jolt.js`)).headers.get('content-type')).toContain('text/javascript')
  })

  it('answers 404 for a missing file and never leaves the root', async () => {
    expect((await fetch(`${plain}/nope.html`)).status).toBe(404)
    expect(fileOf(root, '/../../etc/passwd')).toBe(join(root, 'etc/passwd'))
    expect(fileOf(root, '/%2e%2e/secret')).toBe(join(root, 'secret'))
    expect(fileOf(root, '/%E0%A4%A')).toBeUndefined()
  })

  it('offers credentialless as the other embedder policy', () => {
    expect(isolationHeaders(ISOLATION.CREDENTIALLESS)['Cross-Origin-Embedder-Policy']).toBe('credentialless')
    expect(isolationHeaders(ISOLATION.OFF)).toEqual({})
  })
})
