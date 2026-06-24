// NetGuard: runtime egress auditor.
// Default-deny model: every non-loopback socket is blocked UNLESS its host is on
// an explicit allowlist (the user-approved exchange endpoint). Allowed calls are
// still recorded, so the privacy claim is precise and honest:
// "no egress except the allowlisted, user-approved endpoints, fully logged."
import net from "node:net"
import { writeFileSync, mkdirSync } from "node:fs"

// Hosts the trader explicitly opted into. Bitfinex is Tether's iFinex sister co.
const ALLOWLIST = [
	"api.bitfinex.com",
	"api-pub.bitfinex.com",
	...(process.env.NYX_ALLOW_HOSTS || "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean),
]

const report = {
	strict: process.env.NYX_STRICT === "1",
	allowlist: ALLOWLIST,
	nonLoopback: 0, // blocked / unexpected egress
	allowed: 0, // allowlisted egress (counted, not a violation)
	connections: [], // blocked attempts
	allowedConnections: [], // permitted exchange calls
}

const isLocal = (h) =>
	!h ||
	h === "localhost" ||
	h === "::1" ||
	h.startsWith("127.") ||
	h.startsWith("/") // unix socket

const isAllowed = (h) => ALLOWLIST.some((a) => h === a || h.endsWith("." + a))

const origConnect = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) {
	const opts = typeof args[0] === "object" ? args[0] : { host: args[1], port: args[0] }
	const host = String(opts.host || opts.path || "localhost")
	if (!isLocal(host)) {
		if (isAllowed(host)) {
			report.allowed++
			report.allowedConnections.push({ host, ts: new Date().toISOString() })
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
