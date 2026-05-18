// Kokoro 82M model loader.
//
// Wraps `kokoro-js` (which itself wraps `@huggingface/transformers`) so
// the rest of the UI can stay model-agnostic. The first `synthesize()`
// call pays the ~80 MB ONNX download (cached in IndexedDB by
// Transformers.js for subsequent sessions); later calls are instant.

import type { GenerateOptions, KokoroTTS as KokoroTTSType } from "kokoro-js";

// kokoro-js types `voice` as a finite literal union of voices it ships
// with. The Kokoro model itself accepts more voice IDs at runtime, and
// our `voices.ts` catalog includes a few extras (Japanese, Mandarin,
// etc.). This alias keeps the rest of the file honest about the cast.
type KokoroVoice = NonNullable<GenerateOptions["voice"]>;

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

// Chunk long inputs so we never sit on a 30-second blocking inference
// call. Kokoro generates ~real-time on WASM, so each chunk under this
// length keeps the UI thread responsive between segments.
const LONG_TEXT_THRESHOLD = 400;

// One pipeline instance per dtype. Reusing the instance is what makes
// the 2nd+ synthesize() calls instant — switching dtype would force a
// fresh ONNX load.
const pipelineCache = new Map<ModelDtype, Promise<KokoroTTSType>>();

async function getPipeline(dtype: ModelDtype): Promise<KokoroTTSType> {
  let cached = pipelineCache.get(dtype);
  if (!cached) {
    // Lazy-import keeps the ~MB of WASM glue out of the SSR bundle.
    cached = import("kokoro-js").then(({ KokoroTTS }) =>
      KokoroTTS.from_pretrained(MODEL_ID, { dtype, device: "wasm" }),
    );
    pipelineCache.set(dtype, cached);
  }
  return cached;
}

export async function synthesize(
  options: SynthesizeOptions,
): Promise<SynthesizeResult> {
  const { voiceId, text, speed = 1, dtype = "q8" } = options;
  if (!text.trim()) {
    throw new Error("Cannot synthesize empty text.");
  }

  const tts = await getPipeline(dtype);

  if (text.length <= LONG_TEXT_THRESHOLD) {
    const audio = await tts.generate(text, {
      voice: voiceId as KokoroVoice,
      speed,
    });
    return {
      samples: audio.audio,
      sampleRate: audio.sampling_rate,
      modelId: MODEL_ID,
      voiceId,
    };
  }

  // Long text: stream sentence-sized chunks and concatenate. We collect
  // first so the WAV encoder gets one contiguous Float32Array, matching
  // the short-text path's contract.
  const { TextSplitterStream } = await import("kokoro-js");
  const splitter = new TextSplitterStream();
  const stream = tts.stream(splitter, {
    voice: voiceId as KokoroVoice,
    speed,
  });
  splitter.push(text);
  splitter.close();

  const chunks: Float32Array[] = [];
  let sampleRate = 24000;
  for await (const { audio } of stream) {
    chunks.push(audio.audio);
    sampleRate = audio.sampling_rate;
  }

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const samples = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    samples.set(c, offset);
    offset += c.length;
  }

  return { samples, sampleRate, modelId: MODEL_ID, voiceId };
}

/**
 * Warm the model so the next `synthesize()` call doesn't pay the
 * download cost. Safe to call repeatedly.
 */
export async function preloadModel(dtype: ModelDtype = "q8"): Promise<void> {
  await getPipeline(dtype);
}
