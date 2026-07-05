import http from "node:http"
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, extname } from "node:path"

import { modelStatus, switchModel } from "./src/qvac.js"
import { listModels } from "./src/modelRegistry.js"
import { ensureLocalSetup } from "./src/firstrun.js"
import "./src/netguard.js"
import { detectHardware, recommend } from "./src/system/detectHardware.js"
import { getCatalog, findEntry, defaultEntry } from "./src/modelCatalog.js"
import { downloadModel } from "./src/downloader/modelDownloader.js"
import { readConfig, writeConfig, ensureDirs } from "./src/paths.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(HERE, "public")
const PORT = process.env.NYX_PORT || 3000

ensureDirs()

// ——— Состояние загрузки (одна активная загрузка за раз) ———
const dl = {
	active: false,
	modelId: null,
	phase: "idle", // idle|downloading|verify|linking|retry|done|error|canceled
	pct: 0,
	done: 0,
	total: 0,
	speed: 0,
	etaSec: null,
	error: null,
	ctrl: null,
}

function dlSnapshot() {
	const { ctrl, ...rest } = dl
	return rest
}

async function resolveEntry(idOrModel) {
	const catalog = await getCatalog()
	if (!idOrModel) return defaultEntry(catalog)
	return findEntry(catalog, idOrModel) || defaultEntry(catalog)
}

async function startDownload(idOrModel) {
	if (dl.active) return { ok: false, error: "Загрузка уже идёт" }
	const entry = await resolveEntry(idOrModel)
	if (!entry) return { ok: false, error: "Модель не найдена в каталоге" }
	const ctrl = new AbortController()
	Object.assign(dl, {
		active: true,
		modelId: entry.model || entry.id,
		phase: "downloading",
		pct: 0,
		done: 0,
		total: entry.bytes || 0,
		speed: 0,
		etaSec: null,
		error: null,
		ctrl,
	})
	downloadModel(entry, {
		signal: ctrl.signal,
		onProgress: (p) => {
			if (p.phase) dl.phase = p.phase
			if (typeof p.pct === "number") dl.pct = p.pct
			if (typeof p.done === "number") dl.done = p.done
			if (typeof p.total === "number" && p.total) dl.total = p.total
			if (typeof p.speed === "number") dl.speed = p.speed
			if (p.etaSec !== undefined) dl.etaSec = p.etaSec
			if (p.error) dl.error = p.error
		},
	})
		.then((res) => {
			dl.phase = "done"
			dl.pct = 1
			dl.active = false
			// Сохраняем выбор в ~/.nyx/config.json (не через switchModel — id каталога может не совпадать с registry).
			writeConfig({
				onboarded: true,
				selectedModel: dl.modelId,
				modelPath: res?.path || null,
				modelSha256: res?.sha256 || null,
			})
		})
		.catch((e) => {
			dl.active = false
			if (dl.ctrl?.signal.aborted) {
				dl.phase = "canceled"
			} else {
				dl.phase = "error"
				dl.error = String(e?.message || e)
			}
		})
	return { ok: true }
}

// ——— Хелперы ———
const MIME = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".woff2": "font/woff2",
}

function sendJson(res, code, obj) {
	const body = JSON.stringify(obj)
	res.writeHead(code, { "content-type": "application/json; charset=utf-8" })
	res.end(body)
}

function sendFile(res, file) {
	if (!existsSync(file)) {
		res.writeHead(404)
		res.end("Not found")
		return
	}
	res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" })
	res.end(readFileSync(file))
}

async function readBody(req) {
	const chunks = []
	for await (const c of req) chunks.push(c)
	if (!chunks.length) return {}
	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8"))
	} catch {
		return {}
	}
}

// Простой rate-limit для API.
const hits = new Map()
function rateLimit(req, res) {
	const ip = req.socket.remoteAddress || "local"
	const now = Date.now()
	const rec = hits.get(ip) || { n: 0, t: now }
	if (now - rec.t > 10000) {
		rec.n = 0
		rec.t = now
	}
	rec.n++
	hits.set(ip, rec)
	if (rec.n > 200) {
		sendJson(res, 429, { error: "Слишком много запросов" })
		return false
	}
	return true
}

const server = http.createServer(async (req, res) => {
	try {
		const u = new URL(req.url, `http://localhost:${PORT}`)
		const p = u.pathname

		// ——— Статика / страницы ———
		if (p === "/" || p === "/app") return sendFile(res, join(PUBLIC, "app.html"))
		if (p === "/app.css") return sendFile(res, join(PUBLIC, "app.css"))
		if (p === "/app.js") return sendFile(res, join(PUBLIC, "app.js"))
		if (p === "/onboard") return sendFile(res, join(PUBLIC, "onboard.html"))
		if (p === "/onboard.css") return sendFile(res, join(PUBLIC, "onboard.css"))
		if (p === "/onboard.js") return sendFile(res, join(PUBLIC, "onboard.js"))

		if (!rateLimit(req, res)) return

		// ——— Onboarding API ———
		if (p === "/api/onboard/recommend" && req.method === "GET") {
			const [hw, catalog] = await Promise.all([detectHardware(), getCatalog()])
			return sendJson(res, 200, { hardware: hw, recommend: recommend(catalog, hw), catalog })
		}
		if (p === "/api/onboard/catalog" && req.method === "GET") {
			return sendJson(res, 200, await getCatalog())
		}
		if (p === "/api/onboard/state" && req.method === "GET") {
			return sendJson(res, 200, readConfig())
		}

		// ——— Model download API ———
		if (p === "/api/model/download" && req.method === "POST") {
			const body = await readBody(req)
			const r = await startDownload(body.model || body.id || body.tier)
			return sendJson(res, r.ok ? 200 : 409, r)
		}
		if (p === "/api/model/download/status" && req.method === "GET") {
			return sendJson(res, 200, dlSnapshot())
		}
		if (p === "/api/model/download/cancel" && req.method === "POST") {
			if (dl.ctrl) dl.ctrl.abort()
			return sendJson(res, 200, { ok: true })
		}
		if (p === "/api/model/download/pause" && req.method === "POST") {
			// Пауза = отмена текущего потока; .part остаётся, resume докачает через Range.
			if (dl.ctrl) dl.ctrl.abort()
			dl.phase = "paused"
			return sendJson(res, 200, { ok: true })
		}
		if (p === "/api/model/download/resume" && req.method === "POST") {
			const r = await startDownload(dl.modelId)
			return sendJson(res, r.ok ? 200 : 409, r)
		}

		// ——— Существующие модельные роуты ———
		if (p === "/api/model/status" && req.method === "GET") {
			return sendJson(res, 200, await modelStatus())
		}
		if (p === "/api/model/list" && req.method === "GET") {
			return sendJson(res, 200, { models: listModels() })
		}
		if (p === "/api/model/select" && req.method === "POST") {
			const body = await readBody(req)
			try {
				await switchModel(body.id)
				return sendJson(res, 200, { ok: true })
			} catch (e) {
				return sendJson(res, 400, { ok: false, error: String(e?.message || e) })
			}
		}

		// ——— Система ———
		if (p === "/api/system/hardware" && req.method === "GET") {
			return sendJson(res, 200, await detectHardware())
		}

		// ——— Первичная настройка окружения ———
		if (p === "/api/setup/ensure" && req.method === "POST") {
			await ensureLocalSetup()
			return sendJson(res, 200, { ok: true })
		}

		res.writeHead(404)
		res.end("Not found")
	} catch (e) {
		sendJson(res, 500, { error: String(e?.message || e) })
	}
})

server.listen(PORT, () => {
	console.log(`[nyx] server on http://localhost:${PORT}`)
})
