/*
 * get-txline-token.mjs — one-shot TxLINE free World Cup tier activation.
 * It: (1) loads/creates a Solana wallet, (2) on devnet airdrops free SOL,
 * (3) subscribes on-chain to the FREE service level (no TxL payment),
 * (4) gets a guest JWT, (5) signs + activates, then PRINTS the two values
 * you paste into Vercel: TXLINE_JWT and TXLINE_API_TOKEN.
 *
 * Run it on any machine with Node 20+ and internet (your PC or a Codespace):
 *   npm init -y
 *   npm i @coral-xyz/anchor @solana/web3.js @solana/spl-token tweetnacl
 *   TXLINE_NET=devnet node get-txline-token.mjs
 *
 * The wallet is saved to ./txline-wallet.json so re-runs reuse the same wallet
 * (activation MUST be signed by the same wallet that subscribed).
 */
import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import nacl from "tweetnacl";
import fs from "node:fs";

const NETWORK = (process.env.TXLINE_NET || "devnet").toLowerCase();
const SERVICE_LEVEL_ID = Number(process.env.TXLINE_SERVICE_LEVEL || 1); // free World Cup tier
const DURATION_WEEKS = Number(process.env.TXLINE_WEEKS || 4);
const SELECTED_LEAGUES = []; // [] = standard free World Cup bundle

const CONFIG = {
  mainnet: {
    rpcUrl: "https://api.mainnet-beta.solana.com",
    apiOrigin: "https://txline.txodds.com",
    programId: new PublicKey("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA"),
    txlTokenMint: new PublicKey("Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL"),
  },
  devnet: {
    rpcUrl: "https://api.devnet.solana.com",
    apiOrigin: "https://txline-dev.txodds.com",
    programId: new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"),
    txlTokenMint: new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG"),
  },
};

const cfg = CONFIG[NETWORK];
if (!cfg) throw new Error(`TXLINE_NET must be 'devnet' or 'mainnet' (got '${NETWORK}')`);
const apiBaseUrl = `${cfg.apiOrigin}/api`;

// ---- wallet (persisted so re-runs reuse the SAME signer) ----
const WALLET_PATH = "./txline-wallet.json";
let kp;
if (fs.existsSync(WALLET_PATH)) {
  kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"))));
  console.log("Loaded wallet:", kp.publicKey.toBase58());
} else {
  kp = Keypair.generate();
  fs.writeFileSync(WALLET_PATH, JSON.stringify([...kp.secretKey]));
  console.log("Created wallet:", kp.publicKey.toBase58(), "(saved to txline-wallet.json)");
}

const connection = new Connection(cfg.rpcUrl, "confirmed");
const wallet = new anchor.Wallet(kp);
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
anchor.setProvider(provider);

async function ensureSol() {
  const bal = await connection.getBalance(kp.publicKey);
  console.log("Balance:", bal / LAMPORTS_PER_SOL, "SOL");
  if (bal >= 0.05 * LAMPORTS_PER_SOL) return;
  if (NETWORK !== "devnet") {
    throw new Error(`Wallet ${kp.publicKey.toBase58()} needs ~0.05 SOL on mainnet for fees. Send some, then re-run.`);
  }
  console.log("Requesting devnet airdrop...");
  const sig = await connection.requestAirdrop(kp.publicKey, LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
  console.log("Airdrop done.");
}

async function main() {
  await ensureSol();

  // IDL is published on-chain — fetch it (no local txoracle.json needed).
  const idl = await anchor.Program.fetchIdl(cfg.programId, provider);
  if (!idl) throw new Error("Could not fetch on-chain IDL. Grab idl/txoracle.json from the TxLINE Runnable Devnet Examples and load it manually.");
  const program = new anchor.Program(idl, provider);

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync([Buffer.from("pricing_matrix")], cfg.programId);
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("token_treasury_v2")], cfg.programId);
  const tokenTreasuryVault = getAssociatedTokenAddressSync(cfg.txlTokenMint, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const userTokenAccount = getAssociatedTokenAddressSync(cfg.txlTokenMint, kp.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  // The program requires the user's TxL token account to already exist.
  // On the free tier it just needs to be an empty (0-balance) account, so we
  // create it idempotently right before subscribing (safe to re-run).
  const ensureAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    kp.publicKey,      // payer
    userTokenAccount,  // ata to create
    kp.publicKey,      // owner
    cfg.txlTokenMint,  // mint
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // Reuse an existing subscription tx if provided (skips re-subscribing).
  let txSig = process.env.TXLINE_TXSIG;
  if (txSig) {
    console.log("Reusing existing txSig (skipping subscribe):", txSig);
  } else {
    console.log(`Subscribing: service level ${SERVICE_LEVEL_ID}, ${DURATION_WEEKS} weeks (free tier, gas only)...`);
    txSig = await program.methods
      .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
      .accounts({
        user: kp.publicKey,
        pricingMatrix: pricingMatrixPda,
        tokenMint: cfg.txlTokenMint,
        userTokenAccount,
        tokenTreasuryVault,
        tokenTreasuryPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([ensureAtaIx])
      .rpc();
    console.log("Subscribed. txSig:", txSig);
  }

  // Guest JWT (TxLINE may return the token as raw text OR as JSON — handle both)
  const authRes = await fetch(`${cfg.apiOrigin}/auth/guest/start`, { method: "POST" });
  if (!authRes.ok) throw new Error(`guest/start failed: ${authRes.status} ${await authRes.text()}`);
  const authText = (await authRes.text()).trim();
  let jwt;
  try { const j = JSON.parse(authText); jwt = j.token || j.jwt || j.accessToken || authText; }
  catch { jwt = authText.replace(/^"|"$/g, ""); }
  if (!jwt || typeof jwt !== "string") throw new Error(`guest/start returned no usable token: ${authText}`);

  // Sign activation message: `${txSig}:${leagues.join(",")}:${jwt}`  (leagues=[] -> `${txSig}::${jwt}`)
  const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
  const signature = nacl.sign.detached(new TextEncoder().encode(messageString), kp.secretKey);
  const walletSignature = Buffer.from(signature).toString("base64");

  // Activate
  const actRes = await fetch(`${apiBaseUrl}/token/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ txSig, walletSignature, leagues: SELECTED_LEAGUES }),
  });
  if (!actRes.ok) throw new Error(`token/activate failed: ${actRes.status} ${await actRes.text()}`);
  const actText = (await actRes.text()).trim();
  let apiToken;
  try { const j = JSON.parse(actText); apiToken = j.token || j.apiToken || j.accessToken || j; }
  catch { apiToken = actText.replace(/^"|"$/g, ""); }
  if (!apiToken) throw new Error(`token/activate returned no usable token: ${actText}`);

  console.log("\n==================  PASTE THESE INTO VERCEL  ==================");
  console.log("TXLINE_NET        =", NETWORK);
  console.log("TXLINE_ORIGIN     =", cfg.apiOrigin);
  console.log("TXLINE_JWT        =", jwt);
  console.log("TXLINE_API_TOKEN  =", typeof apiToken === "string" ? apiToken : JSON.stringify(apiToken));
  console.log("===============================================================\n");
}

main().catch((e) => { console.error("FAILED:", e.message || e); process.exit(1); });
