use anchor_lang::prelude::*;

use crate::errors::HunchQQError;

/// Max question length in bytes (~200 chars as per spec).
pub const MAX_QUESTION_LEN: usize = 200;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum MarketStatus {
    /// Betting allowed before `end_time`.
    Open,
    /// Resolver set the winning outcome; claims enabled.
    Resolved,
    /// Cancelled; refunds enabled.
    Cancelled,
}

impl Default for MarketStatus {
    fn default() -> Self {
        MarketStatus::Open
    }
}

/// One prediction market, PDA seeds `["market", id.to_le_bytes()]`.
#[account]
#[derive(InitSpace)]
pub struct Market {
    /// Unique id (also used in PDA seeds).
    pub id: u64,
    /// Market creator.
    pub creator: Pubkey,
    /// Allowed to resolve; defaults to creator.
    pub resolver: Pubkey,
    /// SPL mint used for betting (test USDC on devnet).
    pub mint: Pubkey,
    /// The question, <= MAX_QUESTION_LEN bytes.
    #[max_len(MAX_QUESTION_LEN)]
    pub question: String,
    /// Unix timestamp after which betting stops and resolution unlocks.
    pub end_time: i64,
    /// Open -> Resolved | Cancelled.
    pub status: MarketStatus,
    /// 0 = No, 1 = Yes. `None` until resolved.
    pub winning_outcome: Option<u8>,
    /// Total staked on Yes.
    pub yes_pool: u64,
    /// Total staked on No.
    pub no_pool: u64,
    /// True once fees have been accounted for this market.
    pub fee_collected: bool,
    /// PDA bump for the market account.
    pub bump: u8,
    /// PDA bump for the vault token account.
    pub vault_bump: u8,
}

impl Market {
    pub const SEEDS_PREFIX: &'static [u8] = b"market";
    pub const VAULT_SEEDS_PREFIX: &'static [u8] = b"vault";

    pub fn total_pool(&self) -> Result<u64> {
        self.yes_pool
            .checked_add(self.no_pool)
            .ok_or_else(|| error!(HunchQQError::Overflow))
    }

    pub fn is_open(&self) -> bool {
        self.status == MarketStatus::Open
    }
}
