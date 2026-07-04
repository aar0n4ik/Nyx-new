import "./src/netguard.js"
import { createServer } from "node:http"
import { readFileSync, existsSync } from "node:fs"
import { extname } from "node:path"
import { spawn } from "node:child_process"
import { answer } from "./src/agents.js"
import { market } from "./src/integrations/bitfinex.js"
import { step as brokerStep, reset as brokerReset } from "./src/trade/broker.js"
import { sizePosition, gradeTrade } from "./src/trade/calculator.js"
import { collectSpecs, bitfinexLatency, preTradeRisk } from "./src/system/specs.js"
import { openSettings, startWindowsUpdateScan } from "./src/system/windows.js"
import { listKeys, publicStatus, removeKey } from "./src/security/vault.js"
import { status as llmStatus } from "./src/llm/engine.js"
import { modelStatus, switchModel } from "./src/qvac.js"
import { listModels } from "./src/modelRegistry.js"
import { ensureLocalSetup } from "./src/firstrun.js"
import { diagnose } from "./src/agent/diagnose.js"
import { runScript } from "./src/shell/connector.js"
import * as solutionCache from "./src/shell/solutionCache.js"
import { rateLimit } from "./src/util/guard.js"
import { PLAYBOOKS, matchPlaybook } from "./src/agent/playbooks.js"

const PORT = process.env.NYX_PORT || 3000

// First-run convenience so Nyx is runnable out-of-the-box for judges: generate
// PoLI signing keys and build the local RAG index if missing. Idempotent, fully
// offline, best-effort — it never blocks startup.
ensureLocalSetup()

const MIME = {
".html": "text/html; charset=utf-8",
".css": "text/css; charset=utf-8",
".js": "text/javascript; charset=utf-8",
".svg": "image/svg+xml",
".json": "application/json; charset=utf-8",
}

function json(res, code, obj) {
res.statusCode = code
res.setHeader("content-type", "application/json; charset=utf-8")
res.end(JSON.stringify(obj))
}

function sendFile(res, path) {
res.setHeader("content-type", MIME[extname(path)] || "application/octet-stream")
res.end(readFileSync(path))
}

async function readBody(req) {
let body = ""
for await (const c of req) body += c
try { return JSON.parse(body || "{}") } catch { return {} }
}

// --- Background model download manager --------------------------------------
// Kicks off scripts/setup-models.js (which downloads + caches the SELECTED model
// via the QVAC SDK) without blocking the request. The UI reflects real progress
// by polling /api/model/list (honest on-disk scan) + this status object.
let dl = { active: false, id: null, startedAt: null, done: false, error: null, log: "" }
function startDownload(id) {
if (dl.active) return dl
dl = { active: true, id: id || null, startedAt: Date.now(), done: false, error: null, log: "" }
try {
const child = spawn(process.execPath, ["scripts/setup-models.js"], { env: { ...process.env } })
child.stdout.on("data", (b) => { dl.log = (dl.log + b).slice(-4000) })
child.stderr.on("data", (b) => { dl.log = (dl.log + b).slice(-4000) })
child.on("close", (code) => { dl.active = false; dl.done = code === 0; if (code !== 0 && !dl.error) dl.error = "exit " + code })
child.on("error", (e) => { dl.active = false; dl.error = String(e?.message || e) })
} catch (e) {
dl.active = false; dl.error = String(e?.message || e)
}
return dl
}

createServer(async (req, res) => {
try {
const url = new URL(req.url, "http://localhost")
const path = url.pathname

// Rate-limit the API surface (per client) to keep the local service alive.
if (path.startsWith("/api/")) {
const who = req.socket.remoteAddress || "local"
const rl = rateLimit(who, { max: Number(process.env.NYX_RATE_MAX || 60), windowMs: 60000 })
if (!rl.ok) return json(res, 429, { error: "Слишком много запросов, подождите", resetMs: rl.resetMs })
}

// --- Static / pages ---
if (req.method === "GET" && (path === "/" )) {
return existsSync("public/index.html")
? sendFile(res, "public/index.html")
: json(res, 200, { ok: true, hint: 'POST /api/chat { "q": "..." }' })
}
if (req.method === "GET" && (path === "/app" || path === "/app.html")) {
return existsSync("public/app.html") ? sendFile(res, "public/app.html") : json(res, 404, { error: "app not built" })
}
if (req.method === "GET" && /^\/(app\.css|app\.js)$/.test(path)) {
const f = "public" + path
return existsSync(f) ? sendFile(res, f) : json(res, 404, { error: "not found" })
}

// --- Market (public) ---
if (req.method === "GET" && path === "/api/market") {
return json(res, 200, { market: await market(["BTC", "ETH", "SOL"]) })
}

// --- System / PC infrastructure ---
if (req.method === "GET" && path === "/api/system/specs") {
const specs = await collectSpecs()
const latency = await bitfinexLatency()
return json(res, 200, { specs, latency, risk: preTradeRisk(specs, latency) })
}
if (req.method === "GET" && path === "/api/system/latency") {
return json(res, 200, await bitfinexLatency())
}
if (req.method === "POST" && path === "/api/system/open-settings") {
const { pane } = await readBody(req)
return json(res, 200, await openSettings(pane || ""))
}
if (req.method === "POST" && path === "/api/system/update") {
return json(res, 200, await startWindowsUpdateScan())
}

// --- Trade calculator (manual assist, no keys needed) ---
if (req.method === "POST" && path === "/api/trade/calc") {
const p = await readBody(req)
try { const calc = sizePosition(p); return json(res, 200, { calc, grade: gradeTrade(calc) }) }
catch (e) { return json(res, 400, { error: String(e.message) }) }
}

// --- Keys (status only; secrets never returned) ---
if (req.method === "GET" && path === "/api/keys") return json(res, 200, { keys: listKeys() })
if (req.method === "POST" && path === "/api/keys/remove") {
const { keyRef } = await readBody(req); removeKey(keyRef); return json(res, 200, { ok: true })
}

// --- Hybrid LLM status (online/offline provider) ---
if (req.method === "GET" && path === "/api/llm/status") {
return json(res, 200, await llmStatus())
}

// --- On-device model status (is the offline model downloaded & ready?) ---
if (req.method === "GET" && path === "/api/model/status") {
return json(res, 200, modelStatus())
}

// --- On-device model catalog (real: SDK-exposed + on-disk + selected) ---
if (req.method === "GET" && path === "/api/model/list") {
return json(res, 200, listModels())
}
// --- Select a model (persists choice, unloads current one) ---
if (req.method === "POST" && path === "/api/model/select") {
const { id } = await readBody(req)
if (!id) return json(res, 400, { error: "id обязателен" })
try { return json(res, 200, await switchModel(id)) }
catch (e) { return json(res, 400, { error: String(e?.message || e) }) }
}
// --- Download the selected (or given) model in the background ---
if (req.method === "POST" && path === "/api/model/download") {
const { id } = await readBody(req)
try {
if (id) await switchModel(id)
const st = startDownload(id || null)
return json(res, 200, { ok: true, active: st.active, id: st.id, error: st.error })
} catch (e) { return json(res, 400, { error: String(e?.message || e) }) }
}
// --- Download progress (best-effort log tail) ---
if (req.method === "GET" && path === "/api/model/download/status") {
return json(res, 200, dl)
}

// --- Universal dynamic shell agent (any PC problem; no hardcoded tasks) ---
if (req.method === "POST" && path === "/api/agent/diagnose") {
const { problem, os, lang, execute, confirm, wantFix } = await readBody(req)
if (!problem) return json(res, 400, { error: "problem обязателен" })
return json(res, 200, await diagnose(problem, { os, lang, execute: !!execute, confirm: !!confirm, wantFix: !!wantFix }))
}
if (req.method === "GET" && path === "/api/agent/playbooks") {
const q = url.searchParams.get("q")
if (q) return json(res, 200, { match: matchPlaybook(q) })
return json(res, 200, { playbooks: PLAYBOOKS.map((p) => ({ id: p.id, title: p.title, os: p.os, risk: p.risk })) })
}
if (req.method === "POST" && path === "/api/agent/exec") {
const { script, shell, confirm } = await readBody(req)
if (!script) return json(res, 400, { error: "script обязателен" })
return json(res, 200, await runScript(script, { shell, confirm: !!confirm }))
}
if (req.method === "GET" && path === "/api/agent/cache") {
return json(res, 200, solutionCache.stats())
}

// --- Zero-Trust broker chat (per-chat state machine) ---
if (req.method === "POST" && path === "/api/chat") {
const { q, lang, chatId, history } = await readBody(req)
const id = chatId || "default"
// 1) Broker safety rail first (trade flow). If it handles, return that.
const broker = await brokerStep(id, q || "", lang)
if (broker.handled) {
const det = await import("./src/lang.js").then((m) => m.detectLang)
return json(res, 200, { text: broker.text, lang: lang || det(q || ""), mode: "broker:" + broker.state, data: broker.data || null, sources: ["Bitfinex", "Tether WDK"] })
}
// 2) Otherwise the free-form AI answers (local brain / LLM).
const result = await answer(q || "", { lang, history })
return json(res, 200, result)
}
if (req.method === "POST" && path === "/api/chat/reset") {
const { chatId } = await readBody(req); brokerReset(chatId || "default"); return json(res, 200, { ok: true })
}

json(res, 404, { error: "not found" })
} catch (e) {
json(res, 500, { error: String(e?.message || e) })
}
}).listen(PORT, () => console.log(`Nyx running on http://localhost:${PORT}  (app: /app)`))
