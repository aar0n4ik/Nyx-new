#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
echo "== Nyx reproducible demo =="

echo "[1/5] Node sanity"
node -v

echo "[2/5] Build local RAG index"
node -e "import('./src/rag.js').then(m=>m.buildIndex())"

echo "[3/5] Strict offline answer (zero cloud) + PoLI log"
NYX_STRICT=1 NYX_OFFLINE=1 node cli.js "Summarize my notes on edge AI in 3 bullets"

echo "[4/5] Verify Proof-of-Local-Inference chain"
node verify.js

echo "[5/5] Egress audit (must be zero)"
node -e "import('node:fs').then(({readFileSync})=>{const g=JSON.parse(readFileSync('evidence/netguard.json','utf8'));if(g.nonLoopback!==0){console.error('FAIL egress',g.nonLoopback);process.exit(1)}console.log('NetGuard OK: 0 non-loopback')})"

echo "== DEMO PASS =="
