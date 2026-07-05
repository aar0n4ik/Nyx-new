// Вставляет блок прямой загрузки (сайт → .exe, без GitHub) между якорями на лендинге.
import { readFileSync, writeFileSync } from "node:fs"

const FILE = process.env.LANDING_HTML || "public/site/index.html"
const START = '<span class="anchor" id="download"></span>'
const END = "<!-- FEATURES -->"

// Прямая ссылка на лёгкий установщик (веса внутрь НЕ зашиты). CDN отдаёт актуальный .exe.
const REL = "https://get.nyx.app/win"

const BLOCK = `${START}
<section class="download">
  <h2>Скачайте Nyx для Windows</h2>
  <p class="lead">Один лёгкий установщик — меньше 100 МБ. Модель ИИ вы выберете и загрузите уже внутри приложения — так быстрее и без лишнего веса.</p>
  <a class="btn-primary" href="${REL}" rel="noopener">⬇ Скачать для Windows</a>
  <p class="hint">Windows 10/11 · 64-bit · всё работает локально, без отправки данных в облако</p>
</section>
${END}`

let html = readFileSync(FILE, "utf8")
const s = html.indexOf(START)
const e = html.indexOf(END)
if (s === -1 || e === -1) {
	console.error("[patch-download] якоря не найдены, пропускаю")
	process.exit(0)
}
html = html.slice(0, s) + BLOCK + html.slice(e + END.length)
writeFileSync(FILE, html)
console.log("[patch-download] блок прямой загрузки обновлён ->", REL)
