---
'@adatechnology/game-test-room': major
---

`createTestRoom` exige a opção `physics`: sem ela lança `RoomPhysicsRequiredError` (código `ROOM_PHYSICS_REQUIRED`), em vez de cair no solver antigo. Migração: `physics: await createRoomPhysics()` (novo; carrega o Jolt e devolve o `PhysicsLoop` que a sala passa a dar o passo).
