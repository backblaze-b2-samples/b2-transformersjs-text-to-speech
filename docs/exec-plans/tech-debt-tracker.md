<!-- last_verified: 2026-05-14 -->
# Tech Debt Tracker

Known tech debt items. Agents update this when they discover or create tech debt.

| Description | Impact | Proposed Resolution | Priority | Status |
|---|---|---|---|---|
| README references screenshots that don't exist yet | Docs link to TODO images | Capture `docs/images/synthesize.png`, `library.png`, `dashboard.png` and check them in | Medium | Open |
| Swap to WebGPU backend once Transformers.js stabilizes | TTS latency improves significantly on supported browsers | Pass `device: "webgpu"` in `apps/web/src/lib/tts/loader.ts::getPipeline` behind a feature flag + a toggle in `/settings` | Medium | Open |
| `loader.ts` is a stub that throws | Synthesize button is unwired end-to-end | Implement the real Kokoro pipeline using `@huggingface/transformers` v3 + chunked long-text support | High | Resolved 2026-05-14 — `loader.ts` wraps `kokoro-js` (KokoroTTS + TextSplitterStream); dtype-keyed pipeline cache; chunked path for inputs > 400 chars |
| Pre-existing TS/lint errors block `pnpm build` | `synthesize-form.tsx:160` passes `unknown` into `<ErrorState>` (React rejects); `hooks/use-mobile.ts` calls `setState` synchronously in effect; `lib/utils.ts:32` uses `==` (eqeqeq) | Narrow the `error` state to `Error \| null`; restructure the mobile-breakpoint effect to subscribe-then-read; fix the `==` to `===` | High | Resolved 2026-05-14 — `synthesize-form.tsx` narrows error state to `Error \| null`; `use-mobile.ts` rewritten with `useSyncExternalStore`; `utils.ts` uses explicit `=== null \|\| === undefined` |
| `settings-form.tsx:52` calls `setSettings` synchronously in effect | Blocks `pnpm lint` (same `react-hooks/set-state-in-effect` rule) | Hydrate via lazy `useState` initializer or `useSyncExternalStore` against `localStorage` instead of reading inside the effect | High | Resolved 2026-05-14 — rewritten with `useSyncExternalStore` (subscribe-then-read against `localStorage`) + in-memory draft for unsaved edits; `notifySettingsChange()` refreshes consumers after save/reset |
