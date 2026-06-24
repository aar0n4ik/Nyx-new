// Localized, user-facing warning strings for each playbook, keyed by playbook id.
// The playbooks themselves keep Russian text for INTERNAL model grounding, but
// whatever we SURFACE to the user must match the chosen UI language so the chat
// is never half-English / half-Russian. pbWarnings() resolves the right list:
//   requested lang -> English -> Russian (playbook default).
// es/de/fr intentionally fall back to English (consistent, never mixed-in RU).

export const PB_WARNINGS = {
	"game-black-screen": {
		en: ["Close the game before clearing the shader cache", "The first launch after clearing will be slower (the cache rebuilds)", "If it doesn't help — update/roll back the GPU driver and switch to borderless windowed mode"],
		ru: ["Закройте игру перед очисткой кэша шейдеров", "Первый запуск после очистки будет дольше (кэш пересоберётся)", "Если не помогло — обновите/откатите драйвер GPU и включите оконный (borderless) режим"],
		uk: ["Закрийте гру перед очищенням кешу шейдерів", "Перший запуск після очищення буде довшим (кеш перебудується)", "Якщо не допомогло — оновіть/відкотіть драйвер GPU і увімкніть віконний (borderless) режим"],
	},
	"windows-update": {
		en: ["I'll find, download and install the updates in the background via Windows Update — no windows will pop up", "Don't turn off the PC until the install finishes", "If a reboot is needed, I'll tell you honestly at the end"],
		ru: ["Я сам найду, скачаю и установлю обновления в фоне через Windows Update — окна на экране не появятся", "Не выключай ПК до конца установки", "Если понадобится перезагрузка, я честно сообщу об этом в конце"],
		uk: ["Я сам знайду, завантажу та встановлю оновлення у фоні через Windows Update — вікна не з'являться", "Не вимикай ПК до кінця встановлення", "Якщо знадобиться перезавантаження, я чесно повідомлю про це наприкінці"],
	},
	"set-time": {
		en: ["Administrator rights are required — I'll request them myself via the Windows (UAC) prompt; just confirm it", "If time auto-sync is on, Windows may revert the change — turn off ‘Set time automatically’ in Settings"],
		ru: ["Нужны права администратора — я запрошу их сам через окно Windows (UAC); просто подтверди его", "Если включена авто-синхронизация, Windows может вернуть время обратно — отключи «Устанавливать время автоматически» в Параметрах"],
		uk: ["Потрібні права адміністратора — я запрошу їх сам через вікно Windows (UAC); просто підтверди його", "Якщо увімкнено авто-синхронізацію, Windows може повернути час назад — вимкни «Встановлювати час автоматично» в Параметрах"],
	},
	"change-language": {
		en: ["A display-language change applies after you sign out and back in", "The language pack must already be installed", "Specify the target language explicitly (e.g. en-US, ru-RU, uk-UA)"],
		ru: ["Смена языка интерфейса применяется после повторного входа", "Языковой пакет должен быть уже установлен", "Укажите целевой язык явно (напр. en-US, ru-RU, uk-UA)"],
		uk: ["Зміна мови інтерфейсу застосовується після повторного входу", "Мовний пакет має бути вже встановлений", "Вкажіть цільову мову явно (напр. en-US, ru-RU, uk-UA)"],
	},
	"network-no-internet": {
		en: ["A network reset may drop the connection for a couple of seconds"],
		ru: ["Сброс сети может на пару секунд разорвать соединение"],
		uk: ["Скидання мережі може на пару секунд розірвати з'єднання"],
	},
	"high-cpu-lag": {
		en: ["Don't kill system processes blindly"],
		ru: ["Не снимайте системные процессы вслепую"],
		uk: ["Не знімайте системні процеси наосліп"],
	},
	"gpu-driver": {
		en: ["Download drivers only from the NVIDIA/AMD/Intel websites"],
		ru: ["Скачивайте драйверы только с сайта NVIDIA/AMD/Intel"],
		uk: ["Завантажуйте драйвери лише з сайтів NVIDIA/AMD/Intel"],
	},
	"disk-space": {
		en: ["Don't delete files from system folders; use the built-in Disk Cleanup"],
		ru: ["Не удаляйте файлы из системных папок; используйте штатную Очистку диска"],
		uk: ["Не видаляйте файли з системних папок; використовуйте штатне Очищення диска"],
	},
	"overheating": {
		en: ["At >90°C under load — check cooling and dust before trading/gaming"],
		ru: ["При >90°C под нагрузкой — проверьте охлаждение и пыль перед торговлей/игрой"],
		uk: ["При >90°C під навантаженням — перевірте охолодження і пил перед торгівлею/грою"],
	},
}

/**
 * Resolve user-facing warnings for a matched playbook in the chosen language.
 * Fallback chain: requested lang -> English -> the playbook's own (RU) list.
 */
export function pbWarnings(pb, lang = "ru") {
	if (!pb) return []
	const m = PB_WARNINGS[pb.id]
	if (!m) return pb.warnings || []
	return m[lang] || m.en || m.ru || pb.warnings || []
}
