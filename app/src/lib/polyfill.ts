import { Buffer } from "buffer";

/**
 * Browser polyfills for Solana libs (@solana/web3.js, anchor, bn.js).
 * Next.js does not inject Node globals into client bundles, so we install
 * them once before any PDA/IDL helper runs.
 */
const g = globalThis as Record<string, unknown>;

if (typeof g.Buffer === "undefined") g.Buffer = Buffer;
if (typeof g.global === "undefined") g.global = globalThis;

export {};
