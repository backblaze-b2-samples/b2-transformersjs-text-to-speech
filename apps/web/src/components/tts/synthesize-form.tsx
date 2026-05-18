"use client";

import { useState } from "react";
import { Loader2, Mic2, UploadCloud, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/ui/error-state";
import { VoicePicker } from "./voice-picker";
import { ApiError, presignUpload, uploadToB2 } from "@/lib/api-client";
import { useRefresh } from "@/lib/refresh-context";
import { DEFAULT_VOICE_ID } from "@/lib/tts/voices";
import { MODEL_ID, synthesize } from "@/lib/tts/loader";
import { durationMs, encodeWav } from "@/lib/tts/wav";
import type { GenerationStatus } from "@b2-transformersjs-text-to-speech/shared";

const MAX_CHARS = 5000;

export function SynthesizeForm() {
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState<string>(DEFAULT_VOICE_ID);
  const [speed, setSpeed] = useState(1);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const { triggerRefresh } = useRefresh();

  const busy = status === "loading-model" || status === "synthesizing" || status === "uploading";

  async function onSynthesize() {
    if (!text.trim()) {
      toast.error("Type something to synthesize first.");
      return;
    }
    setError(null);
    setStatus("loading-model");
    setAudioUrl(null);

    try {
      setStatus("synthesizing");
      const result = await synthesize({ voiceId, text, speed });
      const wav = encodeWav(result.samples, { sampleRate: result.sampleRate });
      const dur = durationMs(result.samples, result.sampleRate);

      // Local preview before upload — gives the user instant feedback
      // even if B2 is slow.
      setAudioUrl(URL.createObjectURL(wav));

      setStatus("uploading");
      setProgress(0);
      const presigned = await presignUpload({
        voice_id: voiceId,
        char_count: text.length,
        duration_ms: dur,
        model_id: MODEL_ID,
        text_preview: text.slice(0, 200),
      });
      await uploadToB2(presigned, wav, setProgress);

      setStatus("complete");
      toast.success("Saved to B2", {
        description: presigned.key,
      });
      triggerRefresh();
    } catch (err) {
      // Catch every failure mode — including the stubbed `synthesize()` that
      // throws "pipeline not yet wired" — and surface it as an inline
      // ErrorState so the page never throws into the React tree.
      setStatus("error");
      setError(err instanceof Error ? err : new Error(String(err)));
      const detail =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Synthesis failed";
      toast.error(detail);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Compose</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="space-y-2">
          <Label htmlFor="tts-text">Text</Label>
          <Textarea
            id="tts-text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Type what Kokoro should read aloud..."
            rows={6}
            disabled={busy}
            className="resize-y"
          />
          <p className="text-xs text-muted-foreground tabular-nums">
            {text.length} / {MAX_CHARS}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="space-y-2">
            <Label>Voice</Label>
            <VoicePicker value={voiceId} onChange={setVoiceId} disabled={busy} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tts-speed">
              Speed <span className="font-mono text-xs text-muted-foreground">({speed.toFixed(2)}x)</span>
            </Label>
            <input
              id="tts-speed"
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              disabled={busy}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={onSynthesize} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic2 className="h-4 w-4" />}
            {status === "loading-model" && "Loading model..."}
            {status === "synthesizing" && "Synthesizing..."}
            {status === "uploading" && `Uploading ${progress}%`}
            {(status === "idle" || status === "complete" || status === "error") && "Generate"}
          </Button>
          {status === "uploading" && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <UploadCloud className="h-3.5 w-3.5" />
              browser → B2 direct
            </span>
          )}
          {status === "complete" && (
            <span className="flex items-center gap-1 text-xs text-[var(--success)]">
              <Save className="h-3.5 w-3.5" />
              saved
            </span>
          )}
        </div>

        {audioUrl && (
          <div className="space-y-2">
            <Label>Preview</Label>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- generated TTS */}
            <audio controls src={audioUrl} className="w-full" />
          </div>
        )}

        {status === "error" && error && (
          <ErrorState
            error={error}
            title="Can't synthesize yet"
            onRetry={() => {
              setError(null);
              setStatus("idle");
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
