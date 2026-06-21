#!/usr/bin/env bash
# bootstrap.sh — one command to take a fresh clone to a running, verifiable Nyx.
# Usage: bash bootstrap.sh        (idempotent; safe to re-run)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

log(){ printf "\033[1;36m[bootstrap]\033[0m %s\n" "$*"; }
fail(){ printf "\033[1;31m[bootstrap] FAIL:\033[0m %s\n" "$*" >&2; exit 1; }

# 1. Toolchain check (Node >= 22.17, ESM + Bare runtime support)
log "Checking Node >= 22.17"
command -v node >/dev/null || fail "Node not found. Install Node >= 22.17"
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
[ "$NODE_MAJOR" -ge 22 ] || fail "Node $(node -v) too old; need >= 22.17"

# 2. Dependencies (reproducible install)
if [ -d node_modules ]; then
  log "node_modules present, skipping install"
elif [ -f package-lock.json ]; then
  log "Installing dependencies (npm ci)"; npm ci
else
  log "Installing dependencies (npm install)"; npm install
fi

# 3. Environment — offline + strict by default (privacy is the default, not a flag)
if [ ! -f .env ]; then
  log "Writing default .env"
  cat > .env <<'ENV'
NYX_PORT=3000
NYX_OFFLINE=1          # all inference on-device via QVAC SDK; no cloud tier exists
NYX_STRICT=1           # NetGuard blocks egress except the allowlist
NYX_ALLOW_EXEC=1       # Nyx executes confirmed actions itself (validator + UAC still apply)
NYX_LANG=en
ENV
fi

# 4. Models — download + pin hashes (writes models.lock for reproducibility)
log "Pinning + caching models"
node scripts/setup-models.js || log "setup-models skipped (SDK/models offline) — continuing"

# 5. Local knowledge index for RAG
log "Building local RAG index"
node -e "import('./src/rag.js').then(m=>m.buildIndex()).catch(e=>{console.error(e);process.exit(1)})"

# 6. Trust keys — Ed25519 keypair for Proof-of-Local-Inference signing
mkdir -p evidence
if [ ! -f evidence/poli.pub ]; then
  log "Generating PoLI signing keypair"
  node scripts/gen-keys.js
fi

# 7. Offline smoke test + build the evidence bundle
log "Running offline smoke test + verification"
bash scripts/demo.sh

log "DONE  Start the app:  npm start   (http://localhost:${NYX_PORT:-3000})"
