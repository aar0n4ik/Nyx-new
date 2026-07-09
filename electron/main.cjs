const { app, BrowserWindow, ipcMain, shell } = require("electron")
const { spawn } = require("node:child_process")
const path = require("node:path")
const http = require("node:http")
const fs = require("node:fs")
const os = require("node:os")

const PORT = process.env.NYX_PORT || "3000"
const BASE = `http://localhost:${PORT}`
const NYX_HOME = process.env.NYX_HOME || path.join(os.homedir(), ".nyx")
const CONFIG_FILE = path.join(NYX_HOME, "config.json")

let win = null
let child = null
let pollTimer = null

function isOnboarded() {
	try {
		const c = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"))
		return Boolean(c && c.onboarded && c.modelPath)
	} catch {
		return false
	}
}

function startServer() {
	const serverPath = path.join(__dirname, "..", "server.js")
	child = spawn(process.execPath, [serverPath], {
		env: { ...process.env, NYX_PORT: String(PORT), ELECTRON_RUN_AS_NODE: "1" },
		stdio: "inherit",
	})
	child.on("exit", (code) => console.log(`[nyx] server exited ${code}`))
}

function waitForServer(cb, tries = 0) {
	http
		.get(BASE + "/api/onboard/state", (r) => {
			r.resume()
			cb()
		})
		.on("error", () => {
			if (tries > 100) return cb()
			setTimeout(() => waitForServer(cb, tries + 1), 150)
		})
}

// Прогресс загрузки модели — в таскбар ОС (как Apple/современные установщики).
function pollProgress() {
	clearInterval(pollTimer)
	pollTimer = setInterval(() => {
		http
			.get(BASE + "/api/model/download/status", (r) => {
				let buf = ""
				r.on("data", (d) => (buf += d))
				r.on("end", () => {
					try {
						const s = JSON.parse(buf)
						if (!win) return
						if (s.active && s.pct > 0 && s.pct < 1) win.setProgressBar(s.pct)
						else win.setProgressBar(-1)
					} catch {}
				})
			})
			.on("error", () => {})
	}, 700)
}

function createWindow() {
	win = new BrowserWindow({
		width: 1180,
		height: 820,
		minWidth: 900,
		minHeight: 640,
		backgroundColor: "#ffffff",
		frame: false,
		webPreferences: {
			preload: path.join(__dirname, "preload.cjs"),
			contextIsolation: true,
			nodeIntegration: false,
		},
	})
	const route = isOnboarded() ? "/app" : "/onboard"
	win.loadURL(BASE + route)
	pollProgress()
	win.on("closed", () => {
		win = null
		clearInterval(pollTimer)
	})
	win.on("maximize", () => win.webContents.send("nyx:maximized"))
	win.on("unmaximize", () => win.webContents.send("nyx:unmaximized"))
}

ipcMain.handle("nyx:version", () => app.getVersion())
ipcMain.on("nyx:progress", (_e, v) => {
	if (win) win.setProgressBar(typeof v === "number" ? v : -1)
})
ipcMain.on("nyx:open-external", (_e, url) => {
	if (/^https?:\/\//.test(url || "")) shell.openExternal(url)
})
ipcMain.on("nyx:minimize", () => win?.minimize())
ipcMain.on("nyx:maximize", () => {
	if (!win) return
	if (win.isMaximized()) win.unmaximize()
	else win.maximize()
})
ipcMain.on("nyx:close", () => win?.close())

app.whenReady().then(() => {
	startServer()
	waitForServer(() => createWindow())
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit()
})
app.on("quit", () => {
	try {
		child && child.kill()
	} catch {}
})
