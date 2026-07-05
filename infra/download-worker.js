// Cloudflare Worker: прямая раздача установщика без редиректа на GitHub.
// Маршруты:
//   GET get.nyx.app/win          -> отдаёт актуальный Nyx-Setup-<ver>.exe (с правильными заголовками)
//   GET get.nyx.app/latest.json  -> версия + метаданные для автообновления
// Файлы лежат в R2 (bucket NYX_RELEASES). Настройте binding в wrangler.toml.

export default {
	async fetch(request, env) {
		const url = new URL(request.url)
		const cors = {
			"access-control-allow-origin": "*",
			"cache-control": "public, max-age=300",
		}

		if (url.pathname === "/latest.json") {
			const obj = await env.NYX_RELEASES.get("latest.json")
			if (!obj) return new Response("not found", { status: 404 })
			return new Response(obj.body, {
				headers: { "content-type": "application/json; charset=utf-8", ...cors },
			})
		}

		if (url.pathname === "/win" || url.pathname === "/win/") {
			// latest.json хранит имя текущего установщика.
			const meta = await env.NYX_RELEASES.get("latest.json")
			if (!meta) return new Response("not found", { status: 404 })
			const { win } = await meta.json()
			const key = win?.key
			if (!key) return new Response("not configured", { status: 500 })
			const file = await env.NYX_RELEASES.get(key)
			if (!file) return new Response("not found", { status: 404 })
			return new Response(file.body, {
				headers: {
					"content-type": "application/octet-stream",
					"content-disposition": `attachment; filename="${win.filename || "Nyx-Setup.exe"}"`,
					"content-length": String(file.size),
					...cors,
				},
			})
		}

		return new Response("Nyx download service", { status: 200, headers: cors })
	},
}
