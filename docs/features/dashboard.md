<!-- last_verified: 2026-05-14 -->
# Feature: Dashboard

## Purpose
At-a-glance overview of TTS activity: how many generations exist, how
much audio has been synthesized, and weekly activity trends.

## Used by
- UI: `/` page (dashboard home)
- API: `GET /library/stats`, `GET /library?limit=10`, `GET /library/stats/activity`

## Core functions
- `apps/web/src/components/dashboard/stats-cards.tsx` — three stat cards
- `apps/web/src/components/dashboard/recent-generations-table.tsx` — last 10 generations
- `apps/web/src/components/dashboard/activity-chart.tsx` — bar chart of generations per day
- `apps/web/src/lib/api-client.ts` — `getLibraryStats()`, `getLibrary()`, `getLibraryActivity()`
- `services/api/app/runtime/library.py` — handlers
- `services/api/app/service/library.py` — `get_stats()`, `get_activity()`
- `services/api/app/repo/b2_client.py` — `get_generation_stats()`

## Canonical files
- Dashboard layout: `apps/web/src/app/page.tsx`
- Stats service logic: `services/api/app/service/library.py::get_stats`

## Inputs
- None (dashboard loads data automatically on render)

## Outputs
- `GET /library/stats` → `GenerationStats` (total_generations, total_seconds, generations_today)
- `GET /library?limit=10` → `Generation[]` (newest-first)
- `GET /library/stats/activity?days=7` → `DailyGenerationCount[]`

## Flow
- Page loads → three parallel API calls via TanStack Query
- Stats cards render total generations, total seconds of audio,
  generations today
- Activity chart renders the last 7 days of daily counts
- Recent generations table shows the 10 most recent generations

## Edge cases
- **API unavailable** → stats card shows ErrorState with retry; recent
  table shows ErrorState with retry; chart shows ErrorState
- **Empty bucket / no generations** → "No generations yet" /
  "No activity yet" empty states
- **Large bucket** → stats endpoint paginates through all objects via
  `ContinuationToken`

## UX states
- Loading: skeleton placeholders for cards and table
- Empty: friendly empty states
- Loaded: populated cards, chart, table

## Verification
- Test files: `services/api/tests/test_library.py` (activity), `services/api/tests/test_error_handling.py`
- Required cases: stats with generations, stats with empty bucket, API
  error fallback, activity fills missing days
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
- [Audio Library](audio-library.md)
