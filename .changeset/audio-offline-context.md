---
'@adatechnology/game-audio': patch
---

`createAudioEngine({ createContext })` aceita qualquer `BaseAudioContext`: um `OfflineAudioContext` entra sem cast, e o motor só retoma e fecha um contexto ao vivo (`isLiveContext`).
