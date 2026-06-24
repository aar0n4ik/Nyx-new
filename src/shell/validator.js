// Static safety analysis for AI-generated shell scripts (PowerShell / bash).
// Zero-Trust: deny destructive operations by default; allow read-only diagnostics.
// This is a FAST syntactic gate that runs BEFORE anything is executed.

const DESTRUCTIVE = [
	{ re: /\brm\s+(-[a-z]*\s+)*-[a-z]*r[a-z]*f?[a-z]*\s+(\/|~|\$HOME|\*|\.)/i, code: "rmrf_root" },
	{ re: /\brm\s+-[a-z]*\b.*\/(etc|bin|usr|boot|var|lib|sys|proc|dev)\b/i, code: "rm_sysdirs" },
	{ re: /\bmkfs\b|\bdd\s+if=.*of=\/dev\//i, code: "mkfs_dd" },
	{ re: /\b(format)\s+[a-z]:/i, code: "format_vol_win" },
	{ re: /\bdiskpart\b|\bclean\s+all\b/i, code: "diskpart" },
	// Deleting Windows system locations is destructive regardless of flag ORDER
	// (path may appear before OR after -Recurse/-Force) or which delete command is
	// used. The model now authors these commands, so guard hard against every form.
	{ re: /\b(Remove-Item|ri|del|erase|rmdir|rd)\b[\s\S]*(C:\\Windows|C:\\Program Files|C:\\ProgramData|System32|SysWOW64|\$env:SystemRoot|\$env:windir|\$env:ProgramFiles|%SystemRoot%|%windir%|%ProgramFiles%)/i, code: "del_win_sys" },
	{ re: /\bRemove-Item\b[\s\S]*(\$env:USERPROFILE(\s|"|'|$)|\$env:SystemDrive(\s|"|'|$)|[A-Za-z]:\\(\s|"|'|\*|$))/i, code: "del_root_profile" },
	{ re: /\b(del|erase)\s+\/[a-z]\b.*(C:\\Windows|%SystemRoot%|%windir%|System32)/i, code: "del_sys_files" },
	{ re: /\bRemove-Item(Property)?\b[\s\S]*\bHK(LM|CU|EY_LOCAL_MACHINE):/i, code: "del_registry" },
	{ re: /\b(Format-Volume|Clear-Disk|Remove-Partition|Initialize-Disk)\b/i, code: "format_disk_ps" },
	{ re: /\breg\s+delete\s+HK(LM|EY_LOCAL_MACHINE)/i, code: "reg_delete_hklm" },
	{ re: /\b(shutdown|Restart-Computer|Stop-Computer|halt|poweroff|reboot)\b/i, code: "shutdown" },
	{ re: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:/, code: "forkbomb" },
	{ re: /\b(curl|wget|iwr|Invoke-WebRequest|Invoke-RestMethod)\b[\s\S]*\|\s*(bash|sh|zsh|powershell|cmd|iex|Invoke-Expression)/i, code: "net_exec" },
	{ re: /\b(iex|Invoke-Expression)\b/i, code: "iex" },
	{ re: /Set-ExecutionPolicy\s+(Unrestricted|Bypass)\s+-Scope\s+(LocalMachine|CurrentUser)/i, code: "exec_policy" },
	{ re: /\bchmod\s+-R\s+777\s+\//, code: "chmod777" },
	{ re: />\s*\/dev\/sd[a-z]/i, code: "write_dev" },
	{ re: /\bnetsh\b.*\b(disable|delete)\b/i, code: "netsh_disable" },
	{ re: /\bbcdedit\b|\bvssadmin\s+delete\b|\bcipher\s+\/w/i, code: "boot_shadow" },
	{ re: /\b(net\s+user)\b.*\/(add|delete)/i, code: "net_user" },
]

const ELEVATION = [/\bsudo\b/i, /Start-Process\b.*-Verb\s+RunAs/i, /\brunas\b/i]
const NETWORK = [/\b(curl|wget|Invoke-WebRequest|iwr|Invoke-RestMethod|nc|ncat|telnet|ssh|scp)\b/i]
const WRITES = [/\b(Remove-Item|rm|del|rmdir|rd|mv|move|Move-Item|Set-Content|Out-File|>>?)\b/i, /\b(New-Item|mkdir|cp|copy|Copy-Item)\b/i]
// System-configuration changes (clock, timezone, language, services, registry):
// safe but state-changing — always require explicit confirmation (elevated).
const SYSTEM_CONFIG = [/\bSet-Date\b/i, /\bSet-TimeZone\b/i, /\btzutil\b\s+\/s/i, /\bSet-WinUserLanguageList\b/i, /\bSet-WinUILanguageOverride\b/i, /\bSet-ItemProperty\b/i, /\bNew-ItemProperty\b/i, /\b(Set|Stop|Start)-Service\b/i, /Microsoft\.Update\./i, /\bCreateUpdateInstaller\b/i, /\bInstall-WindowsUpdate\b/i, /\bAdd-WindowsCapability\b/i, /\bEnable-WindowsOptionalFeature\b/i, /\bDISM(\.exe)?\b/i]

// User-facing reason text, localized. The regex gate above is language-neutral;
// only the human explanation is translated so a blocked message never mixes
// languages with the rest of the UI. Fallback: requested lang -> English.
const REASONS = {
	rmrf_root: { en: "Recursive filesystem deletion", ru: "Рекурсивное удаление файловой системы", uk: "Рекурсивне видалення файлової системи" },
	rm_sysdirs: { en: "Deleting system directories", ru: "Удаление системных каталогов", uk: "Видалення системних каталогів" },
	mkfs_dd: { en: "Disk format/wipe", ru: "Форматирование/затирание диска", uk: "Форматування/затирання диска" },
	format_vol_win: { en: "Volume format (Windows)", ru: "Форматирование тома (Windows)", uk: "Форматування тому (Windows)" },
	diskpart: { en: "Dangerous disk operations", ru: "Опасные операции с диском", uk: "Небезпечні операції з диском" },
	del_win_sys: { en: "Deleting Windows system files/folders", ru: "Удаление системных файлов/каталогов Windows", uk: "Видалення системних файлів/каталогів Windows" },
	del_root_profile: { en: "Deleting drive root or the entire user profile", ru: "Удаление корня диска или всего профиля пользователя", uk: "Видалення кореня диска або всього профілю користувача" },
	del_sys_files: { en: "Deleting system files", ru: "Удаление системных файлов", uk: "Видалення системних файлів" },
	del_registry: { en: "Deleting registry keys", ru: "Удаление веток реестра", uk: "Видалення гілок реєстру" },
	format_disk_ps: { en: "Disk format/clear (PowerShell)", ru: "Форматирование/очистка диска (PowerShell)", uk: "Форматування/очищення диска (PowerShell)" },
	reg_delete_hklm: { en: "Deleting HKLM registry keys", ru: "Удаление веток реестра HKLM", uk: "Видалення гілок реєстру HKLM" },
	shutdown: { en: "System shutdown/restart", ru: "Выключение/перезагрузка СИСТЕМЫ", uk: "Вимкнення/перезавантаження СИСТЕМИ" },
	forkbomb: { en: "Fork bomb", ru: "Форк-бомба", uk: "Форк-бомба" },
	net_exec: { en: "Downloading and running code from the network", ru: "Загрузка и исполнение кода из сети", uk: "Завантаження та виконання коду з мережі" },
	iex: { en: "Dynamic string execution (iex)", ru: "Динамическое исполнение строки (iex)", uk: "Динамічне виконання рядка (iex)" },
	exec_policy: { en: "Disabling execution protection", ru: "Отключение защиты исполнения", uk: "Вимкнення захисту виконання" },
	chmod777: { en: "Opening 777 permissions on the filesystem", ru: "Открытие прав 777 на ФС", uk: "Відкриття прав 777 на ФС" },
	write_dev: { en: "Direct write to a device", ru: "Прямая запись на устройство", uk: "Прямий запис на пристрій" },
	netsh_disable: { en: "Disabling/resetting the network", ru: "Отключение/сброс сети", uk: "Вимкнення/скидання мережі" },
	boot_shadow: { en: "Attack on boot/shadow copies", ru: "Атака на загрузку/теневые копии", uk: "Атака на завантаження/тіньові копії" },
	net_user: { en: "Modifying user accounts", ru: "Изменение учётных записей", uk: "Зміна облікових записів" },
	elevation: { en: "Requires elevation", ru: "Требует повышения прав", uk: "Потребує підвищення прав" },
	sysconfig: { en: "Changes system settings (admin rights required)", ru: "Меняет системные настройки (нужны права администратора)", uk: "Змінює системні налаштування (потрібні права адміністратора)" },
	network: { en: "Uses the network", ru: "Использует сеть", uk: "Використовує мережу" },
	writes: { en: "Modifies files", ru: "Изменяет файлы", uk: "Змінює файли" },
	empty: { en: "Empty script", ru: "Пустой скрипт", uk: "Порожній скрипт" },
	toolong: { en: "Script too long (>8000 chars)", ru: "Слишком длинный скрипт (>8000 символов)", uk: "Занадто довгий скрипт (>8000 символів)" },
}
function rsn(code, lang) { const m = REASONS[code]; return (m && (m[lang] || m.en)) || code }

/** Fast static gate. Returns a verdict object; never throws. */
export function validateScript(script, { shell, lang = "en" } = {}) {
	const reasons = []
	if (!script || !script.trim()) return { safe: false, risk: "invalid", reasons: [rsn("empty", lang)], shell }
	if (script.length > 8000) reasons.push(rsn("toolong", lang))

	let risk = "low"
	for (const d of DESTRUCTIVE) if (d.re.test(script)) { reasons.push("⛔ " + rsn(d.code, lang)); risk = "destructive" }

	const needsElevation = ELEVATION.some((re) => re.test(script))
	const touchesNetwork = NETWORK.some((re) => re.test(script))
	const writes = WRITES.some((re) => re.test(script))
	const systemConfig = SYSTEM_CONFIG.some((re) => re.test(script))

	if (risk !== "destructive") {
		if (needsElevation || systemConfig) { risk = "elevated"; reasons.push("⚠️ " + rsn(needsElevation ? "elevation" : "sysconfig", lang)) }
		else if (touchesNetwork) { risk = "medium"; reasons.push("ℹ️ " + rsn("network", lang)) }
		else if (writes) { risk = "medium"; reasons.push("ℹ️ " + rsn("writes", lang)) }
	}

	const safe = risk !== "destructive" && risk !== "invalid"
	return { safe, risk, reasons, needsElevation, touchesNetwork, writes, systemConfig, shell }
}

export const RISK_ORDER = { low: 0, medium: 1, elevated: 2, destructive: 3, invalid: 9 }
