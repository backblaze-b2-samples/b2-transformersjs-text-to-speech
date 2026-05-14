<!-- last_verified: 2026-05-14 -->
# Feature: Audio Library

## Purpose
List, play back, download, and delete every TTS generation the user
has stored in B2 — sourced entirely from S3 list/head/delete so there
is no application database.

## Used by
- UI: `/library` page
- API:
  - `GET /library`
  - `GET /library/{key}/playback`
  - `GET /library/{key}/download`
  - `DELETE /library/{key}`

## Core functions
- `apps/web/src/components/tts/library-view.tsx` — grid of cards
- `apps/web/src/components/tts/generation-card.tsx` — individual card
- `apps/web/src/lib/queries.ts::useLibrary`, `useDeleteGeneration`,
  `usePlaybackUrl`
- `services/api/app/runtime/library.py` — FastAPI routes
- `services/api/app/service/library.py` — key validation, listing,
  delete, activity
- `services/api/app/repo/b2_client.py::list_generations`,
  `head_generation`, `delete_generation`, `presign_get`

## Canonical files
- Pattern exemplar: `apps/web/src/components/tts/generation-card.tsx`
- Service orchestration: `services/api/app/service/library.py`

## Inputs
- limit: int (query param on `GET /library`, default 100, max 500)
- key: path param on `/library/{key}/...` — must match
  `^generations/\d{4}/\d{2}/[0-9a-f]+\.wav$`

## Outputs
- `GET /library` → `Generation[]` sorted newest-first (key, size,
  content_type, created_at, voice_id, char_count, duration_ms,
  model_id, text_preview)
- `GET /library/{key}/playback` → `{url, expires_in}` — inline
  presigned GET
- `GET /library/{key}/download` → `{url, expires_in}` — presigned GET
  with `Content-Disposition: attachment`
- `DELETE /library/{key}` → `{deleted: true, key}`
- Side effect on delete: TanStack Query invalidates library + stats

## Flow
- `GET /library` -> `list_objects_v2(Prefix="generations/")` ->
  `head_object` per key to read `x-amz-meta-*` -> sort newest-first
  -> return
- Playback / download -> validate the key against the regex -> HEAD
  for existence -> mint a presigned GET (with the right
  `ResponseContentDisposition` for download) -> return URL
- Delete -> validate key -> `delete_object` -> 200

## Edge cases
- **Listed-but-not-head-able key** -> skipped (transient B2 consistency
  artifact); the rest of the library renders
- **Malformed key** -> 400 from the API before B2 is touched
- **Missing key** -> 404 with the canonical "Generation not found" body
- **B2 unreachable** -> 500 with `Internal server error`; raw error is
  not leaked
- **Empty prefix** -> 200 with `[]`; the UI shows the empty state

## UX states
- Loading: 6 skeleton cards
- Empty: friendly `EmptyState` + CTA to Synthesize
- Loaded: responsive grid of `GenerationCard`s
- Error: `ErrorState` with retry

## Verification
- Test files: `services/api/tests/test_library.py`,
  `services/api/tests/test_library_keys.py`,
  `services/api/tests/test_error_handling.py`
- Required cases: list newest-first, delete success, delete on bad key,
  delete propagates B2 errors, playback URL flows, activity fills
  missing days
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
- [TTS Synthesis](tts-synthesis.md)
