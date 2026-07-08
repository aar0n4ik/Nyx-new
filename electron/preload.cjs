const { contextBridge, ipcRenderer } = require("electron")

// Безопасный мост renderer <-> main. Сеть наружу не открываем — только localhost API.
contextBridge.exposeInMainWorld("nyx", {
	version: () => ipcRenderer.invoke("nyx:version"),
	setProgress: (v) => ipcRenderer.send("nyx:progress", v),
	openExternal: (url) => ipcRenderer.send("nyx:open-external", url),
	minimize: () => ipcRenderer.send("nyx:minimize"),
	maximize: () => ipcRenderer.send("nyx:maximize"),
	close: () => ipcRenderer.send("nyx:close"),
	onMaximize: (cb) => ipcRenderer.on("nyx:maximized", (_e) => cb()),
	onUnmaximize: (cb) => ipcRenderer.on("nyx:unmaximized", (_e) => cb()),
})
