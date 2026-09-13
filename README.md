# DRBY 3D

Middle-grandstand 3D race client for the DRBY league. Vite + React + TypeScript + React Three Fiber.

## Run

```bash
cp .env.example .env.local   # set VITE_ABLY_API_KEY + VITE_API_KEY from drby-live
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

## Views

| View | Notes |
|------|--------|
| **Race** | Full-viewport R3F Churchill oval; Ably live pack when connected |
| **TV** | Broadcast booth (`#/tv`): camera cuts, lower-thirds, same live feed as Race |
| **Schedule** | Season card / race-day program table |
| **Standings** | Points table with jersey swatches |
| **Seasons** | Active / completed / upcoming season cards |
| **Tracks** | Track program cards |
Mobile: hamburger drawer. Desktop: top tabs.

## Design

Affluent race-day program aesthetic — cream / navy / gold, manicured turf infield, sandy dirt, Twin Spires silhouette — dusk UI; wood-tier grandstand set back from the outer rail.

## Motion

Race (`#/`) and TV (`#/tv`) share a procedural left-lead transverse gallop (`src/components/race/gallop.ts`): hind→hind→fore→fore, then a suspension beat. Stance is short; gather vs airborne drives barrel pitch, neck/head opposition, and tail follow. Gate (`pace <= 0.08`) is a standstill — no walking in place.

The TV horse is still `public/tv/models/riding-horse.glb` (standing, unskinned). Legs / neck / head / tail are vertex-shader posed (`tv-gallop-v2`). Race uses the low-poly box rig. Jockeys are a two-point race seat (hips over the irons, folded torso, posting against gather/suspension, short-rein arm give, helmet quieter than the hips). No new horse pack.

## Live backend

Same API as https://drby-live.netlify.app + drby_scheduler.

Netlify (cheerful-sorbet-14faed): copy VITE_ABLY_API_KEY and VITE_API_KEY from drby-live site env into this site, optionally set VITE_API_BASE=https://drby-live.netlify.app, then redeploy. Do not invent or commit secrets.

Without keys the HUD shows Demo (fakeSeason + local pack sim). With keys + healthy API it shows Live and drives horses from Ably race-update progressMap/racers.
