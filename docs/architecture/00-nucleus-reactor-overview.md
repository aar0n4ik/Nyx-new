# NYX Nucleus Reactor — Advanced Architecture (Index)

This folder documents four advanced subsystems that extend the shipped NYX chassis
(local-first AI + Zero-Trust Bitfinex broker + system orchestrator).

> **Engineering honesty banner.** These judges are low-level C/C++, P2P and crypto
> veterans. Marketing fantasy *loses* points with them. So every doc separates what
> is **[SHIPPED]** (running in this repo today), **[PARTIAL]** (a simpler version
> ships, full version specified), and **[BLUEPRINT]** (designed, not yet coded).
> Where the brief used physically-impossible phrasing (e.g. 'continue precisely
> mid-token', 'microsecond latency over P2P'), we replace it with the mechanism that
> is actually correct and explain *why*. Precision is the flex.

## The four subsystems

| # | Subsystem | Doc | Primary judging axis |
|---|-----------|-----|----------------------|
| 1 | Zero-copy context synchronization (CRDT + token-boundary checkpoint) | `01-zero-copy-context-sync.md` | Performance |
| 2 | Bitfinex local pre-flight verification & offline signing circuit | `02-preflight-verification-circuit.md` | Tether appeal / Capabilities |
| 3 | Hardware telemetry to dynamic-hyperparameter reaction loops | `03-telemetry-reaction-loops.md` | Complexity / Capabilities |
| 4 | P2P DHT load distribution (Holepunch-inspired) | `04-p2p-dht-load-distribution.md` | Innovation / the flex |

## How they map to the QVAC scoring rubric

- **Innovation** — P2P signed-cache mesh (4) + telemetry-driven self-throttling AI (3).
- **Capabilities** — broker pre-flight circuit (2) + OS telemetry control loop (3).
- **Artifact quality** — these specs + the PoLI/attestation evidence bundle.
- **Performance** — context-sync layer (1) removes failover stalls; telemetry loop (3)
  keeps latency stable under thermal/RAM pressure.
- **Complexity & UX** — all four are invisible to the user: the chat just never breaks.
- **Model usage** — the local Psy model is used for pre-flight reasoning (2), is the
  failover target (1), and is the unit of work shared across the mesh (4).

## System block diagram

```mermaid
flowchart TB
  U[User / Chat UI] --> ORCH[Agent Orchestrator]
  ORCH --> CS[(ConversationState CRDT - single source of truth)]
  ORCH --> ENG[Hybrid LLM Engine]
  ENG -->|online| GROQ[Groq Cloud]
  ENG -->|offline hot-swap| PSY[QVAC Psy model - local]
  CS <--> ENG
  TEL[Telemetry Sampler] --> CTRL[Hyperparameter Controller]
  CTRL --> ENG
  ORCH --> BRK[Zero-Trust Broker]
  BRK --> PF[Pre-Flight Verify + Offline Sign]
  PF --> WAL[(Durable Order Queue WAL)]
  WAL --> BFX[Bitfinex API]
  CACHE[(Signed Semantic Cache)] <--> DHTHyperDHT mesh
  ENG <--> CACHE
  PF --> POLI[(PoLI hash chain)]
  ENG --> POLI
```

## Reading order

Read 01 first (it defines `ConversationState`, the shared spine the others build on),
then 02, 03, 04. Each doc ends with **Integration points** naming the exact existing
files to touch, and a **Reality check** stating shipped vs blueprint.

## Current honest status snapshot

| Capability | Status |
|------------|--------|
| Hybrid Groq -> Ollama/Psy failover that never hangs | **[SHIPPED]** `src/llm/engine.js` |
| Per-chat isolated history, sliced + replayed on swap | **[SHIPPED]** `src/agents.js`, `public/app.js` |
| CRDT op-log conversation state | **[BLUEPRINT]** (today: ordered array + Lamport-free append) |
| Token-boundary checkpoint continuation | **[PARTIAL]** (history replay works; KV warm-start is blueprint) |
| Local pre-flight validation + risk/slippage | **[PARTIAL]** `src/trade/calculator.js`, `broker.js` |
| Offline Ed25519 receipt signing (PoLI) | **[SHIPPED]** `src/poli.js`, `verify.js` |
| Durable offline order queue + replay | **[BLUEPRINT]** |
| Live CPU/RAM telemetry sampling | **[SHIPPED]** `src/system/specs.js` |
| Telemetry -> hyperparameter controller | **[BLUEPRINT]** (sampler exists; controller specified here) |
| WDK gasless USDt settlement scaffold | **[PARTIAL]** `src/wallet/wdk.js`, `src/p2p/payments.js` |
| HyperDHT signed-cache mesh + load split | **[BLUEPRINT]** |
