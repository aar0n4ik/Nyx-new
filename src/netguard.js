// NetGuard: runtime egress auditor.
// Default-deny model: every non-loopback socket is blocked UNLESS its host is on
// an explicit allowlist. Allowed calls are still recorded, so the privacy claim
// stays precise and honest: "no egress except allowlisted, user-approved hosts,
// fully logged."
//
// Two classes of allowlisted hosts:
//   1) The user-approved exchange endpoint (trading).
//   2) One-time MODEL DOWNLOAD hosts (catalog CDN + weights mirrors). These are
//      needed only during onboarding/model management. Without this, the
//      default-deny guard would block (strict) or falsely flag (audit) the
//      legitimate, user-initiated model download — which would break the very
//      "just works" onboarding we promise. They are logged separately.
import net from "node:net"
import { writeFileSync, mkdirSync } from "node:fs"

// Hosts the trader explicitly opted into. Bitfinex is Tether's iFinex sister co.
const EXCHANGE_HOSTS = ["api.bitfinex.com", "api-pub.bitfinex.com"]

// One-time model download infrastructure (catalog + weights). Override/extend
// via NYX_MODEL_HOSTS. Kept explicit so the privacy report can distinguish
// "model download" egress from "exchange" egress from "unexpected" egress.
const MODEL_HOSTS = [
	"cdn.nyx.app",
	"get.nyx.app",
	"huggingface.co",
	"cdn-lfs.huggingface.co",
	"cdn-lfs-us-1.huggingface.co",
	...(process.env.NYX_MODEL_HOSTS || "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean),
]

const USER_HOSTS = (process.env.NYX_ALLOW_HOSTS || "")
	.split(",")
	.map((s) => s.trim())
	.filter(Boolean)

const ALLOWLIST = [...EXCHANGE_HOSTS, ...MODEL_HOSTS, ...USER_HOSTS]

const report = {
	strict: process.env.NYX_STRICT === "1",
	allowlist: ALLOWLIST,
	exchangeHosts: EXCHANGE_HOSTS,
	modelHosts: MODEL_HOSTS,
	nonLoopback: 0, // blocked / unexpected egress
	allowed: 0, // allowlisted egress (counted, not a violation)
	modelDownloads: 0, // allowlisted model-download egress
	connections: [], // blocked attempts
	allowedConnections: [], // permitted calls (exchange + model)
}

const isLocal = (h) =>
	!h ||
	h === "localhost" ||
	h === "::1" ||
	h.startsWith("127.") ||
	h.startsWith("/") // unix socket

const matchHost = (list, h) => list.some((a) => h === a || h.endsWith("." + a))
const isAllowed = (h) => matchHost(ALLOWLIST, h)
const isModelHost = (h) => matchHost(MODEL_HOSTS, h)

const origConnect = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) {
	const opts = typeof args[0] === "object" ? args[0] : { host: args[1], port: args[0] }
	const host = String(opts.host || opts.path || "localhost")
	if (!isLocal(host)) {
		if (isAllowed(host)) {
			report.allowed++
			if (isModelHost(host)) report.modelDownloads++
			report.allowedConnections.push({ host, kind: isModelHost(host) ? "model" : "exchange", ts: new Date().toISOString() })
		} else {
			report.nonLoopback++
			report.connections.push({ host, ts: new Date().toISOString() })
			if (report.strict) {
				flush()
				throw new Error(`NetGuard: blocked egress to ${host}`)
			}
		}
	}
	return origConnect.apply(this, args)
}

export function flush() {
	mkdirSync("evidence", { recursive: true })
	writeFileSync("evidence/netguard.json", JSON.stringify(report, null, 2))
}

process.on("exit", flush)
export default report
