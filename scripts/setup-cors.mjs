#!/usr/bin/env node
// Apply b2CorsRules.json to the bucket configured in .env.
//
// Browser → B2 direct uploads need a CORS rule on the bucket; without it
// every PUT from the synthesize page will fail with an opaque CORS error
// even though the presigned URL itself is valid. This script is the
// one-shot fix.
//
// Zero npm dependencies — uses only node:* + the AWS Signature V4 dance
// we already pay for elsewhere via boto. Crypto is built into Node 20+.

import { readFileSync, existsSync } from "node:fs";
import { createHmac, createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const ENV_FILE = resolve(REPO_ROOT, ".env");
const CORS_FILE = resolve(REPO_ROOT, "b2CorsRules.json");

function parseEnvFile(path) {
  const out = {};
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function die(msg) {
  console.error(`setup:cors — ${msg}`);
  process.exit(1);
}

if (!existsSync(ENV_FILE)) die(".env is missing. Run `cp .env.example .env` first.");
if (!existsSync(CORS_FILE)) die("b2CorsRules.json is missing from the repo root.");

const env = parseEnvFile(ENV_FILE);
for (const k of ["B2_ENDPOINT", "B2_REGION", "B2_KEY_ID", "B2_APPLICATION_KEY", "B2_BUCKET_NAME"]) {
  if (!env[k]) die(`.env is missing ${k}.`);
}

const rules = JSON.parse(readFileSync(CORS_FILE, "utf8"));

// --- AWS Signature V4 for `PUT /<bucket>?cors` ---

function hmac(key, data) {
  return createHmac("sha256", key).update(data).digest();
}

function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

function ymdHms(d = new Date()) {
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const datestamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  const amzdate = `${datestamp}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  return { datestamp, amzdate };
}

async function putCors() {
  // The B2 S3 API accepts a standard S3 PutBucketCors XML body. We
  // could shell out to `aws s3api put-bucket-cors`, but committing
  // a tiny self-contained signer keeps the script dependency-free.
  const corsXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n<CORSConfiguration>` +
    rules
      .map((r) => {
        const ops = (r.allowedOperations || []).map((op) => {
          if (op === "s3_put") return "PUT";
          if (op === "s3_get") return "GET";
          if (op === "s3_head") return "HEAD";
          if (op === "s3_delete") return "DELETE";
          if (op === "s3_post") return "POST";
          return op.toUpperCase();
        });
        const origins = (r.allowedOrigins || [])
          .map((o) => `<AllowedOrigin>${o}</AllowedOrigin>`)
          .join("");
        const methods = ops.map((m) => `<AllowedMethod>${m}</AllowedMethod>`).join("");
        const headers = (r.allowedHeaders || [])
          .map((h) => `<AllowedHeader>${h}</AllowedHeader>`)
          .join("");
        const expose = (r.exposeHeaders || [])
          .map((h) => `<ExposeHeader>${h}</ExposeHeader>`)
          .join("");
        const maxAge = r.maxAgeSeconds
          ? `<MaxAgeSeconds>${r.maxAgeSeconds}</MaxAgeSeconds>`
          : "";
        return `<CORSRule>${origins}${methods}${headers}${expose}${maxAge}</CORSRule>`;
      })
      .join("") +
    `</CORSConfiguration>`;

  const endpoint = new URL(env.B2_ENDPOINT);
  const host = endpoint.hostname;
  const path = `/${env.B2_BUCKET_NAME}`;
  const query = "cors=";
  const payloadHash = sha256Hex(corsXml);
  const md5 = createHash("md5").update(corsXml).digest("base64");

  const { datestamp, amzdate } = ymdHms();
  const region = env.B2_REGION;
  const service = "s3";
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${datestamp}/${region}/${service}/aws4_request`;

  const canonicalHeaders =
    `content-md5:${md5}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzdate}\n`;
  const signedHeaders = "content-md5;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest =
    `PUT\n${path}\n${query}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign =
    `${algorithm}\n${amzdate}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`;

  const kDate = hmac(`AWS4${env.B2_APPLICATION_KEY}`, datestamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");

  const authorization =
    `${algorithm} Credential=${env.B2_KEY_ID}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `${env.B2_ENDPOINT.replace(/\/$/, "")}${path}?${query}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-MD5": md5,
      "Content-Type": "application/xml",
      Host: host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzdate,
      Authorization: authorization,
    },
    body: corsXml,
  });

  if (!res.ok) {
    const text = await res.text();
    die(
      `B2 rejected the CORS update (${res.status}). Make sure your key has ` +
        `the \`writeBucketCors\` capability. Raw response:\n${text}`,
    );
  }
}

await putCors();
console.log(`setup:cors — applied b2CorsRules.json to ${env.B2_BUCKET_NAME}`);
