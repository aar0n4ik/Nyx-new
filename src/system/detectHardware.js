import os from "node:os"

// Возвращает рекомендованный тир из catalog.json по железу пользователя.
// VRAM определяется опционально через systeminformation, если пакет установлен.
export async function detectHardware() {
	const totalRamGB = Math.round(os.totalmem() / 1024 ** 3)
	const cpuCores = os.cpus()?.length ?? 4
	let vramGB = 0
	try {
		const si = await import("systeminformation")
		const gpu = await si.graphics()
		vramGB = Math.round(
			Math.max(0, ...(gpu.controllers ?? []).map((c) => (c.vram ?? 0) / 1024)),
		)
	} catch {
		/* systeminformation не установлен — считаем CPU-only */
	}
	return { totalRamGB, cpuCores, vramGB }
}

export function recommendTier(hw) {
	const { totalRamGB, vramGB } = hw
	if (vramGB >= 24 && totalRamGB >= 32) return "max"
	if (totalRamGB >= 16 || vramGB >= 8) return "strong"
	if (totalRamGB >= 8) return "balanced"
	return "light"
}
