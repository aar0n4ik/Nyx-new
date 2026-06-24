// One-time, idempotent local setup so `npm install && npm start` just works for
// judges — no separate bootstrap step required. Everything here is offline and
// best-effort: any failure is logged and skipped, never fatal.
import { generateKeyPairSync } from "node:crypto"
import { writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs"
import { buildIndex } from "./rag.js"

export function ensureLocalSetup() {
	// 1) PoLI signing keypair — enables the signed Proof-of-Local-Inference log.
	try {
		if (!existsSync("evidence/poli.pub") || !existsSync(".poli.key")) {
			mkdirSync("evidence", { recursive: true })
			const { publicKey, privateKey } = generateKeyPairSync("ed25519")
			writeFileSync("evidence/poli.pub", publicKey.export({ type: "spki", format: "pem" }))
			writeFileSync(".poli.key", privateKey.export({ type: "pkcs8", format: "pem" }))
			try { chmodSync(".poli.key", 0o600) } catch {}
			console.log("[firstrun] generated PoLI signing keypair")
		}
	} catch (e) {
		console.log("[firstrun] key generation skipped:", e?.message || e)
	}

	// 2) Local RAG index — empty notes are fine; this just avoids a missing file.
	try {
		if (!existsSync("data/index.json")) {
			buildIndex()
			console.log("[firstrun] built local RAG index")
		}
	} catch (e) {
		console.log("[firstrun] RAG index skipped:", e?.message || e)
	}
}
