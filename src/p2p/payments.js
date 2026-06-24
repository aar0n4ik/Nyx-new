// Pay-per-inference receipts. Settlement target: Plasma USDT0 (zero-fee,
// EVM-compatible, LayerZero OFT omnichain). Receipts are hashed for the
// evidence bundle so a delegated, paid inference is independently checkable.
import { randomUUID, createHash } from "node:crypto"
import { writeFileSync, mkdirSync } from "node:fs"

export function issueReceipt({ job, amountUsdt, payer, payee }) {
	const r = {
		id: randomUUID(),
		job,
		amountUsdt,
		payer,
		payee,
		network: "plasma-usdt0",
		ts: new Date().toISOString(),
	}
	r.hash = createHash("sha256").update(JSON.stringify(r)).digest("hex")
	mkdirSync("evidence", { recursive: true })
	writeFileSync("evidence/receipt.sample.json", JSON.stringify(r, null, 2))
	return r
}
