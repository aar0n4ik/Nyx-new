// Prompt-injection firewall. All untrusted text (retrieved docs, OCR output,
// peer messages) is scanned and wrapped before it reaches the model.
const PATTERNS = [
	/ignore (all|the|any|previous|above) (instructions|prompts|rules)/i,
	/disregard (the )?(system|previous|above)/i,
	/reveal (your )?(system )?(prompt|instructions)/i,
	/you are now/i,
	/developer mode/i,
	/exfiltrate|send .* to https?:/i,
	/print (your )?(api[- ]?key|secret|seed phrase)/i,
]

export function scan(text = "") {
	const hits = PATTERNS.filter((p) => p.test(text)).map((p) => p.source)
	return { safe: hits.length === 0, hits }
}

// Mark content as data, not instructions, so the model won't obey it.
export function sanitize(text = "") {
	return `<<UNTRUSTED_DATA_START>>\n${text}\n<<UNTRUSTED_DATA_END>>`
}
