# @adatechnology/serve-room-tool

O servidor da 4280: serve `examples/test-room/dist` (a sala e, por links, as páginas de área) como o `python3 -m http.server` servia.

```sh
pnpm serve:room                          # igual ao de antes: sem cabeçalho novo
pnpm serve:room --isolate                # + COOP same-origin, COEP require-corp, CORP same-origin: crossOriginIsolated === true
pnpm serve:room --isolate=credentialless # COEP credentialless
pnpm serve:room --port 4290 --dir examples/test-room/dist
```

Também por ambiente: `ROOM_ISOLATE`, `ROOM_PORT`, `ROOM_HOST`, `ROOM_DIR`. Com `--isolate`, a sala aceita `?solver=jolt&joltBuild=multithread`
(e `joltThreads`/`joltContacts`, ver `packages/game-physics-jolt/README.md`). Sem a flag, o comportamento padrão não muda. O app de desktop
(`apps/desktop`) usa o mesmo `createRoomHandler`, sempre isolado.
