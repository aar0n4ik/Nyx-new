// Authenticated Bitfinex v2 REST client.
// Signs requests locally with HMAC-SHA384 (keys come from the local vault and are
// never logged). Verification uses a read-only endpoint. Order submission defaults
// to DRY-RUN unless NYX_LIVE_TRADING=1 and the caller passes confirmed:true.
import { createHmac } from "node:crypto"
import { revealKeys, markVerified, mask } from "../security/vault.js"

const BASE = "https://api.bitfinex.com"
const LIVE = process.env.NYX_LIVE_TRADING === "1"

function sign(path, body, secret) {
	const nonce = (Date.now() * 1000).toString()
	const payload = `/api/${path}${nonce}${body}`
	const sig = createHmac("sha384", secret).update(payload).digest("hex")
	return { nonce, sig }
}

async function authPost(path, obj, { apiKey, apiSecret }) {
	const body = JSON.stringify(obj || {})
	const { nonce, sig } = sign(path, body, apiSecret)
	const res = await fetch(`${BASE}/${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"bfx-nonce": nonce,
			"bfx-apikey": apiKey,
			"bfx-signature": sig,
		},
		body,
	})
	const text = await res.text()
	let data
	try { data = JSON.parse(text) } catch { data = text }
	return { ok: res.ok, status: res.status, data }
}

// Read-only validity check. Never unlocks trading by itself.
export async function verifyKeys(keyRef) {
	const { apiKey, apiSecret } = revealKeys(keyRef)
	try {
		const r = await authPost("v2/auth/r/wallets", {}, { apiKey, apiSecret })
		const valid = r.ok && Array.isArray(r.data)
		markVerified(keyRef, valid)
		return {
			valid,
			masked: mask(apiKey),
			wallets: valid ? r.data.length : 0,
			reason: valid ? "ok" : (r.data?.[2] || r.data?.[1] || `http ${r.status}`),
		}
	} catch (e) {
		// Offline / sandbox: cannot reach exchange. Report transparently.
		return { valid: false, masked: mask(apiKey), wallets: 0, reason: "network-unreachable", offline: true }
	}
}

// Build a Bitfinex order payload from human params.
export function buildOrder({ symbol, side, amount, price, type = "EXCHANGE LIMIT", leverage }) {
	const signed = side === "sell" ? -Math.abs(Number(amount)) : Math.abs(Number(amount))
	const order = {
		type,
		symbol: symbol.startsWith("t") ? symbol : "t" + symbol,
		amount: String(signed),
	}
	if (price && !type.includes("MARKET")) order.price = String(price)
	if (leverage && type.startsWith("MARGIN")) order.lev = Number(leverage)
	return order
}

// Submit an order. DRY-RUN unless live trading is enabled AND confirmed.
export async function submitOrder(keyRef, order, { confirmed = false } = {}) {
	if (!LIVE || !confirmed) {
		return {
			submitted: false,
			dryRun: true,
			order,
			note: !LIVE
				? "DRY-RUN: live trading disabled (set NYX_LIVE_TRADING=1 to enable)."
				: "DRY-RUN: not confirmed by user.",
		}
	}
	const { apiKey, apiSecret } = revealKeys(keyRef)
	const r = await authPost("v2/auth/w/order/submit", order, { apiKey, apiSecret })
	return { submitted: r.ok, dryRun: false, status: r.status, response: r.data, order }
}

export const apiCreateUrl = "https://setting.bitfinex.com/api#new-key"
