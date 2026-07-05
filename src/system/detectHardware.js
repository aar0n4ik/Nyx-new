import os from "node:os"

// Авто-детект железа: RAM / CPU / VRAM. VRAM — опционально через systeminformation.
export async function detectHardware() {
	const totalRamGB = Math.max(1, Math.round(os.totalmem() / 1024 ** 3))
	const freeRamGB = Math.round(os.freemem() / 1024 ** 3)
	const cpus = os.cpus() || []
	const cpuCores = cpus.length || 4
	const cpuModel = (cpus[0]?.model || "Unknown CPU").trim()
	const platform = os.platform()
	const arch = os.arch()
	let vramGB = 0
	let gpuModel = null
	try {
		const si = await import("systeminformation")
		const gpu = await si.graphics()
		for (const c of gpu.controllers || []) {
			const vram = (c.vram || 0) / 1024 // systeminformation отдаёт МБ
			if (vram > vramGB) {
				vramGB = vram
				gpuModel = c.model || c.name || null
			}
		}
		vramGB = Math.round(vramGB)
	} catch {
		/* systeminformation не установлен — считаем CPU-only */
	}
	return { totalRamGB, freeRamGB, cpuCores, cpuModel, platform, arch, vramGB, gpuModel }
}

// Лестница тиров по железу.
export function recommendTier(hw) {
	const { totalRamGB = 8, vramGB = 0 } = hw || {}
	if (vramGB >= 24 && totalRamGB >= 32) return "max"
	if (totalRamGB >= 16 || vramGB >= 8) return "strong"
	if (totalRamGB >= 8) return "balanced"
	return "light"
}

// Рекомендация по каталогу + человеческое обоснование.
export function recommend(catalog, hw) {
	const tierId = recommendTier(hw)
	const tiers = catalog?.tiers || []
	const tier =
		tiers.find((t) => t.id === tierId) ||
		tiers.find((t) => t.recommended) ||
		tiers[0] ||
		null
	return {
		tier: tier?.id || tierId,
		modelId: tier?.model || null,
		display: tier?.display || null,
		reason: buildReason(tierId, hw),
		specs: hw,
	}
}

function buildReason(tierId, hw) {
	const ram = hw?.totalRamGB
	const vram = hw?.vramGB
	if (tierId === "max")
		return `У вас мощная видеокарта (${vram} ГБ) и ${ram} ГБ памяти — потянете максимальную модель.`
	if (tierId === "strong")
		return `У вас ${ram} ГБ памяти${vram ? ` и видеокарта на ${vram} ГБ` : ""} — можно взять мощную модель.`
	if (tierId === "balanced")
		return `У вас ${ram} ГБ памяти — сбалансированная модель будет умной и при этом быстрой.`
	return `Чтобы всё работало плавно на вашем ПК (${ram} ГБ памяти), начнём с лёгкой модели.`
}
