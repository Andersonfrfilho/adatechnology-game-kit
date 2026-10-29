#!/usr/bin/env node
// MCP server of the kit (stdio, JSON-RPC 2.0, no dependencies): answers which SDK owns a kind of piece, where a piece of the code came from,
// and which pieces are drawn by hand outside their SDK. Registered for Claude Code in the root .mcp.json as `game-kit`.
//
//   kit_owner   { piece }                       which package gives a car, a wall, a table... and how to use it
//   kit_origin  { text, path? }                 the commit (and PR) that brought a name or a piece of code into the repository
//   kit_audit   { package?, domain?, all? }     the hand-drawn pieces outside their SDK (tools/kit-audit/audit.mjs)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { audit, group, wordsOf } from './audit.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const rules = JSON.parse(readFileSync(join(here, 'rules.json'), 'utf8'))

const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
  } catch {
    return ''
  }
}

function owner({ piece }) {
  const words = wordsOf(String(piece ?? ''))
  const matches = Object.entries(rules.domains)
    .filter(([domain, rule]) => words.has(domain) || rule.words.some((word) => words.has(word)))
    .map(([domain, rule]) => ({ domain, owners: rule.owners, use: rule.use }))
  return matches.length > 0 ? { piece, matches } : { piece, matches: [], note: 'No domain of tools/kit-audit/rules.json names this piece: look it up in .claude/skills/game-kit/SKILL.md, then ask before drawing it.' }
}

function origin({ text, path }) {
  const needle = String(text ?? '')
  if (!needle) throw new Error('text is required')
  const scope = path ? ['--', String(path)] : []
  const shallow = git('rev-parse', '--is-shallow-repository') === 'true'
  const first = git('log', '--reverse', '--format=%H%x09%ad%x09%an%x09%s', '--date=short', '-S', needle, ...scope).split('\n').find(Boolean)
  if (!first) return { text: needle, found: false, shallow, note: shallow ? 'The clone is shallow: fetch more history (git fetch --depth=2000 origin main) and ask again.' : 'No commit adds this text.' }
  const [sha, date, author, subject] = first.split('\t')
  // the first merge of a pull request that carries the commit
  const merge = git('log', '--merges', '--ancestry-path', '--reverse', '--format=%s', `${sha}..HEAD`)
    .split('\n')
    .find((line) => /pull request #\d+/.test(line))
  const pr = merge?.match(/#(\d+)/)?.[1]
  const files = git('show', '--format=', '--name-only', sha).split('\n').filter(Boolean).slice(0, 20)
  return { text: needle, found: true, shallow, commit: sha.slice(0, 10), date, author, subject, ...(pr ? { pullRequest: Number(pr), mergedBy: merge } : {}), files }
}

function auditTool({ package: pkg, domain, all }) {
  const grouped = group(audit({ packages: pkg ? [pkg] : [], domains: domain ? [domain] : [] }))
  const shown = all ? grouped : grouped.filter((entry) => !entry.allowed)
  return { findings: shown, counts: { new: grouped.filter((e) => !e.allowed && !e.pending).length, pending: grouped.filter((e) => !e.allowed && e.pending).length, allowed: grouped.filter((e) => e.allowed).length } }
}

const TOOLS = [
  {
    name: 'kit_owner',
    description: 'Which SDK of the game kit owns a kind of piece (car, wall, table, person, tree, item, weapon) and how to build it from there. Use before drawing any piece.',
    inputSchema: { type: 'object', properties: { piece: { type: 'string', description: 'The piece, in English or Portuguese (e.g. "carro queimado", "brick wall", "mesa").' } }, required: ['piece'] },
    run: owner,
  },
  {
    name: 'kit_origin',
    description: 'Where a piece of the kit came from: the first commit that added a name or a piece of code, its author, date, subject, the pull request that merged it and the files it touched.',
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'A name or a piece of code, e.g. "weather-lamp-rig" or "brickWallSpec".' }, path: { type: 'string', description: 'Optional path to limit the search.' } }, required: ['text'] },
    run: origin,
  },
  {
    name: 'kit_audit',
    description: 'The pieces drawn by hand (three.js primitives or box parts) in a package that does not own them, with the SDK that should give each one. New findings, known pending ones and (with all) the allowed ones.',
    inputSchema: { type: 'object', properties: { package: { type: 'string' }, domain: { type: 'string', enum: Object.keys(rules.domains) }, all: { type: 'boolean' } } },
    run: auditTool,
  },
]

const send = (message) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`)

function handle(request) {
  const { id, method, params } = request
  if (id === undefined) return // a notification (initialized, cancelled): nothing to answer
  if (method === 'initialize') {
    return send({ id, result: { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'game-kit', version: '0.1.0' } } })
  }
  if (method === 'ping') return send({ id, result: {} })
  if (method === 'tools/list') return send({ id, result: { tools: TOOLS.map(({ run, ...tool }) => tool) } })
  if (method === 'tools/call') {
    const tool = TOOLS.find((t) => t.name === params?.name)
    if (!tool) return send({ id, error: { code: -32602, message: `unknown tool ${params?.name}` } })
    try {
      const result = tool.run(params.arguments ?? {})
      return send({ id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } })
    } catch (error) {
      return send({ id, result: { content: [{ type: 'text', text: String(error?.message ?? error) }], isError: true } })
    }
  }
  return send({ id, error: { code: -32601, message: `method not found: ${method}` } })
}

createInterface({ input: process.stdin }).on('line', (line) => {
  if (!line.trim()) return
  let request
  try {
    request = JSON.parse(line)
  } catch {
    return send({ id: null, error: { code: -32700, message: 'parse error' } })
  }
  handle(request)
})
