// Windows control helpers. Read-only scans run HEADLESSLY (no GUI windows pop up).
// Real changes (installing updates, changing time, etc.) go through the agent
// pipeline, which validates, asks for one confirmation, and self-elevates via UAC.
import { execFile, spawn } from "node:child_process"
import { promisify } from "node:util"

const pexec = promisify(execFile)
const isWin = process.platform === "win32"

function guard() {
	if (!isWin) return { ok: false, error: "Windows-only action (current OS: " + process.platform + ")." }
	return null
}

// Open a Settings pane via ms-settings: URI. Kept only for an explicit,
// user-initiated button click — the AI itself never opens visible UI.
export async function openSettings(pane = "") {
	const g = guard(); if (g) return g
	const uri = `ms-settings:${pane}`
	try {
		spawn("cmd.exe", ["/c", "start", "", uri], { detached: true, stdio: "ignore", windowsHide: true }).unref()
		return { ok: true, opened: uri }
	} catch (e) { return { ok: false, error: e.message } }
}

export const openWindowsUpdateUI = () => openSettings("windowsupdate")

// Headless, read-only Windows Update scan via the Update Agent COM API.
// No GUI windows are opened and nothing is installed here — installing updates is
// a separate, confirmed + self-elevated action handled by the agent pipeline.
export async function startWindowsUpdateScan() {
	const g = guard(); if (g) return g
	const ps =
		"$ErrorActionPreference='Stop'; " +
		"$s=New-Object -ComObject Microsoft.Update.Session; " +
		"$r=$s.CreateUpdateSearcher().Search('IsInstalled=0 and IsHidden=0'); " +
		"('COUNT=' + $r.Updates.Count); " +
		"$r.Updates | ForEach-Object { 'UPD=' + $_.Title }"
	try {
		const { stdout } = await pexec(
			"powershell.exe",
			["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps],
			{ timeout: 60000, encoding: "utf8", windowsHide: true },
		)
		const lines = String(stdout).split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
		const countLine = lines.find((l) => l.startsWith("COUNT="))
		const pending = countLine ? Number(countLine.slice(6)) || 0 : 0
		const titles = lines.filter((l) => l.startsWith("UPD=")).map((l) => l.slice(4))
		return {
			ok: true,
			scanned: true,
			pending,
			titles,
			note: pending
				? `Найдено обновлений: ${pending}. Скажи «обнови Windows» — я сам всё скачаю и установлю в фоне (запрошу права через UAC).`
				: "Система актуальна — доступных обновлений нет.",
		}
	} catch (e) {
		return { ok: false, scanned: false, error: e.message, note: "Не удалось выполнить фоновое сканирование обновлений Windows." }
	}
}
