<!-- last_verified: 2026-05-14 -->
# Reliability

Reliability expectations and practices for this project.

## Health checks

- `GET /health` verifies B2 connectivity and returns `healthy` or `degraded`
- Health endpoint is always available, even when B2 is down

## Error handling

- HTTP handlers return structured error responses with appropriate status codes
- External service failures (B2) are caught and surfaced as 500/503 responses
- No unhandled exceptions leak stack traces to clients

## Logging

- Structured JSON logging via Python stdlib
- Every request gets a `request_id` for tracing
- Log levels: ERROR for failures, WARNING for degraded state, INFO for requests

## Observability

- Request timing middleware logs duration for every request
- `/metrics` endpoint exposes basic Prometheus-format counters
- Presigned-URL issuance counts tracked

## Browser-side failure modes

- **Model-load failure** — the first generation downloads ~80 MB of
  ONNX weights into IndexedDB. On a flaky network this can fail
  mid-download. The UI surfaces the error and the user can retry; the
  partial download is discarded by Transformers.js.
- **Stalled inference** — long inputs (> ~1000 characters) can run for
  several seconds even on a fast laptop. The UI shows a spinner and
  disables the generate button.
- **Network failure mid-PUT** — direct-upload PUTs are retried by the
  browser only via user retry; we surface a toast with the failure so
  the user can re-trigger. Presigned URLs are valid for 10 minutes by
  default so a quick retry succeeds without re-signing.

## API failure modes

- **B2 signing failure** — presign endpoint returns 500; the UI shows
  an ErrorState with the message and a retry button.
- **B2 list/head failure** — library endpoint returns 500 with
  `Internal server error`; raw failure details are NOT leaked to the
  client.

## Graceful degradation

- Library list returns empty array (not error) when B2 has no objects
  under the generations/ prefix
- Frontend shows skeleton states while loading, error states on failure
- `head_object` failures on individual listed keys are skipped rather
  than failing the whole library response — a transient consistency
  artifact shouldn't blank the page

## Deployment

- Railway health checks on `/health`
- Zero-downtime deploys via rolling updates
- Environment-specific configuration via env vars (no config files in prod)
