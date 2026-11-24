---
'@adatechnology/game-kit-defaults': minor
---

Host do mundo (`/world`, spec 011 T1.5): `createKitWorldSync`, o mesmo mundo sem esperar a física (o solver do kit, um `PhysicsLoop` ou uma `SeamWorld` do jogo), para quem devolve o mundo na hora, como o `createTestRoom`. A física aceita uma `SeamWorld` (`physics.pieces`, `info.physics.kind: 'seam'`). `onSound` no topo das opções ouve todo som, também num mundo mudo; `audio.engine` carrega as gravações num motor do jogo. `ground.showBlow` (o que um golpe no chão mostra e toca, para um golpe que o jogo aplicou) e `ground.resetFire`; `liquids.filmRandom`; `isLooping`; `probeOf`, `DEFAULT_GROUND_LAYOUT` e `GROUND_BURST_MAX` exportados. Uma `SeamWorld` do Jolt passada ao `createKitWorld` é reconhecida como seam (não carrega um segundo motor).
