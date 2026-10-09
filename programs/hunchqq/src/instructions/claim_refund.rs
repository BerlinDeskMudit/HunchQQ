use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::HunchQQError;
use crate::events::RefundClaimed;
use crate::state::{Market, MarketStatus, Position};

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [Market::SEEDS_PREFIX, &market.id.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [Position::SEEDS, market.key().as_ref(), user.key().as_ref()],
        bump = position.bump,
        constraint = position.user == user.key() @ HunchQQError::Unauthorized,
        constraint = position.market == market.key() @ HunchQQError::MarketNotOpen,
    )]
    pub position: Account<'info, Position>,

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

    #[account(
        mut,
        constraint = user_token.owner == user.key() @ HunchQQError::Unauthorized,
        constraint = user_token.mint == market.mint @ HunchQQError::InvalidTreasury,
    )]
    pub user_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClaimRefund>) -> Result<()> {
    let market = &ctx.accounts.market;
    let position = &ctx.accounts.position;

    require!(
        market.status == MarketStatus::Cancelled,
        if market.status == MarketStatus::Resolved {
            HunchQQError::MarketResolved
        } else {
            HunchQQError::MarketNotOpen
        }
    );
    require!(!position.claimed, HunchQQError::AlreadyClaimed);

    let refund = position
        .yes_amount
        .checked_add(position.no_amount)
        .ok_or_else(|| error!(HunchQQError::Overflow))?;
    require!(refund > 0, HunchQQError::NothingToClaim);

    // Return the full stake from the vault.
    let id = market.id.to_le_bytes();
    let seeds: &[&[u8]] = &[Market::SEEDS_PREFIX, id.as_ref(), &[market.bump]];
    let signer = &[seeds];
    let cpi = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_token.to_account_info(),
            authority: market.to_account_info(),
        },
        signer,
    );
    token::transfer(cpi, refund)?;

    let position = &mut ctx.accounts.position;
    position.claimed = true;

    emit!(RefundClaimed {
        market: market.key(),
        user: ctx.accounts.user.key(),
        refunded: refund,
    });

    msg!(
        "Refund: market={}, user={}, amount={}",
        market.id,
        ctx.accounts.user.key(),
        refund
    );
    Ok(())
}
