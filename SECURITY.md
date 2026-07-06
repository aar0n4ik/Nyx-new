# Security & Privacy — Nyx

Nyx is a fully local, on-device AI agent. This document is the security overview for reviewers, testers, and grant committees. It describes what Nyx actually enforces in code today, and what is on the hardening roadmap.

## Principles
- **Local-first, zero-cloud inference.** Model weights and every prompt stay on the user's machine. No accounts, no telemetry, no prompt logging to any server.
- **Default-deny network egress.** All outbound sockets are blocked unless the destination host is on an explicit allowlist (`src/netguard.js`). Every permitted call is recorded to `evidence/netguard.json`, so the privacy claim is auditable, not aspirational.
- **Least privilege in the desktop shell.** Electron runs with `contextIsolation: true`, `nodeIntegration: false`, and a minimal preload bridge (`electron/preload.cjs`) exposing only three IPC methods. The renderer never receives Node or raw network access.

## Network allowlist (NetGuard)
Nyx permits only:
1. **Model download hosts** (one-time, during onboarding / model management): `huggingface.co`, `cdn-lfs*.huggingface.co`, `cdn.nyx.app`, `get.nyx.app`.
2. **User-approved integrations** (opt-in), e.g. exchange endpoints for the trading feature.

Everything else is blocked in strict mode (`NYX_STRICT=1`) or flagged in audit mode. The allowlist is extendable via `NYX_MODEL_HOSTS` / `NYX_ALLOW_HOSTS`. Model-download egress is counted and logged separately from integration egress so the audit trail is precise.

## Model integrity
- Weights download over HTTPS using **resumable HTTP Range** requests and are verified by **SHA-256** before activation (`src/downloader/modelDownloader.js`). On mismatch the partial file is deleted and never activated.
- Weights are **content-addressed and de-duplicated by hash** under the shared cache, so the same blob is never stored twice.
- The model catalog is signed-in-spirit: `src/catalog.json` pins the exact source repo per model; SHA-256 values are filled and verified by `scripts/fill-catalog.mjs` in CI.

## Proof-of-Local-Inference (PoLI)
- On first run Nyx generates an Ed25519 keypair (`.poli.key` private, `evidence/poli.pub` public) used to sign a local inference log — cryptographic evidence that inference happened on-device rather than in the cloud.

## Data at rest
- Config and models live under `~/.nyx`. Integration secrets (e.g. exchange keys) are encrypted on-device, and any trade action requires explicit double confirmation.

## Distribution integrity
- Windows installers are built in CI (GitHub Actions) and published to GitHub Releases with a stable asset name (`Nyx-Setup.exe`).
- **Roadmap:** code signing via Azure Trusted Signing or an EV certificate to remove the Windows SmartScreen first-run prompt. Until then the installer is unsigned; users proceed via “More info → Run anyway.”

## Reporting a vulnerability
Please open a private security advisory on the repository or contact the maintainer directly. Do not file public issues for security vulnerabilities.
