// First-run engine bootstrap. Тяжёлый нативный рантайм @qvac/sdk (~1 ГБ) НЕ
// кладётся в установщик — .exe остаётся лёгким. При первом запуске качаем
// платформенный engine-pack (node_modules) из GitHub-релиза, распаковываем в
// ~/.nyx/engine и резолвим @qvac/sdk оттуда. Полностью локально после одной
// докачки; при неудаче qvac.js уходит в оффлайн-ответчик (никаких фейков).
import { spawn } from "node:child_process"
import {
	createWriteStream,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

const NYX_HOME = process.env.NYX_HOME || join(homedir(), ".nyx")
export const ENGINE_DIR = process.env.NYX_ENGINE_DIR || join(NYX_HOME, "engine")
const ENGINE_NM = join(ENGINE_DIR, "node_modules")
const MARKER = join(ENGINE_DIR, "engine.json")
const SDK_DIR = join(ENGINE_NM, "@qvac", "sdk")

const PLAT =
	process.platform === "win32" ? "win" : process.platform === "darwin" ? "mac" : "linux"
const ARCH = process.arch
const REPO = process.env.NYX_ENGINE_REPO || "aar0n4ik/Nyx-new"
const ASSET = `nyx-engine-${PLAT}-${ARCH}.tar.gz`

function appVersion() {
	if (process.env.NYX_VERSION) return process.env.NYX_VERSION
	try {
		const req = createRequire(import.meta.url)
		return req("../../package.json").version || "0.0.0"
	} catch {
		return "0.0.0"
	}
}
const VERSION = appVersion()

export const ENGINE_URL =
	process.env.NYX_ENGINE_URL ||
	(VERSION && VERSION !== "0.0.0"
		? `https://github.com/${REPO}/releases/download/v${VERSION}/${ASSET}`
		: `https://github.com/${REPO}/releases/latest/download/${ASSET}`)

let state = {
	active: false,
	phase: "idle",
	pct: 0,
	done: 0,
	total: 0,
	speed: 0,
	etaSec: null,
	error: null,
}

export function engineInstalled() {
	try {
		return existsSync(join(SDK_DIR, "package.json"))
	} catch {
		return false
	}
}

export function engineStatus() {
	return { ...state, installed: engineInstalled(), url: ENGINE_URL, asset: ASSET }
}

// Точка входа @qvac/sdk из скачанного каталога. Транзитивные зависимости SDK
// резолвятся относительно этого файла (Node идёт вверх по ENGINE_DIR/node_modules),
// поэтому pack должен содержать полный набор prod-зависимостей.
export function resolveEngineSdkEntry() {
	if (!engineInstalled()) return null
	try {
		const pj = JSON.parse(readFileSync(join(SDK_DIR, "package.json"), "utf8"))
		let rel = null
		const exp = pj.exports
		if (typeof exp === "string") rel = exp
		else if (exp && typeof exp === "object") {
			let dot = exp["."] !== undefined ? exp["."] : exp
			if (typeof dot === "string") rel = dot
			else if (dot && typeof dot === "object")
				rel = dot.import || dot.node || dot.default || dot.require
			if (rel && typeof rel === "object") rel = rel.import || rel.default
		}
		rel = rel || pj.module || pj.main || "index.js"
		return pathToFileURL(join(SDK_DIR, rel)).href
	} catch {
		try {
			const req = createRequire(join(ENGINE_NM, "_resolver.js"))
			return pathToFileURL(req.resolve("@qvac/sdk")).href
		} catch {
			return null
		}
	}
}

function extractTarGz(file, dest) {
	return new Promise((resolve, reject) => {
		// tar есть в Windows 10+ (bsdtar), macOS и Linux — распаковка без npm-зависимостей.
		const p = spawn("tar", ["-xzf", file, "-C", dest], { stdio: "ignore" })
		p.on("error", reject)
		p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`tar exit ${code}`))))
	})
}

async function download(url, dest, onProgress) {
	const res = await fetch(url, { redirect: "follow" })
	if (!res.ok) throw new Error(`HTTP ${res.status}`)
	const total = Number(res.headers.get("content-length") || 0)
	const out = createWriteStream(dest)
	let done = 0
	let lastT = Date.now()
	let lastB = 0
	try {
		for await (const chunk of res.body) {
			out.write(chunk)
			done += chunk.length
			const now = Date.now()
			if (now - lastT > 300) {
				const speed = (done - lastB) / ((now - lastT) / 1000)
				onProgress({
					phase: "downloading",
					done,
					total,
					pct: total ? done / total : 0,
					speed,
					etaSec: speed ? Math.round((total - done) / speed) : null,
				})
				lastT = now
				lastB = done
			}
		}
	} finally {
		await new Promise((r) => out.end(r))
	}
	onProgress({ phase: "downloading", done, total, pct: total ? done / total : 1, speed: 0, etaSec: 0 })
}

// Идемпотентно: повторные вызовы во время активной установки безопасны.
export async function ensureEngine({ onProgress = () => {} } = {}) {
	if (engineInstalled()) {
		state = { ...state, active: false, phase: "done", pct: 1 }
		return { ok: true, already: true }
	}
	if (state.active) return { ok: true, active: true }
	state = { active: true, phase: "downloading", pct: 0, done: 0, total: 0, speed: 0, etaSec: null, error: null }
	const packPath = join(ENGINE_DIR, "pack.tar.gz")
	const tmp = join(ENGINE_DIR, ".tmp")
	try {
		mkdirSync(ENGINE_DIR, { recursive: true })
		await download(ENGINE_URL, packPath, (p) => {
			Object.assign(state, p)
			onProgress(engineStatus())
		})
		state.phase = "extracting"
		state.pct = 1
		onProgress(engineStatus())
		rmSync(tmp, { recursive: true, force: true })
		mkdirSync(tmp, { recursive: true })
		await extractTarGz(packPath, tmp)
		const srcNm = existsSync(join(tmp, "node_modules")) ? join(tmp, "node_modules") : tmp
		rmSync(ENGINE_NM, { recursive: true, force: true })
		renameSync(srcNm, ENGINE_NM)
		rmSync(tmp, { recursive: true, force: true })
		rmSync(packPath, { force: true })
		writeFileSync(
			MARKER,
			JSON.stringify(
				{ version: VERSION, platform: PLAT, arch: ARCH, installedAt: new Date().toISOString() },
				null,
				2,
			),
		)
		if (!engineInstalled()) throw new Error("распаковано, но @qvac/sdk не найден")
		state = { ...state, active: false, phase: "done", pct: 1 }
		onProgress(engineStatus())
		return { ok: true }
	} catch (e) {
		try {
			rmSync(packPath, { force: true })
			rmSync(tmp, { recursive: true, force: true })
		} catch {}
		state = { ...state, active: false, phase: "error", error: String(e?.message || e) }
		onProgress(engineStatus())
		return { ok: false, error: state.error }
	}
}
