// Model attestation: record which model weights produced answers.
// Reads models.lock (written by scripts/setup-models.js) and emits a
// signed-friendly attestation file for the evidence bundle.
import { createHash } from "node:crypto"
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs"

export function attest() {
	const lock = existsSync("models.lock")
		? JSON.parse(readFileSync("models.lock", "utf8"))
		: {}
	const att = Object.entries(lock).map(([name, v]) => ({
		model: name,
		type: v.type,
		weightsSha256: v.sha256,
	}))
	mkdirSync("evidence", { recursive: true })
	writeFileSync("evidence/attestation.json", JSON.stringify(att, null, 2))
	return att
}

// Hash an arbitrary buffer/string (used when the SDK exposes a weights path).
export function sha256(data) {
	return createHash("sha256").update(data).digest("hex")
}
