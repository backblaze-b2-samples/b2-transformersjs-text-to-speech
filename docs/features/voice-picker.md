<!-- last_verified: 2026-05-18 -->
# Feature: Voice Picker

## Purpose
Let the user choose from the Kokoro 82M voice catalog before
generating audio. The in-browser pipeline is English-only: the
checked-in catalog is restricted to en-US / en-GB because
`kokoro-js` only bundles English voice metadata and a matching
phonemizer (see [Edge cases](#edge-cases)).

## Used by
- UI: `/synthesize` page (inside `SynthesizeForm`)

## Core functions
- `apps/web/src/components/tts/voice-picker.tsx` — the dropdown
- `apps/web/src/lib/tts/voices.ts` — checked-in voice catalog (`VOICES`, `DEFAULT_VOICE_ID`, `findVoice`)

## Canonical files
- Pattern exemplar: `apps/web/src/components/tts/voice-picker.tsx`
- Catalog source: `apps/web/src/lib/tts/voices.ts`

## Inputs
- value: string — the currently selected voice id
- onChange: (id: string) => void — caller setter
- disabled: boolean — disables the dropdown while a generation is in flight

## Outputs
- The selected voice id is passed to `synthesize({voiceId, ...})`
- The same id is written to `x-amz-meta-voice-id` on the B2 object

## Flow
- The dropdown groups voices by language so the menu stays scannable
- Each item shows: voice id (monospace), display name, gender
- Selection updates the parent `SynthesizeForm` state via `onChange`
- On generate the id flows to Kokoro and to the metadata headers in
  the same step

## Edge cases
- **Unknown voice id** (e.g., the user has a stale URL or imported
  state with a voice that's no longer in the catalog) -> `findVoice()`
  returns `undefined`; the UI falls back to "Unknown voice" in cards
- **Voice asset 404 at inference time** -> Transformers.js surfaces an
  error; the form catches it and shows a toast; the user can pick a
  different voice and retry

## UX states
- Default: `DEFAULT_VOICE_ID` selected (`af_heart`)
- Disabled: greyed out while the model is loading / synthesizing /
  uploading
- Open: language-grouped list with sticky group labels

## Verification
- The catalog is data — no dedicated test file beyond the smoke e2e
  (`apps/web/e2e/synthesize.spec.ts`). When you extend the catalog,
  add a Playwright assertion that the new entry shows up.
- Pass criteria: every entry in `VOICES` is reachable by the picker,
  and `findVoice(DEFAULT_VOICE_ID)` returns a defined value.

## Related docs
- [TTS Synthesis](tts-synthesis.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
