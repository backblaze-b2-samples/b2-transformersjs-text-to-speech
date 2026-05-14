"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_VOICE_ID, VOICES } from "@/lib/tts/voices";
import type { ModelDtype } from "@/lib/tts/loader";
import { preloadModel } from "@/lib/tts/loader";
import type { TtsSettings } from "@b2-transformersjs-text-to-speech/shared";

const STORAGE_KEY = "b2-tts:settings";

const DEFAULTS: TtsSettings = {
  defaultVoice: DEFAULT_VOICE_ID,
  defaultDtype: "q8",
  preloadOnAppLoad: false,
};

function loadSettings(): TtsSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<TtsSettings>;
    return {
      defaultVoice: parsed.defaultVoice ?? DEFAULTS.defaultVoice,
      defaultDtype: parsed.defaultDtype ?? DEFAULTS.defaultDtype,
      preloadOnAppLoad: parsed.preloadOnAppLoad ?? DEFAULTS.preloadOnAppLoad,
    };
  } catch {
    return DEFAULTS;
  }
}

export function SettingsForm() {
  const [settings, setSettings] = useState<TtsSettings>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setHydrated(true);
  }, []);

  function update<K extends keyof TtsSettings>(key: K, value: TtsSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function onSave() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
    toast.success("Settings saved", {
      description: "Stored locally in this browser.",
    });
    // Honor the preload toggle immediately so the user sees it take effect.
    if (settings.preloadOnAppLoad) {
      preloadModel(settings.defaultDtype).catch(() => {
        // preloadModel is a no-op stub today; ignore errors.
      });
    }
  }

  function onReset() {
    setSettings(DEFAULTS);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    toast.success("Settings reset to defaults");
  }

  if (!hydrated) {
    // Avoid SSR/CSR mismatch — localStorage reads only happen on the client.
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Voice */}
      <Card>
        <CardHeader className="border-b border-border py-4 px-5">
          <CardTitle className="card-title">Default voice</CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-2">
          <Label htmlFor="default-voice">Voice</Label>
          <Select
            value={settings.defaultVoice}
            onValueChange={(v) => update("defaultVoice", v)}
          >
            <SelectTrigger id="default-voice" className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICES.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name} — {v.language}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Pre-selected on the Synthesize page. You can still pick a different
            voice per generation.
          </p>
        </CardContent>
      </Card>

      {/* Model quantization */}
      <Card>
        <CardHeader className="border-b border-border py-4 px-5">
          <CardTitle className="card-title">Model quantization</CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-3">
          <Label>Default dtype</Label>
          <RadioGroup
            value={settings.defaultDtype}
            onValueChange={(v) => update("defaultDtype", v as ModelDtype)}
            className="flex flex-wrap gap-6"
          >
            {(
              [
                { id: "q4", label: "q4 — smallest (~40 MB), lowest fidelity" },
                { id: "q8", label: "q8 — balanced (~80 MB), recommended" },
                { id: "fp16", label: "fp16 — largest (~160 MB), highest fidelity" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <RadioGroupItem value={opt.id} />
                <span className="font-mono text-xs">{opt.id}</span>
                <span className="text-muted-foreground">— {opt.label.split("— ")[1]}</span>
              </label>
            ))}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            Kokoro on Transformers.js ships <span className="font-mono">q4</span>,{" "}
            <span className="font-mono">q8</span>, and <span className="font-mono">fp16</span>{" "}
            variants. Full-precision (fp32) is too large for the browser.
          </p>
        </CardContent>
      </Card>

      {/* Preload */}
      <Card>
        <CardHeader className="border-b border-border py-4 px-5">
          <CardTitle className="card-title">Preload</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex flex-row items-center justify-between rounded-md border border-border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="preload-toggle">Preload model on app load</Label>
              <p className="text-xs text-muted-foreground">
                Starts downloading the ONNX weights when the app first mounts so
                the first Generate click is instant. Costs bandwidth up front.
              </p>
            </div>
            <Switch
              id="preload-toggle"
              checked={settings.preloadOnAppLoad}
              onCheckedChange={(v) => update("preloadOnAppLoad", v)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onReset}>
          Reset
        </Button>
        <Button type="button" onClick={onSave}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
