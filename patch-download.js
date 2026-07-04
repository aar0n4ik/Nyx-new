import { readFileSync, writeFileSync } from "node:fs"

const F = "public/index.html"
let html = readFileSync(F, "utf8")

const START = '<span class="anchor" id="download"></span>'
const END = '<!-- FEATURES -->'
const i = html.indexOf(START)
const j = html.indexOf(END)
if (i < 0 || j < 0) { console.error("❌ markers not found — nothing changed"); process.exit(1) }

const REL = "https://github.com/aar0n4ik/Nyx-new/releases/latest"

const NEW = `<span class="anchor" id="download"></span>
<section class="alt">
  <div class="wrap">
    <div class="section-head">
      <div class="kicker">Download</div>
      <h2>Download Nyx & choose your model</h2>
      <p>One Windows app for every model — the installer stays small because no model is bundled. Pick a model here (or later inside Nyx); it downloads on first run and then runs 100% offline, with zero cloud calls.</p>
    </div>
    <style>
    .nyxf{background:#fff;border:1px solid var(--nyx-line);border-radius:16px;padding:26px;max-width:640px;margin:0 auto 30px;text-align:center;box-shadow:var(--nyx-shadow)}
    .nyxf h3{margin:0 0 6px;font-size:19px}
    .nyxrs{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:14px}
    .nyxr{border:2px solid var(--nyx-line);background:#fff;border-radius:12px;padding:10px 16px;font-weight:650;font-size:14px;cursor:pointer;color:#374151;font-family:inherit;transition:.15s}
    .nyxr:hover{border-color:var(--nyx-blue);color:var(--nyx-blue)}
    .nyxr.on{background:var(--nyx-blue);border-color:var(--nyx-blue);color:#fff}
    .nyxrec{background:linear-gradient(135deg,#eaf3fe,#f7faff);border:1px solid #c8dff7;border-radius:14px;padding:16px 20px;margin-top:16px;text-align:left;display:none}
    .nyxrec .l{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--nyx-blue)}
    .nyxrec .n{font-size:18px;font-weight:780;margin:4px 0}
    .nyxrec .w{font-size:14px;color:var(--nyx-muted)}
    .nyxb{display:inline-block;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;margin-bottom:8px}
    .cards .card.on{border-color:var(--nyx-blue)!important;box-shadow:0 0 0 2px rgba(39,131,222,.2)!important}
    .nyxs{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
    .nyxs span{background:var(--nyx-soft);border:1px solid var(--nyx-line);border-radius:8px;padding:4px 9px;font-size:12px;font-weight:600;color:#374151}
    .nyxos{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:30px}
    .nyxos .soon{opacity:.5;cursor:not-allowed}
    .nyxnote{max-width:640px;margin:14px auto 0;text-align:center;font-size:13px;color:var(--nyx-muted)}
    </style>
    <div class="nyxf">
      <h3>🔍 What's your hardware?</h3>
      <p class="notion-muted" style="margin:0">Tell us your RAM and we'll recommend the best model — your choice is saved for the app.</p>
      <div class="nyxrs">
        <button class="nyxr" onclick="nyxPick(this,'l')">4–8 GB RAM</button>
        <button class="nyxr" onclick="nyxPick(this,'b')">8–16 GB RAM</button>
        <button class="nyxr" onclick="nyxPick(this,'s')">16 GB+ / GPU</button>
      </div>
      <div class="nyxrec" id="nyxRec"></div>
    </div>
    <div class="cards">
      <div class="card" id="nc-l" data-model="llama-3.2-3b"><span class="nyxb" style="background:#ecfdf5;color:#059669">🟢 Light</span><h3>Llama 3.2 3B</h3><p>Fast, capable everyday model for chat and PC tasks — runs great on 8 GB RAM without a GPU.</p><div class="nyxs"><span>💾 ~2.0 GB</span><span>🖥️ 8 GB RAM</span><span>⚡ Fastest</span></div><a class="btn btn-primary" href="${REL}" target="_blank" onclick="return nyxSave('llama-3.2-3b')">⬇ Choose &amp; download</a></div>
      <div class="card" id="nc-b" data-model="qwen3-4b"><span class="nyxb" style="background:#fffbeb;color:#d97706">🟡 Balanced</span><h3>Qwen3 4B</h3><p>The best all-rounder for most laptops — strong reasoning with a small footprint.</p><div class="nyxs"><span>💾 ~2.6 GB</span><span>🖥️ 8 GB RAM</span><span>🏆 Recommended</span></div><a class="btn btn-primary" href="${REL}" target="_blank" onclick="return nyxSave('qwen3-4b')">⬇ Choose &amp; download</a></div>
      <div class="card" id="nc-s" data-model="llama-3.1-8b"><span class="nyxb" style="background:#fff7ed;color:#ea580c">🟠 Strong</span><h3>Llama 3.1 8B</h3><p>Sharper reasoning and coding. Best with 16 GB RAM or a discrete GPU.</p><div class="nyxs"><span>💾 ~4.7 GB</span><span>🖥️ 16 GB RAM</span><span>🎯 GPU friendly</span></div><a class="btn btn-primary" href="${REL}" target="_blank" onclick="return nyxSave('llama-3.1-8b')">⬇ Choose &amp; download</a></div>
    </div>
    <div class="nyxos">
      <a class="btn btn-primary" href="${REL}" target="_blank">🪟 Download for Windows (.exe)</a>
      <span class="btn btn-ghost soon" title="Coming soon">🍎 macOS — coming soon</span>
      <span class="btn btn-ghost soon" title="Coming soon">🐧 Linux — coming soon</span>
    </div>
    <p class="nyxnote">Windows 10/11 · The build is unsigned for now, so SmartScreen may warn — verify the SHA-256 shown on the release page before running.</p>
  </div>
</section>
<script>
var NYXM={l:{id:'llama-3.2-3b',n:'Llama 3.2 3B',w:'Fast and capable on 8 GB RAM — no GPU needed.'},b:{id:'qwen3-4b',n:'Qwen3 4B (recommended)',w:'The best balance of speed and intelligence for most laptops.'},s:{id:'llama-3.1-8b',n:'Llama 3.1 8B',w:'Sharper reasoning and code — best with 16 GB RAM or a GPU.'}};
function nyxSave(id){try{localStorage.setItem('nyx.model',id)}catch(e){}try{fetch('/api/model/select',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:id})}).catch(function(){});}catch(e){}return true;}
function nyxPick(el,t){document.querySelectorAll('.nyxr').forEach(function(b){b.classList.remove('on')});el.classList.add('on');document.querySelectorAll('.cards .card').forEach(function(c){c.classList.remove('on')});var c=document.getElementById('nc-'+t);if(c)c.classList.add('on');var m=NYXM[t];if(!m)return;nyxSave(m.id);var r=document.getElementById('nyxRec');r.innerHTML='<div class="l">⭐ Recommended for you</div><div class="n">'+m.n+'</div><div class="w">'+m.w+'</div><div class="w" style="margin-top:6px;color:#15a06b">✓ Saved — Nyx will use this model. You can change it anytime inside the app.</div>';r.style.display='block';}
</script>

`

html = html.slice(0, i) + NEW + html.slice(j)
writeFileSync(F, html)
console.log("✅ index.html download section replaced (" + html.length + " bytes)")
