#!/usr/bin/env node
// Preflight environment check — runs automatically before `pnpm dev`.
// Surfaces every common starter-kit setup gotcha *before* uvicorn or
// next try to start, with actionable error messages.
//
// Zero dependencies (uses only node:* core modules) so this works on a
// fresh clone before anyone has run `pnpm install`.
//
// Run directly:  node scripts/doctor.mjs
// Run via pnpm:  pnpm doctor

import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = resolve(REPO_ROOT, ".env");
const ENV_EXAMPLE_FILE = resolve(REPO_ROOT, ".env.example");
const VENV_UVICORN = resolve(REPO_ROOT, "services/api/.venv/bin/uvicorn");

// Required minimum versions. Bump as upstream support shifts.
const REQUIRED_NODE_MAJOR = 20;
const REQUIRED_PNPM_MAJOR = 9;
const REQUIRED_PYTHON_MINOR = 11; // 3.11+

const LEGACY_B2_ALIASES = {
  B2_APPLICATION_KEY_ID: ["B2_KEY_ID"],
  B2_REGION: ["B2_ENDPOINT"],
};
const LEGACY_PLACEHOLDERS = [
  "your_key_id",
  "your-key-id",
  "your-key",
  "your-bucket",
];
const B2_REGION_RE = /^[a-z]{2}(?:-[a-z]+)+-\d{3}$/;

// Only Next.js: `pnpm dev` self-heals the API side via scripts/pick-port.mjs,
// so warning about 8000 here would just duplicate dev.sh's own banner.
const PORTS_TO_CHECK = [{ port: 3000, name: "Next.js dev server" }];

const failures = [];
const warnings = [];

function fail(msg, fix) {
  failures.push({ msg, fix });
}

function warn(msg, fix) {
  warnings.push({ msg, fix });
}

function tryExec(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function parseSemver(s) {
  // Pulls "v20.10.0" / "20.10.0" / "9.15.0" / "Python 3.13.5" — lenient.
  const match = s.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return { major: +match[1], minor: +match[2], patch: +match[3] };
}

// ----- Tool versions -----

function checkNode() {
  const v = parseSemver(process.version);
  if (!v || v.major < REQUIRED_NODE_MAJOR) {
    fail(
      `Node ${process.version} is too old (need >= ${REQUIRED_NODE_MAJOR}.0.0)`,
      `Install a current Node via nvm/fnm: \`nvm install ${REQUIRED_NODE_MAJOR}\``,
    );
  }
}

function checkPnpm() {
  const out = tryExec("pnpm --version");
  if (!out) {
    fail("pnpm is not installed", "Install via corepack: `corepack enable && corepack prepare pnpm@latest --activate`");
    return;
  }
  const v = parseSemver(out);
  if (!v || v.major < REQUIRED_PNPM_MAJOR) {
    fail(
      `pnpm ${out} is too old (need >= ${REQUIRED_PNPM_MAJOR})`,
      `Run: \`corepack prepare pnpm@latest --activate\``,
    );
  }
}

function checkPython() {
  // Try python3 first (the canonical name on macOS / most Linux), fall
  // back to python (Windows or pyenv shim).
  const out = tryExec("python3 --version") ?? tryExec("python --version");
  if (!out) {
    fail(
      "Python is not on PATH",
      "Install Python 3.11+ from https://python.org or via pyenv",
    );
    return;
  }
  const v = parseSemver(out);
  if (!v || v.major < 3 || v.minor < REQUIRED_PYTHON_MINOR) {
    fail(
      `${out} is too old (need >= 3.${REQUIRED_PYTHON_MINOR})`,
      `Install Python 3.${REQUIRED_PYTHON_MINOR}+ via pyenv: \`pyenv install 3.${REQUIRED_PYTHON_MINOR}\``,
    );
  }
}

// ----- Project state -----

function checkVenv() {
  if (!existsSync(VENV_UVICORN)) {
    fail(
      "Backend virtualenv not set up (services/api/.venv/bin/uvicorn missing)",
      "Run: `cd services/api && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cd ../..`",
    );
  }
}

function parseEnvFile(path) {
  // Minimal .env parser — enough for KEY=value lines, ignores comments
  // and quoted strings. We don't need the full dotenv grammar here.
  const out = {};
  const text = readFileSync(path, "utf8");
  for (const raw of text.split("\n")) {
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

function requiredB2Vars() {
  // .env.example is the setup-contract source for required B2 names.
  return Object.keys(parseEnvFile(ENV_EXAMPLE_FILE)).filter((key) =>
    key.startsWith("B2_"),
  );
}

function placeholderValues() {
  const exampleValues = Object.values(parseEnvFile(ENV_EXAMPLE_FILE));
  return new Set([
    ...exampleValues.filter((value) => value.includes("your_") || value.includes("your-")),
    ...LEGACY_PLACEHOLDERS,
  ]);
}

function envKeysFor(requiredKey) {
  return [requiredKey, ...(LEGACY_B2_ALIASES[requiredKey] ?? [])];
}

function isValidB2Region(region) {
  return B2_REGION_RE.test(region);
}

function isValidLegacyB2Endpoint(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    return false;
  }

  const prefix = "s3.";
  const suffix = ".backblazeb2.com";
  if (!url.hostname.startsWith(prefix) || !url.hostname.endsWith(suffix)) {
    return false;
  }

  const region = url.hostname.slice(prefix.length, -suffix.length);
  return isValidB2Region(region);
}

function checkEnv() {
  if (!existsSync(ENV_FILE)) {
    fail(
      ".env is missing at the repo root",
      "Run: `cp .env.example .env`, then fill in your B2 credentials",
    );
    return;
  }
  const env = parseEnvFile(ENV_FILE);
  const required = requiredB2Vars();
  const placeholders = placeholderValues();
  const missing = required.filter((key) =>
    !envKeysFor(key).some((candidate) => env[candidate]),
  );
  if (missing.length > 0) {
    fail(
      `.env is missing required B2 variables: ${missing.join(", ")}`,
      "See .env.example for the full list and edit .env to add them",
    );
  }
  const placeholderKeys = required.filter(
    (key) => envKeysFor(key).some(
      (candidate) => env[candidate] && placeholders.has(env[candidate]),
    ),
  );
  if (placeholderKeys.length > 0) {
    fail(
      `.env still has placeholder values: ${placeholderKeys.join(", ")}`,
      "Edit .env and replace placeholders with your real B2 credentials (https://secure.backblaze.com/app_keys.htm)",
    );
  }
  if (env.B2_REGION && !isValidB2Region(env.B2_REGION)) {
    fail(
      `.env has invalid B2_REGION: ${env.B2_REGION}`,
      "Use a B2 region token such as `us-west-004`",
    );
  } else if (
    !env.B2_REGION &&
    env.B2_ENDPOINT &&
    !isValidLegacyB2Endpoint(env.B2_ENDPOINT)
  ) {
    fail(
      `.env has invalid B2_ENDPOINT: ${env.B2_ENDPOINT}`,
      "Use a B2 S3 endpoint like `https://s3.us-west-004.backblazeb2.com`",
    );
  }
}

// ----- Network -----

// Try to bind on a single host; resolves to true if EADDRINUSE.
function isPortBoundOn(port, host) {
  return new Promise((res) => {
    const server = createServer();
    server.once("error", (err) => res(err.code === "EADDRINUSE"));
    server.once("listening", () => server.close(() => res(false)));
    server.listen(port, host);
  });
}

// We probe the wildcard interfaces (0.0.0.0 and ::) because that's what
// `next dev` and `uvicorn` actually try to bind to. Probing only the
// loopbacks misses the common case (on macOS) where a process bound to
// `::` doesn't conflict with a `127.0.0.1` probe but DOES conflict with
// `pnpm dev`'s own wildcard bind. If either wildcard is taken, the
// port is effectively unusable for the dev server.
async function checkPort({ port, name }) {
  const [v4, v6] = await Promise.all([
    isPortBoundOn(port, "0.0.0.0"),
    isPortBoundOn(port, "::"),
  ]);
  if (v4 || v6) {
    warn(
      `Port ${port} (${name}) is already in use`,
      `ok — \`pnpm dev\` will pick the next free port automatically. ` +
        `To inspect what's on it: \`lsof -nP -iTCP:${port} -sTCP:LISTEN\`.`,
    );
  }
}

// ----- Run -----

async function main() {
  checkNode();
  checkPnpm();
  checkPython();
  checkVenv();
  checkEnv();
  await Promise.all(PORTS_TO_CHECK.map(checkPort));

  if (failures.length === 0 && warnings.length === 0) {
    console.log("✓ doctor: environment looks good");
    return;
  }

  if (warnings.length > 0) {
    console.error("\n⚠  Warnings:");
    for (const { msg, fix } of warnings) {
      console.error(`  - ${msg}`);
      console.error(`    fix: ${fix}`);
    }
  }

  if (failures.length > 0) {
    console.error("\n✗ Errors:");
    for (const { msg, fix } of failures) {
      console.error(`  - ${msg}`);
      console.error(`    fix: ${fix}`);
    }
    console.error("");
    process.exit(1);
  }

  // Warnings only — non-fatal so `pnpm dev` can still proceed if the
  // user genuinely wants to (e.g. running a second instance).
  console.error("\nProceeding despite warnings.\n");
}

main();
