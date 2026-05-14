// Kokoro 82M model loader.
//
// Wraps `@huggingface/transformers` so the rest of the UI can stay
// model-agnostic. The first `synthesize()` call pays the ~80 MB ONNX
// download (cached in IndexedDB by Transformers.js for subsequent
// sessions); later calls are instant.
//
// This file is intentionally a thin stub: implementation lands as
// downstream work. The shape below is what `apps/web/src/app/synthesize/`
// expects to import.

export const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

export type ModelDtype = "q8" | "q4" | "fp16";

export interface SynthesizeOptions {
  voiceId: string;
  text: string;
  speed?: number; // 0.5–2.0
  dtype?: ModelDtype; // default `q8`
}

export interface SynthesizeResult {
  /** Float32 PCM mono samples produced by Kokoro. */
  samples: Float32Array;
  sampleRate: number;
  modelId: string;
  voiceId: string;
}

/**
 * Run TTS inference for `text` with the chosen `voiceId`.
 *
 * The real implementation will:
 *   1. Lazy-import `@huggingface/transformers` (kept out of the SSR
 *      bundle — this module is `"use client"` only).
 *   2. Cache a single `KokoroTTS` instance per dtype.
 *   3. Stream chunks for long text and concatenate to one Float32Array.
 *
 * Until that ships, this stub throws so consumers can wire up loading /
 * error states without accidentally shipping silent audio.
 */
export async function synthesize(
  _options: SynthesizeOptions,
): Promise<SynthesizeResult> {
  throw new Error(
    "Kokoro loader not implemented yet — see docs/features/tts-synthesis.md",
  );
}

/**
 * Warm the model so the next `synthesize()` call doesn't pay the
 * download cost. Safe to call repeatedly.
 */
export async function preloadModel(_dtype: ModelDtype = "q8"): Promise<void> {
  // No-op stub. Real implementation: instantiate the pipeline with no
  // input so weights land in IndexedDB.
}
