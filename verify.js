// Independently verify the Proof-of-Local-Inference chain.
import { createHash, createPublicKey, verify } from "node:crypto"
import { readFileSync, existsSync } from "node:fs"

const LOG = "evidence/poli.jsonl"
if (!existsSync(LOG)) {
	console.error("No PoLI log at", LOG, "— run an inference first (node cli.js ...)")
	process.exit(1)
}

const pub = existsSync("evidence/poli.pub")
	? createPublicKey(readFileSync("evidence/poli.pub"))
	: null

const lines = readFileSync(LOG, "utf8").trim().split("\n").filter(Boolean)
let prev = "GENESIS"
let ok = true

for (const [i, line] of lines.entries()) {
	const e = JSON.parse(line)
	const { hash, signature, ...rest } = e
	if (rest.prev !== prev) {
		console.error(`chain break at entry ${i}`)
		ok = false
		break
	}
	const body = JSON.stringify(rest)
	const expect = createHash("sha256").update(prev + body).digest("hex")
	if (expect !== hash) {
		console.error(`hash mismatch at entry ${i}`)
		ok = false
		break
	}
	if (pub && signature) {
		const good = verify(null, Buffer.from(hash), pub, Buffer.from(signature, "base64"))
		if (!good) {
			console.error(`bad signature at entry ${i}`)
			ok = false
			break
		}
	}
	prev = hash
}

console.log(ok ? `PoLI chain PASS (${lines.length} entries)` : "PoLI chain FAIL")
process.exit(ok ? 0 : 1)
