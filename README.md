<!-- last_verified: 2026-05-14 -->
# B2 Transformers.js Text-to-Speech

A reference app showing how to ship a **client-side TTS pipeline backed
by [Backblaze B2](https://www.backblaze.com/sign-up/ai-cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2-tts-sample) cloud storage**, with zero server-side GPU.

The user types text, picks a voice from the Kokoro catalog, hits
**Generate**, and the model — `onnx-community/Kokoro-82M-v1.0-ONNX` —
runs in their browser via Transformers.js. The resulting WAV uploads
straight from the browser to B2 via a short-lived presigned PUT URL.
The FastAPI service signs URLs and lists / heads / deletes objects; it
never sees the audio bytes.

> Scaffolded from a Backblaze sample template; see
> [`docs/exec-plans/completed/initial-scaffold.md`](docs/exec-plans/completed/initial-scaffold.md)
> for the architecture delta.

## What it looks like

> Screenshots forthcoming — see [tech-debt-tracker](docs/exec-plans/tech-debt-tracker.md).
> The `docs/images/` directory is intentionally empty in this round; do not
> commit binary placeholders. README references screenshots with TODO notes:

- TODO: `docs/images/synthesize.png` — composer + voice picker + live preview
- TODO: `docs/images/library.png` — generation cards with play / download / delete
- TODO: `docs/images/dashboard.png` — stats, activity chart, recent generations

## How it works

```
+----------------+    1. POST /presign/upload     +----------------+
|                | -----------------------------> |   FastAPI      |
|                |   { voice, text, duration }    |   service      |
|   Browser      | <----------------------------- |   (this repo)  |
|                |   { url, key, headers }        |                |
|                |                                +-------+--------+
|   - Kokoro TTS |                                        |
|   - WAV encode |    2. PUT <signed URL>                 |
|                | --------------------------+            |
|                |    (browser -> B2 direct) |            |
+-------+--------+                           |            |
        |                                    v            |
        |    3. presign GET / list / delete  +--------+   |
        +----------------------------------> |   B2   |<--+
                                             +--------+
```

1. The browser asks the API for a 10-minute presigned PUT URL.
2. The browser PUTs the WAV directly to B2 — never through the API.
3. The library page reads back generations via `list_objects_v2` +
   `head_object` (no application database), and uses short-TTL
   presigned GET URLs for playback and download.

## Quick start

You need: Node.js >= 20, pnpm >= 9, Python >= 3.11, and a free
**[Backblaze B2 account](https://www.backblaze.com/sign-up/ai-cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2-tts-sample)**.

### 1. Install

```bash
pnpm install
cd services/api && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ../..
```

### 2. Configure B2

Create a bucket and an application key in your
**[B2 dashboard](https://secure.backblaze.com/b2_buckets.htm?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2-tts-sample)**.
The key needs `listFiles`, `readFiles`, `writeFiles`, `deleteFiles`,
and `writeBucketCors`. Then:

```bash
cp .env.example .env
```

Fill it in:

```
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
B2_KEY_ID=your-key-id
B2_APPLICATION_KEY=your-key
B2_BUCKET_NAME=your-bucket
```

> The five variables above are the complete required set — there are
> no aliases. `B2_REGION` should match the region segment of your
> `B2_ENDPOINT` (e.g. `us-west-004` for `s3.us-west-004.backblazeb2.com`).

### 3. Apply bucket CORS

Browser → B2 direct uploads need a CORS rule on the bucket. One-shot:

```bash
pnpm setup:cors
```

This applies [`b2CorsRules.json`](b2CorsRules.json) (CORS limited to
`http://localhost:3000` / `:3001` by default — edit for production).

### 4. Run

```bash
pnpm dev
```

Web on `localhost:3000`, API on `localhost:8000`. Open `/synthesize`,
type something, pick a voice, generate.

> The first generation downloads the Kokoro 82M ONNX weights (~80 MB)
> into IndexedDB. Subsequent generations are instant. The model lives
> entirely in the browser — no GPU and no extra infrastructure required.

`pnpm dev` runs `pnpm doctor` first — a preflight that catches the
common setup gotchas (wrong Node/Python, missing venv, missing
or placeholder `.env`, ports already taken).

## Core features

- [TTS Synthesis](docs/features/tts-synthesis.md) — Kokoro 82M in the browser
- [Audio Library](docs/features/audio-library.md) — play / download / delete past generations
- [Voice Picker](docs/features/voice-picker.md) — Kokoro English voices ([audition samples](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX#voicessamples))
- [Dashboard](docs/features/dashboard.md) — generation count, total seconds, weekly activity
- [Design System](docs/design-system.md) — tokens, primitives, AI elements, the blaze generating loader. Live preview at `/design`.

## Tech stack

- TypeScript, Next.js 16, React 19, Tailwind v4, shadcn/ui, Recharts
- [`@huggingface/transformers`](https://www.npmjs.com/package/@huggingface/transformers) v3 — browser-side ONNX inference
- TanStack Query — caching, dedup, retry for every fetch
- Python 3.11+, FastAPI, boto3, Pydantic v2
- Backblaze B2 (S3-compatible object storage) — S3 API, no `b2-native`
- pnpm workspaces (monorepo)

## Commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start frontend + backend |
| `pnpm setup:cors` | Apply `b2CorsRules.json` to your bucket |
| `pnpm dev:web` | Frontend only |
| `pnpm dev:api` | Backend only |
| `pnpm build` | Build frontend |
| `pnpm lint` | Lint frontend |
| `pnpm lint:api` | Lint backend (ruff) |
| `pnpm test:api` | Run backend tests |
| `pnpm check:structure` | Verify layering rules |
| `pnpm test:e2e` | Playwright e2e tests |

## Documentation map

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](AGENTS.md) | Agent table of contents — start here |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System layout, layering, data flows |
| [docs/features/](docs/features/) | Feature docs (tts-synthesis, audio-library, voice-picker, dashboard) |
| [docs/design-system.md](docs/design-system.md) | Tokens, primitives, AI elements, loader, error/empty states |
| [docs/app-workflows.md](docs/app-workflows.md) | User journeys |
| [docs/dev-workflows.md](docs/dev-workflows.md) | Engineering workflows and testing |
| [docs/SECURITY.md](docs/SECURITY.md) | Security principles |
| [docs/RELIABILITY.md](docs/RELIABILITY.md) | Reliability expectations |
| [docs/exec-plans/](docs/exec-plans/) | Execution plans and tech debt tracker |

## License

MIT License — see [LICENSE](LICENSE).

## Claude agent B2 skill

Manage B2 from your terminal using natural language (list/search,
audits, stale or large file detection, security checks, safe cleanup):
[backblaze-b2-samples/claude-skill-b2-cloud-storage](https://github.com/backblaze-b2-samples/claude-skill-b2-cloud-storage).
