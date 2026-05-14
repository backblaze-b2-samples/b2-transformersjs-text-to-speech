// Shared types between the FastAPI service (mirrored in
// app/types/*.py) and the Next.js frontend. Keep these in lockstep:
// the API's Pydantic models are the source of truth.

export type GenerationStatus =
  | "idle"
  | "loading-model"
  | "synthesizing"
  | "uploading"
  | "complete"
  | "error";

export interface Voice {
  /** Stable identifier passed to the model (e.g. `af_heart`). */
  id: string;
  name: string;
  language: string;
  /** ISO 639-1 + region; used for the flag picker. */
  locale: string;
  gender: "female" | "male" | "neutral";
}

export interface Generation {
  key: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  created_at: string;
  voice_id: string | null;
  char_count: number | null;
  duration_ms: number | null;
  model_id: string | null;
  text_preview: string | null;
}

export interface GenerationStats {
  total_generations: number;
  total_seconds: number;
  generations_today: number;
}

export interface DailyGenerationCount {
  date: string;
  generations: number;
}

export interface PresignRequest {
  voice_id?: string;
  char_count?: number;
  duration_ms?: number;
  model_id?: string;
  text_preview?: string;
}

export interface PresignResponse {
  url: string;
  key: string;
  method: "PUT";
  expires_in: number;
  /** Headers the browser MUST send on the PUT — content-type plus
   *  x-amz-meta-* values that were baked into the signature. */
  headers: Record<string, string>;
}

export interface PlaybackUrlResponse {
  url: string;
  expires_in: number;
}
