# DRBY 3D

Middle-grandstand 3D race client for the DRBY league. Vite + React + TypeScript + React Three Fiber.

## Run

```bash
cp .env.example .env.local   # optional; placeholders only
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
| **Race** | Full-viewport R3F Churchill Downs–class oval from a high grandstand + race-day HUD |
| **Schedule** | Season card / race-day program table |
| **Standings** | Points table with jersey swatches |
| **Seasons** | Active / completed / upcoming season cards |
| **Tracks** | Track program cards |
Mobile: hamburger drawer. Desktop: top tabs.

## Design

Affluent race-day program aesthetic — cream / navy / gold, manicured turf infield, sandy dirt, Twin Spires silhouette — daylight grandstand view framing the complete oval.

## Fake vs next

**Fake today:** season module (`src/data/fakeSeason.ts`), looping oval pack-racing for 8 low-poly horses, local countdown from scheduled times.

**Next:** wire `VITE_ABLY_API_KEY`, `VITE_API_BASE`, and `VITE_API_KEY` to the same backend as [nealdeters/drby](https://github.com/nealdeters/drby) for live race progress, schedule, and standings. Do not invent Ably keys — use real project credentials locally only.
