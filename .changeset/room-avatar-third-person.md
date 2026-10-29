---
'@adatechnology/game-test-room': minor
---

The room can show the player's body and a third-person camera. `setAvatar(avatar | null)` takes any `RoomAvatar` (`root`, `update(dt, state)`, optional `hand(side)`), places it at the feet with the player's yaw and feeds it speed, running, armed (a firearm in hand) and pitch; `setAvatarState({ crouch, down })` lets a player module drive the rest. `setCameraMode('first' | 'third')` (V with a body; Shift+V kicks) puts the camera over the shoulder with the team game's numbers (3.8 m back, 0.9 m aside, 1.95 m up), pulled in against walls; the carried item follows `avatar.hand('R')`. The simulation and the aim stay at the eye. HUD, hint and log in `pt-BR` and `en`.
