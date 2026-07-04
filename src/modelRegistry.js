// src/modelRegistry.js
// Single source of truth for the on-device models Nyx offers.
// It NEVER blindly hardcodes an SDK constant: for each catalog entry we scan the
// installed @qvac/sdk's real exports and use the first constant that actually
// exists. It also persists the user's choice and reports honest download state.
import { homedir } from "node:os"
import {
  existsSync, readdirSync, statSync, mkdirSync, writeFileSync, readFileSync,
} from "node:fs"
import { join } from "node:path"

let sdk = null
try { sdk = await import("@qvac/sdk") } catch { sdk = null }
export const hasSDK = !!sdk

// Ordered light -> heavy. `patterns` = candidate SDK constant names; `match` =
// tokens used to recognize this model's weights file in the on-disk cache.
export const CATALOG = [
  {
    id: "llama-3.2-3b",
    label: "Llama 3.2 3B Instruct",
    blurb: "Fastest. Great on low-RAM laptops.",
    sizeGB: 2.0, minRamGB: 8, tier: "light",
    patterns: [/^LLAMA_?3[._]?2_?3B.*INST/i],
    match: [/llama/i, /3.?2/, /3b/i],
  },
  {
    id: "qwen3-4b",
    label: "Qwen3 4B Instruct",
    blurb: "Best balance. Strong multilingual (incl. Russian).",
    sizeGB: 2.6, minRamGB: 8, tier: "balanced", recommended: true,
    patterns: [/^QWEN_?3.*4B.*INST/i, /^QWEN3?_?4B.*INST/i, /^QWEN.*4B/i],
    match: [/qwen/i, /4b/i],
  },
  {
    id: "llama-3.1-8b",
    label: "Llama 3.1 8B Instruct",
    blurb: "Highest quality. Needs ~16 GB RAM.",
    sizeGB: 4.7, minRamGB: 16, tier: "quality",
    patterns: [/^LLAMA_?3[._]?1_?8B.*INST/i],
    match: [/llama/i, /3.?1/, /8b/i],
  },
]

function sdkConsts() {
  if (!sdk) return []
  return Object.keys(sdk).filter((k) => /^[A-Z0-9_]+$/.test(k) && typeof sdk[k] !== "function")
}

// The real SDK constant for a catalog entry, or null if this SDK build lacks it.
export function resolveConst(entry) {
  const names = sdkConsts()
  for (const re of entry.patterns) { const hit = names.find((n) => re.test(n)); if (hit) return hit }
  return null
}

// --- persisted user choice -------------------------------------------------
const DATA_DIR = process.env.NYX_DATA_DIR || "data"
const CONFIG_FILE = join(DATA_DIR, "model.json")

export function getSelectedId() {
  try { return JSON.parse(readFileSync(CONFIG_FILE, "utf8")).id || null } catch { return null }
}
export function setSelectedId(id) {
  if (!CATALOG.some((m) => m.id === id)) throw new Error("unknown model id: " + id)
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify({ id, at: new Date().toISOString() }, null, 2))
  return id
}

// Selected SDK constant: env override wins, then the persisted choice. null if
// nothing chosen or the chosen model isn't exposed by this SDK build.
export function selectedConst() {
  if (process.env.NYX_QVAC_MODEL) return process.env.NYX_QVAC_MODEL
  const id = getSelectedId()
  if (!id) return null
  const entry = CATALOG.find((m) => m.id === id)
  return entry ? resolveConst(entry) : null
}

// --- on-disk cache ---------------------------------------------------------
function cacheDir() { return process.env.NYX_QVAC_CACHE || join(homedir(), ".qvac", "models") }

function cachedFiles() {
  const dir = cacheDir(); const found = []
  try {
    if (!existsSync(dir)) return found
    const walk = (d, depth) => {
      if (depth > 3) return
      for (const name of readdirSync(d)) {
        const p = join(d, name)
        let st; try { st = statSync(p) } catch { continue }
        if (st.isDirectory()) walk(p, depth + 1)
        else if (/\.(gguf|bin|onnx|task)$/i.test(name) && st.size > 1000000)
          found.push({ name, sizeMB: Math.round(st.size / 1e6) })
      }
    }
    walk(dir, 0)
  } catch {}
  return found
}

// Best-effort: is a catalog entry's weights file present on disk? Matches by the
// entry's tokens against cached filenames (honest, approximate).
function isDownloaded(entry, files) {
  return files.some((f) => entry.match.every((re) => re.test(f.name)))
}

// Full, honest snapshot for the UI/API.
export function listModels() {
  const files = cachedFiles()
  const selId = getSelectedId()
  const models = CATALOG.map((m) => {
    const konst = resolveConst(m)
    return {
      id: m.id, label: m.label, blurb: m.blurb, sizeGB: m.sizeGB,
      minRamGB: m.minRamGB, tier: m.tier, recommended: !!m.recommended,
      available: hasSDK && !!konst,
      const: konst,
      downloaded: isDownloaded(m, files),
      selected: selId === m.id,
    }
  })
  return { sdkInstalled: hasSDK, cacheDir: cacheDir(), selectedId: selId, models }
}
