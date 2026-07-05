import { existsSync, statSync } from "node:fs"
import { modelLink } from "./paths.js"

// Какие модели из каталога реально загружены на диск (честная проверка файлов).
export function listInstalled(catalog) {
	const tiers = catalog?.tiers || []
	return tiers.map((t) => {
		const id = t.model || t.id
		const link = modelLink(id)
		let installed = false
		let sizeBytes = 0
		try {
			if (existsSync(link)) {
				installed = true
				sizeBytes = statSync(link).size
			}
		} catch {}
		return {
			id: t.id,
			model: id,
			display: t.display,
			emoji: t.emoji,
			subtitle: t.subtitle,
			badges: t.badges,
			bytes: t.bytes,
			installed,
			sizeBytes,
		}
	})
}
