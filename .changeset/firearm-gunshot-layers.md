---
"@adatechnology/game-weapons-three": minor
"@adatechnology/game-contracts": minor
"@adatechnology/game-test-room": minor
---

Firearm sounds: a layered gunshot per calibre family (crack, blast, body, action, room or field tail, far boom) with 4 takes that never repeat back to back, ±4 % pitch, stereo side from the shooter, the arrival delay of sound (d / 343 s), a close-to-far crossfade at 25–80 m (a rifle still carries at 800 m), occlusion, indoor vs outdoor tails and a suppressor that keeps a supersonic crack. Cases landing sound by floor (concrete, wood, metal, dirt) and case type (pistol, rifle, shotgun hull); a bullet passing by cracks (supersonic) or whizzes (subsonic). The game's single burst stays as `shotModel: 'game'`. `ModuleHost.surfaceAt` gives the floor material; the room fills it from the terrain. The weapons area logs each shot sound and each case, and has a "shot indoors" control.
