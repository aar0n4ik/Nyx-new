import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { CATALOG_CACHE, ensureDirs } from "./paths.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const EMBEDDED = join(HERE, "catalog.json")
const CDN_URL = process.env.NYX_CATALOG_URL || "https://cdn.nyx.app/catalog.json"

let mem = null

// Каталог моделей: CDN (свежий) -> кэш ~/.nyx -> вшитый фолбэк.
// Так список моделей меняется без релиза приложения, а оффлайн всё равно работает.
export async function getCatalog({ refresh = false } = {}) {
	if (mem && !refresh) return mem
	try {
		const res = await fetch(CDN_URL, { signal: AbortSignal.timeout(4000) })
		if (res.ok) {
			const j = await res.json()
			if (j && Array.isArray(j.tiers)) {
				cacheCatalog(j)
				mem = j
				return j
			}
		}
	} catch {}
	try {
		const cached = JSON.parse(readFileSync(CATALOG_CACHE, "utf8"))
		if (cached?.tiers) {
			mem = cached
			return cached
		}
	} catch {}
	mem = JSON.parse(readFileSync(EMBEDDED, "utf8"))
	return mem
}

function cacheCatalog(j) {
	try {
		ensureDirs()
		writeFileSync(CATALOG_CACHE, JSON.stringify(j, null, 2))
	} catch {}
}

export function findEntry(catalog, idOrModel) {
	const tiers = catalog?.tiers || []
	return tiers.find((t) => t.id === idOrModel || t.model === idOrModel) || null
}

export function defaultEntry(catalog) {
	const tiers = catalog?.tiers || []
	return (
		tiers.find((t) => t.id === catalog?.default) ||
		tiers.find((t) => t.recommended) ||
		tiers[0] ||
		null
	)
}
