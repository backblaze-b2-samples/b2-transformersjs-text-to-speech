// Full English voice catalog bundled by Kokoro 82M v1.0 via `kokoro-js`.
//
// The Kokoro model itself ships voices for ~10 languages, but
// `kokoro-js` only bundles the English (en-US / en-GB) voice metadata
// and its `_validate_voice()` rejects anything outside that dict —
// passing e.g. `jf_alpha` makes `tts.generate()` throw. Adding
// non-English voices requires shipping a browser-safe phonemizer for
// the target locale (the bundled phonemizer hard-codes en-us / en-gb
// via the first letter of the voice id).
//
// This catalog mirrors `kokoro-js`'s bundled VOICES dict 1:1 — all 28
// English entries (20 en-US, 8 en-GB). Quality varies (see the
// `overallGrade` field on the upstream voices.d.ts); we expose the
// full set and let the user audition them.
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
  // en-US female (af_*) — Heart is the default and leads the group.
  { id: "af_heart", name: "Heart", language: "English (US)", locale: "en-US", gender: "female" },
  { id: "af_alloy", name: "Alloy", language: "English (US)", locale: "en-US", gender: "female" },
  { id: "af_aoede", name: "Aoede", language: "English (US)", locale: "en-US", gender: "female" },
  { id: "af_bella", name: "Bella", language: "English (US)", locale: "en-US", gender: "female" },
  { id: "af_jessica", name: "Jessica", language: "English (US)", locale: "en-US", gender: "female" },
  { id: "af_kore", name: "Kore", language: "English (US)", locale: "en-US", gender: "female" },
  { id: "af_nicole", name: "Nicole", language: "English (US)", locale: "en-US", gender: "female" },
  { id: "af_nova", name: "Nova", language: "English (US)", locale: "en-US", gender: "female" },
  { id: "af_river", name: "River", language: "English (US)", locale: "en-US", gender: "female" },
  { id: "af_sarah", name: "Sarah", language: "English (US)", locale: "en-US", gender: "female" },
  { id: "af_sky", name: "Sky", language: "English (US)", locale: "en-US", gender: "female" },
  // en-US male (am_*)
  { id: "am_adam", name: "Adam", language: "English (US)", locale: "en-US", gender: "male" },
  { id: "am_echo", name: "Echo", language: "English (US)", locale: "en-US", gender: "male" },
  { id: "am_eric", name: "Eric", language: "English (US)", locale: "en-US", gender: "male" },
  { id: "am_fenrir", name: "Fenrir", language: "English (US)", locale: "en-US", gender: "male" },
  { id: "am_liam", name: "Liam", language: "English (US)", locale: "en-US", gender: "male" },
  { id: "am_michael", name: "Michael", language: "English (US)", locale: "en-US", gender: "male" },
  { id: "am_onyx", name: "Onyx", language: "English (US)", locale: "en-US", gender: "male" },
  { id: "am_puck", name: "Puck", language: "English (US)", locale: "en-US", gender: "male" },
  { id: "am_santa", name: "Santa", language: "English (US)", locale: "en-US", gender: "male" },
  // en-GB female (bf_*)
  { id: "bf_alice", name: "Alice", language: "English (UK)", locale: "en-GB", gender: "female" },
  { id: "bf_emma", name: "Emma", language: "English (UK)", locale: "en-GB", gender: "female" },
  { id: "bf_isabella", name: "Isabella", language: "English (UK)", locale: "en-GB", gender: "female" },
  { id: "bf_lily", name: "Lily", language: "English (UK)", locale: "en-GB", gender: "female" },
  // en-GB male (bm_*)
  { id: "bm_daniel", name: "Daniel", language: "English (UK)", locale: "en-GB", gender: "male" },
  { id: "bm_fable", name: "Fable", language: "English (UK)", locale: "en-GB", gender: "male" },
  { id: "bm_george", name: "George", language: "English (UK)", locale: "en-GB", gender: "male" },
  { id: "bm_lewis", name: "Lewis", language: "English (UK)", locale: "en-GB", gender: "male" },
];

export const DEFAULT_VOICE_ID: KokoroVoiceId = "af_heart";

export function findVoice(id: string): Voice | undefined {
  return VOICES.find((v) => v.id === id);
}
