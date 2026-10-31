---
'@adatechnology/game-characters-three': minor
'@adatechnology/game-test-room': minor
---

The body sits and lies too, not only the camera: `AvatarUpdate.seat` (`{ pose: 'sit' | 'lie', hip }`) folds the legs under hips at the seat height, the knee opening until the sole reaches the floor (a low seat sends the shins forward), with the hands on the thighs; `lie` lays the body face up with the pelvis there and the head behind. The test room passes the seat the player sits on (`RoomSeat.hips`) to the body, so sitting in first person shows in third person.
