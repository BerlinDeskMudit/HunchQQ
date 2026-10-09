-- HunchQQ indexer schema (Postgres / Supabase)
-- Apply: psql "$DATABASE_URL" -f indexer/migrations/001_init.sql

CREATE TABLE IF NOT EXISTS markets (
    market_pubkey   TEXT PRIMARY KEY,
    market_id       BIGINT NOT NULL UNIQUE,
    creator         TEXT NOT NULL,
    resolver        TEXT NOT NULL,
    mint            TEXT NOT NULL,
    question        TEXT NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'resolved', 'cancelled')),
    winning_outcome SMALLINT CHECK (winning_outcome IN (0, 1)),
    yes_pool        BIGINT NOT NULL DEFAULT 0,
    no_pool         BIGINT NOT NULL DEFAULT 0,
    created_tx      TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bets (
    id              BIGSERIAL PRIMARY KEY,
    market_pubkey   TEXT NOT NULL REFERENCES markets(market_pubkey) ON DELETE CASCADE,
    user_wallet     TEXT NOT NULL,
    outcome         SMALLINT NOT NULL CHECK (outcome IN (0, 1)),
    amount          BIGINT NOT NULL,
    yes_pool        BIGINT NOT NULL DEFAULT 0,
    no_pool         BIGINT NOT NULL DEFAULT 0,
    tx_signature    TEXT NOT NULL,
    event_index     INT NOT NULL DEFAULT 0,
    slot            BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Idempotency: one row per (tx, event index) — replays are ignored.
    UNIQUE (tx_signature, event_index)
);

CREATE INDEX IF NOT EXISTS idx_bets_market ON bets (market_pubkey, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bets_user ON bets (user_wallet, created_at DESC);

CREATE TABLE IF NOT EXISTS users (
    wallet          TEXT PRIMARY KEY,
    first_seen_tx   TEXT,
    bet_count       INT NOT NULL DEFAULT 0,
    total_volume    BIGINT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claims (
    id              BIGSERIAL PRIMARY KEY,
    market_pubkey   TEXT NOT NULL,
    user_wallet     TEXT NOT NULL,
    kind            TEXT NOT NULL CHECK (kind IN ('winnings', 'refund')),
    amount          BIGINT NOT NULL,
    tx_signature    TEXT NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS odds_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    market_pubkey   TEXT NOT NULL REFERENCES markets(market_pubkey) ON DELETE CASCADE,
    yes_pool        BIGINT NOT NULL,
    no_pool         BIGINT NOT NULL,
    taken_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_odds_market_time
    ON odds_snapshots (market_pubkey, taken_at DESC);
