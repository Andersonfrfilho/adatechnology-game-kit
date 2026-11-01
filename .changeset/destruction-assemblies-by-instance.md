---
'@adatechnology/game-destruction': minor
---

Assemblies by instance (spec 005, D5): `createAssemblies({ packs, patch, remove })` returns a set (`list`, `get`, `register`, `part`) that starts from a copy of the built-in walls and shares nothing with any other set. `defaultAssemblies()` is the set behind the global list; `ASSEMBLIES`, `registerAssembly`, `getAssembly` and `assemblyPart` stay exported and `@deprecated`, with the same results.
