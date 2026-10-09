use anchor_lang::prelude::*;

use crate::errors::HunchQQError;
use crate::events::MarketCancelled;
use crate::state::{Config, Market, MarketStatus};

#[derive(Accounts)]
pub struct CancelMarket<'info> {
    pub signer: Signer<'info>,

    #[account(
        seeds = [Config::SEEDS],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [Market::SEEDS_PREFIX, &market.id.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
}

pub fn handler(ctx: Context<CancelMarket>) -> Result<()> {
    // Only admin or the market's resolver may cancel.
    let signer = ctx.accounts.signer.key();
    let is_admin = signer == ctx.accounts.config.admin;
    let is_resolver = signer == ctx.accounts.market.resolver;
    require!(
        is_admin || is_resolver,
        HunchQQError::Unauthorized
    );

    let market = &mut ctx.accounts.market;
    require!(
        market.status == MarketStatus::Open,
        HunchQQError::AlreadyFinalized
    );

    market.status = MarketStatus::Cancelled;

    emit!(MarketCancelled {
        market: market.key(),
        by: signer,
    });

    msg!("Market {} cancelled by {}", market.id, signer);
    Ok(())
}
