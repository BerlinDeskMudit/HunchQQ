use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("4HHwg8tUWFiFd6AoMn2Nus4jgRY68vYfmeSSTMLpyZLV");

#[program]
pub mod hunchqq {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        fee_bps: u16,
        treasury: Pubkey,
    ) -> Result<()> {
        instructions::initialize_config::handler(ctx, fee_bps, treasury)
    }

    pub fn create_market(
        ctx: Context<CreateMarket>,
        question: String,
        end_time: i64,
        resolver: Pubkey,
    ) -> Result<()> {
        instructions::create_market::handler(ctx, question, end_time, resolver)
    }

    pub fn place_bet(ctx: Context<PlaceBet>, amount: u64, outcome: u8) -> Result<()> {
        instructions::place_bet::handler(ctx, amount, outcome)
    }

    pub fn resolve_market(ctx: Context<ResolveMarket>, winning_outcome: u8) -> Result<()> {
        instructions::resolve_market::handler(ctx, winning_outcome)
    }

    pub fn cancel_market(ctx: Context<CancelMarket>) -> Result<()> {
        instructions::cancel_market::handler(ctx)
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        instructions::claim_winnings::handler(ctx)
    }

    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        instructions::claim_refund::handler(ctx)
    }

    pub fn withdraw_fees(ctx: Context<WithdrawFees>) -> Result<()> {
        instructions::withdraw_fees::handler(ctx)
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        instructions::set_paused::handler(ctx, paused)
    }
}
