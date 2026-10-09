use anchor_lang::prelude::*;

#[event]
pub struct MarketCreated {
    pub market: Pubkey,
    pub id: u64,
    pub creator: Pubkey,
    pub question: String,
    pub end_time: i64,
    pub mint: Pubkey,
}

#[event]
pub struct BetPlaced {
    pub market: Pubkey,
    pub user: Pubkey,
    pub outcome: u8,
    pub amount: u64,
    pub yes_pool: u64,
    pub no_pool: u64,
}

#[event]
pub struct MarketResolved {
    pub market: Pubkey,
    pub resolver: Pubkey,
    pub winning_outcome: u8,
}

#[event]
pub struct MarketCancelled {
    pub market: Pubkey,
    pub by: Pubkey,
}

#[event]
pub struct WinningsClaimed {
    pub market: Pubkey,
    pub user: Pubkey,
    pub outcome: u8,
    pub stake: u64,
    pub payout: u64,
}

#[event]
pub struct RefundClaimed {
    pub market: Pubkey,
    pub user: Pubkey,
    pub refunded: u64,
}
