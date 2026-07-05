import http from "node:http"
import { readFileSync, existsSync, rmSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, extname } from "node:path"

import { modelStatus, unloadAll } from "./src/qvac.js"
import { listModels } from "./src/modelRegistry.js"
import { ensureLocalSetup } from "./src/firstrun.js"
import "./src/netguard.js"
import { detectHardware, recommend } from "./src/system/detectHardware.js"
import { getCatalog, findEntry, defaultEntry } from "./src/modelCatalog.js"
import { downloadModel } from "./src/downloader/modelDownloader.js"
import { readConfig, writeConfig, ensureDirs, modelLink, blobPath } from "./src/paths.js"
import { listInstalled } from "./src/installedModels.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(HERE, "public")
const PORT = process.env.NYX_PORT || 3000

ensureDirs()

// ——— Состояние загрузки (одна активная за раз) ———
const dl = {
	active: false,
	modelId: null,
	tier: null,
	phase: "idle", // idle|downloading|verify|linking|retry|paused|canceled|done|error
	pct: 0,
	done: 0,
	total: 0,
	speed: 0,
	etaSec: null,
	error: null,
	paused: false, // намерение паузы (отличает паузу от отмены при abort)
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
		tier: entry.id,
		phase: "downloading",
		pct: 0,
		done: 0,
		total: entry.bytes || 0,
		speed: 0,
		etaSec: null,
		error: null,
		paused: false,
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
			dl.paused = false
			// Сохраняем выбор в ~/.nyx/config.json — именно отсюда движок берёт активную модель.
			writeConfig({
				onboarded: true,
				selectedModel: dl.modelId,
				selectedTier: dl.tier,
				modelPath: res?.path || null,
				modelSha256: res?.sha256 || null,
			})
			// Сбрасываем загруженную модель, чтобы следующий запрос поднял новую.
			unloadAll().catch(() => {})
		})
		.catch((e) => {
			dl.active = false
			if (dl.paused) {
				dl.phase = "paused" // намеренная пауза — .part сохранён, resume докачает
			} else if (ctrl.signal.aborted) {
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
	res.writeHead(code, { "content-type": "application/json; charset=utf-8" })
	res.end(JSON.stringify(obj))
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
	if (rec.n > 300) {
		sendJson(res, 429, { error: "Слишком много запросов" })
		return false
	}
	return true
}

const server = http.createServer(async (req, res) => {
	try {
		const u = new URL(req.url, `http://localhost:${PORT}`)
		const p = u.pathname

		// ——— Страницы / статика ———
		if (p === "/" || p === "/app") return sendFile(res, join(PUBLIC, "app.html"))
		if (p === "/app.css") return sendFile(res, join(PUBLIC, "app.css"))
		if (p === "/app.js") return sendFile(res, join(PUBLIC, "app.js"))
		if (p === "/onboard") return sendFile(res, join(PUBLIC, "onboard.html"))
		if (p === "/onboard.css") return sendFile(res, join(PUBLIC, "onboard.css"))
		if (p === "/onboard.js") return sendFile(res, join(PUBLIC, "onboard.js"))
		if (p === "/models") return sendFile(res, join(PUBLIC, "models.html"))
		if (p === "/models.css") return sendFile(res, join(PUBLIC, "models.css"))
		if (p === "/models.js") return sendFile(res, join(PUBLIC, "models.js"))

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

		// ——— Загрузка модели ———
		if (p === "/api/model/download" && req.method === "POST") {
			const body = await readBody(req)
			const r = await startDownload(body.model || body.id || body.tier)
			return sendJson(res, r.ok ? 200 : 409, r)
		}
		if (p === "/api/model/download/status" && req.method === "GET") {
			return sendJson(res, 200, dlSnapshot())
		}
		if (p === "/api/model/download/cancel" && req.method === "POST") {
			dl.paused = false
			if (dl.ctrl) dl.ctrl.abort()
			return sendJson(res, 200, { ok: true })
		}
		if (p === "/api/model/download/pause" && req.method === "POST") {
			dl.paused = true // важно: выставляем ДО abort, чтобы catch отличил паузу от отмены
			if (dl.ctrl) dl.ctrl.abort()
			return sendJson(res, 200, { ok: true })
		}
		if (p === "/api/model/download/resume" && req.method === "POST") {
			const r = await startDownload(dl.tier || dl.modelId)
			return sendJson(res, r.ok ? 200 : 409, r)
		}

		// ——— Менеджер моделей (внутри приложения) ———
		if (p === "/api/model/installed" && req.method === "GET") {
			const catalog = await getCatalog()
			const cfg = readConfig()
			return sendJson(res, 200, {
				active: cfg.selectedModel || null,
				activeTier: cfg.selectedTier || null,
				installed: listInstalled(catalog),
			})
		}
		if (p === "/api/model/activate" && req.method === "POST") {
			const body = await readBody(req)
			const catalog = await getCatalog()
			const entry = findEntry(catalog, body.model || body.tier || body.id)
			if (!entry) return sendJson(res, 404, { ok: false, error: "Модель не найдена" })
			const id = entry.model || entry.id
			const link = modelLink(id)
			if (!existsSync(link)) return sendJson(res, 409, { ok: false, error: "Модель ещё не загружена" })
			writeConfig({ selectedModel: id, selectedTier: entry.id, modelPath: link, modelSha256: entry.sha256 || null })
			await unloadAll().catch(() => {})
			return sendJson(res, 200, { ok: true, active: id })
		}
		if (p === "/api/model/remove" && req.method === "POST") {
			const body = await readBody(req)
			const catalog = await getCatalog()
			const entry = findEntry(catalog, body.model || body.tier || body.id)
			if (!entry) return sendJson(res, 404, { ok: false, error: "Модель не найдена" })
			const id = entry.model || entry.id
			try {
				rmSync(modelLink(id), { force: true })
				if (entry.sha256) rmSync(blobPath(entry.sha256), { force: true })
			} catch {}
			const cfg = readConfig()
			if (cfg.selectedModel === id) writeConfig({ selectedModel: null, selectedTier: null, modelPath: null })
			return sendJson(res, 200, { ok: true, removed: id })
		}

		// ——— Статус движка / система ———
		if (p === "/api/model/status" && req.method === "GET") {
			return sendJson(res, 200, await modelStatus())
		}
		if (p === "/api/model/list" && req.method === "GET") {
			return sendJson(res, 200, { models: listModels() })
		}
		if (p === "/api/system/hardware" && req.method === "GET") {
			return sendJson(res, 200, await detectHardware())
		}
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
