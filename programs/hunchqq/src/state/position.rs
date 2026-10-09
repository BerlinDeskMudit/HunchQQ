use anchor_lang::prelude::*;

/// A user's stake in one market, PDA seeds `["position", market, user]`.
#[account]
#[derive(InitSpace)]
pub struct Position {
    /// The market this position belongs to.
    pub market: Pubkey,
    /// The bettor.
    pub user: Pubkey,
    /// Staked on Yes.
    pub yes_amount: u64,
    /// Staked on No.
    pub no_amount: u64,
    /// Set true after winnings or refund are paid (once only).
    pub claimed: bool,
    /// PDA bump.
    pub bump: u8,
}

impl Position {
    pub const SEEDS: &'static [u8] = b"position";

    pub fn stake_on(&self, outcome: u8) -> u64 {
        if outcome == 1 {
            self.yes_amount
        } else {
            self.no_amount
        }
    }
}
