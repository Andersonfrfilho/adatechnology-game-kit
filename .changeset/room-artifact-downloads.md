---
'@adatechnology/game-test-room': patch
---

`log.download` now works inside a claude.ai Artifact through the `downloads` capability (declined saves are logged as `export_cancelled`), and "Copy JSON" falls back to a selected textarea without `navigator.clipboard`.
