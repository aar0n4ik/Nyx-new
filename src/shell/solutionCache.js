// Lightweight local cache of successful [problem -> script] patterns.
// On a repeat failure the agent recalls the proven script instantly, with no
// model spend. Keyed by Jaccard token similarity; LRU-capped; persisted to disk.
import { readJSON, writeJSONAtomic } from "../util/safeStore.js"

const FILE = process.env.NYX_CACHE_FILE || "data/solutions.json"
const MAX = Number(process.env.NYX_CACHE_MAX || 200)

// Corruption-safe load + atomic persist so a crash mid-write never wipes the
// learned solutions cache (falls back to .bak automatically).
function load() { return readJSON(FILE, { items: [] }) }
function persist(db) { writeJSONAtomic(FILE, db) }

const STOP = new Set("the a an and or to of for is are be on in at my me и в на по с до для из не что как мой мне это".split(/\s+/))
export function tokens(s) {
	return (s || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))
}
function jaccard(a, b) {
	const A = new Set(a), B = new Set(b)
	if (!A.size || !B.size) return 0
	let inter = 0; for (const x of A) if (B.has(x)) inter++
	return inter / (A.size + B.size - inter)
}

/** Find the best matching cached solution above threshold, or null. */
export function lookup(problem, { os = process.platform, threshold = 0.5 } = {}) {
	const db = load(); const qt = tokens(problem)
	let best = null, bestScore = 0
	for (const it of db.items) {
		if (it.os && os && it.os !== os) continue
		const score = jaccard(qt, it.tokens || tokens(it.problem))
		if (score > bestScore) { bestScore = score; best = it }
	}
	if (best && bestScore >= threshold) {
		best.lastUsed = Date.now(); best.hits = (best.hits || 0) + 1; persist(db)
		return { ...best, score: Number(bestScore.toFixed(3)) }
	}
	return null
}

/** Remember a successful script. Merges with near-duplicates; LRU-evicts beyond MAX. */
export function record({ problem, script, shell, os = process.platform, success = true }) {
	if (!problem || !script) return
	const db = load(); const qt = tokens(problem)
	const dup = db.items.find((it) => it.shell === shell && jaccard(qt, it.tokens || []) >= 0.8)
	if (dup) {
		dup.script = script; dup.successes = (dup.successes || 0) + (success ? 1 : 0); dup.lastUsed = Date.now()
	} else {
		db.items.push({ problem, tokens: qt, script, shell, os, successes: success ? 1 : 0, hits: 0, created: Date.now(), lastUsed: Date.now() })
	}
	db.items.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
	if (db.items.length > MAX) db.items.length = MAX
	persist(db)
}

export function stats() {
	const db = load()
	return { count: db.items.length, top: db.items.slice(0, 5).map((i) => ({ problem: i.problem, shell: i.shell, hits: i.hits, successes: i.successes })) }
}
