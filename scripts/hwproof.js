// Generate a REAL hardware proof from THIS machine — no fabricated specs.
// Writes evidence/hardware.json. Run on your own device:  npm run hwproof
import { writeFileSync, mkdirSync } from "node:fs"
import { collectSpecs } from "../src/system/specs.js"

mkdirSync("evidence", { recursive: true })
const specs = await collectSpecs()
const proof = { generatedAt: new Date().toISOString(), node: process.version, specs }
writeFileSync("evidence/hardware.json", JSON.stringify(proof, null, 2))
console.log("wrote evidence/hardware.json")
console.log(`  ${specs.cpu} | ${specs.cores} cores | ${specs.ramGB} GB RAM | ${specs.osBuild} (${specs.arch})`)
