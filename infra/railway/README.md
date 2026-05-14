# Railway deployment

Deploy both services (web + api) on Railway.

## Setup

1. Create a new Railway project
2. Add two services from the same repo:

### Web service (Next.js) — `b2-transformersjs-tts-web`
- **Root directory**: `apps/web`
- **Build command**: `pnpm install && pnpm build`
- **Start command**: `pnpm start`
- **Port**: `3000`

### API service (FastAPI) — `b2-transformersjs-tts-api`
- **Root directory**: `services/api`
- **Build command**: `pip install -r requirements.txt`
- **Start command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

## Environment variables

Set these on the API service:

| Variable | Value |
|----------|-------|
| `B2_ENDPOINT` | Your B2 S3 endpoint (e.g. `https://s3.us-west-004.backblazeb2.com`) |
| `B2_REGION` | The matching B2 region (e.g. `us-west-004`) |
| `B2_KEY_ID` | Your B2 application key ID |
| `B2_APPLICATION_KEY` | Your B2 application key |
| `B2_BUCKET_NAME` | The bucket where generations are stored |
| `API_CORS_ORIGINS` | The web service URL (e.g. `https://web-production-xxx.up.railway.app`) |

Set this on the Web service:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | The API service URL (e.g. `https://api-production-xxx.up.railway.app`) |

After the web service is reachable, also update `b2CorsRules.json` to
allow its production origin and re-run `pnpm setup:cors` locally with
your production `.env`.
