# Caixa de entrada de sons

1. Ponha o arquivo baixado (wav, ogg, mp3, flac, aif) em `<categoria>/` com o nome `<id>_<camada>_<nn>`:
   `pistol_9mm_close_01.wav`, `pistol_9mm_far_01.wav`, `gunshot_tail_in_01.wav`, `kick_hit_heavy_close_02.wav`.
   Camadas: `close` (perto, padrão), `far` (longe), `tail_in` / `tail_out` (cauda interior / exterior). Força: `_light`, `_medium`, `_heavy` no fim do id.
   Laços (`_loop` no nome) ficam estéreo e sem corte de silêncio.
2. Acrescente a linha do arquivo em `CREDITOS.md`.
3. Rode `pnpm --filter @adatechnology/game-audio sfx:convert` (precisa de ffmpeg). Sai em `packages/game-audio/assets/sfx/<categoria>/` em Ogg
   Vorbis mono 48 kHz, pico −1 dBFS, sem silêncio antes do ataque, com `manifest.json` e `CREDITOS.md`. `--dry-run` mostra o que faria.
4. Meça na sala de testes: `?area=sound_check_area` (C1–C10).
