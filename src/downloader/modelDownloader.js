import { createWriteStream, createReadStream, existsSync, statSync, renameSync, mkdirSync } from "node:fs"
import { createHash } from "node:crypto"
import { dirname } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"

// Скачивает модель с поддержкой докачки при обрыве связи.
// onProgress({ received, total, percent, speedBps }) вызывается для UI.
export async function downloadModel({ url, dest, expectedSha256, onProgress, signal, maxRetries = 8 }) {
	mkdirSync(dirname(dest), { recursive: true })
	const part = dest + ".part"

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const from = existsSync(part) ? statSync(part).size : 0
			const headers = from > 0 ? { Range: `bytes=${from}-` } : {}
			const res = await fetch(url, { headers, signal })
			if (!(res.status === 200 || res.status === 206)) {
				throw new Error("HTTP " + res.status)
			}
			const total = from + Number(res.headers.get("content-length") ?? 0)
			const out = createWriteStream(part, { flags: from > 0 ? "a" : "w" })

			let received = from
			let lastT = Date.now()
			let lastB = from
			const reader = res.body.getReader()
			for (;;) {
				const { done, value } = await reader.read()
				if (done) break
				received += value.length
				out.write(Buffer.from(value))
				const now = Date.now()
				if (now - lastT >= 400) {
					const speedBps = ((received - lastB) * 1000) / (now - lastT)
					onProgress?.({ received, total, percent: total ? received / total : 0, speedBps })
					lastT = now
					lastB = received
				}
			}
			await new Promise((r) => out.end(r))

			// Проверка целостности
			if (expectedSha256) {
				const got = await sha256File(part)
				if (got.toLowerCase() !== expectedSha256.toLowerCase()) {
					throw new Error("SHA-256 mismatch: файл повреждён")
				}
			}
			renameSync(part, dest) // atomic
			onProgress?.({ received: total, total, percent: 1, speedBps: 0 })
			return { path: dest }
		} catch (err) {
			if (signal?.aborted) throw err
			if (attempt === maxRetries) throw err
			const backoff = Math.min(30000, 1000 * 2 ** attempt)
			onProgress?.({ retrying: true, attempt: attempt + 1, waitMs: backoff, error: String(err) })
			await sleep(backoff)
		}
	}
}

function sha256File(path) {
	return new Promise((resolve, reject) => {
		const hash = createHash("sha256")
		const s = createReadStream(path)
		s.on("data", (d) => hash.update(d))
		s.on("end", () => resolve(hash.digest("hex")))
		s.on("error", reject)
	})
}
