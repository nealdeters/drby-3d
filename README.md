# DRBY 3D

Middle-grandstand 3D race client for the DRBY league. Vite + React + TypeScript + React Three Fiber.

## Run

```bash
cp .env.example .env.local   # set VITE_HOUSE_BUS_WS_URL + VITE_API_KEY
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
| **Race** | Full-viewport R3F Churchill oval; house-bus live pack when connected |
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

The TV horse is still `public/tv/models/riding-horse.glb` (standing, unskinned). Legs / neck / head / tail are vertex-shader posed (`tv-gallop-v3`). Race uses the low-poly box rig. Jockeys are a two-point race seat (hips over the irons, folded torso, posting against gather/suspension, short-rein arm give, helmet quieter than the hips). No new horse pack.

Flight hips do not lerp through the standing pose (that read as two carousel poles hanging straight down). When a hip crosses 0 the knee is already folded ~90°. The TV knee pivot rotates with the hip so the joint stays on the bone.

## Live backend

Same API as https://drby-live.netlify.app + drby_scheduler.

Netlify: set VITE_API_KEY and VITE_HOUSE_BUS_WS_URL to the reachable Centrifugo WebSocket endpoint, optionally set VITE_API_BASE=https://drby-live.netlify.app, then redeploy. The browser only receives a short-lived subscribe token from the token function; never put the Centrifugo API key in Vite.

Rollback: set VITE_REALTIME_TRANSPORT=ably and VITE_ABLY_API_KEY. Without realtime/API keys the HUD shows Demo (fakeSeason + local pack sim).

After a live finish, Race (`#/`) and TV (`#/tv`) keep that field on the wire for 30 seconds and show an official-order board (auto-clears). The next card does not gate-warp the pack until the hold ends.
