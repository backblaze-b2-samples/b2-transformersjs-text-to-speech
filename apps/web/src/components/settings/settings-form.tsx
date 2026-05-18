"use client";

import { useState } from "react";
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
import { VOICES } from "@/lib/tts/voices";
import type { ModelDtype } from "@/lib/tts/loader";
import {
  isWebGPUAvailable,
  preloadModel,
  resolveDevice,
} from "@/lib/tts/loader";
import {
  resetSettings,
  saveSettings,
  useTtsSettings,
} from "@/lib/tts/settings";
import type { TtsSettings } from "@b2-transformersjs-text-to-speech/shared";

export function SettingsForm() {
  const persisted = useTtsSettings();
  const [draft, setDraft] = useState<TtsSettings | null>(null);
  const settings = draft ?? persisted;
  const webgpuAvailable = isWebGPUAvailable();

  function update<K extends keyof TtsSettings>(key: K, value: TtsSettings[K]) {
    setDraft((prev) => ({ ...(prev ?? persisted), [key]: value }));
  }

  function onSave() {
    saveSettings(settings);
    setDraft(null);
    toast.success("Settings saved", {
      description: "Stored locally in this browser.",
    });
    // Honor the preload toggle immediately so the user sees it take effect.
    if (settings.preloadOnAppLoad) {
      preloadModel(
        settings.defaultDtype,
        resolveDevice(settings.useWebGPU),
      ).catch(() => {
        // Worker may not be ready yet; the on-mount preloader will retry.
      });
    }
  }

  function onReset() {
    resetSettings();
    setDraft(null);
    toast.success("Settings reset to defaults");
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
            variants. This setting governs the WASM backend; with WebGPU on, the
            pipeline always uses <span className="font-mono">fp32</span> (kokoro-js&apos;s
            quantized variants produce garbled audio on WebGPU).
          </p>
        </CardContent>
      </Card>

      {/* Acceleration */}
      <Card>
        <CardHeader className="border-b border-border py-4 px-5">
          <CardTitle className="card-title">Acceleration</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex flex-row items-center justify-between rounded-md border border-border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="webgpu-toggle">
                Use WebGPU when available
                <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  experimental
                </span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Runs Kokoro on the GPU instead of WASM — typically 2–5× faster
                on supported browsers (Chrome / Edge on a recent discrete GPU).
                Uses <span className="font-mono">fp32</span> weights (~320 MB,
                downloaded on first use) regardless of the dtype above. Falls
                back to WASM automatically if{" "}
                <span className="font-mono">navigator.gpu</span> isn&apos;t
                available.
                {!webgpuAvailable && (
                  <>
                    {" "}
                    <span className="text-[var(--warning,_#a16207)]">
                      This browser doesn&apos;t expose WebGPU; the setting will
                      have no effect here.
                    </span>
                  </>
                )}
              </p>
            </div>
            <Switch
              id="webgpu-toggle"
              checked={settings.useWebGPU}
              onCheckedChange={(v) => update("useWebGPU", v)}
            />
          </div>
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
