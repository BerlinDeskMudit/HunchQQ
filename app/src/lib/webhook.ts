/**
 * Idempotent webhook receiver for HunchQQ program events.
 *
 * Exposed by the App Router as POST /api/webhook (see src/app/api/webhook/route.ts).
 * Body:    { signature: string, events: [{ name: string, data: object, index?: number }] }
 * Auth:    x-webhook-secret header must equal WEBHOOK_SECRET (when set).
 * Idempotency: every write dedupes on tx_signature (+ event_index for bets),
 * so replays are no-ops (Postgres unique violations are treated as applied).
 */
import { Pool, PoolClient } from "pg";

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
  : null;

interface InboundEvent {
  name: string;
  data: Record<string, unknown>;
  index?: number;
}

const HANDLED = new Set([
  "MarketCreated",
  "BetPlaced",
  "MarketResolved",
  "MarketCancelled",
  "WinningsClaimed",
  "RefundClaimed",
]);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function handleWebhook(req: Request): Promise<Response> {
  if (!pool) {
    return json(503, { error: "DATABASE_URL not configured" });
  }

  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers.get("x-webhook-secret") !== secret) {
    return json(401, { error: "unauthorized" });
  }

  let payload: { signature?: string; events?: InboundEvent[] };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "invalid JSON" });
  }

  const { signature, events } = payload;
  if (!signature || !Array.isArray(events) || events.length === 0) {
    return json(400, { error: "signature and events[] required" });
  }

  let applied = 0;
  let skipped = 0;

  for (const [i, ev] of events.entries()) {
    if (!ev || !HANDLED.has(ev.name)) {
      skipped++;
      continue;
    }
    try {
      const inserted = await applyEvent(pool, signature, ev.index ?? i, ev);
      if (inserted) applied++;
      else skipped++;
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "23505") {
        skipped++; // replay
      } else {
        console.error("webhook apply error", e);
        return json(500, { error: "apply failed", applied, skipped });
      }
    }
  }

  return json(200, { ok: true, applied, skipped });
}

async function applyEvent(
  db: Pool,
  signature: string,
  index: number,
  ev: InboundEvent
): Promise<boolean> {
  const d = ev.data ?? {};
  const client: PoolClient = await db.connect();
  try {
    await client.query("BEGIN");
    const applied = await write(client, signature, index, ev.name, d);
    await client.query("COMMIT");
    return applied;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

async function write(
  c: PoolClient,
  signature: string,
  index: number,
  name: string,
  d: Record<string, unknown>
): Promise<boolean> {
  const str = (v: unknown): string => String(v ?? "");
  const rowCount = (r: { rowCount: number | null }): boolean => (r.rowCount ?? 0) > 0;

  switch (name) {
    case "MarketCreated":
      return rowCount(
        await c.query(
          `INSERT INTO markets
             (market_pubkey, market_id, creator, resolver, mint, question, end_time, created_tx)
           VALUES ($1,$2,$3,$3,$4,$5,to_timestamp($6),$7)
           ON CONFLICT (market_pubkey) DO NOTHING`,
          [
            str(d.market),
            str(d.id ?? "0"),
            str(d.creator),
            str(d.mint),
            str(d.question),
            Number(d.end_time ?? 0),
            signature,
          ]
        )
      );

    case "BetPlaced": {
      const bet = await c.query(
        `INSERT INTO bets
           (market_pubkey, user_wallet, outcome, amount, yes_pool, no_pool, tx_signature, event_index)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (tx_signature, event_index) DO NOTHING`,
        [
          str(d.market),
          str(d.user),
          Number(d.outcome),
          str(d.amount),
          str(d.yes_pool),
          str(d.no_pool),
          signature,
          index,
        ]
      );
      if (!rowCount(bet)) return false;

      await c.query(
        `UPDATE markets SET yes_pool=$2, no_pool=$3, updated_at=now() WHERE market_pubkey=$1`,
        [str(d.market), str(d.yes_pool), str(d.no_pool)]
      );
      await c.query(
        `INSERT INTO users (wallet, first_seen_tx, bet_count, total_volume)
         VALUES ($1,$2,1,$3::bigint)
         ON CONFLICT (wallet) DO UPDATE
           SET bet_count = users.bet_count + 1,
               total_volume = users.total_volume + $3::bigint,
               updated_at = now()`,
        [str(d.user), signature, str(d.amount)]
      );
      return true;
    }

    case "MarketResolved":
      return rowCount(
        await c.query(
          `UPDATE markets SET status='resolved', winning_outcome=$2, updated_at=now()
           WHERE market_pubkey=$1 AND status='open'`,
          [str(d.market), Number(d.winning_outcome)]
        )
      );

    case "MarketCancelled":
      return rowCount(
        await c.query(
          `UPDATE markets SET status='cancelled', updated_at=now()
           WHERE market_pubkey=$1 AND status='open'`,
          [str(d.market)]
        )
      );

    case "WinningsClaimed":
    case "RefundClaimed":
      return rowCount(
        await c.query(
          `INSERT INTO claims (market_pubkey, user_wallet, kind, amount, tx_signature)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (tx_signature) DO NOTHING`,
          [
            str(d.market),
            str(d.user),
            name === "WinningsClaimed" ? "winnings" : "refund",
            str(d.payout ?? d.refunded ?? "0"),
            signature,
          ]
        )
      );

    default:
      return false;
  }
}
