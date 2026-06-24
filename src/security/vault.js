// Local encrypted API-key vault.
// Keys are encrypted at rest with AES-256-GCM. The key-encryption-key is derived
// with scrypt from a local passphrase (NYX_VAULT_PASS) + a per-install random
// salt. Plaintext secrets exist only in memory, only while a request is signed.
// The LLM never receives secrets — only a masked view and an opaque keyRef.
import {
	randomBytes,
	scryptSync,
	createCipheriv,
	createDecipheriv,
	createHash,
} from "node:crypto"
import { existsSync } from "node:fs"
import { readJSON, writeJSONAtomic } from "../util/safeStore.js"

const FILE = "data/.vault.json"
const PASS = process.env.NYX_VAULT_PASS || "nyx-local-dev-passphrase"

function load() {
	if (!existsSync(FILE)) return { salt: randomBytes(16).toString("hex"), items: {} }
	// corruption-safe read; falls back to last good backup if the file is damaged
	return readJSON(FILE, { salt: randomBytes(16).toString("hex"), items: {} })
}
function save(db) {
	// atomic write keeps a .bak so encrypted keys are never lost on crash/power-off
	writeJSONAtomic(FILE, db)
}
function kek(saltHex) {
	return scryptSync(PASS, Buffer.from(saltHex, "hex"), 32)
}

export function mask(s) {
	if (!s) return ""
	const v = String(s)
	if (v.length <= 8) return "…".padStart(v.length, "•")
	return v.slice(0, 4) + "…" + v.slice(-4)
}

// Store a key pair under a ref. Returns { keyRef, masked } — never the secret.
export function storeKeys({ apiKey, apiSecret, label = "bitfinex" }) {
	if (!apiKey || !apiSecret) throw new Error("apiKey and apiSecret required")
	const db = load()
	const key = kek(db.salt)
	const iv = randomBytes(12)
	const cipher = createCipheriv("aes-256-gcm", key, iv)
	const payload = JSON.stringify({ apiKey, apiSecret })
	const enc = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()])
	const tag = cipher.getAuthTag()
	const keyRef = createHash("sha256").update(apiKey + db.salt).digest("hex").slice(0, 16)
	db.items[keyRef] = {
		label,
		iv: iv.toString("hex"),
		tag: tag.toString("hex"),
		enc: enc.toString("hex"),
		maskedKey: mask(apiKey),
		createdAt: new Date().toISOString(),
		verified: false,
	}
	save(db)
	return { keyRef, masked: db.items[keyRef].maskedKey }
}

// Decrypt for one-time use. Caller must not log or persist the result.
export function revealKeys(keyRef) {
	const db = load()
	const it = db.items[keyRef]
	if (!it) throw new Error("unknown keyRef")
	const key = kek(db.salt)
	const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(it.iv, "hex"))
	decipher.setAuthTag(Buffer.from(it.tag, "hex"))
	const dec = Buffer.concat([
		decipher.update(Buffer.from(it.enc, "hex")),
		decipher.final(),
	])
	return JSON.parse(dec.toString("utf8"))
}

export function markVerified(keyRef, verified = true) {
	const db = load()
	if (db.items[keyRef]) {
		db.items[keyRef].verified = verified
		save(db)
	}
}

// Safe public view — no secrets, ever.
export function publicStatus(keyRef) {
	const db = load()
	const it = db.items[keyRef]
	if (!it) return null
	return { keyRef, label: it.label, maskedKey: it.maskedKey, verified: it.verified, createdAt: it.createdAt }
}

export function listKeys() {
	const db = load()
	return Object.keys(db.items).map((r) => publicStatus(r))
}

export function removeKey(keyRef) {
	const db = load()
	delete db.items[keyRef]
	save(db)
}
