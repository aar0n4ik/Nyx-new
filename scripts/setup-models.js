// Download + cache the on-device model(s) via the QVAC SDK, and pin their
// hashes into models.lock + evidence/attestation.json for reproducibility.
// loadModel() resolves a registry constant, downloads (resumable), caches to
// disk, and maps it into memory. Run once WITH network; afterwards Nyx runs
// fully offline against the cached weights.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { pickModelConst } from "../src/qvac.js"

// QVAC completion models load with this modelType (matches src/qvac.js).
const LLM_TYPE = "llamacpp-completion"

let sdk = null
try {
	sdk = await import("@qvac/sdk")
} catch {
	sdk = null
}

mkdirSync("evidence", { recursive: true })

if (!sdk) {
	console.log("@qvac/sdk not installed — skipping model download.")
	console.log("Install it, then re-run:  npm i @qvac/sdk && node scripts/setup-models.js")
	process.exit(0)
}

// Resolve the SAME constant the runtime uses (prefers Qwen3-4B, falls back to
// Llama 3.2) so models.lock matches what actually runs.
const LLM_CONST = pickModelConst()

const MODELS = [
	{ name: LLM_CONST, src: process.env.NYX_QVAC_MODEL_PATH || sdk[LLM_CONST], type: LLM_TYPE },
].filter((m) => m.src)

// Best-effort SHA-256 of the resolved local weights file when the SDK exposes a
// path; otherwise we record the registry model id we pinned (still verifiable
// against the public QVAC model registry).
function hashWeights(loadResult, fallbackId) {
	try {
		const path =
			loadResult?.path || loadResult?.modelPath || loadResult?.files?.[0]?.path
		if (path && existsSync(path)) {
			return { kind: "weights-sha256", value: createHash("sha256").update(readFileSync(path)).digest("hex") }
		}
	} catch {}
	return { kind: "registry-id", value: String(fallbackId) }
}

const lock = {}
const attestation = []

for (const m of MODELS) {
	process.stdout.write(`downloading + pinning ${m.name} ... `)
	const modelId = await sdk.loadModel({ modelSrc: m.src, modelType: m.type })
	const digest = hashWeights(modelId, m.name)
	lock[m.name] = { type: m.type, [digest.kind]: digest.value }
	attestation.push({ model: m.name, type: m.type, [digest.kind]: digest.value })
	try {
		await sdk.unloadModel({ modelId })
	} catch {}
	console.log("ok")
}

if (typeof sdk.close === "function") await sdk.close()

writeFileSync("models.lock", JSON.stringify(lock, null, 2))
writeFileSync("evidence/attestation.json", JSON.stringify(attestation, null, 2))
console.log("wrote models.lock + evidence/attestation.json")
