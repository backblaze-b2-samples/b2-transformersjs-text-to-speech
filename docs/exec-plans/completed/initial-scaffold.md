<!-- last_verified: 2026-05-14 -->
# Initial scaffold

> Scaffolded from `vibe-coding-starter-kit` on 2026-05-14.

This sample was built by copying
[`backblaze-b2-samples/vibe-coding-starter-kit`](https://github.com/backblaze-b2-samples/vibe-coding-starter-kit?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2-tts-sample)
and applying the architecture delta documented below.

## Delta from the starter kit

| Kept (as-is) | Trimmed | Added |
|---|---|---|
| Next.js 16 + React 19 + Tailwind v4 + shadcn/ui shell | `services/api/app/service/metadata.py` + Pillow/PyPDF2 deps | `apps/web/src/lib/tts/` — Transformers.js Kokoro loader, voice catalog, WAV encoder |
| App Router layout, nav, theme toggle, design system at `/design` | `apps/web/src/app/upload/` + `components/upload/*` | `apps/web/src/app/synthesize/` — text composer, voice picker, speed slider, audio preview |
| FastAPI layered architecture (`types` → `config` → `repo` → `service` → `runtime`) | `services/api/app/types/files.py` metadata fields | `apps/web/src/app/library/` — generation cards (play / download / delete) |
| TanStack Query data layer | `services/api/app/runtime/upload.py` server-side multipart upload | `services/api/app/runtime/presign.py` — short-TTL browser→B2 PUT URLs |
| Dashboard layout + stats cards + recent-items table | `apps/web/src/components/upload/*` | `services/api/app/runtime/library.py` — list / head / delete generations |
| `/health`, `/metrics`, JSON logs, request_id tracing, CORS middleware | `services/api/tests/test_metadata.py` and friends | `services/api/app/service/{presign,library}.py` — orchestration |
| Structural tests (layering, file size, boto3 containment) | `packages/shared/src/types.ts` image/PDF metadata | `apps/web/src/components/tts/*` — `VoicePicker`, `Waveform`, `GenerationCard`, `SynthesizeForm` |
| Single `.env` at repo root, validated at startup | `docs/features/{file-upload,file-browser,metadata-extraction}.md` | `docs/features/{tts-synthesis,audio-library,voice-picker}.md` |
| `docs/SECURITY.md`, `docs/RELIABILITY.md`, `docs/design-system.md`, dev-workflows | starter-kit screenshots | `b2CorsRules.json` + `pnpm setup:cors` |
| `infra/railway/` deployment config | server-proxy download route | `apps/web/public/models/.gitkeep` |

## Env var migration

The starter kit ships `B2_S3_ENDPOINT` and `B2_APPLICATION_KEY_ID`,
which are NOT b2-doctor-compliant. This sample renames them:

| Starter kit | This sample |
|---|---|
| `B2_S3_ENDPOINT` | `B2_ENDPOINT` |
| `B2_APPLICATION_KEY_ID` | `B2_KEY_ID` |
| `B2_APPLICATION_KEY` | `B2_APPLICATION_KEY` (unchanged) |
| `B2_BUCKET_NAME` | `B2_BUCKET_NAME` (unchanged) |
| (none) | `B2_REGION` (new, required) |

Applied across `.env.example`, `services/api/app/config/settings.py`,
all docs, and `scripts/doctor.mjs`.

## Custom user agent

Every `boto3.client("s3", ...)` site sets
`Config(user_agent_extra="b2-transformersjs-text-to-speech/0.1.0 (backblaze-b2-samples)")`
per parent-CLAUDE / b2-doctor standards.

## Out of scope (deferred)

- Real screenshots — tracked in `tech-debt-tracker.md`. The
  `docs/images/` directory is a `.gitkeep` for now.
- Full Kokoro pipeline implementation — `loader.ts` is a stub. Tracked.
- WebGPU backend toggle — tracked.
- Real audio fixtures in tests — structural tests only.
- Multi-tenant / per-user library scoping — `generations/` prefix is global.
