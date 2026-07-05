const $ = (s) => document.querySelector(s)
const steps = {
	detect: $("#step-detect"),
	choose: $("#step-choose"),
	download: $("#step-download"),
	done: $("#step-done"),
}
function show(name) {
	for (const k in steps) steps[k].classList.toggle("active", k === name)
}
const fmtGB = (b) => (b ? (b / 1024 ** 3).toFixed(1) + " ГБ" : "")
const fmtSpeed = (bps) => (bps > 0 ? (bps / 1024 ** 2).toFixed(1) + " МБ/с" : "")
function fmtEta(s) {
	if (s == null) return ""
	if (s < 60) return `≈ ${Math.max(1, Math.round(s))} с`
	if (s < 3600) return `≈ ${Math.round(s / 60)} мин`
	return `≈ ${(s / 3600).toFixed(1)} ч`
}

let catalog = null
let chosen = null
let showAll = false

async function init() {
	show("detect")
	try {
		const r = await fetch("/api/onboard/recommend").then((x) => x.json())
		catalog = r.catalog
		const hw = r.hardware
		const reco = r.recommend
		$("#detect-text").textContent = `${hw.totalRamGB} ГБ ОЗУ · ${hw.cpuCores} ядер${hw.vramGB ? ` · видеокарта ${hw.vramGB} ГБ` : " · без дискретной видеокарты"}`
		setTimeout(() => renderChoose(reco), 700)
	} catch (e) {
		$("#detect-text").textContent = "Не удалось определить железо. Показываем все варианты."
		try {
			catalog = await fetch("/api/onboard/catalog").then((x) => x.json())
			setTimeout(() => renderChoose({ tier: catalog.default }), 700)
		} catch {}
	}
}

function renderChoose(reco) {
	show("choose")
	const recoTier = catalog.tiers.find((t) => t.id === reco.tier) || catalog.tiers[0]
	$("#reco-line").textContent = reco.reason || "Мы подобрали оптимальный вариант для вашего ПК."
	const cards = $("#cards")
	cards.innerHTML = ""
	for (const t of catalog.tiers) {
		const isReco = t.id === recoTier.id
		const el = document.createElement("button")
		el.className = "card" + (isReco ? " reco" : "") + (isReco || showAll ? "" : " hiddenTier")
		el.style.setProperty("--accent", t.accent || "#d97706")
		el.innerHTML = `
			<div class="emoji">${t.emoji || "🧠"}</div>
			<div class="body">
				<div class="title">${t.display}${isReco ? '<span class="tag-reco">Рекомендуем</span>' : ""}</div>
				<div class="subtitle">${t.subtitle || ""}</div>
				<div class="badges">${(t.badges || []).map((b) => `<span class="badge">${b}</span>`).join("")}</div>
			</div>`
		el.onclick = () => startDownload(t)
		cards.appendChild(el)
	}
	$("#toggle-all").textContent = showAll ? "Скрыть остальные" : "Показать все варианты"
}
$("#toggle-all").onclick = () => {
	showAll = !showAll
	document.querySelectorAll(".card").forEach((c, i) => {
		if (!c.classList.contains("reco")) c.classList.toggle("hiddenTier", !showAll)
	})
	$("#toggle-all").textContent = showAll ? "Скрыть остальные" : "Показать все варианты"
}

let poll = null
async function startDownload(tier) {
	chosen = tier
	show("download")
	$("#dl-model").textContent = `${tier.display} · ${tier.badges?.[0] || fmtGB(tier.bytes)}`
	await fetch("/api/model/download", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ model: tier.model, tier: tier.id }),
	})
	startPolling()
}

function startPolling() {
	clearInterval(poll)
	poll = setInterval(async () => {
		let s
		try {
			s = await fetch("/api/model/download/status").then((x) => x.json())
		} catch {
			return
		}
		const pct = Math.round((s.pct || 0) * 100)
		$("#bar").style.width = pct + "%"
		$("#dl-pct").textContent = pct + "%"
		$("#dl-size").textContent = s.total ? `${fmtGB(s.done)} / ${fmtGB(s.total)}` : ""
		$("#dl-speed").textContent = fmtSpeed(s.speed)
		$("#dl-eta").textContent = fmtEta(s.etaSec)
		$("#dl-phase").textContent = phaseText(s)
		if (s.phase === "done" && !s.active) {
			clearInterval(poll)
			show("done")
		} else if (s.phase === "error" && !s.active) {
			clearInterval(poll)
			$("#dl-phase").textContent = "Ошибка: " + (s.error || "не удалось загрузить") + ". Нажмите «Продолжить»."
			togglePause(true)
		}
	}, 600)
}

function phaseText(s) {
	switch (s.phase) {
		case "downloading": return "Загрузка…"
		case "verify": return "Проверка целостности (SHA-256)…"
		case "linking": return "Завершаем…"
		case "retry": return "Соединение прервалось — повторная попытка…"
		case "paused": return "Приостановлено"
		case "canceled": return "Отменено"
		case "done": return "Готово"
		default: return ""
	}
}

function togglePause(paused) {
	$("#btn-pause").classList.toggle("hidden", paused)
	$("#btn-resume").classList.toggle("hidden", !paused)
}
$("#btn-pause").onclick = async () => {
	await fetch("/api/model/download/pause", { method: "POST" })
	togglePause(true)
}
$("#btn-resume").onclick = async () => {
	await fetch("/api/model/download/resume", { method: "POST" })
	togglePause(false)
	startPolling()
}
$("#btn-cancel").onclick = async () => {
	await fetch("/api/model/download/cancel", { method: "POST" })
	clearInterval(poll)
	renderChoose({ tier: chosen?.id || catalog.default })
}
$("#btn-launch").onclick = () => {
	location.href = "/app"
}

init()
