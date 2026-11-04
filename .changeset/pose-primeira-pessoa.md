---
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-test-room': patch
---

The gun in the first-person view is held at the hip instead of shouldered beside the eye. The view's own pose (`VIEW_HOLD`, used when the host says the view is the player's eye: `firstPerson`, which the weapons area reads from `ModuleHost.player().cameraMode`) puts the grip low and right where the right hand reaches, a handgun's higher and nearer the middle and a rocket launcher's on the shoulder, with the barrel parallel to the aim, so the sights stay below the crosshair and the muzzle points at it. The body still shoulders the gun in third person. The test room reports its real camera mode to the modules (it always said `first`).
