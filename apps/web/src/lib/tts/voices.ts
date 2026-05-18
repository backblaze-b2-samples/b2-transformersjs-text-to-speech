// Curated subset of the Kokoro 82M voice catalog.
//
// English-only. The Kokoro model itself ships voices for ~10 languages,
// but `kokoro-js` only bundles the English (en-US / en-GB) voice
// metadata and its `_validate_voice()` rejects anything outside that
// dict — passing e.g. `jf_alpha` makes `tts.generate()` throw. Adding
// non-English voices requires shipping a browser-safe phonemizer for
// the target locale (the bundled phonemizer hard-codes en-us / en-gb
// via the first letter of the voice id).
//
// `id` is the exact voice identifier the model expects, type-checked
// against `kokoro-js`'s `GenerateOptions["voice"]` union so a typo or
// a non-bundled voice fails the build instead of failing at runtime.
// `locale` / `language` / `gender` are for UI rendering only and never
// reach the inference call.

import type { GenerateOptions } from "kokoro-js";

import type { Voice } from "@b2-transformersjs-text-to-speech/shared";

export type KokoroVoiceId = NonNullable<GenerateOptions["voice"]>;

type CatalogEntry = Omit<Voice, "id"> & { id: KokoroVoiceId };

export const VOICES: CatalogEntry[] = [
  { id: "af_heart", name: "Heart", language: "English (US)", locale: "en-US", gender: "female" },
  { id: "af_bella", name: "Bella", language: "English (US)", locale: "en-US", gender: "female" },
  { id: "af_nicole", name: "Nicole", language: "English (US)", locale: "en-US", gender: "female" },
  { id: "af_sarah", name: "Sarah", language: "English (US)", locale: "en-US", gender: "female" },
  { id: "am_adam", name: "Adam", language: "English (US)", locale: "en-US", gender: "male" },
  { id: "am_michael", name: "Michael", language: "English (US)", locale: "en-US", gender: "male" },
  { id: "bf_emma", name: "Emma", language: "English (UK)", locale: "en-GB", gender: "female" },
  { id: "bf_isabella", name: "Isabella", language: "English (UK)", locale: "en-GB", gender: "female" },
  { id: "bm_george", name: "George", language: "English (UK)", locale: "en-GB", gender: "male" },
  { id: "bm_lewis", name: "Lewis", language: "English (UK)", locale: "en-GB", gender: "male" },
];

export const DEFAULT_VOICE_ID: KokoroVoiceId = "af_heart";

export function findVoice(id: string): Voice | undefined {
  return VOICES.find((v) => v.id === id);
}
