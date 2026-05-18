// Kokoro 82M model loader.
//
// Spawns a dedicated Web Worker (see `synthesis.worker.ts`) that owns
// the `kokoro-js` pipeline and runs ONNX inference off the main thread.
// Without the worker, a multi-second `generate()` call freezes the
// whole tab — clicks, animations, and route changes all stall until
// the synth finishes. With the worker, the main thread stays free.
//
// The first `synthesize()` call still pays the ~80 MB ONNX download
// (cached in IndexedDB by Transformers.js for subsequent sessions);
// later calls are instant.

import type {
  WorkerRequest,
  WorkerResponse,
} from "./synthesis.worker";

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

let worker: Worker | null = null;
let nextRequestId = 0;
const pending = new Map<
  number,
  { resolve: (response: WorkerResponse) => void; reject: (err: Error) => void }
>();

function getWorker(): Worker {
  if (worker) return worker;
  if (typeof window === "undefined") {
    throw new Error("Kokoro synthesis worker is only available in the browser.");
  }
  worker = new Worker(new URL("./synthesis.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    const data = event.data;
    const handler = pending.get(data.id);
    if (!handler) return;
    pending.delete(data.id);
    if (data.type === "error") {
      handler.reject(new Error(data.message));
    } else {
      handler.resolve(data);
    }
  });
  // If the worker crashes outright (e.g., WASM init failure), reject
  // every in-flight request so the UI gets a real error instead of
  // hanging on a button labeled "Synthesizing…".
  worker.addEventListener("error", (event: ErrorEvent) => {
    const err = new Error(event.message || "Synthesis worker crashed");
    for (const handler of pending.values()) handler.reject(err);
    pending.clear();
  });
  return worker;
}

function sendRequest<T extends WorkerResponse>(
  build: (id: number) => WorkerRequest,
): Promise<T> {
  const id = ++nextRequestId;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, {
      resolve: (response) => resolve(response as T),
      reject,
    });
    getWorker().postMessage(build(id));
  });
}

export async function synthesize(
  options: SynthesizeOptions,
): Promise<SynthesizeResult> {
  const { voiceId, text, speed = 1, dtype = "q8" } = options;
  if (!text.trim()) {
    throw new Error("Cannot synthesize empty text.");
  }

  const response = await sendRequest<
    Extract<WorkerResponse, { type: "result" }>
  >((id) => ({
    id,
    type: "synthesize",
    voiceId,
    text,
    speed,
    dtype,
  }));

  return {
    samples: response.samples,
    sampleRate: response.sampleRate,
    modelId: MODEL_ID,
    voiceId,
  };
}

/**
 * Warm the model so the next `synthesize()` call doesn't pay the
 * download cost. Safe to call repeatedly.
 */
export async function preloadModel(dtype: ModelDtype = "q8"): Promise<void> {
  await sendRequest<Extract<WorkerResponse, { type: "ack" }>>((id) => ({
    id,
    type: "preload",
    dtype,
  }));
}
