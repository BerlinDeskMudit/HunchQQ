use anchor_lang::prelude::*;

/// Maximum platform fee accepted by `initialize_config` (10%).
pub const MAX_FEE_BPS: u16 = 1_000;

/// Global protocol settings, PDA seeds `["config"]`.
#[account]
#[derive(InitSpace)]
pub struct Config {
    /// Protocol admin (pause, withdraw fees, cancel markets).
    pub admin: Pubkey,
    /// Account that receives withdrawn fees.
    pub treasury: Pubkey,
    /// Platform fee in basis points (200 = 2%).
    pub fee_bps: u16,
    /// Monotonically increasing market id counter.
    pub market_count: u64,
    /// Emergency stop: rejects new bets and market creation.
    pub paused: bool,
    /// PDA bump.
    pub bump: u8,
}

impl Config {
    pub const SEEDS: &'static [u8] = b"config";
}
