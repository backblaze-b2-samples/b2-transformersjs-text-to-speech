/// <reference lib="webworker" />

// Kokoro inference worker. Owns the `KokoroTTS` instance so ONNX
// execution stays off the main thread — without this, a multi-second
// `generate()` call freezes navigation, animations, and the spinner.
//
// Protocol: the main thread (see `loader.ts`) sends a request with a
// correlation `id`; this worker posts back exactly one response with
// the same `id`. PCM samples are returned as transferable
// `Float32Array.buffer` to avoid copying ~MBs across the postMessage
// boundary.

import {
  KokoroTTS,
  TextSplitterStream,
  type GenerateOptions,
} from "kokoro-js";

type KokoroVoice = NonNullable<GenerateOptions["voice"]>;

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const LONG_TEXT_THRESHOLD = 400;

type ModelDtype = "q8" | "q4" | "fp16";
type ModelDevice = "wasm" | "webgpu";

// Quantized variants (q4/q8) and fp16 produce garbled audio on the
// WebGPU backend; kokoro-js's README explicitly recommends fp32 there.
// Coerce inside the worker so the user-visible dtype setting can stay
// a WASM-only choice without lying about what actually runs.
type PipelineDtype = ModelDtype | "fp32";

interface SynthesizeRequest {
  id: number;
  type: "synthesize";
  voiceId: string;
  text: string;
  speed: number;
  dtype: ModelDtype;
  device: ModelDevice;
}

interface PreloadRequest {
  id: number;
  type: "preload";
  dtype: ModelDtype;
  device: ModelDevice;
}

export type WorkerRequest = SynthesizeRequest | PreloadRequest;

interface SynthesizeResponse {
  id: number;
  type: "result";
  samples: Float32Array;
  sampleRate: number;
}

interface AckResponse {
  id: number;
  type: "ack";
}

interface ErrorResponse {
  id: number;
  type: "error";
  message: string;
}

export type WorkerResponse = SynthesizeResponse | AckResponse | ErrorResponse;

// Cache pipelines per (dtype, device). Switching either dimension
// means a new ONNX session — keying the cache by both keeps the user's
// previous pick warm if they toggle back.
const pipelineCache = new Map<string, Promise<KokoroTTS>>();

function pipelineCacheKey(dtype: PipelineDtype, device: ModelDevice): string {
  return `${dtype}|${device}`;
}

function effectiveDtype(dtype: ModelDtype, device: ModelDevice): PipelineDtype {
  return device === "webgpu" ? "fp32" : dtype;
}

function getPipeline(
  dtype: ModelDtype,
  device: ModelDevice,
): Promise<KokoroTTS> {
  const resolvedDtype = effectiveDtype(dtype, device);
  const key = pipelineCacheKey(resolvedDtype, device);
  let cached = pipelineCache.get(key);
  if (!cached) {
    cached = KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: resolvedDtype,
      device,
    });
    pipelineCache.set(key, cached);
  }
  return cached;
}

async function runSynthesize(
  req: SynthesizeRequest,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  const tts = await getPipeline(req.dtype, req.device);

  if (req.text.length <= LONG_TEXT_THRESHOLD) {
    const audio = await tts.generate(req.text, {
      voice: req.voiceId as KokoroVoice,
      speed: req.speed,
    });
    return { samples: audio.audio, sampleRate: audio.sampling_rate };
  }

  const splitter = new TextSplitterStream();
  const stream = tts.stream(splitter, {
    voice: req.voiceId as KokoroVoice,
    speed: req.speed,
  });
  splitter.push(req.text);
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
  return { samples, sampleRate };
}

function postError(id: number, err: unknown): void {
  const response: ErrorResponse = {
    id,
    type: "error",
    message: err instanceof Error ? err.message : String(err),
  };
  self.postMessage(response);
}

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  if (req.type === "synthesize") {
    runSynthesize(req).then(
      ({ samples, sampleRate }) => {
        const response: SynthesizeResponse = {
          id: req.id,
          type: "result",
          samples,
          sampleRate,
        };
        self.postMessage(response, [samples.buffer]);
      },
      (err) => postError(req.id, err),
    );
  } else if (req.type === "preload") {
    getPipeline(req.dtype, req.device).then(
      () => {
        const response: AckResponse = { id: req.id, type: "ack" };
        self.postMessage(response);
      },
      (err) => postError(req.id, err),
    );
  }
});
