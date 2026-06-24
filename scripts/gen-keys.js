import { generateKeyPairSync } from "node:crypto"
import {
	writeFileSync,
	chmodSync,
	mkdirSync,
	existsSync,
	appendFileSync,
	readFileSync,
} from "node:fs"

mkdirSync("evidence", { recursive: true })
const { publicKey, privateKey } = generateKeyPairSync("ed25519")

writeFileSync("evidence/poli.pub", publicKey.export({ type: "spki", format: "pem" })) // public: safe to commit/share
writeFileSync(".poli.key", privateKey.export({ type: "pkcs8", format: "pem" })) // SECRET
try {
	chmodSync(".poli.key", 0o600)
} catch {}

// Never commit the private key.
const gi = existsSync(".gitignore") ? readFileSync(".gitignore", "utf8") : ""
if (!gi.includes(".poli.key")) appendFileSync(".gitignore", "\n.poli.key\n")

console.log("wrote evidence/poli.pub (public) + .poli.key (secret)")
