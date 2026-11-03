# Fire and explosion inbox: does each sound match its action?

Each file was measured automatically (ffmpeg decode, mono, 16 kHz, 50 ms windows) and checked against what the action produces in the real world. This is a first-pass filter: it catches clear mismatches (wrong length, a soft attack on a grenade, no bass in a distant explosion, silence in a loop). It does not replace listening to the files in the game.

## Metrics

- **attack**: time from 20 dB below the loudest moment up to the peak. A close detonation is instant; a distant one is smeared.
- **tail**: time after the peak until the level falls 30 dB (reverb, debris, fire that keeps burning).
- **transients/s**: sudden jumps of 6 dB or more (crackle, pops, debris impacts).
- **variation**: standard deviation of the level over time; a loop must be steady.
- **bass / highs**: energy below 250 Hz and above 4 kHz, relative to the whole file. Distance absorbs the highs; weight lives in the bass.
- **flatness**: 0 means a pure tone (tinnitus), 1 means white noise (hiss, gas jet).

## Requirements per action

| action | requirements |
|---|---|
| fire_loop_small | >= 20 s, steady (<= 6 dB), <= 10% silence, 0.3 to 4 crackles/s, bright crackle (highs >= -20 dB) |
| fire_loop_large | >= 20 s, steady, no silence, roar with body (bass >= -6 dB) |
| fire_crackle | impulsive (crest >= 20 dB), >= 1 pop/s or a short file |
| fire_wood_crackle | steady, >= 1 crackle/s, impulsive |
| fire_ignite | 1 to 10 s, whoosh swells (attack 100 to 2500 ms), body |
| molotov_break_ignite | <= 20 s, glass audible (highs >= -15 dB), fire continues (tail >= 1.5 s) |
| explosion_grenade | one-shot <= 10 s, instant attack (<= 150 ms), bass, impulsive |
| explosion_big | instant attack (<= 300 ms), tail >= 2 s, strong bass (>= -4 dB) |
| explosion_far | highs absorbed (<= -25 dB), bass dominates (>= -3 dB), smeared attack (>= 100 ms) |
| debris_rain | >= 1 impact/s, no single dominant boom |
| fire_plastic_melt | >= 3 s, sizzle present |
| fire_extinguish | broadband jet (flatness >= 0.2), hiss |
| gas_leak_hiss | constant (<= 3 dB), noisy (flatness >= 0.3), high-pitched (centroid >= 3 kHz) |
| explosion_car | instant attack, body, one-shot <= 15 s |
| explosion_indoor_tail | room tail >= 1.5 s, bass |
| structure_collapse | >= 3 s, sequence of impacts (>= 0.5/s), weight |
| flashbang | instant attack, bright bang (highs >= -25 dB), one-shot |
| tinnitus_ring | pure tone (flatness <= 0.05), high-pitched (>= 2.5 kHz) |

## How to read the results

- Most PARTIAL results on explosion_big, explosion_grenade_02/04, molotov_02 and the long debris files are files with several takes in a row (archive recordings of 30 to 120 s). The peak lands on a later take and the attack reads late. These are raw material: cut each take into its own one-shot, then measure again.
- "very quiet: normalize" means the recording is good but low (campfires close to -50 dB RMS). Normalize to a common loudness before shipping.
- "peak at 0 dBFS" means the preview already touches the ceiling; check for clipping by ear.

## Results

| file | verdict | failed checks | dur | attack | tail | transients/s | variation | bass | highs | RMS |
|---|---|---|---|---|---|---|---|---|---|---|
| debris_rain_01.ogg | PARTIAL | many impacts (>= 1/s) | 51.17 s | 6900 ms | 8.25 s | 0.49 | 12.4 dB | -4.9 dB | -24.7 dB | -28.6 dB |
| debris_rain_02.ogg | PARTIAL | many impacts (>= 1/s) | 28.0 s | 250 ms | 1.65 s | 0.75 | 4.9 dB | -3.4 dB | -16.4 dB | -34.2 dB |
| debris_rain_03.ogg | OK | - | 12.38 s | 100 ms | 0.35 s | 4.44 | 9.2 dB | -17.0 dB | -6.5 dB | -35.8 dB |
| debris_rain_04.ogg | PARTIAL | no single dominant boom (crest <= 35 dB); very quiet: normalize | 4.55 s | 300 ms | 0.6 s | 3.74 | 9.1 dB | -12.1 dB | -6.7 dB | -50.3 dB |
| explosion_big_01.ogg | PARTIAL | instant attack (<= 300 ms); peak at 0 dBFS: check clipping | 19.89 s | 550 ms | 6.85 s | 0.5 | 9.8 dB | -2.9 dB | -32.9 dB | -11.4 dB |
| explosion_big_02.ogg | PARTIAL | instant attack (<= 300 ms); long tail (>= 2 s) | 63.48 s | 500 ms | 1.95 s | 0.39 | 13.2 dB | -2.0 dB | -28.0 dB | -29.2 dB |
| explosion_big_03.ogg | PARTIAL | instant attack (<= 300 ms) | 60.07 s | 2800 ms | 8.6 s | 1.02 | 8.4 dB | -0.3 dB | -51.9 dB | -19.0 dB |
| explosion_big_04.ogg | PARTIAL | long tail (>= 2 s) | 12.91 s | 0 ms | 1.5 s | 0.15 | 7.0 dB | -2.2 dB | -41.3 dB | -35.3 dB |
| explosion_big_05.ogg | PARTIAL | instant attack (<= 300 ms); strong bass (>= -4 dB) | 48.12 s | 1050 ms | 4.0 s | 0.37 | 14.1 dB | -4.4 dB | -17.9 dB | -31.4 dB |
| explosion_car_01.ogg | PARTIAL | body (bass >= -8 dB); one-shot <= 15 s | 217.59 s | 100 ms | 0.4 s | 0.27 | 8.4 dB | -8.4 dB | -11.3 dB | -29.9 dB |
| explosion_car_02.ogg | OK | - | 0.74 s | 50 ms | 0.5 s | 1.36 | 11.3 dB | -6.7 dB | -19.2 dB | -18.3 dB |
| explosion_car_03.ogg | OK | - | 0.56 s | 50 ms | 0.35 s | 0.0 | 11.4 dB | -0.6 dB | -16.6 dB | -16.1 dB |
| explosion_far_01.ogg | OK | - | 101.07 s | 150 ms | 2.05 s | 0.5 | 10.8 dB | -1.0 dB | -37.8 dB | -26.8 dB |
| explosion_far_02.ogg | OK | - | 72.43 s | 450 ms | 0.3 s | 0.29 | 12.1 dB | -1.7 dB | -32.0 dB | -29.5 dB |
| explosion_far_03.ogg | OK | - | 8.61 s | 150 ms | 4.7 s | 0.23 | 10.1 dB | -0.5 dB | -46.5 dB | -32.9 dB |
| explosion_far_04.ogg | OK | - | 64.0 s | 550 ms | 5.25 s | 0.5 | 9.2 dB | -0.2 dB | -103.2 dB | -21.7 dB |
| explosion_far_05.ogg | PARTIAL | bass dominates (>= -3 dB) | 122.18 s | 53700 ms | 66.55 s | 0.16 | 4.5 dB | -4.1 dB | -26.3 dB | -22.5 dB |
| explosion_grenade_01.ogg | PARTIAL | instant attack (<= 150 ms); impulsive (crest >= 12 dB); peak at 0 dBFS: check clipping | 3.54 s | 800 ms | 1.95 s | 0.85 | 10.1 dB | -2.8 dB | -35.6 dB | -11.7 dB |
| explosion_grenade_02.ogg | PARTIAL | one-shot <= 10 s; instant attack (<= 150 ms) | 48.51 s | 300 ms | 0.25 s | 0.95 | 12.5 dB | -2.3 dB | -21.1 dB | -29.7 dB |
| explosion_grenade_03.ogg | OK | peak at 0 dBFS: check clipping | 1.99 s | 50 ms | 0.9 s | 0.0 | 11.5 dB | -2.2 dB | -25.8 dB | -16.1 dB |
| explosion_grenade_04.ogg | PARTIAL | one-shot <= 10 s | 30.21 s | 100 ms | 4.15 s | 0.1 | 9.3 dB | -4.5 dB | -31.4 dB | -28.9 dB |
| explosion_indoor_tail_01.ogg | OK | peak at 0 dBFS: check clipping | 15.11 s | 0 ms | 7.6 s | 0.46 | 11.5 dB | -1.0 dB | -30.8 dB | -17.0 dB |
| fire_crackle_01.ogg | OK | - | 2.87 s | 2300 ms | 0.55 s | 1.74 | 4.1 dB | -1.2 dB | -21.4 dB | -31.3 dB |
| fire_crackle_02.ogg | OK | very quiet: normalize | 17.34 s | 200 ms | 0.25 s | 5.19 | 10.1 dB | -33.3 dB | -3.0 dB | -48.0 dB |
| fire_crackle_03.ogg | OK | very quiet: normalize | 24.62 s | 50 ms | 0.15 s | 1.54 | 7.6 dB | -5.3 dB | -10.2 dB | -47.4 dB |
| fire_crackle_04.ogg | PARTIAL | pops present (>= 1/s, or short <= 3 s); very quiet: normalize | 27.01 s | 7450 ms | 12.25 s | 0.74 | 2.7 dB | -1.1 dB | -12.3 dB | -50.1 dB |
| fire_extinguish_01.ogg | PARTIAL | hiss (highs >= -15 dB) | 11.44 s | 200 ms | 2.85 s | 1.4 | 8.5 dB | -15.5 dB | -20.2 dB | -33.3 dB |
| fire_extinguish_02.ogg | OK | very quiet: normalize | 47.84 s | 250 ms | 42.35 s | 0.17 | 4.2 dB | -5.4 dB | -9.5 dB | -45.4 dB |
| fire_extinguish_03.ogg | PARTIAL | broadband jet (flatness >= 0.2) | 2.6 s | 50 ms | 1.1 s | 0.77 | 10.1 dB | -22.5 dB | -4.8 dB | -23.5 dB |
| fire_ignite_01.ogg | OK | peak at 0 dBFS: check clipping | 7.52 s | 100 ms | 0.2 s | 0.27 | 13.5 dB | -0.6 dB | -40.6 dB | -23.0 dB |
| fire_ignite_02.ogg | OK | - | 3.86 s | 2200 ms | 1.55 s | 1.56 | 7.5 dB | -0.1 dB | -25.6 dB | -10.9 dB |
| fire_ignite_03.ogg | OK | peak at 0 dBFS: check clipping | 2.97 s | 300 ms | 1.9 s | 0.67 | 6.7 dB | -1.4 dB | -35.8 dB | -21.3 dB |
| fire_ignite_04.ogg | OK | - | 3.07 s | 450 ms | 0.5 s | 1.63 | 13.7 dB | -5.7 dB | -54.9 dB | -22.4 dB |
| fire_loop_large_01.ogg | OK | - | 57.43 s | 700 ms | 52.2 s | 0.3 | 2.1 dB | -0.8 dB | -15.4 dB | -38.1 dB |
| fire_loop_large_02.ogg | OK | - | 184.05 s | 83150 ms | 96.8 s | 0.01 | 1.5 dB | -1.2 dB | -22.6 dB | -25.2 dB |
| fire_loop_large_03.ogg | OK | - | 73.33 s | 48950 ms | 19.85 s | 0.22 | 5.2 dB | -3.7 dB | -15.2 dB | -26.8 dB |
| fire_loop_large_04.ogg | PARTIAL | steady level (variation <= 6 dB); no long silence (<= 10%); roar has body (bass >= -6 dB) | 260.96 s | 50 ms | 0.15 s | 0.84 | 8.3 dB | -17.4 dB | -4.8 dB | -42.4 dB |
| fire_loop_large_05.ogg | OK | - | 46.51 s | 10550 ms | 0.8 s | 0.69 | 3.5 dB | -0.5 dB | -31.2 dB | -32.2 dB |
| fire_loop_small_01.ogg | OK | very quiet: normalize | 109.0 s | 50 ms | 0.3 s | 0.56 | 3.1 dB | -4.4 dB | -8.9 dB | -48.2 dB |
| fire_loop_small_02.ogg | OK | - | 34.88 s | 100 ms | 2.5 s | 1.83 | 4.0 dB | -6.6 dB | -9.0 dB | -34.9 dB |
| fire_loop_small_03.ogg | OK | - | 24.73 s | 50 ms | 19.65 s | 1.17 | 4.4 dB | -3.5 dB | -8.4 dB | -42.9 dB |
| fire_loop_small_04.ogg | OK | very quiet: normalize | 83.62 s | 50 ms | 0.45 s | 1.58 | 4.8 dB | -7.9 dB | -7.2 dB | -52.3 dB |
| fire_loop_small_05.ogg | OK | peak at 0 dBFS: check clipping | 185.56 s | 50 ms | 0.1 s | 0.86 | 4.2 dB | -9.8 dB | -6.1 dB | -40.5 dB |
| fire_plastic_melt_01.ogg | OK | - | 8.12 s | 600 ms | 7.5 s | 0.0 | 0.9 dB | -1.4 dB | -21.5 dB | -44.3 dB |
| fire_plastic_melt_02.ogg | OK | very quiet: normalize | 11.75 s | 8800 ms | 2.95 s | 0.0 | 1.2 dB | -2.8 dB | -17.7 dB | -46.1 dB |
| fire_wood_crackle_01.ogg | OK | peak at 0 dBFS: check clipping | 60.91 s | 100 ms | 0.25 s | 2.97 | 5.7 dB | -2.6 dB | -13.2 dB | -34.2 dB |
| fire_wood_crackle_02.ogg | PARTIAL | impulsive (crest >= 20 dB) | 28.11 s | 15550 ms | 11.55 s | 1.1 | 4.9 dB | -0.2 dB | -27.2 dB | -24.4 dB |
| flashbang_01.ogg | PARTIAL | bright bang (highs >= -25 dB); peak at 0 dBFS: check clipping | 4.0 s | 0 ms | 1.7 s | 0.25 | 10.4 dB | -1.3 dB | -29.1 dB | -16.4 dB |
| flashbang_02.ogg | PARTIAL | bright bang (highs >= -25 dB) | 6.34 s | 0 ms | 0.15 s | 0.32 | 8.3 dB | -4.9 dB | -25.4 dB | -30.0 dB |
| gas_leak_hiss_01.ogg | OK | - | 3.65 s | 2250 ms | 1.35 s | 0.0 | 0.6 dB | -16.6 dB | -4.4 dB | -42.2 dB |
| gas_leak_hiss_02.ogg | PARTIAL | noisy hiss (flatness >= 0.3); high-pitched (centroid >= 3 kHz) | 7.86 s | 4500 ms | 3.35 s | 0.0 | 1.3 dB | -40.5 dB | -24.5 dB | -34.1 dB |
| molotov_break_ignite_01.ogg | PARTIAL | glass audible (highs >= -15 dB) | 14.92 s | 1950 ms | 12.55 s | 0.13 | 5.0 dB | -7.6 dB | -24.7 dB | -27.3 dB |
| molotov_break_ignite_02.ogg | PARTIAL | one-shot <= 20 s; glass audible (highs >= -15 dB) | 31.84 s | 500 ms | 2.2 s | 1.07 | 8.3 dB | -4.1 dB | -28.4 dB | -27.2 dB |
| molotov_break_ignite_03.ogg | OK | - | 9.0 s | 500 ms | 8.5 s | 0.22 | 3.4 dB | -9.7 dB | -13.3 dB | -24.9 dB |
| molotov_break_ignite_04.ogg | PARTIAL | fire continues after impact (tail >= 1.5 s) | 2.3 s | 50 ms | 0.25 s | 1.74 | 10.1 dB | -10.5 dB | -10.7 dB | -31.3 dB |
| molotov_break_ignite_05.ogg | PARTIAL | fire continues after impact (tail >= 1.5 s) | 14.71 s | 100 ms | 0.85 s | 0.75 | 9.3 dB | -17.9 dB | -4.1 dB | -32.0 dB |
| structure_collapse_01.ogg | OK | - | 8.1 s | 100 ms | 0.1 s | 1.23 | 9.6 dB | -5.9 dB | -27.9 dB | -27.5 dB |
| structure_collapse_02.ogg | PARTIAL | sequence of impacts (>= 0.5/s); weight (bass >= -6 dB) | 49.03 s | 20850 ms | 18.8 s | 0.24 | 4.8 dB | -8.3 dB | -18.2 dB | -25.1 dB |
| structure_collapse_03.ogg | PARTIAL | sequence of impacts (>= 0.5/s) | 7.89 s | 450 ms | 5.9 s | 0.25 | 10.6 dB | -5.5 dB | -28.9 dB | -22.2 dB |
| tinnitus_ring_01.ogg | PARTIAL | pure tone (flatness <= 0.05) | 8.9 s | 1400 ms | 0.5 s | 0.0 | 11.2 dB | -56.1 dB | -11.9 dB | -39.2 dB |
| tinnitus_ring_02.ogg | PARTIAL | pure tone (flatness <= 0.05) | 12.0 s | 400 ms | 7.75 s | 0.17 | 10.3 dB | -5.8 dB | -8.6 dB | -20.8 dB |

## Summary per action

- debris_rain: 1 OK, 3 partial, 0 fail
- explosion_big: 0 OK, 5 partial, 0 fail
- explosion_car: 2 OK, 1 partial, 0 fail
- explosion_far: 4 OK, 1 partial, 0 fail
- explosion_grenade: 1 OK, 3 partial, 0 fail
- explosion_indoor_tail: 1 OK, 0 partial, 0 fail
- fire_crackle: 3 OK, 1 partial, 0 fail
- fire_extinguish: 1 OK, 2 partial, 0 fail
- fire_ignite: 4 OK, 0 partial, 0 fail
- fire_loop_large: 4 OK, 1 partial, 0 fail
- fire_loop_small: 5 OK, 0 partial, 0 fail
- fire_plastic_melt: 2 OK, 0 partial, 0 fail
- fire_wood_crackle: 1 OK, 1 partial, 0 fail
- flashbang: 0 OK, 2 partial, 0 fail
- gas_leak_hiss: 1 OK, 1 partial, 0 fail
- molotov_break_ignite: 1 OK, 4 partial, 0 fail
- structure_collapse: 1 OK, 2 partial, 0 fail
- tinnitus_ring: 0 OK, 2 partial, 0 fail
