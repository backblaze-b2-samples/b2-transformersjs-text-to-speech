<!-- last_verified: 2026-05-18 -->
# Security

Security principles and implementation for `b2-transformersjs-text-to-speech`.

## Trust boundaries

- **Frontend -> API**: CORS-restricted to configured origins, scoped to `GET/POST/DELETE/OPTIONS`
- **API -> B2**: Authenticated via `B2_KEY_ID` + `B2_APPLICATION_KEY`, signature v4
- **Browser -> B2 (direct)**: Short-lived presigned URLs only. The
  PUT URL signs `Content-Type` and every `x-amz-meta-*` header; the
  browser cannot change those without invalidating the signature.

## No audio bytes through the API

This sample uploads synthesized audio **directly** from the browser to
B2 via presigned PUT URLs. The application server never receives audio
bytes, so the API cannot be a vector for malicious uploads, large-file
DoS, or audio re-encoding bugs. The only audit point on the upload
path is `generate_presigned_url(...)` in `repo/b2_client.py`.

## Presigned URL hardening

- **TTL**: defaults to 10 minutes (`PRESIGN_EXPIRES_IN`). Long enough to
  recover from a slow network, short enough that a leaked URL is
  near-useless.
- **PUT signing scope**: the API computes the object key (`generations/yyyy/mm/<uuid>.wav`)
  server-side and signs it directly. The browser cannot smuggle a `..`
  or absolute path through the request body.
- **Metadata is signed**: every `x-amz-meta-*` value the API wants on
  the resulting object is baked into the PUT signature, so the browser
  cannot silently strip or change them.

## Key validation (library)

- Empty keys rejected
- Path traversal patterns rejected (`../`, `%2e%2e`, backslashes, null bytes)
- Keys must match `^generations/\d{4}/\d{2}/[0-9a-f]+\.wav$` — anything
  else (alternative extensions, uppercase hex, non-zero-padded months)
  is rejected before reaching B2

## Bucket CORS

`b2CorsRules.json` in the repo root is the source of truth. The API
applies it to the configured bucket at startup (FastAPI lifespan →
`app/service/cors.py` → `repo.b2_client.put_bucket_cors`), so the rule
moves in lockstep with the code. The default allows `s3_put`,
`s3_get`, `s3_head`, `s3_delete` from `http://localhost:3000` /
`:3001` only — edit it for production deployments. The application
key needs `writeBucketCors`; the API fails fast at boot if the call is
rejected.

> If you set `allowedOrigins: ["*"]` while ALSO writing from the
> browser, you've created a public write endpoint for anyone in the
> world. The b2-doctor skill flags this as ⚠️.

## Download safety

- The download endpoint forces `Content-Disposition: attachment`
- Playback URLs (no disposition) are still safe because the served
  content is always `audio/wav` produced by Kokoro

## Secrets management

- All secrets loaded via environment variables (pydantic-settings)
- Never committed to source control
- `.env.example` documents required variables without values
- `.gitignore` blocks `.env`, `.env.local`, `.env.*.local`

## Agent security rules

- Never commit `.env`, credentials, or API keys
- Never weaken validation without explicit instruction
- Never bypass CORS, auth, or input sanitization
- Always validate at system boundaries
