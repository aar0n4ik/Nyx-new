// Service-protection utilities: per-client rate limiting + tiny TTL memo cache.
// Keeps the local service alive under bursty load / abuse without external deps.

const buckets = new Map()

/** Token-bucket rate limit. Returns { ok, remaining, resetMs }. */
export function rateLimit(key, { max = 30, windowMs = 60000 } = {}) {
	const now = Date.now()
	const b = buckets.get(key) || { count: 0, reset: now + windowMs }
	if (now > b.reset) { b.count = 0; b.reset = now + windowMs }
	b.count++
	buckets.set(key, b)
	return { ok: b.count <= max, remaining: Math.max(0, max - b.count), resetMs: b.reset - now }
}

const memo = new Map()
/** Memoize an async fn by key for ttlMs. Speeds up repeated identical reads. */
export async function cached(key, ttlMs, fn) {
	const now = Date.now()
	const hit = memo.get(key)
	if (hit && now < hit.exp) return hit.val
	const val = await fn()
	memo.set(key, { val, exp: now + ttlMs })
	return val
}

// periodic cleanup so the maps never grow unbounded
setInterval(() => {
	const now = Date.now()
	for (const [k, b] of buckets) if (now > b.reset + 60000) buckets.delete(k)
	for (const [k, v] of memo) if (now > v.exp) memo.delete(k)
}, 60000).unref?.()
