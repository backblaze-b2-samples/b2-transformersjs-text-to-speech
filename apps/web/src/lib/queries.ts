"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  deleteGeneration,
  getLibrary,
  getLibraryActivity,
  getLibraryStats,
  getPlaybackUrl,
} from "@/lib/api-client";
import type { Generation } from "@b2-transformersjs-text-to-speech/shared";

// Single source of truth for query keys. Keep these tightly scoped so
// that invalidating "library" doesn't blow away unrelated caches.
export const qk = {
  all: ["b2tts"] as const,
  library: (limit?: number) => [...qk.all, "library", limit ?? 100] as const,
  stats: () => [...qk.all, "stats"] as const,
  activity: (days: number) => [...qk.all, "stats", "activity", days] as const,
  playback: (key: string) => [...qk.all, "playback", key] as const,
};

export function useLibrary(limit = 100) {
  return useQuery<Generation[], ApiError>({
    queryKey: qk.library(limit),
    queryFn: () => getLibrary(limit),
  });
}

export function useLibraryStats() {
  return useQuery({
    queryKey: qk.stats(),
    queryFn: getLibraryStats,
  });
}

export function useLibraryActivity(days = 7) {
  return useQuery({
    queryKey: qk.activity(days),
    queryFn: () => getLibraryActivity(days),
  });
}

export function usePlaybackUrl(key: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.playback(key ?? ""),
    queryFn: () => getPlaybackUrl(key as string),
    enabled: enabled && !!key,
    staleTime: 60_000,
  });
}

export function useDeleteGeneration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => deleteGeneration(key),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.all });
    },
  });
}
