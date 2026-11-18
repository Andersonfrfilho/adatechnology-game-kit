/**
 * A static server of a built page folder (the test room's `examples/test-room/dist`, served on the 4280). Off by default, the responses carry only the
 * content type, as `python3 -m http.server` did. With `isolation`, every response also carries the headers that make the page cross-origin isolated
 * (`crossOriginIsolated === true`: SharedArrayBuffer, so Jolt's multithreaded build), and the same-origin resource policy its own subresources need.
 * Symbolic links are followed (the room's dist links every other example's dist), but a request path never climbs out of the root.
 */
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'

/** `off`: no isolation headers (the default, the server as it always was). The others are the `Cross-Origin-Embedder-Policy` sent with COOP `same-origin`. */
export const ISOLATION = { OFF: 'off', REQUIRE_CORP: 'require-corp', CREDENTIALLESS: 'credentialless' } as const
export type Isolation = (typeof ISOLATION)[keyof typeof ISOLATION]

export const isIsolation = (value: string): value is Isolation => (Object.values(ISOLATION) as string[]).includes(value)

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
}

export const contentTypeOf = (path: string): string => CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'

/** The headers an isolation adds to every response; none when off. */
export const isolationHeaders = (isolation: Isolation): Readonly<Record<string, string>> =>
  isolation === ISOLATION.OFF
    ? {}
    : { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': isolation, 'Cross-Origin-Resource-Policy': 'same-origin' }

/** The file a request path names under `root`, or undefined when the path tries to leave it. A folder is answered by its `index.html`. */
export const fileOf = (root: string, requestUrl: string): string | undefined => {
  let pathname: string
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://local').pathname)
  } catch {
    return undefined
  }
  const relative = normalize(pathname).replace(/^([/\\])+/, '')
  if (relative.split(sep).includes('..')) return undefined
  return join(root, relative)
}

export type ServeRoomOptions = {
  readonly root: string
  readonly isolation?: Isolation
}

const send = (response: ServerResponse, status: number, headers: Readonly<Record<string, string>>, body?: string): void => {
  response.writeHead(status, { ...headers, 'Cache-Control': 'no-store' })
  response.end(body)
}

const answer = async (options: ServeRoomOptions, request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const extra = isolationHeaders(options.isolation ?? ISOLATION.OFF)
  if (request.method !== 'GET' && request.method !== 'HEAD') return send(response, 405, extra, 'method not allowed')
  const file = fileOf(options.root, request.url ?? '/')
  if (!file) return send(response, 400, extra, 'bad path')
  const found = await stat(file).catch(() => undefined)
  const target = found?.isDirectory() ? join(file, 'index.html') : file
  const info = found?.isDirectory() ? await stat(target).catch(() => undefined) : found
  if (!info?.isFile()) return send(response, 404, extra, 'not found')
  response.writeHead(200, { ...extra, 'Content-Type': contentTypeOf(target), 'Content-Length': String(info.size), 'Cache-Control': 'no-store' })
  if (request.method === 'HEAD') return void response.end()
  createReadStream(target).pipe(response)
}

export type RoomHandler = (request: IncomingMessage, response: ServerResponse) => void

/** The request handler on its own, for a server that answers some paths itself first (the desktop app's menu). */
export const createRoomHandler = (options: ServeRoomOptions): RoomHandler => (request, response) => {
  answer(options, request, response).catch(() => send(response, 500, isolationHeaders(options.isolation ?? ISOLATION.OFF), 'error'))
}

/** A server of `root` (not listening yet: call `listen`). */
export const createRoomServer = (options: ServeRoomOptions): Server => createServer(createRoomHandler(options))
