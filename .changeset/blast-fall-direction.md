---
'@adatechnology/game-characters-three': minor
'@adatechnology/game-test-room': minor
---

The body falls the way the blast pushed it: on its back when it faced the blast, face down when the blast was behind it (`AvatarUpdate.fallForward`, `RoomAvatarState.fallForward`, `player.knockedForward`; `toRoomAvatar` passes it on). The first-person view lying face down looks at the ground; on the back, at the sky.
