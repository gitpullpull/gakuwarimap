# Local External-Mode Verification

This repo can be verified in `external` mode without Manus-only credentials.

## 1. Create a dedicated MySQL database

Use a fresh database for this verification pass. Do not reuse the seeded database.

Example:

```sql
CREATE DATABASE gakuwari_map_external
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

## 2. Set environment variables

PowerShell example:

```powershell
$env:DEPLOY_MODE = "external"
$env:DATABASE_URL = "mysql://USER:PASSWORD@HOST:3306/gakuwari_map_external"
$env:GEMINI_API_KEY = "..."
$env:GOOGLE_MAPS_SERVER_API_KEY = "..."
$env:VITE_GOOGLE_MAPS_BROWSER_API_KEY = "..."
$env:GOOGLE_MAPS_BROWSER_API_KEY = "..."
$env:VITE_GOOGLE_MAP_ID = "DEMO_MAP_ID"
```

Expected for this pass:

- Do not set `STORAGE_PROVIDER`
- Do not set any `S3_*` variables
- `system.capabilities.canUploadImages` should stay `false`

## 3. Create schema and category-only baseline

```powershell
corepack pnpm db:push
corepack pnpm db:seed:categories
```

The category seed is fixed to:

- `カラオケ / music / yellow`
- `カフェ / coffee / mint`
- `映画 / film / lilac`
- `書店 / book / peach`
- `ショッピング / shopping / coral`
- `美容 / beauty / pink`

`spots`, `reviews`, and `users` should remain empty before the first verification run.

## 4. Start the local server

```powershell
corepack pnpm dev:external
```

This script is cross-platform and forces:

- `NODE_ENV=development`
- `DEPLOY_MODE=external` when not already set

## 5. Run the live verification pass

In a second terminal:

```powershell
corepack pnpm verify:external
```

What it checks:

- `system.capabilities` returns external guest-first settings
- `/`, `/spots`, `/submit`, `/agent` return the app shell
- `/api/maps-js` returns the Google Maps loader
- `agent.nearbyPlaces` returns live Places results with website enrichment
- `agent.searchGakuwari` returns live Gemini-backed results
- Two real spots from `/agent` are created or reused in the DB
- Each spot gets a text-only review
- `spot.byId`, `review.bySpot`, `spot.list`, `spot.nearby`, and search all reflect those live-created records

## 6. Optional manual UI pass

After the smoke script passes, confirm the UI manually:

1. Open `http://localhost:3000/`
2. Confirm categories render and the nearby DB section starts empty
3. Open `http://localhost:3000/agent`
4. Search around Shibuya and pick two live results
5. Open `http://localhost:3000/submit`
6. Register the same real shops with text-only data
7. Open each `/spots/:id` page and add a text-only review
8. Confirm the new records appear in `/spots` and `/search?q=...`

## Notes

- `/agent` uses the direct Gemini path in `server/agent.ts`
- `server/_core/llm.ts` is not used for this verification flow
- `DEMO_MAP_ID` is acceptable for local verification only; switch to a real Map ID before production
