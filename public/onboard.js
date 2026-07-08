// -------- i18n --------
const SUPPORTED_LANGS = ["en", "ru", "uk", "es", "de", "fr"]
function detectLang() {
	try {
		const stored = localStorage.getItem("nyx.lang")
		if (stored && SUPPORTED_LANGS.includes(stored)) return stored
	} catch {}
	const nav = (navigator.language || navigator.userLanguage || "en").toLowerCase().slice(0, 2)
	return SUPPORTED_LANGS.includes(nav) ? nav : "en"
}
const LANG = detectLang()

const OB_I18N = {
	en: {
		title: "Nyx — Setup",
		welcome: "Welcome",
		welcome_sub: "Your personal AI — completely on your computer. No cloud, no accounts, no data sent anywhere.",
		detect_scanning: "Selecting the best model for your computer…",
		detect_done: "Done",
		detect_fail: "Could not load model catalog. Check your internet and restart.",
		ready_h: "Ready to launch",
		ready_default_reason: "We selected the optimal model — press Start, we'll handle the rest.",
		picked_for_you: "Picked for you",
		recommended: "Recommended",
		btn_start: "Start",
		btn_show_more: "Choose a different model",
		btn_back: "← Back",
		all_models_h: "All models",
		all_models_sub: "You can switch models anytime later in app settings.",
		dl_title_engine: "Installing Nyx engine",
		dl_engine_desc: "QVAC engine (llama.cpp) · one-time setup",
		dl_engine_label: "Local inference engine — downloads once",
		dl_title_model: "Downloading model",
		dl_done_label: "Engine ready",
		dl_loading_label: "Downloading engine…",
		dl_extract_label: "Extracting engine…",
		dl_engine_fail: "Failed to install engine: ",
		dl_fallback: ". Starting in offline mode.",
		dl_phase: { downloading: "Downloading…", verify: "Verifying integrity (SHA-256)…", linking: "Finalizing…", retry: "Connection lost — retrying…", paused: "Paused", canceled: "Canceled", done: "Done" },
		btn_pause: "Pause",
		btn_resume: "Resume",
		btn_cancel: "Cancel",
		dl_hint: "You can minimize the window — download continues in the background. Progress is shown in the taskbar. If the connection drops, download resumes from the same point.",
		done_h: "All set",
		done_sub: "Model installed and running locally. You can switch models anytime in settings.",
		btn_launch: "Open Nyx",
		hw_ram: "RAM",
		hw_gpu: "GPU",
	},
	ru: {
		title: "Nyx — Настройка",
		welcome: "Добро пожаловать",
		welcome_sub: "Ваш личный ИИ — полностью на вашем компьютере. Без облака, без аккаунтов, без отправки данных.",
		detect_scanning: "Подбираем лучшую модель под ваш компьютер…",
		detect_done: "Готово",
		detect_fail: "Не удалось загрузить каталог моделей. Проверьте интернет и перезапустите.",
		ready_h: "Готово к запуску",
		ready_default_reason: "Мы подобрали оптимальную модель — нажмите «Начать», остальное сделаем сами.",
		picked_for_you: "Подобрано для вас",
		recommended: "Рекомендуем",
		btn_start: "Начать",
		btn_show_more: "Выбрать другую модель",
		btn_back: "← Назад",
		all_models_h: "Все модели",
		all_models_sub: "Сменить можно в любой момент позже — в настройках приложения.",
		dl_title_engine: "Устанавливаем движок Nyx",
		dl_engine_desc: "QVAC-движок (llama.cpp) · один раз при первом запуске",
		dl_engine_label: "Локальный инференс-движок — скачивается один раз",
		dl_title_model: "Загружаем модель",
		dl_done_label: "Движок готов",
		dl_loading_label: "Загрузка движка…",
		dl_extract_label: "Распаковка движка…",
		dl_engine_fail: "Не удалось установить движок: ",
		dl_fallback: ". Запуск в офлайн-режиме.",
		dl_phase: { downloading: "Загрузка…", verify: "Проверка целостности (SHA-256)…", linking: "Завершаем…", retry: "Соединение прервалось — повторная попытка…", paused: "Приостановлено", canceled: "Отменено", done: "Готово" },
		btn_pause: "Пауза",
		btn_resume: "Продолжить",
		btn_cancel: "Отмена",
		dl_hint: "Можно свернуть окно — загрузка продолжится в фоне. Прогресс виден в панели задач. При обрыве сети загрузка возобновится с того же места.",
		done_h: "Всё готово",
		done_sub: "Модель установлена и работает локально. Модель можно сменить в любой момент в настройках.",
		btn_launch: "Открыть Nyx",
		hw_ram: "ОЗУ",
		hw_gpu: "GPU",
	},
	uk: {
		title: "Nyx — Налаштування",
		welcome: "Ласкаво просимо",
		welcome_sub: "Ваш особистий ШІ — повністю на вашому комп'ютері. Без хмари, без аккаунтів, без передачі даних.",
		detect_scanning: "Підбираємо найкращу модель для вашого комп'ютера…",
		detect_done: "Готово",
		detect_fail: "Не вдалося завантажити каталог моделей. Перевірте інтернет і перезапустіть.",
		ready_h: "Готово до запуску",
		ready_default_reason: "Ми підібрали оптимальну модель — натисніть «Почати», решту зробимо самі.",
		picked_for_you: "Підібрано для вас",
		recommended: "Рекомендуємо",
		btn_start: "Почати",
		btn_show_more: "Обрати іншу модель",
		btn_back: "← Назад",
		all_models_h: "Всі моделі",
		all_models_sub: "Змінити можна будь-коли — у налаштуваннях програми.",
		dl_title_engine: "Встановлюємо движок Nyx",
		dl_engine_desc: "QVAC-движок (llama.cpp) · один раз при першому запуску",
		dl_engine_label: "Локальний inference-движок — завантажується один раз",
		dl_title_model: "Завантажуємо модель",
		dl_done_label: "Движок готовий",
		dl_loading_label: "Завантаження движка…",
		dl_extract_label: "Розпакування движка…",
		dl_engine_fail: "Не вдалося встановити движок: ",
		dl_fallback: ". Запуск в офлайн-режимі.",
		dl_phase: { downloading: "Завантаження…", verify: "Перевірка цілісності (SHA-256)…", linking: "Завершуємо…", retry: "З'єднання перервалось — повторна спроба…", paused: "Призупинено", canceled: "Скасовано", done: "Готово" },
		btn_pause: "Пауза",
		btn_resume: "Продовжити",
		btn_cancel: "Скасувати",
		dl_hint: "Можна згорнути вікно — завантаження продовжиться у фоні. Прогрес видно в панелі завдань.",
		done_h: "Все готово",
		done_sub: "Модель встановлена і працює локально. Модель можна змінити будь-коли у налаштуваннях.",
		btn_launch: "Відкрити Nyx",
		hw_ram: "ОЗП",
		hw_gpu: "GPU",
	},
	es: {
		title: "Nyx — Configuración",
		welcome: "Bienvenido",
		welcome_sub: "Tu IA personal — completamente en tu ordenador. Sin nube, sin cuentas, sin envío de datos.",
		detect_scanning: "Seleccionando el mejor modelo para tu ordenador…",
		detect_done: "Listo",
		detect_fail: "No se pudo cargar el catálogo de modelos. Comprueba tu conexión y reinicia.",
		ready_h: "Listo para iniciar",
		ready_default_reason: "Hemos seleccionado el modelo óptimo — pulsa Iniciar, nosotros hacemos el resto.",
		picked_for_you: "Seleccionado para ti",
		recommended: "Recomendado",
		btn_start: "Iniciar",
		btn_show_more: "Elegir otro modelo",
		btn_back: "← Atrás",
		all_models_h: "Todos los modelos",
		all_models_sub: "Puedes cambiar el modelo en cualquier momento desde los ajustes de la app.",
		dl_title_engine: "Instalando motor de Nyx",
		dl_engine_desc: "Motor QVAC (llama.cpp) · una sola vez",
		dl_engine_label: "Motor de inferencia local — se descarga una vez",
		dl_title_model: "Descargando modelo",
		dl_done_label: "Motor listo",
		dl_loading_label: "Descargando motor…",
		dl_extract_label: "Extrayendo motor…",
		dl_engine_fail: "Error al instalar el motor: ",
		dl_fallback: ". Iniciando en modo offline.",
		dl_phase: { downloading: "Descargando…", verify: "Verificando integridad (SHA-256)…", linking: "Finalizando…", retry: "Conexión perdida — reintentando…", paused: "Pausado", canceled: "Cancelado", done: "Listo" },
		btn_pause: "Pausar",
		btn_resume: "Reanudar",
		btn_cancel: "Cancelar",
		dl_hint: "Puedes minimizar la ventana — la descarga continúa en segundo plano. El progreso se muestra en la barra de tareas.",
		done_h: "Todo listo",
		done_sub: "Modelo instalado y ejecutándose localmente. Puedes cambiar el modelo en cualquier momento.",
		btn_launch: "Abrir Nyx",
		hw_ram: "RAM",
		hw_gpu: "GPU",
	},
	de: {
		title: "Nyx — Einrichtung",
		welcome: "Willkommen",
		welcome_sub: "Deine persönliche KI — vollständig auf deinem Computer. Keine Cloud, keine Konten, keine Datenübertragung.",
		detect_scanning: "Bestes Modell für deinen Computer wird ausgewählt…",
		detect_done: "Fertig",
		detect_fail: "Modellkatalog konnte nicht geladen werden. Prüfe deine Internetverbindung und starte neu.",
		ready_h: "Bereit zum Start",
		ready_default_reason: "Wir haben das optimale Modell ausgewählt — drücke Start, den Rest erledigen wir.",
		picked_for_you: "Für dich ausgewählt",
		recommended: "Empfohlen",
		btn_start: "Starten",
		btn_show_more: "Anderes Modell wählen",
		btn_back: "← Zurück",
		all_models_h: "Alle Modelle",
		all_models_sub: "Du kannst das Modell jederzeit in den App-Einstellungen wechseln.",
		dl_title_engine: "Nyx-Engine wird installiert",
		dl_engine_desc: "QVAC-Engine (llama.cpp) · einmalige Einrichtung",
		dl_engine_label: "Lokale Inferenz-Engine — wird einmal heruntergeladen",
		dl_title_model: "Modell wird geladen",
		dl_done_label: "Engine bereit",
		dl_loading_label: "Engine wird geladen…",
		dl_extract_label: "Engine wird entpackt…",
		dl_engine_fail: "Engine-Installation fehlgeschlagen: ",
		dl_fallback: ". Starte im Offline-Modus.",
		dl_phase: { downloading: "Wird geladen…", verify: "Integrität wird geprüft (SHA-256)…", linking: "Wird abgeschlossen…", retry: "Verbindung unterbrochen — neuer Versuch…", paused: "Angehalten", canceled: "Abgebrochen", done: "Fertig" },
		btn_pause: "Pause",
		btn_resume: "Fortsetzen",
		btn_cancel: "Abbrechen",
		dl_hint: "Du kannst das Fenster minimieren — der Download läuft im Hintergrund weiter. Der Fortschritt wird in der Taskleiste angezeigt.",
		done_h: "Alles bereit",
		done_sub: "Modell installiert und läuft lokal. Du kannst das Modell jederzeit in den Einstellungen wechseln.",
		btn_launch: "Nyx öffnen",
		hw_ram: "RAM",
		hw_gpu: "GPU",
	},
	fr: {
		title: "Nyx — Configuration",
		welcome: "Bienvenue",
		welcome_sub: "Votre IA personnelle — entièrement sur votre ordinateur. Sans cloud, sans comptes, sans envoi de données.",
		detect_scanning: "Sélection du meilleur modèle pour votre ordinateur…",
		detect_done: "Prêt",
		detect_fail: "Impossible de charger le catalogue de modèles. Vérifiez votre connexion et redémarrez.",
		ready_h: "Prêt à démarrer",
		ready_default_reason: "Nous avons sélectionné le modèle optimal — cliquez sur Démarrer, nous nous occupons du reste.",
		picked_for_you: "Sélectionné pour vous",
		recommended: "Recommandé",
		btn_start: "Démarrer",
		btn_show_more: "Choisir un autre modèle",
		btn_back: "← Retour",
		all_models_h: "Tous les modèles",
		all_models_sub: "Vous pouvez changer de modèle à tout moment dans les paramètres de l'application.",
		dl_title_engine: "Installation du moteur Nyx",
		dl_engine_desc: "Moteur QVAC (llama.cpp) · une seule fois",
		dl_engine_label: "Moteur d'inférence local — téléchargé une seule fois",
		dl_title_model: "Téléchargement du modèle",
		dl_done_label: "Moteur prêt",
		dl_loading_label: "Téléchargement du moteur…",
		dl_extract_label: "Extraction du moteur…",
		dl_engine_fail: "Échec de l'installation du moteur : ",
		dl_fallback: ". Démarrage en mode hors ligne.",
		dl_phase: { downloading: "Téléchargement…", verify: "Vérification de l'intégrité (SHA-256)…", linking: "Finalisation…", retry: "Connexion perdue — nouvelle tentative…", paused: "En pause", canceled: "Annulé", done: "Terminé" },
		btn_pause: "Pause",
		btn_resume: "Reprendre",
		btn_cancel: "Annuler",
		dl_hint: "Vous pouvez minimiser la fenêtre — le téléchargement continue en arrière-plan. La progression est affichée dans la barre des tâches.",
		done_h: "Tout est prêt",
		done_sub: "Modèle installé et fonctionnant en local. Vous pouvez changer de modèle à tout moment dans les paramètres.",
		btn_launch: "Ouvrir Nyx",
		hw_ram: "RAM",
		hw_gpu: "GPU",
	},
}

const T = OB_I18N[LANG] || OB_I18N.en
const t = (k) => T[k] ?? (OB_I18N.en[k] ?? "")

// Apply translations to [data-i18n] elements
function applyI18n() {
	document.title = t("title")
	document.documentElement.lang = LANG
	document.querySelectorAll("[data-i18n]").forEach((el) => {
		const key = el.getAttribute("data-i18n")
		if (T[key] != null) el.textContent = T[key]
	})
	// Welcome step
	const h = document.getElementById("t-welcome")
	if (h) h.textContent = t("welcome")
	const sub = document.getElementById("t-welcome-sub")
	if (sub) sub.textContent = t("welcome_sub")
	const ready = document.getElementById("t-ready")
	if (ready) ready.textContent = t("ready_h")
}

// Maximize button state sync
if (window.nyx?.onMaximize) window.nyx.onMaximize(() => { const b = document.getElementById("wcMax"); if (b) b.textContent = "❐" })
if (window.nyx?.onUnmaximize) window.nyx.onUnmaximize(() => { const b = document.getElementById("wcMax"); if (b) b.textContent = "□" })

// -------- UI helpers --------
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
const fmtGB = (b) => (b ? (b / 1024 ** 3).toFixed(1) + " GB" : "")
const fmtSpeed = (bps) => (bps > 0 ? (bps / 1024 ** 2).toFixed(1) + " MB/s" : "")
function fmtEta(s) {
	if (s == null) return ""
	if (s < 60) return `≈ ${Math.max(1, Math.round(s))} s`
	if (s < 3600) return `≈ ${Math.round(s / 60)} min`
	return `≈ ${(s / 3600).toFixed(1)} h`
}

function isQvacNative(tier) {
	return !!(tier && (tier.qvacNative || tier.engine === "qvac"))
}
function engineBadge(tier) {
	if (!isQvacNative(tier)) return ""
	return '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(8,145,178,.1);color:#0891b2;border:1px solid rgba(8,145,178,.2)">⚡ QVAC-native</span>'
}

let catalog = null
let recoTier = null
let chosen = null

async function init() {
	applyI18n()
	show("detect")
	try {
		const r = await fetch("/api/onboard/recommend").then((x) => x.json())
		catalog = r.catalog
		const hw = r.hardware
		const reco = r.recommend
		recoTier = catalog.tiers.find((t) => t.id === reco.tier) || catalog.tiers[0]
		$("#detect-text").textContent = t("detect_done")

		// Show hardware info cleanly: just the key numbers
		const hwParts = []
		if (hw.totalRamGB) hwParts.push(`${hw.totalRamGB} GB ${t("hw_ram")}`)
		if (hw.vramGB) hwParts.push(`${hw.vramGB} GB ${t("hw_gpu")}`)
		if (hwParts.length) $("#hero-hw").textContent = hwParts.join(" · ")

		setTimeout(() => renderHero(reco), 650)
	} catch (e) {
		try {
			catalog = await fetch("/api/onboard/catalog").then((x) => x.json())
			recoTier = catalog.tiers.find((tier) => tier.id === catalog.default) || catalog.tiers[0]
			setTimeout(() => renderHero({ reason: "" }), 650)
		} catch {
			$("#detect-text").textContent = t("detect_fail")
		}
	}
}

function renderHero(reco) {
	show("hero")
	const tier = recoTier
	const doc = document.getElementById("t-ready")
	if (doc) doc.textContent = t("ready_h")
	$("#hero-reason").textContent = reco.reason || t("ready_default_reason")
	$("#hero-card").innerHTML = `
		<div class="emoji">${tier.emoji || "🧠"}</div>
		<div class="body">
			<div class="title">${tier.display}<span class="tag-reco">${t("picked_for_you")}</span>${engineBadge(tier)}</div>
			<div class="subtitle">${tier.subtitle || ""}</div>
			<div class="badges">${(tier.badges || []).map((b) => `<span class="badge">${b}</span>`).join("")}</div>
		</div>`
	// Re-apply button text
	const startBtn = document.getElementById("hero-start")
	if (startBtn) startBtn.textContent = t("btn_start")
	const moreBtn = document.getElementById("show-more")
	if (moreBtn) moreBtn.textContent = t("btn_show_more")
}

$("#hero-start").onclick = () => startDownload(recoTier)
$("#show-more").onclick = () => renderChoose()
$("#back-hero").onclick = () => show("hero")

function renderChoose() {
	show("choose")
	const h = $("[data-i18n='all_models_h']")
	if (h) h.textContent = t("all_models_h")
	const s = $("[data-i18n='all_models_sub']")
	if (s) s.textContent = t("all_models_sub")
	const cards = $("#cards")
	cards.innerHTML = ""
	for (const tier of catalog.tiers) {
		const isReco = tier.id === recoTier.id
		const btn = document.createElement("button")
		btn.className = "card" + (isReco ? " reco" : "") + (isQvacNative(tier) ? " qvac" : "")
		btn.innerHTML = `
			<div class="emoji">${tier.emoji || "🧠"}</div>
			<div class="body">
				<div class="title">${tier.display}${isReco ? `<span class="tag-reco">${t("recommended")}</span>` : ""}${engineBadge(tier)}</div>
				<div class="subtitle">${tier.subtitle || ""}</div>
				<div class="badges">${(tier.badges || []).map((b) => `<span class="badge">${b}</span>`).join("")}</div>
			</div>`
		btn.onclick = () => startDownload(tier)
		cards.appendChild(btn)
	}
}

let poll = null
async function ensureEngineFirst() {
	let s = null
	try {
		s = await fetch("/api/engine/status").then((x) => x.json())
	} catch {}
	if (s && s.installed) return true
	$("#dl-title").textContent = t("dl_title_engine")
	$("#dl-model").textContent = t("dl_engine_desc")
	$("#dl-engine").textContent = t("dl_engine_label")
	try {
		await fetch("/api/engine/install", { method: "POST" })
	} catch {}
	return await new Promise((resolve) => {
		const timer = setInterval(async () => {
			let st
			try {
				st = await fetch("/api/engine/status").then((x) => x.json())
			} catch { return }
			const pct = Math.round((st.pct || 0) * 100)
			$("#bar").style.width = pct + "%"
			$("#dl-pct").textContent = pct + "%"
			$("#dl-size").textContent = st.total ? `${fmtGB(st.done)} / ${fmtGB(st.total)}` : ""
			$("#dl-speed").textContent = fmtSpeed(st.speed)
			$("#dl-eta").textContent = fmtEta(st.etaSec)
			const phases = t("dl_phase") || {}
			$("#dl-phase").textContent = st.phase === "extracting" ? t("dl_extract_label") : st.installed ? t("dl_done_label") : t("dl_loading_label")
			if (st.installed) {
				clearInterval(timer)
				resolve(true)
			} else if (st.phase === "error" && !st.active) {
				clearInterval(timer)
				$("#dl-phase").textContent = t("dl_engine_fail") + (st.error || "error") + t("dl_fallback")
				setTimeout(() => resolve(false), 1800)
			}
		}, 600)
	})
}

async function startDownload(tier) {
	chosen = tier
	show("download")
	await ensureEngineFirst()
	$("#dl-title").textContent = t("dl_title_model")
	$("#dl-model").textContent = `${tier.display} · ${tier.badges?.[0] || fmtGB(tier.bytes)}`
	$("#dl-engine").textContent = isQvacNative(tier) ? "⚡ QVAC-native · Tether" : "⚡ QVAC SDK (llama.cpp)"
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
		} catch { return }
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
			const phases = t("dl_phase") || {}
			$("#dl-phase").textContent = (phases.error || "Error") + ": " + (s.error || t("dl_engine_fail")) + `. ${t("btn_resume")}.`
			togglePause(true)
		}
	}, 600)
}

function phaseText(s) {
	const phases = (t("dl_phase") || {})
	return phases[s.phase] || ""
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
