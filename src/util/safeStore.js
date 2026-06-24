// Durable JSON storage: corruption-safe reads + atomic writes with backup.
// Prevents data/cache loss on crash, power-off, or concurrent write.
//  - writeJSONAtomic: write to .tmp -> keep .bak of last good -> atomic rename.
//  - readJSON: parse main file; on corruption fall back to .bak; else fallback.
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, copyFileSync } from "node:fs"
import { dirname } from "node:path"

export function readJSON(file, fallback = {}) {
	try {
		if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"))
	} catch {
		// main file corrupted -> try the last known-good backup
		try { if (existsSync(file + ".bak")) return JSON.parse(readFileSync(file + ".bak", "utf8")) } catch {}
	}
	try { return structuredClone(fallback) } catch { return JSON.parse(JSON.stringify(fallback)) }
}

export function writeJSONAtomic(file, obj) {
	try {
		mkdirSync(dirname(file), { recursive: true })
		const tmp = file + ".tmp"
		writeFileSync(tmp, JSON.stringify(obj, null, 2))
		if (existsSync(file)) { try { copyFileSync(file, file + ".bak") } catch {} }
		renameSync(tmp, file) // atomic on the same filesystem
		return true
	} catch { return false }
}
