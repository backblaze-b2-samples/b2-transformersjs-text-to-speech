<!-- last_verified: 2026-05-14 -->
# Dev Workflows

Engineering workflows for this repo.

## New Feature

- [ ] Read `AGENTS.md` and `ARCHITECTURE.md`
- [ ] Read the relevant feature doc in `docs/features/`
- [ ] For non-trivial changes, create a plan in `docs/exec-plans/active/`
- [ ] Implement the smallest coherent change
- [ ] Add or update tests
- [ ] Run: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- [ ] Update docs in the same PR (see AGENTS.md §8)
- [ ] Move plan to `docs/exec-plans/completed/` after validation

## Bugfix

- [ ] Add a failing test that reproduces the bug
- [ ] Confirm the test fails
- [ ] Implement the fix
- [ ] Rerun tests until green
- [ ] Update docs if behavior changed

## Refactor

- [ ] Read `ARCHITECTURE.md` — respect layering rules
- [ ] Ensure structural tests still pass: `pnpm check:structure`
- [ ] No behavior changes without updating feature docs

## Documentation update

- [ ] Update only the canonical location (see AGENTS.md §8 doc update mapping)
- [ ] Never duplicate content — link instead
- [ ] Update `<!-- last_verified: YYYY-MM-DD -->` header

## Pull request

- [ ] One coherent change per PR
- [ ] Run full lint + test suite before submitting
- [ ] Docs updated in the same PR as code changes
- [ ] Only change files relevant to the task — no drive-by improvements

## Testing

### Test types
- **Unit**: pure logic (service layer, voice catalog, WAV encoder)
- **Integration**: HTTP handlers, B2 connectivity (`tests/`)
- **Structural**: layering rules, import boundaries (`tests/test_structure.py`)
- **E2E**: Playwright browser-driven smoke tests

### Test placement
- Backend: `services/api/tests/`
- Frontend e2e: `apps/web/e2e/`

### Commands
- Quick (backend): `pnpm test:api`
- Structure: `pnpm check:structure`
- Frontend lint: `pnpm lint`
- Backend lint: `pnpm lint:api`
- Full suite: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- E2E: `pnpm test:e2e`

### When to run
- After behavior change: run relevant subset
- Before PR: run full suite

## Bucket CORS

`pnpm setup:cors` applies [`b2CorsRules.json`](../b2CorsRules.json) to
the bucket configured in `.env`. Direct browser uploads will 403 with a
CORS error until this is run on a freshly-created bucket. The script
fails fast with a readable error if the application key lacks
`writeBucketCors`.

## Frontend conventions

- Tailwind v4: config via CSS `@theme` blocks, NOT `tailwind.config.ts`
- Colors: OKLch format
- Dark mode: `next-themes` with `@custom-variant dark (&:is(.dark *))`
- Animations: `tw-animate-css` (not `tailwindcss-animate`)
- shadcn/ui components in `src/components/ui/` are generated — never modify them

## Data fetching

All API reads/writes flow through TanStack Query hooks in
`apps/web/src/lib/queries.ts`. Don't add bare `useEffect + fetch`
patterns to components.

**Read** — use the hooks directly:

```tsx
const { data, isLoading, error, refetch } = useLibrary();
const { data: stats } = useLibraryStats();
```

Surface errors via `<ErrorState error={error} onRetry={() => refetch()} />`
rather than silently rendering empty UI.

**Write** — wrap mutations with `useMutation` and invalidate on success:

```tsx
const deleteMutation = useDeleteGeneration();
deleteMutation.mutate(generation.key, {
  onSuccess: () => toast.success("Deleted"),
});
```

`useDeleteGeneration()` already calls
`queryClient.invalidateQueries({ queryKey: qk.all })` on success — every
consumer of `useLibrary` / `useLibraryStats` re-fetches lazily.

**Add a new endpoint** — three places to touch:
1. `services/api/app/runtime/<router>.py` — FastAPI route
2. `apps/web/src/lib/api-client.ts` — typed fetch wrapper
3. `apps/web/src/lib/queries.ts` — `useQuery` / `useMutation` hook + entry in `qk`

## Transformers.js notes

- All Kokoro work lives in `apps/web/src/lib/tts/`. Keep the UI
  model-agnostic — the page imports `synthesize()` and gets back a
  `Float32Array`, no knowledge of HF internals.
- The library is `"use client"` only — never call `synthesize()` from a
  server component or a route handler.
- `loader.ts` wraps `kokoro-js` (which wraps `@huggingface/transformers`).
  Pipeline instances are cached per dtype; inputs longer than ~400
  characters stream sentence-sized chunks via `TextSplitterStream` and
  the loader concatenates them into one Float32Array.
