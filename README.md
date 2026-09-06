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
| **Race** | Full-viewport R3F scene from the middle grandstand + HUD (countdown, field, next race) |
| **Schedule** | Season card / race-day program table |
| **Standings** | Points table with jersey swatches |
| **Seasons** | Active / completed / upcoming season cards |
| **Tracks** | Track program cards |
| **Profile** | Sign-in stub drawer/page |
| **Admin** | Control-console stub |

Mobile: hamburger drawer. Desktop: top tabs + Profile/Admin actions.

## Design

Stadium / race-day program aesthetic — dark wood, warm floodlights, brass accents — not the older flat green RN-web theme. Race is mostly 3D with a side field panel; other views leave visual room to later embed or reference the track world.

## Fake vs next

**Fake today:** season module (`src/data/fakeSeason.ts`), looping oval progress for 8 low-poly horses, local countdown from scheduled times.

**Next:** wire `VITE_ABLY_API_KEY`, `VITE_API_BASE`, and `VITE_API_KEY` to the same backend as [nealdeters/drby](https://github.com/nealdeters/drby) for live race progress, schedule, and standings. Do not invent Ably keys — use real project credentials locally only.
