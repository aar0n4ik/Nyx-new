# Evidence bundle

These files let anyone independently verify Nyx's claims.

| File | Proves | How to check |
|---|---|---|
| `poli.jsonl` | inferences happened, in order, unaltered | `node verify.js` |
| `poli.pub` | who signed the log | used by `verify.js` |
| `netguard.json` | zero cloud egress | `nonLoopback` must be `0` |
| `attestation.json` | which model produced answers | compare to `models.lock` |
| `bench.csv` | the performance numbers cited | re-run `npm run bench` |
| `receipt.sample.json` | a real paid, delegated inference | hash matches contents |
| `env.txt` | exact runtime + hardware | regenerate on your machine |

Generated files appear here after you run `bash bootstrap.sh` (or `demo.sh`).
The private signing key (`.poli.key`) is NEVER part of the bundle.
