import "./polyfill";
import { AnchorProvider, Program, Idl, web3 } from "@coral-xyz/anchor";
import idlJson from "./idl/hunchqq.json";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

export const PROGRAM_ID = new web3.PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
);

export const USDC_MINT = process.env.NEXT_PUBLIC_USDC_MINT
  ? new web3.PublicKey(process.env.NEXT_PUBLIC_USDC_MINT)
  : null;

export const idl = idlJson as Idl;

export function getConnection(): web3.Connection {
  return new web3.Connection(RPC_URL, "confirmed");
}

function providerFrom(wallet: any, connection: web3.Connection): AnchorProvider {
  return new AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
    commitment: "confirmed",
  });
}

/** Build a Program for read-only use (no wallet). */
export function getReadProgram(): Program {
  const connection = getConnection();
  const wallet = {
    publicKey: web3.Keypair.generate().publicKey,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any) => txs,
  };
  return new Program(idl, providerFrom(wallet, connection));
}

/** Build a Program bound to the connected wallet for signing. */
export function getProgram(wallet: any): Program {
  return new Program(idl, providerFrom(wallet, getConnection()));
}

// ---------------------------------------------------------------------------
// PDA derivators (must mirror seeds in the program)
// ---------------------------------------------------------------------------

export const CONFIG_SEED = Buffer.from("config");

export function configPda(): [web3.PublicKey, number] {
  return web3.PublicKey.findProgramAddressSync([CONFIG_SEED], PROGRAM_ID);
}

export function marketPda(id: bigint | number): [web3.PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(id));
  return web3.PublicKey.findProgramAddressSync([Buffer.from("market"), buf], PROGRAM_ID);
}

export function vaultPda(market: web3.PublicKey): [web3.PublicKey, number] {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), market.toBuffer()],
    PROGRAM_ID
  );
}

export function positionPda(
  market: web3.PublicKey,
  user: web3.PublicKey
): [web3.PublicKey, number] {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("position"), market.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  );
}
