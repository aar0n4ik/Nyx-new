# Nyx architecture

```mermaid
flowchart TD
	U["User (text / voice / photo)"] --> C["Client UI / CLI"]
	C --> R["Router agent"]
	R --> RAG["RAG retriever (local index)"]
	RAG --> Q["Reasoner -> @qvac/sdk on-device model"]
	Q --> POL["Proof-of-Local-Inference log (Ed25519)"]
	Q --> ANS["Answer + sources"]
	C -. untrusted text .-> FW["Injection firewall"]
	FW --> RAG
	Q --> NG["NetGuard egress audit"]
	subgraph Economic P2P
		P["Hyperswarm peers"] --> PAY["WDK wallet -> Plasma USDT0"]
		PAY --> RCPT["Signed receipt"]
	end
	R -. delegate when busy .-> P
```

## Layers
1. **Client** — web UI (`public/index.html`) + `cli.js`. Voice/photo are optional
   multimodal inputs (STT/TTS/OCR via @qvac/sdk).
2. **Core** — `src/agents.js` orchestrates: route -> retrieve (`src/rag.js`) ->
   reason (`src/qvac.js`).
3. **Trust** — `src/poli.js` (signed inference log), `verify.js` (independent
   checker), `src/netguard.js` (egress guard), `src/attestation.js` (which model).
4. **Economic P2P** — `src/wallet/wdk.js` (self-custodial wallet) +
   `src/p2p/payments.js` (Plasma USDT0 receipts) for paid, delegated inference.

## Trust model (why a judge should believe it)
- *It runs* -> `bootstrap.sh` / `demo.sh` on a fresh clone.
- *It's local* -> `evidence/netguard.json` (0 egress) + verified PoLI chain.
- *It's what you claim* -> `evidence/attestation.json` + signed receipt + bench.
