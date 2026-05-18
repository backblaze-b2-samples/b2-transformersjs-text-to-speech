<!-- last_verified: 2026-05-14 -->
# Tech Debt Tracker

Known tech debt items. Agents update this when they discover or create tech debt.

| Description | Impact | Proposed Resolution | Priority | Status |
|---|---|---|---|---|
| README references screenshots that don't exist yet | Docs link to TODO images | Capture `docs/images/synthesize.png`, `library.png`, `dashboard.png` and check them in | Medium | Open |
| Swap to WebGPU backend once Transformers.js stabilizes | TTS latency improves significantly on supported browsers | Pass `device: "webgpu"` in `apps/web/src/lib/tts/loader.ts::getPipeline` behind a feature flag + a toggle in `/settings` | Medium | Open |
| `loader.ts` is a stub that throws | Synthesize button is unwired end-to-end | Implement the real Kokoro pipeline using `@huggingface/transformers` v3 + chunked long-text support | High | Resolved 2026-05-14 — `loader.ts` wraps `kokoro-js` (KokoroTTS + TextSplitterStream); dtype-keyed pipeline cache; chunked path for inputs > 400 chars |
