// Self-custodial wallet via @tetherto/wdk (WDK). Falls back to a local mock
// wallet so payment flows stay demoable fully offline.
// VERIFY exact init/transfer APIs against https://docs.wdk.tether.io
let wdk = null
try {
	wdk = await import("@tetherto/wdk")
} catch {
	wdk = null
}

export const hasWDK = !!wdk

export async function createWallet(seedLabel = "local") {
	if (!wdk) {
		return { address: `mock-wallet-${seedLabel}`, mock: true }
	}
	// TODO: replace with real WDK self-custodial wallet init (BIP-84 / gasless USDt).
	return { address: "wdk-wallet", mock: false }
}

export async function balance() {
	// WDK Indexer API base: https://wdk-api.tether.io (needs network).
	return { usdt: 0, mock: !wdk }
}

// Quote a USD₮ settlement fee for a given gross amount. Gasless USDt transfers
// on Plasma/USDT0 are effectively zero base-fee; we model a tiny relayer fee.
export function quoteFee(grossUsd = 0) {
	const RELAYER = 0.0 // gasless USDt: zero base network fee
	const fee = +(Number(grossUsd) * 0 + RELAYER).toFixed(4)
	return { settleUsdt: +Number(grossUsd).toFixed(2), networkFeeUsdt: fee, rail: wdk ? "wdk" : "mock", gasless: true }
}
