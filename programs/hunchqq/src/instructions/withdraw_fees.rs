use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::HunchQQError;
use crate::state::{Config, Market, MarketStatus};

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [Config::SEEDS],
        bump = config.bump,
        constraint = config.admin == admin.key() @ HunchQQError::Unauthorized,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [Market::SEEDS_PREFIX, &market.id.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    /// CHECK: mint validated by address = market.mint.
    #[account(address = market.mint)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [Market::VAULT_SEEDS_PREFIX, market.key().as_ref()],
        bump = market.vault_bump,
        token::mint = mint,
        token::authority = market,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Treasury token account: owned by the configured treasury, same mint.
    #[account(
        mut,
        constraint = treasury_token.owner == config.treasury @ HunchQQError::Unauthorized,
        constraint = treasury_token.mint == market.mint @ HunchQQError::InvalidTreasury,
    )]
    pub treasury_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// Moves the market's accrued platform fee from the vault to the treasury.
///
/// Safe ordering: payouts are computed from `total_pool - fee`, so the fee
/// portion is never needed to satisfy claims. Only withdrawable once per
/// market (`fee_collected`) and never on cancelled / zero-winner markets,
/// where every stake is refunded in full.
pub fn handler(ctx: Context<WithdrawFees>) -> Result<()> {
    let market = &ctx.accounts.market;
    require!(
        market.status == MarketStatus::Resolved,
        HunchQQError::MarketNotOpen
    );
    require!(!market.fee_collected, HunchQQError::AlreadyClaimed);

    let winning_pool = match market.winning_outcome {
        Some(1) => market.yes_pool,
        Some(0) => market.no_pool,
        _ => return err!(HunchQQError::MarketNotOpen),
    };
    // Zero-winner markets refund every stake in full — there is no fee.
    require!(winning_pool > 0, HunchQQError::NothingToClaim);

    let total_pool = market.total_pool()?;
    let fee = (total_pool as u128)
        .checked_mul(ctx.accounts.config.fee_bps as u128)
        .ok_or_else(|| error!(HunchQQError::Overflow))?
        .checked_div(10_000u128)
        .ok_or_else(|| error!(HunchQQError::Overflow))?;
    let fee = u64::try_from(fee).map_err(|_| error!(HunchQQError::Overflow))?;
    require!(fee > 0, HunchQQError::NothingToClaim);
    require!(
        ctx.accounts.vault.amount >= fee,
        HunchQQError::Overflow
    );

    let id = market.id.to_le_bytes();
    let seeds: &[&[u8]] = &[Market::SEEDS_PREFIX, id.as_ref(), &[market.bump]];
    let signer = &[seeds];
    let cpi = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.treasury_token.to_account_info(),
            authority: market.to_account_info(),
        },
        signer,
    );
    token::transfer(cpi, fee)?;

    let market = &mut ctx.accounts.market;
    market.fee_collected = true;

    msg!(
        "Fees withdrawn: market={}, fee={}",
        market.id,
        fee
    );
    Ok(())
}
