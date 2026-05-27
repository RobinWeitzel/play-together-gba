# ROMs

This directory holds the GBA ROM files that the server lists at `/api/roms` and serves at `/api/roms/:id`.

## Committed test ROM

- **`test-arm.gba`** — Julian Smolka's GBA ARM-instruction test ROM (MIT licensed). Source: <https://github.com/jsmolka/gba-tests>. Used as the autonomous-build test ROM because it (a) is freely redistributable, (b) exercises a huge spread of CPU instructions (good determinism check), and (c) renders pass/fail output to the screen so we can visually confirm emulation is working.
- SHA-256: `77ee88662552bdc885c1080c0172ff119d54db791bd73b21808cf1ff1fe5b40e`

## Your own ROMs

Drop your own legally-obtained GBA ROMs into this directory. They are gitignored — they will be picked up by the server at startup (hashes are computed once and exposed in `/api/roms`). The app uses mGBA's HLE BIOS — **do not place any Nintendo BIOS file here**.
