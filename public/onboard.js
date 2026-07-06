const $ = (s) => document.querySelector(s)
const steps = {
	detect: $("#step-detect"),
	hero: $("#step-hero"),
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

// Каждая модель Nyx исполняется через QVAC SDK (форк llama.cpp). QVAC-native
// модели Tether (MedPsy) помечаются отдельным бейджем.
function isQvacNative(t) {
	return !!(t && (t.qvacNative || t.engine === "qvac"))
}
function engineBadge(t) {
	return isQvacNative(t)
		? '<span class="qvac-badge qvac-native">⚡ QVAC-native</span>'
		: '<span class="qvac-badge">⚡ QVAC engine</span>'
}

let catalog = null
let recoTier = null
let chosen = null

// Принцип: клиенту не надо думать. Авто-детект -> одна рекомендация -> одна кнопка.
async function init() {
	show("detect")
	try {
		const r = await fetch("/api/onboard/recommend").then((x) => x.json())
		catalog = r.catalog
		const hw = r.hardware
		const reco = r.recommend
		recoTier = catalog.tiers.find((t) => t.id === reco.tier) || catalog.tiers[0]
		$("#detect-text").textContent = "Готово"
		$("#hero-hw").textContent = `${hw.totalRamGB} ГБ ОЗУ${hw.vramGB ? ` · GPU ${hw.vramGB} ГБ` : ""}`
		setTimeout(() => renderHero(reco), 650)
	} catch (e) {
		try {
			catalog = await fetch("/api/onboard/catalog").then((x) => x.json())
			recoTier = catalog.tiers.find((t) => t.id === catalog.default) || catalog.tiers[0]
			setTimeout(() => renderHero({ reason: "" }), 650)
		} catch {
			$("#detect-text").textContent = "Не удалось загрузить каталог моделей. Проверьте интернет и перезапустите."
		}
	}
}

function renderHero(reco) {
	show("hero")
	const t = recoTier
	$("#hero-reason").textContent =
		reco.reason || "Мы подобрали оптимальную модель — нажмите «Начать», остальное сделаем сами."
	$("#hero-card").innerHTML = `
		<div class="emoji">${t.emoji || "🧠"}</div>
		<div class="body">
			<div class="title">${t.display}<span class="tag-reco">Подобрано для вас</span>${engineBadge(t)}</div>
			<div class="subtitle">${t.subtitle || ""}</div>
			<div class="badges">${(t.badges || []).map((b) => `<span class="badge">${b}</span>`).join("")}</div>
		</div>`
}

$("#hero-start").onclick = () => startDownload(recoTier)
$("#show-more").onclick = () => renderChoose()
$("#back-hero").onclick = () => show("hero")

function renderChoose() {
	show("choose")
	const cards = $("#cards")
	cards.innerHTML = ""
	for (const t of catalog.tiers) {
		const isReco = t.id === recoTier.id
		const el = document.createElement("button")
		el.className = "card" + (isReco ? " reco" : "") + (isQvacNative(t) ? " qvac" : "")
		el.style.setProperty("--accent", t.accent || "#d97706")
		el.innerHTML = `
			<div class="emoji">${t.emoji || "🧠"}</div>
			<div class="body">
				<div class="title">${t.display}${isReco ? '<span class="tag-reco">Рекомендуем</span>' : ""}${engineBadge(t)}</div>
				<div class="subtitle">${t.subtitle || ""}</div>
				<div class="badges">${(t.badges || []).map((b) => `<span class="badge">${b}</span>`).join("")}</div>
			</div>`
		el.onclick = () => startDownload(t)
		cards.appendChild(el)
	}
}

let poll = null
async function ensureEngineFirst() {
	let s = null
	try {
		s = await fetch("/api/engine/status").then((x) => x.json())
	} catch {}
	if (s && s.installed) return true
	$("#dl-title").textContent = "Устанавливаем движок Nyx"
	$("#dl-model").textContent = "QVAC-движок (llama.cpp) · один раз при первом запуске"
	$("#dl-engine").textContent = "⚡ Локальный инференс-движок QVAC — скачивается один раз"
	try {
		await fetch("/api/engine/install", { method: "POST" })
	} catch {}
	return await new Promise((resolve) => {
		const t = setInterval(async () => {
			let st
			try {
				st = await fetch("/api/engine/status").then((x) => x.json())
			} catch {
				return
			}
			const pct = Math.round((st.pct || 0) * 100)
			$("#bar").style.width = pct + "%"
			$("#dl-pct").textContent = pct + "%"
			$("#dl-size").textContent = st.total ? `${fmtGB(st.done)} / ${fmtGB(st.total)}` : ""
			$("#dl-speed").textContent = fmtSpeed(st.speed)
			$("#dl-eta").textContent = fmtEta(st.etaSec)
			$("#dl-phase").textContent =
				st.phase === "extracting" ? "Распаковка движка…" : st.installed ? "Движок готов" : "Загрузка движка…"
			if (st.installed) {
				clearInterval(t)
				resolve(true)
			} else if (st.phase === "error" && !st.active) {
				clearInterval(t)
				$("#dl-phase").textContent =
					"Не удалось установить движок: " + (st.error || "ошибка") + ". Запуск в офлайн-режиме."
				setTimeout(() => resolve(false), 1800)
			}
		}, 600)
	})
}
async function startDownload(tier) {
	chosen = tier
	show("download")
	await ensureEngineFirst()
	$("#dl-title").textContent = "Загружаем модель"
	$("#dl-model").textContent = `${tier.display} · ${tier.badges?.[0] || fmtGB(tier.bytes)}`
	$("#dl-engine").textContent = isQvacNative(tier)
		? "⚡ QVAC-native · модель Tether, инференс через QVAC SDK"
		: "⚡ Исполняется через QVAC SDK (форк llama.cpp) — на устройстве"
	try {
		await fetch("/api/model/download", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ model: tier.model, tier: tier.id }),
		})
	} catch {}
	togglePause(false)
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
	show("hero")
}
$("#btn-launch").onclick = () => {
	location.href = "/app"
}

init()
