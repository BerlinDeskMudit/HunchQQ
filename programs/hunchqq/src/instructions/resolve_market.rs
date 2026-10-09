use anchor_lang::prelude::*;

use crate::errors::HunchQQError;
use crate::events::MarketResolved;
use crate::state::{Market, MarketStatus};

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    pub resolver: Signer<'info>,

    #[account(
        mut,
        seeds = [Market::SEEDS_PREFIX, &market.id.to_le_bytes()],
        bump = market.bump,
        constraint = market.resolver == resolver.key() @ HunchQQError::Unauthorized,
    )]
    pub market: Account<'info, Market>,
}

pub fn handler(ctx: Context<ResolveMarket>, winning_outcome: u8) -> Result<()> {
    require!(winning_outcome <= 1, HunchQQError::InvalidOutcome);

    let market = &mut ctx.accounts.market;
    require!(
        market.status == MarketStatus::Open,
        HunchQQError::AlreadyFinalized
    );
    require!(
        Clock::get()?.unix_timestamp >= market.end_time,
        HunchQQError::EndTimeNotReached
    );

    market.status = MarketStatus::Resolved;
    market.winning_outcome = Some(winning_outcome);

    emit!(MarketResolved {
        market: market.key(),
        resolver: ctx.accounts.resolver.key(),
        winning_outcome,
    });

    msg!(
        "Market {} resolved: outcome={}",
        market.id,
        winning_outcome
    );
    Ok(())
}
