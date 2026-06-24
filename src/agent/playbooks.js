// Expert knowledge base: proven, safe, battle-tested scripts for the most common
// PC problems. This GROUNDS the model so it never improvises a wrong/dangerous
// command. Each playbook has a read-only `diagnose` step and an optional `fix`
// step (gated, with smart warnings). The model may adapt these, but for strong
// keyword matches we trust the proven script verbatim.

export const PLAYBOOKS = [
	{
		id: "game-black-screen",
		title: "Чёрный экран в игре",
		os: "win32", shell: "powershell",
		keywords: ["чёрный экран", "черный экран", "black screen", "чорний екран", "игра не запуск", "game crash", "вылетает игра", "игра вылет", "shader cache", "clear shader cache", "clean shader cache", "кэш шейдер", "очисти кэш шейдер", "сбрось кэш шейдер"],
		diagnose: "Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion,DriverDate | Format-List; Get-WinEvent -LogName Application -MaxEvents 25 -ErrorAction SilentlyContinue | Where-Object {$_.LevelDisplayName -eq 'Error'} | Select-Object TimeCreated,ProviderName,Id | Format-Table -Auto",
		fix: "Remove-Item \"$env:LOCALAPPDATA\\D3DSCache\\*\" -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item \"$env:LOCALAPPDATA\\NVIDIA\\DXCache\\*\" -Recurse -Force -ErrorAction SilentlyContinue; Write-Output 'DirectX/GPU shader cache cleared'",
		risk: "medium",
		warnings: ["Закройте игру перед очисткой кэша шейдеров", "Первый запуск после очистки будет дольше (кэш пересоберётся)", "Если не помогло — обновите/откатите драйвер GPU и включите оконный (borderless) режим"],
		note: "Чёрный экран чаще всего — битый кэш шейдеров, конфликт overlay или драйвер GPU.",
	},
	{
		id: "windows-update",
		title: "Обновление Windows",
		os: "win32", shell: "powershell",
		keywords: ["обновить винд", "обнови винд", "обнови windows", "обнови виндоус", "обновить windows", "обновление windows", "windows update", "update windows", "обнови систем", "обновить систем", "оновити windows", "оновити систему", "установи обновлен", "проверь обновлен", "апдейт", "check for update", "check updates", "look for updates", "install updates", "scan for updates", "update check"],
		diagnose: "$s=New-Object -ComObject Microsoft.Update.Session; $r=($s.CreateUpdateSearcher()).Search('IsInstalled=0'); 'Pending updates: {0}' -f $r.Updates.Count; $r.Updates | ForEach-Object { ' - ' + $_.Title }",
		fix: "$ErrorActionPreference='Stop'; $s=New-Object -ComObject Microsoft.Update.Session; $res=$s.CreateUpdateSearcher().Search('IsInstalled=0 and IsHidden=0'); if($res.Updates.Count -eq 0){'System is already up to date - no updates found'; return}; $dl=New-Object -ComObject Microsoft.Update.UpdateColl; foreach($u in $res.Updates){ if(-not $u.EulaAccepted){$u.AcceptEula()}; [void]$dl.Add($u) }; $d=$s.CreateUpdateDownloader(); $d.Updates=$dl; [void]$d.Download(); $ins=New-Object -ComObject Microsoft.Update.UpdateColl; foreach($u in $res.Updates){ if($u.IsDownloaded){[void]$ins.Add($u)} }; $it=$s.CreateUpdateInstaller(); $it.Updates=$ins; $r=$it.Install(); 'Installed updates: {0}; pendingReboot={1}' -f $ins.Count, $r.RebootRequired",
		risk: "elevated",
		warnings: ["Я сам найду, скачаю и установлю обновления в фоне через Windows Update — окна на экране не появятся", "Не выключай ПК до конца установки", "Если понадобится перезагрузка, я честно сообщу об этом в конце"],
		note: "Полностью автономно: поиск, загрузка и установка обновлений идут через COM API Windows Update без открытия окон. Нужны права администратора — Nyx запросит их сам через UAC.",
	},
	{
		id: "set-time",
		title: "Дата и время системы",
		os: "win32", shell: "powershell",
		keywords: ["время", "часы", "дата", "set time", "change time", "clock", "поменяй время", "смени время", "сменить время", "измени время", "перевести часы", "timezone", "часовой пояс", "time zone", "змінити час", "set the time", "change the time", "set time to", "set clock", "system time", "adjust the time", "fix the time"],
		diagnose: "Get-Date -Format 'yyyy-MM-dd HH:mm:ss K'; 'Time zone: ' + (Get-TimeZone).Id; 'Time auto-sync (w32time): ' + (Get-Service w32time).Status",
		fix: "Set-Date -Date (Get-Date '14:30')",
		risk: "elevated",
		warnings: ["Нужны права администратора — я запрошу их сам через окно Windows (UAC); просто подтверди его", "Если включена авто-синхронизация, Windows может вернуть время обратно — отключи «Устанавливать время автоматически» в Параметрах"],
		note: "Сначала покажи текущие дату/время и пояс. Для смены подставь точное время из запроса в Set-Date; для смены пояса используй tzutil /s \"<TimeZoneId>\".",
	},
	{
		id: "change-language",
		title: "Смена языка интерфейса",
		os: "win32", shell: "powershell",
		keywords: ["сменить язык", "смена языка", "change language", "язык систем", "змінити мову", "display language", "поменять язык"],
		diagnose: "Get-WinUserLanguageList | Select-Object LanguageTag; 'UI override: ' + (Get-WinUILanguageOverride)",
		fix: "Set-WinUILanguageOverride -Language en-US; $l=New-WinUserLanguageList -Language en-US; $l.Add('ru-RU'); Set-WinUserLanguageList $l -Force; Write-Output 'Language set to en-US; sign out and back in to apply'",
		risk: "medium",
		warnings: ["Смена языка интерфейса применяется после повторного входа", "Языковой пакет должен быть уже установлен", "Укажите целевой язык явно (напр. en-US, ru-RU, uk-UA)"],
		note: "Если пользователь назвал конкретный язык — подставь его BCP-47 тег вместо en-US.",
	},
	{
		id: "network-no-internet",
		title: "Нет интернета / DNS",
		os: "win32", shell: "powershell",
		keywords: ["нет интернет", "не работает сет", "no internet", "dns", "нет сети", "интернет пропал", "wifi не работ"],
		diagnose: "Get-NetAdapter | Select-Object Name,Status,LinkSpeed | Format-Table -Auto; Test-Connection 1.1.1.1 -Count 2 -ErrorAction SilentlyContinue | Select-Object Address,ResponseTime",
		fix: "ipconfig /flushdns | Out-Null; Write-Output 'DNS cache cleared'",
		risk: "medium",
		warnings: ["Сброс сети может на пару секунд разорвать соединение"],
		note: "Сначала диагностика, потом flushdns; жёсткий netsh reset — только вручную с админом.",
	},
	{
		id: "high-cpu-lag",
		title: "Лаги / высокая нагрузка CPU",
		os: "all", shell: "powershell",
		keywords: ["лаг", "тормозит", "виснет", "high cpu", "нагрузка процессор", "фризы", "slow", "подвисает"],
		diagnose: "Get-Process | Sort-Object CPU -Descending | Select-Object -First 10 Name,Id,CPU,@{n='RAM_MB';e={[math]::Round($_.WorkingSet/1MB)}} | Format-Table -Auto",
		linux: "ps -eo pid,comm,%cpu,%mem --sort=-%cpu | head -n 11",
		risk: "low",
		warnings: ["Не снимайте системные процессы вслепую"],
		note: "Сначала покажи топ пожирателей, потом предложи закрыть конкретный.",
	},
	{
		id: "game-crash-logs",
		title: "Поиск логов вылета игры",
		os: "win32", shell: "powershell",
		keywords: ["лог вылет", "crash log", "логи игры", "dump", "журнал ошибок", "вылеты", "crash"],
		diagnose: "Get-ChildItem \"$env:LOCALAPPDATA\" -Recurse -Include *.log,*.dmp -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 12 FullName,LastWriteTime | Format-Table -Auto; Get-WinEvent -LogName Application -MaxEvents 40 -ErrorAction SilentlyContinue | Where-Object {$_.Id -in 1000,1001} | Select-Object TimeCreated,ProviderName | Format-Table -Auto",
		risk: "low",
		warnings: [],
		note: "Чисто читающий поиск; ничего не ����аляет.",
	},
	{
		id: "gpu-driver",
		title: "Драйвер видеокарты",
		os: "win32", shell: "powershell",
		keywords: ["драйвер", "driver", "видеокарт", "gpu", "nvidia", "amd radeon", "графика"],
		diagnose: "Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion,DriverDate,Status,AdapterRAM | Format-List",
		risk: "low",
		warnings: ["Скачивайте драйверы только с сайта NVIDIA/AMD/Intel"],
		note: "Покажи версию/дату драйвера; если старый — порекомендуй обновить вручную.",
	},
	{
		id: "disk-space",
		title: "Место на диске",
		os: "all", shell: "powershell",
		keywords: ["мало мест", "диск заполн", "disk space", "нет места", "очистка диск", "память на диск"],
		diagnose: "Get-PSDrive -PSProvider FileSystem | Select-Object Name,@{n='UsedGB';e={[math]::Round($_.Used/1GB,1)}},@{n='FreeGB';e={[math]::Round($_.Free/1GB,1)}} | Format-Table -Auto",
		linux: "df -h --output=source,size,used,avail,pcent,target | grep -v tmpfs",
		risk: "low",
		warnings: ["Не удаляйте файлы из системных папок; используйте штатную Очистку диска"],
		note: "Только показ занятости; безопасная очистка — через cleanmgr.",
	},
	{
		id: "overheating",
		title: "Перегрев",
		os: "win32", shell: "powershell",
		keywords: ["перегрев", "греется", "температур", "overheat", "temperature", "hot", "кулер шум"],
		diagnose: "$t=Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue; if($t){$t | ForEach-Object { 'Zone temp: {0} C' -f [math]::Round(($_.CurrentTemperature/10)-273.15,1) }} else { 'WMI thermal sensor unavailable - use HWiNFO' }",
		risk: "low",
		warnings: ["При >90°C под нагрузкой — проверьте охлаждение и пыль перед торговлей/игрой"],
		note: "Встроенный WMI-датчик часто пуст; честно скажи об этом.",
	},
]

const norm = (s) => (s || "").toLowerCase()
const wordsOf = (s) => norm(s).split(/[^0-9a-zа-яёіїєґ]+/i).filter(Boolean)

/** Find the best-matching playbook for a problem, scored by keyword hits. */
export function matchPlaybook(problem, os = process.platform) {
	const p = norm(problem)
	const toks = new Set(wordsOf(problem))
	let best = null, score = 0
	for (const pb of PLAYBOOKS) {
		if (pb.os !== "all" && pb.os !== os) continue
		let s = 0
		for (const k of pb.keywords) {
			const nk = norm(k)
			if (p.includes(nk)) { s += nk.includes(" ") ? 2 : 1; continue }
			// Loose match: every word of a multi-word keyword present (non-adjacent),
			// so "change time" still grounds "change my pc time" -> right playbook.
			const kw = wordsOf(k)
			if (kw.length > 1 && kw.every((w) => toks.has(w))) s += 1
		}
		if (s > score) { score = s; best = pb }
	}
	if (!best) return null
	// pick OS-appropriate script body
	const diagnose = os !== "win32" && best.linux ? best.linux : best.diagnose
	const shell = os === "win32" ? "powershell" : "bash"
	return { ...best, score, diagnose, shell: best.os === "all" ? shell : best.shell, strong: score >= 2 }
}

/** Compact grounding block injected into the model prompt. */
export function groundingFor(problem, os = process.platform) {
	const pb = matchPlaybook(problem, os)
	if (!pb) return null
	return {
		playbook: pb,
		text: [
			`ПРОВЕРЕННЫЙ ПАТТЕРН «${pb.title}» (доверяй, но адаптируй под запрос):`,
			`Диагностика (${pb.shell}): ${pb.diagnose}`,
			pb.fix ? `Безопасное исправление: ${pb.fix}` : null,
			pb.warnings?.length ? `Предупреждения: ${pb.warnings.join(" | ")}` : null,
			pb.note ? `Заметка: ${pb.note}` : null,
		].filter(Boolean).join("\n"),
	}
}
