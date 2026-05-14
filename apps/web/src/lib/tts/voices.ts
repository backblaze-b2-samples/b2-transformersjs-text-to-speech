// Curated subset of the Kokoro 82M voice catalog. The model itself
// ships 50+ voices; this list is a sensible default that the picker
// renders out-of-the-box. Extend with the IDs in
// `onnx-community/Kokoro-82M-v1.0-ONNX/voices/`.
//
// `id` is the exact voice identifier the model expects. `locale` /
// `language` / `gender` are for UI rendering only and never reach the
// inference call.

import type { Voice } from "@b2-transformersjs-text-to-speech/shared";

export const VOICES: Voice[] = [
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
  { id: "jf_alpha", name: "Alpha", language: "Japanese", locale: "ja-JP", gender: "female" },
  { id: "jm_kumo", name: "Kumo", language: "Japanese", locale: "ja-JP", gender: "male" },
  { id: "zf_xiaobei", name: "Xiaobei", language: "Mandarin", locale: "zh-CN", gender: "female" },
  { id: "zm_yunjian", name: "Yunjian", language: "Mandarin", locale: "zh-CN", gender: "male" },
  { id: "ef_dora", name: "Dora", language: "Spanish", locale: "es-ES", gender: "female" },
  { id: "em_alex", name: "Alex", language: "Spanish", locale: "es-ES", gender: "male" },
  { id: "ff_siwis", name: "Siwis", language: "French", locale: "fr-FR", gender: "female" },
  { id: "hf_alpha", name: "Alpha", language: "Hindi", locale: "hi-IN", gender: "female" },
  { id: "if_sara", name: "Sara", language: "Italian", locale: "it-IT", gender: "female" },
  { id: "pf_dora", name: "Dora", language: "Portuguese", locale: "pt-BR", gender: "female" },
];

export const DEFAULT_VOICE_ID = "af_heart";

export function findVoice(id: string): Voice | undefined {
  return VOICES.find((v) => v.id === id);
}
