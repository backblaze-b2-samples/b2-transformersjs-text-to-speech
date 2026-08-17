"use client";

import { useState } from "react";
import { Download, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Waveform } from "./waveform";
import { ApiError, getDownloadUrl, getPlaybackUrl } from "@/lib/api-client";
import { useDeleteGeneration } from "@/lib/queries";
import { findVoice } from "@/lib/tts/voices";
import { formatDate, formatDuration } from "@/lib/utils";
import type { Generation } from "@b2-transformersjs-text-to-speech/shared";

interface GenerationCardProps {
  generation: Generation;
}

export function GenerationCard({ generation }: GenerationCardProps) {
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [loadingPlayback, setLoadingPlayback] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteMutation = useDeleteGeneration();

  const voice = generation.voice_id ? findVoice(generation.voice_id) : undefined;

  const handlePlay = async () => {
    if (audioSrc) return;
    setLoadingPlayback(true);
    try {
      const { url } = await getPlaybackUrl(generation.key);
      setAudioSrc(url);
    } catch (err) {
      const detail =
        err instanceof ApiError ? err.message : "Failed to load playback URL";
      toast.error(detail);
    } finally {
      setLoadingPlayback(false);
    }
  };

  const handleDownload = async () => {
    try {
      const { url } = await getDownloadUrl(generation.key);
      window.open(url, "_blank");
    } catch (err) {
      const detail =
        err instanceof ApiError ? err.message : "Failed to get download URL";
      toast.error(detail);
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate(generation.key, {
      onSuccess: () => {
        toast.success("Generation deleted");
        setConfirmDelete(false);
      },
      onError: (err) => {
        const detail =
          err instanceof ApiError ? err.message : "Failed to delete";
        toast.error(detail);
      },
    });
  };

  return (
    <>
      <Card className="card-hover">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium">
                {generation.text_preview ?? generation.key.split("/").pop()}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {voice?.name ?? generation.voice_id ?? "Unknown voice"}
                {voice ? ` · ${voice.language}` : null}
                {" · "}
                {formatDuration(generation.duration_ms)}
                {" · "}
                {formatDate(generation.created_at)}
              </p>
            </div>
          </div>

          <Waveform durationMs={generation.duration_ms} />

          {audioSrc ? (
            <audio controls src={audioSrc} className="w-full" autoPlay />
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePlay}
                disabled={loadingPlayback}
              >
                <Play className="h-3.5 w-3.5" />
                {loadingPlayback ? "Loading..." : "Play"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                className="ml-auto text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete generation?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <code className="font-mono">{generation.key}</code> from B2. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
