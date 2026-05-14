import { SynthesizeForm } from "@/components/tts/synthesize-form";

export default function SynthesizePage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Synthesize</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Type something, pick a voice, and Kokoro will read it back — entirely
          in your browser. The resulting WAV uploads straight to B2.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <SynthesizeForm />
      </div>
    </div>
  );
}
