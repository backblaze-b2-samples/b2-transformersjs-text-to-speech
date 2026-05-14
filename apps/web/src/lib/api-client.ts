import type {
  DailyGenerationCount,
  Generation,
  GenerationStats,
  PlaybackUrlResponse,
  PresignRequest,
  PresignResponse,
} from "@b2-transformersjs-text-to-speech/shared";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Typed API error with HTTP status code for caller-side branching. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** True for 408, 429, 500, 502, 503, 504 — worth retrying. */
  get isRetryable(): boolean {
    return [408, 429, 500, 502, 503, 504].includes(this.status);
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    // Network failure (offline, DNS, CORS, etc.)
    throw new ApiError("Network error — check your connection", 0);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.detail || `API error: ${res.status}`, res.status);
  }
  return res.json();
}

export async function getHealth() {
  return apiFetch<{ status: string; b2_connected: boolean }>("/health");
}

export async function presignUpload(req: PresignRequest) {
  return apiFetch<PresignResponse>("/presign/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}

export async function getLibrary(limit = 100) {
  return apiFetch<Generation[]>(`/library?limit=${limit}`);
}

export async function getLibraryStats() {
  return apiFetch<GenerationStats>("/library/stats");
}

export async function getLibraryActivity(days = 7) {
  return apiFetch<DailyGenerationCount[]>(
    `/library/stats/activity?days=${days}`,
  );
}

export async function getPlaybackUrl(key: string) {
  return apiFetch<PlaybackUrlResponse>(
    `/library/${encodeURI(key)}/playback`,
  );
}

export async function getDownloadUrl(key: string) {
  return apiFetch<PlaybackUrlResponse>(
    `/library/${encodeURI(key)}/download`,
  );
}

export async function deleteGeneration(key: string) {
  return apiFetch<{ deleted: boolean; key: string }>(
    `/library/${encodeURI(key)}`,
    { method: "DELETE" },
  );
}

/**
 * Upload a WAV Blob directly to B2 using a presigned PUT URL.
 *
 * The browser sends every header the API baked into the signature; B2
 * verifies them and writes the object with the same x-amz-meta-* keys
 * the library later reads via HEAD. No audio bytes flow through our
 * API — this fetch goes browser → B2.
 */
export async function uploadToB2(
  presign: PresignResponse,
  blob: Blob,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presign.url);
    for (const [k, v] of Object.entries(presign.headers)) {
      xhr.setRequestHeader(k, v);
    }
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new ApiError(
            `Direct upload to B2 failed: ${xhr.status}`,
            xhr.status,
          ),
        );
      }
    });
    xhr.addEventListener("error", () =>
      reject(new ApiError("Network error during direct upload", 0)),
    );
    xhr.addEventListener("abort", () =>
      reject(new ApiError("Direct upload aborted", 0)),
    );
    xhr.send(blob);
  });
}
