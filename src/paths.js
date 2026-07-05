import { homedir } from "node:os"
import { join } from "node:path"
import {
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
	statSync,
	linkSync,
	copyFileSync,
} from "node:fs"

// Единый домашний каталог данных Nyx (отдельно от кода приложения).
export const NYX_HOME = process.env.NYX_HOME || join(homedir(), ".nyx")

// Физический каталог весов. КЛЮЧЕВОЕ РЕШЕНИЕ: по умолчанию он
// совпадает с кэшем QVAC SDK, чтобы наш downloader и SDK смотрели в ОДНУ
// директорию и веса не дублировались.
export const BLOBS_DIR =
	process.env.NYX_BLOBS_DIR ||
	process.env.NYX_QVAC_CACHE ||
	join(homedir(), ".qvac", "models")

export const MODELS_DIR = join(NYX_HOME, "models")
export const CONFIG_FILE = join(NYX_HOME, "config.json")
export const CATALOG_CACHE = join(NYX_HOME, "catalog.cache.json")
export const LOGS_DIR = join(NYX_HOME, "logs")

export function ensureDirs() {
	for (const d of [NYX_HOME, BLOBS_DIR, MODELS_DIR, LOGS_DIR]) {
		try {
			mkdirSync(d, { recursive: true })
		} catch {}
	}
}

export function readConfig() {
	try {
		return JSON.parse(readFileSync(CONFIG_FILE, "utf8"))
	} catch {
		return {}
	}
}

export function writeConfig(patch) {
	ensureDirs()
	const next = { ...readConfig(), ...patch, updatedAt: new Date().toISOString() }
	writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2))
	return next
}

// Контент-адресуемый путь до веса: blobs дедуплицируются по SHA-256.
export function blobPath(sha256) {
	return join(BLOBS_DIR, `sha256-${sha256}.gguf`)
}

export function modelLink(id) {
	return join(MODELS_DIR, id, "model.gguf")
}

export function hasBlob(sha256) {
	try {
		return statSync(blobPath(sha256)).size > 0
	} catch {
		return false
	}
}

// models/<id>/model.gguf -> blobs/sha256-<hash>.gguf (hardlink, фолбэк — копия).
// Дедуп: если blob с таким хешем уже есть — повторно качать не нужно.
export function linkModel(id, sha256) {
	ensureDirs()
	mkdirSync(join(MODELS_DIR, id), { recursive: true })
	const target = blobPath(sha256)
	const link = modelLink(id)
	try {
		if (existsSync(link)) return link
	} catch {}
	try {
		linkSync(target, link)
	} catch {
		try {
			copyFileSync(target, link)
		} catch {}
	}
	return link
}
