<!-- last_verified: 2026-05-14 -->
# Architecture

## Components

- **apps/web/** — Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
  - Dashboard with stats, activity chart, and recent generations
  - `/synthesize` — text input, voice picker, speed slider, browser-side
    TTS, in-page preview, direct upload to B2
  - `/library` — generation cards with play / download / delete
  - In-browser inference via `@huggingface/transformers` v3 + Kokoro 82M
    ONNX. Model weights cached in IndexedDB after first download.
  - Dark mode via `next-themes`
- **services/api/** — FastAPI backend (layered architecture)
  - `/presign/upload` — issues short-TTL presigned PUT URLs so the
    browser can ship audio straight to B2
  - `/library/*` — list / head / delete generations
  - B2 S3 integration via boto3 (single user-agent: `(backblaze-b2-samples)`)
  - Health check endpoint with B2 connectivity verification
  - Structured JSON logging with request tracing
  - Prometheus-format metrics endpoint
- **packages/shared/** — TypeScript type definitions
  - Mirrors Pydantic models from the API
  - Consumed by `apps/web/` as workspace dependency

## Backend layering

The API follows a strict layered architecture:

```
types/     Pydantic models — no logic, no imports from other layers
  |
config/    Settings (pydantic-settings) — depends only on types
  |
repo/      Data access (boto3 B2 client) — no business logic
  |
service/   Business logic — calls repo, returns types
  |
runtime/   FastAPI routes — calls service, never repo directly
```

### Layering rules

1. Dependencies flow downward only: `types` -> `config` -> `repo` -> `service` -> `runtime`
2. No backward imports (e.g., service must not import from runtime)
3. `boto3` only allowed in `repo/` layer
4. All boundary data uses Pydantic models (no raw dicts across layers)
5. Each file stays under 300 lines

### Directory structure

```
services/api/
  main.py                  App entrypoint, middleware, router registration
  app/
    types/                 Generation, PresignRequest, PresignResponse, ...
    config/                Settings loaded from environment
    repo/                  B2 S3 client (data access layer)
    service/               Business logic (presign, library)
    runtime/               FastAPI route handlers (presign, library, health, metrics)
  tests/                   pytest tests (structural + integration)
```

## Boundary invariants

- **No external SDK leakage**: `boto3` is only imported in `app/repo/`.
  All other layers interact with B2 through the repo interface.
- **No raw dicts at boundaries**: All data crossing layer boundaries
  uses typed Pydantic models.
- **No mutable globals**: Configuration is read-only after init. No
  module-level mutable state shared between layers.
- **Validated inputs**: All HTTP inputs validated by FastAPI/Pydantic.
  All `generations/` keys validated against a regex allowlist.
- **Server never sees audio**: the only payloads the API handles are
  small JSON envelopes — presign requests and metadata responses.
- **Standardized B2 surface**: every `boto3.client("s3", ...)` site
  sets `user_agent_extra` containing `(backblaze-b2-samples)`. Env
  vars use the b2-doctor names. No hardcoded region in source.

## Deployment

- **Local dev** — `pnpm dev` runs both services via `concurrently`
  - Web: `localhost:3000`
  - API: `localhost:8000`
- **Railway** — two services from the same repo
  - See `infra/railway/README.md` for configuration

## Data stores

- **Backblaze B2** — object storage (S3-compatible API)
  - All synthesized WAVs stored under the `generations/yyyy/mm/<uuid>.wav` prefix
  - Per-generation metadata stored as `x-amz-meta-*` on the object
  - Listing + head_object are the only data sources for the library —
    no application database

## Object metadata convention

Each WAV is PUT with the following `x-amz-meta-*` headers (set in the
signature by the API, echoed by the browser):

| Header | Type | Meaning |
|---|---|---|
| `x-amz-meta-voice-id` | string | Kokoro voice identifier (e.g. `af_heart`) |
| `x-amz-meta-char-count` | string (int) | Length of the original text |
| `x-amz-meta-duration-ms` | string (int) | Audio duration in milliseconds |
| `x-amz-meta-model-id` | string | HF model repo (`onnx-community/Kokoro-82M-v1.0-ONNX`) |
| `x-amz-meta-text-preview` | string (≤200) | First 200 chars of the source text |
| `x-amz-meta-generated-at` | string (ISO 8601) | Server-set generation timestamp |

## External services

- **Backblaze B2 S3 API** — presigned URL issuance, list / head /
  delete. S3 API only; no `b2-native` usage anywhere in this repo.

## Trust boundaries

See [docs/SECURITY.md](docs/SECURITY.md) for full security documentation.

- **Frontend -> API** — CORS-restricted to configured origins
- **API -> B2** — authenticated via application keys, signature v4
- **Client -> B2** — presigned URLs for upload (PUT) and playback /
  download (GET); short TTL (default 10 minutes); upload signature
  binds the exact `x-amz-meta-*` headers the browser must echo back

## Data flows

- **Synthesize + upload**: Browser runs Kokoro -> encodes WAV -> POST
  `/presign/upload` -> API mints PUT URL + metadata headers -> browser
  PUTs the WAV directly to B2 with those headers.
- **Library list**: Browser -> `GET /library` -> service calls repo
  `list_objects_v2` (scoped to `generations/`) + `head_object` per
  key -> returns `Generation[]`.
- **Playback**: Browser -> `GET /library/{key}/playback` -> presigned
  GET URL -> `<audio>` element streams from B2.
- **Download**: Browser -> `GET /library/{key}/download` -> presigned
  GET URL with `Content-Disposition: attachment`.
- **Delete**: Browser -> `DELETE /library/{key}` -> service validates
  key against the `generations/yyyy/mm/<hex>.wav` regex -> repo
  `delete_object`.

## Observability

- Structured JSON logging on all requests with `request_id`
- Request timing middleware (logs duration per request)
- `/metrics` endpoint (Prometheus format: request count, latency,
  presign count)
- `/health` endpoint (B2 connectivity check)

## Canonical files

- Layered API handler: `services/api/app/runtime/presign.py`,
  `services/api/app/runtime/library.py`
- Service orchestration: `services/api/app/service/presign.py`,
  `services/api/app/service/library.py`
- B2 data access (repo layer): `services/api/app/repo/b2_client.py`
- Pydantic models: `services/api/app/types/` (`generations.py`, `presign.py`, `formatting.py`)
- Config (pydantic-settings): `services/api/app/config/settings.py`
- Structural tests: `services/api/tests/test_structure.py`
- Frontend API client: `apps/web/src/lib/api-client.ts`
- TanStack Query hooks: `apps/web/src/lib/queries.ts`
- TTS pipeline: `apps/web/src/lib/tts/` (loader, voices, wav)
- Shared TypeScript types: `packages/shared/src/types.ts`

## Core features

- [TTS Synthesis](docs/features/tts-synthesis.md)
- [Audio Library](docs/features/audio-library.md)
- [Voice Picker](docs/features/voice-picker.md)
- [Dashboard](docs/features/dashboard.md)

## References

- [docs/SECURITY.md](docs/SECURITY.md) — security principles and implementation
- [docs/RELIABILITY.md](docs/RELIABILITY.md) — reliability expectations
- [AGENTS.md](AGENTS.md) — architectural invariants and agent instructions
