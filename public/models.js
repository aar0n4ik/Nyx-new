const $ = (s) => document.querySelector(s)
const fmtGB = (b) => (b ? (b / 1024 ** 3).toFixed(1) + " ГБ" : "")
const fmtSpeed = (bps) => (bps > 0 ? (bps / 1024 ** 2).toFixed(1) + " МБ/с" : "")
const fmtEta = (s) => (s == null ? "" : s < 60 ? `≈ ${Math.max(1, Math.round(s))} с` : s < 3600 ? `≈ ${Math.round(s / 60)} мин` : `≈ ${(s / 3600).toFixed(1)} ч`)

let activeId = null
let poll = null

async function load() {
	const data = await fetch("/api/model/installed").then((x) => x.json())
	activeId = data.activeTier || null
	const list = $("#list")
	list.innerHTML = ""
	for (const m of data.installed) {
		const isActive = m.id === activeId
		const el = document.createElement("div")
		el.className = "card" + (isActive ? " active" : "")
		const actions = m.installed
			? (isActive
					? `<div class="state">✓ Активна</div><button class="btn btn-soft danger" data-remove="${m.id}">Удалить</button>`
					: `<button class="btn btn-ok" data-activate="${m.id}">Сделать активной</button><button class="btn btn-soft danger" data-remove="${m.id}">Удалить</button>`)
			: `<button class="btn btn-primary" data-download="${m.id}">Скачать · ${m.badges?.[0] || fmtGB(m.bytes)}</button>`
		el.innerHTML = `
			<div class="emoji">${m.emoji || "🧠"}</div>
			<div class="body">
				<div class="title">${m.display}
					${isActive ? '<span class="tag active">Активна</span>' : ""}
					${m.installed && !isActive ? '<span class="badge">Скачана</span>' : ""}
				</div>
				<div class="subtitle">${m.subtitle || ""}</div>
				<div class="badges">${(m.badges || []).map((b) => `<span class="badge">${b}</span>`).join("")}</div>
			</div>
			<div class="actions">${actions}</div>`
		list.appendChild(el)
	}
	list.querySelectorAll("[data-download]").forEach((b) => (b.onclick = () => download(b.dataset.download)))
	list.querySelectorAll("[data-activate]").forEach((b) => (b.onclick = () => activate(b.dataset.activate)))
	list.querySelectorAll("[data-remove]").forEach((b) => (b.onclick = () => remove(b.dataset.remove)))
}

async function activate(id) {
	const r = await fetch("/api/model/activate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tier: id }) }).then((x) => x.json())
	if (!r.ok) alert(r.error || "Не удалось активировать")
	load()
}
async function remove(id) {
	if (!confirm("Удалить модель с диска?")) return
	await fetch("/api/model/remove", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tier: id }) })
	load()
}

async function download(id) {
	$("#dl").classList.remove("hidden")
	$("#dl-name").textContent = "Загрузка: " + id
	togglePause(false)
	await fetch("/api/model/download", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tier: id }) })
	startPolling()
}

function startPolling() {
	clearInterval(poll)
	poll = setInterval(async () => {
		let s
		try { s = await fetch("/api/model/download/status").then((x) => x.json()) } catch { return }
		const pct = Math.round((s.pct || 0) * 100)
		$("#bar").style.width = pct + "%"
		$("#dl-pct").textContent = pct + "%"
		$("#dl-size").textContent = s.total ? `${fmtGB(s.done)} / ${fmtGB(s.total)}` : ""
		$("#dl-speed").textContent = fmtSpeed(s.speed)
		$("#dl-eta").textContent = fmtEta(s.etaSec)
		if (s.phase === "done" && !s.active) {
			clearInterval(poll)
			$("#dl").classList.add("hidden")
			load()
		} else if (s.phase === "error" && !s.active) {
			clearInterval(poll)
			togglePause(true)
			$("#dl-name").textContent = "Ошибка: " + (s.error || "не удалось") + " — нажмите «Продолжить»"
		}
	}, 600)
}

function togglePause(paused) {
	$("#btn-pause").classList.toggle("hidden", paused)
	$("#btn-resume").classList.toggle("hidden", !paused)
}
$("#btn-pause").onclick = async () => { await fetch("/api/model/download/pause", { method: "POST" }); togglePause(true) }
$("#btn-resume").onclick = async () => { await fetch("/api/model/download/resume", { method: "POST" }); togglePause(false); startPolling() }
$("#btn-cancel").onclick = async () => { await fetch("/api/model/download/cancel", { method: "POST" }); clearInterval(poll); $("#dl").classList.add("hidden"); load() }

load()
