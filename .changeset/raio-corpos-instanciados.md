---
"@adatechnology/game-characters-three": patch
---

The GPU-instanced body batches (bodies, their depth prepass, impostors and blob shadows) no longer answer rays: their template geometry sits at the world origin, where no body is drawn, and a ray there (the gun's wall pull, a laser) stopped on it.
