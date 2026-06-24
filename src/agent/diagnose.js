// Full self-improving loop for ANY unpredictable PC problem (no hardcoded tasks):
//   1) recall a proven solution from the local cache,
//   2) ground the model with an expert playbook (so it never improvises wrongly),
//   3) let the local Llama generate a diagnostic/fix script,
//   4) validator gate -> (optional) sandboxed execution with timeout/limits,
//   5) feed the real OS output back to the model (it "learns" in-dialogue),
//   6) SELF-CORRECT on failure (analyze stderr, fix, retry), then remember success.
import { complete } from "../llm/engine.js"
import { runScript, resultToContext, defaultShell } from "../shell/connector.js"
import { validateScript } from "../shell/validator.js"
import * as cache from "../shell/solutionCache.js"
import { detectLang } from "../lang.js"
import { matchPlaybook, groundingFor } from "./playbooks.js"
import { pbWarnings } from "./playbook-i18n.js"
import { planSystem, interpretSystem, fixSystem } from "./prompts.js"

function extractJSON(text) {
	const m = text && String(text).match(/\{[\s\S]*\}/)
	if (!m) return null
	try { return JSON.parse(m[0]) } catch {}
	// tolerate trailing commas / smart quotes from small models
	try { return JSON.parse(m[0].replace(/,\s*([}\]])/g, "$1").replace(/[\u201c\u201d]/g, '"')) } catch { return null }
}

function mergeWarnings(...lists) {
	const out = []
	for (const l of lists) for (const w of l || []) if (w && !out.includes(w)) out.push(w)
	return out
}

/**
 * Plan a diagnostic/fix script. Priority for reliability:
 *   cache (proven, instant) -> strong playbook (proven, deterministic) ->
 *   local model grounded with the playbook -> playbook fallback if model fails.
 *
 * `preferModel`: when a real on-device model is available, the MODEL authors the
 * command (the playbook only GROUNDS it) so Nyx adapts to ANY phrasing instead
 * of returning a canned template. The strong-playbook short-circuit is then
 * skipped; the playbook is still the safe fallback if the model fails.
 */
export async function planScript(problem, { os = process.platform, lang, wantFix = false, preferModel = false } = {}) {
	lang = lang || detectLang(problem)

	// 1) Instant recall from the learned cache.
	const hit = cache.lookup(problem, { os })
	if (hit) return {
		source: "cache", shell: hit.shell, script: hit.script,
		explanation: "Найдено в локальном кэше решений (мгновенно, без нагрузки модели).",
		warnings: [], risk: validateScript(hit.script, { shell: hit.shell, lang }).risk,
		verdict: validateScript(hit.script, { shell: hit.shell, lang }), score: hit.score,
	}

	const pb = matchPlaybook(problem, os)
	const grounding = groundingFor(problem, os)

	// 2) Strong, trusted playbook match -> use the proven script verbatim.
	//    Skipped when preferModel is set (model authors a tailored command instead).
	if (pb && pb.strong && !preferModel) {
		const script = wantFix && pb.fix ? pb.fix : pb.diagnose
		return {
			source: "playbook", playbookId: pb.id, shell: pb.shell, script,
			explanation: `Проверенный паттерн «${pb.title}». ${pb.note || ""}`.trim(),
			warnings: mergeWarnings(pbWarnings(pb, lang)), risk: pb.risk,
			verdict: validateScript(script, { shell: pb.shell, lang }),
		}
	}

	// 3) Ask the local model, grounded with the playbook (if any).
	const raw = await complete([
		{ role: "system", content: planSystem(os, lang, grounding?.text) },
		{ role: "user", content: problem },
	], { temperature: 0.2 })
	let parsed = extractJSON(raw)

	// 3b) One stricter retry: small local models sometimes return prose or a
	// refusal instead of JSON. Re-ask with a hard JSON-only instruction so ANY
	// command (not just ones with a playbook) still yields a real script.
	if (!parsed || !parsed.script) {
		const raw2 = await complete([
			{ role: "system", content: planSystem(os, lang, grounding?.text) },
			{ role: "user", content: problem + "\n\n[Верни ТОЛЬКО валидный JSON с непустым полем \"script\" для этой ОС. Не отказывайся и не пиши прозу. Если нужны права администратора — поставь risk:\"elevated\".]" },
		], { temperature: 0.1 })
		const parsed2 = extractJSON(raw2)
		if (parsed2 && parsed2.script) parsed = parsed2
	}

	// 4) If the model failed to produce a usable script, fall back to the playbook.
	if ((!parsed || !parsed.script) && pb) {
		const script = wantFix && pb.fix ? pb.fix : pb.diagnose
		return {
			source: "playbook-fallback", playbookId: pb.id, shell: pb.shell, script,
			explanation: `Модель не дала валидный скрипт — взят проверенный паттерн «${pb.title}».`,
			warnings: mergeWarnings(pbWarnings(pb, lang)), risk: pb.risk,
			verdict: validateScript(script, { shell: pb.shell, lang }),
		}
	}

	const shell = parsed?.shell || pb?.shell || defaultShell()
	const script = parsed?.script || ""
	return {
		source: "llm", shell, script,
		explanation: parsed?.explanation || String(raw).slice(0, 400),
		warnings: mergeWarnings(parsed?.warnings, pbWarnings(pb, lang)), risk: parsed?.risk,
		verdict: validateScript(script, { shell, lang }),
	}
}

/** Ask the model to repair a script that failed at runtime. */
async function repairScript(problem, prev, run, { os, lang }) {
	const raw = await complete([
		{ role: "system", content: fixSystem(os, lang) },
		{ role: "user", content: `Проблема: ${problem}\n\nНЕУДАЧНЫЙ СКРИПТ (${prev.shell}):\n${prev.script}\n\n${resultToContext(problem, prev, run)}` },
	], { temperature: 0.2 })
	const parsed = extractJSON(raw)
	if (!parsed?.script) return null
	const shell = parsed.shell || prev.shell
	return { source: "self-correct", shell, script: parsed.script, explanation: parsed.explanation || "Исправлено после ошибки", warnings: mergeWarnings(parsed.warnings, prev.warnings), risk: parsed.risk, verdict: validateScript(parsed.script, { shell, lang }) }
}

/**
 * Full pipeline: plan -> validate -> (optional) execute -> interpret -> learn,
 * with up to `maxFix` self-correction retries on runtime failure.
 */
export async function diagnose(problem, { os = process.platform, lang, execute = false, confirm = false, wantFix = false, maxFix = 2, preferModel = false } = {}) {
	lang = lang || detectLang(problem)
	let plan = await planScript(problem, { os, lang, wantFix, preferModel })

	if (!plan.verdict.safe)
		return { ...plan, executed: false, blocked: true, summary: (lang === "ru" ? "Скрипт отклонён валидатором безопасности: " : lang === "uk" ? "Скрипт відхилено валідатором безпеки: " : "Script rejected by the safety validator: ") + plan.verdict.reasons.join("; ") }

	if (!execute) return { ...plan, executed: false, dryRun: true }

	let run = await runScript(plan.script, { shell: plan.shell, confirm })
	let attempts = 0
	// Self-correction loop: if the OS reported a real failure, fix and retry.
	while (run.executed && run.code !== 0 && attempts < maxFix) {
		attempts++
		const fixed = await repairScript(problem, plan, run, { os, lang })
		if (!fixed || !fixed.verdict.safe || !fixed.script || fixed.script === plan.script) break
		plan = fixed
		run = await runScript(plan.script, { shell: plan.shell, confirm })
	}

	if (!run.executed) return { ...plan, run, executed: false, attempts }

	// Feed the captured OS output back into the model so it interprets results.
	const summary = await complete([
		{ role: "system", content: interpretSystem(lang) },
		{ role: "user", content: resultToContext(problem, plan, run) },
	], { temperature: 0.3 })

	// Remember only genuinely successful runs.
	if (run.code === 0) cache.record({ problem, script: plan.script, shell: plan.shell, os, success: true })
	return { ...plan, run, executed: true, attempts, selfCorrected: attempts > 0, summary }
}
