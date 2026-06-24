// Proof-of-Local-Inference: a tamper-evident, Ed25519-signed hash chain.
// Every inference appends an entry whose hash chains to the previous one, so a
// verifier can prove the log was not altered or reordered. Each entry also
// records which engine produced the answer and (optionally) its performance
// telemetry (TTFT, tokens/sec) so the metrics are part of the signed evidence.
import { createHash, createPrivateKey, sign } from "node:crypto"
import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs"

const LOG = "evidence/poli.jsonl"

function lastHash() {
	if (!existsSync(LOG)) return "GENESIS"
	const lines = readFileSync(LOG, "utf8").trim().split("\n").filter(Boolean)
	if (!lines.length) return "GENESIS"
	return JSON.parse(lines[lines.length - 1]).hash
}

export function recordInference({ model, prompt, output, metrics = null }) {
	mkdirSync("evidence", { recursive: true })
	const prev = lastHash()
	const entry = {
		ts: new Date().toISOString(),
		model,
		promptSha256: createHash("sha256").update(prompt).digest("hex"),
		outputSha256: createHash("sha256").update(output).digest("hex"),
		...(metrics ? { metrics } : {}),
		prev,
	}
	const body = JSON.stringify(entry)
	const hash = createHash("sha256").update(prev + body).digest("hex")
	let signature = null
	if (existsSync(".poli.key")) {
		const key = createPrivateKey(readFileSync(".poli.key"))
		signature = sign(null, Buffer.from(hash), key).toString("base64")
	}
	appendFileSync(LOG, JSON.stringify({ ...entry, hash, signature }) + "\n")
	return hash
}
