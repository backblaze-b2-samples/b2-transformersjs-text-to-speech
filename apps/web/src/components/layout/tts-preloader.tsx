"use client";

// Headless component: when `preloadOnAppLoad` is enabled in settings,
// start fetching the Kokoro ONNX weights as soon as the app mounts so
// the first Generate click on /synthesize doesn't pay the ~80 MB
// download. The worker caches pipelines by (dtype, device), so calling
// `preloadModel` repeatedly is safe — it short-circuits once the
// promise is in flight.

import { useEffect } from "react";

import { preloadModel, resolveDevice } from "@/lib/tts/loader";
import { useTtsSettings } from "@/lib/tts/settings";

export function TtsPreloader() {
  const { preloadOnAppLoad, defaultDtype, useWebGPU } = useTtsSettings();

  useEffect(() => {
    if (!preloadOnAppLoad) return;
    preloadModel(defaultDtype, resolveDevice(useWebGPU)).catch(() => {
      // Surfaced via the synthesize form's error path on the next call —
      // a preload failure shouldn't crash the rest of the app.
    });
  }, [preloadOnAppLoad, defaultDtype, useWebGPU]);

  return null;
}
