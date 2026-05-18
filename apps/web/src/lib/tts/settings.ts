"use client";

// Shared TTS settings store.
//
// Settings are written by /settings and read by every TTS consumer
// (the synthesize form, the preloader, the worker call sites). They
// live in `localStorage` under a single key so the user's choices
// survive a reload, and they're exposed to React via
// `useSyncExternalStore` so a save on /settings re-renders consumers
// in this tab without a full reload.
//
// Cross-tab updates fire the native `storage` event; in-tab updates
// (the common case) bypass that event, so save/reset call
// `notifySettingsChange()` to wake local subscribers.

import { useSyncExternalStore } from "react";

import type { TtsSettings } from "@b2-transformersjs-text-to-speech/shared";

import { DEFAULT_VOICE_ID } from "./voices";

export const SETTINGS_STORAGE_KEY = "b2-tts:settings";

export const DEFAULT_SETTINGS: TtsSettings = {
  defaultVoice: DEFAULT_VOICE_ID,
  defaultDtype: "q8",
  useWebGPU: false,
  preloadOnAppLoad: false,
};

function readSettings(): TtsSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<TtsSettings>;
    return {
      defaultVoice: parsed.defaultVoice ?? DEFAULT_SETTINGS.defaultVoice,
      defaultDtype: parsed.defaultDtype ?? DEFAULT_SETTINGS.defaultDtype,
      useWebGPU: parsed.useWebGPU ?? DEFAULT_SETTINGS.useWebGPU,
      preloadOnAppLoad:
        parsed.preloadOnAppLoad ?? DEFAULT_SETTINGS.preloadOnAppLoad,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const listeners = new Set<() => void>();

function notifySettingsChange() {
  for (const cb of listeners) cb();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

// `useSyncExternalStore` requires a stable snapshot reference between
// reads when the underlying value hasn't changed. Cache by the raw
// localStorage string so consecutive reads return the same object.
let cachedRaw: string | null = null;
let cachedSnapshot: TtsSettings = DEFAULT_SETTINGS;

function getSnapshot(): TtsSettings {
  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  cachedSnapshot = readSettings();
  return cachedSnapshot;
}

function getServerSnapshot(): TtsSettings {
  return DEFAULT_SETTINGS;
}

export function useTtsSettings(): TtsSettings {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function saveSettings(next: TtsSettings): void {
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  notifySettingsChange();
}

export function resetSettings(): void {
  window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
  notifySettingsChange();
}
