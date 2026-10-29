# kit-audit

Finds the pieces drawn by hand outside the SDK that owns them: a three.js primitive (`new THREE.BoxGeometry(...)` and the like) or a
`box`/`cylinder` part of a destructible spec, in a package or example that does not own that kind of piece, when the code around it names the
piece (a car outside `game-vehicles`, a wall outside `game-floorplan`, a table outside the household catalogue, a person outside
`game-characters`...). It is the check of the CLAUDE.md rule "Nada desenhado à mão quando o kit já tem".

```sh
node tools/kit-audit/audit.mjs                      # report
node tools/kit-audit/audit.mjs --check              # exit 1 on a new finding (CI runs this)
node tools/kit-audit/audit.mjs --json
node tools/kit-audit/audit.mjs --package game-weapons-three --domain vehicles
```

- `rules.json`: each domain (vehicles, structure, furniture, people, plants, items, weapons) with the packages that own it, how to build the piece
  from them (`use`) and the words that name it (English and Portuguese, without accents).
- `allowlist.json`: `allowed` are findings where the word means something else (a car's roof, a gun barrel), each with its reason; `pending` are
  the real findings already listed in `docs/pecas-fora-do-sdk.md`, each with its fix. `--check` fails only on a finding in neither list. When a
  pending piece is fixed, take its entry out.

## MCP server

`mcp.mjs` serves the same answers to an agent over MCP (stdio, no dependencies). The root `.mcp.json` registers it for Claude Code as `game-kit`:

| Tool | Answers |
|---|---|
| `kit_owner { piece }` | Which SDK gives a car, a wall, a table... and how to build it from there |
| `kit_origin { text, path? }` | The first commit that brought a name or a piece of code, its author, date, subject, PR and files |
| `kit_audit { package?, domain?, all? }` | The hand-drawn pieces outside their SDK (new, pending and, with `all`, allowed) |

The words are a heuristic: a piece whose code names nothing (a bare `BoxGeometry` in a helper) is not seen, so review still looks at what a
test area or a bench draws.
