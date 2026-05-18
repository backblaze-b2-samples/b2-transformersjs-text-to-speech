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

interface SynthesizeRequest {
  id: number;
  type: "synthesize";
  voiceId: string;
  text: string;
  speed: number;
  dtype: ModelDtype;
}

interface PreloadRequest {
  id: number;
  type: "preload";
  dtype: ModelDtype;
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

const pipelineCache = new Map<ModelDtype, Promise<KokoroTTS>>();

function getPipeline(dtype: ModelDtype): Promise<KokoroTTS> {
  let cached = pipelineCache.get(dtype);
  if (!cached) {
    cached = KokoroTTS.from_pretrained(MODEL_ID, { dtype, device: "wasm" });
    pipelineCache.set(dtype, cached);
  }
  return cached;
}

async function runSynthesize(
  req: SynthesizeRequest,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  const tts = await getPipeline(req.dtype);

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
    getPipeline(req.dtype).then(
      () => {
        const response: AckResponse = { id: req.id, type: "ack" };
        self.postMessage(response);
      },
      (err) => postError(req.id, err),
    );
  }
});
