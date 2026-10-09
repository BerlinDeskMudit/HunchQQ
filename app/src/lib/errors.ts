/** Anchor error code -> friendly text. Codes 6000+ are the program's custom errors. */
export const ERROR_MAP: Record<number, string> = {
  6000: "Question must be 200 characters or fewer.",
  6001: "Question cannot be empty.",
  6002: "End time must be in the future.",
  6003: "Fee is too high.",
  6004: "This market is not open for bets.",
  6005: "Betting has closed — the end time has passed.",
  6006: "Market is already resolved.",
  6007: "Market was cancelled — claim your refund instead.",
  6008: "End time hasn't been reached yet.",
  6009: "Outcome must be Yes (1) or No (0).",
  6010: "This market is already finalized.",
  6011: "You already claimed from this position.",
  6012: "Nothing to claim on this position.",
  6013: "This position did not win.",
  6014: "You're not authorized to do that.",
  6015: "Arithmetic overflow — try a smaller amount.",
  6016: "Amount must be greater than zero.",
  6017: "The protocol is paused right now.",
  6018: "The protocol is not paused.",
  6019: "Invalid treasury account.",
};

const COMMON_ANCHOR: Record<string, string> = {
  AnchorError3012: "Account already initialized.",
  "3000": "You don't have enough SOL to pay for this transaction.",
  "3001": "This account is not owned by the expected program.",
  "3008": "Constraint violation — an account failed validation.",
};

/** Extract a human-readable message from any wallet/Anchor error. */
export function friendlyError(err: unknown): string {
  if (!err) return "Unknown error.";
  const e = err as {
    code?: number;
    errorCode?: { code?: number; number?: number; name?: string };
    error?: { errorCode?: { number?: number; name?: string }; errorLogs?: string[] };
    message?: string;
    logs?: string[];
  };

  // AnchorError shape: err.error.errorCode.number
  const anchorNum =
    e.error?.errorCode?.number ??
    e.errorCode?.number ??
    (typeof e.code === "number" ? e.code : undefined);

  if (anchorNum !== undefined && ERROR_MAP[anchorNum]) {
    return ERROR_MAP[anchorNum];
  }

  const logs = e.error?.errorLogs ?? e.logs ?? [];
  for (const line of logs) {
    const m = line.match(/custom program error: 0x([0-9a-f]+)/i);
    if (m) {
      const num = parseInt(m[1], 16);
      if (ERROR_MAP[num]) return ERROR_MAP[num];
      if (COMMON_ANCHOR[String(num)]) return COMMON_ANCHOR[String(num)];
    }
    const codeName = line.match(/AnchorError (\w+)/);
    if (codeName && COMMON_ANCHOR[codeName[1]]) return COMMON_ANCHOR[codeName[1]];
  }

  const msg = e.message ?? "";
  if (/user rejected/i.test(msg)) return "Transaction was rejected in your wallet.";
  if (/insufficient (lamports|funds)/i.test(msg))
    return "Not enough SOL to pay transaction fees.";
  if (/Blockhash not found/i.test(msg))
    return "Transaction expired — please try again.";

  // Fallback: strip noisy prefixes.
  return msg.split("\n")[0].slice(0, 200) || "Transaction failed.";
}
