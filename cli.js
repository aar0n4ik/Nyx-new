import "./src/netguard.js"
import { answer } from "./src/agents.js"
import { unloadAll } from "./src/qvac.js"

const q = process.argv.slice(2).join(" ") || "Hello, what can you do?"
const { text, sources, injection } = await answer(q, {
	onToken: (t) => process.stdout.write(t),
})
process.stdout.write("\n")
if (sources.length) console.error("sources:", sources.join(", "))
if (!injection.safe) console.error("injection flags:", injection.hits.join("; "))
await unloadAll()
