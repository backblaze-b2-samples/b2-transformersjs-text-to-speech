<!-- last_verified: 2026-05-14 -->
# App workflows

User journeys inside the application.

## Synthesize speech

- User navigates to `/synthesize`
- Types text in the composer (max 5000 chars; counter updates live)
- Picks a voice from the language-grouped dropdown (Kokoro English voices, en-US / en-GB)
- Adjusts speed (0.5x – 1.5x)
- Clicks **Generate**
  - First time: browser downloads the Kokoro 82M ONNX weights (~80 MB)
    into IndexedDB — Transformers.js handles caching. The button shows
    "Loading model..." during this one-time download.
  - Subsequent calls: instant.
- Tokenize + infer in-browser; result is a Float32 PCM mono buffer
- Encode WAV in-browser (16-bit PCM, 24 kHz)
- Inline preview appears immediately so the user can listen before saving
- POST `/presign/upload` with text length, duration, voice id, model id
- Browser PUTs the WAV directly to B2 using the signed URL +
  `x-amz-meta-*` headers from the response
- On success: toast confirms the B2 key; the dashboard and library
  caches invalidate so new data shows up immediately
- See: [TTS Synthesis](features/tts-synthesis.md)

## Browse and manage the library

- User navigates to `/library`
- Page loads `GET /library` — service issues `list_objects_v2` +
  `head_object` against `generations/`
- Generations render as cards (newest first), each with text preview,
  voice, duration, created-at, and a static waveform stub
- **Play** — fetches a fresh presigned GET URL and renders an
  `<audio>` element
- **Download** — fetches a presigned GET URL with
  `Content-Disposition: attachment`
- **Delete** — confirmation dialog -> `DELETE /library/{key}` ->
  TanStack Query invalidates library + stats so the card disappears
- Empty bucket shows "Nothing here yet" with a CTA to the Synthesize page
- See: [Audio Library](features/audio-library.md)

## View dashboard

- User navigates to `/` (home)
- Three parallel API calls: stats (`GET /library/stats`), recent
  generations (`GET /library?limit=10`), 7-day activity
  (`GET /library/stats/activity?days=7`)
- Stats cards: total generations, total seconds of audio, generated today
- Activity chart: bar chart of generations per day for the last week
- Recent generations table: last 10, sorted newest-first
- Empty state: "No generations yet" / "No activity yet"
- See: [Dashboard](features/dashboard.md)
