<!-- last_verified: 2026-05-18 -->
# AGENTS.md

This is the authoritative control surface for all coding agents working
on `b2-transformersjs-text-to-speech`. Read this first.

## 1. Repository map

```
apps/web/                  Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
  src/app/synthesize/      Compose -> generate -> upload page
  src/app/library/         Audio library (list / play / download / delete)
  src/app/page.tsx         Dashboard
  src/components/tts/      VoicePicker, Waveform, GenerationCard, SynthesizeForm, LibraryView
  src/lib/tts/             Transformers.js Kokoro loader, voice catalog, WAV encoder
  src/lib/api-client.ts    Typed fetch wrappers + browser->B2 PUT helper
  src/lib/queries.ts       TanStack Query hooks (single source of truth)

services/api/              FastAPI backend (layered: types/config/repo/service/runtime)
  app/runtime/presign.py   POST /presign/upload — issue short-TTL PUT URLs
  app/runtime/library.py   GET /library / GET /library/stats / DELETE /library/{key}
  app/service/             Business logic (presign + library)
  app/repo/b2_client.py    The only file in the tree that imports boto3

packages/shared/           Shared TypeScript types (mirrors Pydantic models)
docs/                      System of record (features, workflows, security, reliability)
docs/exec-plans/           Execution plans + tech debt tracker
infra/railway/             Deployment config
b2CorsRules.json           CORS rules applied to the bucket by the API at startup
```

## 2. Architectural invariants

**Backend layering**: `types` -> `config` -> `repo` -> `service` -> `runtime`

- No backward imports across layers
- No `boto3` outside `repo/`
- No business logic in route handlers (`runtime/`)
- All external APIs wrapped in `repo/` adapters
- All request/response data validated at boundary (Pydantic models)
- No shared mutable state across layers

**S3 client construction** — every `boto3.client("s3", ...)` /
`boto3.resource("s3", ...)` site sets
`Config(user_agent_extra="b2-transformersjs-text-to-speech/0.1.0 (backblaze-b2-samples)")`.
Verified by the parent-repo `b2-doctor` skill (run from the workspace
that contains the sample).

**Audio bytes never flow through the API.** The browser PUTs synthesized
WAVs to B2 directly using presigned URLs. The FastAPI service only
signs URLs and lists/heads/deletes objects.

**Frontend**: shadcn/ui components in `src/components/ui/` are
generated — never modify them. Custom non-shadcn primitives live in
the same directory and follow the same "don't drift" rule.

**Data fetching**: every API call flows through TanStack Query hooks
in `apps/web/src/lib/queries.ts`. No bare `useEffect + fetch` patterns.
New endpoints touch three files: `runtime/<router>.py`,
`lib/api-client.ts`, `lib/queries.ts`.

## 3. Quality expectations

- **DRY** — do not duplicate logic, types, or constants. Extract shared code only when used in 2+ places.
- Structured JSON logging only — no `print()` statements
- No raw SDK calls outside `repo/` layer
- Files stay under 300 lines
- Tests added or updated for every behavior change
- Docs updated in same PR as code changes
- Lint clean before merge
- Prefer boring, composable libraries over clever abstractions
- No implicit type assumptions — use typed models

## 4. Mechanical enforcement

| Rule | Enforced by |
|------|-------------|
| No backward imports | `tests/test_structure.py::test_no_backward_imports` |
| No boto3 outside repo/ | `tests/test_structure.py::test_boto3_only_in_repo` |
| File size < 300 lines | `tests/test_structure.py::test_file_size_limits` |
| All layers exist | `tests/test_structure.py::test_all_layers_exist` |
| No bare print() | `ruff` rule T20 |
| Import ordering | `ruff` rule I001 |
| Frontend strict equality | `eslint` rule eqeqeq |
| No unused vars | `eslint` + `ruff` rules |
| B2 standards (env vars, custom UA, no `b2-native`, no hardcoded region) | `b2-doctor` skill |

## 5. Commands

```bash
# Run
pnpm dev               # start both frontend and backend (preflight via pnpm doctor)
pnpm dev:web           # frontend only
pnpm dev:api           # backend only

# Test & lint
pnpm lint              # frontend lint (eslint)
pnpm build             # frontend type check + build
pnpm lint:api          # backend lint (ruff)
pnpm test:api          # backend tests (pytest)
pnpm check:structure   # structural boundary tests
pnpm test:e2e          # Playwright e2e tests
```

## 6. Agent workflow

1. Read this file first.
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) before structural changes.
3. For non-trivial changes, create a plan in `docs/exec-plans/active/`.
4. Implement the smallest coherent change.
5. Run: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
6. Update docs in the same PR (see §8).
7. Move completed plans to `docs/exec-plans/completed/`.
8. Only change files relevant to the task. No drive-by improvements.

## 7. Frontend conventions

See [docs/dev-workflows.md](docs/dev-workflows.md) for full details.

## 8. Doc update mapping

| Change Type | Update Location |
|-------------|-----------------|
| Feature logic, inputs, outputs, tests | `docs/features/<feature>.md` |
| User journeys | `docs/app-workflows.md` |
| System layout, deployments | `ARCHITECTURE.md` |
| Dev or testing process | `docs/dev-workflows.md` |
| Setup or scope changes | `README.md` |
| Security changes | `docs/SECURITY.md` |
| Reliability changes | `docs/RELIABILITY.md` |
| Active work plans | `docs/exec-plans/active/` |
| Known tech debt | `docs/exec-plans/tech-debt-tracker.md` |

If documentation and implementation conflict, update docs in the same PR.

## 9. Doc map

| Topic | Location |
|-------|----------|
| System layout, data flows, boundaries | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Feature docs | [docs/features/](docs/features/) |
| User journeys | [docs/app-workflows.md](docs/app-workflows.md) |
| Engineering workflows and testing | [docs/dev-workflows.md](docs/dev-workflows.md) |
| Security principles | [docs/SECURITY.md](docs/SECURITY.md) |
| Reliability expectations | [docs/RELIABILITY.md](docs/RELIABILITY.md) |
| Execution plans | [docs/exec-plans/](docs/exec-plans/) |
| Tech debt | [docs/exec-plans/tech-debt-tracker.md](docs/exec-plans/tech-debt-tracker.md) |

## 10. When unsure

- Prefer boring, stable libraries
- Prefer small PRs over large changes
- Add tests with every change
- Never bypass lint rules without explicit instruction
- Ask before making destructive or irreversible changes
