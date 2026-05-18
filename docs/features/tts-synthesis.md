<!-- last_verified: 2026-05-18 -->
# Feature: TTS Synthesis

## Purpose
Run text-to-speech in the user's browser via Kokoro 82M and store the
resulting WAV directly in Backblaze B2 — zero server inference cost, no
audio bytes routed through the API.

## Used by
- UI: `/synthesize` page
- API: `POST /presign/upload`

## Core functions
- `apps/web/src/components/tts/synthesize-form.tsx` — page-level form
- `apps/web/src/components/tts/voice-picker.tsx` — Kokoro voice catalog picker
- `apps/web/src/lib/tts/loader.ts` — main-thread client that proxies requests to the worker (singleton `Worker`, correlation-id message protocol)
- `apps/web/src/lib/tts/synthesis.worker.ts` — Web Worker that owns the `kokoro-js` pipeline; runs ONNX inference off the main thread and chunks long text via `TextSplitterStream`
- `apps/web/src/lib/tts/wav.ts` — Float32 PCM → 16-bit WAV blob
- `apps/web/src/lib/tts/voices.ts` — curated voice catalog
- `apps/web/src/lib/api-client.ts::presignUpload` — request signed PUT URL
- `apps/web/src/lib/api-client.ts::uploadToB2` — browser → B2 PUT helper
- `services/api/app/runtime/presign.py` — FastAPI route
- `services/api/app/service/presign.py` — key generation + metadata mapping
- `services/api/app/repo/b2_client.py::presign_put` — S3 `generate_presigned_url`

## Canonical files
- Pattern exemplar: `apps/web/src/components/tts/synthesize-form.tsx`
- Repo data access: `services/api/app/repo/b2_client.py::presign_put`

## Inputs
- text: string (≤5000 chars, user input)
- voice_id: string (one of the IDs in `voices.ts`)
- speed: number (0.5–1.5)

## Outputs
- A WAV Blob preview in the page (`<audio>` element)
- An object written to B2 at `generations/<yyyy>/<mm>/<uuid>.wav`
- Object metadata (`x-amz-meta-*`): `voice-id`, `char-count`,
  `duration-ms`, `model-id`, `text-preview`, `generated-at`
- Side effect: TanStack Query invalidates the library + stats so the
  dashboard and library page reflect the new generation

## Flow
- User types text and picks a voice; UI tracks character count
- User clicks **Generate**
- (First time only) Transformers.js downloads Kokoro 82M ONNX weights;
  status shows "Loading model..."
- Browser tokenizes the text and runs ONNX inference for the chosen
  voice inside a dedicated Web Worker, returning a Float32 PCM mono
  buffer (transferred back to the main thread as a transferable
  `ArrayBuffer`, so the page stays responsive throughout)
- `wav.ts::encodeWav` wraps the buffer in a 16-bit WAV at 24 kHz
- Inline `<audio>` element plays the result so the user hears it
  immediately, before upload completes
- Frontend POSTs `/presign/upload` with `{voice_id, char_count, duration_ms, model_id, text_preview}`
- API mints `generations/yyyy/mm/<uuid>.wav` and returns the signed PUT
  URL plus the exact `Content-Type` + `x-amz-meta-*` headers the
  browser must echo
- Browser PUTs the WAV directly to B2; progress is reported via
  `xhr.upload.progress`
- On success, a toast confirms the B2 key and the library / dashboard
  caches invalidate

## Edge cases
- **Long text** -> the loader streams sentence-sized chunks via
  `TextSplitterStream` for inputs > ~400 chars and concatenates the
  resulting Float32Array segments into one buffer before encoding to WAV
- **Empty text** -> the form blocks submission with a toast
- **Model-load failure** -> error toast with retry; user can re-click
  Generate after the network recovers
- **Worker crash** (e.g., WASM init failure) -> `loader.ts` listens
  for the worker's `error` event and rejects every in-flight request,
  so the form surfaces a real error instead of staying stuck on
  "Synthesizing…"
- **Network failure mid-PUT** -> error toast; presigned URL is valid
  for 10 min, retry succeeds without re-signing
- **CORS not configured on the bucket** -> opaque CORS error in
  console; remediation is `pnpm setup:cors`

## UX states
- Idle: form ready, button reads "Generate"
- Loading model: button "Loading model..." + spinner
- Synthesizing: button "Synthesizing..." + spinner
- Uploading: button "Uploading N%" + spinner, "browser → B2 direct" caption
- Complete: success toast, "saved" caption next to the button
- Error: toast with the failure detail

## Verification
- Test files: `services/api/tests/test_presign.py`
- Required cases: signed PUT envelope shape, optional metadata is
  omitted, endpoint returns 200 for valid input
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
- [Voice Picker](voice-picker.md)
- [Audio Library](audio-library.md)
