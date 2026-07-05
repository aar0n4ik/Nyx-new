import { createWriteStream, promises as fs } from "node:fs"
import { createHash } from "node:crypto"
import { stat } from "node:fs/promises"
import { blobPath, hasBlob, linkModel, ensureDirs } from "../paths.js"

const safeStat = (p) => stat(p).catch(() => null)

// SHA-256 файла потоково (низкая память даже для многогигабайтных весов).
export async function sha256File(p) {
	const h = createHash("sha256")
	const fd = await fs.open(p, "r")
	const buf = Buffer.alloc(1 << 20)
	try {
		for (;;) {
			const { bytesRead } = await fd.read(buf, 0, buf.length)
			if (!bytesRead) break
			h.update(buf.subarray(0, bytesRead))
		}
	} finally {
		await fd.close()
	}
	return h.digest("hex")
}

// entry: { id, model, url, mirrors?, sha256?, bytes? }
// Докачиваемая (HTTP Range) загрузка с проверкой SHA-256, backoff и дедупом по blob.
// onProgress({ phase, done, total, pct, speed, etaSec }) — для UI.
export async function downloadModel(entry, { onProgress = () => {}, signal, maxRetries = 6 } = {}) {
	ensureDirs()
	const modelId = entry.model || entry.id
	const sha = entry.sha256 || null
	const key = sha || `pending-${modelId}`
	const urls = [entry.url, ...(entry.mirrors || [])].filter(Boolean)
	if (!urls.length) throw new Error(`В каталоге нет ссылки на загрузку для ${modelId}`)

	// Уже есть проверенный blob? Просто (пере)линкуем и выходим — качать не надо.
	if (sha && hasBlob(sha)) {
		const ok = (await sha256File(blobPath(sha))) === sha
		if (ok) {
			const link = linkModel(modelId, sha)
			onProgress({ phase: "done", done: entry.bytes || 0, total: entry.bytes || 0, pct: 1, speed: 0, etaSec: 0 })
			return { path: link, blob: blobPath(sha), sha256: sha, deduped: true }
		}
	}

	const finalPath = blobPath(key)
	const partPath = `${finalPath}.part`
	let attempt = 0

	for (;;) {
		const url = urls[Math.min(attempt, urls.length - 1)]
		try {
			const have = (await safeStat(partPath))?.size || 0
			const res = await fetch(url, { headers: have ? { Range: `bytes=${have}-` } : {}, signal })
			if (!(res.status === 200 || res.status === 206)) throw new Error(`HTTP ${res.status}`)
			const resumed = res.status === 206
			const out = createWriteStream(partPath, { flags: have && resumed ? "a" : "w" })
			let done = resumed ? have : 0
			const total = entry.bytes || done + Number(res.headers.get("content-length") || 0) || 0
			let lastT = Date.now()
			let lastB = done
			onProgress({ phase: "downloading", done, total, pct: total ? done / total : 0, speed: 0, etaSec: null })
			try {
				for await (const chunk of res.body) {
					if (signal?.aborted) throw new Error("aborted")
					out.write(chunk)
					done += chunk.length
					const now = Date.now()
					if (now - lastT > 300) {
						const speed = (done - lastB) / ((now - lastT) / 1000)
						onProgress({ phase: "downloading", done, total, pct: total ? done / total : 0, speed, etaSec: speed ? Math.round((total - done) / speed) : null })
						lastT = now
						lastB = done
					}
				}
			} finally {
				await new Promise((r) => out.end(r))
			}

			if (sha) {
				onProgress({ phase: "verify", done: total, total, pct: 1, speed: 0, etaSec: 0 })
				const got = await sha256File(partPath)
				if (got.toLowerCase() !== sha.toLowerCase()) {
					await fs.rm(partPath, { force: true })
					throw new Error("SHA-256 не совпал — файл повреждён")
				}
			}

			await fs.rename(partPath, finalPath)
			onProgress({ phase: "linking", done: total, total, pct: 1, speed: 0, etaSec: 0 })
			const link = linkModel(modelId, key)
			onProgress({ phase: "done", done: total, total, pct: 1, speed: 0, etaSec: 0 })
			return { path: link, blob: finalPath, sha256: sha, deduped: false }
		} catch (e) {
			if (signal?.aborted) throw e
			if (++attempt > maxRetries) throw e
			const wait = Math.min(30000, 1000 * 2 ** attempt)
			onProgress({ phase: "retry", attempt, waitMs: wait, error: String(e?.message || e) })
			await new Promise((r) => setTimeout(r, wait))
		}
	}
}
