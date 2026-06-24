// Benchmark the REAL on-device model via the QVAC SDK events API and write
// evidence/bench.csv (cold load, time-to-first-token, tokens/sec). These are
// the numbers cited in the submission; anyone can re-run `npm run bench`.
import { performance } from "node:perf_hooks"
import { writeFileSync, mkdirSync } from "node:fs"
import { pickModelConst } from "../src/qvac.js"

const LLM_TYPE = "llamacpp-completion"

let sdk = null
try {
	sdk = await import("@qvac/sdk")
} catch {
	sdk = null
}

mkdirSync("evidence", { recursive: true })

if (!sdk) {
	console.log("@qvac/sdk not installed — cannot benchmark the real model.")
	console.log("Install + download a model first:  npm i @qvac/sdk && node scripts/setup-models.js")
	process.exit(0)
}

const MODEL_CONST = pickModelConst()
const modelSrc = process.env.NYX_QVAC_MODEL_PATH || sdk[MODEL_CONST] || sdk.LLAMA_3_2_1B_INST_Q4_0

const rows = [["metric", "value", "unit"]]

const t0 = performance.now()
const modelId = await sdk.loadModel({ modelSrc, modelType: LLM_TYPE })
rows.push(["cold_load", (performance.now() - t0).toFixed(0), "ms"])

const tStart = performance.now()
let first = null
let n = 0
let nativeTps = null

const run = sdk.completion({
	modelId,
	history: [{ role: "user", content: "Explain edge AI in 60 words." }],
	stream: true,
})

if (run.events) {
	for await (const ev of run.events) {
		if (ev.type === "contentDelta") {
			if (first === null) first = performance.now()
			n++
		} else if (ev.type === "completionStats" && ev.stats?.tokensPerSec) {
			nativeTps = ev.stats.tokensPerSec
		}
	}
	try {
		const final = await run.final
		if (final?.stats?.tokensPerSec) nativeTps = final.stats.tokensPerSec
	} catch {}
} else if (run.tokenStream) {
	for await (const _ of run.tokenStream) {
		if (first === null) first = performance.now()
		n++
	}
}

const dur = (performance.now() - first) / 1000
rows.push(["first_token", (first - tStart).toFixed(0), "ms"])
rows.push(["tokens_per_sec", (nativeTps ?? n / dur).toFixed(1), "tok/s"])
rows.push(["tokens", String(n), "count"])
rows.push(["model", MODEL_CONST, "id"])

await sdk.unloadModel({ modelId })
if (typeof sdk.close === "function") await sdk.close()

writeFileSync("evidence/bench.csv", rows.map((r) => r.join(",")).join("\n"))
console.log("wrote evidence/bench.csv")
for (const r of rows.slice(1)) console.log("  ", r.join("  "))
